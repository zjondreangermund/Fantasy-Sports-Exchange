#!/usr/bin/env node
import fs from "node:fs";

const start = fs.readFileSync("start.sh", "utf8");
const wrapper = fs.readFileSync("scripts/run-normal-user-card-forensics.mjs", "utf8");

const required = [
  "node scripts/run-normal-user-card-forensics.mjs",
  "audit-and-recover-normal-user-cards.mjs",
  "audit-normal-user-cards-v2.mjs",
  "as evidence_count",
  "player_id",
  "serial_id",
  "serial_number",
];
for (const marker of required) {
  if (!(start + wrapper).includes(marker)) throw new Error(`Missing card-forensics safety marker: ${marker}`);
}
for (const forbidden of ["CARD_RECOVERY_APPLY=true", "update app.player_cards", "delete from app.player_cards"]) {
  if (wrapper.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`Read-only forensic wrapper contains forbidden mutation marker: ${forbidden}`);
}
console.log("Card-forensics startup wrapper verified as read-only and normal-user audit capable.");
