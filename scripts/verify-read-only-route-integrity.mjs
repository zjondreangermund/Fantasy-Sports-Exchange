#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function filePath(file) {
  return path.join(root, file);
}

function read(file) {
  const target = filePath(file);
  if (!fs.existsSync(target)) {
    failures.push(`missing file: ${file}`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function requireAll(file, values, label = file) {
  const source = read(file);
  for (const value of values) {
    if (!source.includes(value)) failures.push(`${label} is missing: ${value}`);
  }
  return source;
}

function forbidAll(file, values, label = file) {
  const source = read(file);
  for (const value of values) {
    if (source.includes(value)) failures.push(`${label} still contains: ${value}`);
  }
}

const index = requireAll("server/index.ts", [
  "app.use(securityControlMiddleware);",
  "registerProductionResponseFilters(app);",
  "await registerRoutes(httpServer, app);",
], "server security registration");
if (index.indexOf("registerProductionResponseFilters(app);") > index.indexOf("await registerRoutes(httpServer, app);")) {
  failures.push("strict read-only middleware is registered after application routes");
}

requireAll("server/services/productionResponseFilter.ts", [
  "strictReadOnlyGuard",
  "registerDailyLoginRewardRoutes",
  "app.use(strictReadOnlyGuard);",
], "global preview route registration");

requireAll("server/services/readOnlyGuard.ts", [
  "getSecuritySettings(true)",
  "isReadOnlyPreviewRequest",
  "/api/login",
  "/api/onboarding/create-offer",
  "/api/onboarding/choose",
  "/api/rewards/daily-login/claim",
  "auth_paused",
  "read_only",
  "security_control_unavailable",
  "/marketplace",
  "/loan-market",
  "/auction",
  "/deposit",
  "/withdraw",
], "strict read-only preview guard");

requireAll("server/services/securityControl.ts", [
  "isReadOnlyPreviewMutation",
  "/api/onboarding/create-offer",
  "/api/onboarding/choose",
  "/api/rewards/daily-login/claim",
  "previewSignupsDuringReadOnly",
  "dailyLoginCommonCardCap",
], "base security preview policy");

requireAll("server/routes/dailyLoginReward.routes.ts", [
  "/api/rewards/daily-login",
  "/api/rewards/daily-login/claim",
  "claimDailyLoginReward",
  "getDailyLoginRewardStatus",
], "daily reward routes");

requireAll("server/services/dailyLoginReward.ts", [
  "DAILY_LOGIN_COMMON_CARD_CAP",
  "app.daily_login_rewards",
  "Africa/Windhoek",
  "reward.daily_login.claimed",
], "daily reward service");

requireAll("server/runtime-schema.ts", [
  "ensureDailyLoginRewardSchema",
  "await ensureDailyLoginRewardSchema();",
], "daily reward startup schema");

requireAll("server/routes/securityAdmin.routes.ts", [
  "/api/security/status",
  "/api/admin/security",
  "/api/admin/security/events/:id/resolve",
  "/api/admin/security/rate-limits/clear",
  "/api/admin/security/sessions/revoke-others",
], "security admin routes");

requireAll("client/src/components/admin/AdminSecurityPanel.tsx", [
  "/api/admin/security",
  "emergencyMutation",
  "updateEmergencySwitch",
  "setClientSecurityStatus",
], "persistent admin security controls");

requireAll("client/src/components/SecurityModeBanner.tsx", [
  "/api/security/status",
  "setClientSecurityStatus",
  "PREVIEW MODE",
], "preview banner");

requireAll("client/src/lib/security-mode.ts", [
  "isReadOnlyPreviewRequest",
  "/api/login",
  "/api/onboarding/create-offer",
  "/api/onboarding/choose",
  "/api/rewards/daily-login/claim",
], "client preview allowlist");

requireAll("client/src/lib/api-base.ts", [
  "shouldClientBlockRequest",
  "createReadOnlyResponse",
], "client mutation guard");

requireAll("client/src/components/dashboard/DailyLoginRewardPanel.tsx", [
  "/api/rewards/daily-login",
  "/api/rewards/daily-login/claim",
  "Daily common card collected",
], "daily reward panel");
requireAll("client/src/pages/dashboard.tsx", [
  "DailyLoginRewardPanel",
  "<DailyLoginRewardPanel />",
], "dashboard reward integration");

requireAll("client/src/pages/competitions-vault.tsx", [
  "Entry lock",
  "Settlement",
  "First PL kickoff",
  "FA Cup matches",
], "tournament timing presentation");
forbidAll("client/src/pages/competitions-vault.tsx", ["Tue–Tue", "Tue-Tue"], "tournament timing presentation");

requireAll("client/src/App.tsx", [
  '<Route path="/marketplace" component={MarketplacePage} />',
  '<Route path="/auctions" component={AuctionsPage} />',
  '<Route path="/competitions" component={CompetitionsPage} />',
  '<Route path="/admin" component={AdminDashboardRoute} />',
], "application page routes");

requireAll("server/routes.ts", [
  "registerMarketplaceRoutes(app, { requireAuth });",
  "registerAuctionsRoutes(app, { requireAuth });",
  "registerAdminRoutes(app, { requireAuth, isAdmin, isAdminUser: isAdminRequest });",
], "server route registration");
requireAll("server/routes/economyIntegrity.routes.ts", [
  "/api/admin/competitions/settle/:id",
], "tournament settlement route");
requireAll("client/src/components/admin/AdminTournamentManager.tsx", [
  "/api/admin/competitions/settle/",
  "Settle Tuesday Results",
], "tournament settlement link");

if (failures.length) {
  console.error("Preview launch integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview signup, daily reward, read-only enforcement and tournament timing contracts verified.");
