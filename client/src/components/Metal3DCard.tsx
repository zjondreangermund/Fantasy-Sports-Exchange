import SimpleCard from "./SimpleCard";
import { type PlayerCardData } from "./cards/types";

type Metal3DCardProps = {
  player: PlayerCardData;
  className?: string;
};

/**
 * Compatibility wrapper:
 * We intentionally keep a single lightweight 2D rendering path in production.
 */
export default function Metal3DCard({ player, className = "" }: Metal3DCardProps) {
  return <SimpleCard player={player} className={className} />;
}
