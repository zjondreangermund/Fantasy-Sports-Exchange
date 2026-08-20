import fs from "node:fs";

const file = "server/services/competitionCancellation.ts";
let source = fs.readFileSync(file, "utf8");
let changed = false;

const normalizedMarker = 'const refundNotificationMessage = refundAmount > 0';
const newBlock = `      const refundNotificationMessage = refundAmount > 0
        ? String(competition.name || "Tournament") + " was cancelled. N$" + refundAmount.toFixed(2) + " has been returned to your Fantasy Arena wallet."
        : String(competition.name || "Tournament") + " was cancelled. Your entry has been cancelled; there was no paid entry fee to refund.";
      await createNotificationOnce(tx, {
        userId,
        title: refundAmount > 0 ? "Tournament refund completed" : "Tournament entry cancelled",
        message: refundNotificationMessage,
        dedupeKey: "competition-cancellation-refund:" + competitionId + ":entry:" + entryId,
      });`;

if (!source.includes(normalizedMarker)) {
  const pattern = /      await createNotificationOnce\(tx, \{\n        userId,\n        title: refundAmount > 0 \? "Tournament refund completed" : "Tournament entry cancelled",[\s\S]*?\n      \}\);/;
  if (!pattern.test(source)) {
    throw new Error("Admin refund notification syntax fix could not locate the generated notification block");
  }
  source = source.replace(pattern, newBlock);
  changed = true;
}

if (!source.includes(normalizedMarker) || !source.includes('dedupeKey: "competition-cancellation-refund:" + competitionId + ":entry:" + entryId')) {
  throw new Error("Admin refund notification syntax fix could not verify the normalized notification block");
}

if (changed) fs.writeFileSync(file, source);
console.log(`[admin-refund-notification] ${changed ? "Normalized" : "Verified"} cancellation/refund notification source.`);
