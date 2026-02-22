import { useQuery, useMutation } from "@tanstack/react-query";
// Fixed: @/lib -> ../lib
import { apiRequest, queryClient } from "../lib/queryClient";
// Fixed: @/components -> ../components
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
// Fixed: @shared -> ../../../shared
import { type WithdrawalRequest, type Competition } from "../../../shared/schema";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Building2,
  Smartphone,
  DollarSign,
  Send,
  Users,
  TrendingUp,
  AlertTriangle,
  Activity,
  Trophy,
  Zap,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";

type TournamentEntry = {
  id: number;
  totalScore?: number | null;
};

type TournamentWithStats = Competition & {
  entryCount?: number;
  entries?: TournamentEntry[];
};

export default function AdminPage() {
  const { toast } = useToast();
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<number | null>(null);
  const [tournamentForm, setTournamentForm] = useState({
    name: "",
    tier: "common",
    entryFee: "0",
    status: "open",
    gameWeek: "27",
    startDate: "",
    endDate: "",
    prizeCardRarity: "rare",
  });

  const { data: autoUpdateStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/scores/auto-update"],
  });
  const autoUpdateEnabled = Boolean(autoUpdateStatus?.enabled);

  const { data: adminStats, refetch: refetchAdminStats } = useQuery<{
    users: number;
    cards: number;
    auctions: number;
    competitions: number;
    transactions: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: usersResponse, refetch: refetchUsers } = useQuery<{ users: any[]; total: number }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: marketListings, refetch: refetchMarketListings } = useQuery<any[]>({
    queryKey: ["/api/marketplace"],
  });

  const { refetch: refetchAdminLogs } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["/api/admin/logs"],
  });

  const { data: trafficData, refetch: refetchTraffic } = useQuery<{
    windowMinutes: number;
    requestsLastMinute: number;
    requestsLast5Minutes: number;
    requestsLastHour: number;
    onlineUsersLast10Minutes: number;
    activeUsers: Array<{ userId: string; lastSeenSecondsAgo: number }>;
    topRoutes: Array<{ route: string; count: number; errorRate: number; avgDurationMs: number }>;
    perMinuteSeries: Array<{ minuteOffset: number; count: number }>;
  }>({
    queryKey: ["/api/admin/traffic"],
  });

  // Withdrawals
  const { data: allWithdrawals, isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals"],
  });

  const { data: pendingWithdrawals, refetch: refetchPendingWithdrawals } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
  });

  // Competitions
  const { data: competitions, isLoading: compLoading, refetch: refetchComps } = useQuery<TournamentWithStats[]>({
    queryKey: ["/api/competitions"],
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: async (data: { id: number; action: "approve" | "reject"; adminNotes?: string }) => {
      const status = data.action === "approve" ? "completed" : "rejected";
      const res = await apiRequest("POST", `/api/admin/withdrawals/${data.id}/review`, {
        status,
        adminNotes: data.adminNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals/pending"] });
      toast({ title: "Withdrawal processed successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Scoring mutations
  const updateScoresMutation = useMutation({
    mutationFn: async (competitionId?: number) => {
      const endpoint = competitionId 
        ? `/api/admin/scores/update/${competitionId}`
        : `/api/admin/scores/update-all`;
      const res = await apiRequest("POST", endpoint, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ 
        title: "Scores Updated", 
        description: data.message || "Score update triggered successfully" 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update scores", 
        variant: "destructive" 
      });
    },
  });

  const toggleAutoUpdateMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/scores/auto-update", { enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scores/auto-update"] });
      toast({ 
        title: "Auto-Update Toggled", 
        description: data.message 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to toggle auto-update", 
        variant: "destructive" 
      });
    },
  });

  const settleCompetitionMutation = useMutation({
    mutationFn: async (competitionId: number) => {
      const res = await apiRequest("POST", `/api/admin/competitions/settle/${competitionId}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchComps();
      toast({ title: "Competition Settled", description: "Prize distribution complete" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to settle competition", 
        variant: "destructive" 
      });
    },
  });

  const saveTournamentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: tournamentForm.name,
        tier: tournamentForm.tier,
        entryFee: Number(tournamentForm.entryFee || 0),
        status: tournamentForm.status,
        gameWeek: Number(tournamentForm.gameWeek || 0),
        startDate: tournamentForm.startDate,
        endDate: tournamentForm.endDate,
        prizeCardRarity: tournamentForm.prizeCardRarity,
      };

      if (editingTournamentId) {
        const res = await apiRequest("PATCH", `/api/admin/competitions/${editingTournamentId}`, payload);
        return res.json();
      }

      const res = await apiRequest("POST", "/api/admin/competitions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      setEditorOpen(false);
      setEditingTournamentId(null);
      toast({ title: "Tournament saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save tournament",
        variant: "destructive",
      });
    },
  });

  const grantTodayCardsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cards/grant-today-starters", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Cards Granted",
        description: data?.message || "5 common cards granted per registered user",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to grant cards", variant: "destructive" });
    },
  });

  const grantRaritySamplesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cards/grant-rarity-samples", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Sample Cards Added",
        description: data?.message || "Added one of each rarity to your collection",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to grant sample cards", variant: "destructive" });
    },
  });

  const resetUsersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/reset-users", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      toast({ title: "Users Reset", description: data?.message || "All users removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reset users", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "processing": return <Badge variant="outline" className="text-blue-500 border-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "completed": return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "rejected": return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const competitionStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge className="bg-green-500/20 text-green-600 border-green-300">Open</Badge>;
      case "active": return <Badge className="bg-blue-500/20 text-blue-600 border-blue-300">Active</Badge>;
      case "upcoming": return <Badge className="bg-purple-500/20 text-purple-600 border-purple-300">Upcoming</Badge>;
      case "completed": return <Badge className="bg-gray-500/20 text-gray-600 border-gray-300">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const tierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      common: "bg-stone-500/20 text-stone-600",
      rare: "bg-blue-500/20 text-blue-600",
      unique: "bg-purple-500/20 text-purple-600",
      legendary: "bg-yellow-500/20 text-yellow-600",
    };
    return <Badge className={colors[tier] || "bg-gray-500/20"}>{tier}</Badge>;
  };

  const paymentMethodLabel = (m: string) => {
    switch (m) {
      case "eft": return "EFT";
      case "ewallet": return "eWallet";
      case "bank_transfer": return "Bank Transfer";
      case "mobile_money": return "Mobile Money";
      default: return m;
    }
  };

  const paymentIcon = (m: string) => {
    return m === "ewallet" || m === "mobile_money" ? Smartphone : Building2;
  };

  const sparklineData = trafficData?.perMinuteSeries || [];
  const sparklineMax = Math.max(1, ...sparklineData.map((p) => p.count || 0));
  const sparklinePoints = sparklineData
    .map((point, index) => {
      const x = sparklineData.length <= 1 ? 0 : (index / (sparklineData.length - 1)) * 100;
      const y = 32 - ((point.count || 0) / sparklineMax) * 32;
      return `${x},${y}`;
    })
    .join(" ");

  const openCreateTournament = () => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    setEditingTournamentId(null);
    setTournamentForm({
      name: "",
      tier: "common",
      entryFee: "0",
      status: "open",
      gameWeek: "27",
      startDate: now.toISOString().slice(0, 16),
      endDate: nextWeek.toISOString().slice(0, 16),
      prizeCardRarity: "rare",
    });
    setEditorOpen(true);
  };

  const openEditTournament = (competition: Competition) => {
    setEditingTournamentId(competition.id);
    setTournamentForm({
      name: String(competition.name || ""),
      tier: String(competition.tier || "common"),
      entryFee: String(Number(competition.entryFee || 0)),
      status: String(competition.status || "upcoming"),
      gameWeek: String(Number(competition.gameWeek || 27)),
      startDate: new Date(competition.startDate as any).toISOString().slice(0, 16),
      endDate: new Date(competition.endDate as any).toISOString().slice(0, 16),
      prizeCardRarity: String(competition.prizeCardRarity || "rare"),
    });
    setEditorOpen(true);
  };

  const renderWithdrawalCard = (wr: WithdrawalRequest, showActions: boolean) => {
    const PayIcon = paymentIcon(wr.paymentMethod);
    return (
      <Card key={wr.id} className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">Withdrawal #{wr.id}</p>
              <p className="text-xs text-muted-foreground">User: {wr.userId.substring(0, 12)}...</p>
            </div>
          </div>
          {statusBadge(wr.status)}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-semibold">N${wr.amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fee</p>
            <p className="font-semibold text-red-500">N${wr.fee.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net Payout</p>
            <p className="font-semibold text-green-500">N${wr.netAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-md p-3 mb-3 text-xs space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <PayIcon className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{paymentMethodLabel(wr.paymentMethod)}</span>
          </div>
          {wr.paymentMethod === "ewallet" ? (
            <>
              {wr.ewalletProvider && <div className="flex justify-between"><span className="text-muted-foreground">Provider:</span><span>{wr.ewalletProvider}</span></div>}
              {wr.ewalletId && <div className="flex justify-between"><span className="text-muted-foreground">eWallet ID:</span><span>{wr.ewalletId}</span></div>}
            </>
          ) : (
            <>
              {wr.bankName && <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span><span>{wr.bankName}</span></div>}
              {wr.accountHolder && <div className="flex justify-between"><span className="text-muted-foreground">Account Holder:</span><span>{wr.accountHolder}</span></div>}
              {wr.accountNumber && <div className="flex justify-between"><span className="text-muted-foreground">Account #:</span><span>{wr.accountNumber}</span></div>}
              {wr.iban && <div className="flex justify-between"><span className="text-muted-foreground">IBAN:</span><span>{wr.iban}</span></div>}
              {wr.swiftCode && <div className="flex justify-between"><span className="text-muted-foreground">SWIFT:</span><span>{wr.swiftCode}</span></div>}
            </>
          )}
        </div>

        <div className="text-xs text-muted-foreground mb-2">
          Requested: {wr.createdAt ? new Date(wr.createdAt).toLocaleString() : "N/A"}
          {wr.reviewedAt && <> | Reviewed: {new Date(wr.reviewedAt).toLocaleString()}</>}
        </div>

        {wr.adminNotes && (
          <div className="text-xs bg-muted/30 p-2 rounded mb-2">
            <span className="text-muted-foreground">Admin notes:</span> {wr.adminNotes}
          </div>
        )}

        {showActions && (wr.status === "pending" || wr.status === "processing") && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              placeholder="Admin notes (optional)..."
              value={adminNotes[wr.id] || ""}
              onChange={(e) => setAdminNotes({ ...adminNotes, [wr.id]: e.target.value })}
              className="text-xs h-8"
            />
            <Button
              size="sm"
              variant="default"
              onClick={() => actionMutation.mutate({ id: wr.id, action: "approve", adminNotes: adminNotes[wr.id] })}
              disabled={actionMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => actionMutation.mutate({ id: wr.id, action: "reject", adminNotes: adminNotes[wr.id] })}
              disabled={actionMutation.isPending}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage withdrawal requests and platform operations</p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              const ok = window.confirm("This will remove ALL users, balances, onboarding data, and force everyone to sign in again. Continue?");
              if (ok) resetUsersMutation.mutate();
            }}
            disabled={resetUsersMutation.isPending}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reset Users Now
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{pendingWithdrawals?.filter(w => w.status === "pending").length || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{pendingWithdrawals?.filter(w => w.status === "processing").length || 0}</p>
            <p className="text-xs text-muted-foreground">Processing</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{allWithdrawals?.filter(w => w.status === "completed").length || 0}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </Card>
        </div>

        <Tabs defaultValue="withdrawals" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="withdrawals">
              <DollarSign className="w-4 h-4 mr-2" />
              Withdrawals
            </TabsTrigger>
            <TabsTrigger value="competitions">
              <Trophy className="w-4 h-4 mr-2" />
              Tournaments
            </TabsTrigger>
            <TabsTrigger value="management">
              <Shield className="w-4 h-4 mr-2" />
              Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdrawals">
            <Tabs defaultValue="pending">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">
                  Pending Review ({pendingWithdrawals?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="all">
                  All Requests ({allWithdrawals?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-48 w-full rounded-md" />
                    ))}
                  </div>
                ) : pendingWithdrawals && pendingWithdrawals.length > 0 ? (
                  <div className="space-y-3">
                    {pendingWithdrawals.map((wr) => renderWithdrawalCard(wr, true))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3 opacity-50" />
                    <p className="text-muted-foreground">No pending withdrawal requests.</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="all">
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-48 w-full rounded-md" />
                    ))}
                  </div>
                ) : allWithdrawals && allWithdrawals.length > 0 ? (
                  <div className="space-y-3">
                    {allWithdrawals.map((wr) => renderWithdrawalCard(wr, false))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No withdrawal requests yet.</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="competitions">
            <div className="space-y-6">
              {/* Score Management */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold">Score Management</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateScoresMutation.mutate(undefined)}
                      disabled={updateScoresMutation.isPending}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${updateScoresMutation.isPending ? 'animate-spin' : ''}`} />
                      Update All Scores
                    </Button>
                    <Button
                      size="sm"
                      variant={autoUpdateEnabled ? "default" : "outline"}
                      onClick={() => toggleAutoUpdateMutation.mutate(!autoUpdateEnabled)}
                      disabled={toggleAutoUpdateMutation.isPending}
                    >
                      <Activity className="w-4 h-4 mr-1" />
                      {autoUpdateEnabled ? "Auto-Update ON" : "Auto-Update OFF"}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatically updates tournament scores every 5 minutes from live FPL data. 
                  Scores include decisive actions (goals, assists), performance metrics, and captain bonuses.
                </p>
              </Card>

              {/* Tournaments List */}
              <Card className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    <h3 className="text-lg font-semibold">Active Tournaments</h3>
                  </div>
                  <Button size="sm" onClick={openCreateTournament}>Create Tournament</Button>
                </div>

                {compLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-md" />
                    ))}
                  </div>
                ) : competitions && competitions.length > 0 ? (
                  <div className="space-y-3">
                    {competitions.map((comp) => (
                      <div key={comp.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{comp.name}</h4>
                              {competitionStatusBadge(comp.status)}
                              {tierBadge(comp.tier)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Game Week {comp.gameWeek} • Entry Fee: N${comp.entryFee} • Prize: {comp.prizeCardRarity}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          {(() => {
                            const entries = comp.entryCount ?? comp.entries?.length ?? 0;
                            const prizePool = Number(comp.entryFee || 0) * entries;
                            const scores = (comp.entries || [])
                              .map((entry) => Number(entry.totalScore || 0))
                              .filter((value) => Number.isFinite(value));
                            const avgScore = scores.length
                              ? scores.reduce((sum, score) => sum + score, 0) / scores.length
                              : 0;

                            return (
                              <>
                                <div>
                                  <p className="text-xs text-muted-foreground">Entries</p>
                                  <p className="font-semibold">{entries}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Prize Pool</p>
                                  <p className="font-semibold">N${prizePool.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Avg Score</p>
                                  <p className="font-semibold">{avgScore > 0 ? avgScore.toFixed(1) : "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Duration</p>
                                  <p className="font-semibold">GW {comp.gameWeek}</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditTournament(comp)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateScoresMutation.mutate(comp.id)}
                            disabled={updateScoresMutation.isPending}
                          >
                            <BarChart3 className="w-4 h-4 mr-1" />
                            Update Scores
                          </Button>
                          {comp.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => settleCompetitionMutation.mutate(comp.id)}
                              disabled={settleCompetitionMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Settle & Award Prizes
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No tournaments found</p>
                )}
              </Card>

              {/* Scoring Information */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold">Scoring System</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-green-600 mb-2">Positive Actions</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Goals: 8 points each</li>
                        <li>• Assists: 6 points each</li>
                        <li>• Clean Sheet (GK/DEF): 10/8 points</li>
                        <li>• Penalty Save: 12 points</li>
                        <li>• Performance: up to 40 points</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-red-600 mb-2">Negative Actions</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Own Goal: -10 points</li>
                        <li>• Missed Penalty: -8 points</li>
                        <li>• Yellow Card: -3 points</li>
                        <li>• Red Card: -10 points</li>
                        <li>• Goals Conceded: -2 each</li>
                      </ul>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="font-semibold mb-2">Special Features</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Captain Bonus: 10% multiplier (1.1x) on captain's score</li>
                      <li>• All-Around (AA): Score ≥60 points marked as exceptional</li>
                      <li>• Scale: 0-100 points per player per gameweek</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="management">
            <div className="space-y-6">
              {/* System Health Dashboard */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold">System Health</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Server Status</p>
                    <p className="text-lg font-bold text-green-500">Online</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Active Users</p>
                    <p className="text-lg font-bold text-blue-500">{usersResponse?.total ?? 0}</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Trades</p>
                    <p className="text-lg font-bold text-purple-500">{adminStats?.transactions ?? 0}</p>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Marketplace Volume</p>
                    <p className="text-lg font-bold text-orange-500">{marketListings?.length ?? 0}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-cyan-500" />
                    <h3 className="text-lg font-semibold">Traffic & Online Users</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchTraffic()}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-cyan-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Req / 1 min</p>
                    <p className="text-lg font-bold text-cyan-500">{trafficData?.requestsLastMinute ?? 0}</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Req / 5 min</p>
                    <p className="text-lg font-bold text-blue-500">{trafficData?.requestsLast5Minutes ?? 0}</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Req / 60 min</p>
                    <p className="text-lg font-bold text-purple-500">{trafficData?.requestsLastHour ?? 0}</p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Online (10 min)</p>
                    <p className="text-lg font-bold text-green-500">{trafficData?.onlineUsersLast10Minutes ?? 0}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Top API Flows</p>
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {(trafficData?.topRoutes || []).map((route) => (
                        <div key={route.route} className="p-2 border rounded-md text-xs">
                          <p className="font-semibold truncate">{route.route}</p>
                          <p className="text-muted-foreground">
                            {route.count} req • {route.avgDurationMs}ms avg • {route.errorRate}% errors
                          </p>
                        </div>
                      ))}
                      {(!trafficData?.topRoutes || trafficData.topRoutes.length === 0) && (
                        <p className="text-xs text-muted-foreground">No traffic yet.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Recently Active Users</p>
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {(trafficData?.activeUsers || []).map((u) => (
                        <div key={u.userId} className="p-2 border rounded-md text-xs flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{u.userId}</span>
                          <span className="text-muted-foreground">{u.lastSeenSecondsAgo}s ago</span>
                        </div>
                      ))}
                      {(!trafficData?.activeUsers || trafficData.activeUsers.length === 0) && (
                        <p className="text-xs text-muted-foreground">No active users in last 10 minutes.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Requests Trend (Last 15 min)</p>
                  <div className="border rounded-md p-3 bg-muted/20">
                    {sparklineData.length > 1 ? (
                      <svg viewBox="0 0 100 32" className="w-full h-20" preserveAspectRatio="none">
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="text-cyan-400"
                          points={sparklinePoints}
                        />
                      </svg>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not enough traffic data yet.</p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={async () => {
                      const result = await refetchUsers();
                      toast({
                        title: "User Management",
                        description: `Loaded ${result.data?.total ?? 0} users`,
                      });
                    }}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    User Management
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={async () => {
                      await Promise.all([refetchAdminStats(), refetchMarketListings()]);
                      toast({
                        title: "Market Analytics",
                        description: "Marketplace and trade metrics refreshed",
                      });
                    }}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Market Analytics
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={async () => {
                      const result = await refetchPendingWithdrawals();
                      toast({
                        title: "Reports & Flags",
                        description: `${result.data?.length ?? 0} pending withdrawal reports`,
                      });
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reports & Flags
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={async () => {
                      const result = await refetchAdminLogs();
                      toast({
                        title: "System Logs",
                        description: `Loaded ${result.data?.total ?? 0} logs`,
                      });
                    }}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    System Logs
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => grantTodayCardsMutation.mutate()}
                    disabled={grantTodayCardsMutation.isPending}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Grant 5 Mixed-Rarity Today Cards
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => grantRaritySamplesMutation.mutate()}
                    disabled={grantRaritySamplesMutation.isPending}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Add 1 Card Per Rarity (Mine)
                  </Button>
                  <Button
                    variant="destructive"
                    className="justify-start"
                    onClick={() => {
                      const ok = window.confirm("This will remove ALL users and user-owned data. Continue?");
                      if (ok) resetUsersMutation.mutate();
                    }}
                    disabled={resetUsersMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reset All Users
                  </Button>
                </div>
              </Card>

              {/* Admin Notes */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold">Admin Notes</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Use this section to monitor site activity, review user reports, and manage administrative tasks.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Base prices enforced: Rare N$100, Unique N$250, Legendary N$500</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Trading system active with same-rarity restrictions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Card fusion available: 5 cards → 1 higher rarity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 mt-0.5" />
                    <span>Monitor high-value trades for suspicious activity</span>
                  </li>
                </ul>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingTournamentId ? "Edit Tournament" : "Create Tournament"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={tournamentForm.name}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Common Tournament - GW27"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Tier</label>
                <select
                  value={tournamentForm.tier}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, tier: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="common">common</option>
                  <option value="rare">rare</option>
                  <option value="unique">unique</option>
                  <option value="legendary">legendary</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select
                  value={tournamentForm.status}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="open">open</option>
                  <option value="upcoming">upcoming</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Entry Fee</label>
                <Input
                  type="number"
                  min="0"
                  value={tournamentForm.entryFee}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Game Week</label>
                <Input
                  type="number"
                  min="1"
                  value={tournamentForm.gameWeek}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, gameWeek: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Start</label>
                <Input
                  type="datetime-local"
                  value={tournamentForm.startDate}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">End</label>
                <Input
                  type="datetime-local"
                  value={tournamentForm.endDate}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Prize Card Rarity</label>
                <select
                  value={tournamentForm.prizeCardRarity}
                  onChange={(e) => setTournamentForm((prev) => ({ ...prev, prizeCardRarity: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="common">common</option>
                  <option value="rare">rare</option>
                  <option value="unique">unique</option>
                  <option value="epic">epic</option>
                  <option value="legendary">legendary</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button onClick={() => saveTournamentMutation.mutate()} disabled={saveTournamentMutation.isPending}>
                {saveTournamentMutation.isPending ? "Saving..." : "Save Tournament"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
