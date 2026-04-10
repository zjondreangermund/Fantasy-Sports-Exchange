/**
 * PlayerCard3D — premium 3D metal slab card component.
 *
 * This is the canonical card component for the collection and marketplace.
 * It wraps Metal3DCard (Three.js renderer) and ensures player photos are
 * resolved from all available image fields (imageUrl, photo, image, etc.)
 * before being passed down.
 *
 * Props mirror PlayerCardData from Metal3DCard with two additions:
 *   - player.imageUrl  (from DB Player.imageUrl)
 *   - player.photo     (from external API / EplPlayer)
 */

import Metal3DCard, { type PlayerCardData, type Rarity } from "./Metal3DCard";

// Extended props that accept the raw DB/API image fields in addition to the
// already-normalised `image` / `imageCandidates` fields.
export type PlayerCard3DData = PlayerCardData & {
  imageUrl?: string | null;
  photo?: string | null;
  photoUrl?: string | null;
};

export type { Rarity };

type PlayerCard3DProps = {
  player: PlayerCard3DData;
  className?: string;
};

/**
 * Merge any raw image-URL fields (imageUrl, photo, photoUrl) into the
 * imageCandidates list so Metal3DCard can try them in order.
 */
function enrichCandidates(player: PlayerCard3DData): PlayerCardData {
  const extra: string[] = [
    player.imageUrl,
    player.photo,
    player.photoUrl,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  const existing = [
    player.image,
    ...(player.imageCandidates || []),
  ].filter((v): v is string => Boolean(v));

  // Deduplicate while preserving order: existing candidates first, then extras
  const seen = new Set(existing);
  const merged = [...existing];
  for (const url of extra) {
    if (!seen.has(url)) {
      seen.add(url);
      merged.push(url);
    }
  }

  return {
    ...player,
    image: merged[0] ?? player.image,
    imageCandidates: merged,
  };
}

export default function PlayerCard3D({ player, className = "" }: PlayerCard3DProps) {
  const enriched = enrichCandidates(player);
  return (
    <Metal3DCard
      player={enriched}
      className={`!w-[260px] !h-[364px] ${className}`.trim()}
    />
  );
}
