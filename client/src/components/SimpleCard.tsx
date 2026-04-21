import UnifiedPlayerCard from "./cards/UnifiedPlayerCard";
import { type PlayerCardData } from "./cards/types";

type SimpleCardProps = {
  player: PlayerCardData;
  className?: string;
};

export default function SimpleCard({ player, className = "" }: SimpleCardProps) {
  return <UnifiedPlayerCard player={player} className={className} />;
}
