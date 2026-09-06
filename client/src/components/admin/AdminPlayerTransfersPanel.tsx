import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";

type OwnerCard = {
  cardId: number;
  rarity: string;
  claimId?: number | null;
  replacementCardId?: number | null;
  claimedAt?: string | null;
};

type TransferOwner = {
  userId: string;
  email?: string | null;
  name?: string | null;
  managerTeamName?: string | null;
  cards: OwnerCard[];
};

type TransferEvent = {
  id: number;
  playerId: number;
  fplId?: number | null;
  playerName: string;
  fromTeam?: string | null;
  toTeam?: string | null;
  leftPremierLeague: boolean;
  suppressed?: boolean;
  suppressionReason?: string | null;
  suspectedAliasOnly?: boolean;
  detectedAt?: string | null;
  currentLeague?: string | null;
  currentStatus?: string | null;
  affectedUsers?: number;
  affectedCards?: number;
  openClaims?: number;
  claimedClaims?: number;
  owners?: TransferOwner[];
};

type TransferReport = {
  summary?: {
    events?: number;
    realTransfers?: number;
    departures?: number;
    aliasOnlySuppressed?: number;
    affectedUsers?: number;
    affectedCards?: number;
    openClaims?: number;
    claimedClaims?: number;
  };
  events?: TransferEvent[];
};

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown";
}

export default function AdminPlayerTransfersPanel() {
  const [filter, setFilter] = useState<"all" | "departed" | "transfer" | "alias">("all");
  const [search, setSearch] = useState("");
  const { data, isFetching, refetch } = useQuery<TransferReport>({
    queryKey: ["/api/admin/player-transfers?limit=150"],
  });

  const summary = data?.summary || {};
  const events = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (Array.isArray(data?.events) ? data!.events! : []).filter((event) => {
      if (filter === "departed" && !event.leftPremierLeague) return false;
      if (filter === "transfer" && (event.leftPremierLeague || event.suspectedAliasOnly || event.suppressed)) return false;
      if (filter === "alias" && !(event.suspectedAliasOnly || event.suppressed)) return false;
      if (!query) return true;
      const ownerText = (event.owners || []).map((owner) => `${owner.managerTeamName || ""} ${owner.name || ""} ${owner.email || ""} ${owner.userId}`).join(" ");
      return `${event.playerName} ${event.fromTeam || ""} ${event.toTeam || ""} ${ownerText}`.toLowerCase().includes(query);
    });
  }, [data?.events, filter, search]);

  return (
    <Card className="border-white/10 bg-white/[0.06] p-4 text-white backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
            <h3 className="text-lg font-semibold">Player Transfers & EPL Departures</h3>
          </div>
          <p className="mt-1 text-sm text-white/50">See exactly which managers own affected cards, which replacements are still pending, and which club-name changes were suppressed as aliases.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-white/15 bg-black/20 text-white">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Events", summary.events || 0],
          ["Real transfers", summary.realTransfers || 0],
          ["Left EPL", summary.departures || 0],
          ["Alias noise", summary.aliasOnlySuppressed || 0],
          ["Users affected", summary.affectedUsers || 0],
          ["Cards affected", summary.affectedCards || 0],
          ["Claims open", summary.openClaims || 0],
          ["Claims used", summary.claimedClaims || 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-lg font-black">{String(value)}</div>
            <div className="text-[10px] font-black uppercase tracking-[.12em] text-white/40">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "departed", "transfer", "alias"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              className={filter === value ? "" : "border-white/15 bg-black/20 text-white"}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : value === "departed" ? "Outside Premier League" : value === "transfer" ? "Real EPL transfers" : "Club-name aliases"}
            </Button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, club, user or email" className="border-white/10 bg-black/30 pl-9" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!events.length && <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No matching transfer events.</div>}
        {events.map((event) => {
          const aliasOnly = Boolean(event.suspectedAliasOnly || event.suppressed);
          return (
            <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-base">{event.playerName}</b>
                    {event.leftPremierLeague ? (
                      <Badge className="bg-rose-500/20 text-rose-100">Outside Premier League</Badge>
                    ) : aliasOnly ? (
                      <Badge className="bg-amber-400/15 text-amber-100">Alias-only suppressed</Badge>
                    ) : (
                      <Badge className="bg-emerald-400/15 text-emerald-100">Premier League transfer</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/60">
                    <span>{event.fromTeam || "Unknown club"}</span><ArrowRight className="h-3.5 w-3.5" /><span>{event.toTeam || "Unknown club"}</span>
                  </div>
                  <div className="mt-1 text-xs text-white/35">Detected {formatDate(event.detectedAt)} · Player #{event.playerId}{event.fplId ? ` · FPL ${event.fplId}` : ""}</div>
                </div>
                <div className="text-right text-xs text-white/50">
                  <div><b className="text-white">{event.affectedUsers || 0}</b> users · <b className="text-white">{event.affectedCards || 0}</b> cards</div>
                  {event.leftPremierLeague && <div className="mt-1"><span className="text-amber-200">{event.openClaims || 0} pending</span> · {event.claimedClaims || 0} claimed</div>}
                </div>
              </div>

              {aliasOnly && (
                <div className="mt-3 flex gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs text-amber-100/80">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This was a naming difference for the same club, not a real transfer. Matching notifications are suppressed/cleaned and no replacement claim is created.</span>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {(event.owners || []).map((owner) => (
                  <div key={`${event.id}:${owner.userId}`} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-3.5 w-3.5 text-cyan-200" />{owner.managerTeamName || owner.name || owner.email || owner.userId}</div>
                        <div className="mt-0.5 break-all text-[11px] text-white/35">{owner.email || "No email"} · {owner.userId}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {(owner.cards || []).map((card) => (
                          <Badge key={card.cardId} className="bg-white/10 text-white">
                            #{card.cardId} {String(card.rarity || "").toUpperCase()}{card.claimId ? card.replacementCardId ? " · replaced" : " · claim pending" : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
