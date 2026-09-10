import fs from "node:fs";

const playPath = "client/src/components/native/NativePlayPage.tsx";
const shellPath = "client/src/components/native/NativeMobileShell.tsx";

let play = fs.readFileSync(playPath, "utf8");
let shell = fs.readFileSync(shellPath, "utf8");

// The public competition API exposes the *current prize item's key* for Prize
// Ladder tournaments, not the literal string "ladder". The older native helper
// therefore hid the Prizes button whenever a ladder already had prize metadata.
// Free card cups and creator cash tournaments remain excluded from Prize Vault.
const oldDetection = '  return prizeKey === "ladder" || (entryFee > 0 && !prizeKey);';
const newDetection = '  return entryFee > 0;';
if (play.includes(oldDetection)) {
  play = play.replace(oldDetection, newDetection);
} else if (!play.includes(newDetection)) {
  throw new Error("[native-prize-links] Prize Vault tournament detection anchor not found");
}

// Link every official paid Prize Ladder card to its exact rarity, gameweek and
// competition so users land on the prizes for the tournament they tapped.
const oldPrizeHref = 'href={`/prize-vault?rarity=${normalizeTournamentRarity(tournament.tier)}`}';
const newPrizeHref = 'href={`/prize-vault?rarity=${normalizeTournamentRarity(tournament.tier)}&gameWeek=${Number(tournament.gameWeek ?? tournament.game_week ?? 0)}&competitionId=${Number(tournament.id || 0)}`}';
if (play.includes(oldPrizeHref)) {
  play = play.replace(oldPrizeHref, newPrizeHref);
} else if (!play.includes(newPrizeHref)) {
  throw new Error("[native-prize-links] exact Prize Vault link anchor not found");
}

const oldPrizeLabel = '<Gift className="h-3.5 w-3.5" />Prize Vault</Link>';
const newPrizeLabel = '<Gift className="h-3.5 w-3.5" />Prizes</Link>';
if (play.includes(oldPrizeLabel)) {
  play = play.replace(oldPrizeLabel, newPrizeLabel);
} else if (!play.includes(newPrizeLabel)) {
  throw new Error("[native-prize-links] Prizes button label anchor not found");
}

// Use the full name in the primary dock. It wraps neatly onto two short lines
// instead of abbreviating the product area to only "Premier".
const oldPremierItem = '  { label: "Premier", href: "/premier-league", icon: Activity },';
const newPremierItem = '  { label: "Premier League", href: "/premier-league", icon: Activity },';
if (shell.includes(oldPremierItem)) {
  shell = shell.replace(oldPremierItem, newPremierItem);
} else if (!shell.includes(newPremierItem)) {
  throw new Error("[native-prize-links] Premier League primary nav anchor not found");
}

const oldNavLabel = '<span>{item.label}</span>';
const newNavLabel = '<span className={item.href === "/premier-league" ? "max-w-[3.7rem] text-center text-[8px] leading-[1.05]" : undefined}>{item.label}</span>';
if (shell.includes(oldNavLabel)) {
  shell = shell.replace(oldNavLabel, newNavLabel);
} else if (!shell.includes(newNavLabel)) {
  throw new Error("[native-prize-links] primary nav label renderer anchor not found");
}

fs.writeFileSync(playPath, play);
fs.writeFileSync(shellPath, shell);

if (!play.includes("&gameWeek=${Number(tournament.gameWeek ?? tournament.game_week ?? 0)}&competitionId=${Number(tournament.id || 0)}")) {
  throw new Error("[native-prize-links] exact tournament prize link verification failed");
}
if (!shell.includes('{ label: "Premier League", href: "/premier-league", icon: Activity }')) {
  throw new Error("[native-prize-links] full Premier League dock label verification failed");
}

console.log("[native-prize-links] Paid Prize Ladder cards now expose exact Prizes links; Premier League uses its full dock label.");
