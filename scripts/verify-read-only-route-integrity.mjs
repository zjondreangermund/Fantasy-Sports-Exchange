#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireText(file, values, label = file) {
  const source = read(file);
  for (const value of values) {
    if (!source.includes(value)) failures.push(`${label} is missing: ${value}`);
  }
  return source;
}

function forbidText(file, values, label = file) {
  const source = read(file);
  for (const value of values) {
    if (source.includes(value)) failures.push(`${label} still contains forbidden text: ${value}`);
  }
}

const index = requireText("server/index.ts", [
  "app.use(securityControlMiddleware);",
  "registerProductionResponseFilters(app);",
  "await registerRoutes(httpServer, app);",
], "server security registration");

if (index.indexOf("registerProductionResponseFilters(app);") > index.indexOf("await registerRoutes(httpServer, app);")) {
  failures.push("strict read-only middleware is registered after application routes");
}

requireText("server/services/productionResponseFilter.ts", [
  'import { registerDailyLoginRewardRoutes } from "../routes/dailyLoginReward.routes.js"',
  'import { strictReadOnlyGuard } from "./readOnlyGuard.js"',
  "app.use(strictReadOnlyGuard);",
  "registerDailyLoginRewardRoutes(app);",
], "strict guard and preview reward registration");

requireText("server/services/readOnlyGuard.ts", [
  "getSecuritySettings(true)",
  'path === "/api/admin/security"',
  'return "read_only"',
  'return "auth_paused"',
  'code: "security_control_unavailable"',
  "isReadOnlyPreviewRequest",
  '"/api/onboarding/create-offer"',
  '"/api/onboarding/choose"',
  '"/api/rewards/daily-login/claim"',
  '"/marketplace"',
  '"/loan-market"',
  '"/auction"',
  '"/deposit"',
  '"/withdraw"',
], "strict read-only preview guard");

requireText("server/services/securityControl.ts", [
  "isReadOnlyPreviewMutation",
  '"/api/onboarding/create-offer"',
  '"/api/onboarding/choose"',
  '"/api/rewards/daily-login/claim"',
  "previewSignupsDuringReadOnly: true",
  "dailyLoginCommonCardCap: 20",
], "base security preview policy");

requireText("server/routes/dailyLoginReward.routes.ts", [
  'app.get("/api/rewards/daily-login"',
  'app.post("/api/rewards/daily-login/claim"',
  "claimDailyLoginReward",
  "getDailyLoginRewardStatus",
], "daily login reward routes");

requireText("server/services/dailyLoginReward.ts", [
  "DAILY_LOGIN_COMMON_CARD_CAP = 20",
  "CREATE TABLE IF NOT EXISTS app.daily_login_rewards",
  "daily_login_rewards_user_day_unique",
  "Africa/Windhoek",
  "reward.daily_login.claimed",
], "daily common-card reward integrity");

requireText("server/runtime-schema.ts", [
  'import { ensureDailyLoginRewardSchema } from "./services/dailyLoginReward.js"',
  "await ensureDailyLoginRewardSchema();",
], "daily reward startup schema");

requireText("server/routes/securityAdmin.routes.ts", [
  'app.get("/api/security/status"',
  'app.get("/api/admin/security"',
  'app.patch("/api/admin/security"',
  'app.post("/api/admin/security/events/:id/resolve"',
  'app.post("/api/admin/security/rate-limits/clear"',
  'app.post("/api/admin/security/sessions/revoke-others"',
], "security admin routes");

requireText("client/src/components/admin/AdminSecurityPanel.tsx", [
  '["/api/admin/security"]',
  'refetchOnMount: "always"',
  'const emergencyMutation = useMutation',
  'apiRequest("PATCH", "/api/admin/security"',
  'updateEmergencySwitch("readOnly"',
  'setClientSecurityStatus(settings.emergency)',
  'queryClient.invalidateQueries({ queryKey: PUBLIC_SECURITY_KEY })',
  "/api/admin/security/events/${eventId}/resolve",
  "/api/admin/security/rate-limits/clear",
  "/api/admin/security/sessions/revoke-others",
], "persistent security admin controls and links");

requireText("client/src/components/SecurityModeBanner.tsx", [
  '["/api/security/status"]',
  "setClientSecurityStatus(data)",
  "PREVIEW MODE",
  "New users may sign up",
], "preview-mode banner");

requireText("client/src/lib/security-mode.ts", [
  "isReadOnlyPreviewRequest",
  '"/api/onboarding/create-offer"',
  '"/api/onboarding/choose"',
  '"/api/rewards/daily-login/claim"',
], "client preview mutation allowlist");

requireText("client/src/lib/api-base.ts", [
  "shouldClientBlockRequest",
  "createReadOnlyResponse",
], "client mutation guard");

requireText("client/src/components/dashboard/DailyLoginRewardPanel.tsx", [
  '["/api/rewards/daily-login"]',
  'apiRequest("POST", "/api/rewards/daily-login/claim"',
  "Daily common card collected",
  "maximum of {cap} common cards",
], "daily reward dashboard panel");

requireText("client/src/pages/dashboard.tsx", [
  'import DailyLoginRewardPanel from "../components/dashboard/DailyLoginRewardPanel"',
  "<DailyLoginRewardPanel />",
], "dashboard reward integration");

requireText("client/src/pages/competitions-vault.tsx", [
  'label="Settlement" value="Tuesday"',
  'label="Entry lock"',
  'label="Settlement" value={dateLabel(settlementAt)}',
  "FA Cup matches and Premier League fixtures played after settlement are excluded",
], "tournament timing presentation");
forbidText("client/src/pages/competitions-vault.tsx", ["Tue–Tue", "Tue-Tue"], "tournament timing presentation");

requireText("client/src/App.tsx", [
  '<Route path="/marketplace" component={MarketplacePage} />',
  '<Route path="/auctions" component={AuctionsPage} />',
  '<Route path="/competitions" component={CompetitionsPage} />',
  '<Route path="/admin" component={AdminDashboardRoute} />',
], "application page routes");

requireText("server/routes.ts", [
  "registerMarketplaceRoutes(app, { requireAuth });",
  "registerAuctionsRoutes(app, { requireAuth });",
  "registerAdminRoutes(app, { requireAuth, isAdmin, isAdminUser: isAdminRequest });",
], "server route registration");

requireText("server/routes/economyIntegrity.routes.ts", [
  'app.post("/api/admin/competitions/settle/:id"',
], "tournament settlement route");

requireText("client/src/components/admin/AdminTournamentManager.tsx", [
  "/api/admin/competitions/settle/${competitionId}",
  "Settle Tuesday Results",
], "tournament settlement link");

if (failures.length) {
  console.error("Read-only preview and route integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview signup access, daily rewards, read-only enforcement and tournament timing routes verified.");
