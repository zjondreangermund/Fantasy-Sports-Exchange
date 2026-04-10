export type Rarity = "common" | "rare" | "unique" | "epic" | "legendary";

export type PlayerLike = {
  id: string | number;
  name?: string;
  position?: string;
  team?: string;
  rarity?: Rarity;
  imageUrl?: string;
  [key: string]: any;
};

export type Pack = {
  id: string;
  label: string;
  cards: PlayerLike[];
};

export function buildStarterPacks(playerPool: PlayerLike[]): Pack[] {
  const shuffled = [...(playerPool || [])].sort(() => Math.random() - 0.5);
  const labels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"];
  const packs: Pack[] = [];

  for (let i = 0; i < 5; i += 1) {
    packs.push({
      id: `starter-pack-${i + 1}`,
      label: labels[i],
      cards: shuffled.slice(i * 3, i * 3 + 3),
    });
  }

  return packs;
}
