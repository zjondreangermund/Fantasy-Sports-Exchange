import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, CheckCheck, ChevronRight, Copy, Gift, Share2, ShieldCheck, Trophy, UserRound, UsersRound } from "lucide-react";
import { Button } from "../ui/button";
import { queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";

type Tab = "club" | "inbox" | "referrals";

function cardsFrom(value: any) {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.cards) ? value.cards : [];
}

function dateLabel(value: unknown) {
  if (!value) return "Recently";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Recently";
  return date.toLocaleString("en-NA", { timeZone: "Africa/Windhoek", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function NativeClubPage() {
  const { toast } = useToast();
  const initialTab = React.useMemo<Tab>(() => {
    if (typeof window === "undefined") return "club";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "inbox" || requested === "referrals" ? requested : "club";
  }, []);
  const [tab, setTab] = React.useState<Tab>(initialTab);

  const { data: user } = useQuery<any>({ queryKey: ["/api/user"], staleTime: 30_000 });
  const { data: cardsRaw } = useQuery<any>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const response = await fetch("/api/user/cards", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 30_000,
  });
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const response = await fetch("/api/competitions/my-entries", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 20_000,
  });
  const { data: inbox } = useQuery<any>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      return response.ok ? response.json() : { notifications: [], unreadCount: 0 };
    },
    refetchInterval: 30_000,
  });
  const { data: referral } = useQuery<any>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const response = await fetch("/api/referrals/me", { credentials: "include" });
      return response.ok ? response.json() : null;
    },
    staleTime: 60_000,
  });
  const { data: history } = useQuery<any>({
    queryKey: ["/api/referrals/history"],
    queryFn: async () => {
      const response = await fetch("/api/referrals/history", { credentials: "include" });
      return response.ok ? response.json() : { referrals: [], totalReferrals: 0, rewardsGranted: 0 };
    },
    staleTime: 30_000,
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Could not update inbox");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const cards = cardsFrom(cardsRaw);
  const rows = Array.isArray(entries) ? entries : [];
  const wins = rows.filter((entry: any) => Number(entry.rank || entry.finalRank || 0) === 1 || String(entry.status || "").toLowerCase() === "winner").length;
  const notifications = Array.isArray(inbox?.notifications) ? inbox.notifications : [];
  const referrals = Array.isArray(history?.referrals) ? history.referrals : [];

  const shareReferral = async () => {
    const url = String(referral?.url || "").trim();
    if (!url) return toast({ title: "Referral link unavailable", description: "Try again in a moment.", variant: "destructive" });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join me on Fantasy Arena", text: "Build your Premier League card squad and compete with me on Fantasy Arena.", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Referral link copied" });
      }
    } catch (error: any) {
      if (String(error?.name || "") === "AbortError") return;
      try { await navigator.clipboard.writeText(url); toast({ title: "Referral link copied" }); } catch { toast({ title: "Could not share link", variant: "destructive" }); }
    }
  };

  const copyReferral = async () => {
    try { await navigator.clipboard.writeText(String(referral?.url || "")); toast({ title: "Referral link copied" }); } catch { toast({ title: "Could not copy", variant: "destructive" }); }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-club>
      <section className="overflow-hidden rounded-[1.55rem] border border-violet-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(139,92,246,.2),transparent_34%),linear-gradient(145deg,#0b0e1c,#070916)] p-4">
        <div className="flex items-center gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-200/15 bg-violet-300/10 text-violet-200"><UserRound className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200/65">My club</p><h2 className="mt-1 truncate text-xl font-black">{user?.managerTeamName || user?.name || "Fantasy Arena Manager"}</h2><p className="mt-0.5 truncate text-[11px] text-slate-500">{user?.email || "Fantasy Arena account"}</p></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-600">Cards</p><p className="mt-1 text-base font-black">{cards.length}</p></div><div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-600">Entries</p><p className="mt-1 text-base font-black">{rows.length}</p></div><div className="rounded-2xl bg-black/20 p-2.5 text-center"><p className="text-[9px] font-black uppercase text-slate-600">Wins</p><p className="mt-1 text-base font-black text-amber-100">{wins}</p></div></div>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/[.06] bg-black/20 p-1">
        <button onClick={() => setTab("club")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${tab === "club" ? "bg-white/[.08] text-white" : "text-slate-600"}`}><Trophy className="mx-auto mb-1 h-4 w-4" />Club</button>
        <button onClick={() => setTab("inbox")} className={`relative rounded-xl px-2 py-2.5 text-[11px] font-black ${tab === "inbox" ? "bg-white/[.08] text-white" : "text-slate-600"}`}><Bell className="mx-auto mb-1 h-4 w-4" />Inbox{Number(inbox?.unreadCount || 0) > 0 ? <span className="absolute right-3 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] text-white">{Number(inbox.unreadCount)}</span> : null}</button>
        <button onClick={() => setTab("referrals")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${tab === "referrals" ? "bg-white/[.08] text-white" : "text-slate-600"}`}><UsersRound className="mx-auto mb-1 h-4 w-4" />Refer</button>
      </div>

      {tab === "club" ? <div className="mt-3 space-y-2">
        <Link href="/live-lineup"><button className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[.04] p-3 text-left"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200"><Trophy className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">Matchday squad</p><p className="mt-0.5 text-[10px] text-slate-500">See your five-card lineup and live entry status.</p></div><ChevronRight className="h-4 w-4 text-slate-600" /></button></Link>
        <Link href="/collection"><button className="flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-3 text-left"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-300/10 text-violet-200"><Gift className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">Your collection</p><p className="mt-0.5 text-[10px] text-slate-500">{cards.length} cards ready to manage.</p></div><ChevronRight className="h-4 w-4 text-slate-600" /></button></Link>
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/[.035] p-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><ShieldCheck className="h-4 w-4" /></div><div className="min-w-0"><p className="text-sm font-black">Club status</p><p className="mt-0.5 text-[10px] text-slate-500">Signed in · tournament and wallet links connected.</p></div></div>
      </div> : null}

      {tab === "inbox" ? <div className="mt-3">
        <div className="mb-2 flex items-center justify-between px-1"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-600">Notifications</p><p className="text-sm font-black">{Number(inbox?.unreadCount || 0)} unread</p></div>{Number(inbox?.unreadCount || 0) > 0 ? <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending} className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[.03] px-3 py-2 text-[10px] font-black text-slate-300"><CheckCheck className="h-3.5 w-3.5" />Mark all read</button> : null}</div>
        <div className="space-y-2">{notifications.slice(0, 8).map((note: any) => <div key={note.id} className={`rounded-2xl border p-3 ${note.read ? "border-white/[.06] bg-white/[.025]" : "border-cyan-300/12 bg-cyan-300/[.045]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{note.title || "Fantasy Arena"}</p><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{note.message || "You have a new update."}</p></div>{!note.read ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" /> : null}</div><p className="mt-2 text-[9px] text-slate-700">{dateLabel(note.createdAt || note.created_at)}</p></div>)}{!notifications.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Your inbox is clear.</div> : null}</div>
      </div> : null}

      {tab === "referrals" ? <div className="mt-3 space-y-3">
        <section className="rounded-[1.4rem] border border-emerald-300/12 bg-emerald-300/[.04] p-4"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Gift className="h-5 w-5" /></div><div><p className="text-sm font-black">Invite a manager. Earn a Common card.</p><p className="mt-1 text-[11px] leading-5 text-slate-500">A reward is issued only after a successful referred signup is linked to your code.</p></div></div><div className="mt-3 rounded-xl border border-white/[.06] bg-black/25 p-3"><p className="text-[9px] font-black uppercase tracking-[.13em] text-slate-600">Your referral code</p><p className="mt-1 font-mono text-lg font-black text-emerald-200">{referral?.code || "Loading…"}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={shareReferral} className="h-11 rounded-2xl bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><Share2 className="mr-2 h-4 w-4" />Share</Button><Button onClick={copyReferral} variant="outline" className="h-11 rounded-2xl border-white/10 bg-white/[.04] text-white"><Copy className="mr-2 h-4 w-4" />Copy link</Button></div></section>
        <div className="grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><p className="text-[9px] font-black uppercase tracking-[.13em] text-slate-600">Confirmed signups</p><p className="mt-1 text-2xl font-black">{Number(history?.totalReferrals || 0)}</p></div><div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><p className="text-[9px] font-black uppercase tracking-[.13em] text-slate-600">Cards rewarded</p><p className="mt-1 text-2xl font-black text-emerald-200">{Number(history?.rewardsGranted || 0)}</p></div></div>
        <div className="space-y-2">{referrals.slice(0, 5).map((row: any) => <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-300/10 text-violet-200"><UsersRound className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{row.referredName || row.referredEmail || "New manager"}</p><p className="mt-0.5 text-[10px] text-slate-600">{dateLabel(row.createdAt)} · {row.rewardCardId ? `Card #${row.rewardCardId}` : "Claim recorded"}</p></div></div>)}{!referrals.length ? <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">No confirmed referred managers yet. Share your link to start.</div> : null}</div>
      </div> : null}

      <Link href="/account?nativeFull=1"><button className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.03] p-3 text-left"><div><p className="text-xs font-black">Full account settings</p><p className="mt-0.5 text-[10px] text-slate-500">Team-name editing, full inbox history and account tools.</p></div><ChevronRight className="h-4 w-4 text-slate-600" /></button></Link>
    </div>
  );
}
