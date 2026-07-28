import { fplApi } from "./fplApi.js";
import { buildFplPlayerIndex, overallFromFplElement } from "./fplPlayerIdentity.js";
import {
  apiFootballPhotoUrl,
  loadApiFootballPlayerDirectory,
  resolveApiFootballPlayer,
} from "./apiFootballPlayerDirectory.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats } from "./scoring.js";

/**
 * Refreshes stored card-player records with the current Premier League identity,
 * club, position, image and live FPL values. The database card identity, rarity,
 * serial and ownership fields are preserved unchanged.
 */
export async function enrichPlayerCards(cards: any[]): Promise<any[]> {
  const sourceCards = Array.isArray(cards) ? cards : [];
  if (!sourceCards.length) return [];

  const [bootstrap, liveData, apiFootballDirectory] = await Promise.all([
    fplApi.bootstrap().catch(() => null),
    fplApi.getLiveGameweek().catch(() => null),
    loadApiFootballPlayerDirectory().catch(() => []),
  ]);

  const fplIndex = buildFplPlayerIndex(bootstrap || {});
  const liveElements = Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : [];
  const liveByElementId = new Map<number, any>();
  for (const liveElement of liveElements) liveByElementId.set(Number(liveElement.id), liveElement);

  return sourceCards.map((card: any) => {
    const player = card?.player as any;
    if (!player) return card;

    const matchedElement = fplIndex.resolve(player);
    const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
    const apiFootballPlayer = resolveApiFootballPlayer(
      { ...player, ...(canonical || {}) },
      apiFootballDirectory,
    );
    const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;
    const currentPosition = apiFootballPlayer?.position || canonical?.position || String(player.position || "MID");

    let last5Scores = Array.isArray(card.last5Scores)
      ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5)
      : [];

    if (liveElement) {
      const mappedStats = mapFplStatsToPlayerStats(liveElement);
      const calculatedScore = calculatePlayerScore(mappedStats, currentPosition);
      const latestLiveScore = Number(calculatedScore?.total_score || 0);
      if (last5Scores[0] !== latestLiveScore) last5Scores = [latestLiveScore, ...last5Scores];
    }

    last5Scores = last5Scores.map((value: any) => Number(value || 0)).slice(0, 5);
    while (last5Scores.length < 5) last5Scores.push(0);

    const totalPoints = matchedElement
      ? Number(matchedElement.total_points || 0)
      : Number(player.totalPoints ?? player.total_points ?? card.totalPoints ?? 0);
    const form = matchedElement
      ? Number(matchedElement.form || 0)
      : Number(player.form ?? card.decisiveScore ?? 0);
    const overall = matchedElement
      ? overallFromFplElement(matchedElement)
      : Number(player.overall || card.decisiveScore || 0);
    const apiFootballImage = apiFootballPlayer
      ? apiFootballPhotoUrl(apiFootballPlayer.apiPlayerId, apiFootballPlayer.photo)
      : "";
    const fplImage = matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : "";
    const verifiedImageUrl = apiFootballImage || fplImage || player.verifiedImageUrl || player.imageUrl || null;

    return {
      ...card,
      totalPoints,
      last5Scores,
      player: {
        ...player,
        ...(canonical || {}),
        name: canonical?.name || apiFootballPlayer?.name || player.name,
        team: apiFootballPlayer?.team || canonical?.team || player.team,
        position: currentPosition,
        nationality: apiFootballPlayer?.nationality || player.nationality,
        apiFootballId: apiFootballPlayer?.apiPlayerId || player.apiFootballId || null,
        imageUrl: verifiedImageUrl,
        verifiedImageUrl,
        identityVerified: Boolean(apiFootballPlayer || matchedElement),
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
