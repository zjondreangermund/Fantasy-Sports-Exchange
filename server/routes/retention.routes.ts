import type { Express } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db.js";
import type { IStorage } from "../storage.js";
import { playerCards, players } from "../../shared/schema.js";
import {
  getLiquidityScore,
  getPrimarySalePrice,
  getReplacementOverallWindow,
  getScarcityBand,
} from "../../shared/card-economy.js";

type Reminder = {
  id: string;
  userId: string;
  type: "deadline";
  title: string;
  remindAt: string;
  enabled: boolean;
};

const userWatchlists = new Map<string, Set<number>>();
const userReminders = new Map<string, Reminder[]>();

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function registerRetentionRoutes(
  app: Express,
  deps: { requireAuth: any; storage: IStorage },
) {
  const { requireAuth, storage } = deps;

  app.get("/api/retention/summary", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const [wallet, cards, lineup, competitions, marketplace] = await Promise.all([
      storage.getWallet(userId),
      storage.getUserCards(userId),
      storage.getLineup(userId),
      storage.getCompetitions(),
      storage.getMarketplaceListings(),
    ]);

    const lineupCount = Array.isArray(lineup?.cardIds) ? lineup!.cardIds.length : 0;
    const listedCount = cards.filter((card) => card.forSale).length;
    const watch = Array.from(userWatchlists.get(userId) || []);
    const nextCompetition = competitions
      .filter((c: any) => String(c.status) === "open")
      .sort((a: any, b: any) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime())[0];

    const watchAlerts = marketplace
      .filter((card) => watch.includes(Number(card.id)))
      .slice(0, 5)
      .map((card) => {
        const fair = getPrimarySalePrice({
          rarity: String(card.rarity || "common"),
          overall: Number(card.player?.overall || 70),
          scarcityBand: "balanced",
        });
        const price = toMoney(card.price || 0);
        return {
          cardId: card.id,
          playerName: card.player?.name || "Unknown",
          listedPrice: price,
          fairValue: fair,
          status: price <= fair * 0.92 ? "discount" : price >= fair * 1.1 ? "premium" : "fair",
        };
      });

    const missions = [
      {
        id: "mission_open_pack",
        title: "Own your first card",
        progress: Math.min(cards.length, 1),
        target: 1,
        completed: cards.length > 0,
      },
      {
        id: "mission_set_lineup",
        title: "Set a full lineup",
        progress: lineupCount,
        target: 5,
        completed: lineupCount >= 5,
      },
      {
        id: "mission_list_card",
        title: "List one card on marketplace",
        progress: Math.min(listedCount, 1),
        target: 1,
        completed: listedCount > 0,
      },
    ];

    const nextBestAction =
      cards.length === 0
        ? { key: "onboarding", title: "Open starter packs", ctaPath: "/onboarding" }
        : lineupCount < 5
          ? { key: "lineup", title: "Finish your 5-card lineup", ctaPath: "/competitions" }
          : (wallet?.balance || 0) < 5
            ? { key: "fund", title: "Fund wallet for market opportunities", ctaPath: "/wallet" }
            : { key: "market", title: "Scout underpriced cards in marketplace", ctaPath: "/marketplace" };

    return res.json({
      missions,
      reminders: userReminders.get(userId) || [],
      watchlist: { cardIds: watch, alerts: watchAlerts },
      nextBestAction,
      deadline: nextCompetition
        ? {
            competitionId: nextCompetition.id,
            competitionName: nextCompetition.name,
            startsAt: nextCompetition.startDate,
          }
        : null,
    });
  });

  app.get("/api/retention/watchlist", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    return res.json({ cardIds: Array.from(userWatchlists.get(userId) || []) });
  });

  app.post("/api/retention/watchlist/cards/:cardId", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const cardId = Number(req.params.cardId || 0);
    if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Invalid cardId" });

    const existing = userWatchlists.get(userId) || new Set<number>();
    if (existing.has(cardId)) existing.delete(cardId);
    else existing.add(cardId);
    userWatchlists.set(userId, existing);

    return res.json({ cardIds: Array.from(existing) });
  });

  app.post("/api/retention/reminders/deadline", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const title = String(req.body?.title || "Lineup Deadline Reminder").trim();
    const remindAt = String(req.body?.remindAt || "").trim();
    if (!remindAt) return res.status(400).json({ message: "remindAt is required" });

    const reminder: Reminder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      type: "deadline",
      title,
      remindAt,
      enabled: true,
    };
    const prev = userReminders.get(userId) || [];
    userReminders.set(userId, [reminder, ...prev].slice(0, 20));
    return res.json({ success: true, reminder });
  });

  app.get("/api/economy/rules", requireAuth, async (_req: any, res) => {
    return res.json({
      primarySale: {
        formula: "price = f(overall, rarity, scarcityBand)",
        scarcityBands: ["abundant", "balanced", "tight", "critical"],
      },
      distribution: {
        cadence: "daily-seeded",
        channels: ["starter-pack", "reward-pool", "primary-drop"],
      },
      provenance: {
        markers: ["First Mint", "Low Serial", "Verified Holder", "Recorded"],
      },
      lifecycle: {
        leagueExit: "mint replacement from covered league at approx matching overall (+/-4).",
      },
    });
  });

  app.post("/api/economy/primary-sale/quote", requireAuth, async (req: any, res) => {
    const playerId = Number(req.body?.playerId || 0);
    const rarity = String(req.body?.rarity || "common");
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!player) return res.status(404).json({ message: "Player not found" });

    const mintedRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(playerCards)
      .where(and(eq(playerCards.playerId, playerId), eq(playerCards.rarity, rarity as any)));
    const minted = Number(mintedRows[0]?.count || 0);
    const cap = rarity === "legendary" ? 10 : rarity === "unique" || rarity === "epic" ? 50 : rarity === "rare" ? 250 : 100000;
    const scarcityBand = getScarcityBand({ minted, cap });
    const quote = getPrimarySalePrice({
      rarity,
      overall: Number(player.overall || 70),
      scarcityBand,
    });
    return res.json({ playerId, rarity, overall: player.overall, minted, cap, scarcityBand, quote });
  });

  app.post("/api/economy/lifecycle/replace-league-exit/:cardId", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const cardId = Number(req.params.cardId || 0);
    if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Invalid cardId" });

    const card = await storage.getPlayerCardWithPlayer(cardId, userId);
    if (!card) return res.status(404).json({ message: "Card not found" });
    if (String(card.ownerId || "") !== userId) return res.status(403).json({ message: "Card not owned by requester" });

    const league = String(card.player?.league || "").toLowerCase();
    if (league.includes("premier league") || league === "epl") {
      return res.status(400).json({ message: "Card still in covered league" });
    }

    const range = getReplacementOverallWindow(Number(card.player?.overall || 70));
    const replacementPool = await db
      .select()
      .from(players)
      .where(
        and(
          gte(players.overall, range.min),
          lte(players.overall, range.max),
          sql`lower(${players.league}) in ('premier league', 'epl')`,
        ),
      )
      .limit(25);
    const replacement = replacementPool[Math.floor(Math.random() * replacementPool.length)];
    if (!replacement) return res.status(404).json({ message: "No replacement candidate available" });

    const minted = await storage.createPlayerCard({
      ownerId: userId,
      playerId: replacement.id,
      rarity: card.rarity,
      forSale: false,
      price: 0,
      decisiveScore: Number(card.decisiveScore || 35),
      level: Number(card.level || 1),
      xp: Number(card.xp || 0),
      last5Scores: Array.isArray(card.last5Scores) ? card.last5Scores : [0, 0, 0, 0, 0],
    } as any);

    await storage.updatePlayerCard(cardId, {
      ownerId: null as any,
      forSale: false,
      price: 0,
    } as any);

    await storage.createTransaction({
      userId,
      type: "reward",
      amount: 0,
      description: `Lifecycle replacement: card #${cardId} exited league, replacement card #${minted.id} minted`,
    } as any);

    return res.json({
      success: true,
      retiredCardId: cardId,
      replacementCardId: minted.id,
      replacementPlayerId: replacement.id,
      replacementPlayerName: replacement.name,
      liquidityScore: getLiquidityScore({ salesCount30d: 1, tradeCount: 1, spreadPct: 8 }),
    });
  });
}
