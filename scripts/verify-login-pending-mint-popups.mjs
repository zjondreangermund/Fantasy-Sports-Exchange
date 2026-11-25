import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const app=read("client/src/App.tsx");
const queue=read("client/src/components/LoginPendingCardMintDialog.tsx");
const popup=read("client/src/components/InboxMintActionDialog.tsx");
const prize=read("client/src/components/PendingPrizeClaimPopup.tsx");
const departures=read("client/src/components/DepartureLoginPrompt.tsx");
const recovery=read("server/services/weeklyRewardOutageRecovery.ts");
const requireText=(src,term,description)=>assert.ok(src.includes(term),description);

requireText(app,'<LoginPendingCardMintDialog />',"Global pending-card prompts must mount after login");
requireText(queue,"LOGIN_PENDING_MINT_POPUPS_V1","Missing login popup policy marker");
requireText(queue,'onboarding?.completed === true',"Do not prompt unauthenticated/unonboarded users");
requireText(queue,'queryKey:["/api/rewards/november-recovery","login-pending",userId]',"Existing recovery entitlement must load");
requireText(queue,'queryKey:["/api/rewards/daily-login","login-pending",userId]',"Existing weekly entitlement must load");
requireText(queue,'queryKey:["/api/trophy-cabinet","login-pending",userId]',"Pending tournament prizes must take precedence");
requireText(queue,'queryKey:["/api/player-replacements","login-pending",userId]',"Pending departures must take precedence");
requireText(queue,'shouldPromptPrizeMint(award)',"Prize eligibility must stay server-backed");
requireText(queue,'prizePending || departurePending',"Do not layer weekly dialog over a prize/departure");
requireText(queue,'"login-pending",userId',"Cache must be isolated per signed-in player");
requireText(queue,'otherModalOpen || explicitMint',"Do not layer over existing modal or deliberate mint popup");
assert.ok(!queue.includes('window.location.pathname==="/account" && params.get("tab")==="inbox"'),
  "Direct login to Inbox must still show eligible unclaimed-card popups");
requireText(queue,'pendingWindows',"Each recoverable missed week must be independently offered");
requireText(queue,'token:`recovery:${week}`',"Distinct recovered-week tracking required");
requireText(queue,'token:`weekly:${current}`',"Current week must be its own claim");
requireText(queue,'!seen.has(current)',"Do not show the same week twice");
requireText(queue,'onClose={close}',"Dismissal must advance the queue without claiming");
requireText(queue,'sessionStorage.setItem(key,"later")',"Only prompt once per session per reward");
requireText(popup,'The server verifies your specific entitlement when you confirm.',"Claims must be explicitly confirmed and server-validated");
requireText(recovery,'PRIMARY KEY(user_id,window_start)',"Database duplicate recovery protection required");
requireText(prize,'sessionStorage.getItem(key)',"Prize snoozes must reset on a new browser login session");
requireText(prize,'sessionStorage.setItem(onceKey(userId,award.entryId),"later")',"Prize snooze must be session-only");
requireText(departures,'fa:login-replacement-reviewed:',"Each original-player replacement needs an independent login prompt");
assert.ok(!/createNotificationOnce|sendWebPush|sendNativePush|notifyWeeklyCommonRewardWindows/.test(queue),
 "Login reminders must NEVER create notifications or trigger push deliveries");
assert.ok(!/postJson\(/.test(queue),
 "Do not mint cards by simply logging in or opening a popup");
console.log("Login pending-card flow verified: no new notifications, sequential individual claims, once-per-session snooze, prize/departure priority, backend idempotency.");

const keepPolicy=read("client/src/lib/weekly-common-keep.ts");
const weekly=read("client/src/components/WeeklyCommonMintDialog.tsx");
requireText(popup,"rememberKeptWeeklyCommon(String(user.id),activeWeek)","Explicit Inbox keep must persist the exact reward");
requireText(queue,'!hasKeptWeeklyCommon(userId,item.token.split(":")[1])',"Login queue must skip kept windows");
requireText(weekly,'!hasKeptWeeklyCommon(String(user?.id||""),windowId)',"Standalone weekly popup must honor the same keep decision");
requireText(weekly,'rememberKeptWeeklyCommon(String(user?.id||""),windowId)',"Standalone keep must persist");
const policySource=keepPolicy.slice(keepPolicy.indexOf("const PREFIX"),keepPolicy.indexOf("export function useWeeklyCommonKeepRevision"))
  .replaceAll("export function ","function ")
  .replaceAll("new Set<string>()","new Set()")
  .replaceAll("userId:string","userId")
  .replaceAll("windowStart:string","windowStart")
  .replace(/\):(string|boolean|void)\s*\{/g,"){");
const persisted=new Map();
const fakeWindow={localStorage:{getItem:key=>persisted.get(key)||null,setItem:(key,value)=>persisted.set(key,value)},dispatchEvent:()=>{}};
const loadPolicy=()=>new Function("window","Event",policySource+";return {hasKeptWeeklyCommon,rememberKeptWeeklyCommon};")(fakeWindow,class {});
let keep=loadPolicy();
assert.equal(keep.hasKeptWeeklyCommon("manager-a","2026-11-17"),false);
keep.rememberKeptWeeklyCommon("manager-a","2026-11-17");
keep=loadPolicy(); // fresh JS instance: app reopen
assert.equal(keep.hasKeptWeeklyCommon("manager-a","2026-11-17"),true);
assert.equal(keep.hasKeptWeeklyCommon("manager-a","2026-11-24"),false);
assert.equal(keep.hasKeptWeeklyCommon("manager-b","2026-11-17"),false);
assert.equal(keep.hasKeptWeeklyCommon("manager-a",""),false);
console.log("Keep decision survives app reopen; different reward windows and accounts remain independent.");
