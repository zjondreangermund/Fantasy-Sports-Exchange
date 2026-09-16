import fs from "node:fs";

function requireText(file, snippets) {
  const source = fs.readFileSync(file, "utf8");
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      throw new Error(`[card-acquisition-notifications] ${file} is missing required behavior: ${snippet}`);
    }
  }
}

requireText("server/services/dailyLoginReward.ts", [
  "WEEKLY_COMMON_REWARD_WINDOW_DAYS = 7",
  "windowEndExclusive",
  "expiresAt",
  "notifyWeeklyCommonRewardWindows",
  "card:weekly-ready:",
  "card:weekly-expiring:",
  "card:weekly-minted:",
  "Unclaimed weekly cards expire and do not carry over",
  "createNotificationOnce(tx",
]);

requireText("server/routes/dailyLoginReward.routes.ts", [
  "notifyWeeklyCommonRewardWindows",
  "weeklyRewardNotificationTimer",
  "60 * 60 * 1000",
]);

requireText("server/routes/marketplace.routes.ts", [
  "marketplace:buyer:",
  "marketplace:seller:",
  'title: "Card purchased"',
  'title: "Card sold"',
]);

requireText("server/routes/loanMarket.routes.ts", [
  "loan:${loanId}:borrower-active",
  "loan:${loanId}:owner-active",
  "owner-returned",
  "borrower-ended",
  'title: "Loan card received"',
]);

requireText("server/routes/referrals.routes.ts", [
  "referral-card:${referredUserId}:",
  'title: "Referral card received"',
]);

requireText("server/services/forgeOperation.ts", [
  "forge-card:${Number(minted.id)}",
  'title: "Rare card minted"',
]);

console.log("Card acquisition notification coverage verified: weekly timed claim + push reminders, marketplace purchase/sale, loan receive/return, referral rewards and forge mints.");
