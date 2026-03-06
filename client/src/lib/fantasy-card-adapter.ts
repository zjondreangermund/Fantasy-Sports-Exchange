import { type PlayerCardWithPlayer } from "../../../shared/schema";
import { buildCardImageCandidates } from "./card-image";
import { type PlayerCardData, type Rarity } from "../components/FantasyCard";

function normalizeRarity(rarity?: string | null): Rarity {
  const value = String(rarity || "common").toLowerCase();
  if (value === "rare" || value === "unique" || value === "epic" || value === "legendary") return value;
  return "common";
}

export function toFantasyCardData(card: PlayerCardWithPlayer): PlayerCardData {
  const player = card.player as any;
  const candidates = buildCardImageCandidates(card, { thumb: true, width: 512, format: "webp" });

  return {
    id: String(card.id),
    name: String(player?.name || "Unknown Player"),
    rating: Number(player?.overall || card.decisiveScore || 0),
    position: String(player?.position || "N/A"),
    club: player?.team ? String(player.team) : undefined,
    image: candidates[0],
    rarity: normalizeRarity(card.rarity),
    serial: Number(card.serialNumber || 1),
    maxSupply: Number(card.maxSupply || 100),
    form: Number(card.decisiveScore || 0),
  };
}
