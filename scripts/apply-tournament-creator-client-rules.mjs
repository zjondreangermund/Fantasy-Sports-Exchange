import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "client", "src", "pages", "competitions.tsx");
let source = fs.readFileSync(file, "utf8");

function replaceRequired(from, to, label, marker = to) {
  if (source.includes(marker)) return;
  if (!source.includes(from)) throw new Error(`Tournament creator client patch anchor not found: ${label}`);
  source = source.replace(from, to);
}
function replaceSection(startToken, endToken, replacement, label, marker) {
  if (marker && source.includes(marker)) return;
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Tournament creator client section start not found: ${label}`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`Tournament creator client section end not found: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceRequired(
  'const rarityOptions = ["common", "rare", "epic", "unique", "legendary"];',
  'const rarityOptions = ["common", "rare", "unique", "epic", "legendary"];\nconst creatorEntryFeesByRarity: Record<string, number[]> = { common: [10, 20], rare: [50, 75, 100], unique: [100, 150, 200], epic: [250, 300, 500], legendary: [500, 1000, 2500] };',
  "creator entry fee presets",
  "creatorEntryFeesByRarity",
);

replaceRequired(
  '  const [createForm, setCreateForm] = useState({ name: "Friday Friends Cup", tier: "common", entryFee: "30", maxEntries: "10", visibility: "private" });',
  '  const [createForm, setCreateForm] = useState({ name: "Friday Friends Cup", tier: "common", entryFee: "10", maxEntries: "10", visibility: "private", payoutMode: "winner_takes_all", firstPercent: "60", secondPercent: "30", thirdPercent: "10" });',
  "cash creator form",
  'payoutMode: "winner_takes_all"',
);

replaceRequired(
  '  const createTournamentMutation = useMutation({\n    mutationFn: async () => (await apiRequest("POST", "/api/user-tournaments/create", { name: createForm.name, tier: createForm.tier, entryFee: Number(createForm.entryFee || 0), maxEntries: Number(createForm.maxEntries || 0), visibility: createForm.visibility })).json(),\n    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }); const nextPin = data?.pin || data?.tournament?.join_pin || null; setCreatedPin(nextPin); toast({ title: "Tournament created", description: nextPin ? `PIN: ${nextPin}` : "Your tournament is live." }); },\n    onError: (error: any) => toast({ title: "Could not create tournament", description: error.message, variant: "destructive" }),\n  });',
  `  const createTournamentMutation = useMutation({
    mutationFn: async () => {
      const payoutRules = createForm.payoutMode === "top3"
        ? [
            { rank: 1, percent: Number(createForm.firstPercent || 0) },
            { rank: 2, percent: Number(createForm.secondPercent || 0) },
            { rank: 3, percent: Number(createForm.thirdPercent || 0) },
          ]
        : [{ rank: 1, percent: 100 }];
      return (await apiRequest("POST", "/api/user-tournaments/create", {
        name: createForm.name,
        tier: createForm.tier,
        entryFee: Number(createForm.entryFee || 0),
        maxEntries: Number(createForm.maxEntries || 0),
        visibility: createForm.visibility,
        prizeDistribution: createForm.payoutMode,
        prizeDistributionRules: payoutRules,
      })).json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-tournaments/mine"] });
      const nextPin = data?.pin || data?.tournament?.join_pin || data?.tournament?.joinPin || null;
      setCreatedPin(nextPin);
      toast({ title: "Cash tournament created", description: nextPin ? \`Share code: \${nextPin}\` : "Your tournament is live." });
    },
    onError: (error: any) => toast({ title: "Could not create tournament", description: error.message, variant: "destructive" }),
  });`,
  "cash creator mutation",
  "prizeDistributionRules: payoutRules",
);

replaceRequired(
  '  const platformFeePreview = Number(createForm.entryFee || 0) * 0.2;\n  const prizePreview = Number(createForm.entryFee || 0) * 0.8;',
  '  const platformFeePreview = Number(createForm.entryFee || 0) * 0.1;\n  const prizePreview = Number(createForm.entryFee || 0) * 0.9;\n  const payoutPercentTotal = Number(createForm.firstPercent || 0) + Number(createForm.secondPercent || 0) + Number(createForm.thirdPercent || 0);\n  const payoutValid = createForm.payoutMode === "winner_takes_all" || (Number(createForm.firstPercent || 0) > 0 && Number(createForm.secondPercent || 0) > 0 && Number(createForm.thirdPercent || 0) > 0 && Math.abs(payoutPercentTotal - 100) < 0.001);',
  "creator 10 percent preview",
  "const payoutValid = createForm.payoutMode",
);

replaceRequired(
  '  const paidPublicComps = useMemo(() => liveComps.filter((comp) => n(comp.entryFee) > 0), [liveComps]);',
  '  const paidPublicComps = useMemo(() => liveComps.filter((comp) => n(comp.entryFee) > 0 && String(comp.visibility || "public").toLowerCase() === "public"), [liveComps]);',
  "private creator tournament filtering",
  'String(comp.visibility || "public").toLowerCase() === "public"',
);

source = source.replace(
  '<b>FREE Card Cups:</b> N$0 entry. Use your Common cards to compete for a Rare player-card reward. Once awarded, the Rare card joins your Collection—you can keep it, use it in eligible Rare tournaments, or list it on the Marketplace when trading is open.',
  '<b>FREE Card Cups:</b> N$0 entry. Each cup clearly shows the card rarity required to enter and the player-card rarity you can win. Awarded cards join your Collection—you can keep them, use them in eligible rarity tournaments, or list them on the Marketplace when trading is open.',
);

const prizeEconomics = `function PrizeEconomics({ comp }: { comp: CompetitionWithEntries }) {
  const freeCardCup = n(comp.entryFee) <= 0 && (comp.isFreeCardCup || Boolean((comp as any).prizeCardRarity));
  const cashTournament = String((comp as any).prizeType || "").toLowerCase() === "cash_pool";
  if (freeCardCup) {
    const rarity = String((comp as any).prizeCardRarity || "player");
    const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    return <div className="space-y-3 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/70">Free-to-play card reward</div><b className="text-base">Win a {label} Player Card</b></div><Badge className="bg-emerald-300 text-emerald-950">N$0 ENTRY</Badge></div><div className="grid gap-2 sm:grid-cols-3"><InfoPill label="Entry" value="FREE" helper="No wallet balance needed" /><InfoPill label="Your cards" value={\`5 \${String(comp.tier || "common").replace(/^./, (c) => c.toUpperCase())}\`} helper="GK • DEF • MID • FWD • Utility" /><InfoPill label="Winner reward" value={\`\${label} Card\`} helper="Keep • use • list" /></div><p className="text-xs leading-5 text-emerald-100/75">The winning card becomes part of your Collection after award. Keep it, use it in eligible {label} tournaments, or list it on the Marketplace when trading is open.</p></div>;
  }
  if (cashTournament) {
    const revenue = n(comp.currentEntrantRevenue) || n(comp.entryFee) * n(comp.entryCount);
    const feeRate = n((comp as any).platformFeeRate) || 0.1;
    const prizePool = n((comp as any).prizePoolTotal) || revenue * (1 - feeRate);
    const mode = String((comp as any).prizeDistribution || "winner_takes_all");
    const rules = Array.isArray((comp as any).prizeDistributionRules) ? (comp as any).prizeDistributionRules : [];
    const top3 = [1, 2, 3].map((rank) => n(rules.find((rule: any) => Number(rule?.rank) === rank)?.percent));
    const split = mode === "top3" ? \`\${top3[0] || 60}% / \${top3[1] || 30}% / \${top3[2] || 10}%\` : "100% to 1st";
    return <div className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/60">Creator cash tournament</div><b className="text-base">Cash Prize Pool</b></div><Badge className="bg-cyan-300 text-slate-950">10% PLATFORM FEE</Badge></div><div className="grid gap-2 sm:grid-cols-4"><InfoPill label="Entry" value={\`N$\${money(comp.entryFee)}\`} helper="Per entry" /><InfoPill label="Gross entries" value={\`N$\${money(revenue)}\`} helper="Current pool funding" /><InfoPill label="Prize pool" value={\`N$\${money(prizePool)}\`} helper="90% after platform fee" /><InfoPill label="Payout" value={mode === "top3" ? "Top 3" : "Winner"} helper={split} /></div><p className="text-xs text-cyan-100/70">User-created tournaments are cash-only. Prize Ladder and player-card rewards are official Fantasy Arena admin competitions.</p></div>;
  }
  const revenue = n(comp.currentEntrantRevenue) || n(comp.entryFee) * n(comp.entryCount);
  const target = n(comp.prizeUnlockTarget);
  const progress = prizeProgress(comp);
  return <div className="space-y-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{comp.prizeDescription || "Prize"}</b>{comp.prizeValue ? \` • value N$\${money(comp.prizeValue)}\` : ""}</div><Link href="/prize-vault" className="text-xs font-bold underline">View Prize Vault</Link></div><div className="grid gap-2 sm:grid-cols-4"><InfoPill label="Entry" value={\`N$\${money(comp.entryFee)}\`} helper="Per player" /><InfoPill label="Players" value={\`\${comp.entryCount || 0}/\${comp.requiredEntrants || 0}\`} helper="This GW only" /><InfoPill label="Unlock target" value={\`N$\${money(target)}\`} helper="Rarity funding target" /><InfoPill label="Current revenue" value={\`N$\${money(revenue)}\`} helper={comp.prizeUnlocked ? "Unlocked" : \`\${progress}% unlocked\`} /></div><div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-300" style={{ width: \`\${progress}%\` }} /></div><p className="text-xs text-emerald-100/70">Official Prize Ladder rewards unlock from qualifying entries for this gameweek. Next gameweek entries, points and Prize Vault progress reset.</p></div>;
}
`;
replaceSection("function PrizeEconomics(", "function ArenaPulse", prizeEconomics, "cash prize economics", "Creator cash tournament");

const createTab = `        <TabsContent value="create">
          <Card className="cinematic-glass space-y-5 border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
            <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-yellow-300" /><h2 className="text-lg font-semibold">Create a Cash Tournament</h2></div>
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50"><b>User-created tournaments are cash-only.</b> Fantasy Arena keeps a 10% platform fee and 90% of entry fees fund the cash prize pool. Prize Ladder and player-card prizes are official admin tournaments.</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span className="text-white/55">Name</span><input className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} /></label>
              <label className="space-y-1 text-sm"><span className="text-white/55">Card rarity required</span><select className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 capitalize text-white" value={createForm.tier} onChange={(e) => { const tier = e.target.value; const fees = creatorEntryFeesByRarity[tier] || [10]; setCreateForm({ ...createForm, tier, entryFee: String(fees[0]) }); }}>{rarityOptions.map((tier) => <option key={tier} value={tier}>{tier} cards</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="text-white/55">Entry Fee (N$)</span><select className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.entryFee} onChange={(e) => setCreateForm({ ...createForm, entryFee: e.target.value })}>{(creatorEntryFeesByRarity[createForm.tier] || []).map((fee) => <option key={fee} value={String(fee)}>N\${fee}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span className="text-white/55">Max Players</span><input type="number" min="2" max="500" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.maxEntries} onChange={(e) => setCreateForm({ ...createForm, maxEntries: e.target.value })} /></label>
              <label className="space-y-1 text-sm"><span className="text-white/55">Visibility</span><select className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.visibility} onChange={(e) => setCreateForm({ ...createForm, visibility: e.target.value })}><option value="private">Private — share code</option><option value="public">Public — also gets share code</option></select></label>
              <label className="space-y-1 text-sm"><span className="text-white/55">Cash payout</span><select className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.payoutMode} onChange={(e) => setCreateForm({ ...createForm, payoutMode: e.target.value })}><option value="winner_takes_all">Winner takes all — 100%</option><option value="top3">Top 3 — choose percentages</option></select></label>
            </div>
            {createForm.payoutMode === "top3" && <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4"><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-sm"><span className="text-white/55">1st place %</span><input type="number" min="1" max="98" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.firstPercent} onChange={(e) => setCreateForm({ ...createForm, firstPercent: e.target.value })} /></label><label className="space-y-1 text-sm"><span className="text-white/55">2nd place %</span><input type="number" min="1" max="98" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.secondPercent} onChange={(e) => setCreateForm({ ...createForm, secondPercent: e.target.value })} /></label><label className="space-y-1 text-sm"><span className="text-white/55">3rd place %</span><input type="number" min="1" max="98" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" value={createForm.thirdPercent} onChange={(e) => setCreateForm({ ...createForm, thirdPercent: e.target.value })} /></label></div><div className={\`text-sm font-bold \${payoutValid ? "text-emerald-300" : "text-red-300"}\`}>Total: {payoutPercentTotal}% {payoutValid ? "✓" : "— must equal 100%"}</div></div>}
            <div className="grid gap-2 sm:grid-cols-4"><InfoPill label="Platform fee" value={\`N$\${money(platformFeePreview)}\`} helper="10% per entry" /><InfoPill label="Prize pool" value={\`N$\${money(prizePreview)}\`} helper="90% per entry" /><InfoPill label="Payout" value={createForm.payoutMode === "top3" ? "Top 3" : "Winner"} helper={createForm.payoutMode === "top3" ? \`\${createForm.firstPercent}% / \${createForm.secondPercent}% / \${createForm.thirdPercent}%\` : "100% to first"} /><InfoPill label="Share code" value="Always" helper="Visible in My Tournaments" /></div>
            <Button onClick={() => createTournamentMutation.mutate()} disabled={createTournamentMutation.isPending || !payoutValid}>{createTournamentMutation.isPending ? "Creating..." : "Create Cash Tournament"}</Button>
            {createdPin && <div className="rounded-xl border border-green-400/30 bg-green-400/10 p-4 text-sm space-y-3"><div><div className="mb-1 text-white/55">Permanent tournament share code</div><div className="flex items-center gap-2"><code className="text-2xl font-bold tracking-[0.3em]">{createdPin}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(createdPin); toast({ title: "Share code copied" }); }}><Copy className="h-4 w-4" /></Button></div></div><div><div className="mb-1 text-white/55">Invite link</div><div className="flex items-center gap-2"><code className="rounded bg-black/40 px-2 py-1 text-xs break-all">{createdInviteLink}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(createdInviteLink); toast({ title: "Invite link copied" }); }}><Copy className="h-4 w-4" /></Button></div></div><p className="text-xs text-green-100/70">This code also stays visible under My Tournaments, so you can copy and share it later.</p></div>}
          </Card>
        </TabsContent>
`;
replaceSection('        <TabsContent value="create">', '      </Tabs>', createTab, "cash creator tab", "Create a Cash Tournament");

const cardStart = source.indexOf("function CompetitionCard(");
if (cardStart < 0) throw new Error("Tournament creator client patch could not find CompetitionCard");
if (!source.slice(cardStart).includes("const cashTournament =")) {
  const cleanCard = `function CompetitionCard({ comp, entered, onJoin }: { comp: CompetitionWithEntries; entered: boolean; onJoin: () => void }) {
  const entryCount = n(comp.entryCount || (comp.entries || []).length);
  const maxEntries = n(comp.max_entries || comp.maxEntries);
  const freeCardCup = n(comp.entryFee) <= 0 && (comp.isFreeCardCup || Boolean((comp as any).prizeCardRarity));
  const cashTournament = String((comp as any).prizeType || "").toLowerCase() === "cash_pool";
  const rewardRarity = String((comp as any).prizeCardRarity || "player");
  const rewardLabel = rewardRarity.charAt(0).toUpperCase() + rewardRarity.slice(1) + " Card";
  const progress = freeCardCup ? 100 : maxEntries ? Math.min(100, Math.round((entryCount / maxEntries) * 100)) : cashTournament ? 100 : prizeProgress(comp);
  const countdown = tournamentCountdown(comp);
  const settlement = tournamentSettlementLabel(comp);
  const schedule = comp.entryOpen === false || comp.status === "active" || comp.status === "closed" ? \`settles \${settlement}\` : \`entries lock in \${countdown}\`;
  return <Card className={freeCardCup ? "group relative overflow-hidden rounded-[2rem] border-emerald-300/30 bg-emerald-950/30 p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)]" : "group relative overflow-hidden rounded-[2rem] border-white/10 bg-slate-950/70 p-0 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(2,6,23,.28)]"}><div className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge className="capitalize bg-primary/20 text-primary-foreground">{comp.tier}</Badge>{freeCardCup && <Badge className="bg-emerald-300 text-emerald-950">FREE ENTRY</Badge>}{cashTournament && <Badge className="bg-cyan-300/20 text-cyan-100">CASH</Badge>}</div><h3 className="mt-2 text-xl font-black">{comp.name}</h3><p className="text-xs text-white/45">GW {comp.gameWeek} • {schedule}</p></div>{entered ? <Badge className="bg-emerald-400/20 text-emerald-100">Entered</Badge> : comp.entryOpen === false ? <Badge className="bg-red-400/20 text-red-100"><Lock className="mr-1 h-3 w-3" />Locked</Badge> : <Badge className="bg-cyan-400/20 text-cyan-100">Open</Badge>}</div><div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/55"><Clock className="mr-2 inline h-3.5 w-3.5" />Premier League gameweek points only. Cup matches and fixtures after settlement are excluded.</div><PrizeEconomics comp={comp} /><div className="grid grid-cols-2 gap-2 text-sm"><InfoPill label="Entrants" value={\`\${entryCount}\${maxEntries ? \`/\${maxEntries}\` : ""}\`} helper="This GW only" /><InfoPill label={freeCardCup ? "Reward" : cashTournament ? "Prize" : "Progress"} value={freeCardCup ? rewardLabel : cashTournament ? "Cash Pool" : \`\${progress}%\`} helper={freeCardCup ? "Winner player card" : cashTournament ? "90% of entry fees" : comp.prizeUnlocked ? "Prize unlocked" : "Prize locked"} /></div>{!freeCardCup && !cashTournament && <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: \`\${progress}%\` }} /></div>}<Button onClick={onJoin} disabled={entered || comp.entryOpen === false} className={freeCardCup ? "w-full rounded-xl bg-emerald-400 font-bold text-emerald-950 hover:bg-emerald-300" : "w-full rounded-xl bg-primary font-bold"}>{entered ? "Already Entered" : comp.entryOpen === false ? "Closed" : freeCardCup ? "Enter FREE Card Cup" : \`Enter N$\${money(comp.entryFee)}\`}</Button></div></Card>;
}
`;
  source = source.slice(0, cardStart) + cleanCard;
}

fs.writeFileSync(file, source);
console.log("[tournaments] Applied cash-only creator UI, 10% fee, payout splits, permanent share codes and admin/free prize separation");
