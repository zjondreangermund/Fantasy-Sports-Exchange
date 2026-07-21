import fs from "node:fs";

const client = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const server = fs.readFileSync("server/routes/economyIntegrity.routes.ts", "utf8");
const startup = fs.readFileSync("scripts/prepare-runtime-startup.mjs", "utf8");

function requireText(source, pattern, message) {
  if (!source.includes(pattern)) throw new Error(message);
}

function forbidText(source, pattern, message) {
  if (source.includes(pattern)) throw new Error(message);
}

requireText(client, "isPremierLeague(card.player?.league)", "Tournament card picker must filter player cards to the Premier League.");
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
forbidText(client, "disabled={entered", "Existing entries must not disable the tournament entry button.");

requireText(server, "p.league as league", "Server validation must load each player's league.");
requireText(server, "Premier League tournaments only accept Premier League player cards.", "Server validation must reject non-Premier-League cards.");
requireText(server, "REQUIRED_LINEUP_POSITIONS", "Server validation must enforce the guided formation.");
requireText(server, "Invalid lineup order: select GK, DEF, MID, FWD, then one Utility player.", "Server must enforce ordered formation slots.");
requireText(server, "pg_advisory_xact_lock(87421, card_id)", "Concurrent submissions must serialize card selection.");
requireText(server, "jsonb_array_elements_text", "Server must check previous lineups for overlapping cards.");
requireText(server, "Each tournament entry must use five different unused cards.", "Server must reject card reuse across a user's entries.");
requireText(server, "entry_fee_paid", "Each tournament entry must persist the fee actually paid.");
forbidText(server, "Already entered this tournament", "Server must not block all additional entries by the same user.");

requireText(startup, "ensureCompetitionMultiEntrySchema", "Startup preflight must prepare the database for multiple entries.");
requireText(startup, "DROP CONSTRAINT IF EXISTS competition_entries_competition_user_uq", "Startup must remove the legacy one-entry-per-user constraint.");
requireText(startup, "DROP INDEX IF EXISTS app.competition_entries_competition_user_uq", "Startup must remove the legacy one-entry-per-user index.");

console.log("Tournament lineup integrity verification passed.");
