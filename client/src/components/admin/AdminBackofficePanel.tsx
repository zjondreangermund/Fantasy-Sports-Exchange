import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

type EntityBucket = "cards" | "users" | "transactions" | "auctions" | "tournaments" | "audit";

type BackofficeResponse = any;

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? "")).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function AdminBackofficePanel() {
  const [range, setRange] = useState("30d");
  const [search, setSearch] = useState("");
  const [activeEntity, setActiveEntity] = useState<EntityBucket>("cards");
  const [detailView, setDetailView] = useState<{ label: string; payload: any } | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<BackofficeResponse>({
    queryKey: [`/api/admin/backoffice?range=${range}`],
  });

  const entities = useMemo(() => {
    const all = data?.entities || {};
    const query = search.trim().toLowerCase();
    const filter = (rows: any[] = []) => (query ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query)) : rows);
    return {
      cards: filter(all.cards),
      users: filter(all.users),
      transactions: filter(all.transactions),
      auctions: filter(all.auctions),
      tournaments: filter(all.tournaments),
      audit: filter(all.audit),
    };
  }, [data, search]);

  const selectedRows: any[] = entities[activeEntity] || [];
  const overview = data?.overview;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Operations Console</h3>
            <p className="text-sm text-muted-foreground">Production admin visibility across users, cards, economy, and platform activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["1d", "7d", "30d", "90d"] as const).map((window) => (
              <Button key={window} variant={range === window ? "default" : "outline"} size="sm" onClick={() => setRange(window)}>
                {window.toUpperCase()}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Refreshing..." : "Refresh"}</Button>
          </div>
        </div>
      </Card>

      {isLoading ? <Card className="p-6 text-sm text-muted-foreground">Loading back-office analytics…</Card> : null}

      {overview ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
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
              ["Net payouts", `N$${money.format(overview.netSellerPayouts || 0)}`],
              ["Platform fees", `N$${money.format(overview.platformFees || 0)}`],
              ["Tournament fees", `N$${money.format(overview.tournamentFees || 0)}`],
              ["Withdrawals pending", overview.withdrawalsPending],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold mt-1">{String(value)}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
              <h4 className="font-semibold">AI + system monitoring indicators</h4>
              <Badge variant="secondary">{range.toUpperCase()} window</Badge>
            </div>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <p><span className="text-muted-foreground">Requests last hour:</span> {overview.aiMonitoring?.requestsLastHour || 0}</p>
              <p><span className="text-muted-foreground">Errors last hour:</span> {overview.aiMonitoring?.errorsLastHour || 0}</p>
              <p><span className="text-muted-foreground">Online users (10m):</span> {overview.aiMonitoring?.onlineUsersLast10Minutes || 0}</p>
            </div>
          </Card>

          <Tabs defaultValue="marketplace" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="marketplace" className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold">Marketplace analytics</h4>
                  <Button size="sm" variant="outline" onClick={() => downloadCsv(`marketplace-${range}.csv`, data.marketplaceAnalytics.topCards || [])}>Export CSV</Button>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mb-4 text-sm">
                  <p><span className="text-muted-foreground">Daily volume:</span> N${money.format(data.marketplaceAnalytics?.dailyVolume || 0)}</p>
                  <p><span className="text-muted-foreground">Weekly volume:</span> N${money.format(data.marketplaceAnalytics?.weeklyVolume || 0)}</p>
                  <p><span className="text-muted-foreground">Monthly volume:</span> N${money.format(data.marketplaceAnalytics?.monthlyVolume || 0)}</p>
                  <p><span className="text-muted-foreground">Transactions:</span> {data.marketplaceAnalytics?.transactionCount || 0}</p>
                  <p><span className="text-muted-foreground">Average sale price:</span> N${money.format(data.marketplaceAnalytics?.averageSalePrice || 0)}</p>
                  <p><span className="text-muted-foreground">Top rarity:</span> <Badge>{String(data.marketplaceAnalytics?.topSellingRarity || "n/a")}</Badge></p>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="mb-2 text-muted-foreground">Top cards by sale price</p>
                    {(data.marketplaceAnalytics?.topCards || []).slice(0, 10).map((card: any) => (
                      <button key={`${card.cardId}-${card.amount}`} onClick={() => setDetailView({ label: `Card #${card.cardId}`, payload: card })} className="w-full text-left flex items-center justify-between border-b py-1 hover:bg-muted/40">
                        <span>#{card.cardId} {card.player}</span><span>N${money.format(card.amount || 0)}</span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="mb-2 text-muted-foreground">Top leagues by volume</p>
                    {(data.marketplaceAnalytics?.topLeagues || []).slice(0, 10).map((league: any) => (
                      <div key={league.league} className="flex items-center justify-between border-b py-1">
                        <span>{league.league}</span><span>N${money.format(league.volume || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="cards" className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-semibold">Card analytics + supply insights</h4>
                  <Button size="sm" variant="outline" onClick={() => downloadCsv(`cards-${range}.csv`, data.entities.cards || [])}>Export CSV</Button>
                </div>
                <div className="grid md:grid-cols-3 gap-3 text-xs mb-3">
                  {(data.cardAnalytics?.supplyByRarity || []).map((row: any) => (
                    <div key={row.rarity} className="border rounded p-2 flex items-center justify-between"><span>{row.rarity}</span><span>{row.count}</span></div>
                  ))}
                </div>
                <div className="text-xs space-y-1">
                  <p>Owned: {data.cardAnalytics?.ownershipStates?.owned || 0}</p>
                  <p>Listed: {data.cardAnalytics?.ownershipStates?.listed || 0}</p>
                  <p>In auction: {data.cardAnalytics?.ownershipStates?.inAuction || 0}</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-semibold">User analytics + risk flags</h4>
                  <Button size="sm" variant="outline" onClick={() => downloadCsv(`users-${range}.csv`, data.entities.users || [])}>Export CSV</Button>
                </div>
                <div className="space-y-1 text-xs">
                  {(data.userAnalytics?.suspiciousActivityFlags || []).slice(0, 12).map((flag: any) => (
                    <button key={flag.userId} onClick={() => setDetailView({ label: `User ${flag.userId}`, payload: flag })} className="w-full text-left flex items-center justify-between border-b py-1 hover:bg-muted/40">
                      <span>{flag.userId}</span>
                      <Badge variant="outline">{(flag.flags || []).join(", ") || "clean"}</Badge>
                    </button>
                  ))}
                  {(data.userAnalytics?.suspiciousActivityFlags || []).length === 0 ? <p className="text-muted-foreground">No suspicious user flags in selected range.</p> : null}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-semibold">Recent cross-platform activity feed</h4>
                  <Button size="sm" variant="outline" onClick={() => downloadCsv(`audit-${range}.csv`, data.entities.audit || [])}>Export CSV</Button>
                </div>
                <div className="max-h-72 overflow-auto space-y-2 text-xs">
                  {(data.entities?.audit || []).slice(0, 100).map((log: any) => (
                    <button key={log.id} onClick={() => setDetailView({ label: `Audit #${log.id}`, payload: log })} className="w-full text-left rounded border p-2 hover:bg-muted/40">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-muted-foreground">{log.userId || "system"} • {new Date(log.at).toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h4 className="font-semibold">Entity search & drill-down</h4>
              <div className="flex gap-2 flex-wrap">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} className="w-[260px]" placeholder="Search users, cards, tx, auctions, tournaments" />
                <Button size="sm" variant="outline" onClick={() => downloadCsv(`${activeEntity}-${range}.csv`, selectedRows)}>Export visible</Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {(["cards", "users", "transactions", "auctions", "tournaments", "audit"] as EntityBucket[]).map((bucket) => (
                <Button key={bucket} size="sm" variant={activeEntity === bucket ? "default" : "outline"} onClick={() => setActiveEntity(bucket)}>
                  {bucket} ({entities[bucket]?.length || 0})
                </Button>
              ))}
            </div>

            <div className="max-h-72 overflow-auto rounded border">
              {selectedRows.slice(0, 120).map((row: any, index: number) => (
                <button
                  key={`${activeEntity}-${index}`}
                  className="w-full text-left px-3 py-2 text-xs border-b hover:bg-muted/40"
                  onClick={() => setDetailView({ label: `${activeEntity} row ${index + 1}`, payload: row })}
                >
                  {activeEntity === "cards" && `#${row.id} ${row.player} • ${row.league} • ${row.rarity} • owner ${row.ownerId}`}
                  {activeEntity === "users" && `${row.id} • ${row.email || "no-email"} • cards ${row.cardsOwned} • wallet N$${money.format(row.wallet || 0)}`}
                  {activeEntity === "transactions" && `#${row.id} card ${row.card} • ${row.buyer} → ${row.seller} • N$${money.format(row.grossAmount || 0)}`}
                  {activeEntity === "auctions" && `#${row.id} seller ${row.seller} • bids ${row.bids} • status ${row.settlement}`}
                  {activeEntity === "tournaments" && `#${row.id} ${row.name} • participants ${row.participants} • pool N$${money.format(row.prizePool || 0)}`}
                  {activeEntity === "audit" && `#${row.id} ${row.action} • ${row.userId || "system"}`}
                </button>
              ))}
              {selectedRows.length === 0 ? <div className="px-3 py-6 text-xs text-muted-foreground">No results for this filter.</div> : null}
            </div>
          </Card>
        </>
      ) : null}

      <Dialog open={Boolean(detailView)} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailView?.label || "Detail"}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(detailView?.payload || {}, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
