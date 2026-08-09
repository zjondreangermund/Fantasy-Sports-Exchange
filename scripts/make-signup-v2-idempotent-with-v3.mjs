import fs from "node:fs";

const file = "scripts/apply-signup-funnel-observability-v2.mjs";
const source = fs.readFileSync(file, "utf8");
const marker = "SIGNUP_V2_ACCEPTS_ATTRIBUTION_V3";
if (!source.includes(marker)) {
  const anchor = 'patchFile("client/src/pages/landing.tsx", (original) => {\n  let source = original;\n';
  if (!source.includes(anchor)) throw new Error("Could not make signup v2 patch attribution-aware");
  const guard = `${anchor}  // ${marker}\n  if (source.includes("MARKETING_VISITOR_KEY") && source.includes("function resolveMarketingSource")) return source;\n`;
  fs.writeFileSync(file, source.replace(anchor, guard));
}
console.log("Signup funnel v2 patch accepts the v3-attributed landing on repeated builds.");
