import fs from "node:fs";

function patchFile(path, transform) {
  const source = fs.readFileSync(path, "utf8");
  const next = transform(source);
  if (next !== source) fs.writeFileSync(path, next);
}

function replaceOnce(source, from, to, marker, label) {
  if (marker && source.includes(marker)) return source;
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[lineup-rarity-glows-v2] ${label} anchor not found`);
  return source.replace(from, to);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[lineup-rarity-glows-v2] ${label} anchor not found`);
  return source.replace(anchor, `${insertion}\n\n${anchor}`);
}

patchFile("client/src/pages/competitions-vault.tsx", (original) => {
  let source = original;
  source = insertBefore(
    source,
    "const slotDefinitions = [",
    `// LINEUP_RARITY_GLOW_V2\nconst lineupRarityGlowV2: Record<TournamentRarity, { accent: string; border: string; soft: string; glow: string }> = {\n  common: { accent: \"#e2e8f0\", border: \"rgba(226,232,240,.48)\", soft: \"rgba(226,232,240,.07)\", glow: \"rgba(226,232,240,.20)\" },\n  rare: { accent: \"#3b82f6\", border: \"rgba(59,130,246,.58)\", soft: \"rgba(59,130,246,.10)\", glow: \"rgba(59,130,246,.30)\" },\n  unique: { accent: \"#c084fc\", border: \"rgba(192,132,252,.60)\", soft: \"rgba(168,85,247,.11)\", glow: \"rgba(168,85,247,.32)\" },\n  epic: { accent: \"#fb3b4a\", border: \"rgba(251,59,74,.62)\", soft: \"rgba(244,63,94,.11)\", glow: \"rgba(244,63,94,.33)\" },\n  legendary: { accent: \"#fbbf24\", border: \"rgba(251,191,36,.66)\", soft: \"rgba(251,191,36,.11)\", glow: \"rgba(251,191,36,.35)\" },\n};\n\nfunction lineupGlowV2(value: unknown) {\n  return lineupRarityGlowV2[normalizeTournamentRarity(value)];\n}`,
    "LINEUP_RARITY_GLOW_V2",
    "desktop glow helper",
  );

  source = replaceOnce(
    source,
    "  const accent = rarityTheme[tier(comp.tier)].accent;",
    "  const accent = rarityTheme[tier(comp.tier)].accent;\n  const leaderboardGlowV2 = lineupGlowV2(comp.tier);",
    "leaderboardGlowV2",
    "desktop leaderboard tone",
  );

  source = replaceOnce(
    source,
    `                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">\n                        <div className="text-[10px] font-black uppercase tracking-[.17em] text-purple-300">Submitted lineup</div>`,
    `                      <div className="rounded-2xl border p-4" data-lineup-summary-rarity={String(tier(comp.tier))} style={{ borderColor: leaderboardGlowV2.border, background: \`linear-gradient(135deg, \${leaderboardGlowV2.soft}, rgba(2,6,23,.78))\`, boxShadow: \`0 0 30px \${leaderboardGlowV2.glow}\` }}>\n                        <div className="text-[10px] font-black uppercase tracking-[.17em]" style={{ color: leaderboardGlowV2.accent }}>Submitted lineup · {String(tier(comp.tier)).toUpperCase()}</div>`,
    "data-lineup-summary-rarity",
    "desktop submitted-lineup summary glow",
  );

  source = replaceOnce(
    source,
    `                        return <div key={player.cardId} className={\`overflow-hidden rounded-2xl border \${expanded ? "border-purple-300/35 bg-purple-500/[.08]" : "border-white/10 bg-white/[.04]"}\`}>`,
    `                        return <div key={player.cardId} className="overflow-hidden rounded-2xl border transition-shadow" data-lineup-rarity={String(player.rarity || "common").toLowerCase()} style={{ borderColor: lineupGlowV2(player.rarity).border, background: \`linear-gradient(135deg, \${lineupGlowV2(player.rarity).soft}, rgba(2,6,23,.74))\`, boxShadow: \`0 0 \${expanded ? 32 : 20}px \${lineupGlowV2(player.rarity).glow}\` }}>`,
    "data-lineup-rarity={String(player.rarity",
    "desktop player row glow",
  );

  source = replaceOnce(
    source,
    `                            <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-white">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</div><div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{player.position} • {player.team} • {player.minutes} min</div></div>`,
    `                            <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-white">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</div><div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.12em] text-white/45">{player.position} • {player.team} • {player.minutes} min • <span style={{ color: lineupGlowV2(player.rarity).accent }}>{String(player.rarity || "common").toUpperCase()}</span></div></div>`,
    "lineupGlowV2(player.rarity).accent",
    "desktop rarity label",
  );
  return source;
});

patchFile("client/src/components/native/NativeTournamentLeaderboard.tsx", (original) => {
  let source = original;
  source = insertBefore(
    source,
    "function scoreLabel(value: unknown) {",
    `// NATIVE_LINEUP_RARITY_GLOW_V2\nconst nativeLineupGlowV2: Record<TournamentRarity, { accent: string; border: string; soft: string; glow: string }> = {\n  common: { accent: \"#e2e8f0\", border: \"rgba(226,232,240,.48)\", soft: \"rgba(226,232,240,.07)\", glow: \"rgba(226,232,240,.20)\" },\n  rare: { accent: \"#3b82f6\", border: \"rgba(59,130,246,.58)\", soft: \"rgba(59,130,246,.10)\", glow: \"rgba(59,130,246,.30)\" },\n  unique: { accent: \"#c084fc\", border: \"rgba(192,132,252,.60)\", soft: \"rgba(168,85,247,.11)\", glow: \"rgba(168,85,247,.32)\" },\n  epic: { accent: \"#fb3b4a\", border: \"rgba(251,59,74,.62)\", soft: \"rgba(244,63,94,.11)\", glow: \"rgba(244,63,94,.33)\" },\n  legendary: { accent: \"#fbbf24\", border: \"rgba(251,191,36,.66)\", soft: \"rgba(251,191,36,.11)\", glow: \"rgba(251,191,36,.35)\" },\n};\n\nfunction nativePlayerGlowV2(value: unknown) {\n  return nativeLineupGlowV2[normalizeTournamentRarity(value)];\n}`,
    "NATIVE_LINEUP_RARITY_GLOW_V2",
    "native glow helper",
  );

  source = replaceOnce(
    source,
    `                    <div key={player.cardId} className={\`overflow-hidden rounded-2xl border \${expanded ? \`\${tone.border} \${tone.soft}\` : "border-white/[.08] bg-white/[.03]"}\`}>`,
    `                    <div key={player.cardId} className="overflow-hidden rounded-2xl border transition-shadow" data-lineup-rarity={String(player.rarity || "common").toLowerCase()} style={{ borderColor: nativePlayerGlowV2(player.rarity).border, background: \`linear-gradient(135deg, \${nativePlayerGlowV2(player.rarity).soft}, rgba(2,6,23,.74))\`, boxShadow: \`0 0 \${expanded ? 30 : 18}px \${nativePlayerGlowV2(player.rarity).glow}\` }}>`,
    "nativePlayerGlowV2(player.rarity).border",
    "native player row glow",
  );

  source = replaceOnce(
    source,
    `                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</p><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[.09em] text-white/35">{player.position} · {player.team} · {player.minutes || 0} min</p></div>`,
    `                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{player.name}{player.captain ? <Crown className="ml-1 inline h-3.5 w-3.5 text-amber-300" /> : null}</p><p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[.09em] text-white/35">{player.position} · {player.team} · {player.minutes || 0} min · <span style={{ color: nativePlayerGlowV2(player.rarity).accent }}>{String(player.rarity || "common").toUpperCase()}</span></p></div>`,
    "nativePlayerGlowV2(player.rarity).accent",
    "native rarity label",
  );
  return source;
});

patchFile("client/src/components/tournaments/TournamentEntryTeamCard.tsx", (original) => {
  let source = original;
  source = replaceOnce(
    source,
    `            : players.length ? players.map((player) => <div key={player.cardId} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[.07] bg-black/25 p-2">`,
    `            : players.length ? players.map((player) => <div key={player.cardId} className="flex min-w-0 items-center gap-2 rounded-xl border p-2" data-lineup-rarity={rarityOf(player.rarity)} style={{ borderColor: tone[rarityOf(player.rarity)].border, background: \`linear-gradient(135deg, \${tone[rarityOf(player.rarity)].soft}, rgba(2,6,23,.72))\`, boxShadow: \`0 0 16px \${tone[rarityOf(player.rarity)].glow}\` }}>`,
    "data-lineup-rarity={rarityOf(player.rarity)}",
    "entered-team player row glow",
  );

  source = replaceOnce(
    source,
    `                <p className="truncate text-[8px] font-bold uppercase tracking-[.09em] text-slate-500">{player.position} · {player.team}</p>`,
    `                <p className="truncate text-[8px] font-bold uppercase tracking-[.09em] text-slate-500">{player.position} · {player.team} · <span style={{ color: tone[rarityOf(player.rarity)].accent }}>{rarityOf(player.rarity).toUpperCase()}</span></p>`,
    "tone[rarityOf(player.rarity)].accent",
    "entered-team rarity label",
  );
  return source;
});

console.log("[lineup-rarity-glows-v2] Submitted tournament lineups glow by card rarity: Common silver, Rare blue, Unique purple, Epic red and Legendary gold.");
