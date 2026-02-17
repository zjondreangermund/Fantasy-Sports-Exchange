import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedDatabase, seedCompetitions } from "./seed.js";
import * as apiFootball from "./services/apiFootball.js";
import { fetchSorarePlayer } from "./services/sorare.js";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .filter(Boolean);

/** True when deployed on Replit (has REPL_ID). Use Replit Auth there. */
const isReplit = Boolean(process.env.REPL_ID);
/** True when we want to skip real auth (e.g. Railway, Vercel, local dev without Replit Auth). */
const useMockAuth = process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);

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
  // Auth: Replit = use Replit Auth; otherwise use mock auth only if USE_MOCK_AUTH or no SESSION_SECRET
  if (isReplit) {
    await setupAuth(app);
    registerAuthRoutes(app);
  } else if (useMockAuth) {
    console.log("Using mock auth (Replit not detected; set SESSION_SECRET for production auth).");
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
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
  } else {
    // Not Replit and not using mock auth: no built-in auth (e.g. add your own JWT/OIDC for Railway/Vercel).
    // Ensure 401 for /api/auth/user so the client can show login.
    app.get("/api/auth/user", (_req, res) => res.status(401).json({ message: "Unauthorized" }));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
  }

  // --- API ROUTES ---

  // EPL (Premier League) data — used by /premier-league page
  app.get("/api/epl/standings", async (_req, res) => {
    try {
      const data = await apiFootball.getEplStandings();
      res.json(data);
    } catch (e: any) {
      console.error("EPL standings:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch standings" });
    }
  });
  app.get("/api/epl/fixtures", async (req, res) => {
    try {
      const status = (req.query.status as string) || undefined;
      const data = await apiFootball.getEplFixtures(status);
      res.json(data);
    } catch (e: any) {
      console.error("EPL fixtures:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch fixtures" });
    }
  });
  app.get("/api/epl/players", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "100"), 10)));
      const search = (req.query.search as string) || undefined;
      const position = (req.query.position as string) || undefined;
      const data = await apiFootball.getEplPlayers(page, limit, search, position);
      res.json(data);
    } catch (e: any) {
      console.error("EPL players:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch players" });
    }
  });
  app.get("/api/epl/injuries", async (_req, res) => {
    try {
      const data = await apiFootball.getEplInjuries();
      res.json(data);
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
  app.post("/api/epl/sync", async (_req, res) => {
    try {
      console.log("Starting Premier League data sync...");
      await seedDatabase();
      await seedCompetitions();
      res.json({ success: true, message: "Data synced successfully" });
    } catch (error: any) {
      console.error("Sync failed:", error);
      res
        .status(500)
        .json({ message: "Failed to sync data", error: error.message });
    }
  });

  // FIX: Updated to fetch actual Card Items so design templates (rarity) show up
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
