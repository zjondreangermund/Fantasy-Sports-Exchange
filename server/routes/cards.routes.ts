import type { Express } from "express";

interface RegisterCardsRoutesDeps {
  requireAuth: any;
  storage: any;
}

export function registerCardsRoutes(app: Express, deps: RegisterCardsRoutesDeps) {
  const { requireAuth, storage } = deps;

  const ensureStarterCards = async (userId: string) => {
    const existing = await storage.getUserCards(userId);
    if (existing.length > 0) return existing;

    const starterPlayers = await storage.getRandomPlayers(5);
    if (!Array.isArray(starterPlayers) || starterPlayers.length === 0) {
      return existing;
    }

    const pickedPlayers = starterPlayers.slice(0, 5);
    for (const player of pickedPlayers) {
      try {
        await storage.createPlayerCard({
          playerId: Number(player.id),
          ownerId: userId,
          rarity: "common",
          level: 1,
          xp: 0,
          decisiveScore: 35,
          forSale: false,
          price: 0,
        } as any);
      } catch {
        continue;
      }
    }

    return storage.getUserCards(userId);
  };

  const sendUserCards = async (req: any, res: any) => {
    try {
      const userId = req.authUserId;
      const cards = await ensureStarterCards(userId);
      return res.json({ cards });
    } catch (error: any) {
      console.error("Fetch my cards failed:", error);
      return res.status(500).json({ message: "Failed to fetch my cards" });
    }
  };

  app.get("/api/cards/my", requireAuth, sendUserCards);
  app.get("/api/user/cards", requireAuth, sendUserCards);
}
