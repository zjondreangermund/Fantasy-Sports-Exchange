import * as React from "react";
import { type PlayerCardData } from "./cards/types";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";
import SlabCard, { type SlabRarity } from "./cards/SlabCard";
import { normalizeVisualRarity } from "./cards/cardVisualTokens";

type SimpleCardProps = {
  player: PlayerCardData;
  className?: string;
};

type SafeCardBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
};

type SafeCardBoundaryState = { failed: boolean };

class SafeCardBoundary extends React.Component<
  SafeCardBoundaryProps,
  SafeCardBoundaryState
> {
  state: SafeCardBoundaryState = { failed: false };

  static getDerivedStateFromError(): SafeCardBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[SimpleCard] Render fallback activated", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function toSlabRarity(rarity: PlayerCardData["rarity"]): SlabRarity {
  return normalizeVisualRarity(rarity);
}

function getLast5(player: PlayerCardData) {
  const last5 = Array.isArray(player.last5Scores)
    ? player.last5Scores.slice(0, 5)
    : [];
  while (last5.length < 5) last5.push(0);
  return last5.map((v) => Number(v || 0));
}

function getCountryCode(player: PlayerCardData) {
  return String(player.nationality || "ARG").toUpperCase().slice(0, 3);
}

function getImageCandidates(player: PlayerCardData) {
  const list = [
    player.image,
    player.imageUrl,
    player.photo,
    ...(player.imageCandidates || []),
    CARD_IMAGE_FALLBACK,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(list));
}

function CardFallback({ player, className = "" }: SimpleCardProps) {
  const rarity = normalizeVisualRarity(player.rarity);
  return (
    <div
      className={[
        "relative w-[176px] h-[312px] rounded-[22px] border border-white/15 bg-zinc-950 text-white overflow-hidden",
        className,
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-black opacity-80" />
      <div className="relative z-10 p-4">
        <div className="text-xs font-black uppercase">{rarity}</div>
        <div className="mt-3 text-base font-black uppercase leading-tight">
          {player.name || "Unknown Player"}
        </div>
      </div>
    </div>
  );
}

export default function SimpleCard({
  player,
  className = "",
}: SimpleCardProps) {
  const candidates = React.useMemo(() => getImageCandidates(player), [player]);
  const [candidateIndex, setCandidateIndex] = React.useState(0);

  const src =
    candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] ||
    "/images/player-placeholder.png";

  const last5 = getLast5(player);
  const avgScore =
    Math.round(
      last5.reduce((sum, value) => sum + Number(value || 0), 0) /
        Math.max(1, last5.length),
    ) ||
    Number(player.rating || 0) ||
    68;

  const teamCode = String(player.club || player.team || "EPL")
    .slice(0, 3)
    .toUpperCase();

  return (
    <SafeCardBoundary fallback={<CardFallback player={player} className={className} />}>
      <SlabCard
        className={className}
        name={String(player.name || "Unknown Player")}
        rarity={toSlabRarity(player.rarity)}
        avgScore={avgScore}
        serialNumber={`${player.serial || 1}/${player.maxSupply || 100}`}
        imageSrc={src}
        season="2026-27"
        teamCode={teamCode}
        shirtNumber={player.shirtNumber || 10}
        age={player.age || 25}
        countryCode={getCountryCode(player)}
        last5={last5}
        provenanceMarker={player.provenanceMarker}
        onImageError={() => {
          if (candidateIndex < candidates.length - 1) {
            setCandidateIndex((prev) => prev + 1);
          }
        }}
      />
    </SafeCardBoundary>
  );
}
