import Metal3DCard, { type PlayerCardData } from "./Metal3DCard";

type PlayerCard3DProps = {
  player: PlayerCardData;
  className?: string;
};

/**
 * PlayerCard3D — thin wrapper around Metal3DCard that exposes the 3D card
 * with real player photo support (imageUrl / photo fields).
 */
export default function PlayerCard3D({ player, className = "" }: PlayerCard3DProps) {
  return <Metal3DCard player={player} className={className} />;
}
