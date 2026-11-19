import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Guards against accidental removal of November interruption compensation,
// protected player eligibility, or Inbox actions during source generators.
const read=(path)=>readFileSync(path,"utf8");
const service=read("server/services/weeklyRewardOutageRecovery.ts");
const routes=read("server/routes/dailyLoginReward.routes.ts");
const inbox=read("client/src/pages/account.tsx");
const notify=read("server/routes/notifications.routes.ts");
const destinations=read("client/src/lib/notifications.ts");
const legacy=read("scripts/apply-player-transfer-notifications.mjs");
const need=(source,value,reason)=>assert.ok(source.includes(value),reason);

for(const token of [
  "PRIMARY KEY(user_id,window_start)",
  "card_id integer NOT NULL UNIQUE",
  "pg_advisory_xact_lock",
  "currentPremierLeagueMintIds(tx)",
  "DAILY_LOGIN_COMMON_CARD_CAP",
  "app.daily_login_rewards claimed",
  "app.weekly_reward_recovery issued",
  "claimed.reward_day>=w.window_start",
  "claimed.reward_day<w.window_start+7",
  "w.window_start + 7 <=",
  "MINT_RECOVERY_START=\"2026-11-09\"",
  "MINT_RECOVERY_END_EXCLUSIVE=\"2026-11-20\"",
  "MINT_RECOVERY_CLAIM_DEADLINE=\"2026-12-10\"",
  "ORDER BY w.window_start",
  "createNotificationOnce(tx",
  "MINT_RECOVERY_NOTICE_KEY",
  "not exists",
]) need(service,token,`Lost November reward recovery safety: ${token}`);
assert.ok(!service.includes("claimDailyLoginReward(userId)"),"Recovery must not silently consume a current weekly reward");
need(service,"!available.includes(windowStart)","Historical window must be rechecked within the claim transaction");
need(service,"alreadyClaimed:true","Retry must return the original recovered card, not reroll a new one");
need(service,"WHERE issued.user_id=","Recovery must be checked per account");
need(routes,'"/api/rewards/november-recovery"',"Missed reward status endpoint missing");
need(routes,'"/api/rewards/november-recovery/:windowStart/claim"',"Explicit historical mint endpoint missing");
need(routes,"requireSignedIn","Outage recovery endpoints must require login");
need(inbox,"INBOX_RECOVERY_ACTIONS_V1","The actionable Inbox has been overwritten");
need(inbox,'id="missed-weekly-cards"',"Missing reward area in Inbox");
need(inbox,'Mint current weekly Common card',"Current weekly card must remain actionable");
need(inbox,'Mint missed Common',"Historical recovery mint must require a click");
need(inbox,'openInboxNotification(note)',"Messages must be clickable after being read");
need(inbox,'Mint {String(note.replacementRarity',"Replacement must preserve rarity");
need(inbox,"Keep until return","Loan owners must retain the choice to keep their card");
need(inbox,"Open mentioned message","Mention notifications must remain actionable");
need(inbox,'new URLSearchParams(window.location.search).get("tab") === "inbox"',"Inbound notification links must open Inbox");
need(destinations,'replacementKey.startsWith("card:weekly-ready:")',"Old mint reminders must open Inbox");
need(notify,"notifyNovemberMintInterruption()","One-off announcement should run via durable notification worker");
need(legacy,'if (input.includes("INBOX_RECOVERY_ACTIONS_V1")) return input',"Old build generator must not overwrite current Inbox");
console.log("November mint recovery static invariants verified; existing reward integration tests must also pass.");
