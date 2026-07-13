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
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  Gavel,
  Gift,
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
  competitions?: number;
  newSignups24h?: number;
  marketplaceVolume?: number;
  marketplaceFees?: number;
  errorsLast24h?: number;
};

type UserRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  managerTeamName?: string | null;
  isBanned?: boolean;
  cardsCount?: number;
  listingsCount?: number;
  balance?: number;
  createdAt?: string;
};

type Traffic = {
  onlineUsersLast10Minutes?: number;
  requestsLastHour?: number;
  activeUsers?: any[];
};

function money(value: unknown) {
  const n = Number(value || 0);
  return `N$${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function timeAgo(value?: string | Date | null) {
  if (!value) return "unknown";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "unknown";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityUserId, setActivityUserId] = useState("");
  const [activitySource, setActivitySource] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const [cardSearch, setCardSearch] = useState("");
  const [cardRarity, setCardRarity] = useState("all");
  const [cardStatus, setCardStatus] = useState("all");
  const [cardSort, setCardSort] = useState("newest");
  const [cardPage, setCardPage] = useState(1);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupTerm, setLookupTerm] = useState("");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });
  const { data: usersResponse, refetch: refetchUsers } = useQuery<{ users: UserRow[]; total: number }>({ queryKey: ["/api/admin/users?limit=100"] });
  const { data: traffic, refetch: refetchTraffic } = useQuery<Traffic>({ queryKey: ["/api/admin/traffic"] });
  const { refetch: refetchTx } = useQuery<any>({ queryKey: ["/api/admin/transactions?limit=100"] });
  const { data: revenue } = useQuery<any>({ queryKey: ["/api/admin/revenue"] });
  const { data: listings, refetch: refetchListings } = useQuery<any[]>({ queryKey: ["/api/marketplace"] });
  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: withdrawals } = useQuery<any[]>({ queryKey: ["/api/admin/withdrawals"] });
  const { data: selectedUserDetails } = useQuery<any>({ queryKey: [`/api/admin/users/${selectedUserId}/details`], enabled: Boolean(selectedUserId) });
  const { data: searchedUsers, isFetching: searchingUsers } = useQuery<{ users: UserRow[]; total: number }>({
    queryKey: [`/api/admin/users/search?q=${encodeURIComponent(userSearchTerm)}`],
    enabled: Boolean(userSearchTerm),
  });

  const cardUrl = selectedUserId
    ? `/api/admin/users/${selectedUserId}/cards?q=${encodeURIComponent(cardSearch)}&rarity=${cardRarity}&status=${cardStatus}&sort=${cardSort}&page=${cardPage}&limit=50`
    : "";
  const { data: cardData, isFetching: cardsLoading } = useQuery<any>({ queryKey: [cardUrl], enabled: Boolean(selectedUserId) });

  const activityUrl = `/api/admin/activity?q=${encodeURIComponent(activitySearch)}&userId=${encodeURIComponent(activityUserId)}&source=${activitySource}&page=${activityPage}&limit=50`;
  const { data: activityData, isFetching: activityLoading, refetch: refetchActivity } = useQuery<any>({ queryKey: [activityUrl] });

  const lookupUrl = lookupTerm ? `/api/admin/cards/lookup?q=${encodeURIComponent(lookupTerm)}` : "";
  const {
    data: lookupData,
    isFetching: lookupLoading,
    error: lookupError,
  } = useQuery<any>({ queryKey: [lookupUrl], enabled: Boolean(lookupTerm) });

  const users = asArray<UserRow>(usersResponse?.users);
  const shownUsers = userSearchTerm ? asArray<UserRow>(searchedUsers?.users) : users;
  const online = asArray(traffic?.activeUsers);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const onlineDetailed = online.map((row) => ({ ...row, user: userMap.get(String(row.userId)) }));
  const cards = asArray(cardData?.cards);
  const activity = asArray(activityData?.activity);
  const allCompetitions = asArray(competitions);
  const activeListings = asArray(listings);

  const selectUser = (userId: string) => {
    setSelectedUserId(userId);
    setActivityUserId(userId);
    setCardPage(1);
    setActiveTab("users");
  };

  const refreshAll = () => {
    refetchStats();
    refetchUsers();
    refetchTraffic();
    refetchTx();
    refetchListings();
    refetchActivity();
  };

  const kpis = [
    { label: "Users", value: stats?.users || usersResponse?.total || users.length, hint: `${stats?.newSignups24h || 0} new 24h`, icon: Users },
    { label: "Cards", value: stats?.cards || 0, hint: "All minted/owned", icon: CreditCard },
    { label: "Marketplace", value: money(stats?.marketplaceVolume || 0), hint: `${activeListings.length} listings`, icon: ShoppingCart },
    { label: "Fees", value: money(stats?.marketplaceFees || 0), hint: "Recorded fees", icon: DollarSign },
    { label: "Online", value: traffic?.onlineUsersLast10Minutes || 0, hint: `${traffic?.requestsLastHour || 0} req/hour`, icon: Activity },
    { label: "Tournaments", value: stats?.competitions || allCompetitions.length, hint: `${allCompetitions.filter((c) => ["open", "active"].includes(String(c.status))).length} live/open`, icon: Trophy },
    { label: "Revenue", value: money(revenue?.windows?.lifetime?.total || 0), hint: "All platform fees", icon: Wallet },
    { label: "Errors", value: stats?.errorsLast24h || 0, hint: "Last 24h", icon: AlertTriangle },
  ];

  return (
    <main className="admin-page min-h-full overflow-x-hidden bg-slate-950 px-3 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] pt-4 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,.22),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(168,85,247,.18),transparent_30%),linear-gradient(180deg,#020617,#020617)]" />
      <div className="relative mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.22em] text-cyan-100">
                <Shield className="h-3.5 w-3.5" /> Admin Command Center
              </div>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Fantasy Arena Control Room</h1>
              <p className="mt-2 text-sm text-slate-300">Complete card ownership, searchable user timelines and transaction-level activity details.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={refreshAll} className="bg-cyan-300 font-black text-slate-950"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
              <Link href="/marketplace"><Button variant="outline" className="border-white/15 bg-white/5 text-white"><ShoppingCart className="mr-2 h-4 w-4" />Marketplace</Button></Link>
              <Link href="/auctions"><Button variant="outline" className="border-white/15 bg-white/5 text-white"><Gavel className="mr-2 h-4 w-4" />Auctions</Button></Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {statsLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/10" />)
            : kpis.map(({ label, value, hint, icon: Icon }) => (
                <Card key={label} className="border-white/10 bg-white/[0.07] p-3 text-white">
                  <Icon className="h-4 w-4 text-cyan-200" />
                  <div className="mt-3 truncate text-xl font-black">{value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-white/45">{label}</div>
                  <div className="mt-1 truncate text-[10px] text-cyan-100/70">{hint}</div>
                </Card>
              ))}
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="users" className="min-h-11 rounded-full border border-white/15 bg-black/30 px-4 text-white"><Users className="mr-2 h-4 w-4" />User Review</TabsTrigger>
            <TabsTrigger value="cards" className="min-h-11 rounded-full border border-white/15 bg-black/30 px-4 text-white"><CreditCard className="mr-2 h-4 w-4" />Card Lookup</TabsTrigger>
            <TabsTrigger value="activity" className="min-h-11 rounded-full border border-white/15 bg-black/30 px-4 text-white"><Activity className="mr-2 h-4 w-4" />Activity</TabsTrigger>
            <TabsTrigger value="finance" className="min-h-11 rounded-full border border-white/15 bg-black/30 px-4 text-white"><Wallet className="mr-2 h-4 w-4" />Finance</TabsTrigger>
            <TabsTrigger value="ops" className="min-h-11 rounded-full border border-white/15 bg-black/30 px-4 text-white"><Building2 className="mr-2 h-4 w-4" />Ops</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-5 grid gap-4 lg:grid-cols-[.78fr_1.22fr]">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white">
              <SectionTitle icon={Search} title="Find a user" subtitle="Search by name, team, email or user ID." />
              <div className="mt-4 flex gap-2">
                <Input value={userSearchInput} onChange={(e) => setUserSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setUserSearchTerm(userSearchInput.trim())} placeholder="Search user" className="border-white/10 bg-black/35" />
                <Button onClick={() => setUserSearchTerm(userSearchInput.trim())} disabled={searchingUsers}>Search</Button>
              </div>
              <div className="mt-4 text-xs font-black uppercase tracking-[.14em] text-white/40">Online now</div>
              <div className="mt-2 space-y-2">
                {onlineDetailed.slice(0, 10).map((row) => (
                  <button key={row.userId} onClick={() => selectUser(String(row.userId))} className="w-full rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-left">
                    <b>🟢 {row.user?.managerTeamName || row.user?.name || row.user?.email || row.userId}</b>
                    <div className="text-xs text-emerald-100/70">Seen {row.lastSeenSecondsAgo}s ago</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 max-h-[42rem] space-y-2 overflow-y-auto pr-1">
                {shownUsers.map((u) => (
                  <button key={u.id} onClick={() => selectUser(u.id)} className={`w-full rounded-xl border p-3 text-left ${selectedUserId === u.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-black/25"}`}>
                    <div className="flex justify-between gap-2">
                      <b className="truncate">{u.managerTeamName || u.name || u.email || u.id}</b>
                      <Badge className={u.isBanned ? "bg-red-500/20 text-red-200" : "bg-emerald-500/20 text-emerald-200"}>{u.isBanned ? "Banned" : "Active"}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs text-white/45">{u.email || u.id}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/55"><span>{u.cardsCount || 0} cards</span><span>{u.listingsCount || 0} listed</span><span>{money(u.balance)}</span></div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-white/10 bg-white/[0.06] p-4 text-white">
              <SectionTitle icon={Eye} title="Complete user snapshot" subtitle="All cards are available with filters and pagination — not only the newest 100." />
              {!selectedUserId ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-8 text-center text-white/45">Select a user.</div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xl font-black">{selectedUserDetails?.user?.managerTeamName || selectedUserDetails?.user?.name || selectedUserDetails?.user?.email || selectedUserId}</div>
                    <div className="mt-1 text-xs text-white/45">{selectedUserDetails?.user?.email || selectedUserId}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Mini label="Total cards" value={cardData?.total || 0} />
                    <Mini label="Showing" value={cards.length} />
                    <Mini label="Transactions" value={asArray(selectedUserDetails?.recentTransactions).length} />
                    <Mini label="Wallet" value={money(selectedUserDetails?.wallet?.balance || 0)} />
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Input value={cardSearch} onChange={(e) => { setCardSearch(e.target.value); setCardPage(1); }} placeholder="Player, team, serial or card ID" className="border-white/10 bg-black/35" />
                    <select value={cardRarity} onChange={(e) => { setCardRarity(e.target.value); setCardPage(1); }} className="min-h-10 rounded-md border border-white/10 bg-black/35 px-3"><option value="all">All rarities</option><option>common</option><option>rare</option><option>unique</option><option>epic</option><option>legendary</option></select>
                    <select value={cardStatus} onChange={(e) => { setCardStatus(e.target.value); setCardPage(1); }} className="min-h-10 rounded-md border border-white/10 bg-black/35 px-3"><option value="all">All status</option><option value="owned">Not listed</option><option value="listed">Listed</option></select>
                    <select value={cardSort} onChange={(e) => { setCardSort(e.target.value); setCardPage(1); }} className="min-h-10 rounded-md border border-white/10 bg-black/35 px-3"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="player">Player name</option><option value="rarity">Rarity</option></select>
                  </div>
                  <div className="flex flex-wrap gap-2">{asArray(cardData?.rarityCounts).map((r: any) => <Badge key={r.rarity} variant="outline" className="border-white/15 text-white/70">{r.rarity}: {r.count}</Badge>)}</div>
                  <div className="max-h-[38rem] overflow-y-auto rounded-xl border border-white/10">
                    {cardsLoading ? <div className="p-6 text-center text-white/45">Loading cards…</div> : cards.map((card) => (
                      <div key={card.id} className="grid grid-cols-[60px_1fr_auto] items-center gap-3 border-b border-white/10 bg-black/20 p-3 last:border-b-0">
                        <button onClick={() => { setLookupInput(String(card.id)); setLookupTerm(String(card.id)); setActiveTab("cards"); }} className="flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100 hover:bg-cyan-300/20">#{card.id}</button>
                        <div className="min-w-0"><div className="truncate font-black">{card.playerName || "Unknown player"}</div><div className="truncate text-xs text-white/45">{card.team || "Unknown team"} • {card.position || "-"} • {card.serialId || "No serial"}</div><div className="mt-1 text-[10px] text-white/35">Acquired {timeAgo(card.acquiredAt)} • Level {card.level || 1} • XP {card.xp || 0}</div></div>
                        <div className="text-right"><Badge>{card.rarity}</Badge><div className="mt-2 text-xs text-white/50">{card.forSale ? `Listed ${money(card.price)}` : "Owned"}</div></div>
                      </div>
                    ))}
                  </div>
                  <Pager page={cardData?.page || 1} pages={cardData?.pages || 1} onPage={setCardPage} label={`${cardData?.total || 0} cards`} />
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="cards" className="mt-5">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white sm:p-6">
              <SectionTitle icon={CreditCard} title="Card ownership lookup" subtitle="Enter a card ID such as #255968 or a complete serial number to see its current owner and reward history." />
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input value={lookupInput} onChange={(e) => setLookupInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setLookupTerm(lookupInput.trim())} placeholder="#255968 or card serial" className="min-h-11 border-white/10 bg-black/35" />
                <Button className="min-h-11 sm:min-w-36" onClick={() => setLookupTerm(lookupInput.trim())} disabled={!lookupInput.trim() || lookupLoading}><Search className="mr-2 h-4 w-4" />{lookupLoading ? "Searching…" : "Find card"}</Button>
              </div>

              {lookupError && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{String((lookupError as Error).message || "Card lookup failed")}</div>}

              {lookupData?.card && (
                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_.9fr]">
                  <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-purple-500/10 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                        {lookupData.card.imageUrl ? <img src={lookupData.card.imageUrl} alt={lookupData.card.playerName || "Player"} className="h-full w-full object-contain" /> : <CreditCard className="h-10 w-10 text-cyan-200" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><Badge className="capitalize">{lookupData.card.rarity}</Badge>{lookupData.awardedAsRunnerUp && <Badge className="bg-amber-400/20 text-amber-100"><Gift className="mr-1 h-3 w-3" />Runner-up reward</Badge>}</div>
                        <h3 className="mt-3 break-words text-2xl font-black">{lookupData.card.playerName || "Unknown player"}</h3>
                        <p className="mt-1 text-sm text-white/55">{lookupData.card.team || "Unknown team"} • {lookupData.card.position || "-"}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Detail label="Card ID" value={`#${lookupData.card.id}`} /><Detail label="Serial" value={lookupData.card.serialId || "—"} /><Detail label="Level" value={lookupData.card.level || 1} /><Detail label="Status" value={lookupData.card.forSale ? `Listed ${money(lookupData.card.price)}` : "Owned"} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">Current owner</div>
                    {lookupData.owner ? (
                      <>
                        <div className="mt-2 break-words text-xl font-black">{lookupData.owner.managerTeamName || lookupData.owner.name || lookupData.owner.email || lookupData.owner.id}</div>
                        <div className="mt-1 break-all text-sm text-white/50">{lookupData.owner.email || lookupData.owner.id}</div>
                        <div className="mt-4 grid grid-cols-2 gap-3"><Mini label="Owner ID" value={lookupData.owner.id} /><Mini label="Wallet" value={money(lookupData.owner.walletBalance)} /></div>
                        <Button className="mt-4 w-full" onClick={() => selectUser(String(lookupData.owner.id))}><Eye className="mr-2 h-4 w-4" />Open owner profile</Button>
                      </>
                    ) : <div className="mt-3 text-white/45">This card currently has no owner.</div>}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-5 lg:col-span-2">
                    <div className="flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-amber-200" />Reward and settlement history</div>
                    <div className="mt-4 space-y-3">
                      {asArray(lookupData.rewardHistory).length ? asArray(lookupData.rewardHistory).map((reward: any) => (
                        <div key={reward.entryId} className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-black">{reward.competitionName}</div><div className="mt-1 text-xs text-white/45">GW{reward.gameWeek} • {reward.rarity} • settled rank #{reward.rank}</div></div><Badge className={Number(reward.rank) >= 2 && Number(reward.rank) <= 5 ? "bg-amber-400/20 text-amber-100" : ""}>{Number(reward.rank) >= 2 && Number(reward.rank) <= 5 ? "Runner-up card" : "Prize card"}</Badge></div>
                          <div className="mt-3 text-sm text-white/65">Awarded to <button className="font-bold text-cyan-200 hover:underline" onClick={() => selectUser(String(reward.rewardedUserId))}>{reward.rewardedManager || reward.rewardedEmail || reward.rewardedUserId}</button> with {Number(reward.totalScore || 0).toFixed(1)} points.</div>
                        </div>
                      )) : <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">No tournament prize history is linked to this card.</div>}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-5">
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white">
              <SectionTitle icon={Activity} title="Detailed activity explorer" subtitle="Search all transactions and audit events by user, action, route, amount or metadata." />
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
                <Input value={activitySearch} onChange={(e) => { setActivitySearch(e.target.value); setActivityPage(1); }} placeholder="Search action, route, description…" className="border-white/10 bg-black/35" />
                <Input value={activityUserId} onChange={(e) => { setActivityUserId(e.target.value); setActivityPage(1); }} placeholder="User ID filter" className="border-white/10 bg-black/35" />
                <select value={activitySource} onChange={(e) => { setActivitySource(e.target.value); setActivityPage(1); }} className="min-h-10 rounded-md border border-white/10 bg-black/35 px-3"><option value="all">All sources</option><option value="transaction">Transactions</option><option value="audit">Audit</option></select>
                <Button onClick={() => refetchActivity()}><Search className="mr-2 h-4 w-4" />Search</Button>
              </div>
              <div className="mt-4 space-y-3">{activityLoading ? <div className="p-8 text-center text-white/45">Loading activity…</div> : activity.map((item) => <ActivityCard key={item.id} item={item} onUser={() => item.userId && selectUser(String(item.userId))} />)}</div>
              <Pager page={activityData?.page || 1} pages={activityData?.pages || 1} onPage={setActivityPage} label={`${activityData?.total || 0} events`} />
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="mt-5 space-y-4">
            <AdminTransactionExplorer />
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white"><SectionTitle icon={Wallet} title="Withdrawals" /><div className="mt-4 space-y-2">{asArray(withdrawals).map((wr) => <div key={wr.id} className="rounded-xl border border-white/10 bg-black/25 p-3"><b>{wr.userName || wr.email || wr.userId}</b><div className="text-xs text-white/45">{money(wr.amount)} • Fee {money(wr.fee)} • Net {money(wr.netAmount)} • {wr.status}</div></div>)}</div></Card>
          </TabsContent>

          <TabsContent value="ops" className="mt-5 space-y-4">
            <AdminBackofficePanel />
            <AdminIntegrityPanel />
            <Card className="border-white/10 bg-white/[0.06] p-4 text-white"><SectionTitle icon={Trophy} title="Tournaments" /><div className="mt-4 grid gap-2 md:grid-cols-2">{allCompetitions.map((c) => <div key={c.id} className="rounded-xl border border-white/10 bg-black/25 p-3"><b>{c.name}</b><div className="text-xs text-white/45">GW{c.gameWeek} • {c.tier} • {c.status} • {c.entryCount || 0} entries</div></div>)}</div></Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return <div className="flex items-start gap-3"><div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-100"><Icon className="h-4 w-4" /></div><div><h2 className="text-lg font-black">{title}</h2>{subtitle && <p className="mt-1 text-sm text-white/45">{subtitle}</p>}</div></div>;
}

function Mini({ label, value }: { label: string; value: any }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">{label}</div><div className="mt-1 truncate text-xl font-black">{value}</div></div>;
}

function Pager({ page, pages, onPage, label }: { page: number; pages: number; onPage: (page: number) => void; label: string }) {
  return <div className="mt-4 flex items-center justify-between gap-3"><div className="text-xs text-white/45">{label} • Page {page} of {pages}</div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>;
}

function ActivityCard({ item, onUser }: { item: any; onUser: () => void }) {
  const meta = item.meta || {};
  const path = meta.path || meta.route;
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={item.source === "transaction" ? "bg-emerald-500/20 text-emerald-200" : "bg-cyan-500/20 text-cyan-200"}>{item.source}</Badge><span className="font-black">{item.label || item.type}</span></div><button onClick={onUser} className="mt-2 text-left text-sm font-semibold text-cyan-200 hover:underline">{item.userName || item.email || item.userId || "System"}</button><div className="mt-1 text-xs text-white/40">{item.email || item.userId || "No user"} • {timeAgo(item.createdAt)}</div></div>{item.amount != null && <div className="text-right"><div className="text-xl font-black">{money(item.amount)}</div><div className="text-xs text-white/45">Gross {money(item.grossAmount)} • Fee {money(item.feeAmount)} • Net {money(item.netAmount)}</div></div>}</div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><Detail label="Type" value={item.type || "-"} /><Detail label="Status" value={item.status || "-"} /><Detail label="Source type" value={item.sourceType || "-"} /><Detail label="Route / path" value={path || "-"} /></div>{Object.keys(meta).length > 0 && <details className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-[.12em] text-white/55">Event metadata</summary><pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs text-cyan-100/70">{JSON.stringify(meta, null, 2)}</pre></details>}</div>;
}

function Detail({ label, value }: { label: string; value: any }) {
  return <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-2"><div className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">{label}</div><div className="mt-1 break-all text-white/70">{String(value)}</div></div>;
}
