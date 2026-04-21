import UnifiedPlayerCard from "./cards/UnifiedPlayerCard";
import { type PlayerCardData } from "./cards/types";

type Metal3DCardProps = {
  player: PlayerCardData;
  className?: string;
};

export default function Metal3DCard({ player, className = "" }: Metal3DCardProps) {
  return <UnifiedPlayerCard player={player} className={className} />;
}
