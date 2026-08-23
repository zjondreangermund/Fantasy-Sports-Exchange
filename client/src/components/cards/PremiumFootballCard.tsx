import { memo, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import { type PlayerCardData } from "./types";
import { CARD_SIZE, type PremiumCardSize } from "./cardTheme";
import CollectionStableCard from "./CollectionStableCard";
import PlayerIntelligencePanel from "../PlayerIntelligencePanel";

export type PremiumFootballCardProps = {
  player: PlayerCardData;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  className?: string;
  size?: PremiumCardSize;
  interactive?: boolean;
};

type ProfileData = {
  source?: "fpl-live" | "api-football" | "card-fallback";
  player?: {
    name?: string;
    team?: string;
    position?: string;
    imageUrl?: string;
    apiFootballId?: number;
  };
  stats?: {
    totalPoints?: number;
  };
};

const COLLECTION_PROFILE_WIDTH = 170;
const COLLECTION_PROFILE_HEIGHT = 256;

function cardIdOf(player: PlayerCardData) {
  const value = Number((player as any).cardId || player.id || 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * Compatibility renderer for every legacy card surface.
 *
 * CollectionStableCard is the canonical visual engine used by Collection and
 * CardProfileModal. Keeping this component as a thin adapter means Marketplace,
 * squads, card reveals, dashboards, tournament lineups and analytics all show
 * the same clear metallic card instead of maintaining separate dull designs.
 *
 * The small information control deliberately lives here so every surface using
 * PremiumFootballCard can open the same API-Football Pro player intelligence.
 */
function PremiumFootballCardBase({
  player,
  selected = false,
  onClick,
  showPrice = false,
  className = "",
  size = "md",
  interactive = true,
}: PremiumFootballCardProps) {
  const cardId = cardIdOf(player);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const { data } = useQuery<ProfileData>({
    queryKey: ["/api/cards/profile", cardId],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${cardId}/profile`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch card profile");
      return response.json();
    },
    enabled: cardId > 0,
    staleTime: 60_000,
    retry: false,
  });

  const profilePlayer = useMemo<PlayerCardData>(() => {
    const identityVerified = Boolean(data?.source && data.source !== "card-fallback");
    const verifiedImage = identityVerified ? data?.player?.imageUrl || undefined : undefined;
    if (!data) return player;

    const payloadPosition = String(player.position || "").trim().toUpperCase();
    const profilePosition = String(data.player?.position || "").trim().toUpperCase();
    const profilePositionMatches = !payloadPosition || !profilePosition || payloadPosition === profilePosition;
    const useProfileIdentity = identityVerified && profilePositionMatches;

    return {
      ...player,
      name: useProfileIdentity ? (data.player?.name || player.name) : player.name,
      team: useProfileIdentity ? (data.player?.team || player.team) : player.team,
      club: useProfileIdentity ? (data.player?.team || player.club) : player.club,
      position: useProfileIdentity ? (data.player?.position || player.position) : player.position,
      totalPoints: useProfileIdentity ? (data.stats?.totalPoints ?? player.totalPoints) : player.totalPoints,
      image: useProfileIdentity ? (verifiedImage || player.image) : player.image,
      imageUrl: useProfileIdentity ? (verifiedImage || player.imageUrl) : player.imageUrl,
      photo: useProfileIdentity ? (verifiedImage || player.photo) : player.photo,
      imageCandidates: useProfileIdentity && verifiedImage ? [verifiedImage] : player.imageCandidates,
      statsVerified: useProfileIdentity ? true : player.statsVerified,
      apiFootballId: useProfileIdentity ? (data.player?.apiFootballId || (player as any).apiFootballId) : (player as any).apiFootballId,
    } as PlayerCardData;
  }, [data, player]);

  const apiFootballId = Number(data?.player?.apiFootballId || (player as any).apiFootballId || 0);
  const dimensions = CARD_SIZE[size] || CARD_SIZE.md;
  const scale = Math.min(
    dimensions.width / COLLECTION_PROFILE_WIDTH,
    dimensions.height / COLLECTION_PROFILE_HEIGHT,
  );
  const directInteraction = Boolean(onClick);

  const intelligenceModal = showIntelligence && apiFootballId > 0 && typeof document !== "undefined"
    ? createPortal(
      <div className="fixed inset-0 z-[500] overflow-y-auto bg-black/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`${profilePlayer.name || "Player"} intelligence`} onClick={() => setShowIntelligence(false)}>
        <div className="mx-auto mt-8 w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">API-Football Pro</div><h2 className="text-xl font-black text-white">{profilePlayer.name || "Player"} Intelligence</h2></div>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => setShowIntelligence(false)} aria-label="Close player intelligence"><X className="h-4 w-4" /></button>
          </div>
          <PlayerIntelligencePanel playerId={apiFootballId} />
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div
        className={className}
        data-card-engine="collection-profile-card"
        data-card-profile-source={data?.source || "card-payload"}
        style={{
          position: "relative",
          width: dimensions.width,
          height: dimensions.height,
          minWidth: dimensions.width,
          minHeight: dimensions.height,
          display: "grid",
          placeItems: "start center",
          overflow: "visible",
          pointerEvents: interactive || directInteraction ? "auto" : "none",
        }}
      >
        <div
          style={{
            width: COLLECTION_PROFILE_WIDTH,
            height: COLLECTION_PROFILE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <CollectionStableCard
            player={profilePlayer}
            selected={selected}
            onClick={directInteraction ? onClick : undefined}
            showPrice={showPrice}
            size="md"
          />
        </div>
        {apiFootballId > 0 && interactive ? (
          <button
            type="button"
            aria-label={`Open ${profilePlayer.name || "player"} intelligence`}
            title="Player intelligence"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setShowIntelligence(true);
            }}
            style={{ position: "absolute", right: 4, top: 4, zIndex: 60 }}
            className="grid h-7 w-7 place-items-center rounded-full border border-cyan-200/30 bg-slate-950/90 text-cyan-200 shadow-lg backdrop-blur hover:bg-cyan-300 hover:text-slate-950"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {intelligenceModal}
    </>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
PremiumFootballCard.displayName = "PremiumFootballCard";

export default PremiumFootballCard;
