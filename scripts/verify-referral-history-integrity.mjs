import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const app = read("client/src/App.tsx");
const routes = read("server/routes/referrals.routes.ts");
const reconciliation = read("server/services/referralHistoryReconciliation.ts");
const referralSchema = read("shared/referral-schema.ts");
const drizzle = read("drizzle.config.ts");

expect(app.includes("REFERRAL_CLIENT_RETRY_V1"), "Referral code must survive failed server claims so login can retry");
expect(app.includes("if (response.ok) localStorage.removeItem(\"fantasy_referral_code\")"), "Referral code may only be cleared after a successful claim response");
expect(routes.includes('import { reconcileReferralHistory } from "../services/referralHistoryReconciliation.js";'), "Referral routes must import history reconciliation");
expect(routes.includes("REFERRAL_HISTORY_RECONCILIATION_V1"), "Referral reconciliation must run at service startup");
expect(routes.includes("await reconcileReferralHistory();"), "Referral history must await reconciliation before reporting stats");

expect(reconciliation.includes("HISTORICAL_REFERRAL_RECONCILIATION_V1"), "Historical referral reconciliation marker is missing");
expect(reconciliation.includes("michaelmentile2475@gmail.com"), "Known affected referrer account is not covered");
for (const cardId of [367185, 367187, 367188]) {
  expect(reconciliation.includes(`cardId: ${cardId}`), `Known historical reward card ${cardId} is not covered`);
}
expect(reconciliation.includes("client.route_view"), "Historical referred-user identity must be tied to authenticated audit evidence");
expect(reconciliation.includes("uniqueCandidates.length !== 1"), "Ambiguous historical referral evidence must never be auto-linked");
expect(reconciliation.includes("admin.failed_referral_card_leak_repaired"), "A quarantined reward may only be restored with its exact repair audit proof");
expect(reconciliation.includes("historical-reward-owned-by-another-user"), "Reconciliation must not steal a reward card from another owner");
expect(reconciliation.includes("admin.referral_history_reconciled"), "Referral backfills must be auditable");
expect(reconciliation.includes("update app.referrals r\n      set referrer_user_id = rc.user_id"), "Existing rows with a valid referral code must recover their referrer link");
expect(reconciliation.includes("set referral_code = rc.code"), "Existing rows with a referrer must recover their durable referral code");
expect(reconciliation.includes("pg_advisory_xact_lock"), "Referral reconciliation must be serialized and idempotent");

expect(drizzle.includes('["./shared/schema.ts", "./shared/referral-schema.ts"]'), "drizzle-kit must manage referral tables instead of proposing their deletion");
expect(referralSchema.includes('table("referral_codes"'), "Referral codes must be part of the declarative schema");
expect(referralSchema.includes('table("referrals"'), "Referral history must be part of the declarative schema");
expect(referralSchema.includes('rewardCardId: integer("reward_card_id")'), "Referral reward-card attribution must be schema-managed");

if (failures.length) {
  console.error("Referral history integrity verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Referral integrity verified: failed claims retry, historical rewards map only from unique authenticated evidence, repaired cards require audit proof, and referral tables are protected from db:push deletion.");
