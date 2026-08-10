#!/usr/bin/env node
import fs from "node:fs";

const patch = "scripts/apply-admin-readonly-bypass.mjs";
const verifier = "scripts/verify-read-only-route-integrity.mjs";
const control = "server/services/securityControl.ts";

const failures = [];
for (const file of [patch, verifier, control, "start.sh"]) {
  if (!fs.existsSync(file)) failures.push(`missing startup Read-only file: ${file}`);
}

if (!failures.length) {
  const start = fs.readFileSync("start.sh", "utf8");
  const patchIndex = start.indexOf("node scripts/apply-admin-readonly-bypass.mjs");
  const verifyIndex = start.indexOf("node scripts/verify-read-only-route-integrity.mjs");
  if (patchIndex < 0 || verifyIndex < 0 || patchIndex > verifyIndex) {
    failures.push("startup must apply the idempotent Admin Read-only bypass before integrity verification");
  }
}

if (failures.length) {
  console.error("Admin Read-only startup verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin Read-only startup ordering verified.");
