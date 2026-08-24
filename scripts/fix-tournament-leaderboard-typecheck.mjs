import fs from "node:fs";

const path = "client/src/pages/competitions-vault.tsx";
const source = fs.readFileSync(path, "utf8");
const from = "leaderboard.leaderboard.map((entry) => <button";
const to = "leaderboard.leaderboard.map((entry: TournamentLeaderboardEntry) => <button";

if (source.includes(to)) {
  console.log("Tournament leaderboard entry callback is already typed.");
} else if (source.includes(from)) {
  fs.writeFileSync(path, source.replace(from, to));
  console.log("Typed the generated tournament leaderboard entry callback.");
} else {
  throw new Error("Tournament leaderboard typecheck anchor not found.");
}
