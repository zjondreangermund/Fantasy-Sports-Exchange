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

export default function AdminPage() {
  const { toast } = useToast();
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [selectedCompForUpdate, setSelectedCompForUpdate] = useState<number | null>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);

  // Withdrawals
  const { data: allWithdrawals, isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals"],
  });

  const { data: pendingWithdrawals } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
  });

  // Competitions
  const { data: competitions, isLoading: compLoading, refetch: refetchComps } = useQuery<Competition[]>({
    queryKey: ["/api/competitions"],
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: async (data: { id: number; action: "approve" | "reject"; adminNotes?: string }) => {
      const res = await apiRequest("POST", "/api/admin/withdrawals/action", data);
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
      setAutoUpdateEnabled(!autoUpdateEnabled);
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage withdrawal requests and platform operations</p>
          </div>
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
              Competitions
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
                      onClick={() => updateScoresMutation.mutate()}
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
                  Automatically updates competition scores every 5 minutes from live FPL data. 
                  Scores include decisive actions (goals, assists), performance metrics, and captain bonuses.
                </p>
              </Card>

              {/* Competitions List */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Trophy className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold">Active Competitions</h3>
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

                        <div className="grid grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Entries</p>
                            <p className="font-semibold">-</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Prize Pool</p>
                            <p className="font-semibold">-</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Score</p>
                            <p className="font-semibold">-</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="font-semibold">GW {comp.gameWeek}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
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
                  <p className="text-sm text-muted-foreground text-center py-8">No competitions found</p>
                )}
              </Card>

              {/* Scoring Information */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold">Scoring System (Sorare-Style)</h3>
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
                    <p className="text-lg font-bold text-blue-500">-</p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Trades</p>
                    <p className="text-lg font-bold text-purple-500">-</p>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">Marketplace Volume</p>
                    <p className="text-lg font-bold text-orange-500">-</p>
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
                  <Button variant="outline" className="justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    User Management
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Market Analytics
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reports & Flags
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <Activity className="w-4 h-4 mr-2" />
                    System Logs
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
      </div>
    </div>
  );
}
