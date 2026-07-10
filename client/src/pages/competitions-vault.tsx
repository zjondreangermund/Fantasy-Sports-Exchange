import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import CardThumbnail from "../components/CardThumbnail";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { type CompetitionEntry, type Lineup, type PlayerCardWithPlayer } from "../../../shared/schema";
import { CalendarDays, CheckCircle2, Clock3, Filter, Gift, Lock, Trophy } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const rarityOrder = ["common", "rare", "unique", "epic", "legendary"];
const rarityTheme: Record<string, { accent: string; glow: string; gradient: string }> = {
  common: { accent: "#60a5fa", glow: "rgba(59,130,246,.45)", gradient: "from-blue-500/25 via-slate-900/70 to-black" },
  rare: { accent: "#22d3ee", glow: "rgba(34,211,238,.48)", gradient: "from-cyan-500/25 via-slate-900/70 to-black" },
  unique: { accent: "#c084fc", glow: "rgba(168,85,247,.5)", gradient: "from-purple-500/30 via-slate-900/70 to-black" },
  epic: { accent: "#fb3b4a", glow: "rgba(251,59,74,.5)", gradient: "from-rose-500/30 via-slate-900/70 to-black" },
  legendary: { accent: "#f59e0b", glow: "rgba(245,158,11,.5)", gradient: "from-amber-500/30 via-slate-900/70 to-black" },
};

type Tournament = any;
const money = (value: unknown) => `N$${Number(value || 0).toFixed(2)}`;
const tier = (value: unknown) => String(value || "common").toLowerCase();
const dateLabel = (value: unknown) => { const d = new Date(String(value || "")); return Number.isFinite(d.getTime()) ? d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Fixture controlled"; };
const progress = (comp: Tournament) => { const target = Number(comp.requiredEntrants || 0); return target ? Math.min(100, Math.round((Number(comp.entryCount || 0) / target) * 100)) : 0; };

export default function CompetitionsVaultPage() {
  const { toast } = useToast();
  const [activeRarity, setActiveRarity] = useState("common");
  const [gameweekFilter, setGameweekFilter] = useState<number | "current">("current");
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);

  const { data: competitions = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/competitions"],
    queryFn: async () => { const res = await fetch("/api/competitions", { credentials: "include" }); if (!res.ok) throw new Error("Failed to load tournaments"); const data = await res.json(); return Array.isArray(data) ? data : data.competitions || []; },
  });
  const { data: myCards = [] } = useQuery<PlayerCardWithPlayer[]>({ queryKey: ["/api/user/cards"], queryFn: async () => { const res = await fetch("/api/user/cards", { credentials: "include" }); if (!res.ok) return []; const data = await res.json(); return Array.isArray(data) ? data : data.cards || []; } });
  const { data: lineup } = useQuery<{ lineup: Lineup; cards: PlayerCardWithPlayer[] }>({ queryKey: ["/api/lineup"], queryFn: async () => { const res = await fetch("/api/lineup", { credentials: "include" }); if (!res.ok) return { lineup: { cardIds: [] } as Lineup, cards: [] }; return res.json(); } });
  const { data: entries = [] } = useQuery<CompetitionEntry[]>({ queryKey: ["/api/competitions/my-entries"], queryFn: async () => { const res = await fetch("/api/competitions/my-entries", { credentials: "include" }); return res.ok ? res.json() : []; } });

  const playable = useMemo(() => competitions.filter((c) => rarityOrder.includes(tier(c.tier)) && String(c.visibility || "public") !== "private"), [competitions]);
  const currentGw = useMemo(() => {
    const live = playable.filter((c) => ["open", "active"].includes(String(c.status))).map((c) => Number(c.gameWeek || 0)).filter(Boolean).sort((a, b) => a - b);
    if (live.length) return live[0];
    const upcoming = playable.filter((c) => c.status === "upcoming").map((c) => Number(c.gameWeek || 0)).filter(Boolean).sort((a, b) => a - b);
    return upcoming[0] || 1;
  }, [playable]);
  const gameweeks = useMemo(() => [...new Set(playable.map((c) => Number(c.gameWeek || 0)).filter(Boolean))].sort((a, b) => a - b), [playable]);
  const shownGw = gameweekFilter === "current" ? currentGw : gameweekFilter;
  const visible = playable.filter((c) => Number(c.gameWeek) === Number(shownGw) && tier(c.tier) === activeRarity);
  const enteredIds = new Set(entries.map((entry) => Number(entry.competitionId)));
  const selectedTier = tier(selected?.tier);
  const availableCards = myCards.filter((card) => !card.forSale && tier(card.rarity) === selectedTier);
  const selectedObjects = availableCards.filter((card) => selectedCards.includes(card.id));
  const positions = selectedObjects.map((card) => String(card.player?.position || ""));
  const validLineup = selectedCards.length === 5 && ["GK", "DEF", "MID", "FWD"].every((pos) => positions.includes(pos));

  const openTournament = (comp: Tournament) => {
    if (comp.entryOpen === false || comp.status !== "open") return toast({ title: "Entries closed", description: "This tournament locks at the first Premier League kickoff." });
    const saved = Array.isArray(lineup?.lineup?.cardIds) ? lineup!.lineup.cardIds.map(Number).filter((id) => availableCards.some((card) => card.id === id)).slice(0, 5) : [];
    setSelected(comp); setSelectedCards(saved); setCaptainId(saved[0] || null);
  };
  const toggleCard = (id: number) => setSelectedCards((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev);
  const joinMutation = useMutation({
    mutationFn: async () => { if (!selected || !captainId) throw new Error("Select five cards and a captain"); return (await apiRequest("POST", "/api/competitions/join", { competitionId: selected.id, cardIds: selectedCards, captainId })).json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/competitions"] }); queryClient.invalidateQueries({ queryKey: ["/api/competitions/my-entries"] }); setSelected(null); setSelectedCards([]); setCaptainId(null); toast({ title: "Tournament entered" }); },
    onError: (error: any) => toast({ title: "Could not enter", description: error.message, variant: "destructive" }),
  });

  return <main className="min-h-full overflow-x-hidden bg-[#02040c] px-3 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(124,58,237,.3),transparent_30%),linear-gradient(180deg,#090d20,#040711)] p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200/70">Official 2026/27 Arena</div><h1 className="mt-2 text-4xl font-black sm:text-6xl">Rarity Tournaments</h1><p className="mt-2 max-w-3xl text-sm text-white/55">Every public tournament created in Admin appears here and is grouped by rarity and gameweek.</p></div><div className="grid grid-cols-3 gap-2"><Stat icon={CalendarDays} label="Gameweek" value={`GW${shownGw}`} /><Stat icon={Trophy} label="Rarities" value="5" /><Stat icon={Clock3} label="Window" value="Tue–Tue" /></div></div>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto">{rarityOrder.map((rarity) => { const t = rarityTheme[rarity]; const count = playable.filter((c) => Number(c.gameWeek) === Number(shownGw) && tier(c.tier) === rarity).length; return <button key={rarity} onClick={() => setActiveRarity(rarity)} className="rounded-2xl border px-4 py-3 text-left sm:min-w-[160px]" style={{ borderColor: activeRarity === rarity ? t.accent : "rgba(255,255,255,.1)", background: activeRarity === rarity ? `${t.accent}18` : "rgba(0,0,0,.22)", boxShadow: activeRarity === rarity ? `0 0 28px ${t.glow}` : undefined }}><div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: t.accent }}>{rarity}</div><div className="mt-1 font-black">{count ? `${count} tournament${count > 1 ? "s" : ""}` : "No tournament"}</div></button>; })}</div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-white/45"><Filter className="h-4 w-4" />Gameweek filter</div><select value={gameweekFilter} onChange={(e) => setGameweekFilter(e.target.value === "current" ? "current" : Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="current">Current gameweek (GW{currentGw})</option>{gameweeks.map((gw) => <option key={gw} value={gw}>GW{gw}</option>)}</select><Link href="/prize-vault" className="sm:ml-auto"><Button variant="outline" className="w-full border-white/15 bg-white/5 text-white sm:w-auto"><Gift className="mr-2 h-4 w-4" />View {activeRarity} ladder</Button></Link></div>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{isLoading ? <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">Loading tournaments…</Card> : visible.length ? visible.map((comp) => <TournamentCard key={comp.id} comp={comp} entered={enteredIds.has(Number(comp.id))} onEnter={() => openTournament(comp)} />) : <Card className="col-span-full border-white/10 bg-white/5 p-8 text-center text-white/50">No {activeRarity} tournament found for GW{shownGw}.</Card>}</section>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}><DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto border-white/10 bg-slate-950 text-white"><DialogHeader><DialogTitle>Enter {selected?.name}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">Choose exactly five {selectedTier} cards: at least one GK, DEF, MID and FWD. Set a captain before entering.</div><div className="grid max-h-[54vh] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{availableCards.map((card) => <div key={card.id} className="relative mx-auto"><CardThumbnail card={card} size="sm" selected={selectedCards.includes(card.id)} selectable onClick={() => toggleCard(card.id)} />{selectedCards.includes(card.id) && <button onClick={() => setCaptainId(card.id)} className={`absolute left-1 top-1 z-40 h-8 w-8 rounded-full text-xs font-black ${captainId === card.id ? "bg-yellow-300 text-black" : "bg-slate-700 text-white"}`}>C</button>}</div>)}</div></div>}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={() => joinMutation.mutate()} disabled={!validLineup || !captainId || joinMutation.isPending}>{joinMutation.isPending ? "Entering…" : `Enter ${money(selected?.entryFee)}`}</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function TournamentCard({ comp, entered, onEnter }: { comp: Tournament; entered: boolean; onEnter: () => void }) {
  const r = tier(comp.tier); const t = rarityTheme[r] || rarityTheme.common; const p = progress(comp); const status = comp.entryOpen === false ? "Locked" : String(comp.status || "open");
  return <Card className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br ${t.gradient} p-5 text-white`} style={{ borderColor: `${t.accent}55`, boxShadow: `0 0 35px ${t.glow},0 24px 60px rgba(0,0,0,.45)` }}><div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,.12)_18%,transparent_38%)]" /><div className="relative"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: t.accent }}>{r} ladder</div><h2 className="mt-2 text-2xl font-black">{comp.name}</h2></div><Badge className="capitalize" style={{ background: `${t.accent}22`, color: t.accent }}>{status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Entry" value={money(comp.entryFee)} /><Metric label="Players" value={`${comp.entryCount || 0}/${comp.requiredEntrants || 0}`} /><Metric label="Current prize" value={comp.prizeDescription || "Prize ladder"} /><Metric label="Cutoff" value={dateLabel(comp.submissionClosesAt)} /></div><div className="mt-4"><div className="flex justify-between text-xs text-white/55"><span>Prize unlock progress</span><b>{p}%</b></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${p}%`, background: t.accent, boxShadow: `0 0 18px ${t.glow}` }} /></div></div><div className="mt-4 flex gap-2"><Link href="/prize-vault" className="flex-1"><Button variant="outline" className="w-full border-white/15 bg-black/20 text-white"><Gift className="mr-2 h-4 w-4" />Prize ladder</Button></Link><Button onClick={onEnter} disabled={entered || comp.entryOpen === false || comp.status !== "open"} className="flex-1 font-black" style={{ background: entered ? "#334155" : t.accent, color: r === "legendary" ? "#111827" : "white" }}>{entered ? <><CheckCircle2 className="mr-2 h-4 w-4" />Entered</> : comp.entryOpen === false ? <><Lock className="mr-2 h-4 w-4" />Closed</> : "Enter"}</Button></div></div></Card>;
}
function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.14em] text-white/40"><Icon className="h-3.5 w-3.5 text-purple-300" />{label}</div><div className="mt-2 font-black">{value}</div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase tracking-[.13em] text-white/35">{label}</div><div className="mt-1 line-clamp-2 text-sm font-black">{value}</div></div>; }
