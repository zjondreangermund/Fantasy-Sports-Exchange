import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, source) {
  fs.writeFileSync(path, source);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[free-cup-prize-polish] ${label} anchor not found`);
  return source.replace(from, to);
}

// FREE_CUP_PRIZE_BUTTON_V1
// Free Card Cups now expose their actual randomized card reward from the same
// tournament block where users can enter or open the leaderboard.
{
  const path = "client/src/components/native/NativePlayPage.tsx";
  let source = read(path);

  if (!source.includes("FREE_CUP_PRIZE_BUTTON_V1")) {
    const helperAnchor = "function money(value: unknown) {";
    const helpers = `// FREE_CUP_PRIZE_BUTTON_V1\nfunction isNativeFreeCardPrizeTournament(tournament: Tournament) {\n  const entryFee = Number(tournament?.entryFee ?? tournament?.entry_fee ?? 0);\n  const prizeCardRarity = String(tournament?.prizeCardRarity ?? tournament?.prize_card_rarity ?? \"\").toLowerCase();\n  const prizeKey = String(tournament?.prizeKey ?? tournament?.prize_key ?? \"\").toLowerCase();\n  const prizeType = String(tournament?.prizeType ?? tournament?.prize_type ?? \"\").toLowerCase();\n  return entryFee <= 0 && (Boolean(prizeCardRarity) || prizeKey.startsWith(\"free-\") || prizeType === \"card\");\n}\n\nfunction nativeFreePrizeRarity(tournament: Tournament) {\n  return normalizeTournamentRarity(tournament?.prizeCardRarity ?? tournament?.prize_card_rarity ?? \"rare\");\n}`;
    if (!source.includes(helperAnchor)) throw new Error("[free-cup-prize-polish] free prize helper insertion anchor not found");
    source = source.replace(helperAnchor, `${helpers}\n\n${helperAnchor}`);
  }

  source = replaceRequired(
    source,
    "  const vaultTournament = isNativePrizeVaultTournament(tournament);",
    "  const vaultTournament = isNativePrizeVaultTournament(tournament);\n  const freeCardPrizeTournament = isNativeFreeCardPrizeTournament(tournament);\n  const prizeButtonTournament = vaultTournament || freeCardPrizeTournament;",
    "tournament prize flags",
  );

  source = replaceRequired(
    source,
    '${vaultTournament ? "grid-cols-3" : "grid-cols-2"}',
    '${prizeButtonTournament ? "grid-cols-3" : "grid-cols-2"}',
    "three-button tournament layout",
  );

  const paidPrizeButton = '{vaultTournament ? <Link href={`/prize-vault?rarity=${normalizeTournamentRarity(tournament.tier)}&gameWeek=${Number(tournament.gameWeek ?? tournament.game_week ?? 0)}&competitionId=${Number(tournament.id || 0)}`} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[9px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Gift className="h-3.5 w-3.5" />Prizes</Link> : null}';
  const allPrizeButton = '{prizeButtonTournament ? <Link href={freeCardPrizeTournament ? `/prize-vault?freeCup=1&rarity=${nativeFreePrizeRarity(tournament)}&gameWeek=${Number(tournament.gameWeek ?? tournament.game_week ?? 0)}&competitionId=${Number(tournament.id || 0)}` : `/prize-vault?rarity=${normalizeTournamentRarity(tournament.tier)}&gameWeek=${Number(tournament.gameWeek ?? tournament.game_week ?? 0)}&competitionId=${Number(tournament.id || 0)}`} className={`inline-flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[9px] font-black ${tone.border} ${tone.soft} ${tone.text}`}><Gift className="h-3.5 w-3.5" />{freeCardPrizeTournament ? "Prize" : "Prizes"}</Link> : null}';
  source = replaceRequired(source, paidPrizeButton, allPrizeButton, "free and paid prize action button");

  if (!source.includes("freeCup=1&rarity=${nativeFreePrizeRarity(tournament)}")) {
    throw new Error("[free-cup-prize-polish] free cup prize route verification failed");
  }
  write(path, source);
}

// When a Free Card Cup prize button is tapped, show only that cup's randomized
// card reward and what the winner can do with the awarded card. Do not mix this
// reward with the paid Prize Vault ladder.
{
  const path = "client/src/components/native/NativeVaultPage.tsx";
  let source = read(path);

  if (!source.includes("FREE_CUP_PRIZE_VIEW_V1")) {
    const earlyReturnAnchor = "  const chooseRarity = (value: Rarity) => {";
    const freeView = `  // FREE_CUP_PRIZE_VIEW_V1\n  const freeCupMode = typeof window !== \"undefined\" && new URLSearchParams(window.location.search).get(\"freeCup\") === \"1\";\n  const requestedGameWeek = typeof window !== \"undefined\" ? Number(new URLSearchParams(window.location.search).get(\"gameWeek\") || 0) : 0;\n  const requestedCompetitionId = typeof window !== \"undefined\" ? Number(new URLSearchParams(window.location.search).get(\"competitionId\") || 0) : 0;\n\n  if (freeCupMode) {\n    const rewardName = \`${"${rarity.charAt(0).toUpperCase() + rarity.slice(1)}"} Player Card\`;\n    return (\n      <div className=\"mx-auto w-full max-w-xl px-3 pb-4 pt-3\" data-native-free-cup-prize>\n        <section className=\"overflow-hidden rounded-[1.55rem] border border-blue-400/35 bg-[radial-gradient(circle_at_85%_0%,rgba(59,130,246,.26),transparent_34%),linear-gradient(145deg,#06152c,#070a15_58%,#02050c)] p-4 shadow-[0_0_36px_rgba(59,130,246,.18)]\">\n          <div className=\"flex items-start justify-between gap-3\">\n            <div className=\"min-w-0\">\n              <p className=\"text-[10px] font-black uppercase tracking-[.22em] text-blue-200/75\">Free Card Cup prize</p>\n              <h2 className=\"mt-1 text-2xl font-black\">1 random {rewardName}</h2>\n              <p className=\"mt-1 text-xs leading-5 text-slate-400\">The winner receives one randomly selected Premier League {rarity} player card. The player is chosen at random when the tournament is settled.</p>\n            </div>\n            <div className=\"grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-blue-300/25 bg-blue-300/[.09] text-blue-100 shadow-[0_0_22px_rgba(59,130,246,.2)]\"><Gift className=\"h-5 w-5\" /></div>\n          </div>\n\n          <div className=\"mt-4 rounded-2xl border border-white/[.08] bg-black/25 p-3.5\">\n            <div className=\"flex items-center gap-2\"><Sparkles className=\"h-4 w-4 text-blue-300\" /><p className=\"text-sm font-black\">What you can do with the winning card</p></div>\n            <p className=\"mt-2 text-xs leading-5 text-slate-300\">Once awarded, the card joins your Collection. You can use it in eligible {rarity} tournaments, sell it on the Marketplace, or list it for loan under the normal Fantasy Arena trading rules and app fees.</p>\n          </div>\n\n          <div className=\"mt-3 grid grid-cols-2 gap-2\">\n            <div className=\"rounded-2xl bg-black/25 p-3 text-center\"><p className=\"text-[9px] font-black uppercase tracking-[.12em] text-slate-600\">Gameweek</p><p className=\"mt-1 text-base font-black\">{requestedGameWeek || \"Current\"}</p></div>\n            <div className=\"rounded-2xl bg-black/25 p-3 text-center\"><p className=\"text-[9px] font-black uppercase tracking-[.12em] text-slate-600\">Reward</p><p className=\"mt-1 text-sm font-black capitalize text-blue-100\">Random {rarity} card</p></div>\n          </div>\n\n          <p className=\"mt-3 text-[10px] leading-4 text-slate-500\">The player card is randomized; it is not a cash substitute. Normal eligibility, sale, loan and platform-fee rules apply after the card is awarded.</p>\n          <Link href=\"/competitions\"><Button className=\"mt-4 h-11 w-full rounded-2xl bg-blue-500 font-black text-white shadow-[0_0_24px_rgba(59,130,246,.3)]\"><Trophy className=\"mr-2 h-4 w-4\" />Back to tournaments</Button></Link>\n          {requestedCompetitionId > 0 ? <p className=\"mt-2 text-center text-[9px] text-slate-700\">Tournament #{requestedCompetitionId}</p> : null}\n        </section>\n      </div>\n    );\n  }\n\n`;
    if (!source.includes(earlyReturnAnchor)) throw new Error("[free-cup-prize-polish] Native Vault free prize anchor not found");
    source = source.replace(earlyReturnAnchor, `${freeView}${earlyReturnAnchor}`);
  }

  write(path, source);
}

// Lift all Radix dialogs above the native header/dock and keep their close button
// above sticky dialog headers. This fixes the hidden X shown on Match intelligence
// and prevents the same stacking bug in other modal workspaces.
{
  const path = "client/src/components/ui/dialog.tsx";
  let source = read(path);
  source = replaceRequired(source, "fixed inset-0 z-50 bg-black/80", "fixed inset-0 z-[90] bg-black/80", "dialog overlay z-index");
  source = replaceRequired(source, "fixed left-1/2 top-1/2 z-50 grid", "fixed left-1/2 top-1/2 z-[100] grid", "dialog content z-index");
  source = replaceRequired(source, "absolute right-2 top-2 grid h-10", "absolute right-2 top-2 z-[110] grid h-10", "dialog close z-index");
  write(path, source);
}

// Match Centre copy/layout polish. Keep the sticky heading below the close button,
// use cleaner wording, and normalize punctuation if an older provider string left
// a space before the colon.
{
  const path = "client/src/components/FootballDataCentre.tsx";
  let source = read(path);
  source = source.replace('DialogHeader className="sticky top-0 z-20 ', 'DialogHeader className="sticky top-0 z-30 ');
  source = source.replaceAll("Full-match statistics", "Full match statistics");
  source = source.replace(/Double chance\s+:/g, "Double chance:");
  source = source.replace(/Match intelegence/gi, "Match intelligence");
  source = source.replace(/availablity/gi, "availability");
  source = source.replace(/statictical/gi, "statistical");
  write(path, source);
}

const play = read("client/src/components/native/NativePlayPage.tsx");
const vault = read("client/src/components/native/NativeVaultPage.tsx");
const dialog = read("client/src/components/ui/dialog.tsx");
const football = read("client/src/components/FootballDataCentre.tsx");
const checks = [
  [play.includes("FREE_CUP_PRIZE_BUTTON_V1") && play.includes("freeCup=1"), "free tournament Prize button missing"],
  [vault.includes("FREE_CUP_PRIZE_VIEW_V1") && vault.includes("sell it on the Marketplace") && vault.includes("list it for loan"), "free prize explanation missing"],
  [dialog.includes("z-[110] grid h-10"), "dialog close button is not above sticky content"],
  [dialog.includes("z-[100] grid"), "dialog workspace is not above the native dock"],
  [!football.toLowerCase().includes("match intelegence"), "Match intelligence spelling is still wrong"],
];
const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) throw new Error(`[free-cup-prize-polish] verification failed: ${failures.join("; ")}`);

console.log("[free-cup-prize-polish] Free Card Cups now show their random card prize; modal stacking and Match Centre copy are polished.");
