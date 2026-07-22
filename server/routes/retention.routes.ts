import type { Express } from "express";
import { db } from "../db.js";
import type { IStorage } from "../storage.js";
import { registerEplRoutes } from "./epl.routes.js";
import { registerPrizeVaultRoutes } from "./prizeVault.routes.js";
import { registerReferralRoutes } from "./referrals.routes.js";
import { registerWalletRoutes } from "./wallet.routes.js";
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

  // Each public API path has one owner. Retention only composes the canonical
  // route modules and owns retention/forge endpoints below.
  registerEplRoutes(app, { requireAuth });
  registerPrizeVaultRoutes(app);
  registerReferralRoutes(app, { requireAuth, storage });
  registerWalletRoutes(app, { requireAuth, isAdmin: walletAdmin });

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
