// STRICT_PLAYER_IDENTITY_FIX_V2
import { type PlayerCardWithPlayer } from "../../../shared/schema";

export const CARD_IMAGE_FALLBACK = "/players/fallback.svg";

const LOCAL_PLACEHOLDER_PATTERN =
  /\/(images\/player-\d+|players\/fallback)\.(png|jpg|jpeg|svg|webp)$/i;

type CardLike = Partial<PlayerCardWithPlayer> & {
  player?: {
    id?: number | string | null;
    fplId?: number | string | null;
    code?: number | string | null;
    name?: string | null;
    team?: string | null;
    club?: string | null;
    photo?: string | null;
    photoUrl?: string | null;
    image?: string | null;
    imageUrl?: string | null;
    verifiedImageUrl?: string | null;
    image_url?: string | null;
    officialPortraitUrl?: string | null;
    headshotUrl?: string | null;
    cutoutUrl?: string | null;
    imageCandidates?: string[] | null;
    identitySource?: string | null;
    identityVerified?: boolean | null;
    apiFootballId?: number | string | null;
  } | null;
};

export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function premierLeaguePhotoFromCode(
  value?: string | number | null,
): string | null {
  if (value == null) return null;
  const match = String(value).trim().match(/(\d+)/);
  if (!match) return null;
  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${match[1]}.png`;
}

export function toSafeImageUrl(url: string): string {
  if (/^https?:\/\/(resources\.premierleague\.com|media\.api-sports\.io)\//i.test(url)) {
    // A strict miss must trigger the image element's next verified candidate;
    // redirecting immediately to the placeholder hides healthy fallback photos.
    return `/api/image-proxy?url=${encodeURIComponent(url)}&strict=1`;
  }
  return url;
}

export function isVerifiedPlayerIdentity(
  player: CardLike["player"],
): boolean {
  if (!player) return false;
  if (player.identityVerified === true) return true;
  const source = String(player.identitySource || "").toLowerCase();
  return (
    source === "fpl" ||
    source === "api-football-current-squad" ||
    source === "fpl+api-football" ||
    source === "api-football"
  );
}

export function buildCardImageCandidates(
  card: CardLike | null | undefined,
  _options?: {
    thumb?: boolean;
    width?: number;
    format?: "webp" | "png" | "jpeg";
  },
): string[] {
  const player = card?.player;
  const verified = isVerifiedPlayerIdentity(player);
  const candidates: string[] = [];

  if (verified) {
    // API-Football is the primary verified squad provider. Some official FPL
    // headshots return 403, so try its independently linked headshot first.
    const apiFootballId = Number(player?.apiFootballId || 0);
    if (Number.isInteger(apiFootballId) && apiFootballId > 0) {
      candidates.push(toSafeImageUrl(`https://media.api-sports.io/football/players/${apiFootballId}.png`));
    }

    const rawValues = uniqueStrings([
      player?.cutoutUrl,
      player?.verifiedImageUrl,
      player?.headshotUrl,
      player?.imageUrl,
      player?.image_url,
      player?.image,
      player?.photoUrl,
      ...(Array.isArray(player?.imageCandidates)
        ? player.imageCandidates
        : []),
      player?.officialPortraitUrl,
    ]);

    for (const raw of rawValues) {
      const normalized = normalizeImageUrl(raw);
      if (!normalized || LOCAL_PLACEHOLDER_PATTERN.test(normalized)) continue;
      candidates.push(toSafeImageUrl(normalized));
    }

    for (const codeLike of [player?.code, player?.photo]) {
      const officialPhoto = premierLeaguePhotoFromCode(codeLike);
      if (officialPhoto) candidates.push(toSafeImageUrl(officialPhoto));
    }
  }

  candidates.push(CARD_IMAGE_FALLBACK);
  return Array.from(new Set(candidates));
}
