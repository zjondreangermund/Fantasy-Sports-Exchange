export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerCardData = {
  id: string;
  name: string;
  position: string;
  rating: number;
  rarity: Rarity;
  team?: string;
  club?: string;
  league?: string;
  serial?: number;
  maxSupply?: number;
  season?: string;
  /** Chosen display image for the card. Database/player sources are normalized before reaching the UI. */
  image?: string;
  /** Ordered fallback images used when the chosen image fails to load. */
  imageCandidates?: string[];
  /** @deprecated Use image/imageCandidates. Kept temporarily while card components are migrated. */
  imageUrl?: string;
  /** @deprecated Use image/imageCandidates. Kept temporarily while card components are migrated. */
  photo?: string;
  nationality?: string;
  stats?: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defense: number;
    physical: number;
  };
  level?: number;
  xp?: number;
  xpMax?: number;
  form?: number;
  price?: number;
  forSale?: boolean;
  listedPrice?: number;
  listed?: boolean;
  last5Scores?: number[];
  totalPoints?: number;
  status?: "active" | "legacy" | "uncovered_league";
  competitionEligible?: boolean;
  provenanceMarker?: string;
};
