import fs from "node:fs";

const client = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const native = fs.readFileSync("client/src/components/native/NativePlayPage.tsx", "utf8");
const server = fs.readFileSync("server/routes/economyIntegrity.routes.ts", "utf8");
const rules = fs.readFileSync("shared/game-rules.ts", "utf8");
const startup = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");
const freeSync = fs.readFileSync("scripts/sync-free-card-tournaments.mjs", "utf8");
const rarityGuard = fs.readFileSync("scripts/enforce-tournament-rarity-requirements.mjs", "utf8");
const enumPreflight = fs.readFileSync("scripts/ensure-competition-status-enum.mjs", "utf8");

function requireText(source, pattern, message) {
  if (!source.includes(pattern)) throw new Error(message);
}

function forbidText(source, pattern, message) {
  if (source.includes(pattern)) throw new Error(message);
}

requireText(client, "isPremierLeague(card.player?.league)", "Tournament card picker must filter player cards to the Premier League.");
requireText(client, "premierLeagueEligible === true", "Verified current Premier League players must remain selectable when legacy league metadata is stale.");
requireText(client, "const slotDefinitions", "Tournament entry must define guided lineup slots.");
requireText(client, "Goalkeeper", "Guided lineup must begin with a goalkeeper slot.");
requireText(client, "Defender", "Guided lineup must include a defender slot.");
requireText(client, "Midfielder", "Guided lineup must include a midfielder slot.");
requireText(client, "Forward", "Guided lineup must include a forward slot.");
requireText(client, "Utility", "Guided lineup must include a fifth utility slot.");
requireText(client, "setActiveSlot(nextEmpty === -1 ? null : nextEmpty)", "Card selection must advance to the next empty lineup slot.");
requireText(client, "Make captain", "Completed lineups must allow captain selection.");
requireText(client, "This tournament entry is now locked and cannot be changed.", "The UI must communicate that submitted teams are final.");
requireText(client, "Enter another team", "Users with an existing entry must be allowed to submit another team.");
requireText(client, "unavailableCardIds", "Already submitted cards must be hidden from later entries.");
requireText(client, "competitionId !== selectedCompetitionId", "Used-card filtering must be scoped to the selected tournament.");
requireText(client, "isUtilityPosition(position)", "Utility choices must accept unused outfield positions.");
requireText(client, "grid grid-cols-1 gap-2.5", "The selected squad must use a readable single-column layout.");
requireText(client, "validatePartialTournamentRarityLineup", "Full tournament card picker must protect the required rarity mix while selecting cards.");
requireText(client, "validateTournamentRarityLineup", "Full tournament submit flow must validate the completed rarity mix.");
requireText(client, "selectedRequirement.shortLabel", "Full tournament UI must display the tournament rarity requirement.");
forbidText(client, "disabled={entered", "Existing entries must not disable the tournament entry button.");

requireText(native, "validatePartialTournamentRarityLineup", "Native tournament card picker must protect the required rarity mix while selecting cards.");
requireText(native, "validateTournamentRarityLineup", "Native tournament submit flow must validate the completed rarity mix.");
requireText(native, "selectedRequirement.shortLabel", "Native tournament UI must display the tournament rarity requirement.");

requireText(rules, 'TOURNAMENT_UTILITY_POSITIONS = ["DEF", "MID", "FWD"]', "Shared rules must define Utility as DEF, MID or FWD.");
requireText(rules, 'shortLabel: "5 Common"', "Common tournaments must require five Common cards.");
requireText(rules, 'shortLabel: "4 Rare + 1 Common/Rare"', "Rare tournaments must require at least four Rare cards.");
requireText(rules, 'shortLabel: "3 Unique + 2 lower/Unique"', "Unique tournaments must require at least three Unique cards.");
requireText(rules, 'shortLabel: "2 Epic + 3 lower/Epic"', "Epic tournaments must require at least two Epic cards.");
requireText(rules, 'shortLabel: "1 Legendary + any 4"', "Legendary tournaments must require at least one Legendary card.");

requireText(server, "p.league as league", "Server validation must load each player's league.");
requireText(server, "officialPlayerIndex.resolve", "Server validation must accept players securely matched to the current official Premier League roster.");
requireText(server, "Premier League tournaments only accept Premier League player cards.", "Server validation must reject non-Premier-League cards.");
requireText(server, "TOURNAMENT_REQUIRED_POSITIONS", "Server validation must enforce the guided formation.");
requireText(server, "Invalid lineup order: select GK, DEF, MID, FWD, then one Utility player.", "Server must enforce ordered formation slots.");
requireText(server, "TOURNAMENT_UTILITY_POSITIONS.includes", "Server must restrict Utility to an outfield player.");
requireText(server, "Utility player must be an unused defender, midfielder or forward.", "Server must explain invalid Utility selections.");
requireText(server, "validateTournamentRarityLineup(cards.map((card) => card.rarity), competition.tier)", "Main join API must enforce the selected tournament tier for every final lineup.");
requireText(server, "pg_advisory_xact_lock(87421, selected.card_id)", "Concurrent submissions must serialize card selection.");
requireText(server, "jsonb_array_elements_text", "Server must check previous lineups for overlapping cards.");
requireText(server, "Each tournament entry must use five different unused cards.", "Server must reject card reuse across a user's entries.");
requireText(server, "entry_fee_paid", "Each tournament entry must persist the fee actually paid.");
forbidText(server, "Already entered this tournament", "Server must not block all additional entries by the same user.");

for (const pair of [
  '{ tier: "common", prizeCardRarity: "rare" }',
  '{ tier: "rare", prizeCardRarity: "unique" }',
  '{ tier: "unique", prizeCardRarity: "epic" }',
  '{ tier: "epic", prizeCardRarity: "legendary" }',
  '{ tier: "legendary", prizeCardRarity: "legendary" }',
]) {
  requireText(freeSync, pair, `FREE Card Cup sync is missing required tournament tier mapping: ${pair}`);
}
requireText(freeSync, "rarity.tier", "FREE Card Cups must persist their own tournament tier, not their prize-card rarity.");

requireText(rarityGuard, "competition_entries_rarity_guard", "Database-level tournament rarity trigger must be installed.");
requireText(rarityGuard, "before insert or update of competition_id, lineup_card_ids", "Rarity guard must cover every entry insertion and lineup/tournament change path.");
requireText(rarityGuard, "when 'common' then", "Database guard must cover Common tournaments.");
requireText(rarityGuard, "when 'rare' then", "Database guard must cover Rare tournaments.");
requireText(rarityGuard, "when 'unique' then", "Database guard must cover Unique tournaments.");
requireText(rarityGuard, "when 'epic' then", "Database guard must cover Epic tournaments.");
requireText(rarityGuard, "when 'legendary' then", "Database guard must cover Legendary tournaments.");
requireText(rarityGuard, "paid, FREE, public, private and user-created", "Database guard must explicitly remain universal across tournament types.");
requireText(enumPreflight, 'await import("./enforce-tournament-rarity-requirements.mjs")', "Production startup must install the universal rarity guard before tournament syncs and server start.");

requireText(startup, "ensureCompetitionMultiEntrySchema", "Startup preflight must prepare the database for multiple entries.");
requireText(startup, "DROP CONSTRAINT IF EXISTS competition_entries_competition_user_uq", "Startup must remove the legacy one-entry-per-user constraint.");
requireText(startup, "DROP INDEX IF EXISTS app.competition_entries_competition_user_uq", "Startup must remove the legacy one-entry-per-user index.");

console.log("Tournament lineup integrity verification passed: canonical rarity requirements are enforced in full/native UI, main join API, every FREE tier, and the database entry table itself.");
