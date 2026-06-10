import Card3D from "../Card3D";
import { type PlayerCardData } from "./types";
import { type PlayerCardWithPlayer } from "../../../../shared/schema";

type Props = {
  player: PlayerCardData;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: string;
  selected?: boolean;
  interactive?: boolean;
};

function normalizeRarity(value: string | undefined) {
  if (value === "rare" || value === "unique" || value === "epic" || value === "legendary") return value;
  return "common";
}

function formatTeam(player: PlayerCardData) {
  return String(player.team || player.club || "Fantasy Arena");
}

function serialText(player: PlayerCardData) {
  const serial = Number(player.serial || 1);
  const supply = Number(player.maxSupply || 100);
  return `#${String(serial).padStart(3, "0")}/${supply}`;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toCard3DData(player: PlayerCardData): PlayerCardWithPlayer {
  const rating = Math.round(toNumber(player.rating, 0));
  const rarity = normalizeRarity(player.rarity);
  const price = toNumber(player.price || player.listedPrice, 0);
  const imageUrl = player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || "/images/player-1.png";

  return {
    id: Number(player.id) || Math.abs(String(player.id || player.name || "0").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)),
    playerId: Number(player.id) || 0,
    ownerId: null,
    rarity,
    serialId: serialText(player),
    serialNumber: player.serial || 1,
    maxSupply: player.maxSupply || (rarity === "common" ? 1000 : rarity === "rare" ? 100 : rarity === "unique" ? 1 : rarity === "epic" ? 10 : 5),
    level: player.level || 1,
    xp: player.xp || 0,
    decisiveScore: rating || 35,
    last5Scores: Array.isArray(player.last5Scores) ? player.last5Scores.slice(0, 5) : [0, 0, 0, 0, 0],
    forSale: Boolean(player.forSale || player.listed || price > 0),
    price,
    acquiredAt: new Date(),
    player: {
      id: Number(player.id) || 0,
      name: player.name || "Unknown Player",
      team: formatTeam(player),
      league: player.league || "Fantasy Arena",
      position: player.position || "N/A",
      nationality: player.nationality || "FC",
      age: player.level || 24,
      overall: rating,
      imageUrl,
      photo: player.photo,
    } as any,
  } as PlayerCardWithPlayer;
}

export default function UnifiedPlayerCard({ player, className = "", size = "md", variant = "default", selected = false, interactive = false }: Props) {
  const card = toCard3DData(player);
  const cardSize = variant === "compact" ? "sm" : variant === "showcase" ? "lg" : size;

  return (
    <div className={className} data-card-engine="card3d">
      <Card3D
        card={card}
        size={cardSize}
        selected={selected}
        selectable={interactive}
        showPrice={Boolean(player.forSale || player.listed || Number(player.price || player.listedPrice || 0) > 0)}
        sorareImageUrl={player.image || player.imageUrl || player.photo || player.imageCandidates?.[0] || null}
      />
    </div>
  );
}
