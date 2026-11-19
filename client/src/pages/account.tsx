import ArenaNotificationPreferences from "../components/notifications/ArenaNotificationPreferences";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Bell, User as UserIcon, Mail, CheckCircle2, Gift, Copy, Link2, Shield, Gavel, Users, Banknote, Trophy, Medal, Sparkles, Crown } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { queryClient } from "../lib/queryClient";
import { Link, useLocation } from "wouter";
import { notificationDestination } from "../lib/notifications";
import { LiveHero, LivePageShell, LiveStatCard } from "../components/layout/LivePageShell";

type NotificationItem = {
  id: number;
  userId: string;
  type: "win" | "runner_up" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  dedupeKey?: string | null;
  replacementClaimId?: number | null;
};

type MissedRewardStatus = {
  pendingWindows: string[];
  cap: number;
  commonCount: number;
  capReached: boolean;
  claimDeadline: string;
};
type CurrentWeeklyStatus = {canClaim:boolean;capReached:boolean;commonCount:number;cap:number;eligibleFrom?:string};
type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

type UserProfile = {
  id: string;
  name?: string | null;
  email?: string | null;
  managerTeamName?: string | null;
};

type ReferralMeResponse = { code: string; url: string; };

type ReferralHistoryItem = {
  id: number;
  referredUserId: string;
  referredName: string;
  referredEmail: string | null;
  rewardCardId: number | null;
  rewardCard: any;
  createdAt: string | null;
};

type ReferralHistoryResponse = {
  referrals: ReferralHistoryItem[];
  totalReferrals: number;
  rewardsGranted: number;
};

type UserCardResponse = any[] | { cards?: any[] };
type EntryResponse = any[];

function listFromCards(data: UserCardResponse | undefined) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.cards) ? data.cards : [];
}

export default function AccountPage() {
  const { toast } = useToast();
  const [teamNameInput, setTeamNameInput] = useState("");
  const [copyingLink, setCopyingLink] = useState(false);
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "inbox" ? "inbox" : "profile");
  useEffect(() => {
    const tab = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("tab");
    if (tab === "inbox" || tab === "profile" || tab === "referrals") setActiveTab(tab);
  }, [location]);

  const { data: user, isLoading: userLoading } = useQuery<UserProfile>({ queryKey: ["/api/user"] });

  const { data: cardsData } = useQuery<UserCardResponse>({
    queryKey: ["/api/user/cards"],
    queryFn: async () => {
      const res = await fetch("/api/user/cards", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: entries } = useQuery<EntryResponse>({
    queryKey: ["/api/competitions/my-entries"],
    queryFn: async () => {
      const res = await fetch("/api/competitions/my-entries", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const cards = listFromCards(cardsData);
  const tournamentsEntered = Array.isArray(entries) ? entries.length : 0;
  const tournamentWins = Array.isArray(entries) ? entries.filter((entry: any) => Number(entry.rank || entry.finalRank || 0) === 1 || entry.status === "winner").length : 0;
  const winRate = tournamentsEntered > 0 ? Math.round((tournamentWins / tournamentsEntered) * 100) : 0;

  useEffect(() => { setTeamNameInput(user?.managerTeamName || ""); }, [user?.managerTeamName]);

  const updateTeamNameMutation = useMutation({
    mutationFn: async (managerTeamName: string) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerTeamName }),
      });
      if (!res.ok) throw new Error("Failed to update team name");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Team name updated" });
    },
    onError: () => toast({ title: "Error", description: "Could not update team name.", variant: "destructive" }),
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery<NotificationResponse>({ queryKey: ["/api/notifications"] });
  const { data: recovery, isLoading: recoveryLoading } = useQuery<MissedRewardStatus>({
    queryKey:["/api/rewards/november-recovery"],
    queryFn:async()=>{
      const res=await fetch("/api/rewards/november-recovery",{credentials:"include"});
      if(!res.ok)throw new Error("Could not load missed rewards");
      return res.json();
    },
    staleTime:15_000,
  });
  const { data: weekly } = useQuery<CurrentWeeklyStatus>({queryKey:["/api/rewards/daily-login"]});
  const recoverMutation=useMutation({
    mutationFn:async(windowStart:string)=>{
      const res=await fetch(`/api/rewards/november-recovery/${encodeURIComponent(windowStart)}/claim`,{method:"POST",credentials:"include"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"Could not claim recovered card");
      return data as {claimed:boolean;alreadyClaimed:boolean;playerName:string};
    },
    onSuccess:async(result)=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/rewards/november-recovery"]}),
        queryClient.invalidateQueries({queryKey:["/api/rewards/daily-login"]}),
        queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
        queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
      ]);
      toast({title:result.alreadyClaimed?"Already recovered":"Common card recovered",
        description:`${result.playerName} is in your Collection.`});
    },
    onError:(error:Error)=>toast({title:"Reward remains available",description:error.message,variant:"destructive"}),
  });
  const mintCurrentMutation=useMutation({
    mutationFn:async()=>{
      const res=await fetch("/api/rewards/daily-login/claim",{method:"POST",credentials:"include"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"Could not mint current weekly card");
      return data as {claimed:boolean;alreadyClaimed?:boolean;card?:{player?:{name?:string}}};
    },
    onSuccess:async(result)=>{
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/rewards/daily-login"]}),
        queryClient.invalidateQueries({queryKey:["/api/rewards/november-recovery"]}),
        queryClient.invalidateQueries({queryKey:["/api/user/cards"]}),
        queryClient.invalidateQueries({queryKey:["/api/notifications"]}),
      ]);
      toast({title:result.claimed?"Weekly Common card minted":result.alreadyClaimed?"Already claimed":"No new card minted",
        description:result.card?.player?.name ? `${result.card.player.name} was added to your Collection.` : "Your weekly status has been refreshed."});
    },
    onError:(error:Error)=>toast({title:"Weekly mint unavailable",description:error.message,variant:"destructive"}),
  });
  const openInboxNotification=(note:NotificationItem)=>{
    if(!note.read)markOneMutation.mutate(note.id);
    const destination=notificationDestination(note);
    if(destination.startsWith("/account?tab=inbox")){
      setActiveTab("inbox");
      // The existing replacement-claim dialog reads the notification query param.
      navigate(destination);
      return;
    }
    navigate(destination);
  };

  const { data: referralData, isLoading: referralLoading } = useQuery<ReferralMeResponse>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch referral link");
      return res.json();
    },
  });

  const { data: adminCheck, isLoading: adminCheckLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
  });

  const { data: referralHistory, isLoading: referralHistoryLoading } = useQuery<ReferralHistoryResponse>({
    queryKey: ["/api/referrals/history"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/history", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch referral history");
      return res.json();
    },
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to update notification");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to update notifications");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Inbox updated", description: "All notifications marked as read." });
    },
    onError: () => toast({ title: "Error", description: "Could not mark notifications as read.", variant: "destructive" }),
  });

  const copyReferralLink = async () => {
    const url = String(referralData?.url || "").trim();
    if (!url) {
      toast({ title: "Referral link unavailable", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    setCopyingLink(true);
    try {
      await navigator?.clipboard?.writeText(url);
      toast({ title: "Referral link copied", description: "Share it to earn a random new common card per successful signup." });
    } catch {
      toast({ title: "Could not copy", description: "Copy the link manually from the field.", variant: "destructive" });
    } finally {
      setCopyingLink(false);
    }
  };

  return (
    <LivePageShell tone="profile">
      <LiveHero
        eyebrow="Trophy Room"
        title={user?.managerTeamName || user?.name || "Your Fantasy Arena Profile"}
        description="Your team identity, achievements, inbox and referral rewards in one premium profile space."
      >
        <LiveStatCard label="Cards Owned" value={String(cards.length)} helper="Collection size" />
        <LiveStatCard label="Tournaments" value={String(tournamentsEntered)} helper="Entered" />
        <LiveStatCard label="Win Rate" value={`${winRate}%`} helper={`${tournamentWins} wins`} />
      </LiveHero>

      <Tabs value={activeTab} onValueChange={value=>{
        setActiveTab(value);
        navigate(value==="profile"?"/account":`/account?tab=${encodeURIComponent(value)}`);
      }} className="w-full">
        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3 rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur-xl">
          <TabsTrigger value="profile" className="flex items-center gap-2 rounded-xl"><UserIcon className="w-4 h-4" />Profile</TabsTrigger>
          <TabsTrigger value="inbox" className="flex items-center gap-2 rounded-xl"><Bell className="w-4 h-4" />Inbox{!!inbox?.unreadCount && <Badge>{inbox.unreadCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-2 rounded-xl"><Users className="w-4 h-4" />Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="cinematic-glass space-y-5 border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
            {userLoading ? (
              <><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-64" /><Skeleton className="h-5 w-56" /></>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-300/20 bg-yellow-300/10 text-yellow-200 shadow-2xl shadow-yellow-500/10">
                      <Trophy className="h-9 w-9" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Team Identity</p>
                    <h2 className="mt-2 text-2xl font-black">{user?.managerTeamName || "Team name not set"}</h2>
                    <p className="mt-1 text-sm text-white/50">{user?.name || "Manager"} • {user?.email || "No email set"}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="gap-1"><Medal className="h-3 w-3" /> Level {Math.max(1, Math.floor(cards.length / 10) + tournamentWins + 1)}</Badge>
                      <Badge variant="outline" className="border-white/20 text-white">{cards.length} cards</Badge>
                      <Badge variant="outline" className="border-white/20 text-white">{tournamentWins} wins</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TrophyStat icon={<Crown className="h-4 w-4" />} label="Tournament Wins" value={String(tournamentWins)} />
                    <TrophyStat icon={<Sparkles className="h-4 w-4" />} label="Win Rate" value={`${winRate}%`} />
                    <TrophyStat icon={<Gift className="h-4 w-4" />} label="Referral Rewards" value={String(referralHistory?.rewardsGranted || 0)} />
                    <TrophyStat icon={<Bell className="h-4 w-4" />} label="Unread Alerts" value={String(inbox?.unreadCount || 0)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2"><Shield className="h-4 w-4 text-blue-300" /><p className="text-sm font-semibold">Access & Tools</p>{adminCheckLoading ? <Badge variant="secondary">Checking access...</Badge> : adminCheck?.isAdmin ? <Badge>Admin Enabled</Badge> : <Badge variant="secondary">Standard User</Badge>}</div>
                  {adminCheck?.isAdmin ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href="/admin"><Button size="sm"><Shield className="mr-1 h-3.5 w-3.5" />Open Admin Panel</Button></Link>
                      <Link href="/admin-revenue"><Button size="sm" variant="outline"><Banknote className="mr-1 h-3.5 w-3.5" />Revenue</Button></Link>
                      <Link href="/auctions"><Button size="sm" variant="outline"><Gavel className="mr-1 h-3.5 w-3.5" />Open Auctions</Button></Link>
                    </div>
                  ) : <p className="text-xs text-white/50">Admin-only tools appear automatically when this account has admin access.</p>}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Team Name</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input value={teamNameInput} onChange={(e) => setTeamNameInput(e.target.value)} placeholder="Enter team name" className="max-w-xs bg-black/30" maxLength={30} />
                    <Button size="sm" onClick={() => updateTeamNameMutation.mutate(teamNameInput.trim())} disabled={teamNameInput.trim().length < 3 || updateTeamNameMutation.isPending}>Save Team Name</Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><Gift className="w-4 h-4 text-emerald-300" /><p className="text-sm font-semibold">Referral Program</p><Badge variant="secondary" className="text-emerald-700">Reward: random new Common card</Badge></div>
                  <p className="mb-3 text-xs text-white/50">Each successful signup from your referral link gives you one random Common card you do not own yet.</p>
                  {referralLoading ? <Skeleton className="h-9 w-full max-w-xl" /> : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[240px] flex-1 max-w-xl"><Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45" /><Input readOnly value={referralData?.url || ""} className="pl-8 bg-black/30" aria-label="Referral link" /></div>
                      <Button size="sm" onClick={copyReferralLink} disabled={copyingLink || !referralData?.url}><Copy className="w-4 h-4 mr-1" />{copyingLink ? "Copying..." : "Copy Link"}</Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          <ArenaNotificationPreferences />
          <Card id="missed-weekly-cards" className="mb-4 border-cyan-300/20 bg-cyan-400/[0.05] p-5 text-white">
            <h2 className="text-lg font-semibold">Weekly Common rewards</h2>
            <p className="mt-1 text-sm text-white/60">Read messages remain accessible. Minting is a separate action and a card is never granted twice.</p>
            {weekly?.canClaim && !weekly?.capReached && (
              <Button className="mt-3" disabled={mintCurrentMutation.isPending}
                onClick={()=>mintCurrentMutation.mutate()}>Mint current weekly Common card</Button>
            )}
            <h3 className="mt-4 text-sm font-bold text-white/85">Missed during the November football-data interruption</h3>
            {recoveryLoading?<p className="mt-2 text-sm text-white/50">Checking your reward windows...</p>:
             (recovery?.pendingWindows?.length || 0)>0 ? (
               <div className="mt-2 space-y-2">
                 {recovery!.pendingWindows.map(windowStart=>(
                   <div key={windowStart} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 p-3">
                     <span className="text-sm">Unclaimed week starting {windowStart}</span>
                     <Button size="sm" disabled={recoverMutation.isPending||recovery?.capReached}
                       onClick={()=>recoverMutation.mutate(windowStart)}>
                       {recoverMutation.isPending&&recoverMutation.variables===windowStart?"Minting...":"Mint missed Common"}
                     </Button>
                   </div>
                 ))}
                 {recovery?.capReached&&<p className="text-sm text-amber-200">Your Common collection is at its 20-card cap. Your missed claim stays pending; make room before minting.</p>}
               </div>
             ) : <p className="mt-2 text-sm text-white/50">No expired, unclaimed weekly rewards from this interruption are currently available.</p>}
            <p className="mt-2 text-xs text-white/50">Missed rewards can be claimed through 9 December 2026. Current weekly rewards and departure replacements have their own claim actions.</p>
          </Card>
          <Card className="border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Notifications</h2><Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>Mark all read</Button></div>
            {inboxLoading ? <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : inbox?.notifications?.length ? (
              <div className="space-y-3">{inbox.notifications.map((note) => <div key={note.id} className={`rounded-xl border border-white/10 p-3 ${note.read ? "bg-black/20 opacity-80" : "bg-primary/10"}`}><div className="flex items-start justify-between gap-3"><button type="button" onClick={()=>openInboxNotification(note)} className="min-w-0 flex-1 text-left hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-cyan-300" aria-label={`Open ${note.title}`}><p className="font-medium text-sm">{note.title}</p><p className="text-sm text-white/55 mt-1">{note.message}</p><p className="text-xs text-white/40 mt-2">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}</p></button><div className="flex shrink-0 flex-col items-end gap-1"><Button size="sm" variant="outline" onClick={()=>openInboxNotification(note)}>Open</Button>{!note.read && <Button size="sm" variant="ghost" onClick={() => markOneMutation.mutate(note.id)}><CheckCircle2 className="w-4 h-4 mr-1" />Read</Button>}</div></div></div>)}</div>
            ) : <p className="text-sm text-white/50">No notifications yet.</p>}
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <Card className="border-white/10 bg-white/[0.06] p-5 text-white backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4"><h2 className="text-lg font-semibold">Referral Stats</h2><div className="flex items-center gap-2"><Badge variant="outline" className="border-white/20 text-white">Total Referrals: {Number(referralHistory?.totalReferrals || 0)}</Badge><Badge variant="outline" className="border-white/20 text-white">Rewards Given: {Number(referralHistory?.rewardsGranted || 0)}</Badge></div></div>
            {referralHistoryLoading ? <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : Array.isArray(referralHistory?.referrals) && referralHistory!.referrals.length > 0 ? (
              <div className="space-y-3">{referralHistory!.referrals.map((item) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-sm">{item.referredName}</p><p className="text-xs text-white/50">{item.referredEmail || item.referredUserId}</p><p className="text-xs text-white/40 mt-1">Joined via referral: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</p></div>{item.rewardCard ? <Badge className="capitalize">Reward: {String(item.rewardCard?.rarity || "common")} {String(item.rewardCard?.player?.name || "Card")}</Badge> : <Badge variant="secondary">No reward card</Badge>}</div></div>)}</div>
            ) : <p className="text-sm text-white/50">No referrals yet. Share your referral link in the Profile tab.</p>}
          </Card>
        </TabsContent>
      </Tabs>
    </LivePageShell>
  );
}

function TrophyStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="realistic-hover-lift rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-yellow-200">{icon}</div><p className="text-xs uppercase tracking-[0.16em] text-white/45">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></div>;
}
