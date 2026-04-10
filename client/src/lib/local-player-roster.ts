import { type PlayerCardData, type Rarity } from "../components/Metal3DCard";

type LocalRosterItem = {
  id: string;
  name: string;
  position: string;
  club?: string;
  rating: number;
  rarity: string;
  serial?: number;
  maxSupply?: number;
  form?: number;
  image?: string;
};

function normalizeRarity(rarity: string): Rarity {
  const value = String(rarity || "common").toLowerCase();
  if (value === "rare" || value === "unique" || value === "epic" || value === "legendary") return value;
  return "common";
}

export async function fetchLocalPlayerRoster(url = "/data/players.json"): Promise<PlayerCardData[]> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Failed to load roster file: ${res.status}`);
  }

  const raw = (await res.json()) as LocalRosterItem[];
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => ({
    id: String(item.id || `local-${index + 1}`),
    name: String(item.name || "Unknown Player"),
    rating: Number(item.rating || 70),
    position: String(item.position || "N/A"),
    club: item.club ? String(item.club) : undefined,
    image: item.image ? String(item.image) : undefined,
    rarity: normalizeRarity(item.rarity),
    serial: Number(item.serial || 1),
    maxSupply: Number(item.maxSupply || 500),
    form: Number(item.form || 72),
  }));
}
