import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, ShoppingCart, DollarSign, Plus, Clock, Lock, Send, CreditCard, Smartphone, Building2, CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { isUnauthorizedError } from "../lib/auth-utils";
import { DEPOSIT_FEE_FREE_THRESHOLD, MIN_WITHDRAWAL_AMOUNT, SMALL_DEPOSIT_FEE_RATE, WITHDRAWAL_FEE_RATE } from "../../../shared/card-economy";

const money = (value: unknown) => `N$${Number(value || 0).toFixed(2)}`;

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

  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({ queryKey: ["/api/wallet"], queryFn: async () => { const res = await fetch("/api/wallet", { credentials: "include" }); if (!res.ok) throw new Error("Failed to fetch wallet"); return res.json(); } });
  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"], queryFn: async () => { const res = await fetch("/api/transactions", { credentials: "include" }); if (!res.ok) throw new Error("Failed to fetch transactions"); return res.json(); } });
  const { data: withdrawals } = useQuery<WithdrawalRequest[]>({ queryKey: ["/api/wallet/withdrawals"], queryFn: async () => { const res = await fetch("/api/wallet/withdrawals", { credentials: "include" }); if (!res.ok) throw new Error("Failed to fetch withdrawals"); return res.json(); } });

  const depositMutation = useMutation({
    mutationFn: async (data: { amount: number; paymentMethod: string; externalTransactionId: string }) => (await apiRequest("POST", "/api/wallet/deposit", data)).json(),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setDepositAmount("");
      setDepositTxnId("");
      toast({ title: "Deposit submitted for verification", description: result?.message || "Your payment reference is pending review. Your available balance will update only after approval." });
    },
    onError: handleAuthError,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/wallet/withdraw", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/withdrawals"] });
      setWithdrawAmount(""); setBankName(""); setAccountHolder(""); setAccountNumber(""); setIban(""); setSwiftCode(""); setEwalletProvider(""); setEwalletId("");
      toast({ title: "Withdrawal submitted", description: "The gross amount is now locked while the request is reviewed. You will receive the displayed net amount after approval and payout." });
    },
    onError: handleAuthError,
  });

  function handleAuthError(error: any) {
    if (isUnauthorizedError(error)) {
      toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
      return;
    }
    toast({ title: "Error", description: error.message, variant: "destructive" });
  }

  const presetAmounts = [10, 25, 50, 100];
  const depositValue = Number.parseFloat(depositAmount || "0");
  const depositFeeRate = depositValue > 0 && depositValue < DEPOSIT_FEE_FREE_THRESHOLD ? SMALL_DEPOSIT_FEE_RATE : 0;
  const depositFee = Math.max(0, depositValue * depositFeeRate);
  const depositNet = Math.max(0, depositValue - depositFee);
  const withdrawValue = Number.parseFloat(withdrawAmount || "0");
  const withdrawalFee = Math.max(0, withdrawValue * WITHDRAWAL_FEE_RATE);
  const withdrawNet = Math.max(0, withdrawValue - withdrawalFee);

  const handleDeposit = () => {
    const amount = Number.parseFloat(depositAmount);
    const reference = depositTxnId.trim();
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!reference) return toast({ title: "Payment reference required", description: "Enter the unique reference or transaction ID from your payment before submitting.", variant: "destructive" });
    depositMutation.mutate({ amount, paymentMethod: depositMethod, externalTransactionId: reference });
  };
  const handleWithdraw = () => {
    const amount = Number.parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) return toast({ title: "Minimum withdrawal", description: `Minimum withdrawal is ${money(MIN_WITHDRAWAL_AMOUNT)}`, variant: "destructive" });
    withdrawMutation.mutate({ amount, paymentMethod: withdrawMethod, ...(withdrawMethod === "ewallet" ? { ewalletProvider, ewalletId } : { bankName, accountHolder, accountNumber, iban, swiftCode }) });
  };

  const txTypeConfig: Record<string, { icon: typeof ArrowDownCircle; color: string; label: string }> = {
    deposit: { icon: ArrowDownCircle, color: "text-green-500", label: "Deposit" }, withdrawal: { icon: ArrowUpCircle, color: "text-orange-500", label: "Withdrawal" }, purchase: { icon: ShoppingCart, color: "text-blue-500", label: "Purchase" }, sale: { icon: DollarSign, color: "text-green-500", label: "Sale" }, marketplace_buy: { icon: ShoppingCart, color: "text-blue-500", label: "Marketplace Buy" }, marketplace_sale: { icon: DollarSign, color: "text-green-500", label: "Marketplace Sale" }, tournament_entry: { icon: CreditCard, color: "text-purple-500", label: "Tournament Entry" }, tournament_payout: { icon: CheckCircle2, color: "text-yellow-500", label: "Tournament Payout" }, admin_adjustment: { icon: Plus, color: "text-sky-500", label: "Admin Adjustment" }, bonus_credit: { icon: CheckCircle2, color: "text-emerald-500", label: "Bonus Credit" }, entry_fee: { icon: CreditCard, color: "text-purple-500", label: "Entry Fee" }, prize: { icon: CheckCircle2, color: "text-yellow-500", label: "Prize" }, swap_fee: { icon: ArrowUpCircle, color: "text-red-500", label: "Swap Fee" },
  };
  const statusBadge = (status: string) => status === "pending" ? <Badge variant="outline" className="border-yellow-500 text-yellow-500"><Clock className="mr-1 h-3 w-3" />Pending</Badge> : status === "approved" ? <Badge variant="outline" className="border-blue-500 text-blue-500"><Loader2 className="mr-1 h-3 w-3" />Approved</Badge> : status === "paid" ? <Badge variant="outline" className="border-green-500 text-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />Paid</Badge> : status === "rejected" ? <Badge variant="outline" className="border-red-500 text-red-500"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge> : <Badge variant="outline">{status}</Badge>;
  const paymentMethodLabel = (method: string) => ({ eft: "EFT", ewallet: "eWallet", bank_transfer: "Bank Transfer", mobile_money: "Mobile Money" } as Record<string, string>)[method] || method;
  const isBankMethod = withdrawMethod !== "ewallet";

  return <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-3xl"><h1 className="mb-6 text-2xl font-bold text-foreground">Wallet</h1>
    <Card className="mb-6 p-6"><div className="mb-2 flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-md bg-green-500/10"><WalletIcon className="h-7 w-7 text-green-500" /></div><div className="flex-1"><p className="text-sm text-muted-foreground">Available Balance</p>{walletLoading ? <Skeleton className="h-8 w-32" /> : <p className="text-3xl font-bold text-foreground" data-testid="text-wallet-balance">{money(wallet?.balance)}</p>}</div>{wallet && Number((wallet as any).lockedBalance || 0) > 0 ? <div className="text-right"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Locked balance</p><p className="text-lg font-semibold text-orange-500">{money((wallet as any).lockedBalance)}</p></div> : null}</div><p className="text-xs text-muted-foreground">Available balance can be spent. Locked balance is held for pending withdrawals or other protected transactions and cannot be spent twice.</p></Card>

    <div className="mb-6 grid gap-3 sm:grid-cols-2"><FlowCard title="How deposits work" tone="green" steps={["Pay through the selected method and keep the unique payment reference.", "Submit the amount and reference. The deposit remains pending while Fantasy Arena verifies it.", `Under N$${DEPOSIT_FEE_FREE_THRESHOLD}: ${(SMALL_DEPOSIT_FEE_RATE * 100).toFixed(0)}% fee. N$${DEPOSIT_FEE_FREE_THRESHOLD} or more: no deposit fee.`, "After approval, the net amount moves into available balance. Rejected or unverified payments are not credited."]} /><FlowCard title="How withdrawals work" tone="orange" steps={[`Minimum ${money(MIN_WITHDRAWAL_AMOUNT)}. Fee: ${(WITHDRAWAL_FEE_RATE * 100).toFixed(1)}%.`, "On submission, the full gross amount moves from available balance to locked balance.", "Fantasy Arena reviews the request and may ask for identity or ownership verification.", "Paid: the displayed net amount is sent and the hold is settled. Rejected: the full gross hold is returned. Failed payouts remain held for retry or refund."]} /></div>

    <Tabs defaultValue="deposit" className="mb-6"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="deposit">Deposit</TabsTrigger><TabsTrigger value="withdraw">Withdraw</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
      <TabsContent value="deposit"><Card className="p-6"><h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground"><ArrowDownCircle className="h-4 w-4 text-green-500" />Submit Deposit for Verification</h3><div className="space-y-4"><div><Label className="mb-1 block text-xs text-muted-foreground">Payment Method</Label><Select value={depositMethod} onValueChange={setDepositMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="eft"><div className="flex items-center gap-2"><Building2 className="h-4 w-4" />EFT</div></SelectItem><SelectItem value="ewallet"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4" />eWallet</div></SelectItem><SelectItem value="bank_transfer"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Bank Transfer</div></SelectItem><SelectItem value="mobile_money"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Mobile Money</div></SelectItem></SelectContent></Select></div><div className="flex flex-wrap gap-2">{presetAmounts.map((amount) => <Button key={amount} variant="outline" size="sm" onClick={() => setDepositAmount(String(amount))} className={depositAmount === String(amount) ? "border-primary bg-primary/10" : ""}>N${amount}</Button>)}</div><div className="relative"><DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="number" placeholder="Deposit amount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} min="1" step="0.01" className="pl-9" /></div><div><Label className="mb-1 block text-xs text-muted-foreground">Unique payment reference / transaction ID</Label><Input placeholder="Required for verification" value={depositTxnId} onChange={(e) => setDepositTxnId(e.target.value)} /></div>{depositValue > 0 ? <Breakdown grossLabel="Gross amount" gross={depositValue} feeRate={depositFeeRate} fee={depositFee} netLabel="Net credited after approval" net={depositNet} /> : null}<Button onClick={handleDeposit} disabled={!depositAmount || depositValue <= 0 || !depositTxnId.trim() || depositMutation.isPending} className="w-full"><Plus className="mr-1 h-4 w-4" />{depositMutation.isPending ? "Submitting..." : "Submit for verification"}</Button></div></Card></TabsContent>

      <TabsContent value="withdraw"><Card className="p-6"><h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground"><Send className="h-4 w-4 text-orange-500" />Request Withdrawal</h3><div className="space-y-4"><div><Label className="mb-1 block text-xs text-muted-foreground">Withdrawal Method</Label><Select value={withdrawMethod} onValueChange={setWithdrawMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="eft">EFT</SelectItem><SelectItem value="ewallet">eWallet</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="mobile_money">Mobile Money</SelectItem></SelectContent></Select></div><div><Label className="mb-1 block text-xs text-muted-foreground">Gross amount to hold</Label><div className="relative"><DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="number" placeholder="Withdrawal amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} min={MIN_WITHDRAWAL_AMOUNT} step="0.01" className="pl-9" /></div></div>{!isBankMethod ? <div className="space-y-3"><div><Label className="mb-1 block text-xs text-muted-foreground">eWallet Provider</Label><Input placeholder="Provider" value={ewalletProvider} onChange={(e) => setEwalletProvider(e.target.value)} /></div><div><Label className="mb-1 block text-xs text-muted-foreground">eWallet ID / Email</Label><Input placeholder="Account ID" value={ewalletId} onChange={(e) => setEwalletId(e.target.value)} /></div></div> : <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label className="mb-1 block text-xs text-muted-foreground">Bank Name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div><div><Label className="mb-1 block text-xs text-muted-foreground">Account Holder</Label><Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></div></div><div><Label className="mb-1 block text-xs text-muted-foreground">Account Number</Label><Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><Label className="mb-1 block text-xs text-muted-foreground">IBAN</Label><Input value={iban} onChange={(e) => setIban(e.target.value)} /></div><div><Label className="mb-1 block text-xs text-muted-foreground">SWIFT / BIC</Label><Input value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} /></div></div></div>}{withdrawValue > 0 ? <><Breakdown grossLabel="Gross withdrawal held" gross={withdrawValue} feeRate={WITHDRAWAL_FEE_RATE} fee={withdrawalFee} netLabel="Net payout after approval" net={withdrawNet} />{withdrawValue < MIN_WITHDRAWAL_AMOUNT ? <p className="text-xs text-red-500">Minimum withdrawal is {money(MIN_WITHDRAWAL_AMOUNT)}.</p> : null}</> : null}<Button onClick={handleWithdraw} disabled={!withdrawAmount || withdrawValue < MIN_WITHDRAWAL_AMOUNT || withdrawMutation.isPending} className="w-full" variant="outline"><Send className="mr-1 h-4 w-4" />{withdrawMutation.isPending ? "Submitting..." : "Request Withdrawal"}</Button>{withdrawals?.length ? <div className="mt-6"><h4 className="mb-3 text-sm font-medium text-foreground">Your Withdrawal Requests</h4><div className="space-y-2">{withdrawals.map((wr) => <Card key={wr.id} className="p-3"><div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium">{money(wr.amount)}</span>{statusBadge(wr.status)}</div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{paymentMethodLabel(wr.paymentMethod)} • Net {money(wr.netAmount)}</span><span>{wr.createdAt ? new Date(wr.createdAt).toLocaleDateString() : ""}</span></div>{wr.adminNotes && wr.status === "rejected" ? <p className="mt-1 text-xs text-red-500">Reason: {wr.adminNotes}</p> : null}</Card>)}</div></div> : null}</div></Card></TabsContent>

      <TabsContent value="history"><div><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><Clock className="h-5 w-5 text-muted-foreground" />Transaction History</h2>{txLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}</div> : transactions?.length ? <div className="space-y-2">{transactions.map((tx) => { const config = txTypeConfig[tx.type] || txTypeConfig.deposit; const TxIcon = config.icon; const isPositive = ["deposit", "sale", "prize", "marketplace_sale", "tournament_payout", "bonus_credit", "admin_adjustment"].includes(tx.type); return <Card key={tx.id} className="flex items-center gap-3 p-3"><div className={`flex h-9 w-9 items-center justify-center rounded-md bg-current/10 ${config.color}`}><TxIcon className={`h-5 w-5 ${config.color}`} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{tx.description || config.label}</p><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}</span>{tx.paymentMethod ? <Badge variant="outline" className="px-1 py-0 text-[10px]">{paymentMethodLabel(tx.paymentMethod)}</Badge> : null}{tx.externalTransactionId ? <span className="max-w-[120px] truncate">Ref: {tx.externalTransactionId}</span> : null}</div></div><span className={`text-sm font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>{isPositive ? "+" : "-"}{money(Math.abs(tx.amount))}</span></Card>; })}</div> : <Card className="p-8 text-center"><p className="text-muted-foreground">No transactions yet.</p></Card>}</div></TabsContent>
    </Tabs>
  </div></div>;
}

function FlowCard({ title, steps, tone }: { title: string; steps: string[]; tone: "green" | "orange" }) {
  const classes = tone === "green" ? "border-green-500/20 bg-green-500/5 text-green-500" : "border-orange-500/20 bg-orange-500/5 text-orange-500";
  return <Card className={`border p-4 ${classes}`}><div className="mb-3 flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4" />{title}</div><ol className="space-y-2 text-xs text-foreground/70">{steps.map((step, index) => <li key={step} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/20 font-black">{index + 1}</span><span>{step}</span></li>)}</ol></Card>;
}
function Breakdown({ grossLabel, gross, feeRate, fee, netLabel, net }: { grossLabel: string; gross: number; feeRate: number; fee: number; netLabel: string; net: number }) { return <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">{grossLabel}:</span><span>{money(gross)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Fee ({(feeRate * 100).toFixed(1)}%):</span><span className="text-red-500">-{money(fee)}</span></div><div className="flex justify-between border-t border-border pt-1 font-semibold"><span>{netLabel}:</span><span className="text-green-500">{money(net)}</span></div></div>; }
