import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Skeleton } from "../components/ui/skeleton";
import AdminBackofficePanel from "../components/admin/AdminBackofficePanel";
import AdminIntegrityPanel from "../components/admin/AdminIntegrityPanel";
import AdminTransactionExplorer from "../components/admin/AdminTransactionExplorer";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Gavel,
  LineChart,
  ListChecks,
  RefreshCw,
  Search,
  Shield,
  ShoppingCart,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

type AdminStats = {
  users?: number;
  cards?: number;
  auctions?: number;
  competitions?: number;
  transactions?: number;
  dau?: number;
  wau?: number;
  mau?: number;
  newSignups24h?: number;
  marketplaceVolume?: number;
  marketplaceFees?: number;
  activeListings?: number;
  errorsLast24h?: number;
};

type AdminRevenue = {
  windows?: Record<string, { marketplace?: number; tournaments?: number; deposits?: number; withdrawals?: number; total?: number }>;
};

type AdminTransactions = {
  transactions?: Array<any>;
  total?: number;
  analytics?: {
    creditTotal?: number;
    debitTotal?: number;
    netTotal?: number;
    typeBreakdown?: Record<string, { count: number; amount: number }>;
  };
};

type TrafficData = {
  requestsLastMinute?: number;
  requestsLast5Minutes?: number;
  requestsLastHour?: number;
  onlineUsersLast10Minutes?: number;
  activeUsers?: Array<{ userId: string; lastSeenSecondsAgo: number }>;
  topRoutes?: Array<{ route: string; count: number; errorRate: number; avgDurationMs: number }>;
};

type UserSearchRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  isBanned?: boolean;
  cardsCount?: number;
  listingsCount?: number;
  purchasesCount?: number;
  balance?: number;
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function timeAgo(value?: string | Date | null) {
  if (!value) return "unknown";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "unknown";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function AdminPage() {
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: adminStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });
  const { data: revenue, refetch: refetchRevenue } = useQuery<AdminRevenue>({ queryKey: ["/api/admin/revenue"] });
  const { data: txData, refetch: refetchTx } = useQuery<AdminTransactions>({ queryKey: ["/api/admin/transactions?limit=100"] });
  const { data: traffic, refetch: refetchTraffic } = useQuery<TrafficData>({ queryKey: ["/api/admin/traffic"] });
  const { data: usersResponse, refetch: refetchUsers } = useQuery<{ users: any[]; total: number }>({ queryKey: ["/api/admin/users"] });
  const { data: listings, refetch: refetchListings } = useQuery<any[]>({ queryKey: ["/api/marketplace"] });
  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: withdrawals } = useQuery<any[]>({ queryKey: ["/api/admin/withdrawals"] });
  const { data: logs } = useQuery<{ logs: any[]; total: number }>({ queryKey: ["/api/admin/logs"] });
  const { data: searchedUsers, isFetching: searchingUsers } = useQuery<{ users: UserSearchRow[]; total: number }>({
    queryKey: [`/api/admin/users/search${userSearchTerm ? `?q=${encodeURIComponent(userSearchTerm)}` : ""}`],
    enabled: userSearchTerm.length > 0,
  });
  const { data: selectedUserDetails } = useQuery<any>({
    queryKey: [`/api/admin/users/${selectedUserId}/details`],
    enabled: Boolean(selectedUserId),
  });

  const transactions = asArray(txData?.transactions);
  const marketplaceTx = transactions.filter((tx) => {
    const text = `${tx.type || ""} ${tx.sourceType || ""} ${tx.description || ""}`.toLowerCase();
    return text.includes("marketplace") || text.includes("card sale") || text.includes("card purchase");
  });

  const marketplaceVolumeFromTx = marketplaceTx.reduce((sum, tx) => sum + Math.abs(Number(tx.grossAmount || tx.amount || 0)), 0);
  const marketplaceFeesFromTx = marketplaceTx.reduce((sum, tx) => {
    const recorded = Number(tx.feeAmount || 0);
    if (recorded > 0) return sum + recorded;
    const gross = Math.abs(Number(tx.grossAmount || tx.amount || 0));
    const net = Math.abs(Number(tx.netAmount || 0));
    if (gross > 0 && net > 0 && gross > net) return sum + (gross - net);
    return sum;
  }, 0);
  const estimatedMarketplaceFees = marketplaceFeesFromTx > 0 ? marketplaceFeesFromTx : marketplaceVolumeFromTx * 0.08;

  const activeListings = asArray(listings);
  const allUsers = asArray(usersResponse?.users);
  const allCompetitions = asArray(competitions);
  const allWithdrawals = asArray(withdrawals);
  const allLogs = asArray(logs?.logs);
  const recentUserRows = userSearchTerm ? asArray<UserSearchRow>(searchedUsers?.users) : allUsers.slice(0, 12);
  const selectedUserCards = asArray(selectedUserDetails?.cards);
  const selectedUserTransactions = asArray(selectedUserDetails?.transactions || selectedUserDetails?.recentTransactions);
  const selectedUserLogs = asArray(selectedUserDetails?.logs || selectedUserDetails?.auditLogs);

  const latestActivity = useMemo(() => {
    const txItems = transactions.slice(0, 18).map((tx) => ({
      id: `tx-${tx.id}`,
      type: tx.type || tx.sourceType || "transaction",
      userId: tx.userId,
      label: tx.description || `${tx.type || "Transaction"} ${money(tx.amount)}`,
      amount: tx.amount,
      at: tx.createdAt,
      source: "Transaction",
    }));
    const logItems = allLogs.slice(0, 18).map((log) => ({
      id: `log-${log.id}`,
      type: log.action || "admin.log",
      userId: log.userId,
      label: log.action || "Activity log",
      at: log.createdAt,
      source: "Audit",
    }));
    return [...txItems, ...logItems]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 30);
  }, [transactions, allLogs]);

  const refreshAll = () => {
    refetchStats();
    refetchRevenue();
    refetchTx();
    refetchTraffic();
    refetchUsers();
    refetchListings();
  };

  const kpis = [
    { label: "Users", value: adminStats?.users ?? usersResponse?.total ?? allUsers.length, hint: `${adminStats?.newSignups24h || 0} new 24h`, icon: Users },
    { label: "Cards", value: adminStats?.cards ?? 0, hint: "Total minted/owned", icon: CreditCard },
    { label: "Marketplace Volume", value: money(Math.max(Number(adminStats?.marketplaceVolume || 0), marketplaceVolumeFromTx)), hint: `${activeListings.length} active listings`, icon: ShoppingCart },
    { label: "Marketplace Fees", value: money(Math.max(Number(adminStats?.marketplaceFees || 0), estimatedMarketplaceFees)), hint: Number(adminStats?.marketplaceFees || 0) === 0 && estimatedMarketplaceFees > 0 ? "estimated from sales" : "recorded fees", icon: DollarSign },
    { label: "Revenue", value: money(revenue?.windows?.lifetime?.total || 0), hint: "all platform fees", icon: Wallet },
    { label: "Online", value: traffic?.onlineUsersLast10Minutes ?? 0, hint: `${traffic?.requestsLastHour || 0} req/hour`, icon: Activity },
    { label: "Tournaments", value: adminStats?.competitions ?? allCompetitions.length, hint: `${allCompetitions.filter((c) => ["open", "active"].includes(String(c.status))).length} live/open`, icon: Trophy },
    { label: "Errors", value: adminStats?.errorsLast24h ?? 0, hint: "last 24h", icon: AlertTriangle },
  ];

  return (
    <main className="admin-page min-h-full overflow-x-hidden overflow-y-auto bg-slate-950 px-3 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,.22),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(168,85,247,.18),transparent_30%),linear-gradient(180deg,#020617,#020617)]" />
      <div className="relative mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.22em] text-cyan-100">
                <Shield className="h-3.5 w-3.5" /> Admin Command Center
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Fantasy Arena Control Room</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Review signups, cards, marketplace sales, platform fees, live traffic, user activity, tournaments and support queries from one screen.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={refreshAll} className="rounded-xl bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
              <Link href="/marketplace"><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white"><ShoppingCart className="mr-2 h-4 w-4" />Marketplace</Button></Link>
              <Link href="/auctions"><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white"><Gavel className="mr-2 h-4 w-4" />Auctions</Button></Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {statsLoading ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl bg-white/10" />) : kpis.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border-white/10 bg-white/[0.07] p-3 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between gap-2"><Icon className="h-4 w-4 text-cyan-200" /><span className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">Live</span></div>
                <div className="truncate text-xl font-black">{item.value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/45">{item.label}</div>
                <div className="mt-1 truncate text-[10px] text-cyan-100/70">{item.hint}</div>
              </Card>
            );
          })}
        </section>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-full border border-white/15 bg-black/30 px-4 text-white"><Eye className="mr-2 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="users" className="rounded-full border border-white/15 bg-black/30 px-4 text-white"><Users className="mr-2 h-4 w-4" />User Review</TabsTrigger>
            <TabsTrigger value="market" className="rounded-full border border-white/15 bg-black/30 px-4 text-white"><ShoppingCart className="mr-2 h-4 w-4" />Market</TabsTrigger>
            <TabsTrigger value="activity" className="rounded-full border border-white/15 bg-black/30 px-4 text-white"><Activity className="mr-2 h-4 w-4" />Activity</TabsTrigger>
            <TabsTrigger value="finance" className="rounded-full border border-white/15 bg-black/30 px-4 text-white"><Wallet className="mr-2 h-4 w-4" />Finance</TabsTrigger>
            <TabsTrigger value="ops" className="rounded-full border border-white/15 bg-black/30 px-4 text-white"><Building2 className="mr-2 h-4 w-4" />Ops</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
              <SectionTitle icon={LineChart} title="What is happening now" subtitle="Live platform health, traffic and recent actions." />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MiniMetric label="Requests / min" value={traffic?.requestsLastMinute || 0} />
                <MiniMetric label="Requests / 5min" value={traffic?.requestsLast5Minutes || 0} />
                <MiniMetric label="Requests / hour" value={traffic?.requestsLastHour || 0} />
              </div>
              <div className="mt-4 space-y-2">
                {asArray(traffic?.topRoutes).slice(0, 8).map((route) => (
                  <div key={route.route} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                    <span className="truncate font-semibold text-white/85">{route.route}</span>
                    <span className="shrink-0 text-white/50">{route.count} hits • {Math.round(route.avgDurationMs || 0)}ms • {Math.round((route.errorRate || 0) * 100)}% err</span>
                  </div>
                ))}
                {!traffic?.topRoutes?.length && <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No traffic rows available yet.</p>}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
              <SectionTitle icon={ListChecks} title="Latest site activity" subtitle="Transactions and audit logs mixed together." />
              <div className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                {latestActivity.map((item) => <ActivityRow key={item.id} item={item} />)}
                {latestActivity.length === 0 && <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No recent activity found.</p>}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-5 grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
              <SectionTitle icon={Search} title="Find a user" subtitle="Use this when a user asks a support question." />
              <div className="mt-4 flex gap-2">
                <Input value={userSearchInput} onChange={(e) => setUserSearchInput(e.target.value)} placeholder="Search name, email or user id" className="border-white/10 bg-black/35 text-white" />
                <Button onClick={() => setUserSearchTerm(userSearchInput.trim())} disabled={!userSearchInput.trim() || searchingUsers}>Search</Button>
              </div>
              <div className="mt-4 space-y-2">
                {recentUserRows.map((user: any) => (
                  <button key={user.id} onClick={() => setSelectedUserId(user.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedUserId === user.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25 hover:bg-white/10"}`}>
                    <div className="flex items-center justify-between gap-3"><span className="truncate font-bold">{user.name || user.email || user.id}</span>{user.isBanned ? <Badge className="bg-red-500/20 text-red-200">Banned</Badge> : <Badge className="bg-emerald-500/20 text-emerald-200">Active</Badge>}</div>
                    <div className="mt-1 truncate text-xs text-white/45">{user.email || user.id}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/55"><span>{user.cardsCount || 0} cards</span><span>{user.listingsCount || 0} listings</span><span>{money(user.balance || 0)}</span></div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
              <SectionTitle icon={Eye} title="User support snapshot" subtitle="Last known cards, transactions and actions." />
              {!selectedUserId ? <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-white/45">Select a user to review what they did last.</p> : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4"><div className="font-black">{selectedUserDetails?.user?.name || selectedUserDetails?.user?.email || selectedUserId}</div><div className="mt-1 text-xs text-white/45">{selectedUserId}</div></div>
                  <div className="grid gap-3 md:grid-cols-3"><MiniMetric label="Cards" value={selectedUserCards.length} /><MiniMetric label="Transactions" value={selectedUserTransactions.length} /><MiniMetric label="Logs" value={selectedUserLogs.length} /></div>
                  <SnapshotList title="Recent transactions" rows={selectedUserTransactions} render={(tx) => `${tx.type || tx.sourceType || "tx"} • ${money(tx.amount)} • ${timeAgo(tx.createdAt)}`} />
                  <SnapshotList title="Recent actions" rows={selectedUserLogs} render={(log) => `${log.action || "action"} • ${timeAgo(log.createdAt)}`} />
                  <SnapshotList title="Cards" rows={selectedUserCards.slice(0, 12)} render={(card) => `#${card.id} ${card.player?.name || card.playerName || "Card"} • ${card.rarity || "common"}${card.forSale ? " • listed" : ""}`} />
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="market" className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
              <SectionTitle icon={ShoppingCart} title="Marketplace summary" subtitle="Sales and current active listings." />
              <div className="mt-4 grid gap-3"><MiniMetric label="Active listings" value={activeListings.length} /><MiniMetric label="Volume from tx" value={money(marketplaceVolumeFromTx)} /><MiniMetric label="Fees made" value={money(Math.max(Number(adminStats?.marketplaceFees || 0), estimatedMarketplaceFees))} /></div>
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">If recorded marketplaceFees is 0, this dashboard estimates fees from sale transactions so admin still sees the value.</p>
            </Card>
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
              <SectionTitle icon={CreditCard} title="Active listings" subtitle="Cards currently visible in the market." />
              <div className="mt-4 max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                {activeListings.slice(0, 40).map((listing) => <div key={listing.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-bold">{listing.player?.name || listing.playerName || `Card #${listing.id}`}</span><Badge>{listing.rarity || "card"}</Badge></div><div className="mt-1 text-white/50">Owner: {listing.ownerName || listing.ownerUsername || listing.ownerId || "unknown"} • Price: {money(listing.price)}</div></div>)}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-5">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl"><SectionTitle icon={Activity} title="Full activity feed" subtitle="Use this to investigate support questions." /><div className="mt-4 grid gap-2 md:grid-cols-2">{latestActivity.map((item) => <ActivityRow key={item.id} item={item} />)}</div></Card>
          </TabsContent>

          <TabsContent value="finance" className="mt-5 space-y-4">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl"><SectionTitle icon={DollarSign} title="Revenue windows" subtitle="Marketplace, tournament, deposit and withdrawal fees." /><div className="mt-4 grid gap-3 md:grid-cols-4">{Object.entries(revenue?.windows || {}).map(([key, row]: any) => <Card key={key} className="border-white/10 bg-black/25 p-3 text-white"><div className="text-xs font-black uppercase tracking-[.16em] text-white/40">{row.label || key}</div><div className="mt-2 text-2xl font-black">{money(row.total)}</div><div className="mt-2 space-y-1 text-xs text-white/50"><div>Market: {money(row.marketplace)}</div><div>Tournaments: {money(row.tournaments)}</div><div>Deposits: {money(row.deposits)}</div><div>Withdrawals: {money(row.withdrawals)}</div></div></Card>)}</div></Card>
            <AdminTransactionExplorer />
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl"><SectionTitle icon={Wallet} title="Withdrawals" subtitle="All withdrawal requests." /><div className="mt-4 space-y-2">{allWithdrawals.slice(0, 20).map((wr) => <div key={wr.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-bold">{wr.userId}</span><Badge>{wr.status}</Badge></div><div className="mt-1 text-white/50">Amount {money(wr.amount)} • Fee {money(wr.fee)} • Net {money(wr.netAmount)} • {timeAgo(wr.createdAt)}</div></div>)}</div></Card>
          </TabsContent>

          <TabsContent value="ops" className="mt-5 space-y-4">
            <AdminBackofficePanel />
            <AdminIntegrityPanel />
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl"><SectionTitle icon={Trophy} title="Tournaments" subtitle="Open, active and completed competitions." /><div className="mt-4 grid gap-2 md:grid-cols-2">{allCompetitions.map((comp) => <div key={comp.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-bold">{comp.name}</span><Badge>{comp.status}</Badge></div><div className="mt-1 text-white/50">GW {comp.gameWeek} • {comp.tier} • Entry {money(comp.entryFee)} • Prize {comp.prizeCardRarity || "none"}</div></div>)}</div></Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return <div className="flex items-start gap-3"><div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100"><Icon className="h-4 w-4" /></div><div><h2 className="text-lg font-black text-white">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}</div></div>;
}

function MiniMetric({ label, value }: { label: string; value: any }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">{label}</div><div className="mt-1 truncate text-xl font-black text-white">{value}</div></div>;
}

function ActivityRow({ item }: { item: any }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="truncate font-bold text-white">{item.label}</span><Badge variant="outline" className="border-white/15 text-white/70">{item.source}</Badge></div><div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45"><span>{item.type}</span>{item.userId ? <span>• {item.userId}</span> : null}{item.amount != null ? <span>• {money(item.amount)}</span> : null}<span>• {timeAgo(item.at)}</span></div></div>;
}

function SnapshotList({ title, rows, render }: { title: string; rows: any[]; render: (row: any) => string }) {
  return <div><div className="mb-2 text-xs font-black uppercase tracking-[.16em] text-white/40">{title}</div><div className="space-y-2">{rows.length ? rows.slice(0, 8).map((row, index) => <div key={row.id || index} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/70">{render(row)}</div>) : <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/35">No rows found.</div>}</div></div>;
}
