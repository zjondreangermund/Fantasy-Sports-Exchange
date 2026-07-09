import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { Plus, Save, Trophy } from "lucide-react";

const rarityOptions = ["common", "rare", "epic", "unique", "legendary"];
const statusOptions = ["open", "upcoming", "active", "completed"];
const prizeTypeOptions = [
  { value: "goods", label: "Goods only" },
  { value: "goods_plus_cash", label: "Goods + cash" },
  { value: "cash_pool", label: "Cash pool" },
  { value: "packs", label: "Card packs" },
  { value: "sponsor_prize", label: "Sponsor prize" },
];

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

function defaultStartForGw(gw: number) {
  const base = new Date("2026-08-14T19:00:00+02:00");
  base.setDate(base.getDate() + (Math.max(1, gw) - 1) * 7);
  return isoLocal(base);
}

function defaultEndForGw(gw: number) {
  const d = new Date(defaultStartForGw(gw));
  d.setDate(d.getDate() + 3);
  d.setHours(23, 59, 0, 0);
  return isoLocal(d);
}

function buildEmptyForm() {
  return {
    id: "",
    name: "GW1 Community Cup",
    tier: "common",
    status: "open",
    gameWeek: "1",
    entryFee: "0",
    maxEntries: "100",
    visibility: "public",
    prizeType: "goods",
    prizeKey: "ps5",
    prizeDescription: "PlayStation 5 Console",
    startDate: defaultStartForGw(1),
    endDate: defaultEndForGw(1),
  };
}

export default function AdminTournamentManager() {
  const { toast } = useToast();
  const [form, setForm] = useState(buildEmptyForm());

  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: prizePayload } = useQuery<any>({ queryKey: ["/api/admin/prizes"] });
  const prizes = Array.isArray(prizePayload?.prizes) ? prizePayload.prizes : [];
  const sortedCompetitions = useMemo(() => [...(Array.isArray(competitions) ? competitions : [])].sort((a, b) => Number(a.gameWeek || 0) - Number(b.gameWeek || 0) || Number(a.id || 0) - Number(b.id || 0)), [competitions]);

  const selectedPrize = prizes.find((p: any) => p.key === form.prizeKey);

  const setField = (key: string, value: string) => {
    setForm((prev) => {
      const next: any = { ...prev, [key]: value };
      if (key === "gameWeek") {
        const gw = Number(value || 1);
        next.startDate = defaultStartForGw(gw);
        next.endDate = defaultEndForGw(gw);
      }
      if (key === "prizeKey") {
        const prize = prizes.find((p: any) => p.key === value);
        if (prize) {
          next.prizeDescription = prize.title;
          next.prizeType = prize.type || "goods";
        }
      }
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        tier: form.tier,
        status: form.status,
        gameWeek: Number(form.gameWeek || 1),
        entryFee: Number(form.entryFee || 0),
        maxEntries: Number(form.maxEntries || 0),
        visibility: form.visibility,
        prizeType: form.prizeType,
        prizeKey: form.prizeKey,
        prizeDescription: form.prizeDescription,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      const url = form.id ? `/api/admin/competitions/${form.id}` : "/api/admin/competitions";
      const method = form.id ? "PATCH" : "POST";
      const res = await apiRequest(method, url, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: form.id ? "Tournament updated" : "Tournament created", description: "26/27 gameweek cutoff is linked to first kickoff." });
      if (!form.id) setForm(buildEmptyForm());
    },
    onError: (error: any) => toast({ title: "Tournament save failed", description: error.message, variant: "destructive" }),
  });

  const loadCompetition = (comp: any) => {
    setForm({
      id: String(comp.id || ""),
      name: comp.name || "",
      tier: String(comp.tier || "common"),
      status: String(comp.status || "open"),
      gameWeek: String(comp.gameWeek || comp.game_week || 1),
      entryFee: String(comp.entryFee ?? comp.entry_fee ?? 0),
      maxEntries: String(comp.maxEntries ?? comp.max_entries ?? ""),
      visibility: String(comp.visibility || "public"),
      prizeType: String(comp.prizeType || comp.prize_type || "goods"),
      prizeKey: String(comp.prizeKey || comp.prize_key || "custom"),
      prizeDescription: String(comp.prizeDescription || comp.prize_description || ""),
      startDate: isoLocal(comp.startDate || comp.start_date),
      endDate: isoLocal(comp.endDate || comp.end_date),
    });
  };

  return (
    <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-yellow-300" /> Official Tournament Builder</div>
          <p className="mt-1 text-sm text-white/45">Create/edit 2026/27 tournaments, select goods prizes, and keep entries open until the first real fixture of that gameweek kicks off.</p>
        </div>
        <Button onClick={() => setForm(buildEmptyForm())} className="rounded-xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><Plus className="mr-2 h-4 w-4" />New</Button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Tournament name</span><Input value={form.name} onChange={(e) => setField("name", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Gameweek 26/27</span><Input type="number" min="1" max="38" value={form.gameWeek} onChange={(e) => setField("gameWeek", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Rarity gate</span><select value={form.tier} onChange={(e) => setField("tier", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{rarityOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Entry fee</span><Input type="number" min="0" value={form.entryFee} onChange={(e) => setField("entryFee", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Max players</span><Input type="number" min="2" value={form.maxEntries} onChange={(e) => setField("maxEntries", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Status</span><select value={form.status} onChange={(e) => setField("status", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 capitalize text-white">{statusOptions.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Visibility</span><select value={form.visibility} onChange={(e) => setField("visibility", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="public">Public</option><option value="private">Private PIN</option></select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Prize type</span><select value={form.prizeType} onChange={(e) => setField("prizeType", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white">{prizeTypeOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Goods prize</span><select value={form.prizeKey} onChange={(e) => setField("prizeKey", e.target.value)} className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="custom">Custom / manual</option>{prizes.map((p: any) => <option key={p.key} value={p.key}>{p.title} — {money(p.value)}</option>)}</select></label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="text-white/55">Prize description</span><Input value={form.prizeDescription} onChange={(e) => setField("prizeDescription", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">Manual fallback start</span><Input type="datetime-local" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
            <label className="space-y-1 text-sm"><span className="text-white/55">End date</span><Input type="datetime-local" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} className="border-white/10 bg-black/40 text-white" /></label>
          </div>
          {selectedPrize && <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">Selected goods: <b>{selectedPrize.title}</b> worth approx {money(selectedPrize.value)}.</div>}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full rounded-xl bg-yellow-300 font-black text-slate-950 hover:bg-yellow-200"><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Saving..." : form.id ? "Save Changes" : "Create Official Tournament"}</Button>
        </div>

        <div className="max-h-[48rem] space-y-2 overflow-y-auto pr-1">
          {sortedCompetitions.map((comp) => (
            <button key={comp.id} onClick={() => loadCompetition(comp)} className={`w-full rounded-xl border p-3 text-left text-sm transition ${String(form.id) === String(comp.id) ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25 hover:bg-white/10"}`}>
              <div className="flex items-center justify-between gap-3"><span className="font-bold">{comp.name}</span><Badge className="capitalize">{comp.status}</Badge></div>
              <div className="mt-1 text-white/50">GW {comp.gameWeek} • {comp.tier} • Entry {money(comp.entryFee)} • {comp.prizeDescription || comp.prizeCardRarity || "No prize"}</div>
              <div className="mt-1 text-xs text-cyan-100/60">Cutoff: {comp.submissionClosesAt ? new Date(comp.submissionClosesAt).toLocaleString() : "first fixture fallback"}</div>
            </button>
          ))}
          {sortedCompetitions.length === 0 && <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/45">No tournaments found.</div>}
        </div>
      </div>
    </Card>
  );
}
