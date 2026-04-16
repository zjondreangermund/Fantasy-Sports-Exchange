import { normalizeVisualRarity } from "./cards/cardVisualTokens";
import { type PlayerCardData } from "./cards/types";
import { useMemo, useState } from "react";
import { CARD_IMAGE_FALLBACK } from "../lib/card-image";
import SlabCard, { type SlabRarity } from "./cards/SlabCard";

type SimpleCardProps = {
  player: PlayerCardData;
  className?: string;
};

function toSlabRarity(rarity: PlayerCardData["rarity"]): SlabRarity {
  if (rarity === "rare" || rarity === "unique" || rarity === "legendary") return rarity;
  return "common";
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

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  // SAFE rarity normalization
  const visualRarity = normalizeVisualRarity(player.rarity);

  const candidates = useMemo(() => {
    const list = [
      player.image,
      player.imageUrl,
      player.photo,
      ...(player.imageCandidates || []),
      CARD_IMAGE_FALLBACK,
    ].filter((value): value is string => Boolean(value));
    return Array.from(new Set(list));
  }, [player.image, player.imageUrl, player.photo, player.imageCandidates]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const src =
    candidates[Math.min(candidateIndex, Math.max(0, candidates.length - 1))] ||
    CARD_IMAGE_FALLBACK;

  const last5 = getLast5(player);
  const avgScore = Math.round(
    last5.reduce((sum, value) => sum + Number(value || 0), 0) /
      Math.max(1, last5.length)
  );

  const teamCode = String(player.club || player.team || "LIV")
    .slice(0, 3)
    .toUpperCase();

  return (
    <SlabCard
      className={className}
      name={String(player.name || "Alexis Mac Allister")}
      rarity={toSlabRarity(visualRarity)}
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
  );
}