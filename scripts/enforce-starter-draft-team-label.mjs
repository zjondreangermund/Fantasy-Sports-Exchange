import fs from "node:fs";

const file = "client/src/pages/onboarding.tsx";
let source = fs.readFileSync(file, "utf8");

const duplicateNameVariants = [
  '                          <span className="mt-1 block w-full truncate px-1 text-[9px] font-black leading-tight text-white/85 sm:text-[10px]">{card.player?.name || "Player"}</span>',
  '                          <span className="mt-1 block h-6 w-full overflow-hidden px-1 text-[9px] font-black leading-3 text-white/85 sm:text-[10px]">{card.player?.name || "Player"}</span>',
];

const teamPositionBlock = '                          <div data-starter-player-club className="mt-1.5 flex min-h-[42px] w-full flex-col items-center justify-start px-1 text-center">\n                            <span title={String(card.player?.team || "Premier League")} className="block max-h-[24px] w-full overflow-hidden text-center text-[9px] font-black uppercase leading-3 text-white/90 sm:text-[10px]">{card.player?.team || "Premier League"}</span>\n                            <span className="mt-1 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-cyan-100 sm:text-[9px]">{String(card.player?.position || "N/A").toUpperCase()}</span>\n                          </div>';

const alreadyHasClubAndPosition =
  source.includes('{card.player?.team || "Premier League"}') &&
  source.includes('{String(card.player?.position || "N/A").toUpperCase()}');

if (!alreadyHasClubAndPosition) {
  let replaced = false;
  for (const duplicateName of duplicateNameVariants) {
    if (!source.includes(duplicateName)) continue;
    source = source.replace(duplicateName, teamPositionBlock);
    replaced = true;
    break;
  }
  if (!replaced) throw new Error("[starter-team-label] signup club/position block could not be established");
}

// The player's name belongs to the card artwork only. There must not be a second
// player-name text element directly below the compact Starter Draft card.
for (const duplicateName of duplicateNameVariants) {
  if (source.includes(duplicateName)) throw new Error("[starter-team-label] duplicate player name still present below Starter Draft card");
}

if (!source.includes('{card.player?.team || "Premier League"}')) {
  throw new Error("[starter-team-label] current club label missing below Starter Draft card");
}
if (!source.includes('{String(card.player?.position || "N/A").toUpperCase()}')) {
  throw new Error("[starter-team-label] canonical position label missing below Starter Draft card");
}

fs.writeFileSync(file, source);
console.log("[starter-team-label] Player name remains on card artwork only; current club + position show below.");
