import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Banknote, PieChart, RefreshCw, Search } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

type AdminTransaction = {
  id: number;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  type: string;
  amount: number;
  description?: string | null;
  paymentMethod?: string | null;
  externalTransactionId?: string | null;
  createdAt?: string | null;
};

type TransactionSummary = {
  netAmount: number;
  credits: number;
  debits: number;
  byType: Array<{ type: string; count: number; netAmount: number }>;
};

type TransactionsResponse = {
  transactions: AdminTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary?: TransactionSummary;
  filters: { userId?: string | null; type?: string | null; q?: string | null };
};

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TX_TYPES = [
  "",
  "deposit",
  "withdrawal",
  "marketplace_buy",
  "marketplace_sale",
  "auction_settlement",
  "entry_fee",
  "admin_adjustment",
];

function amountClass(amount: number) {
  if (amount > 0) return "text-emerald-300";
  if (amount < 0) return "text-rose-300";
  return "text-slate-300";
}

export default function AdminTransactionExplorer() {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ userId: "", type: "", q: "" });

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (appliedFilters.userId) params.set("userId", appliedFilters.userId);
    if (appliedFilters.type) params.set("type", appliedFilters.type);
    if (appliedFilters.q) params.set("q", appliedFilters.q);
    return `/api/admin/transactions?${params.toString()}`;
  }, [appliedFilters, page]);

  const transactionsQuery = useQuery<TransactionsResponse>({
    queryKey: [queryUrl],
    queryFn: async () => {
      const response = await fetch(queryUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch admin transactions");
      return response.json();
    },
  });

  const rows = transactionsQuery.data?.transactions || [];
  const total = Number(transactionsQuery.data?.total || 0);
  const totalPages = Math.max(1, Number(transactionsQuery.data?.totalPages || 1));
  const pageTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const summary = transactionsQuery.data?.summary;
  const typeBreakdown = summary?.byType || [];

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ userId: userId.trim(), type: type.trim(), q: q.trim() });
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-emerald-300/15 bg-gradient-to-br from-slate-950 via-slate-950/95 to-emerald-950/25 p-5 shadow-2xl shadow-black/25">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
              <Banknote className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-200/70">Ledger explorer</p>
              <h2 className="mt-2 text-2xl font-black text-white">Transaction audit trail</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Search wallet, marketplace, auction, withdrawal, tournament and admin adjustment transactions from one operations view.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[28rem] lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Matched</p>
              <p className="text-2xl font-black text-white">{total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/60">Credits</p>
              <p className="text-2xl font-black text-emerald-200">N${money.format(Number(summary?.credits || 0))}</p>
            </div>
            <div className="rounded-2xl border border-rose-300/15 bg-rose-300/10 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-rose-200/60">Debits</p>
              <p className="text-2xl font-black text-rose-200">N${money.format(Number(summary?.debits || 0))}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Filtered net</p>
              <p className={`text-2xl font-black ${amountClass(Number(summary?.netAmount || 0))}`}>N${money.format(Number(summary?.netAmount || 0))}</p>
              <p className={`text-xs ${amountClass(pageTotal)}`}>Page N${money.format(pageTotal)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-white/10 bg-slate-950/70 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_13rem_1fr_auto]">
          <Input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Filter user ID" className="bg-black/25" />
          <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-slate-200">
            {TX_TYPES.map((txType) => (
              <option key={txType || "all"} value={txType}>{txType || "All types"}</option>
            ))}
          </select>
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search description" className="bg-black/25" />
          <div className="flex gap-2">
            <Button onClick={applyFilters}><Search className="mr-2 h-4 w-4" />Search</Button>
            <Button variant="outline" onClick={() => transactionsQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </div>
      </Card>

      <Card className="border-cyan-300/15 bg-gradient-to-r from-cyan-950/25 via-slate-950/70 to-fuchsia-950/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-cyan-100/80">
          <PieChart className="h-4 w-4" /> Filtered type breakdown
        </div>
        {transactionsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}
          </div>
        ) : typeBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400">No transaction volume to summarize for the current filters.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {typeBreakdown.slice(0, 8).map((row) => {
              const net = Number(row.netAmount || 0);
              return (
                <div key={row.type} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="border-cyan-300/20 text-cyan-100">{row.type || "unknown"}</Badge>
                    <span className="text-xs font-semibold text-slate-500">{row.count} tx</span>
                  </div>
                  <p className={`mt-3 text-2xl font-black ${amountClass(net)}`}>N${money.format(net)}</p>
                  <p className="mt-1 text-xs text-slate-500">Net impact in current filter set</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden border-white/10 bg-slate-950/70 shadow-2xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-left text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">External</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {transactionsQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No transactions matched your filters.</td></tr>
              ) : rows.map((tx) => (
                <tr key={tx.id} className="align-top hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">#{tx.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{tx.userName || tx.userEmail || tx.userId}</p>
                    <p className="max-w-56 truncate text-xs text-slate-500">{tx.userId}</p>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="border-white/15 text-slate-300">{tx.type}</Badge></td>
                  <td className={`px-4 py-3 text-right font-black ${amountClass(Number(tx.amount || 0))}`}>N${money.format(Number(tx.amount || 0))}</td>
                  <td className="px-4 py-3"><p className="max-w-md truncate text-slate-300">{tx.description || "—"}</p></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{tx.externalTransactionId || tx.paymentMethod || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
