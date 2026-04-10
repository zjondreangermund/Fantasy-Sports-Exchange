import PlayerCard3D, { type PlayerCard3DData } from "./PlayerCard3D";
import SimpleCard from "./SimpleCard";
import { type PlayerCardData } from "./Metal3DCard";

type CollectionPlayerCardProps = {
  player: PlayerCard3DData | PlayerCardData;
  className?: string;
  /** @default "3d" */
  mode?: "css" | "3d";
};

export default function CollectionPlayerCard({ player, className = "", mode = "3d" }: CollectionPlayerCardProps) {
  if (mode === "css") {
    return (
      <SimpleCard player={player as PlayerCardData} className={`!w-[220px] ${className}`.trim()} />
    );
  }

  return (
    <PlayerCard3D player={player as PlayerCard3DData} className={className} />
  );
}
