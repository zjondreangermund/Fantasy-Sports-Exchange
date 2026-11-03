import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";
import { toFantasyCardData } from "../../lib/fantasy-card-adapter";
import CollectionStableCard from "./CollectionStableCard";

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

type Props = {
  card: PlayerCardWithPlayer;
  selected?: boolean;
  onClick?: () => void;
  showPrice?: boolean;
  cutoutPreview?: boolean;
};

/**
 * Uses the same verified profile payload and stable card renderer shown inside
 * CardProfileModal, so Collection cards stay crisp and visually consistent.
 */
export default function CollectionProfileCard({
  card,
  selected = false,
  onClick,
  showPrice = false,
  cutoutPreview = false,
}: Props) {
  const { data } = useQuery<ProfileData>({
    queryKey: ["/api/cards/profile", card.id],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${card.id}/profile`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch card profile");
      return response.json();
    },
    enabled: Number(card.id) > 0,
    staleTime: 60_000,
    retry: 1,
  });

  const verifiedApiPlayerId = Number(
    data?.source && data.source !== "card-fallback"
      ? data?.player?.apiFootballId || (card.player as any)?.apiFootballId || 0
      : (card.player as any)?.identityVerified ? (card.player as any)?.apiFootballId || 0 : 0,
  );
  const { data: cutoutManifest } = useQuery<{ version: number; players: Record<string, unknown> }>({
    queryKey: ["/portraits/cutouts/manifest.json"],
    queryFn: async () => {
      const response = await fetch("/portraits/cutouts/manifest.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Cutout portrait manifest unavailable");
      return response.json();
    },
    enabled: cutoutPreview && Number.isInteger(verifiedApiPlayerId) && verifiedApiPlayerId > 0,
    staleTime: 15 * 60_000,
    retry: false,
  });
  const cutoutUrl = cutoutPreview && cutoutManifest?.players?.[String(verifiedApiPlayerId)]
    ? `/portraits/cutouts/${verifiedApiPlayerId}.webp` : "";

  const fantasyCard = useMemo(() => {
    const identityVerified = Boolean(data && data.source && data.source !== "card-fallback");
    const verifiedImage = identityVerified ? data?.player?.imageUrl || undefined : undefined;
    const displayCard = data
      ? ({
          ...card,
          totalPoints: data.stats?.totalPoints ?? (card as any).totalPoints,
          player: {
            ...(card.player as any),
            ...data.player,
            name: data.player?.name || card.player?.name,
            team: data.player?.team || card.player?.team,
            position: data.player?.position || card.player?.position,
            imageUrl: verifiedImage,
            verifiedImageUrl: verifiedImage,
            identityVerified,
            identitySource: identityVerified
              ? data.source === "api-football"
                ? "api-football"
                : "fpl"
              : "unverified-card-data",
            totalPoints: data.stats?.totalPoints ?? (card.player as any)?.totalPoints,
            photo: null,
            photoUrl: null,
            image: null,
            image_url: null,
            officialPortraitUrl: null,
            headshotUrl: null,
            cutoutUrl: null,
            code: identityVerified ? (card.player as any)?.code : null,
          },
        } as PlayerCardWithPlayer)
      : card;

    const normal = toFantasyCardData(displayCard, { imageWidth: 900 });
    if (!cutoutUrl) return normal;
    return {
      ...normal,
      image: cutoutUrl,
      imageCandidates: Array.from(new Set([cutoutUrl, ...(normal.imageCandidates || []), normal.image].filter(Boolean))) as string[],
    };
  }, [card, data, cutoutUrl]);

  return (
    <CollectionStableCard
      player={fantasyCard}
      selected={selected}
      onClick={onClick}
      showPrice={showPrice}
      size="sm"
    />
  );
}
