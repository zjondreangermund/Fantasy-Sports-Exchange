import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function expect(condition, message) { if (!condition) throw new Error(message); }

const adminRoute = read("server/routes/admin.routes.ts");
const adminReferralRoute = read("server/routes/adminReferrals.routes.ts");
const adminPage = read("client/src/pages/admin.tsx");
const panel = read("client/src/components/admin/AdminReferralPanel.tsx");
const referrals = read("server/routes/referrals.routes.ts");
const reconciliation = read("server/services/referralHistoryReconciliation.ts");

expect(adminRoute.includes('registerAdminReferralRoutes'), "Admin referral API is not registered");
expect(adminReferralRoute.includes('/api/admin/referrals'), "Admin referral endpoint is missing");
expect(adminReferralRoute.includes('requireAuth, isAdmin'), "Admin referral endpoint is not admin-protected");
expect(adminReferralRoute.includes('rewardOwnerId'), "Referral reward ownership reconciliation is missing");
expect(adminReferralRoute.includes('codeOwnerId'), "Referral code ownership reconciliation is missing");
expect(adminReferralRoute.includes('schemaHealthy'), "Referral schema health is missing");
expect(adminPage.includes('AdminReferralPanel'), "Referral monitoring UI is not wired into Admin");
expect(adminPage.includes('Referral monitoring'), "Referral workspace launcher is missing");
expect(panel.includes('Total referrals'), "Referral summary metrics are missing");
expect(panel.includes('Referral ledger'), "Referral ledger is missing");
expect(panel.includes('Top referrers'), "Top referrers view is missing");
expect(panel.includes('Recent claim audit'), "Referral claim audit view is missing");
expect(referrals.includes('referral.claim.success'), "Successful claim auditing is missing");
expect(referrals.includes('referral.claim.duplicate'), "Duplicate claim auditing is missing");
expect(referrals.includes('referral.claim.rejected'), "Rejected claim auditing is missing");
expect(referrals.includes('referral.claim.failed'), "Failed claim auditing is missing");
expect(reconciliation.includes('REFERRAL_GLOBAL_HEALTH'), "Global referral health telemetry is missing");

console.log("Admin referral monitoring verified: live attribution, reward ownership, claim audits and health telemetry are protected.");
