import type { Express } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import type { IStorage } from "../storage.js";
import { withdrawalRequests } from "../../shared/schema.js";
import { registerEplRoutes } from "./epl.routes.js";
import { registerPrizeVaultRoutes } from "./prizeVault.routes.js";
import { registerReferralRoutes } from "./referrals.routes.js";
import { registerWalletRoutes } from "./wallet.routes.js";
import { COMMUNITY_ENTRY_FEE, PRIZE_CATALOG, PRIZE_MARGIN_MULTIPLIER, getActivePrizeForEntries } from "../services/prizeEngine.js";
import {
  COMMON_FORGE_BURN_COUNT,
  COMMON_TO_RARE_FORGE_FEE,
  executeCommonToRareForge,
  getBlockedForgeCardIds,
  getForgeOperationIntegrityReport,
  normalizeForgeCardIds,
} from "../services/forgeOperation.js";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }

function normalizeCompetitionWithPrize(row: any) {
  const entryCount = Number(row.entryCount || row.entry_count || 0);
  const entryFee = Number(row.entryFee || row.entry_fee || COMMUNITY_ENTRY_FEE);
  const state = getActivePrizeForEntries(row.tier, entryCount);
  const shownPrize = state.activePrize || state.nextPrize;
  return {
    ...row,
    entryFee,
    entryCount,
    prizeDescription: shownPrize?.title || row.prizeDescription || row.prize_description || "Prize ladder",
    prizeKey: shownPrize?.key || row.prizeKey || row.prize_key || null,
    prizeValue: shownPrize?.value || 0,
    prizeUnlockTarget: shownPrize ? shownPrize.requiredEntrants * entryFee : 0,
    requiredEntrants: state.requiredEntrants,
    currentEntrantRevenue: toMoney(entryCount * entryFee),
    prizeUnlocked: state.prizeUnlocked,
    activePrize: state.activePrize,
    nextPrize: state.nextPrize,
    entrantsToNext: state.entrantsToNext,
    prizeLadder: state.ladder,
  };
}

export function registerRetentionRoutes(app: Express, deps: { requireAuth: any; storage: IStorage }) {
  const { requireAuth, storage } = deps;
  const walletAdmin = async (req: any, res: any, next: any) => {
    const userId = String(req.authUserId || "");
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (ADMIN_USER_IDS.includes(userId)) return next();
    const user = await storage.getUser(userId).catch(() => undefined);
    const email = String(user?.email || req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) return res.status(403).json({ message: "Admin access required" });
    return next();
  };

  registerEplRoutes(app, { requireAuth });
  registerPrizeVaultRoutes(app);
  registerReferralRoutes(app, { requireAuth, storage });
  registerWalletRoutes(app, { requireAuth, isAdmin: walletAdmin });

  app.get("/api/admin/prizes", requireAuth, async (_req: any, res) => {
    return res.json({ prizes: PRIZE_CATALOG, communityEntryFee: COMMUNITY_ENTRY_FEE, marginMultiplier: PRIZE_MARGIN_MULTIPLIER, mode: "highest_unlocked_per_gameweek" });
  });

  app.get("/api/competitions", async (req, res) => {
    try {
      const status = String(req.query.status || "");
      const tier = String(req.query.tier || "");
      const result = await db.execute(sql`
        select
          c.id,
          c.name,
          c.tier::text as tier,
          coalesce(c.entry_fee, 0)::float as "entryFee",
          c.status::text as status,
          c.game_week as "gameWeek",
          c.start_date as "startDate",
          c.end_date as "endDate",
          c.prize_card_rarity::text as "prizeCardRarity",
          c.created_at as "createdAt",
          c.join_pin as "joinPin",
          c.visibility,
          c.max_entries as "maxEntries",
          coalesce(c.platform_fee_total, 0)::float as "platformFeeTotal",
          coalesce(c.prize_pool_total, 0)::float as "prizePoolTotal",
          coalesce(c.prize_type, 'goods') as "prizeType",
          count(ce.id)::int as "entryCount"
        from app.competitions c
        left join app.competition_entries ce on ce.competition_id = c.id
        group by c.id
        order by c.game_week asc, c.id asc
      `);
      let competitions = rowsOf(result).map(normalizeCompetitionWithPrize);
      if (status) competitions = competitions.filter((c: any) => String(c.status) === status);
      if (tier) competitions = competitions.filter((c: any) => String(c.tier) === tier);
      return res.json(competitions);
    } catch (error: any) {
      console.error("Failed to fetch competitions override", error);
      return res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const wallet = await storage.getWallet(userId);
      const withdrawals = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId));
      const pending = withdrawals.filter((w: any) => String(w.status) === "pending").reduce((sum: number, w: any) => sum + toMoney(w.amount || 0), 0);
      const balance = toMoney(wallet?.balance || 0);
      const availableBalance = toMoney(balance - pending);
      return res.json({ balance, currency: "NAD", pendingWithdrawals: toMoney(pending), availableBalance });
    } catch (err) {
      console.error("Wallet override failed", err);
      return res.status(500).json({ message: "Failed to load wallet" });
    }
  });

  app.get("/api/forge/options", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const cards = await storage.getUserCards(userId);
      const commonCardIds = cards.filter((card: any) => String(card.rarity || "") === "common" && !card.forSale).map((card: any) => Number(card.id));
      const blockedCardIds = await getBlockedForgeCardIds(userId, commonCardIds);
      const ownedRarePlayers = new Set(cards.filter((card: any) => String(card.rarity || "") === "rare").map((card: any) => Number(card.playerId)));
      const grouped = new Map<string, any[]>();
      for (const card of cards) {
        if (String(card.rarity || "") !== "common" || card.forSale || blockedCardIds.has(Number(card.id))) continue;
        if (ownedRarePlayers.has(Number(card.playerId))) continue;
        const key = `${card.playerId}`;
        const list = grouped.get(key) || [];
        list.push(card);
        grouped.set(key, list);
      }
      const options = Array.from(grouped.values()).filter((list) => list.length >= COMMON_FORGE_BURN_COUNT).map((list) => {
        const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
        const sample = sorted[0];
        return {
          playerId: sample.playerId,
          playerName: sample.player?.name || "Unknown",
          team: sample.player?.team || "",
          duplicatesOwned: sorted.length,
          required: COMMON_FORGE_BURN_COUNT,
          fee: COMMON_TO_RARE_FORGE_FEE,
          cardIds: sorted.slice(0, COMMON_FORGE_BURN_COUNT).map((card) => card.id),
          player: sample.player,
          targetRarity: "rare",
        };
      }).sort((a, b) => b.duplicatesOwned - a.duplicatesOwned);
      return res.json({ options, rules: { samePlayerRequired: true, burnCount: COMMON_FORGE_BURN_COUNT, fee: COMMON_TO_RARE_FORGE_FEE, fromRarity: "common", toRarity: "rare", protectedCardsExcluded: true } });
    } catch (error: any) {
      console.error("Failed to load forge options", error);
      return res.status(500).json({ message: "Failed to load forge options" });
    }
  });

  app.post("/api/forge/burn-same-player", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const cardIds = normalizeForgeCardIds(req.body?.cardIds);
    if (cardIds.length !== COMMON_FORGE_BURN_COUNT) return res.status(400).json({ message: `Exactly ${COMMON_FORGE_BURN_COUNT} common cards are required` });
    try {
      const result = await db.transaction((tx) => executeCommonToRareForge(tx, { userId, cardIds }));
      return res.json({ success: true, mintedRarity: "rare", fee: COMMON_TO_RARE_FORGE_FEE, ...result });
    } catch (error: any) {
      console.error("Forge burn failed", error);
      return res.status(400).json({ message: String(error?.message || "Failed to forge rare card") });
    }
  });

  app.get("/api/admin/forge/integrity", requireAuth, walletAdmin, async (_req: any, res) => {
    try {
      return res.json(await getForgeOperationIntegrityReport());
    } catch (error: any) {
      console.error("Failed to load forge integrity report", error);
      return res.status(500).json({ message: error?.message || "Failed to load forge integrity report" });
    }
  });

  app.get("/api/retention/summary", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const [wallet, cards, lineup, competitions, marketplace] = await Promise.all([
      storage.getWallet(userId), storage.getUserCards(userId), storage.getLineup(userId), storage.getCompetitions(), storage.getMarketplaceListings(),
    ]);
    const lineupCount = Array.isArray(lineup?.cardIds) ? lineup!.cardIds.length : 0;
    const listedCount = cards.filter((card) => card.forSale).length;
    const commonCardIds = cards.filter((card: any) => String(card.rarity || "") === "common" && !card.forSale).map((card: any) => Number(card.id));
    const blockedCardIds = await getBlockedForgeCardIds(userId, commonCardIds);
    const ownedRarePlayers = new Set(cards.filter((card: any) => String(card.rarity || "") === "rare").map((card: any) => Number(card.playerId)));
    const duplicateCommonGroups = cards.reduce((acc: Record<string, number>, card: any) => {
      if (String(card.rarity || "") !== "common" || card.forSale || blockedCardIds.has(Number(card.id)) || ownedRarePlayers.has(Number(card.playerId))) return acc;
      const key = String(card.playerId || "");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const forgeReadyCount = Object.values(duplicateCommonGroups).filter((count) => Number(count) >= COMMON_FORGE_BURN_COUNT).length;
    const nextCompetition = competitions.filter((c: any) => String(c.status) === "open").sort((a: any, b: any) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime())[0];
    const missions = [
      { id: "mission_open_pack", title: "Own your first card", progress: Math.min(cards.length, 1), target: 1, completed: cards.length > 0 },
      { id: "mission_set_lineup", title: "Set a full lineup", progress: lineupCount, target: 5, completed: lineupCount >= 5 },
      { id: "mission_list_card", title: "List one card on marketplace", progress: Math.min(listedCount, 1), target: 1, completed: listedCount > 0 },
      { id: "mission_forge_ready", title: "Forge 5 duplicate commons into a rare", progress: Math.min(forgeReadyCount, 1), target: 1, completed: forgeReadyCount > 0 },
    ];
    return res.json({ missions, nextBestAction: forgeReadyCount > 0 ? { key: "forge", title: "Forge a rare duplicate upgrade", ctaPath: "/card-lab" } : { key: "market", title: "Scout underpriced cards", ctaPath: "/marketplace" }, deadline: nextCompetition || null, economy: { forgeReadyCount, forgeCost: COMMON_TO_RARE_FORGE_FEE, forgeRequirement: COMMON_FORGE_BURN_COUNT, listedCount, marketplaceCount: marketplace.length, walletBalance: wallet?.balance || 0 } });
  });
}
