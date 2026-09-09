import fs from "node:fs";

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    // The play-navigation prebuild patch may rewrite the initials line before
    // this script runs. Anchor the rarity tone to the stable expanded-card line
    // instead so desktop lineup glows survive the full production patch chain.
    if (label === "desktop player rarity tone") {
      const fallback = "                        const expanded = expandedCardId === Number(player.cardId);";
      const fallbackTo = `${fallback}\n                        const playerGlow = lineupGlow(player.rarity);`;
      if (source.includes(fallbackTo)) return source;
      if (source.includes(fallback)) return source.replace(fallback, fallbackTo);
    }
    throw new Error(`[lineup-rarity-glows] ${label} anchor not found`);
  }
  return source.replace(from, to);
}

function insertBeforeRequired(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[lineup-rarity-glows] ${label} anchor not found`);
  return source.replace(anchor, `${insertion}\n\n${anchor}`);
}

const desktopPath = "client/src/pages/competitions-vault.tsx";
let desktop = fs.readFileSync(desktopPath, "utf8");

desktop = insertBeforeRequired(
  desktop,
  "const slotDefinitions = [",
  `// LINEUP_RARITY_GLOW_V1\nconst lineupRarityGlow: Record<TournamentRarity, { accent: string; border: string; soft: string; glow: string }> = {\n  common: { accent: \"#e2e8f0\", border: \"rgba(226,232,240,.42)\", soft: \"rgba(226,232,240,.07)\", glow: \"rgba(226,232,240,.18)\" },\n  rare: { accent: \"#3b82f6\", border: \"rgba(59,130,246,.52)\", soft: \"rgba(59,130,246,.10)\", glow: \"rgba(59,130,246,.28)\" },\n  unique: { accent: \"#c084fc\", border: \"rgba(192,132,252,.55)\", soft: \"rgba(168,85,247,.11)\", glow: \"rgba(168,85,247,.30)\" },\n  epic: { accent: \"#fb3b4a\", border: \"rgba(251,59,74,.58)\", soft: \"rgba(244,63,94,.11)\", glow: \"rgba(244,63,94,.30)\" },\n  legendary: { accent: \"#fbbf24\", border: \"rgba(251,191,36,.62)\", soft: \"rgba(251,191,36,.11)\", glow: \"rgba(251,191,36,.32)\" },\n};\n\nfunction lineupGlow(value: unknown) {\n  return lineupRarityGlow[normalizeTournamentRarity(value)];\n}`,
  "LINEUP_RARITY_GLOW_V1",
  "desktop rarity glow helper",
);

desktop = replaceRequired(
  desktop,
  "  const accent = rarityTheme[tier(comp.tier)].accent;",
  "  const accent = rarityTheme[tier(comp.tier)].accent;\n  const leaderboardGlow = lineupGlow(comp.tier);",
  "desktop leaderboard glow setup",
);

desktop = replaceRequired(
  desktop,
  `                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">\n                        <div className="text-[10px] font-black uppercase tracking-[.17em] text-purple-300">Submitted lineup</div>`,
  `                      <div className="rounded-2xl border p-4" style={{ borderColor: leaderboardGlow.border, background: \`linear-gradient(135deg, \${leaderboardGlow.soft}, rgba(2,6,23,.76))\`, boxShadow: \`0 0 30px \${leaderboardGlow.glow}\` }}>\n                        <div className="text-[10px] font-black uppercase tracking-[.17em]" style={{ color: leaderboardGlow.accent }}>Submitted lineup · {String(tier(comp.tier)).toUpperCase()}</div>`,
  "desktop submitted-lineup header glow",
);

desktop = replaceRequired(
  desktop,
  `                        const initials = player.name.split(/\\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();`,
  `                        const initials = player.name.split(/\\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();\n                        const playerGlow = lineupGlow(player.rarity);`,
  "desktop player rarity tone",
);

desktop = replaceRequired(
  desktop,
  `                        return <div key={player.cardId} className={\`overflow-hidden rounded-2xl border \${expanded ? "border-purple-300/35 bg-purple-500/[.08]" : "border-white/10 bg-white/[.04]"}\`}>`,
  `                        return <div key={player.cardId} className="overflow-hidden rounded-2xl border transition-shadow" data-lineup-rarity={String(player.rarity || "common").toLowerCase()} style={{ borderColor: playerGlow.border, background: \`linear-gradient(135deg, \${playerGlow.soft}, rgba(2,6,23,.72))\`, boxShadow: \`0 0 \${expanded ? 32 : 20}px \${playerGlow.glow}\` }}>`,
  "desktop player row glow",
);

desktop = replaceRequired(
  desktop,
  `                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xs font-black text-white/50">{player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : initials}</div>`,
  `                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border bg-black/40 text-xs font-black text-white/50" style={{ borderColor: playerGlow.border, boxShadow: \`0 0 16px \${playerGlow.glow}\` }}>{player.imageUrl ? <img src={player.imageUrl} alt={player.name} className="h-full w-full object-contain object-top" /> : initials}</div>`,
  "desktop player portrait glow",
);

desktop = replaceRequired(
  desktop,
  `                            <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-white">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</div><div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{player.position} • {player.team} • {player.minutes} min</div></div>`,
  `                            <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-white">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</div><div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{player.position} • {player.team} • {player.minutes} min • <span style={{ color: playerGlow.accent }}>{String(player.rarity || "common").toUpperCase()}</span></div></div>`,
  "desktop player rarity label",
);

fs.writeFileSync(desktopPath, desktop);

const nativePath = "client/src/components/native/NativeTournamentLeaderboard.tsx";
let native = fs.readFileSync(nativePath, "utf8");

native = insertBeforeRequired(
  native,
  "function scoreLabel(value: unknown) {",
  `// LINEUP_PLAYER_RARITY_GLOW_V1\nconst playerGlowByRarity: Record<TournamentRarity, { accent: string; border: string; soft: string; glow: string }> = {\n  common: { accent: \"#e2e8f0\", border: \"rgba(226,232,240,.42)\", soft: \"rgba(226,232,240,.07)\", glow: \"rgba(226,232,240,.18)\" },\n  rare: { accent: \"#3b82f6\", border: \"rgba(59,130,246,.52)\", soft: \"rgba(59,130,246,.10)\", glow: \"rgba(59,130,246,.28)\" },\n  unique: { accent: \"#c084fc\", border: \"rgba(192,132,252,.55)\", soft: \"rgba(168,85,247,.11)\", glow: \"rgba(168,85,247,.30)\" },\n  epic: { accent: \"#fb3b4a\", border: \"rgba(251,59,74,.58)\", soft: \"rgba(244,63,94,.11)\", glow: \"rgba(244,63,94,.30)\" },\n  legendary: { accent: \"#fbbf24\", border: \"rgba(251,191,36,.62)\", soft: \"rgba(251,191,36,.11)\", glow: \"rgba(251,191,36,.32)\" },\n};`,
  "LINEUP_PLAYER_RARITY_GLOW_V1",
  "native player rarity glow helper",
);

native = replaceRequired(
  native,
  `                  const expanded = Number(expandedCardId || 0) === Number(player.cardId);`,
  `                  const expanded = Number(expandedCardId || 0) === Number(player.cardId);\n                  const playerGlow = playerGlowByRarity[normalizeTournamentRarity(player.rarity)];`,
  "native player rarity tone",
);

native = replaceRequired(
  native,
  `                    <div key={player.cardId} className={\`overflow-hidden rounded-2xl border \${expanded ? \`\${tone.border} \${tone.soft}\` : "border-white/[.08] bg-white/[.03]"}\`}>`,
  `                    <div key={player.cardId} className="overflow-hidden rounded-2xl border transition-shadow" data-lineup-rarity={String(player.rarity || "common").toLowerCase()} style={{ borderColor: playerGlow.border, background: \`linear-gradient(135deg, \${playerGlow.soft}, rgba(2,6,23,.74))\`, boxShadow: \`0 0 \${expanded ? 30 : 18}px \${playerGlow.glow}\` }}>`,
  "native player row glow",
);

native = replaceRequired(
  native,
  `                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 text-xs font-black text-white/45">`,
  `                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border bg-black/40 text-xs font-black text-white/45" style={{ borderColor: playerGlow.border, boxShadow: \`0 0 15px \${playerGlow.glow}\` }}>`,
  "native player portrait glow",
);

native = replaceRequired(
  native,
  `                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</p><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[.09em] text-white/35">{player.position} · {player.team} · {player.minutes || 0} min</p></div>`,
  `                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</p><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[.09em] text-white/35">{player.position} · {player.team} · {player.minutes || 0} min · <span style={{ color: playerGlow.accent }}>{String(player.rarity || "common").toUpperCase()}</span></p></div>`,
  "native player rarity label",
);

fs.writeFileSync(nativePath, native);

const teamCardPath = "client/src/components/tournaments/TournamentEntryTeamCard.tsx";
let teamCard = fs.readFileSync(teamCardPath, "utf8");

teamCard = replaceRequired(
  teamCard,
  `            : players.length ? players.map((player) => <div key={player.cardId} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[.07] bg-black/25 p-2">`,
  `            : players.length ? players.map((player) => {\n              const playerTheme = tone[rarityOf(player.rarity)];\n              return <div key={player.cardId} className="flex min-w-0 items-center gap-2 rounded-xl border p-2" data-lineup-rarity={rarityOf(player.rarity)} style={{ borderColor: playerTheme.border, background: \`linear-gradient(135deg, \${playerTheme.soft}, rgba(2,6,23,.72))\`, boxShadow: \`0 0 16px \${playerTheme.glow}\` }}>`,
  "entered-team player row glow",
);

teamCard = replaceRequired(
  teamCard,
  `              <div className="grid h-11 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900 text-[9px] font-black text-slate-500">`,
  `              <div className="grid h-11 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-slate-900 text-[9px] font-black text-slate-500" style={{ borderColor: playerTheme.border, boxShadow: \`0 0 12px \${playerTheme.glow}\` }}>`,
  "entered-team portrait glow",
);

teamCard = replaceRequired(
  teamCard,
  `                <p className="truncate text-[8px] font-bold uppercase tracking-[.09em] text-slate-500">{player.position} · {player.team}</p>`,
  `                <p className="truncate text-[8px] font-bold uppercase tracking-[.09em] text-slate-500">{player.position} · {player.team} · <span style={{ color: playerTheme.accent }}>{rarityOf(player.rarity).toUpperCase()}</span></p>`,
  "entered-team rarity label",
);

teamCard = replaceRequired(
  teamCard,
  `            </div>) : <div className="col-span-full rounded-xl border border-dashed border-white/[.08] p-3 text-center text-xs text-slate-500">No submitted cards are available for this entry yet.</div>}`,
  `            </div>; }) : <div className="col-span-full rounded-xl border border-dashed border-white/[.08] p-3 text-center text-xs text-slate-500">No submitted cards are available for this entry yet.</div>}`,
  "entered-team player map close",
);

fs.writeFileSync(teamCardPath, teamCard);

console.log("[lineup-rarity-glows] Tournament submitted lineups now use Common silver, Rare blue, Unique purple, Epic red and Legendary gold glows on desktop, native leaderboard and entered-team cards.");
