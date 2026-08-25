#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const start = fs.readFileSync("start.sh", "utf8");
const cards = fs.readFileSync("server/routes/cards.routes.ts", "utf8");
const onboarding = fs.readFileSync("server/routes/onboarding.routes.ts", "utf8");
const reset = fs.readFileSync("scripts/reset-four-test-accounts-to-starter-common.mjs", "utf8");
const recovery = fs.readFileSync("scripts/audit-starter-selection-recovery.mjs", "utf8");
const restore = fs.readFileSync("scripts/restore-confirmed-starter-selections.mjs", "utf8");
const enrichment = fs.readFileSync("server/services/playerCardEnrichment.ts", "utf8");
const marketplace = fs.readFileSync("server/routes/marketplace.routes.ts", "utf8");
const gameweekPatch = fs.readFileSync("scripts/apply-gameweek-prize-isolation.mjs", "utf8");

assert.doesNotMatch(
  start,
  /node\s+scripts\/reset-four-test-accounts-to-starter-common\.mjs/,
  "production startup must never reset an existing user's Collection",
);
assert.match(
  reset,
  /process\.env\.ALLOW_HISTORICAL_TEST_ACCOUNT_RESET\s*!==\s*"true"/,
  "the retired historical reset must require explicit destructive-operation approval",
);

const collectionStart = cards.indexOf("  const sendUserCards = async");
const collectionEnd = cards.indexOf("  app.post(\"/api/audit/client-event\"", collectionStart);
assert.ok(collectionStart >= 0 && collectionEnd > collectionStart, "could not isolate Collection response handler");
const collectionHandler = cards.slice(collectionStart, collectionEnd);
assert.match(collectionHandler, /await\s+storage\.getUserCards\(userId\)/, "Collection must return the cards the account already owns");
assert.doesNotMatch(collectionHandler, /createPlayerCard|getRandomPlayers|seedDatabase|\.insert\(|\.update\(/, "Collection reads must not mint or modify cards");

const chooseStart = onboarding.indexOf('app.post("/api/onboarding/choose"');
assert.ok(chooseStart >= 0, "starter confirmation endpoint is missing");
const chooseHandler = onboarding.slice(chooseStart);
assert.match(chooseHandler, /await\s+db\.transaction\(/, "starter minting and selection persistence must share a transaction");
assert.match(chooseHandler, /from\s+app\.user_onboarding[\s\S]*?for\s+update/, "starter confirmation must lock its onboarding record");
assert.match(chooseHandler, /const orderedSelected =/, "confirmed selections must be normalized into pack order");
assert.match(chooseHandler, /await\s+ensureStarterCards\(tx,\s*userId,\s*orderedSelected\)/, "only the user's pack-ordered confirmed selections may be minted");
assert.match(chooseHandler, /selectedCards:\s*orderedSelected,\s*completed:\s*true/, "the exact pack-ordered player IDs must be persisted");
assert.match(chooseHandler, /onboarding\.starter_selection_confirmed/, "confirmed selections need a durable account audit event");
assert.match(chooseHandler, /starterCardIds:\s*grantResult\.cardIds/, "confirmed starter-card IDs need durable recovery evidence");
assert.match(chooseHandler, /INSERT INTO app\.lineups/, "signup confirmation must create an immediately eligible lineup");
assert.match(chooseHandler, /lineupOrder:\s*\["GK",\s*"DEF",\s*"MID",\s*"FWD",\s*"UTILITY"\]/, "starter audit evidence must record eligible lineup order");

assert.match(recovery, /await\s+client\.query\("begin read only"\)/, "starter-recovery diagnostics must run in a read-only database transaction");
assert.doesNotMatch(recovery, /(?:update|delete\s+from|insert\s+into)\s+app\.player_cards/i, "recovery diagnostics must never mutate card ownership");
assert.match(recovery, /action=manual-approval-required/, "restoring detached cards must require explicit approval");

assert.match(start, /node scripts\/restore-confirmed-starter-selections\.mjs/, "production startup must run the approved one-time confirmed-selection restoration");
assert.match(restore, /starter_selection_restoration_backups/, "restoration must take a reversible pre-change account snapshot");
assert.match(restore, /selection-not-proven-by-five-packs/, "normal-user restoration must require five-pack selection proof");
assert.match(restore, /admin\.test_account_starter_reset/, "overwritten reset selections must be handled separately");
assert.match(restore, /where id=\$2 and owner_id is null/, "historical recovery must never overwrite another card owner");
assert.match(restore, /remainingConfirmedMismatches > 0/, "restoration must fail if a proven signup selection is still missing");
assert.doesNotMatch(restore, /delete\s+from\s+app\.player_cards/i, "restoration must never delete cards");
assert.doesNotMatch(restore, /set\s+owner_id\s*=\s*null/i, "restoration must never clear card ownership");

assert.match(cards, /position:\s*canonical\?\.position\s*\|\|\s*player\.position\s*\|\|\s*apiFootballPlayer\?\.position/, "Collection must display the tournament-authoritative position");
assert.match(enrichment, /const currentPosition = canonical\?\.position \|\| String\(player\.position \|\| ""\) \|\| apiFootballPlayer\?\.position/, "shared card enrichment must prefer FPL/stored tournament positions");
const marketplaceUsesInlinePosition = /position:\s*canonical\?\.position\s*\|\|\s*storedPlayer\.position\s*\|\|\s*apiFootballPlayer\?\.position/.test(marketplace);
const marketplaceUsesCanonicalPositionHelper = /const position = canonical\?\.position \|\| String\(storedPlayer\.position \|\| ""\) \|\| apiFootballPlayer\?\.position(?: \|\| "MID")?;/.test(marketplace)
  && /player:\s*\{[\s\S]*?position,/.test(marketplace);
assert.ok(marketplaceUsesInlinePosition || marketplaceUsesCanonicalPositionHelper, "Marketplace must display the tournament-authoritative position");
assert.match(gameweekPatch, /const currentPosition = canonical\?\.position \|\| String\(player\.position \|\| ""\) \|\| apiFootballPlayer\?\.position \|\| "MID"/, "gameweek build transform must preserve tournament-authoritative position precedence");
assert.doesNotMatch(gameweekPatch, /const currentPosition = apiFootballPlayer\?\.position \|\| canonical\?\.position/, "gameweek build transform must not restore stale API-Football position precedence");

// The Railway server build transforms the starter-offer generator before
// compiling. Execute that transform against an in-memory filesystem to prove
// the ownership protection survives the same build-time rewrite.
const transformPath = "scripts/apply-onboarding-starter-randomization.mjs";
const transformSource = fs.readFileSync(transformPath, "utf8")
  .replace(/^import\s+[^;]+;\s*$/gm, "");
let transformed = onboarding;

vm.runInNewContext(transformSource, {
  fs: {
    readFileSync(file) {
      assert.equal(file, "server/routes/onboarding.routes.ts");
      return transformed;
    },
    writeFileSync(file, value) {
      assert.equal(file, "server/routes/onboarding.routes.ts");
      transformed = String(value);
    },
  },
  console: { log() {} },
  process: {
    exit(code) {
      if (code !== 0) throw new Error(`Starter-offer build transform failed with exit ${code}`);
    },
  },
}, { filename: transformPath });

assert.match(transformed, /FAIR_STARTER_DRAFT_V1/, "the build must retain full Premier League starter-offer randomization");
assert.match(transformed, /await\s+db\.transaction\(/, "the build transform removed atomic starter confirmation");
assert.match(transformed, /onboarding\.starter_selection_confirmed/, "the build transform removed starter-selection recovery evidence");

const randomizationVerifierPath = "scripts/verify-onboarding-starter-randomization.mjs";
const randomizationVerifier = fs.readFileSync(randomizationVerifierPath, "utf8")
  .replace(/^import\s+[^;]+;\s*$/gm, "");
vm.runInNewContext(randomizationVerifier, {
  fs: { readFileSync: () => transformed },
  console: { log() {} },
}, { filename: randomizationVerifierPath });

console.log("Starter selection integrity verified: startup resets disabled, Collection read-only, exact choices minted atomically, recovery diagnostics read-only, and Railway build transforms preserved.");