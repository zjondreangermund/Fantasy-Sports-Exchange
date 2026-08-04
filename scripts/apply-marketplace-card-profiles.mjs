#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const originalBlob = "be424c09b7ff62c093b0a2f47d1b4c08ad56aeb2";
const original = execFileSync("git", ["cat-file", "blob", originalBlob], { encoding: "utf8" });
const broken = 'failures.forEach((failure) => console.error(`- ${failure}`));';
const repaired = 'failures.forEach((failure) => console.error("- " + failure));';
if (!original.includes(broken)) throw new Error("Marketplace profile migration source could not be repaired");
const runnable = original.replace(broken, repaired);
const target = path.join(process.cwd(), ".tmp-apply-marketplace-card-profiles.mjs");
fs.writeFileSync(target, runnable, "utf8");
try {
  await import(`${pathToFileURL(target).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(target, { force: true });
}
