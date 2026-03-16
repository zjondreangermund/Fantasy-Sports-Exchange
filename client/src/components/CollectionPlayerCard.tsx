import Metal3DCard, { type PlayerCardData } from "./Metal3DCard";
import SimpleCard from "./SimpleCard";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
  mode?: "css" | "3d";
};

export default function CollectionPlayerCard({ player, className = "", mode = "css" }: CollectionPlayerCardProps) {
  if (mode === "3d") {
    return <Metal3DCard player={player} className={`!w-[260px] !h-[364px] ${className}`.trim()} />;
  }

  return (
    <SimpleCard player={player} className={`!w-[220px] ${className}`.trim()} />
  );
}
