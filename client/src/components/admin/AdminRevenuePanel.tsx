import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarDays, Download, LineChart, RefreshCw, ShieldCheck, Store, Trophy, WalletCards } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

type RevenueWindow = {
  label: string;
  marketplace: number;
  tournaments: number;
  deposits: number;
  withdrawals: number;
  total: number;
};

type RevenueResponse = {
  feeRates: {
    tournaments: number;
    marketplace: number;
    withdrawals: number;
    depositsUnder200: number;
  };
  windows: {
    today: RevenueWindow;
    week: RevenueWindow;
    month: RevenueWindow;
    lifetime: RevenueWindow;
  };
};

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMoney(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "N$0.00";
  return `N$${money.format(n)}`;
}

function pct(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0%";
  return `${(n * 100).toFixed(n * 100 >= 10 ? 0 : 1)}%`;
}

function buildCsv(windows: RevenueResponse["windows"] | undefined) {
  if (!windows) return "period,tournament_fees,marketplace_fees,deposit_fees,withdrawal_fees,total\n";
  const rows = Object.values(windows).map((row) => [
    row.label,
    row.tournaments,
    row.marketplace,
    row.deposits,
    row.withdrawals,
    row.total,
  ].join(","));
  return ["period,tournament_fees,marketplace_fees,deposit_fees,withdrawal_fees,total", ...rows].join("\n");
}

export default function AdminRevenuePanel() {
  const revenueQuery = useQuery<RevenueResponse>({
    queryKey: ["/api/admin/revenue"],
    queryFn: async () => {
      const response = await fetch("/api/admin/revenue", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch revenue report");
      return response.json();
    },
  });

  const windows = revenueQuery.data?.windows;
  const month = windows?.month;
  const lifetime = windows?.lifetime;
  const topSource = month ? [
    ["Tournament fees", month.tournaments],
    ["Marketplace fees", month.marketplace],
    ["Deposit fees", month.deposits],
    ["Withdrawal fees", month.withdrawals],
  ].sort((a, b) => Number(b[1]) - Number(a[1]))[0] : null;

  const exportCsv = () => {
    const csv = buildCsv(windows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fantasy-arena-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (revenueQuery.isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div>;
  }

  if (revenueQuery.isError) {
    return <Card className="p-6 text-center"><p className="text-red-400">Revenue report could not load.</p><Button className="mt-3" variant="outline" onClick={() => revenueQuery.refetch()}>Retry</Button></Card>;
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-emerald-300/20 bg-gradient-to-br from-slate-950 via-slate-950 to-emerald-950/30 p-5 shadow-2xl shadow-black/25">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200"><Banknote className="h-8 w-8" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-200/70">Owner revenue dashboard</p>
              <h2 className="mt-2 text-2xl font-black text-white">Platform Fees & Profit Sources</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">Tracks the fee structure you set: tournaments, marketplace, deposits and withdrawals.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => revenueQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <FeeCard icon={<Trophy className="h-4 w-4" />} label="Tournaments" value={pct(revenueQuery.data?.feeRates.tournaments)} helper="All competitions" />
        <FeeCard icon={<Store className="h-4 w-4" />} label="Marketplace" value={pct(revenueQuery.data?.feeRates.marketplace)} helper="Card sales" />
        <FeeCard icon={<WalletCards className="h-4 w-4" />} label="Withdrawals" value={pct(revenueQuery.data?.feeRates.withdrawals)} helper="Cash-out fee" />
        <FeeCard icon={<ShieldCheck className="h-4 w-4" />} label="Deposits < N$200" value={pct(revenueQuery.data?.feeRates.depositsUnder200)} helper="Small deposit fee" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {windows && Object.values(windows).map((row) => <RevenueWindowCard key={row.label} row={row} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center gap-2 text-slate-200"><LineChart className="h-5 w-5 text-emerald-300" /><h3 className="font-bold">This Month Breakdown</h3></div>
          {month && <div className="space-y-3">
            <BreakdownBar label="Tournament Fees" value={month.tournaments} total={month.total} />
            <BreakdownBar label="Marketplace Fees" value={month.marketplace} total={month.total} />
            <BreakdownBar label="Deposit Fees" value={month.deposits} total={month.total} />
            <BreakdownBar label="Withdrawal Fees" value={month.withdrawals} total={month.total} />
          </div>}
        </Card>
        <Card className="border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center gap-2 text-slate-200"><CalendarDays className="h-5 w-5 text-blue-300" /><h3 className="font-bold">Owner Summary</h3></div>
          <div className="space-y-3 text-sm">
            <SummaryLine label="Top source this month" value={topSource ? `${topSource[0]} (${formatMoney(topSource[1])})` : "No revenue yet"} />
            <SummaryLine label="Month total" value={formatMoney(month?.total)} />
            <SummaryLine label="Lifetime total" value={formatMoney(lifetime?.total)} />
            <SummaryLine label="Revenue model" value="20% comps / 8% market / 3.5% withdrawals / 2% small deposits" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function FeeCard({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <Card className="border-white/10 bg-slate-950/70 p-4"><div className="flex items-center justify-between"><div className="text-slate-400">{icon}</div><Badge variant="outline">{value}</Badge></div><p className="mt-3 text-sm font-bold text-white">{label}</p><p className="text-xs text-slate-500">{helper}</p></Card>;
}

function RevenueWindowCard({ row }: { row: RevenueWindow }) {
  return <Card className="border-white/10 bg-slate-950/70 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.label}</p><p className="mt-2 text-2xl font-black text-emerald-300">{formatMoney(row.total)}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400"><span>Comps: {formatMoney(row.tournaments)}</span><span>Market: {formatMoney(row.marketplace)}</span><span>Deposits: {formatMoney(row.deposits)}</span><span>Withdraw: {formatMoney(row.withdrawals)}</span></div></Card>;
}

function BreakdownBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pctValue = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return <div><div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-semibold text-white">{formatMoney(value)}</span></div><div className="h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-emerald-400" style={{ width: `${pctValue}%` }} /></div></div>;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-white">{value}</span></div>;
}
