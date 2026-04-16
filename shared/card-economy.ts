export type CardStatus = "active" | "legacy" | "uncovered_league";
export type RarityTier = "common" | "rare" | "unique" | "legendary";

const COVERED_LEAGUES = new Set(["premier league", "epl"]);

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
