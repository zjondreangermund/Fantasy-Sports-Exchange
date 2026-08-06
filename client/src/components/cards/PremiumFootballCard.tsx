import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type PlayerCardData } from "./types";
import { CARD_SIZE, type PremiumCardSize } from "./cardTheme";
import CollectionStableCard from "./CollectionStableCard";

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

    return {
      ...player,
      name: data.player?.name || player.name,
      team: data.player?.team || player.team,
      club: data.player?.team || player.club,
      position: data.player?.position || player.position,
      totalPoints: data.stats?.totalPoints ?? player.totalPoints,
      image: verifiedImage || player.image,
      imageUrl: verifiedImage || player.imageUrl,
      photo: verifiedImage || player.photo,
      imageCandidates: verifiedImage ? [verifiedImage] : player.imageCandidates,
      statsVerified: identityVerified ? true : player.statsVerified,
    };
  }, [data, player]);

  const dimensions = CARD_SIZE[size] || CARD_SIZE.md;
  const scale = Math.min(
    dimensions.width / COLLECTION_PROFILE_WIDTH,
    dimensions.height / COLLECTION_PROFILE_HEIGHT,
  );
  const directInteraction = Boolean(onClick);

  return (
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
    </div>
  );
}

const PremiumFootballCard = memo(PremiumFootballCardBase);
PremiumFootballCard.displayName = "PremiumFootballCard";

export default PremiumFootballCard;
