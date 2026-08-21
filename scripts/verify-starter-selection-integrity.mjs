#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const start = fs.readFileSync("start.sh", "utf8");
const cards = fs.readFileSync("server/routes/cards.routes.ts", "utf8");
const onboarding = fs.readFileSync("server/routes/onboarding.routes.ts", "utf8");
const reset = fs.readFileSync("scripts/reset-four-test-accounts-to-starter-common.mjs", "utf8");
const recovery = fs.readFileSync("scripts/audit-starter-selection-recovery.mjs", "utf8");

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
assert.match(chooseHandler, /await\s+ensureStarterCards\(tx,\s*userId,\s*selected\)/, "only the user's confirmed selections may be minted");
assert.match(chooseHandler, /selectedCards:\s*selected,\s*completed:\s*true/, "the exact confirmed player IDs must be persisted");
assert.match(chooseHandler, /onboarding\.starter_selection_confirmed/, "confirmed selections need a durable account audit event");
assert.match(chooseHandler, /starterCardIds:\s*grantResult\.cardIds/, "confirmed starter-card IDs need durable recovery evidence");

assert.match(recovery, /await\s+client\.query\("begin read only"\)/, "starter-recovery diagnostics must run in a read-only database transaction");
assert.doesNotMatch(recovery, /(?:update|delete\s+from|insert\s+into)\s+app\.player_cards/i, "recovery diagnostics must never mutate card ownership");
assert.match(recovery, /action=manual-approval-required/, "restoring detached cards must require explicit approval");

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
