// STRICT_PLAYER_IDENTITY_FIX_V2
import { type PlayerCardWithPlayer } from "../../../shared/schema";

export const CARD_IMAGE_FALLBACK = "/players/fallback.svg";

const LOCAL_PLACEHOLDER_PATTERN =
  /\/(images\/player-\d+|players\/fallback)\.(png|jpg|jpeg|svg|webp)$/i;
const cleanedPortraitCache = new Map<string, Promise<string>>();

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
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
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
    for (const codeLike of [player?.code, player?.photo]) {
      const officialPhoto = premierLeaguePhotoFromCode(codeLike);
      if (officialPhoto) candidates.push(toSafeImageUrl(officialPhoto));
    }

    const rawValues = uniqueStrings([
      player?.officialPortraitUrl,
      player?.verifiedImageUrl,
      player?.cutoutUrl,
      player?.headshotUrl,
      player?.imageUrl,
      player?.image_url,
      player?.image,
      player?.photoUrl,
      ...(Array.isArray(player?.imageCandidates)
        ? player.imageCandidates
        : []),
    ]);

    for (const raw of rawValues) {
      const normalized = normalizeImageUrl(raw);
      if (!normalized || LOCAL_PLACEHOLDER_PATTERN.test(normalized)) continue;
      candidates.push(toSafeImageUrl(normalized));
    }
  }

  candidates.push(CARD_IMAGE_FALLBACK);
  return Array.from(new Set(candidates));
}

function isLightBackground(r: number, g: number, b: number, a: number) {
  if (a <= 24) return true;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const luminance = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
  return luminance >= 218 && maximum - minimum <= 38;
}

function removeConnectedLightBackground(imageData: ImageData) {
  const { data, width, height } = imageData;
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (index < 0 || index >= count || visited[index]) return;
    const offset = index * 4;
    if (!isLightBackground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  for (let index = 0; index < count; index += 1) {
    if (!visited[index]) continue;
    data[index * 4 + 3] = 0;
  }

  for (let index = 0; index < count; index += 1) {
    if (visited[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touchesRemoved =
      (x > 0 && visited[index - 1]) ||
      (x + 1 < width && visited[index + 1]) ||
      (y > 0 && visited[index - width]) ||
      (y + 1 < height && visited[index + width]);
    if (!touchesRemoved) continue;
    const offset = index * 4;
    if (isLightBackground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
      data[offset + 3] = Math.min(data[offset + 3], 115);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Player portrait failed to load"));
    image.src = src;
  });
}

async function cleanPortrait(src: string): Promise<string> {
  if (
    typeof document === "undefined" ||
    !src ||
    src.includes("/players/fallback") ||
    src.endsWith(".svg")
  ) {
    return src;
  }

  try {
    const image = await loadImage(src);
    const maxSide = 420;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return src;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    removeConnectedLightBackground(imageData);
    context.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    return blob ? URL.createObjectURL(blob) : src;
  } catch {
    return src;
  }
}

export function cleanPlayerPortraitUrl(src: string): Promise<string> {
  if (!src) return Promise.resolve(src);
  const cached = cleanedPortraitCache.get(src);
  if (cached) return cached;
  const promise = cleanPortrait(src);
  cleanedPortraitCache.set(src, promise);
  return promise;
}
