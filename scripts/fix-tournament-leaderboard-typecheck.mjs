import fs from "node:fs";

const path = "client/src/pages/competitions-vault.tsx";
const source = fs.readFileSync(path, "utf8");
const untypedPattern = /leaderboard\??\.leaderboard\??\.map\(\(entry\)/g;
const typedPattern = /leaderboard\??\.leaderboard\??\.map\(\(entry:\s*TournamentLeaderboardEntry\)/g;

const matches = source.match(untypedPattern) || [];
const updated = source.replace(untypedPattern, (match) =>
  match.replace("(entry)", "(entry: TournamentLeaderboardEntry)"),
);
const remaining = updated.match(untypedPattern) || [];

if (remaining.length > 0) {
  throw new Error(`Tournament leaderboard still has ${remaining.length} untyped entry callback(s).`);
}

if (updated !== source) {
  fs.writeFileSync(path, updated);
  console.log(`Typed ${matches.length} generated tournament leaderboard entry callback(s).`);
} else if (typedPattern.test(source)) {
  console.log("Tournament leaderboard entry callbacks are already typed.");
} else {
  throw new Error("Tournament leaderboard typecheck anchor not found.");
}
