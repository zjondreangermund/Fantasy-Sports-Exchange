import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import AdminTournamentManager from "./AdminTournamentManager";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function AdminBackofficePanel() {
  const { data } = useQuery<any>({ queryKey: ["/api/admin/backoffice?range=30d"] });
  const overview = data?.overview || {};

  return (
    <div className="space-y-4">
      <AdminTournamentManager />

      <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Operations Snapshot</h3>
            <p className="text-sm text-white/45">Quick platform totals. The main tournament controls are now above for easier admin use.</p>
          </div>
          <Badge className="bg-cyan-400/15 text-cyan-100">Live admin</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {[
            ["Total users", overview.totalUsers],
            ["Active users", overview.activeUsers],
            ["Cards minted", overview.totalCardsMinted],
            ["Listed cards", overview.listedCards],
            ["Sold cards", overview.soldCards],
            ["Auctions live", overview.auctionsLive],
            ["Competitions live", overview.competitionsLive],
            ["Wallet balances", `N$${money.format(overview.walletBalances || 0)}`],
            ["Gross volume", `N$${money.format(overview.grossMarketplaceVolume || 0)}`],
            ["Platform fees", `N$${money.format(overview.platformFees || 0)}`],
            ["Tournament fees", `N$${money.format(overview.tournamentFees || 0)}`],
            ["Withdrawals pending", overview.withdrawalsPending],
          ].map(([label, value]) => (
            <Card key={String(label)} className="border-white/10 bg-black/25 p-3 text-white">
              <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
              <p className="mt-1 text-lg font-semibold">{String(value ?? 0)}</p>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}
