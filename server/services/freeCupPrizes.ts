import { randomInt } from "node:crypto";

// Probabilities are drawn once, server-side, at first-place settlement.
// 2nd and 3rd receive Common cards as before.
export const FREE_CUP_FIRST_PRIZE_ODDS = [
  { rarity: "rare", weight: 9500, percentage: 95 },
  { rarity: "unique", weight: 450, percentage: 4.5 },
  { rarity: "epic", weight: 45, percentage: 0.45 },
  { rarity: "legendary", weight: 5, percentage: 0.05 },
] as const;

export type FreeCupFirstPrizeRarity = (typeof FREE_CUP_FIRST_PRIZE_ODDS)[number]["rarity"];

export function drawFreeCupFirstPrize(): FreeCupFirstPrizeRarity {
  const roll = randomInt(10_000);
  let boundary = 0;
  for (const option of FREE_CUP_FIRST_PRIZE_ODDS) {
    boundary += option.weight;
    if (roll < boundary) return option.rarity;
  }
  throw new Error("FREE Cup prize odds must total 100%");
}
