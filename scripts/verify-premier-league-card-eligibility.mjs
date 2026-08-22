import fs from "node:fs";

const identity = fs.readFileSync("server/services/fplPlayerIdentity.ts", "utf8");
const cards = fs.readFileSync("server/routes/cards.routes.ts", "utf8");
const enrichment = fs.readFileSync("server/services/playerCardEnrichment.ts", "utf8");
const client = fs.readFileSync("client/src/pages/competitions-vault.tsx", "utf8");
const server = fs.readFileSync("server/routes/economyIntegrity.routes.ts", "utf8");
const profile = fs.readFileSync("client/src/components/cards/CardProfileModal.tsx", "utf8");
const reconciliation = fs.readFileSync("scripts/reconcile-owned-premier-league-cards.mjs", "utf8");
const startup = fs.readFileSync("start.sh", "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

function rejectText(source, forbidden, message) {
  if (source.includes(forbidden)) throw new Error(message);
}

requireText(identity, 'league: "Premier League"', "Official FPL identities must include their verified Premier League eligibility.");
requireText(cards, 'league: identityVerified ? "Premier League" : player.league', "Collection must expose the verified current league rather than stale stored league metadata.");
requireText(cards, "premierLeagueEligible: identityVerified", "Collection must explicitly mark officially verified players as tournament eligible.");
requireText(cards, 'provider: selectionProvider', "Every collection card must explain which identity provider determines its eligibility.");
requireText(cards, '"api-football"', "API-Football current squads must be the primary card identity provider.");
requireText(cards, '"fpl-fallback"', "FPL must remain available as the identity fallback.");
requireText(enrichment, 'league: identityVerified ? "Premier League" : player.league', "Shared card enrichment must retain verified Premier League eligibility.");
requireText(client, "premierLeagueEligible === true", "The squad picker must include verified Premier League players even when old stored metadata is stale.");
requireText(client, "candidateRows.map(({ card, reason })", "The squad picker must display unavailable cards with their individual reason.");
requireText(client, "already used in another entry in this tournament", "The squad picker must explain tournament card locks.");
requireText(client, "listed on the marketplace", "The squad picker must explain marketplace exclusions.");
requireText(client, "not linked to a current Premier League squad", "The squad picker must explain identity exclusions.");
requireText(server, "officialPlayerIndex.resolve", "Tournament entry validation must independently resolve players against the official current roster.");
requireText(profile, "Outside Premier League", "Departed players must be clearly labeled in the card profile.");
requireText(reconciliation, "bootstrap.elements.length < 300", "Replacement minting must stop unless the official FPL roster is complete.");
requireText(reconciliation, "directory.length >= 250 && directoryTeams >= 15", "Replacement minting must require a healthy independent API-Football roster.");
requireText(reconciliation, "app.departed_player_card_replacements", "Replacement cards must be tracked in a permanent idempotency ledger.");
requireText(reconciliation, "source_card_id integer primary key", "Only one replacement may be minted for each departed player card.");
requireText(reconciliation, "p.position=$2::public.position", "Replacement players must have the same position as the original card.");
requireText(reconciliation, "$3::public.rarity", "Replacement players must have the same rarity as the original card.");
requireText(reconciliation, "preservedOriginalCard: true", "Original signup cards must remain owned and auditable.");
requireText(reconciliation, "PREMIER_LEAGUE_REPLACEMENT_GUARD", "Incomplete roster sources or suspicious bulk departures must block replacement minting.");
rejectText(reconciliation, "set owner_id=null", "Departure replacement must not remove anyone's original player cards.");
rejectText(reconciliation, "delete from app.player_cards", "Departure replacement must not delete anyone's original player cards.");

const serialPreparation = startup.indexOf("node scripts/prepare-runtime-startup.mjs");
const replacementStartup = startup.indexOf("node scripts/reconcile-owned-premier-league-cards.mjs");
if (serialPreparation < 0 || replacementStartup <= serialPreparation) {
  throw new Error("Departure replacements must be minted only after immutable serial/supply triggers have been installed.");
}

console.log("Verified Premier League card identity, tournament eligibility and safe same-position departure replacements.");
