import fs from "node:fs";

const competitionPath = "client/src/pages/competitions-vault.tsx";
const nativePlayPath = "client/src/components/native/NativePlayPage.tsx";
const nativeMarketPath = "client/src/components/native/NativeMarketPage.tsx";
const marketplacePath = "client/src/pages/marketplace-v2.tsx";
const legalPath = "client/src/pages/legal-centre.tsx";

function replaceRequired(source, from, to, label) {
  if (label.startsWith("native marketplace") && source.includes("NATIVE_MARKET_BUY_LOAN_V2")) return source;
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[rarity-entry] ${label} could not be located`);
  return source.replace(from, to);
}

function insertAfterRequired(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[rarity-entry] ${label} could not be located`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

// Full tournament builder: never offer a lower-rarity card when choosing it
// would make the published five-card rarity composition impossible to finish.
let competitions = fs.readFileSync(competitionPath, "utf8");
competitions = replaceRequired(
  competitions,
  "  normalizeTournamentRarity,\n  validateTournamentRarityLineup,",
  "  normalizeTournamentRarity,\n  validatePartialTournamentRarityLineup,\n  validateTournamentRarityLineup,",
  "full tournament partial-rarity import",
);
competitions = replaceRequired(
  competitions,
  '    else if (!isCardRarityAllowedInTournament(card.rarity, selectedTier)) reason = `Unavailable: ${String(card.rarity).toUpperCase()} rarity is not allowed in this ${selectedTier.toUpperCase()} tournament.`;\n    else if (!isCurrentPremierLeagueCard(card)) reason = playerEligibilityMessage(card) || "Unavailable: this player is not linked to a current Premier League squad by API-Football or the FPL fallback.";',
  '    else if (!isCardRarityAllowedInTournament(card.rarity, selectedTier)) reason = `Unavailable: ${String(card.rarity).toUpperCase()} rarity is not allowed in this ${selectedTier.toUpperCase()} tournament.`;\n    else if (!validatePartialTournamentRarityLineup(\n      selectedCards.map((selectedCard, index) => index === activeSlot ? card : selectedCard).filter(Boolean).map((selectedCard) => selectedCard!.rarity),\n      selectedTier,\n    ).valid) reason = `Unavailable: selecting this card would break the ${selectedRequirement.shortLabel} rarity rule.`;\n    else if (!isCurrentPremierLeagueCard(card)) reason = playerEligibilityMessage(card) || "Unavailable: this player is not linked to a current Premier League squad by API-Football or the FPL fallback.";',
  "full tournament partial-rarity picker guard",
);

const genericSummary = '<div className="mt-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100"><b>{selectedTierCount}/{selectedRequirement.requiredTournamentRarityCards} required {selectedTier} cards selected.</b><div className="mt-1 text-purple-100/65">{selectedRequirement.shortLabel}</div></div>';
const oldOpenCommonSummary = '<div className="mt-3 rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100"><b>{selectedTier === "common" ? `${selectedIds.length}/5 eligible cards selected.` : `${selectedTierCount}/${selectedRequirement.requiredTournamentRarityCards} required ${selectedTier} cards selected.`}</b><div className="mt-1 text-purple-100/65">{selectedTier === "common" ? "Any rarity can enter this Common tournament." : selectedRequirement.shortLabel}</div></div>';
if (competitions.includes(oldOpenCommonSummary)) competitions = competitions.replace(oldOpenCommonSummary, genericSummary);
if (!competitions.includes(genericSummary)) throw new Error("[rarity-entry] canonical lineup requirement summary is missing");
fs.writeFileSync(competitionPath, competitions);

// Native tournament builder: apply the same partial and final rule validation as
// the server so users cannot keep choosing lower rarities beyond the allowed mix.
let nativePlay = fs.readFileSync(nativePlayPath, "utf8");
nativePlay = replaceRequired(
  nativePlay,
  "  getTournamentRarityRequirement,\n  isCardRarityAllowedInTournament,\n  normalizeTournamentRarity,\n  TOURNAMENT_UTILITY_POSITIONS,",
  "  getTournamentRarityRequirement,\n  isCardRarityAllowedInTournament,\n  normalizeTournamentRarity,\n  validatePartialTournamentRarityLineup,\n  validateTournamentRarityLineup,\n  TOURNAMENT_UTILITY_POSITIONS,",
  "native tournament rarity imports",
);
nativePlay = insertAfterRequired(
  nativePlay,
  "  const selectedTier = normalizeTournamentRarity(selected?.tier);",
  "\n  // TOURNAMENT_RARITY_PICKER_GUARD_V2\n  const selectedRequirement = getTournamentRarityRequirement(selectedTier);\n  const rarityValidation = validateTournamentRarityLineup(selectedCards.filter(Boolean).map((card) => card!.rarity), selectedTier);",
  "TOURNAMENT_RARITY_PICKER_GUARD_V2",
  "native selected rarity validation",
);
nativePlay = replaceRequired(
  nativePlay,
  "      if (!isCardRarityAllowedInTournament(card.rarity, selectedTier)) return false;\n      if (selectedIds.includes(id) && id !== currentId) return false;",
  "      if (!isCardRarityAllowedInTournament(card.rarity, selectedTier)) return false;\n      const partialRarityValidation = validatePartialTournamentRarityLineup(\n        selectedCards.map((selectedCard, index) => index === activeSlot ? card : selectedCard).filter(Boolean).map((selectedCard) => selectedCard!.rarity),\n        selectedTier,\n      );\n      if (!partialRarityValidation.valid) return false;\n      if (selectedIds.includes(id) && id !== currentId) return false;",
  "native partial-rarity picker guard",
);
nativePlay = replaceRequired(
  nativePlay,
  "  const complete = selectedIds.every(Boolean) && selectedCards.every(Boolean);",
  "  const filled = selectedIds.every(Boolean) && selectedCards.every(Boolean);\n  const complete = filled && rarityValidation.valid;",
  "native final rarity validation",
);
nativePlay = replaceRequired(
  nativePlay,
  '      if (!selected || !complete || !captainId) throw new Error("Choose five cards and a captain first.");',
  '      if (!selected || !filled || !captainId) throw new Error("Choose five cards and a captain first.");\n      if (!rarityValidation.valid) throw new Error(rarityValidation.message);',
  "native submit rarity validation",
);
nativePlay = replaceRequired(
  nativePlay,
  '<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{selected.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{String(selected.tier || "common").toUpperCase()} · 5 cards · choose captain</p></div>',
  '<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{selected.name}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{String(selected.tier || "common").toUpperCase()} · {selectedRequirement.shortLabel} · choose captain</p></div>',
  "native tournament rule header",
);
nativePlay = replaceRequired(
  nativePlay,
  '<div className="min-w-0"><p className="truncate text-xs font-black">{selectedIds.filter(Boolean).length}/5 selected</p><p className="text-[10px] text-slate-500">{captainId ? "Captain chosen · ready to submit" : complete ? "Choose a captain" : "Complete all five positions"}</p></div>',
  '<div className="min-w-0"><p className="truncate text-xs font-black">{selectedIds.filter(Boolean).length}/5 selected · {selectedRequirement.shortLabel}</p><p className="text-[10px] text-slate-500">{!filled ? "Complete all five positions" : !rarityValidation.valid ? rarityValidation.message : captainId ? "Captain chosen · ready to submit" : "Choose a captain"}</p></div>',
  "native footer rarity status",
);
nativePlay = replaceRequired(
  nativePlay,
  '<span>5-card team</span><ShieldCheck className="ml-1 h-3.5 w-3.5" /><span>Premier League</span>',
  '<span>{getTournamentRarityRequirement(tournament.tier).shortLabel}</span><ShieldCheck className="ml-1 h-3.5 w-3.5" /><span>Premier League</span>',
  "native tournament row rarity rule",
);
fs.writeFileSync(nativePlayPath, nativePlay);

// Keep published terms aligned with the canonical server rule. A Common cup is
// Common-only; higher tiers use the progressive mixes already documented here.
let legal = fs.readFileSync(legalPath, "utf8");
const commonCanonical = '  "Common: all five cards must be Common.",';
const oldAnyCommon = '  "Common: any five eligible cards may be used, regardless of rarity.",';
if (legal.includes(oldAnyCommon)) legal = legal.replace(oldAnyCommon, commonCanonical);
if (!legal.includes(commonCanonical)) throw new Error("[rarity-entry] published Common rarity rule is missing");
fs.writeFileSync(legalPath, legal);

// Native marketplace: make each listing visibly glow in its own rarity colour.
let nativeMarket = fs.readFileSync(nativeMarketPath, "utf8");
nativeMarket = insertAfterRequired(
  nativeMarket,
  'const rarities = ["all", "common", "rare", "unique", "epic", "legendary"] as const;',
  '\n\n// MARKETPLACE_RARITY_GLOW_V2\nconst marketRarityTone: Record<string, { edge: string; glow: string; ink: string }> = {\n  common: { edge: "#e2e8f0", glow: "rgba(226,232,240,.34)", ink: "#f8fafc" },\n  rare: { edge: "#3b82f6", glow: "rgba(59,130,246,.48)", ink: "#bfdbfe" },\n  unique: { edge: "#c084fc", glow: "rgba(192,132,252,.52)", ink: "#e9d5ff" },\n  epic: { edge: "#fb3b4a", glow: "rgba(251,59,74,.52)", ink: "#fecdd3" },\n  legendary: { edge: "#fbbf24", glow: "rgba(251,191,36,.56)", ink: "#fde68a" },\n};\n\nfunction marketTone(value: unknown) {\n  return marketRarityTone[String(value || "common").toLowerCase()] || marketRarityTone.common;\n}',
  "MARKETPLACE_RARITY_GLOW_V2",
  "native marketplace rarity tone",
);
nativeMarket = replaceRequired(
  nativeMarket,
  "          const mine = myListedIds.has(Number(card.id));\n          return <button key={card.id} type=\"button\" onClick={() => setSelected(card)} className=\"flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.032] p-2.5 text-left active:scale-[.995]\">\n            <div className=\"relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-slate-900\"><CardPlayerImage card={card} alt={card.player?.name || \"Player\"} className=\"h-full w-full object-cover object-top\" /></div>",
  "          const mine = myListedIds.has(Number(card.id));\n          const tone = marketTone(card.rarity);\n          return <button key={card.id} type=\"button\" onClick={() => setSelected(card)} className=\"relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white/[.032] p-2.5 text-left transition active:scale-[.995]\" style={{ borderColor: tone.edge, boxShadow: `0 0 22px ${tone.glow}, inset 0 0 26px ${tone.glow}` }}>\n            <span className=\"pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full\" style={{ background: tone.edge, boxShadow: `0 0 12px ${tone.edge}` }} />\n            <div className=\"relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border bg-slate-900\" style={{ borderColor: tone.edge, boxShadow: `0 0 18px ${tone.glow}` }}><CardPlayerImage card={card} alt={card.player?.name || \"Player\"} className=\"h-full w-full object-cover object-top\" /></div>",
  "native marketplace listing glow",
);
nativeMarket = replaceRequired(
  nativeMarket,
  '<span className="shrink-0 rounded-full bg-white/[.06] px-2 py-0.5 text-[8px] font-black uppercase text-slate-400">{String(card.rarity || "common")}</span>',
  '<span className="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: tone.edge, color: tone.ink, background: tone.glow, boxShadow: `0 0 10px ${tone.glow}` }}>{String(card.rarity || "common")}</span>',
  "native marketplace rarity badge glow",
);
fs.writeFileSync(nativeMarketPath, nativeMarket);

// Full marketplace already had a glow; correct and strengthen it so the same
// Common/Rare/Unique/Epic/Legendary palette is used on desktop and full market.
let marketplace = fs.readFileSync(marketplacePath, "utf8");
marketplace = replaceRequired(
  marketplace,
  'const rarityGlow: Record<string, string> = {\n  common: "rgba(148,163,184,.22)",\n  rare: "rgba(59,130,246,.36)",\n  epic: "rgba(168,85,247,.42)",\n  unique: "rgba(236,72,153,.42)",\n  legendary: "rgba(251,191,36,.48)",\n};',
  'const rarityGlow: Record<string, string> = {\n  common: "rgba(226,232,240,.34)",\n  rare: "rgba(59,130,246,.52)",\n  unique: "rgba(192,132,252,.56)",\n  epic: "rgba(251,59,74,.58)",\n  legendary: "rgba(251,191,36,.62)",\n};',
  "full marketplace canonical rarity glow",
);
fs.writeFileSync(marketplacePath, marketplace);

console.log("[rarity-entry] Tournament rarity composition is guarded in native/full entry pickers; Common is Common-only; marketplace listings glow by rarity.");