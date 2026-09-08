import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Copy, Gift, Link2, RefreshCw, Search, Users } from "lucide-react";
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

function Metric({ label, value, hint, tone = "normal" }: { label: string; value: any; hint?: string; tone?: "normal" | "good" | "warn" }) {
  const className = tone === "good"
    ? "border-emerald-300/15 bg-emerald-300/[.055]"
    : tone === "warn"
      ? "border-amber-300/20 bg-amber-300/[.06]"
      : "border-white/10 bg-black/25";
  return <div className={`rounded-2xl border p-4 ${className}`}><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-2 text-2xl font-black text-white">{value}</div>{hint ? <div className="mt-1 text-xs text-white/45">{hint}</div> : null}</div>;
}

type View = "confirmed" | "codes" | "audit";

export default function AdminReferralPanel({ onOpenUser, onOpenCard }: { onOpenUser?: (userId: string) => void; onOpenCard?: (cardId: string) => void }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("confirmed");
  const query = useQuery<any>({
    queryKey: [`/api/admin/referrals?limit=500&q=${encodeURIComponent(search)}`],
    refetchInterval: 30_000,
  });

  const data = query.data || {};
  const summary = data.summary || {};
  const referrals = asArray(data.referrals);
  const referralCodes = asArray(data.referralCodes);
  const topReferrers = asArray(data.topReferrers);
  const recentAudit = asArray(data.recentAudit);
  const problemRows = useMemo(() => referrals.filter((row) => !row.healthy), [referrals]);
  const failedAudits = useMemo(() => recentAudit.filter((row) => row.action === "referral.claim.failed"), [recentAudit]);

  const applySearch = () => setSearch(searchInput.trim());

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-cyan-200" />Referral monitoring</div>
        <p className="mt-1 text-sm text-white/50">Codes issued, confirmed referred signups, reward cards and claim failures are kept separate so the numbers cannot be confused.</p>
      </div>
      <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} className="border-white/15 bg-white/5 text-white"><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
    </div>

    {query.error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">Referral monitor failed: {String((query.error as Error)?.message || query.error)}</div> : null}

    <div className={`rounded-2xl border p-4 ${summary.healthy ? "border-emerald-300/20 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/10"}`}>
      <div className="flex items-start gap-3">{summary.healthy ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />}<div><div className="font-black">{summary.healthy ? "Referral system healthy" : "Referral system needs attention"}</div><div className="mt-1 text-xs text-white/60">Schema {summary.schemaHealthy ? "OK" : "missing fields"} • {Number(summary.unhealthyRows || 0)} broken referral row(s) • {Number(summary.duplicateCodeRows || 0)} duplicate code row(s) • checked {dateTime(data.checkedAt)}</div></div></div>
      {asArray(data.missingSchema).length ? <div className="mt-3 text-xs text-amber-100">Missing schema: {asArray(data.missingSchema).join(", ")}</div> : null}
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Metric label="Codes issued" value={Number(summary.totalCodes || 0)} hint="Managers with invite links" />
      <Metric label="Used codes" value={Number(summary.usedCodes || 0)} hint="At least 1 confirmed signup" tone="good" />
      <Metric label="Unused codes" value={Number(summary.unusedCodes || 0)} hint="Link exists, no confirmed signup yet" />
      <Metric label="Confirmed referrals" value={Number(summary.totalReferrals || 0)} hint="Actual referred accounts" tone="good" />
      <Metric label="Rewards granted" value={Number(summary.rewardedReferrals || 0)} />
      <Metric label="Last 7 days" value={Number(summary.last7d || 0)} />
      <Metric label="Failed claims" value={Number(summary.claimFailed || 0)} hint="Recorded failures" tone={Number(summary.claimFailed || 0) ? "warn" : "normal"} />
      <Metric label="Problems" value={Number(summary.unhealthyRows || 0) + Number(summary.duplicateCodeRows || 0) + Number(summary.blankCodes || 0)} tone={summary.healthy ? "good" : "warn"} />
    </div>

    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applySearch()} placeholder="Search manager, email, referral code, card or status" className="min-h-11 border-white/10 bg-black/35" />
        <Button onClick={applySearch} className="min-h-11"><Search className="mr-2 h-4 w-4" />Search</Button>
        {search ? <Button variant="outline" onClick={() => { setSearchInput(""); setSearch(""); }} className="min-h-11 border-white/15 bg-white/5 text-white">Clear</Button> : null}
      </div>
      <div className="grid grid-cols-3 rounded-xl bg-white/[.035] p-1 text-xs font-black">
        <button type="button" onClick={() => setView("confirmed")} className={`rounded-lg px-3 py-2 ${view === "confirmed" ? "bg-cyan-300/15 text-cyan-100" : "text-white/45"}`}>Confirmed</button>
        <button type="button" onClick={() => setView("codes")} className={`rounded-lg px-3 py-2 ${view === "codes" ? "bg-violet-300/15 text-violet-100" : "text-white/45"}`}>Codes</button>
        <button type="button" onClick={() => setView("audit")} className={`rounded-lg px-3 py-2 ${view === "audit" ? "bg-amber-300/15 text-amber-100" : "text-white/45"}`}>Audit</button>
      </div>
    </div>

    {view === "confirmed" ? <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-black"><Gift className="h-4 w-4 text-cyan-200" />Confirmed referral ledger</div><div className="mt-1 text-xs text-white/45">{referrals.length} confirmed signup row(s){search ? ` matching “${search}”` : ""}</div></div>{problemRows.length ? <Badge className="bg-amber-500/20 text-amber-100">{problemRows.length} issue(s)</Badge> : <Badge className="bg-emerald-500/20 text-emerald-100">All linked</Badge>}</div>
        <div className="mt-4 max-h-[58dvh] space-y-3 overflow-y-auto pr-1">
          {query.isLoading ? <div className="p-8 text-center text-white/45">Loading referrals…</div> : null}
          {!query.isLoading && !referrals.length ? <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/45">No confirmed referral rows match this search.</div> : null}
          {referrals.map((row) => <ReferralRow key={row.id} row={row} onOpenUser={onOpenUser} onOpenCard={onOpenCard} />)}
        </div>
      </div>
      <TopReferrers rows={topReferrers} onOpenUser={onOpenUser} />
    </div> : null}

    {view === "codes" ? <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-black"><Link2 className="h-4 w-4 text-violet-200" />Referral codes & invite links</div><div className="mt-1 text-xs text-white/45">A code being issued does not mean a referral happened. “Used” means at least one confirmed referred account is linked to it.</div></div><Badge variant="outline" className="border-white/15 text-white/65">{referralCodes.length} shown</Badge></div>
      <div className="mt-4 grid max-h-[62dvh] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {referralCodes.length ? referralCodes.map((row) => <div key={`${row.ownerUserId}:${row.code}`} className={`rounded-2xl border p-3.5 ${row.used ? "border-emerald-300/15 bg-emerald-300/[.04]" : "border-white/10 bg-white/[.025]"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><button type="button" onClick={() => row.ownerUserId && onOpenUser?.(String(row.ownerUserId))} className="block max-w-full truncate text-left text-sm font-black text-cyan-200 hover:underline">{row.ownerName || row.ownerEmail || row.ownerUserId}</button><div className="mt-0.5 truncate text-[10px] text-white/35">{row.ownerEmail || row.ownerUserId || "—"}</div></div><Badge className={row.used ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/50"}>{row.used ? "Used" : "Unused"}</Badge></div><button type="button" onClick={() => row.code && navigator.clipboard?.writeText(String(row.code))} className="mt-3 inline-flex items-center gap-1.5 font-mono text-sm font-black text-violet-200 hover:underline">{row.code || "—"}<Copy className="h-3.5 w-3.5" /></button><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-black/25 p-2.5"><div className="text-[9px] uppercase tracking-[.1em] text-white/30">Confirmed</div><div className="mt-1 font-black">{Number(row.confirmedReferrals || 0)}</div></div><div className="rounded-xl bg-black/25 p-2.5"><div className="text-[9px] uppercase tracking-[.1em] text-white/30">Rewards</div><div className="mt-1 font-black">{Number(row.rewardsGranted || 0)}</div></div></div><div className="mt-2 text-[10px] text-white/30">Issued {dateTime(row.createdAt)}{row.lastReferralAt ? ` • last used ${dateTime(row.lastReferralAt)}` : ""}</div></div>) : <div className="col-span-full rounded-xl border border-dashed border-white/15 p-6 text-center text-white/45">No referral codes match this search.</div>}
      </div>
    </div> : null}

    {view === "audit" ? <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 font-black"><Activity className="h-4 w-4 text-amber-200" />Claim audit</div><div className="mt-1 text-xs text-white/45">Success, duplicate, rejected and failed referral claim attempts recorded by the backend.</div></div><Badge className={failedAudits.length ? "bg-amber-500/20 text-amber-100" : "bg-emerald-500/20 text-emerald-100"}>{failedAudits.length} recent failure(s)</Badge></div><div className="mt-4 max-h-[62dvh] space-y-2 overflow-y-auto pr-1">{recentAudit.length ? recentAudit.map((item) => <AuditRow key={item.id} item={item} onOpenUser={onOpenUser} />) : <div className="text-sm text-white/45">No referral claim audits yet.</div>}</div></div>
      <div className="space-y-3"><Metric label="Successful claims" value={Number(summary.claimSuccess || 0)} tone="good" /><Metric label="Duplicate retries" value={Number(summary.claimDuplicate || 0)} hint="Should not mint another card" /><Metric label="Rejected claims" value={Number(summary.claimRejected || 0)} /><Metric label="Failed claims" value={Number(summary.claimFailed || 0)} tone={Number(summary.claimFailed || 0) ? "warn" : "normal"} /></div>
    </div> : null}
  </div>;
}

function ReferralRow({ row, onOpenUser, onOpenCard }: { row: any; onOpenUser?: (userId: string) => void; onOpenCard?: (cardId: string) => void }) {
  return <div className={`rounded-2xl border p-4 ${row.healthy ? "border-white/10 bg-white/[.03]" : "border-amber-300/25 bg-amber-300/[.06]"}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={row.healthy ? "bg-emerald-500/20 text-emerald-100" : "bg-amber-500/20 text-amber-100"}>{row.healthy ? "Healthy" : "Check"}</Badge><Badge variant="outline" className="border-white/15 text-white/70">{row.status || "unknown"}</Badge><span className="text-xs text-white/40">#{row.id} • {dateTime(row.createdAt)}</span></div><div className="mt-3 grid gap-3 md:grid-cols-2"><PersonBox label="Referrer" rowName={row.referrerName} email={row.referrerEmail} userId={row.referrerUserId} onOpenUser={onOpenUser} /><PersonBox label="Referred manager" rowName={row.referredName} email={row.referredEmail} userId={row.referredUserId} onOpenUser={onOpenUser} /></div></div><div className="shrink-0 text-left lg:text-right"><div className="text-[10px] font-black uppercase tracking-[.12em] text-white/35">Referral code</div><button type="button" onClick={() => row.referralCode && navigator.clipboard?.writeText(String(row.referralCode))} className="mt-1 inline-flex items-center gap-1 font-mono font-black text-cyan-200 hover:underline">{row.referralCode || "—"}{row.referralCode ? <Copy className="h-3.5 w-3.5" /> : null}</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Reward card</div>{row.rewardCardId ? <button type="button" onClick={() => onOpenCard?.(String(row.rewardCardId))} className="mt-1 text-left font-black text-cyan-200 hover:underline">#{row.rewardCardId}</button> : <div className="mt-1 font-black text-white/60">None</div>}<div className="mt-1 truncate text-xs text-white/45">{row.rewardSerialId || "No serial"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Reward player</div><div className="mt-1 truncate font-black">{row.rewardPlayerName || "—"}</div><div className="mt-1 truncate text-xs text-white/45">{row.rewardPlayerTeam || "—"} • {row.rewardPlayerPosition || "—"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Reward owner</div><div className="mt-1 break-all text-xs text-white/70">{row.rewardOwnerId || "—"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">Link health</div><div className={`mt-1 text-xs font-bold ${row.healthy ? "text-emerald-200" : "text-amber-100"}`}>{row.healthy ? "Code, users and reward ownership match" : asArray(row.issues).join(" • ")}</div></div></div></div>;
}

function PersonBox({ label, rowName, email, userId, onOpenUser }: { label: string; rowName: any; email: any; userId: any; onOpenUser?: (userId: string) => void }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[10px] font-black uppercase tracking-[.12em] text-white/35">{label}</div><button type="button" onClick={() => userId && onOpenUser?.(String(userId))} className="mt-1 break-words text-left font-black text-cyan-200 hover:underline">{rowName || email || userId || "Missing"}</button><div className="mt-1 break-all text-xs text-white/45">{email || userId || "—"}</div></div>;
}

function TopReferrers({ rows, onOpenUser }: { rows: any[]; onOpenUser?: (userId: string) => void }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="font-black">Top confirmed referrers</div><div className="mt-1 text-xs text-white/45">Ranked only by confirmed referred accounts, not by links created.</div><div className="mt-3 max-h-[54dvh] space-y-2 overflow-y-auto">{rows.length ? rows.map((row) => <button key={row.userId} type="button" onClick={() => row.userId && onOpenUser?.(String(row.userId))} className="w-full rounded-xl border border-white/10 bg-white/[.03] p-3 text-left hover:border-cyan-300/25"><div className="flex items-center justify-between gap-2"><span className="truncate font-black text-cyan-200">{row.name || row.email || row.userId}</span><Badge>{Number(row.referrals || 0)}</Badge></div><div className="mt-1 truncate text-xs text-white/45">{row.email || row.userId} • {Number(row.rewards || 0)} reward(s)</div><div className="mt-1 text-[10px] text-white/30">Last {dateTime(row.lastReferralAt)}</div></button>) : <div className="text-sm text-white/45">No confirmed referrals yet.</div>}</div></div>;
}

function AuditRow({ item, onOpenUser }: { item: any; onOpenUser?: (userId: string) => void }) {
  const failed = item.action === "referral.claim.failed";
  return <div className={`rounded-xl border p-3 ${failed ? "border-amber-300/20 bg-amber-300/[.05]" : "border-white/10 bg-white/[.03]"}`}><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-white/15 text-white/70">{item.action}</Badge><span className="text-[10px] text-white/35">{dateTime(item.createdAt)}</span></div><button type="button" onClick={() => item.userId && onOpenUser?.(String(item.userId))} className="mt-2 block truncate text-left text-sm font-black text-cyan-200 hover:underline">{item.userName || item.email || item.userId || "System"}</button><div className="mt-1 truncate text-xs text-white/40">{item.email || item.userId || "No user"}</div>{item.meta && Object.keys(item.meta).length ? <details className="mt-2 text-xs text-white/50"><summary className="cursor-pointer font-bold">Details</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2">{JSON.stringify(item.meta, null, 2)}</pre></details> : null}</div>;
}
