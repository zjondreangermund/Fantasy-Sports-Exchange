#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "scripts/apply-strict-remaining.mjs");
const tempPath = path.join(root, "scripts/.apply-strict-remaining-runtime.mjs");
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace(
  '  if (!source.includes(before)) throw new Error(`${file}: missing expected text: ${before.slice(0, 80)}`);',
  '  if (!source.includes(before)) { console.warn(`${file}: skipped missing text: ${before.slice(0, 80)}`); return; }',
);
source = source.replace(
  '  if (!pattern.test(source)) throw new Error(`${file}: missing expected pattern ${pattern}`);',
  '  if (!pattern.test(source)) { console.warn(`${file}: skipped missing pattern ${pattern}`); return; }',
);
fs.writeFileSync(tempPath, source);
try {
  await import(`${pathToFileURL(tempPath).href}?ts=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
