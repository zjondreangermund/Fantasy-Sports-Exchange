import fs from "node:fs";

const APP = "client/src/App.tsx";
const MARKER = "WEEKLY_COMMON_MINT_POPUP_V1";

const original = fs.readFileSync(APP, "utf8");
let source = original;

const importLine = 'import WeeklyCommonMintDialog from "./components/WeeklyCommonMintDialog";';
if (!source.includes(importLine)) {
  const anchor = 'import CommonCardRewardChoiceDialog from "./components/CommonCardRewardChoiceDialog";\n';
  if (!source.includes(anchor)) throw new Error("Weekly Common mint popup import anchor not found");
  source = source.replace(anchor, `${anchor}${importLine}\n`);
}

if (!source.includes("<WeeklyCommonMintDialog />")) {
  const anchor = "          <AppContent />\n";
  if (!source.includes(anchor)) throw new Error("Weekly Common mint popup mount anchor not found");
  source = source.replace(anchor, `${anchor}          <WeeklyCommonMintDialog />\n`);
}

if (!source.includes(MARKER)) {
  source = source.replace(
    importLine,
    `${importLine}\n// ${MARKER}: global authenticated weekly Common mint prompt.`,
  );
}

if (source !== original) {
  fs.writeFileSync(APP, source);
  console.log("Weekly Common mint popup mounted globally.");
} else {
  console.log("Weekly Common mint popup already mounted.");
}
