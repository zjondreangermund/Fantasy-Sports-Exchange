import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { type Wallet, type Transaction, type WithdrawalRequest } from "../../../shared/schema";
import {
  Wallet as WalletIcon,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  DollarSign,
  Plus,
  Clock,
  Lock,
  Send,
  CreditCard,
  Smartphone,
  Building2,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";

export default function WalletPage() {
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("eft");
  const [depositTxnId, setDepositTxnId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("eft");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [ewalletProvider, setEwalletProvider] = useState("");
  const [ewalletId, setEwalletId] = useState("");

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["/api/wallet"],
  });

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: withdrawals, isLoading: wdLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/wallet/withdrawals"],
  });

  const depositMutation = useMutation({
    mutationFn: async (data: { amount: number; paymentMethod: string; externalTransactionId?: string }) => {
      const res = await apiRequest("POST", "/api/wallet/deposit", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setDepositAmount("");
      setDepositTxnId("");
      toast({ title: "Deposit successful!" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/withdrawals"] });
      setWithdrawAmount("");
      setBankName(""); setAccountHolder(""); setAccountNumber(""); setIban(""); setSwiftCode("");
      setEwalletProvider(""); setEwalletId("");
      toast({ title: "Withdrawal request submitted!", description: "Your request is pending admin review." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const presetAmounts = [10, 25, 50, 100];

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;
    depositMutation.mutate({
      amount,
      paymentMethod: depositMethod,
      externalTransactionId: depositTxnId || undefined,
    });
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;
    withdrawMutation.mutate({
      amount,
      paymentMethod: withdrawMethod,
      ...(withdrawMethod === "ewallet" ? { ewalletProvider, ewalletId } : {}),
      ...(withdrawMethod !== "ewallet" ? { bankName, accountHolder, accountNumber, iban, swiftCode } : {}),
    });
  };

  const txTypeConfig: Record<string, { icon: typeof ArrowDownCircle; color: string; label: string }> = {
    deposit: { icon: ArrowDownCircle, color: "text-green-500", label: "Deposit" },
    withdrawal: { icon: ArrowUpCircle, color: "text-orange-500", label: "Withdrawal" },
    purchase: { icon: ShoppingCart, color: "text-blue-500", label: "Purchase" },
    sale: { icon: DollarSign, color: "text-green-500", label: "Sale" },
    entry_fee: { icon: CreditCard, color: "text-purple-500", label: "Entry Fee" },
    prize: { icon: CheckCircle2, color: "text-yellow-500", label: "Prize" },
    swap_fee: { icon: ArrowUpCircle, color: "text-red-500", label: "Swap Fee" },
  };

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

  const isBankMethod = withdrawMethod !== "ewallet";

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Wallet</h1>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-md bg-green-500/10 flex items-center justify-center">
              <WalletIcon className="w-7 h-7 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              {walletLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold text-foreground" data-testid="text-wallet-balance">
                  N${wallet?.balance?.toFixed(2) || "0.00"}
                </p>
              )}
            </div>
            {wallet && (wallet as any).lockedBalance > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked (Escrow)
                </p>
                <p className="text-lg font-semibold text-orange-500">
                  N${((wallet as any).lockedBalance || 0).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-0">
            8% platform fee applies to all deposits & withdrawals
          </p>
        </Card>

        <Tabs defaultValue="deposit" className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <Card className="p-6">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-green-500" />
                Deposit Funds
              </h3>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Payment Method</Label>
                  <Select value={depositMethod} onValueChange={setDepositMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eft"><div className="flex items-center gap-2"><Building2 className="w-4 h-4" /> EFT (Electronic Fund Transfer)</div></SelectItem>
                      <SelectItem value="ewallet"><div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> eWallet</div></SelectItem>
                      <SelectItem value="bank_transfer"><div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Bank Transfer</div></SelectItem>
                      <SelectItem value="mobile_money"><div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Mobile Money</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  {presetAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setDepositAmount(amount.toString())}
                      className={depositAmount === amount.toString() ? "border-primary bg-primary/10" : ""}
                      data-testid={`button-preset-${amount}`}
                    >
                      N${amount}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Custom amount..."
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="1"
                      step="0.01"
                      className="pl-9"
                      data-testid="input-deposit-amount"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Transaction ID (optional)</Label>
                  <Input
                    placeholder="External reference / transaction ID..."
                    value={depositTxnId}
                    onChange={(e) => setDepositTxnId(e.target.value)}
                  />
                </div>

                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span>N${parseFloat(depositAmount).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fee (8%):</span><span className="text-red-500">-N${(parseFloat(depositAmount) * 0.08).toFixed(2)}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border pt-1"><span>You receive:</span><span className="text-green-500">N${(parseFloat(depositAmount) * 0.92).toFixed(2)}</span></div>
                  </div>
                )}

                <Button
                  onClick={handleDeposit}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0 || depositMutation.isPending}
                  className="w-full"
                  data-testid="button-deposit"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {depositMutation.isPending ? "Processing..." : "Deposit"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="withdraw">
            <Card className="p-6">
              <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-orange-500" />
                Request Withdrawal
              </h3>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Withdrawal Method</Label>
                  <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eft">EFT (Electronic Fund Transfer)</SelectItem>
                      <SelectItem value="ewallet">eWallet</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Withdrawal amount..."
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="1"
                      step="0.01"
                      className="pl-9"
                    />
                  </div>
                </div>

                {withdrawMethod === "ewallet" ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">eWallet Provider</Label>
                      <Input placeholder="e.g. PayPal, Skrill, Neteller..." value={ewalletProvider} onChange={(e) => setEwalletProvider(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">eWallet ID / Email</Label>
                      <Input placeholder="Your eWallet account ID..." value={ewalletId} onChange={(e) => setEwalletId(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Bank Name</Label>
                        <Input placeholder="Bank name..." value={bankName} onChange={(e) => setBankName(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Account Holder</Label>
                        <Input placeholder="Full name..." value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Account Number</Label>
                      <Input placeholder="Account number..." value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">IBAN</Label>
                        <Input placeholder="IBAN..." value={iban} onChange={(e) => setIban(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">SWIFT / BIC Code</Label>
                        <Input placeholder="SWIFT code..." value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                  <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal amount:</span><span>N${parseFloat(withdrawAmount).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fee (8%):</span><span className="text-red-500">-N${(parseFloat(withdrawAmount) * 0.08).toFixed(2)}</span></div>
                    <div className="flex justify-between font-semibold border-t border-border pt-1"><span>You will receive:</span><span className="text-green-500">N${(parseFloat(withdrawAmount) * 0.92).toFixed(2)}</span></div>
                  </div>
                )}

                <Button
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || withdrawMutation.isPending}
                  className="w-full"
                  variant="outline"
                >
                  <Send className="w-4 h-4 mr-1" />
                  {withdrawMutation.isPending ? "Submitting..." : "Request Withdrawal"}
                </Button>

                {withdrawals && withdrawals.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-foreground mb-3">Your Withdrawal Requests</h4>
                    <div className="space-y-2">
                      {withdrawals.map((wr) => (
                        <Card key={wr.id} className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">N${wr.amount.toFixed(2)}</span>
                            {statusBadge(wr.status)}
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{paymentMethodLabel(wr.paymentMethod)} - Net: N${wr.netAmount.toFixed(2)}</span>
                            <span>{wr.createdAt ? new Date(wr.createdAt).toLocaleDateString() : ""}</span>
                          </div>
                          {wr.adminNotes && wr.status === "rejected" && (
                            <p className="text-xs text-red-500 mt-1">Reason: {wr.adminNotes}</p>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Transaction History
              </h2>

              {txLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                  ))}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const config = txTypeConfig[tx.type] || txTypeConfig.deposit;
                    const TxIcon = config.icon;
                    const isPositive = tx.type === "deposit" || tx.type === "sale" || tx.type === "prize";
                    return (
                      <Card key={tx.id} className="p-3 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${config.color} bg-current/10`}>
                          <TxIcon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {tx.description || config.label}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}</span>
                            {tx.paymentMethod && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">{paymentMethodLabel(tx.paymentMethod)}</Badge>
                            )}
                            {tx.externalTransactionId && (
                              <span className="truncate max-w-[120px]">Ref: {tx.externalTransactionId}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                          {isPositive ? "+" : "-"}N${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No transactions yet.</p>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
