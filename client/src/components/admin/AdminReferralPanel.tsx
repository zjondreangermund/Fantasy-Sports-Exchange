import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, RefreshCw, Search, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function dateTime(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : String(value);
}

function Metric({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-2 text-2xl font-black text-white">{value}</div>{hint ? <div className="mt-1 text-xs text-white/45">{hint}</div> : null}</div>;
}

export default function AdminReferralPanel({ onOpenUser, onOpenCard }: { onOpenUser?: (userId: string) => void; onOpenCard?: (cardId: string) => void }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const query = useQuery<any>({
    queryKey: [`/api/admin/referrals?limit=500&q=${encodeURIComponent(search)}`],
    refetchInterval: 30_000,
  });

  const data = query.data || {};
  const summary = data.summary || {};
  const referrals = asArray(data.referrals);
  const topReferrers = asArray(data.topReferrers);
  const recentAudit = asArray(data.recentAudit);
  const problemRows = useMemo(() => referrals.filter((row) => !row.healthy), [referrals]);

  const applySearch = () => setSearch(searchInput.trim());

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-cyan-200" />Referral monitoring</div>
        <p className="mt-1 text-sm text-white/50">Live referral attribution, reward-card ownership and claim health. Refreshes every 30 seconds.</p>
      </div>
      <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} className="border-white/15 bg-white/5 text-white"><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
    </div>

    {query.error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">Referral monitor failed: {String((query.error as Error)?.message || query.error)}</div> : null}

    <div className={`rounded-2xl border p-4 ${summary.healthy ? "border-emerald-300/20 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/10"}`}>
      <div className="flex items-start gap-3">{summary.healthy ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />}<div><div className="font-black">{summary.healthy ? "Referral system healthy" : "Referral system needs attention"}</div><div className="mt-1 text-xs text-white/60">Schema {summary.schemaHealthy ? "OK" : "missing fields"} • {Number(summary.unhealthyRows || 0)} broken attribution row(s) • checked {dateTime(data.checkedAt)}</div></div></div>
      {asArray(data.missingSchema).length ? <div className="mt-3 text-xs text-amber-100">Missing schema: {asArray(data.missingSchema).join(", ")}</div> : null}
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <Metric label="Total referrals" value={Number(summary.totalReferrals || 0)} />
      <Metric label="Rewards granted" value={Number(summary.rewardedReferrals || 0)} />
      <Metric label="No reward card" value={Number(summary.withoutRewardCard || 0)} hint="Claim recorded, no card minted" />
      <Metric label="Unique referrers" value={Number(summary.uniqueReferrers || 0)} />
      <Metric label="Last 24h" value={Number(summary.last24h || 0)} />
      <Metric label="Last 7d" value={Number(summary.last7d || 0)} />
      <Metric label="Problems" value={Number(summary.unhealthyRows || 0)} />
    </div>

    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applySearch()} placeholder="Search referrer, referred user, email, code, card ID, player or status" className="min-h-11 border-white/10 bg-black/35" />
        <Button onClick={applySearch} className="min-h-11"><Search className="mr-2 h-4 w-4" />Search</Button>
        {search ? <Button variant="outline" onClick={() => { setSearchInput(""); setSearch(""); }} className="min-h-11 border-white/15 bg-white/5 text-white">Clear</Button> : null}
      </div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3"><div><div className="font-black">Referral ledger</div><div className="mt-1 text-xs text-white/45">{referrals.length} row(s) shown{search ? ` for “${search}”` : ""}</div></div>{problemRows.length ? <Badge className="bg-amber-500/20 text-amber-100">{problemRows.length} issue(s)</Badge> : <Badge className="bg-emerald-500/20 text-emerald-100">All linked</Badge>}</div>
        <div className="mt-4 max-h-[56dvh] space-y-3 overflow-y-auto pr-1">
          {query.isLoading ? <div className="p-8 text-center text-white/45">Loading referrals…</div> : null}
          {!query.isLoading && !referrals.length ? <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/45">No referral rows match this search.</div> : null}
          {referrals.map((row) => <div key={row.id} className={`rounded-2xl border p-4 ${row.healthy ? "border-white/10 bg-white/[.03]" : "border-amber-300/25 bg-amber-300/[.06]"}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge className={row.healthy ? "bg-emerald-500/20 text-emerald-100" : "bg-amber-500/20 text-amber-100"}>{row.healthy ? "Healthy" : "Check"}</Badge><Badge variant="outline" className="border-white/15 text-white/70">{row.status || "unknown"}</Badge><span className="text-xs text-white/40">#{row.id} • {dateTime(row.createdAt)}</span></div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[10px] font-black uppercase tracking-[.12em] text-white/35">Referrer</div><button type="button" onClick={() => row.referrerUserId && onOpenUser?.(String(row.referrerUserId))} className="mt-1 break-words text-left font-black text-cyan-200 hover:underline">{row.referrerName || row.referrerEmail || row.referrerUserId || "Missing"}</button><div className="mt-1 break-all text-xs text-white/45">{row.referrerEmail || row.referrerUserId || "—"}</div></div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[10px] font-black uppercase tracking-[.12em] text-white/35">Referred manager</div><button type="button" onClick={() => row.referredUserId && onOpenUser?.(String(row.referredUserId))} className="mt-1 break-words text-left font-black text-cyan-200 hover:underline">{row.referredName || row.referredEmail || row.referredUserId || "Missing"}</button><div className="mt-1 break-all text-xs text-white/45">{row.referredEmail || row.referredUserId || "—"}</div></div>
                </div>
              </div>
              <div className="shrink-0 text-left lg:text-right"><div className="text-[10px] font-black uppercase tracking-[.12em] text-white/35">Referral code</div><button type="button" onClick={() => row.referralCode && navigator.clipboard?.writeText(String(row.referralCode))} className="mt-1 inline-flex items-center gap-1 font-mono font-black text-cyan-200 hover:underline">{row.referralCode || "—"}{row.referralCode ? <Copy className="h-3.5 w-3.5" /> : null}</button></div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Reward card</div>{row.rewardCardId ? <button type="button" onClick={() => onOpenCard?.(String(row.rewardCardId))} className="mt-1 text-left font-black text-cyan-200 hover:underline">#{row.rewardCardId}</button> : <div className="mt-1 font-black text-white/60">None</div>}<div className="mt-1 truncate text-xs text-white/45">{row.rewardSerialId || "No serial"}</div></div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Reward player</div><div className="mt-1 truncate font-black">{row.rewardPlayerName || "—"}</div><div className="mt-1 truncate text-xs text-white/45">{row.rewardPlayerTeam || "—"} • {row.rewardPlayerPosition || "—"}</div></div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Reward owner</div><div className="mt-1 break-all text-xs text-white/70">{row.rewardOwnerId || "—"}</div></div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Link health</div><div className={`mt-1 text-xs font-bold ${row.healthy ? "text-emerald-200" : "text-amber-100"}`}>{row.healthy ? "Code, users and reward ownership match" : asArray(row.issues).join(" • ")}</div></div>
            </div>
          </div>)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="font-black">Top referrers</div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{topReferrers.length ? topReferrers.map((row) => <button key={row.userId} type="button" onClick={() => row.userId && onOpenUser?.(String(row.userId))} className="w-full rounded-xl border border-white/10 bg-white/[.03] p-3 text-left hover:border-cyan-300/25"><div className="flex items-center justify-between gap-2"><span className="truncate font-black text-cyan-200">{row.name || row.email || row.userId}</span><Badge>{Number(row.referrals || 0)}</Badge></div><div className="mt-1 truncate text-xs text-white/45">{row.email || row.userId} • {Number(row.rewards || 0)} reward(s)</div><div className="mt-1 text-[10px] text-white/30">Last {dateTime(row.lastReferralAt)}</div></button>) : <div className="text-sm text-white/45">No referrals yet.</div>}</div></div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="font-black">Recent claim audit</div><div className="mt-1 text-xs text-white/45">Successful, duplicate, rejected and failed claims are recorded here going forward.</div><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{recentAudit.length ? recentAudit.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-white/15 text-white/70">{item.action}</Badge><span className="text-[10px] text-white/35">{dateTime(item.createdAt)}</span></div><button type="button" onClick={() => item.userId && onOpenUser?.(String(item.userId))} className="mt-2 block truncate text-left text-sm font-black text-cyan-200 hover:underline">{item.userName || item.email || item.userId || "System"}</button><div className="mt-1 truncate text-xs text-white/40">{item.email || item.userId || "No user"}</div>{item.meta && Object.keys(item.meta).length ? <details className="mt-2 text-xs text-white/50"><summary className="cursor-pointer font-bold">Details</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2">{JSON.stringify(item.meta, null, 2)}</pre></details> : null}</div>) : <div className="text-sm text-white/45">No referral claim audits yet.</div>}</div></div>
      </div>
    </div>
  </div>;
}
