import fs from "node:fs";

// The site-integrity build patch upgrades desktop leaderboard portraits to the
// resilient TournamentPlayerImage component after prebuild. Keep its expected
// portrait anchor intact while retaining the rarity glow on the surrounding
// submitted-lineup row. Native and reusable entered-team portraits keep their
// direct rarity glow because they do not use this downstream replacement.
const path = "client/src/pages/competitions-vault.tsx";
let source = fs.readFileSync(path, "utf8");

const glowingPortrait = `<div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border bg-black/40 text-xs font-black text-white/50" style={{ borderColor: playerGlow.border, boxShadow: \`0 0 16px \${playerGlow.glow}\` }}>{player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : initials}</div>`;
const resilientAnchor = `<div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xs font-black text-white/50">{player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : initials}</div>`;

if (source.includes(glowingPortrait)) {
  source = source.replace(glowingPortrait, resilientAnchor);
  fs.writeFileSync(path, source);
  console.log("[lineup-rarity-glows] Preserved desktop resilient-player portrait anchor; rarity glow remains on the lineup row.");
} else if (source.includes(resilientAnchor) || source.includes("<TournamentPlayerImage player={player} />")) {
  console.log("[lineup-rarity-glows] Desktop resilient-player portrait anchor already compatible.");
} else {
  throw new Error("[lineup-rarity-glows] Could not preserve the desktop leaderboard portrait compatibility anchor");
}
