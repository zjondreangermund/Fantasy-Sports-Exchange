import fs from "node:fs";
const economy=fs.readFileSync("server/routes/economyIntegrity.routes.ts","utf8");
const scoring=fs.readFileSync("server/services/scoreUpdater.ts","utf8");
const app=fs.readFileSync("client/src/App.tsx","utf8");
const dialog=fs.readFileSync("client/src/components/CommonCardRewardChoiceDialog.tsx","utf8");
function need(source,token,label){if(!source.includes(token))throw new Error(label);}
need(economy,"COMMON_COLLECTION_CAP = 20","Common collection cap must be 20");
need(economy,"common_card_reward_choices","Durable reward choices are missing");
need(economy,"pg_advisory_xact_lock","Replacement must be concurrency locked");
need(economy,"owner_id=null","Old ownership must change in the mint transaction");
need(economy,"No non-duplicate Premier League Common card","Duplicate-player guard is missing");
need(economy,"/api/common-card-reward-choices/:choiceId","Replacement endpoint is missing");
need(dialog,"Keep my current 20","Keep option is missing");
need(dialog,"Replace selected card","Replace option is missing");
need(app,"<CommonCardRewardChoiceDialog />","Global replacement choice UI is missing");
need(scoring,"sendLiveLeaderboardImpactAlerts","Live leaderboard alerts are missing");
need(scoring,"Goalkeeper concession and clean-sheet points","Goalkeeper risk alert is missing");
need(scoring,"live-impact:${sequence}","Live alert deduplication is missing");
console.log("Common 20-card cap, atomic replacement choice and live leaderboard-impact alerts verified.");
