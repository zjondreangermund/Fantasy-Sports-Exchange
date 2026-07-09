import type { Express } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import type { IStorage } from "../storage.js";
import { auditLogs, playerCards, transactions, wallets, withdrawalRequests } from "../../shared/schema.js";
import { registerEplRoutes } from "./epl.routes.js";
import { registerPrizeVaultRoutes } from "./prizeVault.routes.js";

const COMMON_BURN_COUNT = 5;
const COMMON_TO_RARE_BURN_FEE = 10;

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function registerRetentionRoutes(app: Express, deps: { requireAuth: any; storage: IStorage }) {
  const { requireAuth, storage } = deps;

  // These are registered here because this route bundle is already wired in server/routes.ts.
  // It restores the missing /api/epl/* routes and exposes /api/prize-vault without another core route refactor.
  registerEplRoutes(app, { requireAuth });
  registerPrizeVaultRoutes(app);

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
      const grouped = new Map<string, any[]>();
      for (const card of cards) {
        if (String(card.rarity || "") !== "common") continue;
        if (card.forSale) continue;
        const key = `${card.playerId}`;
        const list = grouped.get(key) || [];
        list.push(card);
        grouped.set(key, list);
      }
      const options = Array.from(grouped.values()).filter((list) => list.length >= COMMON_BURN_COUNT).map((list) => {
        const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
        const sample = sorted[0];
        return {
          playerId: sample.playerId,
          playerName: sample.player?.name || "Unknown",
          team: sample.player?.team || "",
          duplicatesOwned: sorted.length,
          required: COMMON_BURN_COUNT,
          fee: COMMON_TO_RARE_BURN_FEE,
          cardIds: sorted.slice(0, COMMON_BURN_COUNT).map((card) => card.id),
          player: sample.player,
          targetRarity: "rare",
        };
      }).sort((a, b) => b.duplicatesOwned - a.duplicatesOwned);
      return res.json({ options, rules: { samePlayerRequired: true, burnCount: COMMON_BURN_COUNT, fee: COMMON_TO_RARE_BURN_FEE, fromRarity: "common", toRarity: "rare" } });
    } catch (error: any) {
      console.error("Failed to load forge options", error);
      return res.status(500).json({ message: "Failed to load forge options" });
    }
  });

  app.post("/api/forge/burn-same-player", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const cardIdsRaw = Array.isArray(req.body?.cardIds) ? req.body.cardIds : [];
    const cardIds = Array.from(new Set(cardIdsRaw.map((value: any) => Number(value)).filter((value: number) => Number.isInteger(value) && value > 0)));
    if (cardIds.length !== COMMON_BURN_COUNT) return res.status(400).json({ message: `Exactly ${COMMON_BURN_COUNT} common cards are required` });
    try {
      const result = await db.transaction(async (tx) => {
        const ownedCards = await tx.select().from(playerCards).where(sql`${playerCards.id} = ANY(${cardIds})` as any);
        if (ownedCards.length !== COMMON_BURN_COUNT) throw new Error("Some cards were not found");
        const first = ownedCards[0];
        const samePlayer = ownedCards.every((card: any) => Number(card.playerId) === Number(first.playerId));
        const sameOwner = ownedCards.every((card: any) => String(card.ownerId || "") === userId);
        const sameRarity = ownedCards.every((card: any) => String(card.rarity || "") === "common");
        const listed = ownedCards.some((card: any) => Boolean(card.forSale));
        if (!sameOwner) throw new Error("You can only burn cards you own");
        if (!sameRarity) throw new Error("Only common cards can be burned for this forge step");
        if (!samePlayer) throw new Error("All 5 cards must be the same player");
        if (listed) throw new Error("Remove listed cards from the marketplace before burning them");
        const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, userId));
        if (!wallet || toMoney(wallet.balance || 0) < COMMON_TO_RARE_BURN_FEE) throw new Error(`N$${COMMON_TO_RARE_BURN_FEE.toFixed(2)} is required to forge a rare card`);
        const [existingRare] = await tx.select().from(playerCards).where(and(eq(playerCards.ownerId, userId), eq(playerCards.playerId, Number(first.playerId)), eq(playerCards.rarity, "rare" as any)));
        if (existingRare) throw new Error("You already own the rare version of this player");
        await tx.update(wallets).set({ balance: sql`${wallets.balance} - ${COMMON_TO_RARE_BURN_FEE}` } as any).where(eq(wallets.userId, userId));
        await tx.update(playerCards).set({ ownerId: null as any, forSale: false, price: 0 } as any).where(sql`${playerCards.id} = ANY(${cardIds})` as any);
        const minted = await storage.createPlayerCard({ ownerId: userId, playerId: Number(first.playerId), rarity: "rare", forSale: false, price: 0, decisiveScore: 42, level: 1, xp: 0, last5Scores: [0, 0, 0, 0, 0] } as any);
        await tx.insert(transactions).values({ userId, type: "swap_fee" as any, amount: -COMMON_TO_RARE_BURN_FEE, grossAmount: COMMON_TO_RARE_BURN_FEE, feeAmount: COMMON_TO_RARE_BURN_FEE, netAmount: -COMMON_TO_RARE_BURN_FEE, sourceType: "forge_burn", status: "completed", description: `Forge burn fee for player:${first.playerId} using cards:${cardIds.join(",")}` } as any);
        await tx.insert(auditLogs).values({ userId, action: "forge.common_to_rare", meta: { playerId: first.playerId, burnedCardIds: cardIds, mintedCardId: minted.id, fee: COMMON_TO_RARE_BURN_FEE } } as any);
        return { mintedCardId: minted.id, playerId: first.playerId };
      });
      return res.json({ success: true, mintedRarity: "rare", fee: COMMON_TO_RARE_BURN_FEE, ...result });
    } catch (error: any) {
      console.error("Forge burn failed", error);
      return res.status(400).json({ message: String(error?.message || "Failed to forge rare card") });
    }
  });

  app.get("/api/retention/summary", requireAuth, async (req: any, res) => {
    const userId = String(req.authUserId || "");
    const [wallet, cards, lineup, competitions, marketplace] = await Promise.all([
      storage.getWallet(userId), storage.getUserCards(userId), storage.getLineup(userId), storage.getCompetitions(), storage.getMarketplaceListings(),
    ]);
    const lineupCount = Array.isArray(lineup?.cardIds) ? lineup!.cardIds.length : 0;
    const listedCount = cards.filter((card) => card.forSale).length;
    const duplicateCommonGroups = cards.reduce((acc: Record<string, number>, card: any) => {
      if (String(card.rarity || "") !== "common") return acc;
      const key = String(card.playerId || "");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const forgeReadyCount = Object.values(duplicateCommonGroups).filter((count) => Number(count) >= COMMON_BURN_COUNT).length;
    const nextCompetition = competitions.filter((c: any) => String(c.status) === "open").sort((a: any, b: any) => new Date(a.startDate as any).getTime() - new Date(b.startDate as any).getTime())[0];
    const missions = [
      { id: "mission_open_pack", title: "Own your first card", progress: Math.min(cards.length, 1), target: 1, completed: cards.length > 0 },
      { id: "mission_set_lineup", title: "Set a full lineup", progress: lineupCount, target: 5, completed: lineupCount >= 5 },
      { id: "mission_list_card", title: "List one card on marketplace", progress: Math.min(listedCount, 1), target: 1, completed: listedCount > 0 },
      { id: "mission_forge_ready", title: "Forge 5 duplicate commons into a rare", progress: Math.min(forgeReadyCount, 1), target: 1, completed: forgeReadyCount > 0 },
    ];
    return res.json({ missions, nextBestAction: forgeReadyCount > 0 ? { key: "forge", title: "Forge a rare duplicate upgrade", ctaPath: "/card-lab" } : { key: "market", title: "Scout underpriced cards", ctaPath: "/marketplace" }, deadline: nextCompetition || null, economy: { forgeReadyCount, forgeCost: COMMON_TO_RARE_BURN_FEE, forgeRequirement: COMMON_BURN_COUNT, listedCount, marketplaceCount: marketplace.length, walletBalance: wallet?.balance || 0 } });
  });
}
