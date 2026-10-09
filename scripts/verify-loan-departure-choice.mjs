import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const need = (source, token, message) => assert.ok(source.includes(token), message);
const reject = (source, token, message) => assert.ok(!source.includes(token), message);

const policy = read("server/services/loanDeparturePolicy.ts");
const loans = read("server/routes/loanMarket.routes.ts");
const transfers = read("server/services/playerTransferMonitoring.ts");
const ownedPolicy = read("server/services/departedCardPolicy.ts");
const notifications = read("server/routes/notifications.routes.ts");
const notificationClient = read("client/src/lib/notifications.ts");
const floating = read("client/src/components/FloatingEventNotifications.tsx");
const nativeClub = read("client/src/components/native/NativeClubPage.tsx");
const nativeTrade = read("client/src/components/native/NativeCardTradeSheet.tsx");
const accountGenerator = read("scripts/apply-player-transfer-notifications.mjs");
const nativeTradingGenerator = read("scripts/apply-native-trading-integrity.mjs");
const webPush = read("server/services/webPush.ts");
const nativePush = read("server/services/nativePush.ts");

need(policy, "departure_decision text", "Active loan departure decision storage is missing.");
need(policy, "departure_replacement_card_id integer references app.player_cards(id)", "Temporary loan replacement link is missing.");
need(policy, "loan-departure-choice:${loanId}", "Borrower departure-choice notification is missing.");
need(policy, "keep the loan card and wait for the player to return", "Borrower notification does not offer the keep-until-return option.");
need(policy, "same position and rarity for the remaining loan period", "Borrower notification does not explain the protected replacement.");
need(policy, "The temporary replacement does not become a permanent card", "Temporary loan replacement ownership is not explained.");
need(policy, 'decision: "keep" | "replace"', "Loan departure action does not expose both borrower choices.");
need(policy, "p.position::text=${position}", "Temporary replacement is not restricted to the same football position.");
need(policy, "owned.rarity::text=${rarity}", "Temporary replacement does not preserve rarity ownership rules.");
need(policy, "p.fpl_id = any(${fplArray}::int[])", "Temporary replacement is not restricted to the current FPL roster.");
need(policy, "ids.length < 300", "Temporary replacement must fail safely when the current Premier League roster is incomplete.");
need(policy, "departure_source_returned_at", "Original lender card return state is missing.");
need(policy, "loan-player-returned:${loanId}", "Keep-until-return path does not notify the borrower when the player returns.");
need(policy, "loan-replacement:${loanId}", "Temporary replacement lock marker is missing.");
need(policy, "'transfer_pending'", "Temporary replacement must be transfer-locked for the loan period.");
need(policy, "now(), null", "Temporary replacement lock must stay active until the loan is explicitly settled.");
need(policy, "reusable.owner_id is null", "Temporary replacements should reuse safe unowned supply when available.");
need(policy, "clearUnmintedOwnedReplacementClaim", "Loan departures do not clear stale permanent replacement claims for borrowers.");

need(loans, 'app.post("/api/marketplace/loans/:loanId/departure-choice"', "Borrower choice endpoint is missing.");
need(loans, "chooseLoanDepartureAction", "Loan departure endpoint is not wired to policy logic.");
need(loans, "departure_replacement_card_id", "Loan expiry does not track a temporary replacement.");
need(loans, "temporaryReplacementCardId", "Loan expiry audit does not record temporary replacement retirement.");
need(loans, "owner_id = null, for_sale = false, price = 0", "Temporary replacement is not retired at loan expiry.");
need(loans, "loan-replacement:${Number(loan.id)}", "Expired temporary replacement lock is not released.");
need(loans, "A temporary loan replacement cannot be sold, loaned or transferred", "Direct loan listing does not block temporary replacements.");

need(transfers, "active_loan.status='active'", "Permanent EPL departure claim creation does not exclude active borrowed cards.");
need(transfers, "This is an active loan card", "Active-loan replacement guard is missing from permanent claim flow.");
need(transfers, "syncActiveLoanDepartureChoices", "Transfer detection does not trigger loan departure notifications.");

need(ownedPolicy, "active_loan.borrower_user_id=pc.owner_id", "Owned-card 14-day policy can still create claims for active borrowed cards.");
need(ownedPolicy, "active_loan.borrower_user_id=pr.user_id", "Owned-card automatic replacement sweep can still act on active loan cards.");
need(ownedPolicy, "ensureLoanPaymentSchema", "Owned departure policy does not guarantee the loan schema exists.");

need(notifications, "loanDepartureId", "Notification API does not expose the loan choice ID.");
need(notifications, "loanDepartureDecision", "Notification API does not expose the current loan decision.");
need(notifications, "loanDepartureRarity", "Notification API does not expose replacement rarity.");
need(notifications, "loanDeparturePosition", "Notification API does not expose replacement position.");
need(notifications, "syncActiveLoanDepartureChoices(userId)", "Opening Inbox does not refresh loan departure choices.");

need(notificationClient, 'replacementKey.startsWith("loan-departure-choice:")', "Loan departure notification does not open Inbox.");
need(floating, "Choose loan option", "Floating notification does not surface the borrower choice.");
need(floating, "loan-departure-choice:", "Floating notification does not recognize loan departure alerts.");

need(nativeClub, "Keep until return", "Native Inbox is missing the keep-until-return action.");
need(nativeClub, "Mint replacement", "Native Inbox is missing the temporary replacement action.");
need(nativeClub, "loanDepartureMutation", "Native Inbox does not submit the borrower decision.");
need(nativeTrade, "Temporary loan replacement", "Native card tools do not label temporary replacement cards.");
need(nativeTrade, "loanContainsCard", "Native trading tools do not bind the temporary card to its active loan.");

need(accountGenerator, "Keep until return", "Full Inbox generator is missing the keep-until-return action.");
need(accountGenerator, "Mint temporary replacement", "Full Inbox generator is missing the temporary replacement action.");
need(accountGenerator, "loanDepartureMutation", "Full Inbox generator does not submit loan departure choices.");
need(nativeTradingGenerator, "departure_replacement_card_id", "Generated server trading guards do not protect temporary loan replacements.");

need(webPush, 'key.startsWith("loan-departure-choice:")', "Web Push does not deep-link loan choices to Inbox.");
need(nativePush, 'key.startsWith("loan-departure-choice:")', "Native Push does not deep-link loan choices to Inbox.");

reject(policy, "auto-mint", "Active loan departure choices must not auto-mint without the borrower choosing replacement.");

console.log("Loan departure choice verified: active borrowers are notified, may keep the player until a Premier League return or mint a temporary same-position/same-rarity current-PL replacement, and temporary cards remain protected and retire at loan expiry.");
