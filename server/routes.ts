import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedDatabase, seedCompetitions } from "./seed.js";
import { fplApi } from "./services/fplApi.js";
import { fetchSorarePlayer } from "./services/sorare.js";

// ✅ Google auth (Passport) – relies on session/passport middleware being set up in server entry file
import passport from "passport";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .filter(Boolean);

/** True when deployed on Replit (has REPL_ID). Use Replit Auth there. */
const isReplit = Boolean(process.env.REPL_ID);
/** True when we want to skip real auth (e.g. Railway/Vercel/local dev without real auth). */
const useMockAuth =
  process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);

function isAdmin(req: any, res: any, next: any) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const userId = user.claims?.sub || user.id;
  if (ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(userId)) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ----------------
  // AUTH ROUTES
  // ----------------

  // Auth: Replit = use Replit Auth
  if (isReplit) {
    await setupAuth(app);
    registerAuthRoutes(app);

    // Keep your existing behavior
  } else if (useMockAuth) {
    // Mock auth (dev/testing)
    console.log(
      "Using mock auth (Replit not detected; set SESSION_SECRET + Google vars for production auth).",
    );

    app.use((req: any, _res, next) => {
      req.isAuthenticated = () => true;
      req.user = {
        id: process.env.MOCK_USER_ID || "54644807",
        claims: { sub: process.env.MOCK_USER_ID || "54644807" },
        firstName: "Zjondre",
        lastName: "Angermund",
      };
      next();
    });

    app.get("/api/auth/user", (req: any, res) => res.json(req.user));
    // support both endpoints
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
  } else {
    // ✅ Railway/production Google OAuth (non-Replit)
    // Requires server entry file to have:
    // - app.set("trust proxy", 1)
    // - express-session
    // - passport.initialize + passport.session
    // - GoogleStrategy configured
    //
    // ENV required in Railway:
    // GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, APP_URL

    app.get(
      "/api/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] }),
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (_req, res) => {
        // after login, send user to your app
        res.redirect("/");
      },
    );

    app.get("/api/auth/user", (req: any, res) => {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      res.json(req.user);
    });

    // logout (support your frontend GET /api/logout)
    app.get("/api/logout", (req: any, res) => {
      req.logout?.(() => {});
      req.session?.destroy(() => {});
      res.clearCookie("connect.sid");
      res.redirect("/");
    });

    // keep compatibility with existing POST route name
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

  /**
   * EPL (Premier League) data — used by /premier-league page
   * Now sourced from the official Fantasy Premier League (FPL) endpoints:
   * - bootstrap-static (players/teams/gameweeks)
   * - fixtures
   *
   * Note: FPL does NOT provide the real EPL "league table standings".
   * Keep this route for compatibility but return [].
   */
  app.get("/api/epl/standings", async (_req, res) => {
    try {
      // No official EPL table standings in FPL API.
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

    // ✅ API-Football compatible shape
    res.json({ response: filtered });
  } catch (e: any) {
    console.error("EPL fixtures:", e);
    res.status(500).json({ message: e?.message || "Failed to fetch fixtures" });
  }
});


  app.get("/api/epl/players", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "100"), 10)),
    );

    const search = String(req.query.search || "").toLowerCase().trim();
    const position = String(req.query.position || "").trim(); // optional: GK/DEF/MID/FWD

    const players = await fplApi.getPlayers();
    let filtered = Array.isArray(players) ? players : [];

    // Search
    if (search) {
      filtered = filtered.filter((p: any) => {
        const n = `${p.first_name ?? ""} ${p.second_name ?? ""} ${p.web_name ?? ""}`.toLowerCase();
        return n.includes(search);
      });
    }

    // Position filter (if your player object has position)
    // Common FPL-style position might be: p.position or p.position_short or p.element_type
    if (position) {
      const pos = position.toUpperCase();

      filtered = filtered.filter((p: any) => {
        const pPos =
          String(p.position_short || p.position || "").toUpperCase();

        // If you use element_type instead (FPL: 1 GK, 2 DEF, 3 MID, 4 FWD)
        const map: Record<string, number> = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
        const wantedType = map[pos];

        return (
          (pPos && pPos === pos) ||
          (wantedType && Number(p.element_type) === wantedType)
        );
      });
    }

    // Pagination AFTER filtering
    const total = filtered.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = filtered.slice(start, end);

    // ✅ IMPORTANT: wrap in { response: ... } because your UI expects API-Football shape
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

  // FPL doesn't have a dedicated injuries endpoint.
  // We derive injury/news-like data from the player fields (news/status/chance_of_playing).
  app.get("/api/epl/injuries", async (_req, res) => {
    try {
      const data = await fplApi.getInjuries();
      res.json({ response: data });
    } catch (e: any) {
      console.error("EPL injuries:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch injuries" });
    }
  });

  // Sorare proxy (player lookup by name) — used for player images/So5 scores
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

  // Sync Data Route
  // With FPL, you can run without syncing into DB (no rate-limit key needed).
  // This just warms caches so the UI loads fast.
  app.post("/api/epl/sync", async (_req, res) => {
    try {
      console.log("Starting Premier League data sync (FPL)...");
      // Optional: keep your existing seeds (marketplace/cards/etc.)
      await seedDatabase();

      // Warm FPL caches (players + fixtures)
      await Promise.all([fplApi.bootstrap(), fplApi.fixtures()]);

      // If you still want the old competition seeding, re-enable after fixing the "desc" SQL issue:
      // await seedCompetitions();

      res.json({ success: true, message: "Data synced successfully" });
    } catch (error: any) {
      console.error("Sync failed:", error);
      res.status(500).json({ message: "Failed to sync data", error: error.message });
    }
  });

  // Fetch actual Card Items so design templates (rarity) show up
  app.get("/api/players", async (_req, res) => {
    try {
      const cards = await storage.getMarketplaceListings();
      res.json(cards);
    } catch (error: any) {
      console.error("Failed to fetch player cards:", error);
      res.status(500).json({ message: "Failed to fetch player cards" });
    }
  });

  // Fetch cards owned by the logged-in user
  app.get("/api/user/cards", async (req: any, res) => {
    try {
      const userId = req.user?.id || "54644807";
      const cards = await storage.getUserCards(userId);
      res.json(cards);
    } catch (error: any) {
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
