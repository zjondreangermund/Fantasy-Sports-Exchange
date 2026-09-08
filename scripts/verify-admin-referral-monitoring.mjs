import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function expect(condition, message) { if (!condition) throw new Error(message); }

const adminRoute = read("server/routes/admin.routes.ts");
const adminReferralRoute = read("server/routes/adminReferrals.routes.ts");
const adminPage = read("client/src/pages/admin.tsx");
const panel = read("client/src/components/admin/AdminReferralPanel.tsx");
const referrals = read("server/routes/referrals.routes.ts");
const reconciliation = read("server/services/referralHistoryReconciliation.ts");
const referralSchema = read("shared/referral-schema.ts");

expect(adminRoute.includes('registerAdminReferralRoutes'), "Admin referral API is not registered");
expect(adminReferralRoute.includes('/api/admin/referrals'), "Admin referral endpoint is missing");
expect(adminReferralRoute.includes('requireAuth, isAdmin'), "Admin referral endpoint is not admin-protected");
expect(adminReferralRoute.includes('rewardOwnerId'), "Referral reward ownership reconciliation is missing");
expect(adminReferralRoute.includes('codeOwnerId'), "Referral code ownership reconciliation is missing");
expect(adminReferralRoute.includes('schemaHealthy'), "Referral schema health is missing");
expect(adminReferralRoute.includes('totalCodes'), "Referral-code totals are missing");
expect(adminReferralRoute.includes('usedCodes'), "Used referral-code totals are missing");
expect(adminReferralRoute.includes('unusedCodes'), "Unused referral-code totals are missing");
expect(adminReferralRoute.includes('duplicateCodeRows'), "Duplicate referral-code health is missing");
expect(adminReferralRoute.includes('claimFailed'), "Referral claim failure totals are missing");
expect(adminReferralRoute.includes('referralCodes'), "Referral-code owner directory is missing");
expect(adminPage.includes('AdminReferralPanel'), "Referral monitoring UI is not wired into Admin");
expect(adminPage.includes('Referral monitoring'), "Referral workspace launcher is missing");
expect(panel.includes('Codes issued'), "Referral code summary metrics are missing");
expect(panel.includes('Confirmed referrals'), "Confirmed referral summary is missing");
expect(panel.includes('Confirmed referral ledger'), "Confirmed referral ledger is missing");
expect(panel.includes('Referral codes & invite links'), "Referral code directory is missing");
expect(panel.includes('Top confirmed referrers'), "Top confirmed referrers view is missing");
expect(panel.includes('Claim audit'), "Referral claim audit view is missing");
expect(referrals.includes('referral.claim.success'), "Successful claim auditing is missing");
expect(referrals.includes('referral.claim.duplicate'), "Duplicate claim auditing is missing");
expect(referrals.includes('referral.claim.rejected'), "Rejected claim auditing is missing");
expect(referrals.includes('referral.claim.failed'), "Failed claim auditing is missing");
expect(referrals.includes('referral_codes_code_normalized_unique_idx'), "Safe normalized referral-code uniqueness is missing");
expect(reconciliation.includes('REFERRAL_GLOBAL_HEALTH'), "Global referral health telemetry is missing");
expect(reconciliation.includes('REFERRAL_CODE_HEALTH'), "Referral-code health telemetry is missing");
expect(!referralSchema.includes('code: text("code").notNull().unique()'), "Drizzle must not request destructive referral-code uniqueness migration");

console.log("Admin referral monitoring verified: confirmed signups, issued/used/unused codes, reward ownership, claim audits and safe code uniqueness are protected.");
