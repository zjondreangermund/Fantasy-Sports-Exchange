#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "server/services/apiFootballSync.ts");
let source = fs.readFileSync(file, "utf8");
const before = 'async function finishRun(id: any, status: "success" | "failed" | "skipped", calls: number, records: number, message: string, details: any = {}) {';
const after = 'async function finishRun(id: any, status: "success" | "failed" | "skipped" | "partial", calls: number, records: number, message: string, details: any = {}) {';
if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
  console.log("Partial sync status type added.");
} else if (source.includes(after)) {
  console.log("Partial sync status type already present.");
} else {
  throw new Error("Could not locate API-Football finishRun status type");
}
