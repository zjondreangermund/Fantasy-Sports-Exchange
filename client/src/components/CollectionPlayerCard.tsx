import SimpleCard from "./SimpleCard";
import { type PlayerCardData } from "./cards/types";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

const FALLBACK_PLAYER: PlayerCardData = {
  id: "fallback-card",
  name: "Unknown Player",
  position: "N/A",
  rating: 0,
  rarity: "common",
  serial: 0,
  maxSupply: 0,
};

export default function CollectionPlayerCard({ player, className = "" }: CollectionPlayerCardProps) {
  return <SimpleCard player={player || FALLBACK_PLAYER} className={`!w-[220px] ${className}`.trim()} />;
}
