import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { buildCardImageCandidates } from "./card-image";
import { type PlayerCardData, type Rarity } from "../components/Metal3DCard";

type FantasyCardDataOptions = {
  imageWidth?: number;
};

function normalizeRarity(rarity?: string | null): Rarity {
  const value = String(rarity || "common").toLowerCase();
  if (value === "rare" || value === "unique" || value === "epic" || value === "legendary") return value;
  return "common";
}

export function toFantasyCardData(card: PlayerCardWithPlayer, options: FantasyCardDataOptions = {}): PlayerCardData {
  const player = card.player as any;
  const requestedWidth = Number(options.imageWidth) > 0 ? Number(options.imageWidth) : 1024;
  const imageWidth = Math.max(1024, requestedWidth);
  const candidates = buildCardImageCandidates(card, { thumb: false, width: imageWidth, format: "webp" });

  return {
    id: String(card.id),
    name: String(player?.name || "Unknown Player"),
    rating: Number(player?.overall || card.decisiveScore || 0),
    position: String(player?.position || "N/A"),
    club: player?.team ? String(player.team) : undefined,
    image: candidates[0],
    imageCandidates: candidates,
    rarity: normalizeRarity(card.rarity),
    serial: Number(card.serialNumber || 1),
    maxSupply: Number(card.maxSupply || 100),
    level: Number(card.level || 1),
    xp: Number(card.xp || 0),
    xpMax: Number(card.maxSupply && Number(card.maxSupply) > 0 ? card.maxSupply : 1000),
    form: Number(card.decisiveScore || 0),
    last5Scores: Array.isArray(card.last5Scores)
      ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5)
      : [0, 0, 0, 0, 0],
  };
}
