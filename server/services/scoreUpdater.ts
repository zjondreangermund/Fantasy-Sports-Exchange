/**
 * Premier League tournament scoring and lifecycle service.
 *
 * Integrity rules:
 * - Entry windows close at the FPL deadline / first Premier League kickoff.
 * - Official FPL supplies core events; API-Football supplies verified detailed actions.
 * - Scores freeze at the configured Tuesday settlement cutoff and never change afterwards.
 * - FA Cup matches and Premier League fixtures played after the settlement cutoff do not count.
 * - Historical competition scores are never reset when the current gameweek changes.
 * - Every entry receives a gameweek-specific immutable scoring snapshot in tiebreak_meta.
 * - Captain bonus is applied once, to the lineup total only.
 */

import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import { buildFplPlayerIndex } from "./fplPlayerIdentity.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats, calculateLineupScore, mergePlayerStatsWithDetailedStats } from "./scoring.js";
import { loadDetailedScoringContext, resolveDetailedStatsForPlayer, type DetailedScoringContext } from "./apiFootballScoringBridge.js";

const RARITY_PRESTIGE: Record<string, number> = { common: 1, rare: 3, epic: 7, unique: 15, legendary: 30 };
const SCORE_REFRESH_INTERVAL_MS = Math.max(
  15_000,
  Math.min(120_000, Number(process.env.TOURNAMENT_SCORE_REFRESH_SECONDS || 30) * 1000),
);

type IdentityMap = ReturnType<typeof buildFplPlayerIndex>;

type CompetitionScoreResult = {
  updatedCount: number;
  totalEntries: number;
  gameWeek: number;
  final: boolean;
  complete: boolean;
  unresolvedCardIds: number[];
  skipped?: boolean;
  reason?: string;
};

function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }
function toNumber(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function asObject(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }

export class ScoreUpdateService {
  private storage: any;
  private updateInterval: NodeJS.Timeout | null = null;
  private scheduledUpdateInFlight = false;

  constructor(storage: any) { this.storage = storage; }
  isAutoUpdateEnabled() { return Boolean(this.updateInterval); }

  private zeroScore(card: any, elementId = 0, reason = "Player identity could not be securely linked to the official Premier League roster.") {
    return {
      card_id: card?.id || 0,
      player_id: card?.playerId || 0,
      element_id: elementId,
      total_score: 0,
      breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
      reasons: [],
      is_all_around: false,
      identity_status: elementId > 0 ? "awaiting-gameweek-data" : "identity-unlinked",
      identity_message: reason,
      official_player_name: String(card?.player?.name || "Unknown player"),
      official_team: String(card?.player?.team || ""),
      official_position: String(card?.player?.position || ""),
      minutes_played: 0,
    };
  }

  private buildFplIdentityMap(bootstrap: any): IdentityMap {
    return buildFplPlayerIndex(bootstrap);
  }

  private resolveFplElementId(player: any, identityMap: IdentityMap) {
    const verifiedElement = identityMap.resolve(player);
    return Number(verifiedElement?.id || 0);
  }

  private calculateXpFromElement(element: any) { return Number(element?.goals_scored || 0) * 45 + Number(element?.assists || 0) * 28 + Number(element?.starts || 0) * 12 + Math.floor(Number(element?.minutes || 0) / 20); }
  private levelFromXp(xp: number) { return Math.max(1, Math.floor(Math.max(0, xp) / 2000) + 1); }
  private nextLast5Scores(existing: any, nextScore: number) { const previous = Array.isArray(existing) ? existing.map((v: any) => Number(v || 0)) : []; if (previous.length > 0 && previous[previous.length - 1] === nextScore) return previous.slice(-5); return [...previous.slice(-4), nextScore]; }

  private cardValue(card: any) {
    // Squad-value tiebreaks are based only on an actual Fantasy Arena card
    // price. FPL transfer prices and derived ratings are not Arena currency.
    return Math.max(0, toNumber(card?.price));
  }

  private async loadSubmittedLineupCards(entry: any, lineupCardIds: number[]) {
    return Promise.all(lineupCardIds.map(async (cardId: number) => {
      const ownedCard = await this.storage.getPlayerCardWithPlayer(cardId, entry.userId);
      if (ownedCard) return ownedCard;

      // Ownership was validated and the card was locked when this lineup was
      // submitted. Historical scoring must follow that immutable submitted ID,
      // even if a later ownership repair made marketplace visibility disagree.
      const submittedCard = await this.storage.getPlayerCard(cardId);
      const submittedPlayer = submittedCard?.playerId
        ? await this.storage.getPlayer(Number(submittedCard.playerId))
        : undefined;
      if (!submittedCard || !submittedPlayer) {
        console.error(`[scoring] Submitted card ${cardId} is missing its player for tournament entry ${entry.id}; its points cannot be verified.`);
        return null;
      }

      console.warn(`[scoring] Recovered immutable submitted card ${cardId} for entry ${entry.id} after its current ownership no longer matched the original entrant.`);
      return { ...submittedCard, player: submittedPlayer };
    }));
  }

  private buildCardScores(cards: any[], identityMap: IdentityMap, playerStatsMap: Map<any, any>, detailedContext: DetailedScoringContext) {
    return cards.map((card) => {
      if (!card?.player) return this.zeroScore(card);
      const elementId = this.resolveFplElementId(card.player, identityMap);
      const officialElement = elementId ? identityMap.byId.get(elementId) : null;
      if (!officialElement) return this.zeroScore(card, 0, `${String(card.player.name || "This player")} could not be matched securely to an official Premier League player.`);
      const fplStats = elementId ? playerStatsMap.get(elementId) : undefined;
      if (!fplStats) return this.zeroScore(card, elementId, "Official gameweek statistics have not been published for this verified player yet.");
      const canonical = identityMap.canonical(officialElement);
      const verifiedPlayer = { ...card.player, ...canonical };
      const detailedStats = resolveDetailedStatsForPlayer(verifiedPlayer, detailedContext);
      const combinedStats = mergePlayerStatsWithDetailedStats(fplStats, detailedStats);
      const verifiedPosition = String(canonical.position || (detailedStats as any)?.api_position || card.player.position || "MID");
      const score = calculatePlayerScore(combinedStats, verifiedPosition);
      return {
        ...score,
        card_id: card.id,
        player_id: card.playerId,
        element_id: elementId,
        api_player_id: Number((detailedStats as any)?.api_player_id || 0),
        identity_status: "verified",
        identity_message: `Verified official Premier League player: ${canonical.name}.`,
        identity_provider: detailedStats ? "api-football+fpl" : "fpl-fallback",
        official_player_name: canonical.name,
        official_team: canonical.team,
        official_position: verifiedPosition,
        minutes_played: Number(combinedStats.minutes || 0),
      };
    });
  }

  private async persistCardScores(cards: any[], cardScores: any[], bootstrapElementById: Map<number, any>, final: boolean) {
    await Promise.all(cardScores.map(async (score: any, index: number) => {
      const card = cards[index];
      if (!card?.id || !score?.element_id) return;
      const element = bootstrapElementById.get(Number(score.element_id));
      if (!element) return;
      const xp = this.calculateXpFromElement(element);
      const level = this.levelFromXp(xp);
      const latestScore = Math.max(0, Math.min(100, Number(score.total_score || 0)));
      const storedCardScore = Math.round(latestScore);
      const updates: Record<string, any> = { xp, level, decisiveScore: storedCardScore };
      if (final) updates.last5Scores = this.nextLast5Scores(card.last5Scores, latestScore);
      const currentLast5 = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)) : [];
      const unchanged = Number(card.xp || 0) === xp
        && Number(card.level || 1) === level
        && Number(card.decisiveScore || 35) === storedCardScore
        && (!final || JSON.stringify(currentLast5) === JSON.stringify(updates.last5Scores));
      if (!unchanged) await this.storage.updatePlayerCard(card.id, updates);
    }));
  }

  private eventForGameweek(bootstrap: any, gameWeek: number) {
    return (Array.isArray(bootstrap?.events) ? bootstrap.events : []).find((event: any) => Number(event?.id) === Number(gameWeek));
  }

  private fixturesForGameweek(fixtures: any[], gameWeek: number) {
    return (Array.isArray(fixtures) ? fixtures : []).filter((fixture: any) => Number(fixture?.event) === Number(gameWeek));
  }

  private entryDeadline(competition: any, event: any, fixtures: any[]) {
    const eventDeadline = event?.deadline_time ? new Date(String(event.deadline_time)) : null;
    if (eventDeadline && Number.isFinite(eventDeadline.getTime())) return eventDeadline;
    const kickoffs = this.fixturesForGameweek(fixtures, Number(competition?.gameWeek || competition?.game_week || 0))
      .map((fixture: any) => fixture?.kickoff_time ? new Date(String(fixture.kickoff_time)) : null)
      .filter((date: Date | null): date is Date => Boolean(date && Number.isFinite(date.getTime())))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    if (kickoffs[0]) return kickoffs[0];
    return new Date(String(competition?.startDate || competition?.start_date || 0));
  }

  private settlementDeadline(competition: any): Date | null {
    const raw = competition?.settlementAt || competition?.endDate || competition?.end_date;
    if (!raw) return null;
    const settlement = new Date(String(raw));
    return Number.isFinite(settlement.getTime()) ? settlement : null;
  }

  private isSettlementFinal(competition: any) {
    const settlement = this.settlementDeadline(competition);
    return Boolean(settlement && Date.now() >= settlement.getTime());
  }

  private currentOrNextGameweek(bootstrap: any) {
    const events = Array.isArray(bootstrap?.events) ? bootstrap.events : [];
    const event = events.find((row: any) => row?.is_current) || events.find((row: any) => row?.is_next) || [...events].reverse().find((row: any) => row?.finished);
    return Math.max(1, Number(event?.id || 1));
  }

  private async setCompetitionStatus(competitionId: number, status: "open" | "closed") {
    if (status === "open") await db.execute(sql`update app.competitions set status = 'open' where id = ${competitionId} and status::text not in ('completed','cancelled')`);
    if (status === "closed") await db.execute(sql`update app.competitions set status = 'closed' where id = ${competitionId} and status::text in ('open','active')`);
  }

  private async activateCompetitionAtDeadline(competition: any): Promise<string> {
    const updated = rowsOf(await db.execute(sql`
      UPDATE app.competitions
      SET status = 'active'
      WHERE id = ${Number(competition.id)}
        AND status = 'open'
        AND start_date <= now()
      RETURNING status::text AS status
    `))[0];
    const current = updated || rowsOf(await db.execute(sql`
      SELECT status::text AS status
      FROM app.competitions
      WHERE id = ${Number(competition.id)}
      LIMIT 1
    `))[0];
    competition.status = current?.status || competition.status;
    return String(competition.status || "");
  }

  private scoringSnapshot(entry: any, cards: any[], cardScores: any[], gameWeek: number, final: boolean, settlementAt: Date | null) {
    const captainId = Number(entry?.captainId || 0);
    const captainScore = cardScores.find((score: any) => Number(score?.card_id || 0) === captainId);
    const baseTotal = Math.round(cardScores.reduce((sum: number, score: any) => sum + toNumber(score?.total_score), 0) * 10000) / 10000;
    const totalScore = calculateLineupScore(cardScores, captainId);
    const footballMetrics = cardScores.reduce((totals: any, score: any) => {
      const metrics = score?.football_metrics || {};
      totals.providerRatingTotal += toNumber(metrics.match_rating);
      totals.goalsScored += toNumber(metrics.goals);
      totals.assists += toNumber(metrics.assists);
      totals.keyPasses += toNumber(metrics.key_passes);
      totals.shotsOnTarget += toNumber(metrics.shots_on_target);
      totals.defensiveActions += toNumber(metrics.defensive_actions);
      totals.goalkeeperSaves += toNumber(metrics.goalkeeper_saves);
      totals.completedPasses += toNumber(metrics.completed_passes);
      totals.minutesPlayed += toNumber(metrics.minutes);
      return totals;
    }, {
      providerRatingTotal: 0,
      goalsScored: 0,
      assists: 0,
      keyPasses: 0,
      shotsOnTarget: 0,
      defensiveActions: 0,
      goalkeeperSaves: 0,
      completedPasses: 0,
      minutesPlayed: 0,
    });
    const unresolvedCardIds = cardScores
      .filter((score: any) => Number(score?.element_id || 0) <= 0 || String(score?.identity_status || "") !== "verified")
      .map((score: any) => Number(score?.card_id || 0))
      .filter(Boolean);
    const complete = cards.length === 5 && cardScores.length === 5 && unresolvedCardIds.length === 0;
    const updatedAt = new Date().toISOString();
    const detailedStatsCards = cardScores.filter((score: any) => score?.data_source === "official-fpl-plus-api-football").length;
    const fallbackStatsCards = cardScores.length - detailedStatsCards;
    return {
      version: 4,
      source: detailedStatsCards > 0 ? "official-fpl-plus-api-football" : "official-fpl-fallback",
      scoringMethod: "FPL core events plus API-Football detailed actions; ICT/BPS fallback is used only when detailed actions are unavailable",
      detailedStatsCards,
      fallbackStatsCards,
      competition: "premier-league-only",
      fixturePolicy: "Only Premier League FPL points recorded before the configured Tuesday settlement cutoff count. Cup matches and later fixtures are excluded.",
      gameWeek,
      updatedAt,
      finalizedAt: final ? updatedAt : null,
      settlementAt: settlementAt?.toISOString() || null,
      final,
      complete,
      captainId,
      captainMultiplier: 1.1,
      baseTotal,
      captainBasePoints: toNumber(captainScore?.total_score),
      scoringPrecision: 4,
      providerRatingTotal: Math.round(footballMetrics.providerRatingTotal * 10000) / 10000,
      goalsScored: footballMetrics.goalsScored,
      assists: footballMetrics.assists,
      keyPasses: footballMetrics.keyPasses,
      shotsOnTarget: footballMetrics.shotsOnTarget,
      defensiveActions: footballMetrics.defensiveActions,
      goalkeeperSaves: footballMetrics.goalkeeperSaves,
      completedPasses: footballMetrics.completedPasses,
      minutesPlayed: footballMetrics.minutesPlayed,
      captainBonus: Math.round((totalScore - baseTotal) * 10000) / 10000,
      totalScore,
      squadValue: Math.round(cards.reduce((sum: number, card: any) => sum + this.cardValue(card), 0) * 100) / 100,
      totalXp: cards.reduce((sum: number, card: any) => sum + toNumber(card?.xp), 0),
      rarityPrestige: cards.reduce((sum: number, card: any) => sum + (RARITY_PRESTIGE[String(card?.rarity || "common").toLowerCase()] || 1), 0),
      unresolvedCardIds,
      cardScores: cardScores.map((score: any) => ({
        cardId: Number(score?.card_id || 0),
        playerId: Number(score?.player_id || 0),
        elementId: Number(score?.element_id || 0),
        apiFootballPlayerId: Number(score?.api_player_id || 0),
        dataSource: score?.data_source || "official-fpl-fallback",
        score: toNumber(score?.total_score),
        breakdown: score?.breakdown || null,
        footballMetrics: score?.football_metrics || null,
        identityStatus: String(score?.identity_status || "identity-unlinked"),
        identityMessage: String(score?.identity_message || "Player identity has not been verified."),
        identityProvider: score?.identity_provider || null,
        officialPlayerName: String(score?.official_player_name || ""),
        officialTeam: String(score?.official_team || ""),
        officialPosition: String(score?.official_position || ""),
        minutesPlayed: Number(score?.minutes_played || 0),
        reasons: Array.isArray(score?.reasons) ? score.reasons : [],
      })),
    };
  }

  private async scoreCompetitionEntries(competition: any, bootstrap: any, liveData: any, final: boolean, persistCards: boolean): Promise<CompetitionScoreResult> {
    const gameWeek = Number(competition?.gameWeek || competition?.game_week || 0);
    if (!gameWeek) throw new Error("Competition gameweek is missing");
    if (!Array.isArray(liveData?.elements)) throw new Error(`FPL live data unavailable for GW${gameWeek}`);

    const playerStatsMap = new Map();
    const bootstrapElementById = new Map<number, any>();
    const identityMap = this.buildFplIdentityMap(bootstrap);
    const settlementAt = this.settlementDeadline(competition);
    const detailedContext = await loadDetailedScoringContext(bootstrap, gameWeek);
    for (const element of bootstrap?.elements || []) bootstrapElementById.set(Number(element.id), element);
    for (const element of liveData.elements || []) playerStatsMap.set(Number(element.id), mapFplStatsToPlayerStats(element));

    const entries = await this.storage.getCompetitionEntries(competition.id);
    let updatedCount = 0;
    let allComplete = true;
    const unresolved = new Set<number>();

    for (const entry of entries) {
      try {
        const previousSnapshot = asObject(asObject(entry?.tiebreakMeta).scoring);
        const immutableFinal = Number(previousSnapshot.version || 0) >= 2
          && Number(previousSnapshot.gameWeek || 0) === gameWeek
          && previousSnapshot.final === true
          && previousSnapshot.complete === true;
        if (immutableFinal) {
          for (const id of Array.isArray(previousSnapshot.unresolvedCardIds) ? previousSnapshot.unresolvedCardIds : []) unresolved.add(Number(id));
          updatedCount += 1;
          continue;
        }

        const lineupCardIds = Array.isArray(entry?.lineupCardIds) ? entry.lineupCardIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0) : [];
        const cards = (await this.loadSubmittedLineupCards(entry, lineupCardIds)).filter(Boolean);
        const resolvedCardIds = new Set(cards.map((card: any) => Number(card?.id || 0)));
        const missingCardIds = lineupCardIds.filter((cardId: number) => !resolvedCardIds.has(cardId));
        missingCardIds.forEach((cardId: number) => unresolved.add(cardId));
        const cardScores = this.buildCardScores(cards, identityMap, playerStatsMap, detailedContext);
        const previousScoresByCard = new Map<number, any>(
          (Array.isArray(previousSnapshot.cardScores) ? previousSnapshot.cardScores : [])
            .map((score: any) => [Number(score?.cardId || 0), score]),
        );
        const recoveredScores = cardScores.filter((score: any) => {
          const previous = previousScoresByCard.get(Number(score?.card_id || 0));
          return previous && toNumber(previous.score) <= 0 && toNumber(score?.total_score) > 0 && toNumber(score?.minutes_played) > 0;
        });
        if (recoveredScores.length > 0) {
          console.info(`[scoring] Recovered verified player points for entry ${entry.id}: ${recoveredScores.map((score: any) => `${score.official_player_name} (${score.minutes_played} min, ${score.total_score} pts)`).join("; ")}`);
        }
        for (const score of cardScores) {
          if (String(score?.identity_status || "") === "verified") continue;
          const previous = previousScoresByCard.get(Number(score?.card_id || 0));
          if (String(previous?.identityStatus || "") !== String(score?.identity_status || "")) {
            console.warn(`[scoring] Card ${Number(score?.card_id || 0)} cannot score: ${String(score?.identity_message || "Official player identity unavailable.")}`);
          }
        }
        const snapshot = this.scoringSnapshot(entry, cards, cardScores, gameWeek, final, settlementAt);
        if (missingCardIds.length > 0) {
          snapshot.unresolvedCardIds = [...new Set([...snapshot.unresolvedCardIds, ...missingCardIds])];
          snapshot.complete = false;
          allComplete = false;
          if (previousSnapshot.complete === true && Number(previousSnapshot.gameWeek || 0) === gameWeek) {
            console.error(`[scoring] Preserving the last complete verified score for entry ${entry.id}; submitted cards ${missingCardIds.join(", ")} could not be loaded.`);
            updatedCount += 1;
            continue;
          }
        }
        snapshot.unresolvedCardIds.forEach((id: number) => unresolved.add(id));
        if (!snapshot.complete) allComplete = false;
        if (persistCards) await this.persistCardScores(cards, cardScores, bootstrapElementById, final);
        await this.storage.updateCompetitionEntry(entry.id, {
          totalScore: snapshot.totalScore,
          tiebreakMeta: { ...asObject(entry?.tiebreakMeta), scoring: snapshot },
        });
        updatedCount += 1;
      } catch (error) {
        allComplete = false;
        console.error(`Failed to update entry ${entry.id}:`, error);
      }
    }

    return {
      updatedCount,
      totalEntries: entries.length,
      gameWeek,
      final,
      complete: updatedCount === entries.length && allComplete && unresolved.size === 0,
      unresolvedCardIds: [...unresolved],
    };
  }

  startAutoUpdates() {
    if (this.updateInterval) { console.log("Score updates already running"); return; }
    console.log(`🔄 Starting automatic Premier League score updates (every ${SCORE_REFRESH_INTERVAL_MS / 1000} seconds; concurrent updates are deduplicated)`);
    const runScheduledUpdate = async (label: string) => {
      if (this.scheduledUpdateInFlight) return;
      this.scheduledUpdateInFlight = true;
      try {
        await this.updateAllActiveCompetitions();
      } catch (error) {
        console.error(`${label} score update failed:`, error);
      } finally {
        this.scheduledUpdateInFlight = false;
      }
    };
    void runScheduledUpdate("Initial");
    this.updateInterval = setInterval(() => void runScheduledUpdate("Scheduled"), SCORE_REFRESH_INTERVAL_MS);
  }

  stopAutoUpdates() { if (this.updateInterval) { clearInterval(this.updateInterval); this.updateInterval = null; console.log("⏹️ Stopped automatic score updates"); } }

  async updateAllActiveCompetitions() {
    try {
      const competitions = await this.storage.getCompetitions();
      const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);
      const currentGameweek = this.currentOrNextGameweek(bootstrap);
      const now = Date.now();
      const toScore: Array<{ competition: any; final: boolean }> = [];

      for (const competition of competitions) {
        const gameWeek = Number(competition?.gameWeek || competition?.game_week || 0);
        if (!gameWeek || ["completed", "cancelled"].includes(String(competition?.status || ""))) continue;
        const event = this.eventForGameweek(bootstrap, gameWeek);
        const deadline = this.entryDeadline(competition, event, fixtures);
        const startTime = new Date(String(competition?.startDate || competition?.start_date || 0)).getTime();
        const final = this.isSettlementFinal(competition);
        let status = String(competition?.status || "upcoming");

        if (status === "upcoming" && Number.isFinite(startTime) && now >= startTime) {
          await this.setCompetitionStatus(Number(competition.id), "open");
          status = "open";
          competition.status = "open";
        }
        if (status === "open" && now >= deadline.getTime()) {
          status = await this.activateCompetitionAtDeadline(competition);
        }
        if (status === "active" || (status === "closed" && final)) {
          toScore.push({ competition: { ...competition, status }, final });
        }
      }

      if (!toScore.length) { console.log(`No Premier League competitions require scoring (current/next GW${currentGameweek})`); return; }
      console.log(`📊 Updating ${toScore.length} Premier League competitions without resetting historical scores...`);

      const liveByGameweek = new Map<number, Promise<any>>();
      const liveFor = (gameWeek: number) => {
        if (!liveByGameweek.has(gameWeek)) liveByGameweek.set(gameWeek, fplApi.getLiveGameweek(gameWeek));
        return liveByGameweek.get(gameWeek)!;
      };

      let updatedEntries = 0;
      for (const item of toScore) {
        const gameWeek = Number(item.competition?.gameWeek || item.competition?.game_week || 0);
        const persistCards = item.final || gameWeek === currentGameweek;
        const result = await this.scoreCompetitionEntries(item.competition, bootstrap, await liveFor(gameWeek), item.final, persistCards);
        updatedEntries += result.updatedCount;
        if (item.final && result.complete) await this.setCompetitionStatus(Number(item.competition.id), "closed");
      }
      console.log(`✅ Updated ${updatedEntries} tournament entries; Tuesday-finalized snapshots remain immutable.`);
    } catch (error) { console.error("Failed to update competition scores:", error); throw error; }
  }

  async updateCompetition(competitionId: number): Promise<CompetitionScoreResult> {
    const comp = await this.storage.getCompetition(competitionId);
    if (!comp) throw new Error(`Competition ${competitionId} not found`);
    if (String(comp.status) === "completed") {
      const entries = await this.storage.getCompetitionEntries(comp.id);
      return { updatedCount: 0, totalEntries: entries.length, gameWeek: Number(comp.gameWeek || 0), final: true, complete: true, unresolvedCardIds: [], skipped: true, reason: "Tournament already completed" };
    }
    if (String(comp.status) === "cancelled") throw new Error(`Competition ${competitionId} is cancelled`);

    const gameWeek = Number(comp.gameWeek || comp.game_week || 0);
    const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixturesLive()]);
    const event = this.eventForGameweek(bootstrap, gameWeek);
    const deadline = this.entryDeadline(comp, event, fixtures);
    if (["open", "upcoming"].includes(String(comp.status)) && Date.now() < deadline.getTime()) {
      const entries = await this.storage.getCompetitionEntries(comp.id);
      return { updatedCount: 0, totalEntries: entries.length, gameWeek, final: false, complete: false, unresolvedCardIds: [], skipped: true, reason: "Tournament entries are still open" };
    }
    if (String(comp.status) === "upcoming") {
      await this.setCompetitionStatus(Number(comp.id), "open");
      comp.status = "open";
    }
    if (String(comp.status) === "open") {
      await this.activateCompetitionAtDeadline(comp);
    }
    if (!["active", "closed"].includes(String(comp.status))) throw new Error(`Competition ${competitionId} cannot be scored (status: ${comp.status})`);

    const final = this.isSettlementFinal(comp);
    const currentGameweek = this.currentOrNextGameweek(bootstrap);
    const result = await this.scoreCompetitionEntries(comp, bootstrap, await fplApi.getLiveGameweek(gameWeek), final, final || gameWeek === currentGameweek);
    if (final && result.complete) await this.setCompetitionStatus(Number(comp.id), "closed");
    return result;
  }
}
