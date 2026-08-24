import { fplApi } from "./fplApi.js";
import { buildFplPlayerIndex, overallFromFplElement } from "./fplPlayerIdentity.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats, mergePlayerStatsWithDetailedStats } from "./scoring.js";
import { loadDetailedScoringContext, resolveDetailedStatsForPlayer } from "./apiFootballScoringBridge.js";
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

  const [bootstrap, liveData, apiFootballDirectory] = await Promise.all([
    fplApi.bootstrap().catch(() => null),
    fplApi.getLiveGameweek().catch(() => null),
    loadApiFootballPlayerDirectory().catch(() => []),
  ]);

  const fplIndex = buildFplPlayerIndex(bootstrap || {});
  const currentGameweek = Number((bootstrap as any)?.events?.find((event: any) => event?.is_current)?.id || await fplApi.getCurrentGameweek().catch(() => 0));
  const detailedScoringContext = await loadDetailedScoringContext(bootstrap || {}, currentGameweek);
  const liveByElementId = new Map<number, any>();
  for (const element of Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : []) liveByElementId.set(Number(element.id), element);

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
    const currentPosition = canonical?.position || String(player.position || "") || apiFootballPlayer?.position || "MID";
    const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;
    const detailedStats = liveElement ? resolveDetailedStatsForPlayer({ ...player, ...(canonical || {}) }, detailedScoringContext) : null;
    const verifiedPosition = String((detailedStats as any)?.api_position || canonical?.position || currentPosition);
    const currentGameweekPoints = liveElement ? Number(calculatePlayerScore(mergePlayerStatsWithDetailedStats(mapFplStatsToPlayerStats(liveElement), detailedStats), verifiedPosition)?.total_score || 0) : 0;
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
      currentGameweekPoints,
      // Historical match rows are provided by the profile endpoint. Do not
      // reconstruct a "last five" series from live snapshots or stored zeros.
      last5Scores: [],
      player: {
        ...player,
        ...(canonical || {}),
        name: apiFootballPlayer?.name || canonical?.name || player.name,
        team: apiFootballPlayer?.team || canonical?.team || player.team,
        league: identityVerified ? "Premier League" : player.league,
        position: currentPosition,
        nationality: apiFootballPlayer?.nationality || player.nationality,
        apiFootballId: apiFootballPlayer?.apiPlayerId || null,
        officialPortraitUrl: fplImage || null,
        cutoutUrl: apiFootballImage || null,
        imageCandidates,
        imageUrl: verifiedImageUrl,
        verifiedImageUrl,
        identityVerified,
        premierLeagueEligible: identityVerified,
        premierLeagueStatus: identityVerified
          ? "active"
          : String(player.league || "").toLowerCase() === "outside premier league"
            ? "outside-premier-league"
            : "unverified",
        selectionEligibility: {
          eligible: identityVerified,
          provider: apiFootballPlayer ? "api-football" : matchedElement ? "fpl-fallback" : null,
          code: identityVerified
            ? "eligible"
            : String(player.league || "").toLowerCase() === "outside premier league"
              ? "outside-premier-league"
              : "identity-unlinked",
          message: identityVerified
            ? `Eligible: linked by ${apiFootballPlayer ? "API-Football current squads" : "FPL fallback"}.`
            : String(player.league || "").toLowerCase() === "outside premier league"
              ? `${player.name} is outside the Premier League; use the same-position replacement card.`
              : `${player.name} is not linked to API-Football or the FPL fallback yet.`,
        },
        identitySource:
          apiFootballPlayer && matchedElement
            ? "fpl+api-football"
            : apiFootballPlayer
              ? "api-football-current-squad"
              : matchedElement
                ? "fpl"
                : "unverified-card-data",
        totalPoints,
        currentGameweekPoints,
        form,
        overall,
      },
    };
  });
}
