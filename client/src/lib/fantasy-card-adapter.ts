import { type PlayerCardWithPlayer } from "../../../shared/schema";
import {
  buildCardImageCandidates,
  CARD_IMAGE_FALLBACK,
  isVerifiedPlayerIdentity,
  toSafeImageUrl,
} from "./card-image";
import { type PlayerCardData, type Rarity } from "../components/cards/types";
import {
  getCardStatus,
  getProvenanceMarker,
  isMainCompetitionEligible,
} from "../../../shared/card-economy";

type FantasyCardDataOptions = {
  imageWidth?: number;
};

function normalizeRarity(rarity?: string | null): Rarity {
  const value = String(rarity || "common").toLowerCase();
  if (
    value === "rare" ||
    value === "unique" ||
    value === "epic" ||
    value === "legendary"
  ) {
    return value;
  }
  return "common";
}

function normalizeNationality(player: any): string | undefined {
  const raw =
    player?.nationality ||
    player?.country ||
    player?.countryCode ||
    player?.country_code;
  if (!raw) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;
  return value.length <= 3 ? value.toUpperCase() : value;
}

function safeUrl(value: unknown): string | undefined {
  const text = String(value || "").trim();
  return text || undefined;
}

function trustedOfficialPreviewUrl(value: unknown): string | undefined {
  const text = safeUrl(value);
  if (!text) return undefined;
  if (/^\/api\/image-proxy\?url=/i.test(text)) return text;
  if (/^https?:\/\/(resources\.premierleague\.com|media\.api-sports\.io)\//i.test(text)) {
    return toSafeImageUrl(text);
  }
  return undefined;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function finiteNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function isLowQualityFallback(src: string) {
  return (
    !src ||
    src === CARD_IMAGE_FALLBACK ||
    src.includes("/players/fallback") ||
    src.includes("/images/player-") ||
    src.includes("fallback") ||
    src.includes("images.unsplash.com")
  );
}

function preferRealImage(candidates: string[]): string {
  const real = candidates.find((src) => src && !isLowQualityFallback(src));
  return real || candidates[0] || CARD_IMAGE_FALLBACK;
}

export function toFantasyCardData(
  card: PlayerCardWithPlayer,
  options: FantasyCardDataOptions = {},
): PlayerCardData {
  const player = card.player as any;
  const requestedWidth =
    Number(options.imageWidth) > 0 ? Number(options.imageWidth) : 1024;
  const imageWidth = Math.max(1024, requestedWidth);
  const unmintedPreview = !card.ownerId && !card.serialId && Number(card.serialNumber || 0) <= 0;

  const generatedCandidates = buildCardImageCandidates(card, {
    thumb: false,
    width: imageWidth,
    format: "webp",
  });

  const identityVerified = isVerifiedPlayerIdentity(player);
  const directCandidates = identityVerified
    ? uniqueStrings([
        safeUrl(player?.verifiedImageUrl),
        safeUrl(player?.imageUrl),
        safeUrl(player?.photoUrl),
        safeUrl(player?.image_url),
      ]).filter((src) => !isLowQualityFallback(src))
    : unmintedPreview
      ? uniqueStrings([
          trustedOfficialPreviewUrl(player?.verifiedImageUrl),
          trustedOfficialPreviewUrl(player?.imageUrl),
          trustedOfficialPreviewUrl(player?.photoUrl),
          trustedOfficialPreviewUrl(player?.image_url),
          trustedOfficialPreviewUrl(player?.photo),
        ]).filter((src) => !isLowQualityFallback(src))
      : [];

  const candidates = uniqueStrings([
    ...directCandidates,
    ...generatedCandidates,
    CARD_IMAGE_FALLBACK,
  ]);

  const primaryImage = preferRealImage(candidates);

  const status = getCardStatus({
    league: player?.league,
    hasProgression: Number(card.xp || 0) > 0 || Number(card.level || 0) > 1,
  });

  const competitionEligible = isMainCompetitionEligible({
    rarity: normalizeRarity(card.rarity),
    status,
  });

  const provenanceMarker = getProvenanceMarker({
    serialNumber: Number(card.serialNumber || 0),
    acquiredAt: card.acquiredAt as any,
  });

  const last5Scores = Array.isArray(card.last5Scores)
    ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5)
    : [0, 0, 0, 0, 0];

  while (last5Scores.length < 5) last5Scores.push(0);

  const officialStatValues = [
    player?.totalPoints,
    player?.total_points,
    (card as any).totalPoints,
    player?.form,
    player?.currentForm,
    (card as any).form,
    player?.overall,
  ];
  const statsVerified = identityVerified && officialStatValues.some((value) => {
    if (value === null || value === undefined || value === "") return false;
    return Number.isFinite(Number(value));
  });
  const totalPoints = statsVerified
    ? finiteNumber(player?.totalPoints, player?.total_points, (card as any).totalPoints)
    : 0;
  const form = statsVerified
    ? finiteNumber(player?.form, player?.currentForm, (card as any).form)
    : 0;
  const rating = statsVerified ? finiteNumber(player?.overall) : 0;

  return {
    // Unminted onboarding/player previews must never masquerade as an existing card ID.
    id: unmintedPreview ? "0" : String(card.id),
    name: String(player?.name || "Unknown Player"),
    rating,
    position: String(player?.position || "N/A"),
    club: player?.team ? String(player.team) : undefined,
    team: player?.team ? String(player.team) : undefined,
    league: player?.league ? String(player.league) : undefined,
    season: "2026-27",
    image: primaryImage,
    imageCandidates: candidates,
    nationality: normalizeNationality(player),
    rarity: normalizeRarity(card.rarity),
    serial: Number(card.serialNumber || 0),
    maxSupply: Number(card.maxSupply || 0),
    level: Number(card.level || 1),
    xp: Number(card.xp || 0),
    xpMax: Number(
      card.maxSupply && Number(card.maxSupply) > 0 ? card.maxSupply : 1000,
    ),
    form,
    price: Number(card.price || 0),
    forSale: Boolean(card.forSale),
    status,
    competitionEligible,
    provenanceMarker,
    last5Scores,
    totalPoints,
    statsVerified,
  };
}
