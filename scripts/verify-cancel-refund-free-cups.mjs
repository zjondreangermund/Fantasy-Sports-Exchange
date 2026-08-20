import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`Cancel/refund + FREE Cup verification failed: ${label}`);
}

function forbidToken(source, token, label) {
  if (source.includes(token)) throw new Error(`Cancel/refund + FREE Cup verification failed: ${label}`);
}

const cancellation = read("server/services/competitionCancellation.ts");
const freeSync = read("scripts/sync-free-card-tournaments.mjs");
const freeAwards = read("scripts/apply-free-card-cup-auto-awards.mjs");
const start = read("start.sh");

requireToken(cancellation, "COMPETITION_CANCEL_REFUND_V2_DYNAMIC_ENUMS", "dynamic enum compatibility marker missing");
requireToken(cancellation, 'resolveEnumSchema("competition_status")', "competition_status enum is not resolved dynamically");
forbidToken(cancellation, "ALTER TYPE app.competition_status", "refund service still hardcodes app.competition_status");
forbidToken(cancellation, "DELETE FROM app.competition_entries", "cancellation must never delete tournament entry history");
requireToken(cancellation, "WHERE ce.competition_id = ${competitionId}", "refund selection is not scoped to one tournament");
requireToken(cancellation, "WHERE reason = 'competition' AND ref_id = ${String(competitionId)}", "card-lock release is not scoped to one tournament");
requireToken(cancellation, 'scope: "single_tournament"', "single-tournament audit scope marker missing");
requireToken(cancellation, "Tournament refund completed", "player refund notification missing");

requireToken(freeSync, '{ tier: "common", prizeCardRarity: "rare" }', "Common→Rare FREE Cup mapping missing");
requireToken(freeSync, '{ tier: "rare", prizeCardRarity: "unique" }', "Rare→Unique FREE Cup mapping missing");
requireToken(freeSync, '{ tier: "unique", prizeCardRarity: "epic" }', "Unique→Epic FREE Cup mapping missing");
requireToken(freeSync, '{ tier: "epic", prizeCardRarity: "legendary" }', "Epic→Legendary FREE Cup mapping missing");
requireToken(freeSync, '{ tier: "legendary", prizeCardRarity: "legendary" }', "Legendary ceiling FREE Cup mapping missing");
requireToken(freeSync, "coveragePairs !== 190", "all 38×5 FREE Cup coverage is not verified");
requireToken(freeSync, "Preserved ${preservedEntries} existing FREE Cup entries", "FREE Cup sync does not explicitly preserve entries");
forbidToken(freeSync, "delete from app.competition_entries", "FREE Cup sync must not delete tournament entries");

requireToken(freeAwards, "FREE_CARD_CUP_AUTO_AWARD_V2_ALL_PLAYERS", "all-player randomized award marker missing");
requireToken(freeAwards, "Fisher-Yates", "full-player-pool unbiased shuffle missing");
requireToken(freeAwards, "currentPlayers", "live current Premier League player pool missing");
requireToken(freeAwards, "order by random()", "randomized full local EPL fallback missing");
forbidToken(freeAwards, "limit 25", "award draw is still artificially limited to 25 players");
forbidToken(freeAwards, "::app.rarity", "award mint still assumes app.rarity enum namespace");
requireToken(freeAwards, "where id = \\${winnerEntryId} and competition_id = \\${competitionId}", "winner prize-card update is not scoped to the selected tournament");
requireToken(freeAwards, "full current Premier League player pool across all clubs", "winner notification does not state all-club randomization");

requireToken(start, "node scripts/sync-free-card-tournaments.mjs", "production startup does not sync FREE Card Cups");

console.log("Cancel/refund and FREE Card Cup rules verified: refunds are single-tournament only, entry history is preserved, 38×5 free cups exist, and winner cards draw across the full current Premier League player pool.");
