import { randomInt } from "node:crypto";

// Probabilities are drawn once, server-side, at first-place settlement.
// New 2nd/3rd awards are Common. Historical recorded prizes remain unchanged.
export const FREE_CUP_FIRST_PRIZE_ODDS = [
  { rarity: "rare", weight: 9500, percentage: 95 },
  { rarity: "unique", weight: 450, percentage: 4.5 },
  { rarity: "epic", weight: 45, percentage: 0.45 },
  { rarity: "legendary", weight: 5, percentage: 0.05 },
] as const;

export type FreeCupFirstPrizeRarity = (typeof FREE_CUP_FIRST_PRIZE_ODDS)[number]["rarity"];

export function freeCupFirstPrizeForRoll(roll: number): FreeCupFirstPrizeRarity {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 10_000) throw new Error("Invalid FREE Cup prize roll");
  let boundary = 0;
  for (const option of FREE_CUP_FIRST_PRIZE_ODDS) {
    boundary += option.weight;
    if (roll < boundary) return option.rarity;
  }
  throw new Error("FREE Cup prize odds must total 100%");
}


export function drawFreeCupFirstPrize(): FreeCupFirstPrizeRarity {
  return freeCupFirstPrizeForRoll(randomInt(10_000));
}

// Claims honor frozen Rare runner-up awards; older Common entitlements stay Common.
export function resolveFreeCupClaimRarity(rank: number, recordedRarity: string): string {
  const rarity = String(recordedRarity || "").toLowerCase();
  if (rank === 1) return ["common", "rare", "unique", "epic", "legendary"].includes(rarity) ? rarity : "rare";
  if (rank === 2 || rank === 3) return rarity === "rare" ? "rare" : "common";
  throw new Error("Only top-three FREE Cup entries may claim");
}
