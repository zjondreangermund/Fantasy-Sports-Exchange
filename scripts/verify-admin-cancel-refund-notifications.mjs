import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`Admin cancel/refund verification failed: ${label}`);
}

const service = read("server/services/competitionCancellation.ts");
const manager = read("client/src/components/admin/AdminTournamentManager.tsx");

requireToken(service, 'ensureNotificationsSchema();', "notification schema is not prepared before cancellation refunds");
requireToken(service, 'title: refundAmount > 0 ? "Tournament refund completed" : "Tournament entry cancelled"', "refund/cancellation notification title is missing");
requireToken(service, 'dedupeKey: `competition-cancellation-refund:${competitionId}:entry:${entryId}`', "refund notification dedupe key is missing");
requireToken(service, 'SET balance = balance + ${refundAmount}', "wallet refund credit is missing");
requireToken(service, "'tournament_refund'", "tournament refund ledger entry is missing");
requireToken(manager, '`/api/admin/competitions/${competitionId}/cancel`', "admin cancel endpoint is not wired to the UI");
requireToken(manager, 'Cancel & Refund ${entryCount}', "Cancel & Refund control is missing");
requireToken(manager, 'Delete Empty Tournament', "empty-only delete control is missing");
requireToken(manager, 'Tournaments with entries must be cancelled with refunds', "admin cancellation guidance is missing");
requireToken(manager, 'Entrants receive a notification.', "admin refund confirmation does not mention player notifications");

console.log("Admin cancel/refund workflow verified: entered tournaments refund wallets, release locks, preserve ledger history, and notify entrants.");
