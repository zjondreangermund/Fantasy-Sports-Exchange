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

class SafeCardBoundary extends React.Component<SafeCardBoundaryProps, SafeCardBoundaryState> {
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
  const last5 = Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5) : [];
  while (last5.length < 5) last5.push(0);
  return last5;
}

function getCountryFlag(player: PlayerCardData) {
  const code = String(player.nationality || "ARG").toUpperCase();
  if (code.length !== 2) return "🇦🇷";
  return String.fromCodePoint(...code.split("").map((c) => 127397 + c.charCodeAt(0)));
}

function getImageCandidates(player: PlayerCardData) {
  const list = [player.image, player.imageUrl, player.photo, ...(player.imageCandidates || []), CARD_IMAGE_FALLBACK].filter(
    (value): value is string => Boolean(value),
  );
  return Array.from(new Set(list));
}

function CardFallback({ player, className = "" }: SimpleCardProps) {
  const teamCode = String(player.club || player.team || "TEAM").slice(0, 4).toUpperCase();
  const rarity = normalizeVisualRarity(player.rarity);

  return (
    <div
      className={[
        "relative w-[170px] max-w-full aspect-[0.71/1] rounded-3xl border border-white/20 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-4",
        "shadow-[0_18px_38px_rgba(0,0,0,0.45)]",
        className,
      ].join(" ")}
    >
      <div className="text-[10px] font-bold tracking-[0.14em] text-white/80">{teamCode}</div>
      <div className="mt-3 text-sm font-black uppercase text-white line-clamp-2">{player.name || "Unknown Player"}</div>
      <div className="mt-2 inline-block rounded-full border border-white/20 px-2 py-0.5 text-[9px] font-bold uppercase text-white/80">{rarity}</div>
      <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[9px] text-white/75">Card fallback</div>
    </div>
  );
}

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  const candidates = React.useMemo(() => getImageCandidates(player), [player]);
  const [candidateIndex, setCandidateIndex] = React.useState(0);
  const src = candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] || CARD_IMAGE_FALLBACK;

  const last5 = getLast5(player);
  const avgScore = Math.round(last5.reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, last5.length));
  const teamCode = String(player.club || player.team || "LIV").slice(0, 3).toUpperCase();

  return (
    <SafeCardBoundary fallback={<CardFallback player={player} className={className} />}>
      <SlabCard
        className={className}
        name={String(player.name || "Alexis Mac Allister")}
        rarity={toSlabRarity(player.rarity)}
        avgScore={avgScore || Number(player.rating || 0) || 68}
        serialNumber={`${player.serial || 25}/${player.maxSupply || 100}`}
        imageSrc={src}
        teamCode={teamCode}
        shirtNumber={10}
        age={25}
        countryCode={getCountryFlag(player)}
        last5={last5}
        status={player.status}
        competitionEligible={player.competitionEligible}
        provenanceMarker={player.provenanceMarker}
      />
    </SafeCardBoundary>
  );
}