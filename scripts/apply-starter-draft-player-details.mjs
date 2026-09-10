import fs from "node:fs";

const ONBOARDING = "client/src/pages/onboarding.tsx";
const RANDOMIZER = "scripts/apply-onboarding-starter-randomization.mjs";
const MARKER = "STARTER_DRAFT_PLAYER_DETAILS_V2";

function replaceAny(source, variants, replacement, label) {
  if (source.includes(replacement)) return source;
  for (const variant of variants) {
    if (source.includes(variant)) return source.replace(variant, replacement);
  }
  throw new Error(`[starter-player-details] anchor not found: ${label}`);
}

let source = fs.readFileSync(ONBOARDING, "utf8");

if (!source.includes(MARKER)) {
  const mobileMarker = "// STARTER_DRAFT_MOBILE_RENDERING_V1: stable native-size cards and explicit incomplete-selection CTA on mobile.\n";
  const detailsMarker = "// STARTER_DRAFT_PLAYER_DETAILS_V2: card artwork owns the player name; the label below shows current club and canonical position.\n";
  if (source.includes(mobileMarker)) {
    source = source.replace(mobileMarker, `${mobileMarker}${detailsMarker}`);
  } else {
    source = replaceAny(
      source,
      ['const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];\n'],
      'const defaultPackLabels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];\n' + detailsMarker,
      "marker",
    );
  }

  source = replaceAny(
    source,
    [
      '<CardThumbnail card={card} size="xs" selected={isSelected} selectable />',
      '<CardThumbnail card={card} size="xs" selected={isSelected} selectable showStats={false} showMeta={false} />',
    ],
    '<CardThumbnail card={card} size="xs" selected={isSelected} selectable showStats={false} showMeta={false} />',
    "selection card stats/meta",
  );

  source = replaceAny(
    source,
    [
      '                          <span className="mt-1 block w-full truncate px-1 text-[9px] font-black leading-tight text-white/85 sm:text-[10px]">{card.player?.name || "Player"}</span>',
      '                          <span className="mt-1 block h-6 w-full overflow-hidden px-1 text-[9px] font-black leading-3 text-white/85 sm:text-[10px]">{card.player?.name || "Player"}</span>',
    ],
    '                          <div className="mt-1.5 flex min-h-[48px] w-full flex-col items-center justify-start px-1 text-center">\n                            <span title={String(card.player?.team || "Premier League")} className="block max-h-[24px] w-full overflow-hidden text-center text-[9px] font-black uppercase leading-3 text-white/90 sm:text-[10px]">{card.player?.team || "Premier League"}</span>\n                            <span className="mt-1 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-cyan-100 sm:text-[9px]">{String(card.player?.position || "N/A").toUpperCase()}</span>\n                          </div>',
    "club/position block",
  );

  // The optional reveal step also uses the signup cards. Hide in-card game stats
  // while leaving CardThumbnail metadata enabled so club + position remain visible.
  source = source.replace(
    '<CardThumbnail key={card.id} card={card} size="xs" />',
    '<CardThumbnail key={card.id} card={card} size="xs" showStats={false} />',
  );

  fs.writeFileSync(ONBOARDING, source);
  console.log("[starter-player-details] Starter Draft now uses the card for player name and shows club + position below it.");
} else {
  console.log("[starter-player-details] Starter Draft team labels already ready.");
}

// Keep the signup source tied to the current Premier League/FPL data contract.
const randomizer = fs.readFileSync(RANDOMIZER, "utf8");
for (const required of [
  'const currentTeamIds = new Set<number>',
  'const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };',
  'return currentTeamIds.has(teamId) && Boolean(positionMap[elementType]);',
  'const teamName = String(teamMap.get(Number(fplPlayer.team))?.name || "Unknown");',
  'const position = positionMap[Number(fplPlayer.element_type)] || "MID";',
]) {
  if (!randomizer.includes(required)) throw new Error(`[starter-player-details] current Premier League/position guard missing: ${required}`);
}
