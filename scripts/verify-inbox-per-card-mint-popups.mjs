import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Regression guard: clicking a saved/read reward Inbox message may only open
// a modal for the exact window, replacement claim, or prize entry in that row.
// Opening must never POST a claim until the user confirms within the modal.
const read=p=>readFileSync(p,"utf8");
const popup=read("client/src/components/InboxMintActionDialog.tsx");
const account=read("client/src/pages/account.tsx");
const routes=read("client/src/lib/notifications.ts");
const prize=read("client/src/components/PendingPrizeClaimPopup.tsx");
const weekly=read("client/src/components/WeeklyCommonMintDialog.tsx");
const nativeClub=read("client/src/components/native/NativeClubPage.tsx");
const policy=read("server/services/weeklyRewardOutageRecovery.ts");
const requireText=(source,token,msg)=>assert.ok(source.includes(token),msg);
for(const term of [
 "INBOX_PER_CARD_MINT_POPUP_V1", "WEEK_KEY", "REPLACEMENT_KEY",
 "isInboxMintNotice", "requestedWeek === weekly?.eligibleFrom",
 "weeks.includes(activeWeek)", "canMintCurrent", "canRecover",
 "replacementQuery.data?.claims", "note.replacementClaimId",
 "replacementFinished", "data-inbox-mint-confirm",
 "The server verifies your specific entitlement when you confirm.",
 'postJson("/api/rewards/daily-login/claim")',
 "/api/rewards/november-recovery/", "/api/player-replacements/",
 "setReveal", "Later — keep in Inbox",
]) requireText(popup,term,`Inbox popup lost safety requirement ${term}`);
requireText(account,"openInboxNotification(note)","Inbox row should be clickable");
requireText(account,'isInboxMintNotice(note)',"Mint messages should open targeted popup");
requireText(account,"<InboxMintActionDialog","Inbox popup must mount for the selected card");
requireText(account,'params.get("mint")!=="1"',"Push deep link must be opt-in");
requireText(account,'note=inbox.notifications.find(row=>row.id===id)',"Only owned Inbox rows may trigger popup");
requireText(routes,"INBOX_MINT_DEEPLINK_V1","Push/web notifications must deep-link to correct popup");
requireText(routes,"&mint=1","Explicit card popup link missing");
requireText(nativeClub,'target.includes("mint=1") || target.includes("mintPrizeEntry=")',"Native Inbox must open the same per-card modal on tap");
requireText(routes,"mintPrizeEntry=","Trophy prize must open specific entry popup");
requireText(prize,"Number(a.entryId)===requestedEntryId","Prize popup must honor exact entry ID");
requireText(prize,"shouldPromptPrizeMint(a)","No already claimed prize must be offered again");
requireText(weekly,"!inboxOpen","Auto weekly popup must not stack on Inbox popup");
requireText(policy,"pg_advisory_xact_lock","Existing claim serialisation must remain");
requireText(policy,"PRIMARY KEY(user_id,window_start)","Historical mint duplicate constraint must remain");
assert.ok(!popup.includes('useEffect(()=>{void postJson'),"Opening the modal may not auto-mint");
console.log("Exact per-card Inbox mint popups, deep-links and duplicate-prevention verified.");
