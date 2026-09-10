import fs from "node:fs";

const file = "server/routes/referrals.routes.ts";
let source = fs.readFileSync(file, "utf8");
const current = '!["departed", "superseded", "unlinked", "archived"].includes(status)';
const legacy = '!["departed", "superseded", "unlinked"].includes(status)';

if (!source.includes(current)) {
  if (!source.includes(legacy)) throw new Error("[current-epl-referrals] current-player referral guard anchor missing");
  source = source.replace(legacy, current);
  fs.writeFileSync(file, source);
  console.log("[current-epl-referrals] archived/departed players excluded from referral rewards");
} else {
  console.log("[current-epl-referrals] referral player eligibility already strict");
}
