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
requireText(queue,'otherModalOpen || explicitMint',"Do not layer over existing modal/Inbox");
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
