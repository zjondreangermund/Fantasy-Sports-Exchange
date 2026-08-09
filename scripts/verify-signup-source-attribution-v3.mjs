import fs from "node:fs";

const landing = fs.readFileSync("client/src/pages/landing.tsx", "utf8");
const authRoutes = fs.readFileSync("server/routes/auth.routes.ts", "utf8");
const serverIndex = fs.readFileSync("server/index.ts", "utf8");
const adminRoutes = fs.readFileSync("server/routes/admin.routes.ts", "utf8");
const adminPage = fs.readFileSync("client/src/pages/admin.tsx", "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

requireText(landing, "function resolveMarketingSource", "social source resolver");
requireText(landing, 'loginQuery.set("source", marketingSource)', "source carried into Google login");
requireText(landing, '"utm_campaign", "utm_medium", "utm_content"', "campaign parameters carried into Google login");
requireText(authRoutes, "SIGNUP_SOURCE_ATTRIBUTION_V3", "auth attribution marker");
requireText(authRoutes, "marketing.auth_started", "server-side Google start event");
requireText(authRoutes, "marketing.signup_completed", "completed new-account attribution");
requireText(authRoutes, "marketing.login_completed", "returning-login separation");
requireText(authRoutes, "marketingAttribution", "OAuth-session attribution");
requireText(serverIndex, "isNewUser", "Google new-user flag");
requireText(adminRoutes, "SIGNUP_SOURCE_ATTRIBUTION_ADMIN_V3", "attributed funnel marker");
requireText(adminRoutes, "action = 'marketing.signup_completed'", "tracked-account cohort");
requireText(adminRoutes, "unattributedAccounts", "pre-tracking account separation");
requireText(adminRoutes, "sourceBreakdown", "completed signup source breakdown");
requireText(adminPage, "Pre-tracking / unattributed accounts", "unattributed account notice");
requireText(adminPage, "Completed tracked signups by source", "signup source UI");
requireText(adminPage, "Older or untracked accounts are shown separately", "campaign-safe explanation");

console.log("Account-level signup attribution and pre-tracking separation verified.");
