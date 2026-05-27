import PlayerTile from "./PlayerTile";
import { type PlayerCardData } from "./cards/types";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

const EMPTY_PLAYER: PlayerCardData = {
  id: "empty-player-card",
  name: "Unknown Player",
  position: "N/A",
  rating: 0,
  rarity: "common",
  serial: 0,
  maxSupply: 0,
};

export default function CollectionPlayerCard({ player, className = "" }: CollectionPlayerCardProps) {
  return <PlayerTile player={player || EMPTY_PLAYER} className={className} />;
}
