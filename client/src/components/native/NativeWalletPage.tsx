import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Clock3, Lock, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { Button } from "../ui/button";
import type { Transaction, Wallet, WithdrawalRequest } from "../../../../shared/schema";

function arrayFrom<T>(value: unknown, keys: string[] = []): T[] {
  const data: any = value;
  if (Array.isArray(data)) return data as T[];
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key] as T[];
  return [];
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return `N$${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function dateLabel(value: unknown) {
  if (!value) return "Recently";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "Recently";
  return date.toLocaleString("en-NA", { timeZone: "Africa/Windhoek", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function positiveTransaction(type: string) {
  return ["deposit", "sale", "marketplace_sale", "tournament_payout", "prize", "bonus_credit", "admin_adjustment"].includes(type);
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    purchase: "Card purchase",
    sale: "Card sale",
    marketplace_buy: "Marketplace buy",
    marketplace_sale: "Marketplace sale",
    tournament_entry: "Tournament entry",
    entry_fee: "Entry fee",
    tournament_payout: "Tournament payout",
    prize: "Prize payout",
    bonus_credit: "Bonus credit",
    admin_adjustment: "Admin adjustment",
    swap_fee: "Swap fee",
  };
  return labels[type] || String(type || "Transaction").replace(/_/g, " ");
}

export default function NativeWalletPage() {
  const [tab, setTab] = React.useState<"activity" | "requests">("activity");
  const { data: wallet, isLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
    queryFn: async () => {
      const response = await fetch("/api/wallet", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load wallet");
      return response.json();
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const { data: transactionsRaw } = useQuery<any>({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const response = await fetch("/api/transactions", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 15_000,
  });
  const { data: withdrawalsRaw } = useQuery<any>({
    queryKey: ["/api/wallet/withdrawals"],
    queryFn: async () => {
      const response = await fetch("/api/wallet/withdrawals", { credentials: "include" });
      return response.ok ? response.json() : [];
    },
    staleTime: 15_000,
  });

  const transactions = React.useMemo(() => arrayFrom<Transaction>(transactionsRaw, ["transactions", "items"]), [transactionsRaw]);
  const withdrawals = React.useMemo(() => arrayFrom<WithdrawalRequest>(withdrawalsRaw, ["withdrawals", "requests", "items"]), [withdrawalsRaw]);
  const balance = Number((wallet as any)?.balance || 0);
  const locked = Number((wallet as any)?.lockedBalance || (wallet as any)?.locked_balance || 0);
  const txRows = transactions.slice(0, 8);
  const requestRows = withdrawals.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-4 pt-3" data-native-wallet>
      <section className="overflow-hidden rounded-[1.55rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_90%_0%,rgba(16,185,129,.18),transparent_34%),linear-gradient(145deg,#0a1219,#070916)] p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-200/70">Arena wallet</p><h2 className="mt-1 text-2xl font-black">{isLoading ? "Loading…" : money(balance)}</h2><p className="mt-1 text-xs text-slate-500">Available to enter tournaments or buy cards.</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/[.045] text-emerald-200"><WalletCards className="h-5 w-5" /></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-black/20 p-3"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-slate-600"><ShieldCheck className="h-3.5 w-3.5" />Available</div><p className="mt-1 text-sm font-black text-emerald-200">{money(balance)}</p></div><div className="rounded-2xl bg-black/20 p-3"><div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-slate-600"><Lock className="h-3.5 w-3.5" />Locked</div><p className="mt-1 text-sm font-black text-amber-100">{money(locked)}</p></div></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Link href="/wallet?nativeFull=1"><Button className="h-11 w-full rounded-2xl bg-emerald-300 font-black text-slate-950 hover:bg-emerald-200"><ArrowDownLeft className="mr-2 h-4 w-4" />Deposit</Button></Link><Link href="/wallet?nativeFull=1"><Button variant="outline" className="h-11 w-full rounded-2xl border-white/10 bg-white/[.04] text-white"><ArrowUpRight className="mr-2 h-4 w-4" />Withdraw</Button></Link></div>
        <p className="mt-2 text-center text-[9px] leading-4 text-slate-600">Money actions open the full verified wallet form. Balance and activity stay compact here.</p>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/[.06] bg-black/20 p-1"><button onClick={() => setTab("activity")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${tab === "activity" ? "bg-white/[.08] text-white" : "text-slate-600"}`}>Activity · {transactions.length}</button><button onClick={() => setTab("requests")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${tab === "requests" ? "bg-white/[.08] text-white" : "text-slate-600"}`}>Withdrawals · {withdrawals.length}</button></div>

      {tab === "activity" ? <div className="mt-3 space-y-2">
        {txRows.length ? txRows.map((tx: any) => {
          const type = String(tx.type || "transaction");
          const positive = positiveTransaction(type);
          const amount = Number(tx.amount || 0);
          return <div key={tx.id || `${type}-${tx.createdAt}`} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${positive ? "bg-emerald-300/10 text-emerald-200" : "bg-violet-300/10 text-violet-200"}`}>{positive ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black capitalize">{transactionLabel(type)}</p><p className="mt-0.5 text-[10px] text-slate-600">{dateLabel(tx.createdAt || tx.created_at)}</p></div><p className={`shrink-0 text-sm font-black ${positive ? "text-emerald-200" : "text-white"}`}>{positive ? "+" : amount > 0 ? "−" : ""}{money(Math.abs(amount))}</p></div>;
        }) : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No wallet activity yet.</div>}
      </div> : <div className="mt-3 space-y-2">
        {requestRows.length ? requestRows.map((row: any) => <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-100"><Clock3 className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">Withdrawal {money(row.amount)}</p><p className="mt-0.5 truncate text-[10px] text-slate-600">{dateLabel(row.createdAt || row.created_at)} · {String(row.paymentMethod || row.payment_method || "payment")}</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase text-slate-400">{String(row.status || "pending")}</span></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No withdrawal requests.</div>}
      </div>}

      <Link href="/wallet?nativeFull=1"><button className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/[.07] bg-white/[.03] p-3 text-left"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[.05] text-slate-400"><ReceiptText className="h-4 w-4" /></div><div><p className="text-xs font-black">Full wallet & payment forms</p><p className="mt-0.5 text-[10px] text-slate-500">Deposit references, bank/eWallet details and full history.</p></div></div><ChevronRight className="h-4 w-4 text-slate-600" /></button></Link>
    </div>
  );
}