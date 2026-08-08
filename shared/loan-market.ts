import { getMarketplaceFloorPrice } from "./card-economy";

export type LoanRarity = "rare" | "unique" | "epic" | "legendary";

export const LOAN_MARKET_FEE_RATE = 0.10;
export const LOAN_MINIMUM_RATE = 0.10;

export const LOAN_DURATIONS_GAMEWEEKS = [1, 2, 3, 4] as const;

export function normalizeLoanRarity(rarity: string): LoanRarity | null {
  const value = String(rarity || "").toLowerCase();
  if (value === "rare") return "rare";
  if (value === "unique") return "unique";
  if (value === "epic") return "epic";
  if (value === "legendary") return "legendary";
  return null;
}

/**
 * Minimum loan price per gameweek:
 * - purchased card: 10% of the current owner's acquisition price;
 * - won/free card: 10% of the rarity Marketplace floor price.
 *
 * Common cards remain non-loanable because normalizeLoanRarity returns null.
 */
export function getLoanFloorPerGameweek(rarity: string, costBasis = 0): number {
  const normalized = normalizeLoanRarity(rarity);
  if (!normalized) return 0;
  const paidBasis = Math.max(0, Number(costBasis || 0));
  const basis = paidBasis > 0 ? paidBasis : getMarketplaceFloorPrice(normalized);
  return Math.round(Math.max(0, basis) * LOAN_MINIMUM_RATE * 100) / 100;
}

export function getLoanFeeBreakdown(input: {
  rarity: string;
  pricePerGameweek?: number;
  gameweeks?: number;
  costBasis?: number;
}) {
  const floor = getLoanFloorPerGameweek(input.rarity, input.costBasis);
  const pricePerGameweek = Math.max(floor, Number(input.pricePerGameweek || floor || 0));
  const gameweeks = Math.max(1, Math.min(4, Math.round(Number(input.gameweeks || 1))));
  const gross = Math.round(pricePerGameweek * gameweeks * 100) / 100;
  const fee = Math.round(gross * LOAN_MARKET_FEE_RATE * 100) / 100;
  const ownerReceives = Math.round((gross - fee) * 100) / 100;

  return {
    floor,
    pricePerGameweek,
    gameweeks,
    gross,
    fee,
    ownerReceives,
    feeRate: LOAN_MARKET_FEE_RATE,
    minimumRate: LOAN_MINIMUM_RATE,
    costBasis: Math.max(0, Number(input.costBasis || 0)),
    minimumBasis: Math.max(0, Number(input.costBasis || 0)) > 0 ? "purchase" : "rarity_floor",
  };
}
