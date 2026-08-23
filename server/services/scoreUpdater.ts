/**
 * Premier League tournament scoring and lifecycle service.
 *
 * Integrity rules:
 * - Entry windows close at the FPL deadline / first Premier League kickoff.
 * - Only official Premier League FPL data for the selected gameweek is scored.
 * - Scores freeze at the configured Tuesday settlement cutoff and never change afterwards.
 * - FA Cup matches and Premier League fixtures played after the settlement cutoff do not count.
 * - Historical competition scores are never reset when the current gameweek changes.
 * - Every entry receives a gameweek-specific immutable scoring snapshot in tiebreak_meta.
 * - Captain bonus is applied once, to the lineup total only.
 */

import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { fplApi } from "./fplApi.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats, calculateLineupScore } from "./scoring.js";

const RARITY_PRESTIGE: Record<string, number> = { common: 1, rare: 3, epic: 7, unique: 15, legendary: 30 };

type IdentityMap = { byNameTeam: Map<string, number>; byWebTeam: Map<string, number> };

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

  constructor(storage: any) { this.storage = storage; }
  isAutoUpdateEnabled() { return Boolean(this.updateInterval); }

  private zeroScore(card: any, elementId = 0) {
    return { card_id: card?.id || 0, player_id: card?.playerId || 0, element_id: elementId, total_score: 0, breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 }, reasons: [], is_all_around: false };
  }

  private normalize(text: string) { return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }

  private buildFplIdentityMap(bootstrap: any): IdentityMap {
    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
    const teamNameById = new Map<number, string>();
    for (const team of teams) teamNameById.set(Number(team.id), this.normalize(String(team.name || team.short_name || "")));
    const byNameTeam = new Map<string, number>();
    const byWebTeam = new Map<string, number>();
    for (const element of elements) {
      const teamNorm = teamNameById.get(Number(element.team)) || "";
      const fullName = this.normalize(`${String(element.first_name || "")} ${String(element.second_name || "")}`);
      const webName = this.normalize(String(element.web_name || ""));
      if (fullName && teamNorm) byNameTeam.set(`${fullName}::${teamNorm}`, Number(element.id));
      if (webName && teamNorm) byWebTeam.set(`${webName}::${teamNorm}`, Number(element.id));
    }
    return { byNameTeam, byWebTeam };
  }

  private resolveFplElementId(player: any, identityMap: IdentityMap) {
    const explicit = Number(player?.externalId || player?.fplId || 0);
    if (explicit > 0) return explicit;
    const teamNorm = this.normalize(String(player?.team || ""));
    const nameNorm = this.normalize(String(player?.name || player?.webName || ""));
    if (!teamNorm || !nameNorm) return 0;
    return identityMap.byNameTeam.get(`${nameNorm}::${teamNorm}`) || identityMap.byWebTeam.get(`${nameNorm}::${teamNorm}`) || 0;
  }

  private calculateXpFromElement(element: any) { return Number(element?.goals_scored || 0) * 45 + Number(element?.assists || 0) * 28 + Number(element?.starts || 0) * 12 + Math.floor(Number(element?.minutes || 0) / 20); }
  private levelFromXp(xp: number) { return Math.max(1, Math.floor(Math.max(0, xp) / 2000) + 1); }
  private nextLast5Scores(existing: any, nextScore: number) { const previous = Array.isArray(existing) ? existing.map((v: any) => Number(v || 0)) : []; if (previous.length > 0 && previous[previous.length - 1] === nextScore) return previous.slice(-5); return [...previous.slice(-4), nextScore]; }

  private cardValue(card: any) {
    const explicit = toNumber(card?.price);
    if (explicit > 0) return explicit;
    const fplCost = toNumber(card?.player?.nowCost);
    if (fplCost > 0) return fplCost;
    return toNumber(card?.player?.overall, 50);
  }

  private buildCardScores(cards: any[], identityMap: IdentityMap, playerStatsMap: Map<any, any>) {
    return cards.map((card) => {
      if (!card?.player) return this.zeroScore(card);
      const elementId = this.resolveFplElementId(card.player, identityMap);
      const fplStats = elementId ? playerStatsMap.get(elementId) : undefined;
      if (!fplStats) return this.zeroScore(card, elementId);
      const score = calculatePlayerScore(fplStats, card.player.position);
      return { ...score, card_id: card.id, player_id: card.playerId, element_id: elementId };
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
    const baseTotal = cardScores.reduce((sum: number, score: any) => sum + toNumber(score?.total_score), 0);
    const totalScore = calculateLineupScore(cardScores, captainId);
    const unresolvedCardIds = cardScores.filter((score: any) => Number(score?.element_id || 0) <= 0).map((score: any) => Number(score?.card_id || 0)).filter(Boolean);
    const complete = cards.length === 5 && cardScores.length === 5 && unresolvedCardIds.length === 0;
    const updatedAt = new Date().toISOString();
    return {
      version: 3,
      source: "official-fpl-live",
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
      captainBonus: Math.round((totalScore - baseTotal) * 100) / 100,
      totalScore,
      squadValue: Math.round(cards.reduce((sum: number, card: any) => sum + this.cardValue(card), 0) * 100) / 100,
      totalXp: cards.reduce((sum: number, card: any) => sum + toNumber(card?.xp), 0),
      rarityPrestige: cards.reduce((sum: number, card: any) => sum + (RARITY_PRESTIGE[String(card?.rarity || "common").toLowerCase()] || 1), 0),
      unresolvedCardIds,
      cardScores: cardScores.map((score: any) => ({
        cardId: Number(score?.card_id || 0),
        playerId: Number(score?.player_id || 0),
        elementId: Number(score?.element_id || 0),
        score: toNumber(score?.total_score),
        breakdown: score?.breakdown || null,
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
        const cards = (await Promise.all(lineupCardIds.map((cardId: number) => this.storage.getPlayerCardWithPlayer(cardId, entry.userId)))).filter(Boolean);
        const cardScores = this.buildCardScores(cards, identityMap, playerStatsMap);
        const snapshot = this.scoringSnapshot(entry, cards, cardScores, gameWeek, final, settlementAt);
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
    console.log("🔄 Starting automatic Premier League score updates (every 5 minutes)");
    this.updateAllActiveCompetitions().catch(err => console.error("Initial score update failed:", err));
    this.updateInterval = setInterval(() => this.updateAllActiveCompetitions().catch(err => console.error("Scheduled score update failed:", err)), 5 * 60 * 1000);
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
