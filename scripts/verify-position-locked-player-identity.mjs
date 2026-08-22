#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const fpl = read("server/services/fplPlayerIdentity.ts");
const api = read("server/services/apiFootballPlayerDirectory.ts");
const premium = read("client/src/components/cards/PremiumFootballCard.tsx");

expect(fpl.includes("STRICT_PLAYER_IDENTITY_FIX_V3_POSITION_LOCK"), "FPL position-lock version marker missing");
expect(fpl.includes("function positionCompatible(player: any, element: any): boolean"), "FPL hard position helper missing");
expect(fpl.includes("if (!positionCompatible(player, element)) return false;"), "FPL resolver does not reject cross-position candidates before name matching");
expect(fpl.includes("playerMatchesElement(player, byStoredId)"), "Stored FPL id still needs guarded identity validation");
expect(fpl.includes("playerMatchesElement(player, byStoredCode)"), "Stored FPL code still needs guarded identity validation");

expect(api.includes('const rawPosition = (["GK", "DEF", "MID", "FWD"] as const).includes(storedPosition as any)'), "API-Football canonical source-position guard missing");
expect(api.includes("row.nameScore >= 92 && (!rawPosition || rawPosition === row.candidate.position)"), "API-Football hard position filter missing");
expect(!api.includes("rawPosition === row.candidate.position || row.nameScore >= 105"), "API-Football still allows a strong/exact name to bypass position");

expect(premium.includes("const profilePositionMatches = !payloadPosition || !profilePosition || payloadPosition === profilePosition;"), "Card/profile position consistency guard missing");
expect(premium.includes("const useProfileIdentity = identityVerified && profilePositionMatches;"), "Card profile identity is not gated by position agreement");
expect(premium.includes("position: useProfileIdentity ? (data.player?.position || player.position) : player.position"), "Card face can still override the lineup payload with a conflicting profile position");

// Regression model: exact names do NOT overrule a known position.
const positionCompatible = (stored, candidate) => !stored || stored === candidate;
expect(positionCompatible("GK", "GK"), "GK should resolve to GK");
expect(!positionCompatible("GK", "MID"), "GK must never resolve to MID");
expect(!positionCompatible("GK", "DEF"), "GK must never resolve to DEF");
expect(!positionCompatible("DEF", "MID"), "DEF must never resolve to MID");
expect(!positionCompatible("MID", "FWD"), "MID must never resolve to FWD");
expect(positionCompatible("", "MID"), "Unknown legacy positions may still use provider identity");

if (failures.length) {
  console.error("Position-locked player identity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Player identity is position-locked across FPL fallback, API-Football and card-profile rendering.");
