import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const need = (source, token, message) => assert.ok(source.includes(token), message);

const transfer = read("server/services/playerTransferMonitoring.ts");
const app = read("client/src/App.tsx");
const dialog = read("client/src/components/MandatoryReplacementClaimDialog.tsx");
const economy = read("server/routes/economyIntegrity.routes.ts");
const competitions = read("client/src/pages/competitions-vault.tsx");
const admin = read("server/routes/admin.routes.ts");
const adminUi = read("client/src/components/admin/AdminTournamentManager.tsx");

need(transfer, "EPL_REPLACEMENT_SAME_POSITION_V1", "same-position replacement marker is missing");
need(transfer, 'source.position::text as "sourcePosition"', "replacement claims do not expose the departed player position");
need(transfer, 'and p.position::text=${sourcePosition}', "replacement candidates are not restricted to the same position");
need(transfer, "same ${prettyRarity} rarity", "departure notification does not explain same-rarity protection");
need(app, "<MandatoryReplacementClaimDialog />", "mandatory EPL replacement dialog is not mounted globally");
need(dialog, "onEscapeKeyDown={(event) => event.preventDefault()}", "replacement dialog can still be dismissed with Escape");
need(dialog, "onPointerDownOutside={(event) => event.preventDefault()}", "replacement dialog can still be dismissed by tapping outside");
need(dialog, "same <b>{rarity}</b> rarity", "replacement dialog does not clearly explain rarity protection");
need(dialog, "<b>{position}</b> card", "replacement dialog does not clearly explain position protection");

need(economy, "PRIZE_LADDER_UNDER_MINIMUM_CASH_FALLBACK_V1", "under-minimum Prize Ladder settlement fallback is missing");
need(economy, "const underMinimumCashFallback = prizeVault && !prizeAward && grossPool > 0", "fallback is not restricted to an official Prize Ladder with no unlocked reward");
need(economy, "? toMoney(grossPool * 0.8)", "winner is not allocated 80% of collected entry fees");
need(economy, "? toMoney(grossPool * 0.2)", "Fantasy Arena is not allocated the 20% platform share");
need(economy, "if (underMinimumCashFallback) payoutPercentages = [1]", "fallback is not winner-takes-all");
need(economy, "cashPayoutEnabled", "fallback cash is not wired through payout and replay verification");
need(economy, "Prize Ladder minimum entry threshold was not reached", "winner notification does not explain the fallback");
need(competitions, "PRIZE_LADDER_FALLBACK_DISCLOSURE_V1", "public tournament UI does not disclose the fallback");
need(competitions, "#1 receives 80%", "public tournament UI does not explain the 80/20 rule");

need(admin, "TOURNAMENT_BANK_RECONCILIATION_V1", "bank reconciliation contract is missing");
need(admin, "approvedDepositsGross", "admin finance does not reconcile approved external deposits");
need(admin, "paidWithdrawalsNet", "admin finance does not reconcile paid withdrawals");
need(admin, "walletLiability", "admin finance does not expose wallet liabilities");
need(admin, "minimumRequiredBankReserve", "admin finance does not calculate a minimum bank reserve");
need(admin, "reserveHeadroom", "admin finance does not show reserve headroom");
need(admin, "projectedWinnerCashFallback", "admin finance does not expose per-tournament fallback cash");
need(adminUi, "Bank &amp; reserve reconciliation", "admin UI does not show the bank reconciliation dashboard");
need(adminUi, "80% winner fallback", "admin UI does not identify under-minimum Prize Ladder fallback amounts");
need(adminUi, "Expected bank cash", "admin UI does not show expected bank cash");
need(adminUi, "Minimum reserve", "admin UI does not show required reserves");

console.log("EPL departure replacements verified: same rarity + same position, mandatory claim popup, under-minimum Prize Ladder 80/20 winner fallback, and bank/reserve tournament finance reconciliation are protected.");
