import type { Express } from "express";
import { seedDatabase } from "../seed.js";
import { fplApi } from "../services/fplApi.js";
import {
  calculatePlayerScore,
  mapFplStatsToPlayerStats,
} from "../services/scoring.js";

interface RegisterCardsRoutesDeps {
  requireAuth: any;
  storage: any;
}

function normalizeLookupText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function registerCardsRoutes(app: Express, deps: RegisterCardsRoutesDeps) {
  const { requireAuth, storage } = deps;

  const ensureStarterPlayersAvailable = async () => {
    let playerCount = 0;
    try {
      playerCount = Number(await storage.getPlayerCount());
    } catch (error) {
      console.warn("Could not read player count before starter grant:", error);
    }

    if (playerCount > 0) return playerCount;

    try {
      console.log("No players available for starter grant. Running seed repair now...");
      await seedDatabase();
      playerCount = Number(await storage.getPlayerCount());
    } catch (error) {
      console.warn("Starter player seed repair failed:", error);
    }

    return playerCount;
  };

  const ensureStarterCards = async (userId: string) => {
    const existing = await storage.getUserCards(userId);
    if (existing.length > 0) return existing;

    const playerCount = await ensureStarterPlayersAvailable();
    if (!playerCount || playerCount <= 0) {
      console.warn(`Starter grant skipped for ${userId}: no players available`);
      return existing;
    }

    let starterPlayers = await storage.getRandomPlayers(12);
    if (!Array.isArray(starterPlayers) || starterPlayers.length === 0) {
      starterPlayers = await storage.getPlayers();
    }

    if (!Array.isArray(starterPlayers) || starterPlayers.length === 0) {
      console.warn(`Starter grant skipped for ${userId}: player query returned empty`);
      return existing;
    }

    let createdCount = 0;
    for (const player of starterPlayers) {
      if (createdCount >= 5) break;
      const playerId = Number(player?.id);
      if (!Number.isFinite(playerId) || playerId <= 0) continue;

      try {
        await storage.createPlayerCard({
          playerId,
          ownerId: userId,
          rarity: "common",
          level: 1,
          xp: 0,
          decisiveScore: 35,
          last5Scores: [0, 0, 0, 0, 0],
          forSale: false,
          price: 0,
        } as any);
        createdCount++;
      } catch (error) {
        console.warn(`Starter card grant skipped player ${playerId} for ${userId}:`, error);
      }
    }

    const granted = await storage.getUserCards(userId);
    if (granted.length === 0) {
      console.warn(`Starter grant produced 0 cards for ${userId}; created attempts: ${createdCount}; candidates: ${starterPlayers.length}`);
    } else {
      console.log(`Starter grant ready for ${userId}: ${granted.length} cards`);
    }

    return granted;
  };

  const sendUserCards = async (req: any, res: any) => {
    try {
      const userId = req.authUserId;
      const cards = await ensureStarterCards(userId);

      const [bootstrap, liveData] = await Promise.all([
        fplApi.bootstrap().catch(() => null),
        fplApi.getLiveGameweek().catch(() => null),
      ]);

      const teams = Array.isArray((bootstrap as any)?.teams)
        ? (bootstrap as any).teams
        : [];
      const elements = Array.isArray((bootstrap as any)?.elements)
        ? (bootstrap as any).elements
        : [];
      const liveElements = Array.isArray((liveData as any)?.elements)
        ? (liveData as any).elements
        : [];

      const teamNameById = new Map<number, string>();
      for (const team of teams) {
        teamNameById.set(
          Number(team.id),
          normalizeLookupText(String(team.name || team.short_name || "")),
        );
      }

      const elementByNameTeam = new Map<string, any>();

      const addElementCandidate = (name: string, teamNorm: string, element: any) => {
        const nameNorm = normalizeLookupText(name);
        if (!nameNorm || !teamNorm) return;
        const key = `${nameNorm}::${teamNorm}`;
        if (!elementByNameTeam.has(key)) {
          elementByNameTeam.set(key, element);
        }
      };

      for (const element of elements) {
        const teamNorm = teamNameById.get(Number(element.team)) || "";
        addElementCandidate(
          `${String(element.first_name || "")} ${String(element.second_name || "")}`.trim(),
          teamNorm,
          element,
        );
        addElementCandidate(String(element.web_name || ""), teamNorm, element);
      }

      const liveByElementId = new Map<number, any>();
      for (const liveElement of liveElements) {
        liveByElementId.set(Number(liveElement.id), liveElement);
      }

      const enrichedCards = cards.map((card: any) => {
        const player = card.player as any;
        if (!player) return card;

        const playerName = normalizeLookupText(String(player.name || ""));
        const teamName = normalizeLookupText(String(player.team || ""));
        const matchedElement =
          elementByNameTeam.get(`${playerName}::${teamName}`) || null;
        const liveElement = matchedElement
          ? liveByElementId.get(Number(matchedElement.id))
          : null;

        let last5Scores = Array.isArray(card.last5Scores)
          ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5)
          : [];

        if (liveElement) {
          const mappedStats = mapFplStatsToPlayerStats(liveElement);
          const calculatedScore = calculatePlayerScore(
            mappedStats,
            String(player.position || "MID"),
          );
          const latestLiveScore = Number(calculatedScore?.total_score || 0);
          last5Scores = [latestLiveScore, ...last5Scores];
        }

        last5Scores = last5Scores
          .map((value: any) => Number(value || 0))
          .slice(0, 5);

        while (last5Scores.length < 5) last5Scores.push(0);

        const totalPoints = last5Scores.reduce(
          (sum: number, value: number) => sum + Number(value || 0),
          0,
        );
        const averageScore = last5Scores.length
          ? Math.round(totalPoints / last5Scores.length)
          : Number(player?.overall || card.decisiveScore || 0);

        return {
          ...card,
          decisiveScore: averageScore,
          totalPoints,
          last5Scores,
          player: {
            ...player,
            overall: averageScore,
          },
        };
      });

      return res.json({ cards: enrichedCards });
    } catch (error: any) {
      console.error("Fetch my cards failed:", error);
      return res.status(500).json({ message: "Failed to fetch my cards" });
    }
  };

  app.get("/api/cards/my", requireAuth, sendUserCards);
  app.get("/api/user/cards", requireAuth, sendUserCards);
}
