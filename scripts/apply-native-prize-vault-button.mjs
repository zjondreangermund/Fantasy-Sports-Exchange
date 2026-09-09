import fs from "node:fs";

const file = "client/src/components/native/NativePlayPage.tsx";
const marker = "NATIVE_PRIZE_VAULT_BUTTON_V1";
let source = fs.readFileSync(file, "utf8");

if (source.includes(marker)) {
  console.log("[native-prize-vault] already applied");
  process.exit(0);
}

function replaceRequired(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`[native-prize-vault] ${label} could not be located`);
  source = source.replace(from, to);
}

function insertBeforeRequired(anchor, insertion, label) {
  if (source.includes(marker)) return;
  if (!source.includes(anchor)) throw new Error(`[native-prize-vault] ${label} could not be located`);
  source = source.replace(anchor, `${insertion}\n\n${anchor}`);
}

replaceRequired(
  "  Trophy,\n  UsersRound,",
  "  Trophy,\n  Gift,\n  UsersRound,",
  "Gift icon import",
);

insertBeforeRequired(
  "function money(value: unknown) {",
  `// NATIVE_PRIZE_VAULT_BUTTON_V1\nfunction isNativePrizeVaultTournament(tournament: Tournament) {\n  const prizeKey = String(tournament?.prizeKey ?? tournament?.prize_key ?? \"\").toLowerCase();\n  const prizeType = String(tournament?.prizeType ?? tournament?.prize_type ?? \"\").toLowerCase();\n  const entryFee = Number(tournament?.entryFee ?? tournament?.entry_fee ?? 0);\n  const prizeCardRarity = String(tournament?.prizeCardRarity ?? tournament?.prize_card_rarity ?? \"\").toLowerCase();\n  const freeCardCup = entryFee <= 0 && (prizeKey.startsWith(\"free-\") || prizeType === \"card\" || Boolean(prizeCardRarity));\n  const creatorCashTournament = prizeType === \"cash_pool\" || prizeKey === \"user-cash\";\n  if (freeCardCup || creatorCashTournament) return false;\n  return prizeKey === \"ladder\" || (entryFee > 0 && !prizeKey);\n}`,
  "Prize Vault tournament helper",
);

replaceRequired(
  "  const entryCount = Number(tournament.entryCount ?? tournament.entry_count ?? 0);",
  "  const entryCount = Number(tournament.entryCount ?? tournament.entry_count ?? 0);\n  const vaultTournament = isNativePrizeVaultTournament(tournament);",
  "Prize Vault row flag",
);

replaceRequired(
  '<div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={onLeaderboard} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Trophy className="h-3.5 w-3.5" />Leaderboard</button><button onClick={onEnter} disabled={!open} className={`rounded-xl px-3.5 py-2 text-[10px] font-black disabled:bg-white/5 disabled:text-slate-600 ${open ? tone.button : ""}`}>{open ? fee > 0 ? money(fee) : "Enter" : "Closed"}</button></div>',
  '<div className={`mt-2 grid ${vaultTournament ? "grid-cols-3" : "grid-cols-2"} gap-2`}><button type="button" onClick={onLeaderboard} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[9px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Trophy className="h-3.5 w-3.5" />Leaderboard</button>{vaultTournament ? <Link href={`/prize-vault?rarity=${normalizeTournamentRarity(tournament.tier)}`} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[9px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Gift className="h-3.5 w-3.5" />Prize Vault</Link> : null}<button onClick={onEnter} disabled={!open} className={`rounded-xl px-2 py-2 text-[9px] font-black disabled:bg-white/5 disabled:text-slate-600 ${open ? tone.button : ""}`}>{open ? fee > 0 ? money(fee) : "Enter" : "Closed"}</button></div>',
  "Prize Vault tournament action button",
);

fs.writeFileSync(file, source);
console.log("[native-prize-vault] Prize Vault tournaments now show a direct Prize Vault button beside Leaderboard and Enter.");
