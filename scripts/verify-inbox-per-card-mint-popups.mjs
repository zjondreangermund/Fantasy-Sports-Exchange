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
 'postJson("/api/rewards/daily-login/claim",',
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

// Execute the actual popup capacity decisions for current and missed windows.
const start=popup.indexOf('  const rewardStatus=');
const end=popup.indexOf('  const replacementQuery =',start);
const capacity=new Function('isRecoverable','isCurrent','recovery','weekly','replaceCardId',popup.slice(start,end)+';return {eligibleWeeklyReward,canRecover,canMintCurrent,replacementAvailable,collectionOverCap};');
let state=capacity(true,false,{commonCount:10,cap:10},undefined,0);
assert.equal(state.replacementAvailable,true);assert.equal(state.canRecover,false);
state=capacity(true,false,{commonCount:10,cap:10},undefined,7);assert.equal(state.canRecover,true);
state=capacity(true,false,{commonCount:20,cap:10},undefined,7);assert.equal(state.canRecover,false);assert.equal(state.collectionOverCap,true);assert.equal(state.replacementAvailable,false);
state=capacity(true,false,{commonCount:9,cap:10},undefined,0);assert.equal(state.canRecover,true);
state=capacity(false,true,undefined,{commonCount:10,cap:10,canClaim:true},7);assert.equal(state.canMintCurrent,true);
state=capacity(false,true,undefined,{commonCount:10,cap:10,canClaim:false},7);assert.equal(state.canMintCurrent,false);
requireText(popup,'Choose my 10 Common cards','Above-cap users must have an actionable route to reduction');
state=capacity(false,true,undefined,{commonCount:10,cap:10,canClaim:true},0);
assert.equal(state.eligibleWeeklyReward,true);assert.equal(state.replacementAvailable,true);assert.equal(state.canMintCurrent,false);
state=capacity(false,true,undefined,{commonCount:10,cap:10,canClaim:false},7);
assert.equal(state.eligibleWeeklyReward,false);assert.equal(state.replacementAvailable,false);
requireText(popup,'<CommonReplacementSelect','Missed rewards must expose the replacement selector at capacity');
requireText(popup,'Keep my current squads','Inbox reward must offer an explicit keep choice');
requireText(weekly,'Keep my current squads','Login reward must offer an explicit keep choice');
const picker=read("client/src/components/CommonCollectionManager.tsx");
const won=read("client/src/components/CommonCardRewardChoiceDialog.tsx");
requireText(picker,'Mint replacement — choose player','Replacement list must open only on choice');
requireText(picker,'<PlayerRow','Replacement list must reuse player stats rows');
requireText(picker,'CardPlayerImage','Replacement rows must include portraits');
requireText(picker,'card.replacementBlocked ?? card.blocked','Replacement list must preserve card locks');
requireText(won,'<CommonReplacementSelect','Won Common rewards must use the same player selection');
console.log('Current/missed reward capacity actions verified: reduce above ten, select replacement at ten, direct mint below ten.');
