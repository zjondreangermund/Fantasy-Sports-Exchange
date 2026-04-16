import SimpleCard from "./SimpleCard";
import { type PlayerCardData } from "./cards/types";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

export default function CollectionPlayerCard({ player, className = "" }: CollectionPlayerCardProps) {
  return <SimpleCard player={player} className={`!w-[220px] ${className}`.trim()} />;
}
