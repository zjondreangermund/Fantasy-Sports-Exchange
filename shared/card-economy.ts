export type CardStatus = "active" | "legacy" | "uncovered_league";
export type RarityTier = "common" | "rare" | "unique" | "legendary";
export type ScarcityBand = "abundant" | "balanced" | "tight" | "critical";

export const MARKETPLACE_FEE_RATE = 0.08;
export const TOURNAMENT_PLATFORM_FEE_RATE = 0.2;
export const DEPOSIT_FEE_FREE_THRESHOLD = 200;
export const SMALL_DEPOSIT_FEE_RATE = 0.02;
export const WITHDRAWAL_FEE_RATE = 0.035;
export const MIN_WITHDRAWAL_AMOUNT = 50;

export const TOURNAMENT_ENTRY_BY_RARITY: Record<RarityTier, number> = {
  common: 0,
  rare: 20,
  unique: 50,
  legendary: 100,
};

const COVERED_LEAGUES = new Set(["premier league", "epl"]);
const RARITY_WEIGHTS: Record<RarityTier, number> = {
  common: 1,
  rare: 1.6,
  unique: 2.4,
  legendary: 4.1,
};

export function normalizeRarityTier(rarity: string): RarityTier {
  const value = String(rarity || "common").toLowerCase();
  if (value === "legendary") return "legendary";
  if (value === "unique" || value === "epic") return "unique";
  if (value === "rare") return "rare";
  return "common";
}

export function getCardStatus(input: { league?: string | null; hasProgression?: boolean }): CardStatus {
  const league = String(input.league || "").toLowerCase().trim();
  if (!league) return input.hasProgression ? "legacy" : "uncovered_league";
  if (COVERED_LEAGUES.has(league)) return "active";
  return input.hasProgression ? "legacy" : "uncovered_league";
}

export function isMainCompetitionEligible(input: { rarity: string; status: CardStatus }) {
  const rarity = normalizeRarityTier(input.rarity);
  if (input.status !== "active") return false;
  if (rarity === "common") return false;
  return true;
}

export function getProvenanceMarker(input: { serialNumber?: number | null; acquiredAt?: string | Date | null }) {
  const serial = Number(input.serialNumber || 0);
  if (serial === 1) return "First Mint";
  if (serial > 0 && serial <= 10) return "Low Serial";
  if (input.acquiredAt) return "Verified Holder";
  return "Recorded";
}

export function getScarcityBand(input: { minted: number; cap: number }): ScarcityBand {
  const minted = Math.max(0, Number(input.minted || 0));
  const cap = Math.max(1, Number(input.cap || 1));
  const ratio = minted / cap;
  if (ratio < 0.4) return "abundant";
  if (ratio < 0.75) return "balanced";
  if (ratio < 0.92) return "tight";
  return "critical";
}

export function getPrimarySalePrice(input: { rarity: string; overall: number; scarcityBand?: ScarcityBand }): number {
  const rarity = normalizeRarityTier(input.rarity);
  const overall = Math.max(45, Math.min(99, Number(input.overall || 70)));
  const scarcityBand = input.scarcityBand || "balanced";
  const scarcityMultiplier =
    scarcityBand === "critical" ? 1.22 : scarcityBand === "tight" ? 1.1 : scarcityBand === "abundant" ? 0.92 : 1;
  const base = 2 + (overall - 45) * 0.42;
  const priced = base * RARITY_WEIGHTS[rarity] * scarcityMultiplier;
  return Math.round(priced * 100) / 100;
}

export function getLiquidityScore(input: { salesCount30d: number; tradeCount: number; spreadPct?: number }): number {
  const sales = Math.max(0, Number(input.salesCount30d || 0));
  const trades = Math.max(0, Number(input.tradeCount || 0));
  const spreadPenalty = Math.max(0, Math.min(40, Number(input.spreadPct || 0)));
  const score = 35 + Math.min(45, sales * 6) + Math.min(30, trades * 2.5) - spreadPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getReplacementOverallWindow(overall: number): { min: number; max: number } {
  const base = Math.max(45, Math.min(99, Number(overall || 70)));
  return { min: Math.max(45, base - 4), max: Math.min(99, base + 4) };
}

export function getDepositFeeRate(amount: number): number {
  const value = Math.max(0, Number(amount || 0));
  return value < DEPOSIT_FEE_FREE_THRESHOLD ? SMALL_DEPOSIT_FEE_RATE : 0;
}

export function getDepositBreakdown(amount: number) {
  const gross = Math.max(0, Number(amount || 0));
  const feeRate = getDepositFeeRate(gross);
  const fee = Math.round(gross * feeRate * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;
  return { gross, feeRate, fee, net };
}

export function getWithdrawalBreakdown(amount: number) {
  const gross = Math.max(0, Number(amount || 0));
  const fee = Math.round(gross * WITHDRAWAL_FEE_RATE * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;
  return { gross, feeRate: WITHDRAWAL_FEE_RATE, fee, net };
}
