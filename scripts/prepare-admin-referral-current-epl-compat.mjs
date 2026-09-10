import fs from "node:fs";

const file = "scripts/apply-admin-referral-monitoring.mjs";
const marker = "CURRENT_EPL_ADMIN_REFERRAL_IDEMPOTENCY_V1";
let source = fs.readFileSync(file, "utf8");

if (!source.includes(marker)) {
  const old = `function replaceRequired(source, from, to, label) {\n  if (source.includes(to)) return source;\n  if (!source.includes(from)) throw new Error(\`Admin referral monitoring anchor not found: \${label}\`);\n  return source.replace(from, to);\n}`;
  const next = `function replaceRequired(source, from, to, label) {\n  if (source.includes(to)) return source;\n  // ${marker}: the current-EPL postguard adds 'archived' to the player\n  // eligibility helper after Admin referral monitoring has inserted its audit helper.\n  // On a second build in the same workspace, recognise that audit helper directly\n  // instead of requiring the pre-postguard source text again.\n  if (label === "claim audit helper" && source.includes("async function recordReferralClaimAudit(")) return source;\n  if (!source.includes(from)) throw new Error(\`Admin referral monitoring anchor not found: \${label}\`);\n  return source.replace(from, to);\n}`;
  if (!source.includes(old)) throw new Error("[admin-referral-current-epl] replaceRequired anchor missing");
  source = source.replace(old, next);
  fs.writeFileSync(file, source);
  console.log("[admin-referral-current-epl] made referral monitoring idempotent after current-EPL postguard");
} else {
  console.log("[admin-referral-current-epl] compatibility already prepared");
}
