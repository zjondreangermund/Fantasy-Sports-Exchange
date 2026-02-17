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
// Fixed: @shared -> ../../../shared
import { type WithdrawalRequest } from "../../../shared/schema";
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
} from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";

export default function AdminPage() {
  const { toast } = useToast();
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  const { data: allWithdrawals, isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals"],
  });

  const { data: pendingWithdrawals } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
  });

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

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "processing": return <Badge variant="outline" className="text-blue-500 border-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "completed": return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "rejected": return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
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
      </div>
    </div>
  );
}
