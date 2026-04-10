import PlayerCard3D from "./PlayerCard3D";
import SimpleCard from "./SimpleCard";
import { type PlayerCardData } from "./Metal3DCard";

type CollectionPlayerCardProps = {
  player: PlayerCardData;
  className?: string;
  mode?: "css" | "3d";
};

export default function CollectionPlayerCard({ player, className = "", mode = "3d" }: CollectionPlayerCardProps) {
  if (mode === "css") {
    return (
      <SimpleCard player={player} className={`!w-[220px] ${className}`.trim()} />
    );
  }

  return <PlayerCard3D player={player} className={`!w-[260px] !h-[364px] ${className}`.trim()} />;
}
