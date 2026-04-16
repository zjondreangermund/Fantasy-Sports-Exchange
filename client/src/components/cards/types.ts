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
  season?: string;
  image?: string;
  imageUrl?: string;
  photo?: string;
  imageCandidates?: string[];
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
  form?: string;
  price?: number;
  forSale?: boolean;
  listedPrice?: number;
  listed?: boolean;
  last5Scores?: number[];
};
