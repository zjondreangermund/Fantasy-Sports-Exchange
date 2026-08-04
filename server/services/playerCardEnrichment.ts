import { fplApi } from "./fplApi.js";
import { buildFplPlayerIndex, overallFromFplElement } from "./fplPlayerIdentity.js";
import {
  apiFootballPhotoUrl,
  loadApiFootballPlayerDirectory,
  resolveApiFootballPlayer,
} from "./apiFootballPlayerDirectory.js";

/**
 * Enriches card-player records with current verified Premier League identity,
 * club, position, portrait and official FPL values. Missing provider values stay
 * null; card progression fields are never reused as football performance stats.
 */
export async function enrichPlayerCards(cards: any[]): Promise<any[]> {
  const sourceCards = Array.isArray(cards) ? cards : [];
  if (!sourceCards.length) return [];

  const [bootstrap, apiFootballDirectory] = await Promise.all([
    fplApi.bootstrap().catch(() => null),
    loadApiFootballPlayerDirectory().catch(() => []),
  ]);

  const fplIndex = buildFplPlayerIndex(bootstrap || {});

  return sourceCards.map((card: any) => {
    const player = card?.player as any;
    if (!player) return card;

    const matchedElement = fplIndex.resolve(player);
    const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
    const apiFootballPlayer = resolveApiFootballPlayer(
      { ...player, ...(canonical || {}) },
      apiFootballDirectory,
    );
    const identityVerified = Boolean(apiFootballPlayer || matchedElement);
    const currentPosition = apiFootballPlayer?.position || canonical?.position || String(player.position || "MID");
    const totalPoints = matchedElement ? Number(matchedElement.total_points || 0) : null;
    const form = matchedElement ? Number(matchedElement.form || 0) : null;
    const overall = matchedElement ? overallFromFplElement(matchedElement) : null;
    const apiFootballImage = apiFootballPlayer
      ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo)
      : "";
    const fplImage = matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : "";
    const existingImages = identityVerified
      ? [
          player.verifiedImageUrl,
          player.officialPortraitUrl,
          player.cutoutUrl,
          player.headshotUrl,
          player.imageUrl,
        ].filter(Boolean)
      : [];
    const imageCandidates = Array.from(new Set([fplImage, apiFootballImage, ...existingImages].filter(Boolean)));
    const verifiedImageUrl = identityVerified ? imageCandidates[0] || null : null;

    return {
      ...card,
      totalPoints,
      // Historical match rows are provided by the profile endpoint. Do not
      // reconstruct a "last five" series from live snapshots or stored zeros.
      last5Scores: [],
      player: {
        ...player,
        ...(canonical || {}),
        name: canonical?.name || apiFootballPlayer?.name || player.name,
        team: apiFootballPlayer?.team || canonical?.team || player.team,
        position: currentPosition,
        nationality: apiFootballPlayer?.nationality || player.nationality,
        apiFootballId: apiFootballPlayer?.apiPlayerId || null,
        officialPortraitUrl: fplImage || null,
        cutoutUrl: apiFootballImage || null,
        imageCandidates,
        imageUrl: verifiedImageUrl,
        verifiedImageUrl,
        identityVerified,
        identitySource:
          apiFootballPlayer && matchedElement
            ? "fpl+api-football"
            : apiFootballPlayer
              ? "api-football-current-squad"
              : matchedElement
                ? "fpl"
                : "unverified-card-data",
        totalPoints,
        form,
        overall,
      },
    };
  });
}