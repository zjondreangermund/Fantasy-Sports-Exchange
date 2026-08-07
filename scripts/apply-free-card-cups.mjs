import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Free Card Cups patch anchor not found: ${label}`);
  return source.replace(from, to);
}

// Make the public tournament API distinguish N$0 card-reward cups from paid Prize Vault tournaments.
{
  const file = "server/routes.ts";
  let source = read(file);
  const from = `function normalizeCompetitionRow(row: any) {
  if (!row) return row;
  const rarity = String(row.tier || row.rarity || "common").toLowerCase();
  const entryFee = Number(row.entryFee ?? row.entry_fee ?? getEntryFeeForRarity(rarity));
  const entryCount = Number(row.entryCount ?? row.entry_count ?? 0);
  const ladderState = getActivePrizeForEntries(rarity, entryCount);
  const activePrize = ladderState.activePrize;
  const nextPrize = ladderState.nextPrize;
  const displayPrize = activePrize || nextPrize;
  return {
    ...row,
    entryFee,
    entryCount,
    maxEntries: row.maxEntries ?? row.max_entries ?? null,
    joinPin: row.joinPin ?? row.join_pin ?? null,
    prizePoolTotal: Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0),
    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),
    prizeType: row.prizeType ?? row.prize_type ?? "goods",
    prizeDescription: displayPrize?.title || row.prizeDescription || row.prize_description || "Prize Vault ladder",
    prizeKey: displayPrize?.key || row.prizeKey || row.prize_key || null,
    prizeValue: displayPrize?.value || 0,
    prizeUnlockTarget: displayPrize?.unlockTarget || 0,
    requiredEntrants: displayPrize?.requiredEntrants || 0,
    currentEntrantRevenue: toMoney(entryCount * entryFee),
    prizeUnlocked: Boolean(activePrize),
    activePrize,
    nextPrize,
    entrantsToNext: ladderState.entrantsToNext,
    marginMultiplier: RARITY_MARGIN_MULTIPLIERS[rarity as keyof typeof RARITY_MARGIN_MULTIPLIERS] || 1.8,
    ladderRarity: rarity,
    season: SEASON_KEY,
  };
}`;
  const to = `function normalizeCompetitionRow(row: any) {
  if (!row) return row;
  const rarity = String(row.tier || row.rarity || "common").toLowerCase();
  const entryFee = Number(row.entryFee ?? row.entry_fee ?? getEntryFeeForRarity(rarity));
  const entryCount = Number(row.entryCount ?? row.entry_count ?? 0);
  const prizeCardRarity = String(row.prizeCardRarity ?? row.prize_card_rarity ?? "").toLowerCase();
  const isFreeCardCup = entryFee <= 0 && Boolean(prizeCardRarity);
  const ladderState = isFreeCardCup ? { activePrize: null, nextPrize: null, entrantsToNext: 0 } : getActivePrizeForEntries(rarity, entryCount);
  const activePrize = ladderState.activePrize;
  const nextPrize = ladderState.nextPrize;
  const displayPrize = activePrize || nextPrize;
  const freeCardTitle = prizeCardRarity ? \`${"${prizeCardRarity.charAt(0).toUpperCase() + prizeCardRarity.slice(1)}"} Player Card\` : "Player Card";
  return {
    ...row,
    entryFee,
    entryCount,
    maxEntries: row.maxEntries ?? row.max_entries ?? null,
    joinPin: row.joinPin ?? row.join_pin ?? null,
    prizePoolTotal: Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0),
    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),
    prizeType: isFreeCardCup ? "card" : (row.prizeType ?? row.prize_type ?? "goods"),
    prizeDescription: isFreeCardCup ? freeCardTitle : (displayPrize?.title || row.prizeDescription || row.prize_description || "Prize Vault ladder"),
    prizeKey: isFreeCardCup ? \`free-${"${prizeCardRarity || rarity}"}-card\` : (displayPrize?.key || row.prizeKey || row.prize_key || null),
    prizeValue: isFreeCardCup ? 0 : (displayPrize?.value || 0),
    prizeUnlockTarget: isFreeCardCup ? 0 : (displayPrize?.unlockTarget || 0),
    requiredEntrants: isFreeCardCup ? 0 : (displayPrize?.requiredEntrants || 0),
    currentEntrantRevenue: toMoney(entryCount * entryFee),
    prizeUnlocked: isFreeCardCup ? true : Boolean(activePrize),
    activePrize: isFreeCardCup ? { key: \`free-${"${prizeCardRarity || rarity}"}-card\`, title: freeCardTitle, value: 0, category: "card", rarity: prizeCardRarity || rarity } : activePrize,
    nextPrize: isFreeCardCup ? null : nextPrize,
    entrantsToNext: isFreeCardCup ? 0 : ladderState.entrantsToNext,
    marginMultiplier: isFreeCardCup ? 0 : (RARITY_MARGIN_MULTIPLIERS[rarity as keyof typeof RARITY_MARGIN_MULTIPLIERS] || 1.8),
    isFreeCardCup,
    ladderRarity: rarity,
    season: SEASON_KEY,
  };
}`;
  source = replaceOnce(source, from, to, "competition API free-card normalization");
  write(file, source);
}

// Rename the existing official N$0 Common competitions and ensure future seeded cups advertise the Rare-card reward.
{
  const file = "server/seed.ts";
  let source = read(file);
  source = replaceOnce(source,
    '  console.log("Ensuring common tournaments exist for GW27+ ...");',
    '  console.log("Ensuring FREE Rare Card Cups exist for GW27+ ...");',
    "seed log",
  );

  const byWeekAnchor = `  const existingByWeek = new Set(existing.filter((c: any) => String(c.tier || "").toLowerCase() === "common").map((c: any) => Number(c.gameWeek)));`;
  const backfill = `  for (const competition of existing as any[]) {
    const legacyFreeCup = String(competition?.tier || "").toLowerCase() === "common"
      && Number(competition?.entryFee || 0) === 0
      && String(competition?.prizeCardRarity || "").toLowerCase() === "rare"
      && /^Common Tournament - GW\\d+$/i.test(String(competition?.name || ""));
    if (!legacyFreeCup) continue;
    const gameWeek = Number(competition.gameWeek || 0);
    await storage.updateCompetition(Number(competition.id), {
      name: \`FREE Rare Card Cup - GW${"${gameWeek}"}\`,
      prizeType: "goods",
      prizeDescription: "Rare Player Card",
      prizeKey: "free-rare-card",
    } as any);
    competition.name = \`FREE Rare Card Cup - GW${"${gameWeek}"}\`;
    competition.prizeType = "goods";
    competition.prizeDescription = "Rare Player Card";
    competition.prizeKey = "free-rare-card";
  }

${byWeekAnchor}`;
  source = replaceOnce(source, byWeekAnchor, backfill, "legacy free cup backfill");
  source = replaceOnce(source,
    '      name: `Common Tournament - GW${gw}`,' ,
    '      name: `FREE Rare Card Cup - GW${gw}`,' ,
    "seeded free cup name",
  );
  source = replaceOnce(source,
    '      prizeCardRarity: "rare",\n    } as any);',
    '      prizeCardRarity: "rare",\n      prizeType: "goods",\n      prizeDescription: "Rare Player Card",\n      prizeKey: "free-rare-card",\n    } as any);',
    "seeded free cup reward metadata",
  );
  source = source.replace('Common tournaments GW27-GW30 already present', 'FREE Rare Card Cups GW27-GW30 already present');
  source = source.replace('missing common tournaments (GW27-GW30)', 'missing FREE Rare Card Cups (GW27-GW30)');
  write(file, source);
}

// Give Free Card Cups their own obvious tournament lane and explain the card reward instead of Prize Vault funding.
{
  const file = "client/src/pages/competitions.tsx";
  let source = read(file);
  source = replaceOnce(source,
    '  prizeUnlocked?: boolean;\n};',
    '  prizeUnlocked?: boolean;\n  isFreeCardCup?: boolean;\n};',
    "competition type free flag",
  );
  source = replaceOnce(source,
    '  const upcomingComps = useMemo(() => (Array.isArray(competitions) ? competitions : []).filter((c) => c.status === "upcoming"), [competitions]);',
    '  const freeCardComps = useMemo(() => liveComps.filter((comp) => n(comp.entryFee) <= 0 && (comp.isFreeCardCup || Boolean((comp as any).prizeCardRarity))), [liveComps]);\n  const paidPublicComps = useMemo(() => liveComps.filter((comp) => n(comp.entryFee) > 0), [liveComps]);\n  const upcomingComps = useMemo(() => (Array.isArray(competitions) ? competitions : []).filter((c) => c.status === "upcoming"), [competitions]);',
    "free and paid tournament groups",
  );
  source = replaceOnce(source,
    '  const nextUnlock = [...liveComps].filter((c) => !c.prizeUnlocked && n(c.requiredEntrants) > 0).sort((a, b) => n(a.requiredEntrants) - n(b.requiredEntrants))[0];',
    '  const nextUnlock = [...paidPublicComps].filter((c) => !c.prizeUnlocked && n(c.requiredEntrants) > 0).sort((a, b) => n(a.requiredEntrants) - n(b.requiredEntrants))[0];',
    "paid prize unlock only",
  );
  source = replaceOnce(source,
    '<LiveHero eyebrow="Fantasy Arena" title="Tournament Arena" description="Entries lock at the first Premier League kickoff. Scores freeze at Tuesday 23:59 CAT; FA Cup matches and later rescheduled fixtures do not count." />',
    '<LiveHero eyebrow="Fantasy Arena" title="Tournament Arena" description="Start with FREE Card Cups to win player cards, or enter paid Prize Tournaments for cash and Prize Vault rewards. Entries lock at the first Premier League kickoff." />',
    "tournament hero",
  );
  source = replaceOnce(source,
    '<Tabs defaultValue={initialPin ? "pin" : "live"} className="w-full">',
    '<Tabs defaultValue={initialPin ? "pin" : "free"} className="w-full">',
    "default free tab",
  );
  source = replaceOnce(source,
    '<TabsList className="arena-filter-chips mb-4 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0"><TabsTrigger value="live" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🔴 Public</TabsTrigger><TabsTrigger value="pin" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🔐 Join by PIN</TabsTrigger><TabsTrigger value="create" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">➕ Create</TabsTrigger><TabsTrigger value="mine" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🏟 My Tournaments</TabsTrigger><TabsTrigger value="my-live" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">⭐ My Live</TabsTrigger><TabsTrigger value="completed" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">✅ Completed</TabsTrigger></TabsList>',
    '<TabsList className="arena-filter-chips mb-4 flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0"><TabsTrigger value="free" className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 text-emerald-100">🆓 Free Card Cups</TabsTrigger><TabsTrigger value="paid" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🏆 Prize Tournaments</TabsTrigger><TabsTrigger value="pin" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🔐 Join by PIN</TabsTrigger><TabsTrigger value="create" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">➕ Create</TabsTrigger><TabsTrigger value="mine" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">🏟 My Tournaments</TabsTrigger><TabsTrigger value="my-live" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">⭐ My Live</TabsTrigger><TabsTrigger value="completed" className="rounded-full border border-white/15 bg-black/30 px-4 text-white">✅ Completed</TabsTrigger></TabsList>',
    "free tournament tabs",
  );
  source = replaceOnce(source,
    '<TabsContent value="live">{isLoading ? <LoadingGrid /> : liveComps.length > 0 ? <CompetitionGrid comps={liveComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No public live tournaments available." />}</TabsContent>',
    '<TabsContent value="free"><div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] p-4 text-sm text-emerald-50"><b>FREE Card Cups:</b> N$0 entry. Use your Common cards to compete for a Rare player-card reward. Once awarded, the Rare card joins your Collection—you can keep it, use it in eligible Rare tournaments, or list it on the Marketplace when trading is open.</div>{isLoading ? <LoadingGrid /> : freeCardComps.length > 0 ? <CompetitionGrid comps={freeCardComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No Free Card Cups are open right now. Check back for the next gameweek." />}</TabsContent>\n        <TabsContent value="paid">{isLoading ? <LoadingGrid /> : paidPublicComps.length > 0 ? <CompetitionGrid comps={paidPublicComps} enteredIds={enteredCompetitionIds} onJoin={(comp) => openCompetitionAction(comp)} /> : <EmptyCard text="No paid Prize Tournaments are open right now." />}</TabsContent>',
    "free and paid tab content",
  );

  const oldEconomics = `function PrizeEconomics({ comp }: { comp: CompetitionWithEntries }) {
  const revenue = n(comp.currentEntrantRevenue) || n(comp.entryFee) * n(comp.entryCount);
  const target = n(comp.prizeUnlockTarget);
  const progress = prizeProgress(comp);
  return <div className="space-y-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{comp.prizeDescription || "Prize"}</b>{comp.prizeValue ? \` • value N$${"${money(comp.prizeValue)}"}\` : ""}</div><Link href="/prize-vault" className="text-xs font-bold underline">View Prize Vault</Link></div><div className="grid gap-2 sm:grid-cols-4"><InfoPill label="Entry" value={\`N$${"${money(comp.entryFee)}"}\`} helper="Per player" /><InfoPill label="Players" value={\`${"${comp.entryCount || 0}"}/${"${comp.requiredEntrants || 0}"}\`} helper="This GW only" /><InfoPill label="Unlock target" value={\`N$${"${money(target)}"}\`} helper="150% of prize" /><InfoPill label="Current revenue" value={\`N$${"${money(revenue)}"}\`} helper={comp.prizeUnlocked ? "Unlocked" : \`${"${progress}"}% unlocked\`} /></div><div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-300" style={{ width: \`${"${progress}"}%\` }} /></div><p className="text-xs text-emerald-100/70">Prize only unlocks when entrants for this gameweek reach the target. Next gameweek entries, points and prize progress reset to 0.</p></div>;
}`;
  const newEconomics = `function PrizeEconomics({ comp }: { comp: CompetitionWithEntries }) {
  const freeCardCup = n(comp.entryFee) <= 0 && (comp.isFreeCardCup || Boolean((comp as any).prizeCardRarity));
  if (freeCardCup) {
    const rarity = String((comp as any).prizeCardRarity || "rare");
    const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    return <div className="space-y-3 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/70">Free-to-play card reward</div><b className="text-base">Win a {label} Player Card</b></div><Badge className="bg-emerald-300 text-emerald-950">N$0 ENTRY</Badge></div><div className="grid gap-2 sm:grid-cols-3"><InfoPill label="Entry" value="FREE" helper="No wallet balance needed" /><InfoPill label="Your cards" value="5 Common" helper="GK • DEF • MID • FWD • Utility" /><InfoPill label="Winner reward" value={\`${"${label}"} Card\`} helper="Keep • use • list" /></div><p className="text-xs leading-5 text-emerald-100/75">The winning card becomes part of your Collection after award. Keep it, use it in eligible {label} tournaments, or list it on the Marketplace when trading is open.</p></div>;
  }
  const revenue = n(comp.currentEntrantRevenue) || n(comp.entryFee) * n(comp.entryCount);
  const target = n(comp.prizeUnlockTarget);
  const progress = prizeProgress(comp);
  return <div className="space-y-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{comp.prizeDescription || "Prize"}</b>{comp.prizeValue ? \` • value N$${"${money(comp.prizeValue)}"}\` : ""}</div><Link href="/prize-vault" className="text-xs font-bold underline">View Prize Vault</Link></div><div className="grid gap-2 sm:grid-cols-4"><InfoPill label="Entry" value={\`N$${"${money(comp.entryFee)}"}\`} helper="Per player" /><InfoPill label="Players" value={\`${"${comp.entryCount || 0}"}/${"${comp.requiredEntrants || 0}"}\`} helper="This GW only" /><InfoPill label="Unlock target" value={\`N$${"${money(target)}"}\`} helper="Rarity funding target" /><InfoPill label="Current revenue" value={\`N$${"${money(revenue)}"}\`} helper={comp.prizeUnlocked ? "Unlocked" : \`${"${progress}"}% unlocked\`} /></div><div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-300" style={{ width: \`${"${progress}"}%\` }} /></div><p className="text-xs text-emerald-100/70">Prize only unlocks when qualifying entries for this gameweek reach the target. Next gameweek entries, points and Prize Vault progress reset.</p></div>;
}`;
  source = replaceOnce(source, oldEconomics, newEconomics, "free card prize economics");

  const oldCard = `function CompetitionCard({ comp, entered, onJoin }: { comp: CompetitionWithEntries; entered: boolean; onJoin: () => void }) { const entryCount = n(comp.entryCount || (comp.entries || []).length); const maxEntries = n(comp.max_entries || comp.maxEntries); const progress = maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : prizeProgress(comp); const countdown = tournamentCountdown(comp); const settlement = tournamentSettlementLabel(comp); const schedule = comp.entryOpen === false || comp.status === "active" || comp.status === "closed" ? \`settles ${"${settlement}"}\` : \`entries lock in ${"${countdown}"}\`; return <Card className="group relative overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/70 p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)]"><div className="p-5 space-y-4"><div className="flex items-start justify-between gap-3"><div><Badge className="capitalize bg-primary/20 text-primary-foreground">{comp.tier}</Badge><h3 className="mt-2 text-xl font-black">{comp.name}</h3><p className="text-xs text-white/45">GW {comp.gameWeek} • {schedule}</p></div>{entered ? <Badge className="bg-emerald-400/20 text-emerald-100">Entered</Badge> : comp.entryOpen === false ? <Badge className="bg-red-400/20 text-red-100"><Lock className="mr-1 h-3 w-3" />Locked</Badge> : <Badge className="bg-cyan-400/20 text-cyan-100">Open</Badge>}</div><div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/55"><Clock className="mr-2 inline h-3.5 w-3.5" />Premier League gameweek points only. Cup matches and fixtures after settlement are excluded.</div><PrizeEconomics comp={comp} /><div className="grid grid-cols-2 gap-2 text-sm"><InfoPill label="Entrants" value={\`${"${entryCount}"}${"${maxEntries ? `/${maxEntries}` : \"\"}"}\`} helper="This GW only" /><InfoPill label="Progress" value={\`${"${progress}"}%\`} helper={comp.prizeUnlocked ? "Prize unlocked" : "Prize locked"} /></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: \`${"${progress}"}%\` }} /></div><Button onClick={onJoin} disabled={entered || comp.entryOpen === false} className="w-full rounded-xl bg-primary font-bold">{entered ? "Already Entered" : comp.entryOpen === false ? "Closed" : \`Enter N$${"${money(comp.entryFee)}"}\`}</Button></div></Card>; }`;
  const newCard = `function CompetitionCard({ comp, entered, onJoin }: { comp: CompetitionWithEntries; entered: boolean; onJoin: () => void }) { const entryCount = n(comp.entryCount || (comp.entries || []).length); const maxEntries = n(comp.max_entries || comp.maxEntries); const freeCardCup = n(comp.entryFee) <= 0 && (comp.isFreeCardCup || Boolean((comp as any).prizeCardRarity)); const progress = freeCardCup ? (maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : Math.min(100, Math.max(8, entryCount * 8))) : (maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : prizeProgress(comp)); const countdown = tournamentCountdown(comp); const settlement = tournamentSettlementLabel(comp); const schedule = comp.entryOpen === false || comp.status === "active" || comp.status === "closed" ? \`settles ${"${settlement}"}\` : \`entries lock in ${"${countdown}"}\`; return <Card className={\`group relative overflow-hidden rounded-[2rem] p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)] ${"${freeCardCup ? \"border-emerald-300/30 bg-emerald-950/30\" : \"border-white/10 bg-slate-950/70\"}"}\`}><div className="p-5 space-y-4"><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Badge className="capitalize bg-primary/20 text-primary-foreground">{comp.tier}</Badge>{freeCardCup && <Badge className="bg-emerald-300 text-emerald-950">FREE ENTRY</Badge>}</div><div className="mt-2"><h3 className="text-xl font-black">{comp.name}</h3><p className="text-xs text-white/45">GW {comp.gameWeek} • {schedule}</p></div></div>{entered ? <Badge className="bg-emerald-400/20 text-emerald-100">Entered</Badge> : comp.entryOpen === false ? <Badge className="bg-red-400/20 text-red-100"><Lock className="mr-1 h-3 w-3" />Locked</Badge> : <Badge className="bg-cyan-400/20 text-cyan-100">Open</Badge>}</div><div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/55"><Clock className="mr-2 inline h-3.5 w-3.5" />Premier League gameweek points only. Cup matches and fixtures after settlement are excluded.</div><PrizeEconomics comp={comp} /><div className="grid grid-cols-2 gap-2 text-sm"><InfoPill label="Entrants" value={\`${"${entryCount}"}${"${maxEntries ? `/${maxEntries}` : \"\"}"}\`} helper="This GW only" /><InfoPill label={freeCardCup ? "Reward" : "Progress"} value={freeCardCup ? "Rare Card" : \`${"${progress}"}%\`} helper={freeCardCup ? "Winner card prize" : comp.prizeUnlocked ? "Prize unlocked" : "Prize locked"} /></div>{!freeCardCup && <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: \`${"${progress}"}%\` }} /></div>}<Button onClick={onJoin} disabled={entered || comp.entryOpen === false} className={\`w-full rounded-xl font-bold ${"${freeCardCup ? \"bg-emerald-400 text-emerald-950 hover:bg-emerald-300\" : \"bg-primary\"}"}\`}>{entered ? "Already Entered" : comp.entryOpen === false ? "Closed" : freeCardCup ? "Enter FREE Card Cup" : \`Enter N$${"${money(comp.entryFee)}"}\`}</Button></div></Card>; }`;
  source = replaceOnce(source, oldCard, newCard, "free card competition card");
  write(file, source);
}

// Make free play impossible to miss on the public landing page.
{
  const file = "client/src/pages/landing.tsx";
  let source = read(file);
  source = replaceOnce(source,
    '              <p className="mt-6 max-w-2xl text-lg text-white/70">Create your club, collect Premier League player cards, build five-card tournament teams, score from real match performances and chase cash and Prize Vault rewards.</p>',
    '              <p className="mt-6 max-w-2xl text-lg text-white/70">Create your club, collect Premier League player cards and compete your way up. Start in FREE Card Cups to win Rare cards, then use your collection in rarity tournaments, the Marketplace, Auctions and Prize Vault competitions.</p>',
    "landing hero free path",
  );
  source = replaceOnce(source,
    '["Common → Legendary rarities", "Prize Vault ladders", "Marketplace + Auctions", "Community Live chat"]',
    '["FREE Card Cups", "Common → Legendary rarities", "Prize Vault ladders", "Marketplace + Auctions", "Community Live chat"]',
    "landing hero free chip",
  );
  source = replaceOnce(source,
    '    title: "4. Enter the correct rarity tournament",\n    text: "Each tournament shows its rarity requirement, entry fee, deadline and prize information before you confirm. Submitted lineups are final, and used cards stay locked until that entry is settled or cancelled.",',
    '    title: "4. Choose FREE or paid competition",\n    text: "FREE Card Cups cost N$0 and let Common-card managers compete for Rare player cards. Paid Prize Tournaments are separate and clearly show the entry fee, rarity requirement, deadline and cash or Prize Vault reward before you confirm.",',
    "landing flow free or paid",
  );
  const rarityAnchor = '        <div className="mt-14">\n          <div className="mb-6 text-center"><h3 className="text-2xl font-black text-foreground">Tournament rarity rules</h3><p className="mt-2 text-sm text-muted-foreground">Rarity changes which cards you may enter. It does not multiply a player\'s football score.</p></div>';
  const freeSection = `        <div data-free-card-cups className="mt-14 overflow-hidden rounded-3xl border border-emerald-300/25 bg-gradient-to-br from-emerald-500/15 via-card to-card p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div><div className="text-xs font-black uppercase tracking-[.24em] text-emerald-400">🆓 Free-to-play path</div><h3 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">FREE Card Cups — win cards without paying an entry fee</h3><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Use your five Common cards in N$0-entry cups. The winner earns a Rare player-card reward. Once awarded, that Rare card becomes part of your Collection: keep it, use it in eligible Rare tournaments, or list it on the Marketplace when trading is open.</p></div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1"><div className="rounded-2xl border border-emerald-300/20 bg-black/20 p-4"><div className="text-xs uppercase tracking-wider text-emerald-400">Entry</div><div className="mt-1 text-xl font-black text-foreground">N$0 — FREE</div></div><div className="rounded-2xl border border-emerald-300/20 bg-black/20 p-4"><div className="text-xs uppercase tracking-wider text-emerald-400">Use</div><div className="mt-1 text-xl font-black text-foreground">5 Common cards</div></div><div className="rounded-2xl border border-emerald-300/20 bg-black/20 p-4"><div className="text-xs uppercase tracking-wider text-emerald-400">Win</div><div className="mt-1 text-xl font-black text-foreground">Rare Player Card</div></div></div>
          </div>
        </div>

        <div className="mt-14">
          <div className="mb-6 text-center"><h3 className="text-2xl font-black text-foreground">Paid rarity tournaments</h3><p className="mt-2 text-sm text-muted-foreground">These are separate from FREE Card Cups. Rarity changes which cards you may enter; it does not multiply a player's football score.</p></div>`;
  source = replaceOnce(source, rarityAnchor, freeSection, "landing free card cups section");
  source = replaceOnce(source,
    '<p className="text-sm leading-6 text-amber-100/85"><strong className="text-amber-100">Production preview:</strong> You can create your club, receive starter cards and explore the arena now. Trading, wallet actions, paid tournament entries and auction bids may remain read-only until launch controls are opened.</p>',
    '<p className="text-sm leading-6 text-amber-100/85"><strong className="text-amber-100">Production preview:</strong> You can create your club, receive starter cards and explore the arena now. FREE Card Cups are the no-entry-fee progression path; trading, wallet actions, paid tournament entries and auction bids may remain read-only until launch controls are opened.</p>',
    "landing preview free path",
  );
  write(file, source);
}

// Improve social link previews so marketing posts advertise both the free and paid paths.
{
  const file = "client/index.html";
  let source = read(file);
  source = source.replace(
    'content="Explore Fantasy Arena: create your club, choose free starter player cards, follow live football scoring, discover Prize Vault rewards, tournaments and the card marketplace."',
    'content="Explore Fantasy Arena: create your club, choose free starter cards, enter FREE Card Cups to win Rare player cards, and compete in Premier League fantasy tournaments."',
  );
  source = source.replace(
    'content="Create your club, choose free starter cards and explore how Fantasy Arena tournaments, live scoring, Prize Vaults and card trading work."',
    'content="Create your club, enter FREE Card Cups to win Rare player cards, then build your collection for rarity tournaments, Prize Vaults and card trading."',
  );
  source = source.replace(
    'content="Create your club, choose free starter cards and explore the Fantasy Arena production preview."',
    'content="Create your club, play FREE Card Cups for Rare player cards and explore Fantasy Arena."',
  );
  write(file, source);
}

console.log("[free-card-cups] Applied free-to-play card tournament presentation and progression copy");
