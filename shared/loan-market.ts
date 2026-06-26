export type LoanRarity = "rare" | "unique" | "epic" | "legendary";

export const LOAN_MARKET_FEE_RATE = 0.08;

export const LOAN_DURATIONS_GAMEWEEKS = [1, 2, 3, 4] as const;

export const LOAN_FLOOR_PER_GAMEWEEK: Record<LoanRarity, number> = {
  rare: 20,
  unique: 50,
  epic: 50,
  legendary: 100,
};

export function normalizeLoanRarity(rarity: string): LoanRarity | null {
  const value = String(rarity || "").toLowerCase();
  if (value === "rare") return "rare";
  if (value === "unique") return "unique";
  if (value === "epic") return "epic";
  if (value === "legendary") return "legendary";
  return null;
}

export function getLoanFloorPerGameweek(rarity: string): number {
  const normalized = normalizeLoanRarity(rarity);
  return normalized ? LOAN_FLOOR_PER_GAMEWEEK[normalized] : 0;
}

export function getLoanFeeBreakdown(input: {
  rarity: string;
  pricePerGameweek?: number;
  gameweeks?: number;
}) {
  const floor = getLoanFloorPerGameweek(input.rarity);
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
  };
}
