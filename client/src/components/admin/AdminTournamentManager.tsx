import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { CheckCircle2, Gift, Plus, Save, Trash2, Trophy } from "lucide-react";

const rarityOptions = ["common", "rare", "unique", "epic", "legendary"];
const statusOptions = ["open", "upcoming", "active", "closed"];
const entryFeeByRarity: Record<string, number> = { common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 };
const marginByRarity: Record<string, number> = { common: 2.0, rare: 1.8, unique: 1.7, epic: 1.6, legendary: 1.5 };
const nextCardRarity: Record<string, string> = { common: "rare", rare: "unique", unique: "epic", epic: "legendary", legendary: "legendary" };
const rarityTone: Record<string, string> = {
  common: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  rare: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  unique: "border-purple-300/40 bg-purple-500/15 text-purple-100",
  epic: "border-red-300/40 bg-red-500/15 text-red-100",
  legendary: "border-amber-300/40 bg-amber-400/15 text-amber-100",
};

function cap(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""; }
function money(value: unknown) { const n = Number(value || 0); return `N$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`; }
function isoLocal(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStartForGw(gw: number) { const base = new Date("2026-08-14T19:00:00+02:00"); base.setDate(base.getDate() + (Math.max(1, gw) - 1) * 7); return isoLocal(base); }
function defaultEndForGw(gw: number) {
  const d = new Date(defaultStartForGw(gw));
  let daysForward = (2 - d.getDay() + 7) % 7;
  if (daysForward === 0) daysForward = 7;
  d.setDate(d.getDate() + daysForward);
  d.setHours(23, 59, 0, 0);
  return isoLocal(d);
}
function settlementLabel(value: unknown) {
  if (!value) return "Not set";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-NA", { timeZone: "Africa/Windhoek", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date) + " CAT";
}
function buildEmptyForm() {
  return {
    id: "", name: "GW1 Rare Vault", tier: "rare", status: "open", gameWeek: "1",
    entryFee: "50", maxEntries: "5000", visibility: "public", rewardMode: "ladder",
    prizeType: "goods", prizeKey: "ladder", prizeDescription: "Rare Prize Vault ladder",
    cardPrizeRarity: "unique", startDate: defaultStartForGw(1), endDate: defaultEndForGw(1),
  };
}

export default function AdminTournamentManager() {
  const { toast } = useToast();
  const [form, setForm] = useState(buildEmptyForm());
  const [previewRarity, setPreviewRarity] = useState("rare");
  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: prizePayload } = useQuery<any>({ queryKey: ["/api/admin/prizes"] });
  const prizes = Array.isArray(prizePayload?.prizes) ? prizePayload.prizes : [];
  const sortedCompetitions = useMemo(() => [...(Array.isArray(competitions) ? competitions : [])].sort((a, b) => Number(a.gameWeek || 0) - Number(b.gameWeek || 0) || Number(a.id || 0) - Number(b.id || 0)), [competitions]);
  const officialCompetitions = sortedCompetitions.filter((comp) => String(comp.prizeKey || comp.prize_key || "") !== "user-cash");
  const activeCompetitions = officialCompetitions.filter((comp) => !["completed", "closed", "cancelled"].includes(String(comp.status || "").toLowerCase()));
  const completedCompetitions = officialCompetitions.filter((comp) => ["completed", "closed", "cancelled"].includes(String(comp.status || "").toLowerCase()));
  const prizesByRarity = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const rarity of rarityOptions) groups[rarity] = [];
    for (const prize of prizes) groups[String(prize.rarity || "common").toLowerCase()]?.push(prize);
    for (const rarity of rarityOptions) groups[rarity].sort((a, b) => Number(a.requiredEntrants || 0) - Number(b.requiredEntrants || 0));
    return groups;
  }, [prizes]);
  const selectedLadder = prizesByRarity[form.tier] || [];
  const nextPrize = selectedLadder[0];
  const isCardPrize = form.rewardMode === "card";

  const setField = (key: string, value: string) => {
    setForm((prev) => {
      const next: any = { ...prev, [key]: value };
      if (key === "gameWeek") {
        const gw = Number(value || 1);
        next.startDate = defaultStartForGw(gw);
        next.endDate = defaultEndForGw(gw);
        if (!String(next.name || "").trim() || /^GW\d+\s/i.test(String(next.name))) {
          next.name = next.rewardMode === "card" ? `GW${gw} FREE ${cap(String(next.tier))} Card Cup` : `GW${gw} ${cap(String(next.tier))} Vault`;
        }
      }
      if (key === "tier") {
        setPreviewRarity(value);
        if (next.rewardMode === "card") {
          next.entryFee = "0";
          next.cardPrizeRarity = nextCardRarity[value] || value;
          next.prizeKey = `free-${next.cardPrizeRarity}-card`;
          next.prizeDescription = `${cap(next.cardPrizeRarity)} Player Card`;
          next.name = `GW${next.gameWeek || 1} FREE ${cap(value)} Card Cup`;
        } else {
          next.entryFee = String(entryFeeByRarity[value] || 50);
          next.prizeKey = "ladder";
          next.prizeDescription = `${cap(value)} Prize Vault ladder`;
          next.name = `GW${next.gameWeek || 1} ${cap(value)} Vault`;
        }
      }
      if (key === "rewardMode") {
        if (value === "card") {
          const prizeRarity = nextCardRarity[String(next.tier)] || String(next.tier);
          next.entryFee = "0";
          next.cardPrizeRarity = prizeRarity;
          next.prizeKey = `free-${prizeRarity}-card`;
          next.prizeDescription = `${cap(prizeRarity)} Player Card`;
          next.name = `GW${next.gameWeek || 1} FREE ${cap(String(next.tier))} Card Cup`;
        } else {
          next.entryFee = String(entryFeeByRarity[String(next.tier)] || 50);
          next.prizeKey = "ladder";
          next.prizeDescription = `${cap(String(next.tier))} Prize Vault ladder`;
          next.name = `GW${next.gameWeek || 1} ${cap(String(next.tier))} Vault`;
        }
      }
      if (key === "cardPrizeRarity" && next.rewardMode === "card") {
        next.prizeKey = `free-${value}-card`;
        next.prizeDescription = `${cap(value)} Player Card`;
      }
      return next;
    });
  };

  const applyFreeCupPreset = (tier: string) => {
    const prizeRarity = nextCardRarity[tier] || tier;
    setPreviewRarity(tier);
    setForm((prev) => ({
      ...prev,
      id: "",
      tier,
      rewardMode: "card",
      entryFee: "0",
      cardPrizeRarity: prizeRarity,
      prizeType: "goods",
      prizeKey: `free-${prizeRarity}-card`,
      prizeDescription: `${cap(prizeRarity)} Player Card`,
      name: `GW${prev.gameWeek || 1} FREE ${cap(tier)} Card Cup`,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cardMode = form.rewardMode === "card";
      const body = {
        name: form.name,
        tier: form.tier,
        status: form.status,
        gameWeek: Number(form.gameWeek || 1),
        entryFee: cardMode ? 0 : Number(form.entryFee || 0),
        maxEntries: Number(form.maxEntries || 0),
        visibility: form.visibility,
        prizeMode: cardMode ? "card" : "ladder",
        prizeCardRarity: cardMode ? form.cardPrizeRarity : null,
        prizeType: "goods",
        prizeKey: cardMode ? `free-${form.cardPrizeRarity}-card` : "ladder",
        prizeDescription: cardMode ? `${cap(form.cardPrizeRarity)} Player Card` : `${cap(form.tier)} Prize Vault ladder`,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      const res = await apiRequest(form.id ? "PATCH" : "POST", form.id ? `/api/admin/competitions/${form.id}` : "/api/admin/competitions", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({
        title: form.id ? "Tournament updated" : "Tournament created",
        description: form.rewardMode === "card" ? `FREE ${cap(form.tier)} cup awards a ${cap(form.cardPrizeRarity)} player card.` : `${cap(form.tier)} Prize Ladder linked (admin only).`,
      });
      if (!form.id) setForm(buildEmptyForm());
    },
    onError: (error: any) => toast({ title: "Tournament save failed", description: error.message, variant: "destructive" }),
  });

  const settleMutation = useMutation({
    mutationFn: async (competitionId: number) => (await apiRequest("POST", `/api/admin/competitions/settle/${competitionId}`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backoffice?range=30d"] });
      toast({ title: "Tournament settled", description: "Tuesday-frozen scores, ranks and prizes are now final." });
    },
    onError: (error: any) => toast({ title: "Tournament settlement failed", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (competitionId: number) => (await apiRequest("DELETE", `/api/admin/competitions/${competitionId}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prize-vault"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backoffice?range=30d"] });
      setForm(buildEmptyForm());
      toast({ title: "Tournament deleted" });
    },
    onError: (error: any) => toast({ title: "Tournament deletion failed", description: error.message, variant: "destructive" }),
  });

  const requestDelete = (comp: any) => {
    if (!window.confirm(`Delete "${comp.name || "this tournament"}" and all related entries? This cannot be undone.`)) return;
    deleteMutation.mutate(Number(comp.id));
  };
  const requestSettlement = (comp: any) => {
    if (!window.confirm(`Settle "${comp.name || "this tournament"}" using the score frozen at ${settlementLabel(comp.endDate || comp.end_date)}?`)) return;
    settleMutation.mutate(Number(comp.id));
  };

  const loadCompetition = (comp: any) => {
    const tier = String(comp.tier || "common").toLowerCase();
    const prizeKey = String(comp.prizeKey || comp.prize_key || "");
    const prizeCardRarity = String(comp.prizeCardRarity || comp.prize_card_rarity || nextCardRarity[tier] || tier).toLowerCase();
    const rewardMode = prizeKey.startsWith("free-") && Boolean(prizeCardRarity) ? "card" : "ladder";
    setPreviewRarity(tier);
    setForm({
      id: String(comp.id || ""), name: comp.name || "", tier, status: String(comp.status || "open"),
      gameWeek: String(comp.gameWeek || comp.game_week || 1),
      entryFee: rewardMode === "card" ? "0" : String(comp.entryFee ?? comp.entry_fee ?? entryFeeByRarity[tier] ?? 50),
      maxEntries: String(comp.maxEntries ?? comp.max_entries ?? ""), visibility: String(comp.visibility || "public"),
      rewardMode, prizeType: "goods", prizeKey: rewardMode === "card" ? prizeKey : "ladder",
      prizeDescription: String(comp.prizeDescription || comp.prize_description || (rewardMode === "card" ? `${cap(prizeCardRarity)} Player Card` : `${cap(tier)} Prize Vault ladder`)),
      cardPrizeRarity: prizeCardRarity,
      startDate: isoLocal(comp.startDate || comp.start_date), endDate: isoLocal(comp.endDate || comp.end_date),
    });
  };

  return (
    <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-yellow-300" /> Official Tournament Builder</div>
          <p className="mt-1 text-sm text-white/45">Prize Ladder and player-card prizes are official admin rewards. User-created tournaments are kept separate and cash-only.</p>
        </div>
        <div className="flex gap-2"><Link href="/prize-vault"><Button variant="outline" className="rounded-xl border-emerald-300/30 bg-emerald-300/10 text-emerald-100"><Gift className="mr-2 h-4 w-4" />Prize Vault</Button></Link><Button onClick={() => setForm(buildEmptyForm())} className="rounded-xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Plus className="mr-2 h-4 w-4" />New</Button></div>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
        <div className="mb-2 text-xs font-black uppercase tracking-[.16em] text-emerald-100">FREE Card Cup presets — one for every entry rarity</div>
        <div className="flex flex-wrap gap-2">{rarityOptions.map((rarity) => <Button key={rarity} size="sm" variant="outline" onClick={() => applyFreeCupPreset(rarity)} className="capitalize border-emerald-300/30 bg-black/20 text-emerald-50">FREE {rarity}</Button>)}</div>
        <p className="mt-2 text-xs text-emerald-100/70">Default progression: Common → Rare prize, Rare → Unique, Unique → Epic, Epic → Legendary, Legendary → Legendary. You can override the card-prize rarity below.</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Tournament name</span><Input value={form.name} onChange={(e) => setField("name", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Gameweek 26/27</span><Input type="number" min="1" max="38" value={form.gameWeek} onChange={(e) => setField("gameWeek", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Entry card rarity</span><select value={form.tier} onChange={(e) => setField("tier", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{rarityOptions.map((x) => <option key={x} value={x}>{x} cards</option>)}</select></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Official prize mode</span><select value={form.rewardMode} onChange={(e) => setField("rewardMode", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="ladder">Prize Ladder — admin only</option><option value="card">FREE Player Card Prize</option></select></label>
            {isCardPrize && <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Winner card prize rarity</span><select value={form.cardPrizeRarity} onChange={(e) => setField("cardPrizeRarity", e.target.value)} className="w-full rounded-md border border-emerald-300/20 bg-black/40 px-3 py-2 capitalize text-white">{rarityOptions.map((x) => <option key={x} value={x}>{x} player card</option>)}</select></label>}
            <label className="space-y-1 text-sm"><span className="text-white/55">Entry fee</span><Input type="number" min="0" disabled={isCardPrize} value={isCardPrize ? "0" : form.entryFee} onChange={(e) => setField("entryFee", e.target.value)} className="border-white/10 bg-black/40 text-white disabled:opacity-70" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Max players</span><Input type="number" min="2" value={form.maxEntries} onChange={(e) => setField("maxEntries", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Status</span><select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{statusOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Visibility</span><select value={form.visibility} onChange={(e) => setField("visibility", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="public">Public</option><option value="private">Private PIN</option></select></label>
            <div className={`md:col-span-2 rounded-xl border p-3 text-sm ${isCardPrize ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-50"}`}>
              {isCardPrize ? <><b>FREE card prize:</b> N$0 entry using {cap(form.tier)} cards. Winner receives a random eligible {cap(form.cardPrizeRarity)} player card into Collection.</> : <><b>Admin Prize Ladder:</b> {form.tier.toUpperCase()} ladder. First unlock: {nextPrize ? `${nextPrize.title} at ${nextPrize.requiredEntrants} entries` : "loading..."}. Margin: {marginByRarity[form.tier] || 1.8}x.</>}
            </div>
            <label className="space-y-1 text-sm"><span className="text-white/55">Entries open from</span><Input type="datetime-local" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Tuesday settlement cutoff</span><Input type="datetime-local" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <div className="md:col-span-2 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">Only Premier League FPL points recorded before this settlement cutoff count. FA Cup matches and Premier League fixtures played later are excluded.</div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full rounded-xl bg-yellow-300 font-black text-slate-950 hover:bg-yellow-200"><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : form.id ? "Save Changes" : isCardPrize ? "Create FREE Card Cup" : "Create Prize Ladder Tournament"}</Button>
        </div>

        <div className="space-y-3">
          {isCardPrize ? <div className={`rounded-2xl border p-5 ${rarityTone[form.cardPrizeRarity] || rarityTone.common}`}><div className="text-xs font-black uppercase tracking-[.18em]">Player card prize</div><div className="mt-2 text-2xl font-black">{cap(form.cardPrizeRarity)} Player Card</div><div className="mt-2 text-sm opacity-75">Winner receives the card directly into Collection. It can be kept, used in eligible tournaments, or listed on the Marketplace when trading is open.</div><Badge className="mt-4 bg-emerald-300 text-emerald-950">N$0 ENTRY</Badge></div> : <div className={`rounded-2xl border p-3 ${rarityTone[previewRarity] || rarityTone.common}`}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black uppercase tracking-[.14em]">{previewRarity} Prize Ladder preview</h3><Badge className="capitalize">Entry {money(entryFeeByRarity[previewRarity] || 0)}</Badge></div><div className="mb-3 flex flex-wrap gap-2">{rarityOptions.map((r) => <button key={r} onClick={() => setPreviewRarity(r)} className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${previewRarity === r ? "bg-white text-slate-950" : "border-white/15 bg-black/25 text-white/70"}`}>{r}</button>)}</div><div className="grid max-h-[24rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">{(prizesByRarity[previewRarity] || []).map((p: any) => <div key={p.key} className="rounded-xl border border-white/10 bg-black/25 p-2 text-xs"><div className="font-bold text-white">#{p.tierIndex} {p.title}</div><div className="text-white/55">Value {money(p.value)} • target {money(p.unlockTarget)}</div><div className="mt-1 font-black text-cyan-100">Unlocks at {p.requiredEntrants} entries</div></div>)}</div></div>}
          <div className="max-h-[34rem] space-y-4 overflow-y-auto pr-1">
            <TournamentList title="Current & Upcoming" competitions={activeCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onSettle={requestSettlement} deleting={deleteMutation.isPending} settling={settleMutation.isPending} />
            <TournamentList title="Closed & Completed" competitions={completedCompetitions} selectedId={form.id} onLoad={loadCompetition} onDelete={requestDelete} onSettle={requestSettlement} deleting={deleteMutation.isPending} settling={settleMutation.isPending} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function TournamentList({ title, competitions, selectedId, onLoad, onDelete, onSettle, deleting, settling }: any) {
  return <section><div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-black uppercase tracking-[.14em] text-white/60">{title}</h4><Badge variant="outline">{competitions.length}</Badge></div><div className="space-y-2">{competitions.length ? competitions.map((comp: any) => { const status = String(comp.status || "").toLowerCase(); const settlement = comp.endDate || comp.end_date; const settlementMs = new Date(String(settlement || "")).getTime(); const readyToSettle = ["active", "closed"].includes(status) && Number.isFinite(settlementMs) && Date.now() >= settlementMs; const key = String(comp.prizeKey || comp.prize_key || ""); const isCard = key.startsWith("free-"); const prizeRarity = String(comp.prizeCardRarity || comp.prize_card_rarity || ""); return <div key={comp.id} className={`rounded-xl border p-3 text-sm transition ${String(selectedId) === String(comp.id) ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25"}`}><button onClick={() => onLoad(comp)} className="w-full text-left"><div className="flex items-center justify-between gap-3"><span className="font-bold">{comp.name}</span><Badge className="capitalize">{comp.status}</Badge></div><div className="mt-1 text-white/50">GW {comp.gameWeek ?? comp.game_week} • {comp.tier} cards • {isCard ? `FREE → ${prizeRarity || "card"} prize` : `Prize Ladder • Entry ${money(comp.entryFee ?? comp.entry_fee)}`}</div><div className="mt-1 text-xs text-cyan-100/60">Settlement: {settlementLabel(settlement)} • Entries: {comp.entryCount ?? comp.entry_count ?? 0}</div></button>{readyToSettle ? <Button size="sm" disabled={settling} onClick={() => onSettle(comp)} className="mt-3 w-full bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><CheckCircle2 className="mr-2 h-4 w-4" />{settling ? "Settling..." : "Settle Tuesday Results"}</Button> : null}<Button variant="destructive" size="sm" disabled={deleting} onClick={() => onDelete(comp)} className="mt-2 w-full"><Trash2 className="mr-2 h-4 w-4" />Delete Tournament</Button></div>; }) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/40">No tournaments in this section.</div>}</div></section>;
}
