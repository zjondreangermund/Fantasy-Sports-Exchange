import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const accountPath = path.join(root, "client", "src", "pages", "account.tsx");
let source = fs.readFileSync(accountPath, "utf8");
let changed = false;

const layoutImport = 'import { LiveHero, LivePageShell, LiveStatCard } from "../components/layout/LivePageShell";';
const verificationImport = 'import ContactVerificationCard from "../components/profile/ContactVerificationCard";';
if (!source.includes(verificationImport)) {
  if (!source.includes(layoutImport)) throw new Error("Could not find account-page import anchor");
  source = source.replace(layoutImport, `${layoutImport}\n${verificationImport}`);
  changed = true;
}

const verificationCard = "                <ContactVerificationCard email={user?.email} />";
const referralAnchor = '                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">';
if (!source.includes(verificationCard)) {
  if (!source.includes(referralAnchor)) throw new Error("Could not find account-page verification insertion anchor");
  source = source.replace(referralAnchor, `${verificationCard}\n\n${referralAnchor}`);
  changed = true;
}

if (!source.includes(verificationImport) || !source.includes(verificationCard)) {
  throw new Error("Profile contact-verification UI was not applied correctly");
}

if (changed) fs.writeFileSync(accountPath, source);
console.log(`[profile] ${changed ? "Applied" : "Verified"} inactive email and cell-number verification UI`);

const legalPath = path.join(root, "client", "src", "pages", "legal-centre.tsx");
let legalSource = fs.readFileSync(legalPath, "utf8");
const oldCardDefinition = "Cards are licensed digital platform items used inside Fantasy Arena. They are not shares, securities, cryptocurrency or legal ownership of a football player.";
const currentCardDefinition = "Cards are licensed digital platform items used inside Fantasy Arena. They do not represent shares, securities or legal ownership of a football player.";
if (legalSource.includes(oldCardDefinition)) {
  legalSource = legalSource.replace(oldCardDefinition, currentCardDefinition);
  fs.writeFileSync(legalPath, legalSource);
  console.log("[copy] Updated user-facing digital player card wording");
}

await import("./prepare-guided-help-patch.mjs");
await import("./apply-guided-help-chat-auction-v2.mjs");

const competitionsPath = path.join(root, "client", "src", "pages", "competitions.tsx");
const landingPath = path.join(root, "client", "src", "pages", "landing.tsx");
const routesPath = path.join(root, "server", "routes.ts");
const competitionsSource = fs.readFileSync(competitionsPath, "utf8");
const landingSource = fs.readFileSync(landingPath, "utf8");
const routesSource = fs.readFileSync(routesPath, "utf8");
const freeCardCupsApplied = competitionsSource.includes('value="free"')
  && competitionsSource.includes("Free-to-play card reward")
  && landingSource.includes("data-free-card-cups")
  && routesSource.includes("isFreeCardCup");

if (!freeCardCupsApplied) {
  await import("./apply-free-card-cups.mjs");
} else {
  console.log("[free-card-cups] Verified free-to-play tournament patch already applied");
}
await import("./fix-free-card-cup-card-jsx.mjs");
