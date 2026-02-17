import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedDatabase, seedCompetitions } from "./seed.js";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .filter(Boolean);

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
  // Auth Setup for Railway/Local
  if (process.env.REPL_ID) {
    await setupAuth(app);
    registerAuthRoutes(app);
  } else {
    console.log("Railway environment detected: Bypassing Replit Auth.");
    app.use((req: any, _res, next) => {
      req.isAuthenticated = () => true;
      req.user = {
        id: "54644807",
        claims: { sub: "54644807" },
        firstName: "Zjondre",
        lastName: "Angermund",
      };
      next();
    });

    app.get("/api/auth/user", (req: any, res) => res.json(req.user));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
  }

  // --- API ROUTES ---

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
