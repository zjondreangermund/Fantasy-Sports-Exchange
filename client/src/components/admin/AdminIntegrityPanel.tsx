import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, DatabaseZap, RefreshCw, ShieldCheck, Store, Trophy, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

type IntegritySummary = Record<string, number | string | boolean | null | undefined>;

type IntegrityResponse = {
  summary?: IntegritySummary;
  rows?: any[];
  issues?: any[];
  listings?: any[];
  cards?: any[];
  missingWallets?: any[];
};

const numberValue = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function IssueBadge({ count }: { count: number }) {
  if (count <= 0) {
    return <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">OK</Badge>;
  }
  return <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-200">{count} review</Badge>;
}

function SummaryMetric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{String(value ?? 0)}</p>
    </div>
  );
}

function IntegrityCard({
  title,
  description,
  icon,
  data,
  isLoading,
  issueCount,
  onRefresh,
  actionLabel,
  onAction,
  actionPending,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  data?: IntegrityResponse;
  isLoading: boolean;
  issueCount: number;
  onRefresh: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionPending?: boolean;
}) {
  const summaryEntries = Object.entries(data?.summary || {}).slice(0, 6);
  const sampleRows = (data?.rows || data?.issues || data?.listings || data?.cards || data?.missingWallets || []).slice(0, 4);

  return (
    <Card className="overflow-hidden border-white/10 bg-slate-950/70 p-0 shadow-2xl shadow-black/25">
      <div className="border-b border-white/10 bg-gradient-to-r from-white/[0.09] via-white/[0.04] to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-cyan-200">{icon}</div>
            <div>
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-1 text-sm text-slate-400">{description}</p>
            </div>
          </div>
          <IssueBadge count={issueCount} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : summaryEntries.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {summaryEntries.map(([key, value]) => (
              <SummaryMetric key={key} label={key.replace(/([A-Z])/g, " $1")} value={value} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">No summary returned yet.</p>
        )}

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Recent findings</p>
            <span className="text-xs text-slate-500">{sampleRows.length} shown</span>
          </div>
          {sampleRows.length === 0 ? (
            <p className="text-sm text-emerald-300">No open findings in the sampled response.</p>
          ) : (
            <div className="space-y-2">
              {sampleRows.map((row: any, index: number) => (
                <div key={row.id || row.userId || row.cardId || row.listingId || index} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{row.user?.email || row.userId || row.cardId || row.listingId || row.id || `Finding ${index + 1}`}</span>
                    <Badge variant="outline" className="border-white/15 text-[0.65rem] text-slate-300">{row.status || row.reason || row.flags?.[0] || "review"}</Badge>
                  </div>
                  <p className="mt-1 truncate text-slate-500">{JSON.stringify(row).slice(0, 180)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          {actionLabel && onAction ? (
            <Button size="sm" onClick={onAction} disabled={actionPending}>
              <DatabaseZap className="mr-2 h-4 w-4" />{actionPending ? "Running..." : actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function AdminIntegrityPanel() {
  const { toast } = useToast();
  const [competitionIdInput, setCompetitionIdInput] = useState("");

  const walletIntegrity = useQuery<IntegrityResponse>({ queryKey: ["/api/admin/wallet/integrity"] });
  const marketplaceIntegrity = useQuery<IntegrityResponse>({ queryKey: ["/api/admin/marketplace/integrity"] });
  const cardIntegrity = useQuery<IntegrityResponse>({ queryKey: ["/api/admin/cards/integrity"] });

  const rewardIntegrityMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const normalizedId = Number(competitionId);
      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        throw new Error("Enter a valid competition ID");
      }
      const response = await apiRequest("GET", `/api/admin/competitions/${normalizedId}/reward-integrity`);
      return response.json();
    },
    onError: (error: any) => {
      toast({ title: "Reward check failed", description: error?.message || "Unable to check rewards", variant: "destructive" });
    },
  });

  const rewardRepairMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const normalizedId = Number(competitionId);
      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        throw new Error("Enter a valid competition ID");
      }
      const response = await apiRequest("POST", `/api/admin/competitions/${normalizedId}/repair-rewards`, {});
      return response.json();
    },
    onSuccess: async (_data, competitionId) => {
      toast({ title: "Reward repair completed", description: `Competition ${competitionId}` });
      rewardIntegrityMutation.mutate(competitionId);
    },
    onError: (error: any) => {
      toast({ title: "Reward repair failed", description: error?.message || "Unable to repair rewards", variant: "destructive" });
    },
  });

  const repairMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      const response = await apiRequest("POST", endpoint, {});
      return response.json();
    },
    onSuccess: async (_data, endpoint) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/wallet/integrity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/integrity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/cards/integrity"] }),
      ]);
      toast({ title: "Repair completed", description: endpoint.replace("/api/admin/", "") });
    },
    onError: (error: any) => {
      toast({ title: "Repair failed", description: error?.message || "Unable to run repair", variant: "destructive" });
    },
  });

  const walletIssues = numberValue(walletIntegrity.data?.summary?.reviewWallets) + numberValue(walletIntegrity.data?.summary?.missingWallets);
  const marketIssues = numberValue(marketplaceIntegrity.data?.summary?.staleListings) + numberValue(marketplaceIntegrity.data?.summary?.ownerMismatches) + numberValue(marketplaceIntegrity.data?.summary?.invalidPrices);
  const cardIssues = numberValue(cardIntegrity.data?.summary?.duplicateSerials) + numberValue(cardIntegrity.data?.summary?.missingSerials) + numberValue(cardIntegrity.data?.summary?.ownerlessCards);
  const totalIssues = walletIssues + marketIssues + cardIssues;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-cyan-300/15 bg-gradient-to-br from-slate-950 via-slate-950/90 to-cyan-950/30 p-5 shadow-2xl shadow-black/25">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-200">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200/70">Production integrity console</p>
              <h2 className="mt-2 text-2xl font-black text-white">Wallet, marketplace and card repair center</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Run live integrity checks before and after deployments. These panels call the backend repair endpoints added during the hardening phase.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Open issues</p>
            <p className="text-3xl font-black text-white">{totalIssues}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <IntegrityCard
          title="Wallet ledger"
          description="Find negative balances, ledger deltas and missing wallet rows."
          icon={<Wallet className="h-5 w-5" />}
          data={walletIntegrity.data}
          isLoading={walletIntegrity.isLoading}
          issueCount={walletIssues}
          onRefresh={() => walletIntegrity.refetch()}
          actionLabel="Repair missing wallets"
          onAction={() => repairMutation.mutate("/api/admin/wallet/repair-missing")}
          actionPending={repairMutation.isPending}
        />
        <IntegrityCard
          title="Marketplace listings"
          description="Find stale listings, invalid prices and ownership mismatches."
          icon={<Store className="h-5 w-5" />}
          data={marketplaceIntegrity.data}
          isLoading={marketplaceIntegrity.isLoading}
          issueCount={marketIssues}
          onRefresh={() => marketplaceIntegrity.refetch()}
          actionLabel="Repair listings"
          onAction={() => repairMutation.mutate("/api/admin/marketplace/repair-listings")}
          actionPending={repairMutation.isPending}
        />
        <IntegrityCard
          title="Card serials"
          description="Find duplicate serials, missing serials and ownership gaps."
          icon={<CreditCard className="h-5 w-5" />}
          data={cardIntegrity.data}
          isLoading={cardIntegrity.isLoading}
          issueCount={cardIssues}
          onRefresh={() => cardIntegrity.refetch()}
          actionLabel="Repair serials"
          onAction={() => repairMutation.mutate("/api/admin/cards/repair-serials")}
          actionPending={repairMutation.isPending}
        />
      </div>

      <Card className="overflow-hidden border-violet-300/15 bg-gradient-to-br from-slate-950 via-slate-950/95 to-violet-950/30 p-0 shadow-2xl shadow-black/25">
        <div className="border-b border-white/10 bg-gradient-to-r from-violet-300/10 via-white/[0.04] to-transparent p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-3 text-violet-200">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Tournament reward integrity</h3>
                <p className="mt-1 text-sm text-slate-400">Check and repair prize-card delivery for a settled competition.</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Input
                value={competitionIdInput}
                onChange={(event) => setCompetitionIdInput(event.target.value)}
                placeholder="Competition ID"
                className="bg-black/30 lg:w-44"
              />
              <Button variant="outline" onClick={() => rewardIntegrityMutation.mutate(competitionIdInput)} disabled={rewardIntegrityMutation.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" />{rewardIntegrityMutation.isPending ? "Checking..." : "Check"}
              </Button>
              <Button onClick={() => rewardRepairMutation.mutate(competitionIdInput)} disabled={rewardRepairMutation.isPending}>
                <DatabaseZap className="mr-2 h-4 w-4" />{rewardRepairMutation.isPending ? "Repairing..." : "Repair"}
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4">
          {rewardIntegrityMutation.data ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr]">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries((rewardIntegrityMutation.data as IntegrityResponse).summary || {}).slice(0, 6).map(([key, value]) => (
                  <SummaryMetric key={key} label={key.replace(/([A-Z])/g, " $1")} value={value} />
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reward findings</p>
                {((rewardIntegrityMutation.data as IntegrityResponse).rows || (rewardIntegrityMutation.data as IntegrityResponse).issues || []).slice(0, 5).length === 0 ? (
                  <p className="text-sm text-emerald-300">No reward findings returned.</p>
                ) : (
                  <div className="space-y-2">
                    {(((rewardIntegrityMutation.data as IntegrityResponse).rows || (rewardIntegrityMutation.data as IntegrityResponse).issues || []) as any[]).slice(0, 5).map((row, index) => (
                      <div key={row.entryId || row.userId || index} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-slate-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">Entry {row.entryId || index + 1}</span>
                          <Badge variant="outline" className="border-white/15 text-[0.65rem] text-slate-300">{row.status || row.reason || "review"}</Badge>
                        </div>
                        <p className="mt-1 truncate text-slate-500">{JSON.stringify(row).slice(0, 180)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">Enter a competition ID to verify winner prize-card delivery and ownership.</p>
          )}
        </div>
      </Card>

      <Card className="border-amber-300/15 bg-amber-950/10 p-4">
        <div className="flex gap-3 text-sm text-amber-100/80">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p>
            Repairs are intentionally targeted: they do not overwrite balances blindly. Use refresh first, review findings, then run the relevant repair action.
          </p>
        </div>
      </Card>
    </div>
  );
}
