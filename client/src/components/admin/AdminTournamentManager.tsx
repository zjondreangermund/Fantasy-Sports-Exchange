import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { Gift, Plus, Save, Trophy } from "lucide-react";

const rarityOptions = ["common", "rare", "unique", "epic", "legendary"];
const statusOptions = ["open", "upcoming", "active", "completed"];
const entryFeeByRarity: Record<string, number> = { common: 10, rare: 50, unique: 100, epic: 250, legendary: 500 };
const marginByRarity: Record<string, number> = { common: 2.0, rare: 1.8, unique: 1.7, epic: 1.6, legendary: 1.5 };
const rarityTone: Record<string, string> = {
  common: "border-slate-300/30 bg-slate-300/10 text-slate-100",
  rare: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  unique: "border-purple-300/40 bg-purple-500/15 text-purple-100",
  epic: "border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-100",
  legendary: "border-amber-300/40 bg-amber-400/15 text-amber-100",
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function isoLocal(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStartForGw(gw: number) { const base = new Date("2026-08-14T19:00:00+02:00"); base.setDate(base.getDate() + (Math.max(1, gw) - 1) * 7); return isoLocal(base); }
function defaultEndForGw(gw: number) { const d = new Date(defaultStartForGw(gw)); d.setDate(d.getDate() + 3); d.setHours(23, 59, 0, 0); return isoLocal(d); }
function buildEmptyForm() {
  return { id: "", name: "GW1 Rare Vault", tier: "rare", status: "open", gameWeek: "1", entryFee: "50", maxEntries: "5000", visibility: "public", prizeType: "goods", prizeKey: "ladder", prizeDescription: "Rare Prize Vault ladder", startDate: defaultStartForGw(1), endDate: defaultEndForGw(1) };
}

export default function AdminTournamentManager() {
  const { toast } = useToast();
  const [form, setForm] = useState(buildEmptyForm());
  const [previewRarity, setPreviewRarity] = useState("rare");
  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: prizePayload } = useQuery<any>({ queryKey: ["/api/admin/prizes"] });
  const prizes = Array.isArray(prizePayload?.prizes) ? prizePayload.prizes : [];
  const sortedCompetitions = useMemo(() => [...(Array.isArray(competitions) ? competitions : [])].sort((a, b) => Number(a.gameWeek || 0) - Number(b.gameWeek || 0) || Number(a.id || 0) - Number(b.id || 0)), [competitions]);
  const prizesByRarity = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const rarity of rarityOptions) groups[rarity] = [];
    for (const prize of prizes) groups[String(prize.rarity || "common").toLowerCase()]?.push(prize);
    for (const rarity of rarityOptions) groups[rarity].sort((a, b) => Number(a.requiredEntrants || 0) - Number(b.requiredEntrants || 0));
    return groups;
  }, [prizes]);
  const selectedLadder = prizesByRarity[form.tier] || [];
  const nextPrize = selectedLadder[0];

  const setField = (key: string, value: string) => {
    setForm((prev) => {
      const next: any = { ...prev, [key]: value };
      if (key === "gameWeek") { const gw = Number(value || 1); next.startDate = defaultStartForGw(gw); next.endDate = defaultEndForGw(gw); if (!String(next.name || "").trim() || /^GW\d+\s/i.test(String(next.name))) next.name = `GW${gw} ${String(next.tier || "rare").replace(/^./, (c) => c.toUpperCase())} Vault`; }
      if (key === "tier") { next.entryFee = String(entryFeeByRarity[value] || 50); next.prizeKey = "ladder"; next.prizeDescription = `${value.replace(/^./, (c) => c.toUpperCase())} Prize Vault ladder`; next.name = `GW${next.gameWeek || 1} ${value.replace(/^./, (c) => c.toUpperCase())} Vault`; setPreviewRarity(value); }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name: form.name, tier: form.tier, status: form.status, gameWeek: Number(form.gameWeek || 1), entryFee: Number(form.entryFee || 0), maxEntries: Number(form.maxEntries || 0), visibility: form.visibility, prizeType: form.prizeType, prizeKey: "ladder", prizeDescription: `${form.tier.replace(/^./, (c) => c.toUpperCase())} Prize Vault ladder`, startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString() };
      const res = await apiRequest(form.id ? "PATCH" : "POST", form.id ? `/api/admin/competitions/${form.id}` : "/api/admin/competitions", body);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }); toast({ title: form.id ? "Tournament updated" : "Tournament created", description: `${form.tier} ladder linked. Prize upscales as entries grow.` }); if (!form.id) setForm(buildEmptyForm()); },
    onError: (error: any) => toast({ title: "Tournament save failed", description: error.message, variant: "destructive" }),
  });

  const loadCompetition = (comp: any) => {
    const tier = String(comp.tier || "common").toLowerCase();
    setPreviewRarity(tier);
    setForm({ id: String(comp.id || ""), name: comp.name || "", tier, status: String(comp.status || "open"), gameWeek: String(comp.gameWeek || comp.game_week || 1), entryFee: String(comp.entryFee ?? comp.entry_fee ?? entryFeeByRarity[tier] ?? 50), maxEntries: String(comp.maxEntries ?? comp.max_entries ?? ""), visibility: String(comp.visibility || "public"), prizeType: String(comp.prizeType || comp.prize_type || "goods"), prizeKey: "ladder", prizeDescription: String(comp.prizeDescription || comp.prize_description || `${tier} Prize Vault ladder`), startDate: isoLocal(comp.startDate || comp.start_date), endDate: isoLocal(comp.endDate || comp.end_date) });
  };

  return (
    <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div><div className="flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-yellow-300" /> Official Tournament Builder</div><p className="mt-1 text-sm text-white/45">Create tournaments linked to a full rarity ladder. Admin no longer chooses one prize; the highest unlocked prize wins for that gameweek.</p></div>
        <div className="flex gap-2"><Link href="/prize-vault"><Button variant="outline" className="rounded-xl border-emerald-300/30 bg-emerald-300/10 text-emerald-100"><Gift className="mr-2 h-4 w-4" />Prize Vault</Button></Link><Button onClick={() => setForm(buildEmptyForm())} className="rounded-xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Plus className="mr-2 h-4 w-4" />New</Button></div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Tournament name</span><Input value={form.name} onChange={(e) => setField("name", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Gameweek 26/27</span><Input type="number" min="1" max="38" value={form.gameWeek} onChange={(e) => setField("gameWeek", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Rarity ladder</span><select value={form.tier} onChange={(e) => setField("tier", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{rarityOptions.map((x) => <option key={x} value={x}>{x} ladder</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Entry fee</span><Input type="number" min="0" value={form.entryFee} onChange={(e) => setField("entryFee", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Max players</span><Input type="number" min="2" value={form.maxEntries} onChange={(e) => setField("maxEntries", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Status</span><select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{statusOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Visibility</span><select value={form.visibility} onChange={(e) => setField("visibility", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="public">Public</option><option value="private">Private PIN</option></select></label>
            <div className="md:col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50"><b>Linked prize mode:</b> {form.tier.toUpperCase()} ladder. First unlock: {nextPrize ? `${nextPrize.title} at ${nextPrize.requiredEntrants} entries` : "loading..."}. Margin: {marginByRarity[form.tier] || 1.8}x.</div>
            <label className="space-y-1 text-sm"><span className="text-white/55">Manual fallback start</span><Input type="datetime-local" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">End date</span><Input type="datetime-local" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full rounded-xl bg-yellow-300 font-black text-slate-950 hover:bg-yellow-200"><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : form.id ? "Save Changes" : "Create Official Tournament"}</Button>
        </div>
        <div className="space-y-3">
          <div className={`rounded-2xl border p-3 ${rarityTone[previewRarity] || rarityTone.common}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black uppercase tracking-[.14em]">{previewRarity} ladder preview</h3><Badge className="capitalize">Entry {money(entryFeeByRarity[previewRarity] || 0)}</Badge></div>
            <div className="mb-3 flex flex-wrap gap-2">{rarityOptions.map((r) => <button key={r} onClick={() => setPreviewRarity(r)} className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${previewRarity === r ? "bg-white text-slate-950" : "border-white/15 bg-black/25 text-white/70"}`}>{r}</button>)}</div>
            <div className="grid max-h-[24rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {(prizesByRarity[previewRarity] || []).map((p: any) => <div key={p.key} className="rounded-xl border border-white/10 bg-black/25 p-2 text-xs"><div className="font-bold text-white">#{p.tierIndex} {p.title}</div><div className="text-white/55">Value {money(p.value)} • target {money(p.unlockTarget)}</div><div className="mt-1 font-black text-cyan-100">Unlocks at {p.requiredEntrants} entries</div></div>)}
            </div>
          </div>
          <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">{sortedCompetitions.map((comp) => <button key={comp.id} onClick={() => loadCompetition(comp)} className={`w-full rounded-xl border p-3 text-left text-sm transition ${String(form.id) === String(comp.id) ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25 hover:bg-white/10"}`}><div className="flex items-center justify-between gap-3"><span className="font-bold">{comp.name}</span><Badge className="capitalize">{comp.status}</Badge></div><div className="mt-1 text-white/50">GW {comp.gameWeek} • {comp.tier} ladder • Entry {money(comp.entryFee)} • {comp.prizeDescription || "Prize Vault ladder"}</div><div className="mt-1 text-xs text-cyan-100/60">Unlock: {comp.requiredEntrants || 0} entries • Current: {comp.entryCount || 0} • {comp.prizeUnlocked ? "Prize unlocked" : "Prize locked"}</div><div className="mt-1 text-xs text-cyan-100/60">Cutoff: {comp.submissionClosesAt ? new Date(comp.submissionClosesAt).toLocaleString() : "first fixture fallback"}</div></button>)}{sortedCompetitions.length === 0 && <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">No tournaments found.</div>}</div>
        </div>
      </div>
    </Card>
  );
}
