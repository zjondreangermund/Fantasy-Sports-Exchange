import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Eye, Lock, RefreshCw, Trash2, Trophy, Unlock, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "../../hooks/use-toast";
import { queryClient } from "../../lib/queryClient";

type CreatorTournament = {
  id: number;
  name: string;
  tier: string;
  status: string;
  entry_fee?: number;
  entryFee?: number;
  join_pin?: string | null;
  joinPin?: string | null;
  visibility?: string;
  max_entries?: number | null;
  maxEntries?: number | null;
  entry_count?: number;
  entryCount?: number;
  platform_fee_total?: number;
  platformFeeTotal?: number;
  prize_pool_total?: number;
  prizePoolTotal?: number;
};

type Entrant = {
  entryId: number;
  userId: string;
  teamName: string;
  email?: string | null;
  rank: number;
  totalScore: number;
  joinedAt?: string | null;
};

function n(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function money(value: unknown) {
  return `N$${n(value).toFixed(2)}`;
}

function inviteLink(pin: string | null | undefined) {
  if (!pin) return "";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/join/${pin}`;
}

export default function TournamentCreatorHub() {
  const { toast } = useToast();
  const [selectedTournament, setSelectedTournament] = useState<CreatorTournament | null>(null);

  const tournamentsQuery = useQuery<{ tournaments: CreatorTournament[] }>({
    queryKey: ["/api/user-tournaments/mine"],
    queryFn: async () => {
      const response = await fetch("/api/user-tournaments/mine", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch your tournaments");
      return response.json();
    },
  });

  const entrantsQuery = useQuery<{ entrants: Entrant[] }>({
    queryKey: ["/api/user-tournaments", selectedTournament?.id, "entrants"],
    enabled: Boolean(selectedTournament?.id),
    queryFn: async () => {
      const response = await fetch(`/api/user-tournaments/${selectedTournament!.id}/entrants`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch entrants");
      return response.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/user-tournaments/${id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Failed to update tournament");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-tournaments/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Tournament updated" });
    },
    onError: (error: any) => toast({ title: "Could not update", description: error.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/user-tournaments/${id}/duplicate`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Failed to duplicate tournament");
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-tournaments/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Tournament duplicated", description: data?.pin ? `New PIN: ${data.pin}` : undefined });
    },
    onError: (error: any) => toast({ title: "Could not duplicate", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/user-tournaments/${id}`, { method: "DELETE", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Failed to delete tournament");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-tournaments/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      toast({ title: "Tournament deleted" });
    },
    onError: (error: any) => toast({ title: "Could not delete", description: error.message, variant: "destructive" }),
  });

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    toast({ title: `${label} copied` });
  };

  if (tournamentsQuery.isLoading) {
    return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>;
  }

  if (tournamentsQuery.isError) {
    return <Card className="p-6 text-center"><p className="text-sm text-muted-foreground">Your tournament hub could not load.</p><Button className="mt-3" variant="outline" onClick={() => tournamentsQuery.refetch()}>Retry</Button></Card>;
  }

  const tournaments = Array.isArray(tournamentsQuery.data?.tournaments) ? tournamentsQuery.data!.tournaments : [];

  if (!tournaments.length) {
    return <Card className="p-8 text-center"><Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-bold">No tournaments created yet</h3><p className="mt-1 text-sm text-muted-foreground">Create a private PIN tournament from the Create tab.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {tournaments.map((tournament) => {
          const pin = tournament.join_pin || tournament.joinPin || "";
          const entries = n(tournament.entry_count ?? tournament.entryCount);
          const maxEntries = n(tournament.max_entries ?? tournament.maxEntries);
          const entryFee = n(tournament.entry_fee ?? tournament.entryFee);
          const platformFee = n(tournament.platform_fee_total ?? tournament.platformFeeTotal || entryFee * 0.2 * entries);
          const prizePool = n(tournament.prize_pool_total ?? tournament.prizePoolTotal || entryFee * 0.8 * entries);
          const link = inviteLink(pin);
          const isOpen = String(tournament.status || "") === "open";

          return (
            <Card key={tournament.id} className="space-y-4 border-primary/15 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{tournament.name}</h3>
                  <p className="text-xs text-muted-foreground">{entries}{maxEntries ? ` / ${maxEntries}` : ""} entrants • {tournament.visibility || "private"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="capitalize">{tournament.tier}</Badge>
                  <Badge variant="outline" className="capitalize">{tournament.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <Mini label="Entry Fee" value={money(entryFee)} />
                <Mini label="Entrants" value={`${entries}${maxEntries ? `/${maxEntries}` : ""}`} />
                <Mini label="Prize Pool" value={money(prizePool)} />
                <Mini label="Platform Fee" value={money(platformFee)} />
              </div>

              {pin && <div className="space-y-2 rounded-xl border bg-muted/20 p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">PIN</span><code className="font-bold tracking-[0.24em]">{pin}</code><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy("PIN", pin)}><Copy className="h-3.5 w-3.5" /></Button></div>
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Invite</span><code className="max-w-[180px] truncate">{link}</code><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy("Invite link", link)}><Copy className="h-3.5 w-3.5" /></Button></div>
              </div>}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Button size="sm" variant="outline" onClick={() => setSelectedTournament(tournament)}><Eye className="mr-1 h-3.5 w-3.5" />Entrants</Button>
                <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: tournament.id, status: isOpen ? "closed" : "open" })}>{isOpen ? <Lock className="mr-1 h-3.5 w-3.5" /> : <Unlock className="mr-1 h-3.5 w-3.5" />}{isOpen ? "Close" : "Open"}</Button>
                <Button size="sm" variant="outline" disabled={duplicateMutation.isPending} onClick={() => duplicateMutation.mutate(tournament.id)}><RefreshCw className="mr-1 h-3.5 w-3.5" />Duplicate</Button>
                <Button size="sm" variant="destructive" disabled={entries > 0 || deleteMutation.isPending} onClick={() => deleteMutation.mutate(tournament.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedTournament} onOpenChange={() => setSelectedTournament(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>{selectedTournament?.name} Entrants</DialogTitle></DialogHeader>
          {entrantsQuery.isLoading ? <Skeleton className="h-40 rounded-xl" /> : (
            <div className="space-y-2">
              {(entrantsQuery.data?.entrants || []).map((entrant) => (
                <div key={entrant.entryId} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-black">#{entrant.rank}</span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{entrant.teamName || "Manager"}</p>
                      <p className="truncate text-xs text-muted-foreground">{entrant.email || entrant.userId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{n(entrant.totalScore).toFixed(0)} pts</p>
                    <p className="text-xs text-muted-foreground">{entrant.joinedAt ? new Date(entrant.joinedAt).toLocaleDateString() : ""}</p>
                  </div>
                </div>
              ))}
              {!entrantsQuery.data?.entrants?.length && <p className="text-sm text-muted-foreground">No entrants yet.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-background/60 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
