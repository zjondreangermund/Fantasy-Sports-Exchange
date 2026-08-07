import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "client", "src", "pages", "competitions.tsx");
let source = fs.readFileSync(file, "utf8");

const oldHero = '<LiveHero eyebrow="Fantasy Arena" title="Tournament Arena" description="Start with FREE Card Cups to win player cards, or enter paid Prize Tournaments for cash and Prize Vault rewards. Entries lock at the first Premier League kickoff." />';
const newHero = '<LiveHero eyebrow="Fantasy Arena" title="Tournament Arena" description="Start with FREE Card Cups to win player cards, or enter paid Prize Tournaments for cash and Prize Vault rewards. Entries lock at the first Premier League kickoff. Scores freeze Tuesday 23:59 CAT; FA Cup matches and later rescheduled fixtures do not count." />';

if (source.includes(oldHero)) {
  source = source.replace(oldHero, newHero);
  fs.writeFileSync(file, source);
  console.log("[free-card-cups] Restored official tournament scoring and settlement copy");
} else if (source.includes("Tuesday 23:59 CAT") && source.includes("later rescheduled fixtures")) {
  console.log("[free-card-cups] Verified official scoring schedule copy");
} else {
  throw new Error("Free Card Cup tournament hero scoring copy anchor not found");
}
