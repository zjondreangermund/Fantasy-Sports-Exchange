import { type PlayerCardWithPlayer } from "../../../shared/schema";

export const CARD_IMAGE_FALLBACK = "/players/fallback.png";

type CardLike = Partial<PlayerCardWithPlayer> & {
  player?: {
    id?: number | null;
    photo?: string | null;
    photoUrl?: string | null;
    imageUrl?: string | null;
    image_url?: string | null;
  } | null;
};

export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function lowercaseFilenamePath(url: string): string {
  const [pathOnly, search = ""] = url.split("?");
  const parts = pathOnly.split("/");
  const fileName = parts.pop() || "";
  const lowerFileName = fileName.toLowerCase();
  const rebuilt = `${parts.join("/")}/${lowerFileName}`.replace(/\/+/g, "/");
  return search ? `${rebuilt}?${search}` : rebuilt;
}

export function toSafeImageUrl(url: string): string {
  if (/^https?:\/\/resources\.premierleague\.com\//i.test(url)) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function buildCardImageCandidates(
  card: CardLike | null | undefined,
  options?: { thumb?: boolean; width?: number; format?: "webp" | "png" | "jpeg" },
): string[] {
  const player = card?.player;
  const playerId = Number(player?.id || card?.playerId || 0);
  const thumb = options?.thumb ?? true;
  const width = Number(options?.width || (thumb ? 256 : 640));
  const format = options?.format || "webp";

  const params = new URLSearchParams();
  if (thumb) params.set("variant", "thumb");
  if (Number.isFinite(width) && width > 0) params.set("w", String(width));
  if (format) params.set("format", format);

  const candidates: string[] = [];

  if (playerId > 0) {
    candidates.push(`/api/players/${playerId}/photo?${params.toString()}`);
    candidates.push(`/api/players/${playerId}/photo`);
  }

  const imageUrl =
    player?.photo ||
    player?.photoUrl ||
    player?.imageUrl ||
    player?.image_url ||
    null;

  const normalized = normalizeImageUrl(imageUrl);
  if (normalized) {
    candidates.push(toSafeImageUrl(normalized));
    if (!normalized.startsWith("data:")) {
      candidates.push(toSafeImageUrl(lowercaseFilenamePath(normalized)));
    }
  }

  candidates.push(CARD_IMAGE_FALLBACK);

  return Array.from(new Set(candidates.filter(Boolean)));
}
