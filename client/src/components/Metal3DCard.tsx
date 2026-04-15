import SimpleCard from "./SimpleCard";

export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  rating: number;
  position: string;
  club?: string;
  image?: string;
  imageUrl?: string;
  photo?: string;
  imageCandidates?: string[];
  rarity: Rarity;
  serial?: number;
  maxSupply?: number;
  team?: string;
  league?: string;
  nationality?: string;
  level?: number;
  xp?: number;
  xpMax?: number;
  form?: number;
  last5Scores?: number[];
  price?: number;
  forSale?: boolean;
};

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
