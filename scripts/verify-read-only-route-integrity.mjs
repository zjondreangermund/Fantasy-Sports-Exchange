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

const index = requireText("server/index.ts", [
  "app.use(securityControlMiddleware);",
  "registerProductionResponseFilters(app);",
  "await registerRoutes(httpServer, app);",
], "server security registration");

if (index.indexOf("registerProductionResponseFilters(app);") > index.indexOf("await registerRoutes(httpServer, app);")) {
  failures.push("strict read-only middleware is registered after application routes");
}

requireText("server/services/productionResponseFilter.ts", [
  'import { strictReadOnlyGuard } from "./readOnlyGuard.js"',
  "app.use(strictReadOnlyGuard);",
], "strict guard registration");

requireText("server/services/readOnlyGuard.ts", [
  "getSecuritySettings(true)",
  'path === "/api/admin/security"',
  'return "read_only"',
  'code: "security_control_unavailable"',
  '"/marketplace"',
  '"/loan-market"',
  '"/auction"',
  '"/deposit"',
  '"/withdraw"',
], "strict read-only guard");

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
  "VIEW-ONLY MODE",
], "view-only banner");

requireText("client/src/lib/api-base.ts", [
  "shouldClientBlockRequest",
  "createReadOnlyResponse",
], "client mutation guard");

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
  console.error("Read-only and route integrity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Read-only enforcement, persistent emergency controls, security links and tournament/marketplace/auction routes verified.");
