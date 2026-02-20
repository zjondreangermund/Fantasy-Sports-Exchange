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

  // 1) Create offer (5 packs of 3 -> 15 total cards)
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

      // Shuffle each position pool so you don't always select the same first 3
      const gkPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "GK"));
      const defPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "DEF"));
      const midPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "MID"));
      const fwdPool = shuffle(allPlayers.filter((p: any) => normalize(p.position) === "FWD"));
      const randomPool = shuffle(allPlayers);

      const gk = gkPool.slice(0, 3);
      const def = defPool.slice(0, 3);
      const mid = midPool.slice(0, 3);
      const fwd = fwdPool.slice(0, 3);
      const random = randomPool.slice(0, 3);

      if (gk.length < 3 || def.length < 3 || mid.length < 3 || fwd.length < 3) {
        return res.status(400).json({
          message: "Not enough players per position",
          counts: { gk: gkPool.length, def: defPool.length, mid: midPool.length, fwd: fwdPool.length },
        });
      }

      const packCards = [
        gk.map((p: any) => p.id),
        def.map((p: any) => p.id),
        mid.map((p: any) => p.id),
        fwd.map((p: any) => p.id),
        random.map((p: any) => p.id),
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
        const randomPool = shuffle(allPlayers);

        const gk = gkPool.slice(0, 3);
        const def = defPool.slice(0, 3);
        const mid = midPool.slice(0, 3);
        const fwd = fwdPool.slice(0, 3);
        const random = randomPool.slice(0, 3);

        const packCards = [
          gk.map((p: any) => p.id),
          def.map((p: any) => p.id),
          mid.map((p: any) => p.id),
          fwd.map((p: any) => p.id),
          random.map((p: any) => p.id),
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

      const offeredPlayerIds = ob.packCards.flat();

      // NOTE: we return players as full objects so the UI can show cards immediately
      const offeredPlayers = await Promise.all(
        offeredPlayerIds.map((id: number) => storage.getPlayer(id)),
      );
      const players = offeredPlayers.filter(Boolean);

      res.json({
        packCards: ob.packCards,
        offeredPlayerIds,
        players,
        selectedCards: ob.selectedCards ?? [],
        completed: ob.completed,
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

  return httpServer;
}
