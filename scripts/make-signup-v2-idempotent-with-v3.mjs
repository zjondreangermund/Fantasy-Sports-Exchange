import fs from "node:fs";

const file = "scripts/apply-signup-funnel-observability-v2.mjs";
let source = fs.readFileSync(file, "utf8");

function addGuard(anchor, marker, condition) {
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`Could not make signup v2 patch attribution-aware: ${marker}`);
  source = source.replace(anchor, `${anchor}  // ${marker}\n  if (${condition}) return source;\n`);
}

addGuard(
  'patchFile("client/src/pages/landing.tsx", (original) => {\n  let source = original;\n',
  "SIGNUP_V2_ACCEPTS_ATTRIBUTION_V3_LANDING",
  'source.includes("MARKETING_VISITOR_KEY") && source.includes("function resolveMarketingSource")',
);
addGuard(
  'patchFile("server/routes/admin.routes.ts", (original) => {\n  let source = original;\n',
  "SIGNUP_V2_ACCEPTS_ATTRIBUTION_V3_ADMIN_API",
  'source.includes("SIGNUP_SOURCE_ATTRIBUTION_ADMIN_V3")',
);
addGuard(
  'patchFile("client/src/pages/admin.tsx", (original) => {\n  let source = original;\n',
  "SIGNUP_V2_ACCEPTS_ATTRIBUTION_V3_ADMIN_UI",
  'source.includes("Completed tracked signups by source")',
);

fs.writeFileSync(file, source);
console.log("Signup funnel v2 patch accepts all v3-attributed surfaces on repeated builds.");
