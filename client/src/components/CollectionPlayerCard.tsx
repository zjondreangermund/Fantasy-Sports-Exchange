import Metal3DCard, { type PlayerCardData } from "./Metal3DCard";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
};

export default function CollectionPlayerCard({ player, className = "" }: CollectionPlayerCardProps) {
  return (
    <Metal3DCard player={player} className={`!w-[150px] !h-[210px] ${className}`.trim()} />
  );
}
