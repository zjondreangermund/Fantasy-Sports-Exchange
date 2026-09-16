import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const app = read("client/src/App.tsx");
const popup = read("client/src/components/WeeklyCommonMintDialog.tsx");
const panel = read("client/src/components/dashboard/DailyLoginRewardPanel.tsx");

expect(app.includes('import WeeklyCommonMintDialog from "./components/WeeklyCommonMintDialog";'), "App must import the weekly Common mint popup");
expect(app.includes("<WeeklyCommonMintDialog />"), "Weekly Common mint popup must be mounted globally");
expect(popup.includes('data-weekly-common-mint-dialog'), "Weekly Common mint popup test marker is missing");
expect(popup.includes('data-weekly-common-mint-button'), "Weekly Common mint button test marker is missing");
expect(popup.includes('Mint Random Common Card'), "Weekly Common popup needs an explicit mint button");
expect(popup.includes('POST", "/api/rewards/daily-login/claim"'), "Mint button must call the weekly Common claim endpoint");
expect(popup.includes('enabled: Boolean(user) && onboarding?.completed === true'), "Weekly Common popup must wait for an authenticated, onboarded user");
expect(popup.includes('status?.canClaim && !status.capReached'), "Weekly Common popup must open when a reward can be claimed");
expect(popup.includes('setRevealedCard(result.card)'), "Successful weekly mint must reveal the minted card");
expect(popup.includes('<CardPlayerImage'), "Minted weekly card must be visually revealed");
expect(popup.includes('onEscapeKeyDown={(event) => event.preventDefault()}'), "Weekly mint prompt must not disappear accidentally");
expect(!panel.includes("claimMutation.mutate()"), "Dashboard must not auto-mint the weekly Common card");
expect(!panel.includes("attemptedDay"), "Old automatic weekly claim guard must be removed");
expect(panel.includes("The mint popup opens automatically"), "Dashboard must explain the explicit mint flow");

if (failures.length) {
  console.error("Weekly Common mint popup verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Weekly Common mint popup verified: global prompt, explicit mint button, no background auto-mint, and post-mint card reveal.");
