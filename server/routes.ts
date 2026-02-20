import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedDatabase, seedCompetitions } from "./seed.js";
import { fplApi } from "./services/fplApi.js";
import { fetchSorarePlayer } from "./services/sorare.js";

// ✅ Google auth (Passport) – relies on session/passport middleware being set up in server entry file
import passport from "passport";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);

/** True when deployed on Replit (has REPL_ID). Use Replit Auth there. */
const isReplit = Boolean(process.env.REPL_ID);

/** True when we want to skip real auth (e.g. Railway/Vercel/local dev without real auth). */
const useMockAuth =
  process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);

/**
 * Base authentication middleware
 * Attaches req.authUserId for all protected routes
 */
export function requireAuth(req: any, res: any, next: any) {
  // MOCK AUTH MODE (dev only)
  if (useMockAuth) {
    const mockUserId = process.env.MOCK_USER_ID || "test-user-1";
    req.authUserId = mockUserId;

    // Helpful for code paths that expect req.user
    if (!req.user) {
      req.user = {
        id: mockUserId,
        claims: { sub: mockUserId },
        firstName: process.env.MOCK_FIRST_NAME || "Mock",
        lastName: process.env.MOCK_LAST_NAME || "User",
      };
    }

    return next();
  }

  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const userId = user.claims?.sub || user.id;
  if (!userId) return res.status(401).json({ message: "Invalid user identity" });

  req.authUserId = userId;
  next();
}

/**
 * Admin middleware (must be used AFTER requireAuth)
 */
export function isAdmin(req: any, res: any, next: any) {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId)) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ----------------
  // AUTH ROUTES
  // ----------------

  if (isReplit) {
    // Replit Auth
    await setupAuth(app);
    registerAuthRoutes(app);
  } else if (useMockAuth) {
    // Mock auth (dev/testing)
    console.log(
      "Using mock auth (Replit not detected; set SESSION_SECRET + Google vars for production auth).",
    );

    app.use((req: any, _res, next) => {
      const mockId = process.env.MOCK_USER_ID;
      if (!mockId) {
        throw new Error("MOCK_USER_ID is required when USE_MOCK_AUTH is enabled");
      }

      req.isAuthenticated = () => true;
      req.user = {
        id: mockId,
        claims: { sub: mockId },
        firstName: process.env.MOCK_FIRST_NAME || "Mock",
        lastName: process.env.MOCK_LAST_NAME || "User",
      };

      // Normalize for the rest of the app
      req.authUserId = mockId;

      next();
    });

    app.get("/api/auth/user", (req: any, res) => res.json(req.user));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
  } else {
    // ✅ Railway/production Google OAuth (non-Replit)
    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (_req, res) => res.redirect("/"),
    );

    app.get("/api/auth/user", (req: any, res) => {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      res.json(req.user);
    });

    app.get("/api/logout", (req: any, res) => {
      req.logout?.(() => {});
      req.session?.destroy(() => {});
      res.clearCookie("connect.sid");
      res.redirect("/");
    });

    app.post("/api/auth/logout", (req: any, res) => {
      req.logout?.(() => {});
      req.session?.destroy(() => {});
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  }

  // ----------------
  // --- API ROUTES ---
  // ----------------

  // User Profile
  app.get("/api/user", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (e: any) {
      console.error("Get user:", e);
      res.status(500).json({ message: e?.message || "Failed to get user" });
    }
  });

  app.patch("/api/user/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { managerTeamName, name, email, avatarUrl } = req.body;
      
      const updates: Partial<any> = {};
      if (managerTeamName !== undefined) updates.managerTeamName = managerTeamName;
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      
      const updated = await storage.updateUser(userId, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updated);
    } catch (e: any) {
      console.error("Update user profile:", e);
      res.status(500).json({ message: e?.message || "Failed to update profile" });
    }
  });

  app.get("/api/epl/standings", async (_req, res) => {
    try {
      res.json([]);
    } catch (e: any) {
      console.error("EPL standings:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch standings" });
    }
  });

  app.get("/api/epl/fixtures", async (req, res) => {
    try {
      const status = String(req.query.status || "").toLowerCase().trim(); // optional
      const fixtures = await fplApi.fixtures();

      let filtered = fixtures;
      if (status) {
        if (status === "upcoming" || status === "scheduled") {
          filtered = fixtures.filter((f: any) => !f.finished && !f.started);
        } else if (status === "live" || status === "inplay") {
          filtered = fixtures.filter((f: any) => f.started && !f.finished);
        } else if (status === "finished" || status === "ft") {
          filtered = fixtures.filter((f: any) => f.finished);
        }
      }

      res.json({ response: filtered });
    } catch (e: any) {
      console.error("EPL fixtures:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch fixtures" });
    }
  });

  app.get("/api/epl/players", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "100"), 10)));

      const search = String(req.query.search || "").toLowerCase().trim();
      const position = String(req.query.position || "").trim(); // optional: GK/DEF/MID/FWD

      const players = await fplApi.getPlayers();
      let filtered = Array.isArray(players) ? players : [];

      if (search) {
        filtered = filtered.filter((p: any) => {
          const n = `${p.first_name ?? ""} ${p.second_name ?? ""} ${p.web_name ?? ""}`.toLowerCase();
          return n.includes(search);
        });
      }

      if (position) {
        const pos = position.toUpperCase();
        const map: Record<string, number> = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
        const wantedType = map[pos];

        filtered = filtered.filter((p: any) => {
          const pPos = String(p.position_short || p.position || "").toUpperCase();
          return (pPos && pPos === pos) || (wantedType && Number(p.element_type) === wantedType);
        });
      }

      const total = filtered.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const pageItems = filtered.slice(start, end);

      res.json({
        response: pageItems,
        results: pageItems.length,
        paging: { current: page, total: Math.max(1, Math.ceil(total / limit)) },
        total,
      });
    } catch (e: any) {
      console.error("EPL players:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch players" });
    }
  });

  app.get("/api/epl/injuries", async (_req, res) => {
    try {
      const data = await fplApi.getInjuries();
      res.json({ response: data });
    } catch (e: any) {
      console.error("EPL injuries:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch injuries" });
    }
  });

  // Live Games Endpoint
  app.get("/api/epl/live-games", async (_req, res) => {
    try {
      const liveGames = await fplApi.getLiveGames();
      res.json(liveGames);
    } catch (e: any) {
      console.error("EPL live games:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch live games" });
    }
  });

  app.get("/api/sorare/player", async (req, res) => {
    try {
      const firstName = (req.query.firstName as string) || "";
      const lastName = (req.query.lastName as string) || "";
      if (!firstName.trim() || !lastName.trim()) {
        return res.status(400).json({ message: "firstName and lastName required" });
      }
      const player = await fetchSorarePlayer(firstName.trim(), lastName.trim());
      res.json(player ?? null);
    } catch (e: any) {
      console.error("Sorare player:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch Sorare player" });
    }
  });

  // Sync Data Route (warms FPL caches)
  app.post("/api/epl/sync", async (_req, res) => {
    try {
      await Promise.all([fplApi.bootstrap(), fplApi.fixtures()]);
      res.json({ success: true, message: "Data synced successfully" });
    } catch (error: any) {
      console.error("Sync failed:", error);
      res.status(500).json({ message: "Failed to sync data", error: error?.message });
    }
  });

  // -------------------------
  // ✅ CARDS: My Collection
  // -------------------------
  app.get("/api/cards/my", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cards = await storage.getUserCards(userId);
      return res.json({ cards });
    } catch (error: any) {
      console.error("Fetch my cards failed:", error);
      return res.status(500).json({ message: "Failed to fetch my cards" });
    }
  });

  // -------------------------
  // ONBOARDING (5 packs -> 15 cards -> choose 5)
  // -------------------------

  // ✅ Status route (used by App router sometimes)
  app.get("/api/onboarding/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);
      res.json({ completed: ob?.completed ?? false });
    } catch (error: any) {
      console.error("Onboarding status failed:", error);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  // 1) Create offer (3 packs: GK, MID, FWD -> 9 total cards)
  // ✅ UPDATED: auto-seed + better shuffling + retry
  app.post("/api/onboarding/create-offer", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);

      if (ob?.completed) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      // If already generated, return existing offer (no re-roll)
      if (ob?.packCards?.length === 5 && ob.packCards.flat().length === 15) {
        return res.json({ packCards: ob.packCards });
      }

      // Pull players; if not enough, seed then retry once
      let allPlayers = await storage.getRandomPlayers(250);
      if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
        console.log("Not enough players found. Seeding database, then retrying...");
        await seedDatabase();
        await seedCompetitions();
        allPlayers = await storage.getRandomPlayers(250);
      }

      if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
        return res.status(400).json({
          message:
            "Not enough players in database. Seeding may have failed or player table is still empty.",
          count: allPlayers?.length ?? 0,
        });
      }

      const normalize = (pos: string) => {
        const p = (pos || "").toLowerCase().trim();

        // handle common abbreviations
        if (p === "gk") return "GK";
        if (p === "def") return "DEF";
        if (p === "mid") return "MID";
        if (p === "fwd") return "FWD";

        // handle words
        if (p.includes("goal")) return "GK";
        if (p.includes("def")) return "DEF";
        if (p.includes("mid")) return "MID";
        if (p.includes("for") || p.includes("strik") || p.includes("att")) return "FWD";

        return "MID";
      };

      // Shuffle each position pool so you don't always select the same players
      const gkPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "GK"));
      const defPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "DEF"));
      const midPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "MID"));
      const fwdPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "FWD"));

      const gk = gkPool.slice(0, 3);
      const def = defPool.slice(0, 3);
      const mid1 = midPool.slice(0, 3);
      const mid2 = midPool.slice(3, 6);
      const fwd = fwdPool.slice(0, 3);

      if (gk.length < 3 || def.length < 3 || mid1.length < 3 || mid2.length < 3 || fwd.length < 3) {
        return res.status(400).json({
          message: "Not enough players per position",
          counts: { gk: gkPool.length, def: defPool.length, mid: midPool.length, fwd: fwdPool.length },
        });
      }

      const packCards = [
        gk.map((p: any) => p.id),
        def.map((p: any) => p.id),
        mid1.map((p: any) => p.id),
        mid2.map((p: any) => p.id),
        fwd.map((p: any) => p.id),
      ];

      if (!ob) {
        await storage.createOnboarding({
          userId,
          completed: false,
          packCards,
          selectedCards: [],
        } as any);
      } else {
        await storage.updateOnboarding(
          userId,
          { packCards, selectedCards: [] } as any,
        );
      }

      return res.json({ packCards });
    } catch (error: any) {
      console.error("Onboarding/create-offer failed:", error);
      return res.status(500).json({ message: "Failed to create onboarding packs" });
    }
  });

  // 2) Get offers (pack structure + player details)
  // ✅ UPDATED: auto-create offer if missing so UI never gets stuck
  app.get("/api/onboarding/offers", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      let ob = await storage.getOnboarding(userId);

      // Auto-create offer if none exists
      if (!ob?.packCards?.length) {
        let allPlayers = await storage.getRandomPlayers(250);
        if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
          console.log("No offer found. Seeding database, then creating offer...");
          await seedDatabase();
          await seedCompetitions();
          allPlayers = await storage.getRandomPlayers(250);
        }

        if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
          return res
            .status(404)
            .json({ message: "No offer found. Create offer first." });
        }

        const normalize = (pos: string) => {
          const p = (pos || "").toLowerCase().trim();

          // handle common abbreviations
          if (p === "gk") return "GK";
          if (p === "def") return "DEF";
          if (p === "mid") return "MID";
          if (p === "fwd") return "FWD";

          // handle words
          if (p.includes("goal")) return "GK";
          if (p.includes("def")) return "DEF";
          if (p.includes("mid")) return "MID";
          if (p.includes("for") || p.includes("strik") || p.includes("att")) return "FWD";

          return "MID";
        };

        const gkPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "GK"));
        const defPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "DEF"));
        const midPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "MID"));
        const fwdPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "FWD"));

        const gk = gkPool.slice(0, 3);
        const def = defPool.slice(0, 3);
        const mid1 = midPool.slice(0, 3);
        const mid2 = midPool.slice(3, 6);
        const fwd = fwdPool.slice(0, 3);

        const packCards = [
          gk.map((p: any) => p.id),
          def.map((p: any) => p.id),
          mid1.map((p: any) => p.id),
          mid2.map((p: any) => p.id),
          fwd.map((p: any) => p.id),
        ];

        if (!ob) {
          await storage.createOnboarding({
            userId,
            completed: false,
            packCards,
            selectedCards: [],
          } as any);
        } else {
          await storage.updateOnboarding(userId, { packCards, selectedCards: [] } as any);
        }

        ob = await storage.getOnboarding(userId);
      }

      const offeredPlayerIds = ob?.packCards?.flat() || [];

      // NOTE: we return players as full objects so the UI can show cards immediately
      const offeredPlayers = await Promise.all(
        offeredPlayerIds.map((id: number | null) => id ? storage.getPlayer(id) : Promise.resolve(undefined)),
      );
      const players = offeredPlayers.filter(Boolean);

      res.json({
        packCards: ob?.packCards || [],
        offeredPlayerIds,
        players,
        selectedCards: ob?.selectedCards ?? [],
        completed: ob?.completed ?? false,
      });
    } catch (error: any) {
      console.error("Fetch offers failed:", error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  // 3) Choose top 5 (mint cards + complete onboarding)
  app.post("/api/onboarding/choose", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const selected: number[] = req.body?.selectedPlayerIds ?? [];

      if (!Array.isArray(selected) || selected.length !== 5) {
        return res.status(400).json({ message: "Select exactly 5 cards" });
      }
      if (new Set(selected).size !== 5) {
        return res.status(400).json({ message: "Duplicate selections not allowed" });
      }

      const ob = await storage.getOnboarding(userId);
      if (!ob?.packCards?.length) {
        return res.status(400).json({ message: "No offer exists. Create offer first." });
      }
      if (ob.completed) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      const offeredSet = new Set(ob.packCards.flat());
      for (const id of selected) {
        if (!offeredSet.has(id)) {
          return res.status(400).json({ message: "Selection includes an invalid card" });
        }
      }

      // Mint 5 common cards
      for (const playerId of selected) {
        await storage.createPlayerCard({
          playerId,
          ownerId: userId,
          rarity: "common",
          level: 1,
          xp: 0,
          decisiveScore: 35,
          forSale: false,
          price: 0,
        } as any);
      }

      await storage.updateOnboarding(userId, {
        selectedCards: selected,
        completed: true,
      } as any);

      res.json({ success: true, kept: 5 });
    } catch (error: any) {
      console.error("Choose cards failed:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // -------------------------
  // USER CARDS / PLAYER DETAILS
  // -------------------------

  // Fetch cards owned by the logged-in user
  app.get("/api/user/cards", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cards = await storage.getUserCards(userId);
      res.json({ cards });
    } catch (error: any) {
      console.error("Failed to fetch user cards:", error);
      res.status(500).json({ message: "Failed to fetch user cards" });
    }
  });

  // Fetch specific player details (for modals/profiles)
  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(Number(req.params.id));
      if (!player) return res.status(404).json({ message: "Player not found" });
      res.json(player);
    } catch (error: any) {
      console.error("Error fetching player:", error);
      res.status(500).json({ message: "Error fetching player" });
    }
  });

  // Lineup endpoints
  app.get("/api/lineup", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      // TODO: Fetch user's current lineup from storage
      res.json({ lineup: { cardIds: [] }, cards: [] });
    } catch (error: any) {
      console.error("Failed to fetch lineup:", error);
      res.status(500).json({ message: "Failed to fetch lineup" });
    }
  });

  app.post("/api/lineup", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardIds } = req.body;
      // TODO: Save user's lineup to storage
      res.json({ message: "Lineup saved" });
    } catch (error: any) {
      console.error("Failed to save lineup:", error);
      res.status(500).json({ message: "Failed to save lineup" });
    }
  });

  // -------------------------
  // WALLET ENDPOINTS
  // -------------------------
  
  // Get wallet balance and info
  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      
      // Ensure wallet exists
      let wallet = await storage.getWallet(userId);
      if (!wallet) {
        wallet = await storage.createWallet({ userId, balance: 0, lockedBalance: 0 });
      }
      
      res.json({
        balance: wallet.balance || 0,
        lockedBalance: wallet.lockedBalance || 0,
        availableBalance: (wallet.balance || 0) - (wallet.lockedBalance || 0),
        currency: "USD"
      });
    } catch (error: any) {
      console.error("Failed to fetch wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  // Get transaction history
  app.get("/api/wallet/transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
      
      const allTransactions = await storage.getTransactions(userId);
      const total = allTransactions.length;
      const start = (page - 1) * limit;
      const pageItems = allTransactions.slice(start, start + limit);
      
      res.json({
        transactions: pageItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error: any) {
      console.error("Failed to fetch transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get combined wallet info (for wallet page)
  app.get("/api/transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error: any) {
      console.error("Failed to fetch transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin: Credit user wallet
  app.post("/api/admin/wallet/credit", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { userId, amount, description } = req.body;
      
      if (!userId || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid userId and positive amount required" });
      }
      
      // Ensure user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Ensure wallet exists
      let wallet = await storage.getWallet(userId);
      if (!wallet) {
        wallet = await storage.createWallet({ userId, balance: 0, lockedBalance: 0 });
      }
      
      // Credit wallet and create transaction
      await storage.updateWalletBalance(userId, amount);
      await storage.createTransaction({
        userId,
        type: "deposit",
        amount,
        description: description || `Admin credit: ${amount}`,
      });
      
      res.json({ 
        success: true, 
        message: `Credited ${amount} to user ${userId}`,
        newBalance: (wallet.balance || 0) + amount
      });
    } catch (error: any) {
      console.error("Failed to credit wallet:", error);
      res.status(500).json({ message: "Failed to credit wallet" });
    }
  });

  app.get("/api/wallet/withdrawals", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const withdrawals = await storage.getUserWithdrawalRequests(userId);
      res.json(withdrawals);
    } catch (error: any) {
      console.error("Failed to fetch withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.post("/api/wallet/deposit", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { amount, paymentMethod, externalTransactionId } = req.body;
      
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      
      //Calculate fee (8%)
      const fee = amount * 0.08;
      const netAmount = amount - fee;
      
      // In a real app, you would integrate with a payment processor here
      // For now, just credit the wallet with net amount after fee (dev/testing only)
      
      await storage.updateWalletBalance(userId, netAmount);
      await storage.createTransaction({
        userId,
        type: "deposit",
        amount: netAmount,
        description: `Deposit via ${paymentMethod || "manual"} (N$${amount.toFixed(2)} - N$${fee.toFixed(2)} fee)`,
        paymentMethod: paymentMethod || "manual",
        externalTransactionId,
      });
      
      res.json({ 
        success: true,
        message: "Deposit processed successfully",
        amount,
        fee,
        netAmount
      });
    } catch (error: any) {
      console.error("Failed to process deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  app.post("/api/wallet/withdraw", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { 
        amount, 
        paymentMethod,
        bankName, 
        accountHolder, 
        accountNumber, 
        iban, 
        swiftCode, 
        ewalletProvider, 
        ewalletId 
      } = req.body;
      
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      
      // Check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Calculate fee (8%)
      const fee = amount * 0.08;
      const netAmount = amount - fee;
      
      // Create withdrawal request
      const withdrawal = await storage.createWithdrawalRequest({
        userId,
        amount,
        fee,
        netAmount,
        paymentMethod: paymentMethod || "bank_transfer",
        bankName,
        accountHolder,
        accountNumber,
        iban,
        swiftCode,
        ewalletProvider,
        ewalletId,
        status: "pending",
      });
      
      res.json({ 
        success: true,
        message: "Withdrawal request submitted. Pending admin approval.",
        withdrawalId: withdrawal.id,
        fee,
        netAmount
      });
    } catch (error: any) {
      console.error("Failed to process withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // -------------------------
  // MARKETPLACE ENDPOINTS
  // -------------------------
  
  // Get all marketplace listings
  app.get("/api/marketplace", async (req, res) => {
    try {
      const rarity = req.query.rarity as string | undefined;
      const position = req.query.position as string | undefined;
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      
      let listings = await storage.getMarketplaceListings();
      
      // Apply filters
      if (rarity) {
        listings = listings.filter(card => card.rarity === rarity);
      }
      if (position) {
        listings = listings.filter(card => card.player?.position === position);
      }
      if (minPrice !== undefined) {
        listings = listings.filter(card => (card.price || 0) >= minPrice);
      }
      if (maxPrice !== undefined) {
        listings = listings.filter(card => (card.price || 0) <= maxPrice);
      }
      
      res.json(listings);
    } catch (error: any) {
      console.error("Failed to fetch marketplace listings:", error);
      res.status(500).json({ message: "Failed to fetch marketplace listings" });
    }
  });

  // List a card for sale
  app.post("/api/marketplace/list", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, price } = req.body;
      
      if (!cardId || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive price required" });
      }
      
      // Get the card
      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Verify ownership
      if (card.ownerId !== userId) {
        return res.status(403).json({ message: "You don't own this card" });
      }
      
      // Check if already listed
      if (card.forSale) {
        return res.status(400).json({ message: "Card is already listed for sale" });
      }
      
      // TODO: Check if card is in an active auction (when auctions are implemented)
      
      // List the card
      await storage.updatePlayerCard(cardId, {
        forSale: true,
        price
      });
      
      res.json({ 
        success: true, 
        message: "Card listed for sale",
        cardId,
        price
      });
    } catch (error: any) {
      console.error("Failed to list card:", error);
      res.status(500).json({ message: "Failed to list card" });
    }
  });

  // Cancel a listing
  app.post("/api/marketplace/cancel/:cardId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cardId = parseInt(req.params.cardId, 10);
      
      if (!cardId || isNaN(cardId)) {
        return res.status(400).json({ message: "Valid cardId required" });
      }
      
      // Get the card
      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Verify ownership
      if (card.ownerId !== userId) {
        return res.status(403).json({ message: "You don't own this card" });
      }
      
      // Check if listed
      if (!card.forSale) {
        return res.status(400).json({ message: "Card is not listed for sale" });
      }
      
      // Cancel listing
      await storage.updatePlayerCard(cardId, {
        forSale: false,
        price: 0
      });
      
      res.json({ 
        success: true, 
        message: "Listing cancelled",
        cardId
      });
    } catch (error: any) {
      console.error("Failed to cancel listing:", error);
      res.status(500).json({ message: "Failed to cancel listing" });
    }
  });

  // Buy a card (atomic transaction)
  app.post("/api/marketplace/buy/:cardId", requireAuth, async (req: any, res) => {
    try {
      const buyerId = req.authUserId;
      const cardId = parseInt(req.params.cardId, 10);
      
      if (!cardId || isNaN(cardId)) {
        return res.status(400).json({ message: "Valid cardId required" });
      }
      
      // Import db for transaction
      const { db } = await import("./db.js");
      
      // Wrap in database transaction for atomicity
      await db.transaction(async (tx) => {
        // Get the card with FOR UPDATE lock
        const [card] = await tx
          .select()
          .from((await import("../shared/schema.js")).playerCards)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).playerCards.id, cardId))
          .for("update");
        
        if (!card) {
          throw new Error("Card not found");
        }
        
        // Verify card is for sale
        if (!card.forSale) {
          throw new Error("Card is not for sale");
        }
        
        const sellerId = card.ownerId;
        const price = card.price || 0;
        
        // Can't buy your own card
        if (sellerId === buyerId) {
          throw new Error("Cannot buy your own card");
        }
        
        // Calculate 8% platform fee
        const fee = price * 0.08;
        const sellerReceives = price - fee;
        
        // Check buyer balance
        const [buyerWallet] = await tx
          .select()
          .from((await import("../shared/schema.js")).wallets)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).wallets.userId, buyerId));
        
        if (!buyerWallet || (buyerWallet.balance || 0) < price) {
          throw new Error("Insufficient balance");
        }
        
        // Debit buyer (full price)
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: (await import("drizzle-orm")).sql`${(await import("../shared/schema.js")).wallets.balance} - ${price}` } as any)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).wallets.userId, buyerId));
        
        // Credit seller (price minus 8% fee)
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: (await import("drizzle-orm")).sql`${(await import("../shared/schema.js")).wallets.balance} + ${sellerReceives}` } as any)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).wallets.userId, sellerId!));
        
        // Transfer card ownership
        await tx
          .update((await import("../shared/schema.js")).playerCards)
          .set({ 
            ownerId: buyerId,
            forSale: false,
            price: 0
          } as any)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).playerCards.id, cardId));
        
        // Create transactions
        await tx.insert((await import("../shared/schema.js")).transactions).values({
          userId: buyerId,
          type: "purchase",
          amount: -price,
          description: `Purchased card #${cardId} (N$${price.toFixed(2)})`,
        } as any);
        
        await tx.insert((await import("../shared/schema.js")).transactions).values({
          userId: sellerId!,
          type: "sale",
          amount: sellerReceives,
          description: `Sold card #${cardId} (N$${price.toFixed(2)} - N$${fee.toFixed(2)} fee)`,
        } as any);
      });
      
      res.json({ 
        success: true, 
        message: "Card purchased successfully",
        cardId
      });
    } catch (error: any) {
      console.error("Failed to buy card:", error);
      res.status(500).json({ message: error.message || "Failed to buy card" });
    }
  });

  // Old route (for backwards compatibility)
  app.post("/api/marketplace/buy", requireAuth, async (req: any, res) => {
    const { cardId } = req.body;
    if (!cardId) {
      return res.status(400).json({ message: "cardId required" });
    }
    // Redirect to new endpoint
    req.params.cardId = cardId.toString();
    return app._router.handle(req, res);
  });

  // Old sell route (deprecated - use /list instead)
  app.post("/api/marketplace/sell", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, price } = req.body;
      
      if (!cardId || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive price required" });
      }
      
      // Use the new list endpoint logic
      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      if (card.ownerId !== userId) {
        return res.status(403).json({ message: "You don't own this card" });
      }
      
      await storage.updatePlayerCard(cardId, {
        forSale: true,
        price
      });
      
      res.json({ 
        success: true,
        message: "Card listed for sale" 
      });
    } catch (error: any) {
      console.error("Failed to sell card:", error);
      res.status(500).json({ message: "Failed to sell card" });
    }
  });

  // -------------------------
  // AUCTION ENDPOINTS
  // -------------------------
  
  // Helper functions for auctions
  async function getAuction(auctionId: number) {
    const { db } = await import("./db.js");
    const { auctions } = await import("../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId));
    return auction;
  }
  
  async function getAuctionBids(auctionId: number) {
    const { db } = await import("./db.js");
    const { auctionBids } = await import("../shared/schema.js");
    const { eq, desc } = await import("drizzle-orm");
    
    return db.select().from(auctionBids)
      .where(eq(auctionBids.auctionId, auctionId))
      .orderBy(desc(auctionBids.amount));
  }
  
  // Get active auctions
  app.get("/api/auctions/active", async (req, res) => {
    try {
      const { db } = await import("./db.js");
      const { auctions, playerCards, players } = await import("../shared/schema.js");
      const { eq, and, or, lte, gte } = await import("drizzle-orm");
      
      const now = new Date();
      
      // Get live auctions (status=live and endAt > now)
      const results = await db
        .select()
        .from(auctions)
        .innerJoin(playerCards, eq(auctions.cardId, playerCards.id))
        .innerJoin(players, eq(playerCards.playerId, players.id))
        .where(
          and(
            eq(auctions.status, "live"),
            gte(auctions.endsAt, now)
          )
        );
      
      const auctionsWithBids = await Promise.all(
        results.map(async (r: any) => {
          const bids = await getAuctionBids(r.auctions.id);
          return {
            ...r.auctions,
            card: { ...r.player_cards, player: r.players },
            bids,
            currentBid: bids[0]?.amount || r.auctions.startPrice,
            bidCount: bids.length,
          };
        })
      );
      
      res.json(auctionsWithBids);
    } catch (error: any) {
      console.error("Failed to fetch active auctions:", error);
      res.status(500).json({ message: "Failed to fetch active auctions" });
    }
  });
  
  // Get specific auction
  app.get("/api/auctions/:id", async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id, 10);
      
      const { db } = await import("./db.js");
      const { auctions, playerCards, players } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");
      
      const [result] = await db
        .select()
        .from(auctions)
        .innerJoin(playerCards, eq(auctions.cardId, playerCards.id))
        .innerJoin(players, eq(playerCards.playerId, players.id))
        .where(eq(auctions.id, auctionId));
      
      if (!result) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      const bids = await getAuctionBids(auctionId);
      
      res.json({
        ...result.auctions,
        card: { ...result.player_cards, player: result.players },
        bids,
        currentBid: bids[0]?.amount || result.auctions.startPrice,
        bidCount: bids.length,
      });
    } catch (error: any) {
      console.error("Failed to fetch auction:", error);
      res.status(500).json({ message: "Failed to fetch auction" });
    }
  });
  
  // Create auction
  app.post("/api/auctions/create", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, startPrice, buyNowPrice, reservePrice, duration } = req.body;
      
      if (!cardId || typeof startPrice !== "number" || startPrice <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive startPrice required" });
      }
      
      // Get the card
      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Verify ownership
      if (card.ownerId !== userId) {
        return res.status(403).json({ message: "You don't own this card" });
      }
      
      // Check if already listed for sale
      if (card.forSale) {
        return res.status(400).json({ message: "Card is already listed for sale. Cancel the listing first." });
      }
      
      // Set auction times
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + (duration || 86400) * 1000); // default 24 hours
      
      // Create auction
      const { db } = await import("./db.js");
      const { auctions } = await import("../shared/schema.js");
      
      const [auction] = await db.insert(auctions).values({
        cardId,
        sellerUserId: userId,
        status: "live",
        startPrice,
        buyNowPrice: buyNowPrice || null,
        reservePrice: reservePrice || startPrice,
        minIncrement: Math.max(1, startPrice * 0.05), // 5% minimum increment
        startsAt,
        endsAt,
      } as any).returning();
      
      res.json({
        success: true,
        message: "Auction created successfully",
        auction,
      });
    } catch (error: any) {
      console.error("Failed to create auction:", error);
      res.status(500).json({ message: "Failed to create auction" });
    }
  });
  
  // Place bid
  app.post("/api/auctions/:id/bid", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      const { amount } = req.body;
      
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      
      const { db } = await import("./db.js");
      const { auctions, auctionBids, wallets } = await import("../shared/schema.js");
      const { eq, desc } = await import("drizzle-orm");
      
      // Get auction
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      // Check auction status
      if (auction.status !== "live") {
        return res.status(400).json({ message: "Auction is not active" });
      }
      
      // Check if expired
      if (auction.endsAt && new Date(auction.endsAt) < new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }
      
      // Can't bid on own auction
      if (auction.sellerUserId === userId) {
        return res.status(400).json({ message: "Cannot bid on your own auction" });
      }
      
      // Get current highest bid
      const bids = await getAuctionBids(auctionId);
      const currentBid = bids[0];
      const currentAmount = currentBid?.amount || auction.startPrice || 0;
      
      // Check bid amount
      if (amount < currentAmount + (auction.minIncrement || 1)) {
        return res.status(400).json({ 
          message: `Bid must be at least ${currentAmount + (auction.minIncrement || 1)}` 
        });
      }
      
      // Check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet || (wallet.balance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Place hold on bidder's wallet
      await storage.lockFunds(userId, amount);
      
      // Release previous bidder's hold (if exists)
      if (currentBid && currentBid.bidderUserId !== userId) {
        await storage.unlockFunds(currentBid.bidderUserId, currentBid.amount);
      }
      
      // Create bid
      const [bid] = await db.insert(auctionBids).values({
        auctionId,
        bidderUserId: userId,
        amount,
      } as any).returning();
      
      res.json({
        success: true,
        message: "Bid placed successfully",
        bid,
      });
    } catch (error: any) {
      console.error("Failed to place bid:", error);
      res.status(500).json({ message: error.message || "Failed to place bid" });
    }
  });
  
  // Buy now (instant purchase)
  app.post("/api/auctions/:id/buy-now", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      if (!auction.buyNowPrice) {
        return res.status(400).json({ message: "This auction does not have a buy now price" });
      }
      
      if (auction.status !== "live") {
        return res.status(400).json({ message: "Auction is not active" });
      }
      
      if (auction.sellerUserId === userId) {
        return res.status(400).json({ message: "Cannot buy your own auction" });
      }
      
      // Check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet || (wallet.balance || 0) < auction.buyNowPrice) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Settle instantly
      const { db } = await import("./db.js");
      const { auctions, playerCards, transactions } = await import("../shared/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      
      await db.transaction(async (tx) => {
        // Charge buyer
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: sql`${(await import("../shared/schema.js")).wallets.balance} - ${auction.buyNowPrice}` } as any)
          .where(eq((await import("../shared/schema.js")).wallets.userId, userId));
        
        // Credit seller
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: sql`${(await import("../shared/schema.js")).wallets.balance} + ${auction.buyNowPrice}` } as any)
          .where(eq((await import("../shared/schema.js")).wallets.userId, auction.sellerUserId));
        
        // Transfer card
        await tx
          .update(playerCards)
          .set({ ownerId: userId } as any)
          .where(eq(playerCards.id, auction.cardId));
        
        // Mark auction as settled
        await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(eq(auctions.id, auctionId));
        
        // Create transactions
        await tx.insert(transactions).values({
          userId,
          type: "auction_settlement",
          amount: -(auction.buyNowPrice || 0),
          description: `Auction buy now: Card #${auction.cardId}`,
        } as any);
        
        await tx.insert(transactions).values({
          userId: auction.sellerUserId,
          type: "auction_settlement",
          amount: auction.buyNowPrice || 0,
          description: `Auction sale: Card #${auction.cardId}`,
        } as any);
      });
      
      res.json({
        success: true,
        message: "Auction purchased successfully",
      });
    } catch (error: any) {
      console.error("Failed to buy now:", error);
      res.status(500).json({ message: "Failed to buy now" });
    }
  });
  
  // Cancel auction
  app.post("/api/auctions/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      // Verify ownership
      if (auction.sellerUserId !== userId) {
        return res.status(403).json({ message: "You don't own this auction" });
      }
      
      // Check if there are bids
      const bids = await getAuctionBids(auctionId);
      if (bids.length > 0) {
        return res.status(400).json({ message: "Cannot cancel auction with bids" });
      }
      
      // Cancel auction
      const { db } = await import("./db.js");
      const { auctions } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");
      
      await db
        .update(auctions)
        .set({ status: "cancelled" } as any)
        .where(eq(auctions.id, auctionId));
      
      res.json({
        success: true,
        message: "Auction cancelled successfully",
      });
    } catch (error: any) {
      console.error("Failed to cancel auction:", error);
      res.status(500).json({ message: "Failed to cancel auction" });
    }
  });
  
  // Settle auction (manually or auto)
  app.post("/api/auctions/:id/settle", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const auctionId = parseInt(req.params.id, 10);
      
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      if (auction.status === "settled") {
        return res.status(400).json({ message: "Auction already settled" });
      }
      
      const bids = await getAuctionBids(auctionId);
      const winningBid = bids[0];
      
      if (!winningBid) {
        // No bids - just mark as ended
        const { db } = await import("./db.js");
        const { auctions } = await import("../shared/schema.js");
        const { eq } = await import("drizzle-orm");
        
        await db
          .update(auctions)
          .set({ status: "ended" } as any)
          .where(eq(auctions.id, auctionId));
        
        return res.json({
          success: true,
          message: "Auction ended with no bids",
        });
      }
      
      // Check reserve price
      if (winningBid.amount < (auction.reservePrice || 0)) {
        // Reserve not met - release hold and end auction
        await storage.unlockFunds(winningBid.bidderUserId, winningBid.amount);
        
        const { db } = await import("./db.js");
        const { auctions } = await import("../shared/schema.js");
        const { eq } = await import("drizzle-orm");
        
        await db
          .update(auctions)
          .set({ status: "ended" } as any)
          .where(eq(auctions.id, auctionId));
        
        return res.json({
          success: true,
          message: "Auction ended - reserve price not met",
        });
      }
      
      // Settle: charge winner, credit seller, transfer card
      const { db } = await import("./db.js");
      const { auctions, playerCards, wallets, transactions } = await import("../shared/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      
      await db.transaction(async (tx) => {
        // Convert hold to actual debit (unlock + deduct)
        await tx
          .update(wallets)
          .set({
            balance: sql`${wallets.balance}`,
            lockedBalance: sql`${wallets.lockedBalance} - ${winningBid.amount}`,
          } as any)
          .where(eq(wallets.userId, winningBid.bidderUserId));
        
        // Credit seller
        await tx
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${winningBid.amount}` } as any)
          .where(eq(wallets.userId, auction.sellerUserId));
        
        // Transfer card
        await tx
          .update(playerCards)
          .set({ ownerId: winningBid.bidderUserId } as any)
          .where(eq(playerCards.id, auction.cardId));
        
        // Mark auction as settled
        await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(eq(auctions.id, auctionId));
        
        // Create transactions
        await tx.insert(transactions).values({
          userId: winningBid.bidderUserId,
          type: "auction_settlement",
          amount: -winningBid.amount,
          description: `Auction won: Card #${auction.cardId}`,
        } as any);
        
        await tx.insert(transactions).values({
          userId: auction.sellerUserId,
          type: "auction_settlement",
          amount: winningBid.amount,
          description: `Auction sale: Card #${auction.cardId}`,
        } as any);
        
        // Release holds for other bidders
        for (let i = 1; i < bids.length; i++) {
          await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} + ${bids[i].amount}`,
              lockedBalance: sql`${wallets.lockedBalance} - ${bids[i].amount}`,
            } as any)
            .where(eq(wallets.userId, bids[i].bidderUserId));
        }
      });
      
      res.json({
        success: true,
        message: "Auction settled successfully",
        winnerId: winningBid.bidderUserId,
        winningAmount: winningBid.amount,
      });
    } catch (error: any) {
      console.error("Failed to settle auction:", error);
      res.status(500).json({ message: "Failed to settle auction" });
    }
  });

  // -------------------------
  // COMPETITIONS ENDPOINTS
  // -------------------------
  
  // Get all competitions
  app.get("/api/competitions", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const tier = req.query.tier as string | undefined;
      
      let competitions = await storage.getCompetitions();
      
      // Apply filters
      if (status) {
        competitions = competitions.filter(c => c.status === status);
      }
      if (tier) {
        competitions = competitions.filter(c => c.tier === tier);
      }
      
      res.json(competitions);
    } catch (error: any) {
      console.error("Failed to fetch competitions:", error);
      res.status(500).json({ message: "Failed to fetch competitions" });
    }
  });

  // Join a competition
  app.post("/api/competitions/join", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { competitionId, cardIds, captainId } = req.body;
      
      if (!competitionId || !Array.isArray(cardIds) || cardIds.length !== 5) {
        return res.status(400).json({ message: "Competition ID and exactly 5 card IDs required" });
      }
      
      // Get competition
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      
      // Check if already entered
      const existingEntry = await storage.getCompetitionEntry(competitionId, userId);
      if (existingEntry) {
        return res.status(400).json({ message: "Already entered this competition" });
      }
      
      // Check competition status
      if (competition.status !== "open") {
        return res.status(400).json({ message: "Competition is not open for entries" });
      }
      
      // Validate lineup (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility)
      const cards = await Promise.all(cardIds.map(id => storage.getPlayerCard(id)));
      
      // Verify ownership
      for (const card of cards) {
        if (!card || card.ownerId !== userId) {
          return res.status(403).json({ message: "You don't own all selected cards" });
        }
      }
      
      // Get full card details with players
      const fullCards = await Promise.all(
        cardIds.map(id => storage.getPlayerCardWithPlayer(id, userId))
      );
      
      const positions = fullCards.map(c => c?.player?.position).filter(Boolean);
      const hasGK = positions.includes("GK");
      const hasDEF = positions.includes("DEF");
      const hasMID = positions.includes("MID");
      const hasFWD = positions.includes("FWD");
      
      if (!hasGK || !hasDEF || !hasMID || !hasFWD) {
        return res.status(400).json({ 
          message: "Invalid lineup: must have 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility player" 
        });
      }
      
      // Check balance and deduct entry fee
      const entryFee = competition.entryFee || 0;
      if (entryFee > 0) {
        const wallet = await storage.getWallet(userId);
        if (!wallet || (wallet.balance || 0) < entryFee) {
          return res.status(400).json({ message: "Insufficient balance for entry fee" });
        }
        
        await storage.updateWalletBalance(userId, -entryFee);
        await storage.createTransaction({
          userId,
          type: "entry_fee",
          amount: -entryFee,
          description: `Entered competition: ${competition.name}`,
        });
      }
      
      // Create entry
      const entry = await storage.createCompetitionEntry({
        competitionId,
        userId,
        lineupCardIds: cardIds,
        captainId: captainId || cardIds[0],
        totalScore: 0,
      });
      
      res.json({ 
        success: true, 
        message: "Successfully joined competition",
        entryId: entry.id
      });
    } catch (error: any) {
      console.error("Failed to join competition:", error);
      res.status(500).json({ message: error.message || "Failed to join competition" });
    }
  });

  // Get user's competition entries
  app.get("/api/competitions/my-entries", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const entries = await storage.getUserCompetitions(userId);
      res.json(entries);
    } catch (error: any) {
      console.error("Failed to fetch entries:", error);
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  // Admin: Settle competition
  app.post("/api/admin/competitions/settle/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = parseInt(req.params.id, 10);
      
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ message: "Competition not found" });
      }
      
      if (competition.status === "completed") {
        return res.status(400).json({ message: "Competition already settled" });
      }
      
      // Get all entries sorted by score
      const entries = await storage.getCompetitionEntries(competitionId);
      const sortedEntries = entries
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
      
      // Distribute prizes (60%, 30%, 10% for top 3)
      const totalPrizePool = entries.length * (competition.entryFee || 0);
      const prizes = [
        totalPrizePool * 0.6,  // 1st place
        totalPrizePool * 0.3,  // 2nd place
        totalPrizePool * 0.1,  // 3rd place
      ];
      
      for (let i = 0; i < Math.min(3, sortedEntries.length); i++) {
        const entry = sortedEntries[i];
        const prize = prizes[i];
        
        await storage.updateCompetitionEntry(entry.id, {
          rank: i + 1,
          prizeAmount: prize,
        });
        
        // Credit winner's wallet
        if (prize > 0) {
          await storage.updateWalletBalance(entry.userId, prize);
          await storage.createTransaction({
            userId: entry.userId,
            type: "prize",
            amount: prize,
            description: `Competition prize: ${competition.name} - Rank ${i + 1}`,
          });
        }
      }
      
      // Mark competition as completed
      await storage.updateCompetition(competitionId, {
        status: "completed",
      });
      
      res.json({ 
        success: true,
        message: "Competition settled successfully",
        winnersCount: Math.min(3, sortedEntries.length)
      });
    } catch (error: any) {
      console.error("Failed to settle competition:", error);
      res.status(500).json({ message: "Failed to settle competition" });
    }
  });

  // -------------------------
  // REWARDS ENDPOINTS
  // -------------------------
  
  // Get user's rewards
  app.get("/api/rewards", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const rewards = await storage.getUserRewards(userId);
      res.json(rewards);
    } catch (error: any) {
      console.error("Failed to fetch rewards:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  // -------------------------
  // ADMIN ENDPOINTS
  // -------------------------
  
  // Get all users (paginated)
  app.get("/api/admin/users", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
      
      const { db } = await import("./db.js");
      const { users, wallets } = await import("../shared/schema.js");
      const { sql } = await import("drizzle-orm");
      
      // Get all users with their wallets
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
          balance: wallets.balance,
          lockedBalance: wallets.lockedBalance,
        })
        .from(users)
        .leftJoin(wallets, sql`${users.id} = ${wallets.userId}`);
      
      const total = allUsers.length;
      const start = (page - 1) * limit;
      const pageItems = allUsers.slice(start, start + limit);
      
      res.json({
        users: pageItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Get system stats
  app.get("/api/admin/stats", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const { users, playerCards, auctions, competitions, transactions } = await import("../shared/schema.js");
      const { sql } = await import("drizzle-orm");
      
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [cardCount] = await db.select({ count: sql<number>`count(*)` }).from(playerCards);
      const [auctionCount] = await db.select({ count: sql<number>`count(*)` }).from(auctions);
      const [competitionCount] = await db.select({ count: sql<number>`count(*)` }).from(competitions);
      const [transactionCount] = await db.select({ count: sql<number>`count(*)` }).from(transactions);
      
      res.json({
        users: userCount.count,
        cards: cardCount.count,
        auctions: auctionCount.count,
        competitions: competitionCount.count,
        transactions: transactionCount.count,
      });
    } catch (error: any) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
  
  // Trigger seed data
  app.post("/api/admin/seed", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { seedDatabase, seedCompetitions } = await import("./seed.js");
      
      await seedDatabase();
      await seedCompetitions();
      
      res.json({
        success: true,
        message: "Database seeded successfully",
      });
    } catch (error: any) {
      console.error("Failed to seed database:", error);
      res.status(500).json({ message: "Failed to seed database" });
    }
  });
  
  // Get audit logs
  app.get("/api/admin/logs", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "100"), 10)));
      
      const { db } = await import("./db.js");
      const { auditLogs } = await import("../shared/schema.js");
      const { desc } = await import("drizzle-orm");
      
      const allLogs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt));
      
      const total = allLogs.length;
      const start = (page - 1) * limit;
      const pageItems = allLogs.slice(start, start + limit);
      
      res.json({
        logs: pageItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      console.error("Failed to fetch logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });
  
  // Get all withdrawal requests (admin)
  app.get("/api/admin/withdrawals", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      
      let withdrawals;
      if (status === "pending") {
        withdrawals = await storage.getAllPendingWithdrawals();
      } else {
        withdrawals = await storage.getAllWithdrawals();
      }
      
      res.json(withdrawals);
    } catch (error: any) {
      console.error("Failed to fetch withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });
  
  // Approve/reject withdrawal request
  app.post("/api/admin/withdrawals/:id/review", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const withdrawalId = parseInt(req.params.id, 10);
      const { status, adminNotes } = req.body;
      
      if (!["completed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'completed' or 'rejected'" });
      }
      
      const { db } = await import("./db.js");
      const { withdrawalRequests, wallets, transactions } = await import("../shared/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      
      const [withdrawal] = await db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, withdrawalId));
      
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal request not found" });
      }
      
      if (withdrawal.status !== "pending") {
        return res.status(400).json({ message: "Withdrawal already processed" });
      }
      
      await db.transaction(async (tx) => {
        if (status === "completed") {
          // Deduct from wallet
          await tx
            .update(wallets)
            .set({ balance: sql`${wallets.balance} - ${withdrawal.amount}` } as any)
            .where(eq(wallets.userId, withdrawal.userId));
          
          // Create transaction
          await tx.insert(transactions).values({
            userId: withdrawal.userId,
            type: "withdrawal",
            amount: -withdrawal.amount,
            description: `Withdrawal approved: ${withdrawal.netAmount} (fee: ${withdrawal.fee})`,
          } as any);
        }
        
        // Update withdrawal status
        await tx
          .update(withdrawalRequests)
          .set({
            status,
            adminNotes,
            reviewedAt: new Date(),
          } as any)
          .where(eq(withdrawalRequests.id, withdrawalId));
      });
      
      res.json({
        success: true,
        message: `Withdrawal ${status}`,
      });
    } catch (error: any) {
      console.error("Failed to review withdrawal:", error);
      res.status(500).json({ message: "Failed to review withdrawal" });
    }
  });

  return httpServer;
}
