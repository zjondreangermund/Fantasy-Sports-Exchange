/**
 * Premier League tournament scoring and lifecycle service.
 *
 * Integrity rules:
 * - Entry windows close at the FPL deadline / first Premier League kickoff.
 * - Verified core match events plus API-Football detailed player actions drive scoring; no ICT/BPS proxy points are used.
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
import { calculatePlayerScore, calculateLineupScore } from "./scoring.js";
import { loadApiFootballGameweekScoringContext, resolveApiFootballGameweekPlayer, type ApiFootballGameweekScoringContext } from "./apiFootballScoringBridge.js";
import { diagnoseApiFootballPlayerMatch } from "./apiFootballPlayerDirectory.js";
import { createNotificationOnce } from "./notifications.js";

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
  private liveAlertSchemaPromise: Promise<void> | null = null;
  private storage: any;
  private updateInterval: NodeJS.Timeout | null = null;
  private scheduledUpdateInFlight = false;
  private identityAuditLogged = new Set<string>();

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

  private buildCardScores(cards: any[], context: ApiFootballGameweekScoringContext) {
    const finishedStatuses = new Set(["FT", "AET", "PEN"]);
    return cards.map((card) => {
      if (!card?.player) return this.zeroScore(card, 0, "Player record is missing.");

      const resolved = resolveApiFootballGameweekPlayer(card.player, context);
      if (!resolved?.player) {
        return this.zeroScore(card, 0, `${String(card.player.name || "This player")} could not be matched securely to the current API-Football Premier League squad directory.`);
      }

      const apiPlayer = resolved.player;
      const fixture = resolved.fixture;
      const stats = resolved.stats;
      const fixtureFinished = Boolean(fixture && finishedStatuses.has(String(fixture.statusShort || "")));

      if (!fixture) {
        return {
          ...this.zeroScore(card, 0, `API-Football fixture for ${apiPlayer.team} is not available for this gameweek yet.`),
          api_player_id: apiPlayer.apiPlayerId,
          official_player_name: apiPlayer.name,
          official_team: apiPlayer.team,
          official_position: apiPlayer.position,
          identity_provider: "api-football",
          identity_status: "awaiting-api-football-fixture",
        };
      }

      if (!stats) {
        if (fixtureFinished && !fixture.statsReady) {
          return {
            ...this.zeroScore(card, 0, `API-Football player statistics for ${apiPlayer.name} are still being synchronized for this completed fixture.`),
            api_player_id: apiPlayer.apiPlayerId,
            official_player_name: apiPlayer.name,
            official_team: apiPlayer.team,
            official_position: apiPlayer.position,
            identity_provider: "api-football",
            identity_status: "awaiting-api-football-stats",
          };
        }

        // If the fixture is complete and its player feed is fully synchronized,
        // absence from /fixtures/players means the player did not take part.
        // Upcoming fixtures also correctly remain on zero until the player appears.
        return {
          ...this.zeroScore(card, 0, fixtureFinished
            ? `API-Football verified ${apiPlayer.name} did not appear in this gameweek fixture.`
            : `API-Football verified ${apiPlayer.name}; awaiting this gameweek appearance.`),
          api_player_id: apiPlayer.apiPlayerId,
          data_source: "verified-player-stats",
          identity_status: "verified",
          identity_message: fixtureFinished
            ? `API-Football verified Premier League player; no appearance recorded for GW${context.gameWeek}.`
            : `API-Football verified Premier League player; fixture has not produced player statistics yet.`,
          identity_provider: "api-football",
          official_player_name: apiPlayer.name,
          official_team: apiPlayer.team,
          official_position: apiPlayer.position,
          minutes_played: 0,
        };
      }

      const score = calculatePlayerScore(stats, apiPlayer.position);
      const identityReady = !fixtureFinished || fixture.statsReady;
      return {
        ...score,
        card_id: card.id,
        player_id: card.playerId,
        element_id: 0,
        api_player_id: apiPlayer.apiPlayerId,
        identity_status: identityReady ? "verified" : "awaiting-api-football-stats",
        identity_message: identityReady
          ? `Verified API-Football Premier League player statistics: ${apiPlayer.name}.`
          : `API-Football has live/partial statistics for ${apiPlayer.name}; waiting for the completed fixture feed before finalization.`,
        identity_provider: "api-football",
        official_player_name: apiPlayer.name,
        official_team: apiPlayer.team,
        official_position: apiPlayer.position,
        minutes_played: Number(stats.minutes || 0),
      };
    });
  }

  private async persistCardScores(cards: any[], cardScores: any[], final: boolean) {
    await Promise.all(cardScores.map(async (score: any, index: number) => {
      const card = cards[index];
      if (!card?.id || Number(score?.api_player_id || 0) <= 0) return;
      const latestScore = Math.max(0, Math.min(100, Number(score.total_score || 0)));
      const storedCardScore = Math.round(latestScore);
      // Tournament points are API-Football-only. Do not derive XP from FPL here.
      const updates: Record<string, any> = { decisiveScore: storedCardScore };
      if (final) updates.last5Scores = this.nextLast5Scores(card.last5Scores, latestScore);
      const currentLast5 = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)) : [];
      const unchanged = Number(card.decisiveScore || 35) === storedCardScore
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

  private fixtureIsFinished(fixture: any) {
    if (fixture?.finished === true || fixture?.finished_provisional === true) return true;
    const kickoff = fixture?.kickoff_time ? new Date(String(fixture.kickoff_time)).getTime() : 0;
    return Boolean(fixture?.started) && kickoff > 0 && Date.now() - kickoff >= 3 * 60 * 60 * 1000;
  }

  private async sendDeciderAlerts(competition: any, bootstrap: any, fixtures: any[]) {
    const competitionId = Number(competition?.id || 0);
    const gameWeek = Number(competition?.gameWeek || competition?.game_week || 0);
    if (!competitionId || !gameWeek || String(competition?.status || "") !== "active") return;
    const gameweekFixtures = this.fixturesForGameweek(fixtures, gameWeek);
    const remaining = gameweekFixtures.filter((fixture: any) => !this.fixtureIsFinished(fixture));
    if (gameweekFixtures.length === 0 || remaining.length !== 1) return;
    const fixture = remaining[0];
    const fixtureId = Number(fixture?.id || 0);
    const teamIds = new Set([Number(fixture?.team_h || 0), Number(fixture?.team_a || 0)].filter(Boolean));
    if (!fixtureId || teamIds.size !== 2) return;

    const elementTeam = new Map<number, number>();
    for (const element of Array.isArray(bootstrap?.elements) ? bootstrap.elements : []) elementTeam.set(Number(element?.id || 0), Number(element?.team || 0));
    const teamName = new Map<number, string>();
    for (const team of Array.isArray(bootstrap?.teams) ? bootstrap.teams : []) teamName.set(Number(team?.id || 0), String(team?.short_name || team?.name || "Team"));

    const leaders = rowsOf(await db.execute(sql`
      select ce.id as "entryId", ce.user_id as "userId",
        coalesce(nullif(btrim(u.manager_team_name), ''), nullif(btrim(u.name), ''), split_part(coalesce(u.email, ''), '@', 1), 'Arena Manager') as "teamName",
        coalesce(ce.total_score, 0)::float as "totalScore",
        coalesce(ce.tiebreak_meta->'scoring'->'cardScores', '[]'::jsonb) as "cardScores",
        row_number() over (order by
          coalesce(ce.total_score, 0) desc,
          coalesce(nullif(ce.tiebreak_meta->'scoring'->>'captainBasePoints', '')::float, 0) desc,
          coalesce(nullif(ce.tiebreak_meta->'scoring'->>'goalsScored', '')::float, 0) desc,
          coalesce(nullif(ce.tiebreak_meta->'scoring'->>'assists', '')::float, 0) desc,
          ce.joined_at asc, ce.id asc
        )::int as rank
      from app.competition_entries ce
      left join app.users u on u.id = ce.user_id
      where ce.competition_id = ${competitionId}
      order by rank asc limit 3
    `));
    if (leaders.length < 2) return;
    const involvedNames = (leader: any) => (Array.isArray(leader?.cardScores) ? leader.cardScores : [])
      .filter((card: any) => teamIds.has(elementTeam.get(Number(card?.elementId || 0)) || 0))
      .map((card: any) => String(card?.officialPlayerName || "").trim()).filter(Boolean);
    const involvedByUser = new Map<string, string[]>(leaders.map((leader: any) => [String(leader.userId), involvedNames(leader)]));
    if (![...involvedByUser.values()].some((names) => names.length > 0)) return;

    const leader = leaders[0];
    const fixtureLabel = `${teamName.get(Number(fixture.team_h)) || "Home"} vs ${teamName.get(Number(fixture.team_a)) || "Away"}`;
    const tournamentName = String(competition?.name || `GW${gameWeek} tournament`);
    for (const recipient of leaders) {
      const rank = Number(recipient.rank || 0);
      const ownPlayers = involvedByUser.get(String(recipient.userId)) || [];
      const gap = Math.max(0, Number(leader.totalScore || 0) - Number(recipient.totalScore || 0));
      const playerText = ownPlayers.length ? ` ${ownPlayers.join(" & ")} ${ownPlayers.length === 1 ? "is" : "are"} still to play.` : " A rival still has a player to play.";
      const title = rank === 1 ? "👑 Your lead is under threat!" : rank === 2 ? "👀 One match could change everything" : "🔥 The podium fight isn't over";
      const message = rank === 1
        ? `You lead ${String(leaders[1]?.teamName || "P2")} by ${(Number(recipient.totalScore || 0) - Number(leaders[1]?.totalScore || 0)).toFixed(2)} pts in ${tournamentName}.${playerText} Final fixture: ${fixtureLabel}.`
        : `You're ${gap.toFixed(2)} pts behind ${String(leader.teamName || "P1")} in ${tournamentName}.${playerText} Final fixture: ${fixtureLabel}.`;
      await createNotificationOnce(db, { userId: String(recipient.userId), title, message, dedupeKey: `competition:${competitionId}:decider:${fixtureId}` });
    }
  }

  private async sendLiveLeaderboardImpactAlerts(competition:any){
    const competitionId=Number(competition?.id||0);
    if(!competitionId||String(competition?.status||"")!=="active")return;
    if(!this.liveAlertSchemaPromise){
      this.liveAlertSchemaPromise=db.execute(sql`create table if not exists app.competition_live_alert_state(competition_id integer not null references app.competitions(id),entry_id integer not null references app.competition_entries(id),user_id varchar(255) not null references app.users(id),rank integer not null,total_score numeric not null default 0,metrics jsonb not null default '{}'::jsonb,sequence integer not null default 0,updated_at timestamptz not null default now(),primary key(competition_id,entry_id))`).then(()=>undefined).catch((error)=>{this.liveAlertSchemaPromise=null;throw error;});
    }
    await this.liveAlertSchemaPromise;
    const standings=rowsOf(await db.execute(sql`select ce.id as "entryId",ce.user_id as "userId",coalesce(ce.total_score,0)::float as "totalScore",coalesce(ce.tiebreak_meta->'scoring','{}'::jsonb) as scoring,row_number() over(order by coalesce(ce.total_score,0) desc,ce.joined_at asc,ce.id asc)::int as rank from app.competition_entries ce where ce.competition_id=${competitionId} order by rank asc limit 5`));
    for(const row of standings){
      const entryId=Number(row.entryId),rank=Number(row.rank),score=Number(row.totalScore||0),scoring=asObject(row.scoring);
      const metrics={goals:toNumber(scoring.goalsScored),assists:toNumber(scoring.assists),saves:toNumber(scoring.goalkeeperSaves)};
      const previous=rowsOf(await db.execute(sql`select rank,total_score::float as "totalScore",metrics,sequence from app.competition_live_alert_state where competition_id=${competitionId} and entry_id=${entryId}`))[0];
      const old=asObject(previous?.metrics);
      let title="",message="",dedupeKey="";

      if(previous&&Number(previous.rank)!==rank){
        const previousRank=Number(previous.rank);
        const improved=rank<previousRank;
        title=improved?`🚀 You moved up to #${rank}`:`⚠️ You dropped to #${rank}`;
        message=`Your team moved from #${previousRank} to #${rank} in ${String(competition.name||"your tournament")}. Live points are still changing.`;
        // A rank transition is one event. If provider refreshes later replay the
        // same transition, createNotificationOnce suppresses the duplicate.
        dedupeKey=`competition:${competitionId}:entry:${entryId}:rank:${previousRank}->${rank}`;
      } else if(previous&&(metrics.goals>toNumber(old.goals)||metrics.assists>toNumber(old.assists)||Math.floor(metrics.saves/3)>Math.floor(toNumber(old.saves)/3))){
        if(metrics.goals>toNumber(old.goals)){
          title="⚽ Goal — vital points added";
          dedupeKey=`competition:${competitionId}:entry:${entryId}:goal:${metrics.goals}`;
        } else if(metrics.assists>toNumber(old.assists)){
          title="🎯 Assist — your score changed";
          dedupeKey=`competition:${competitionId}:entry:${entryId}:assist:${metrics.assists}`;
        } else {
          title="🧤 Save points added";
          dedupeKey=`competition:${competitionId}:entry:${entryId}:save-tier:${Math.floor(metrics.saves/3)}`;
        }
        message=`Your lineup gained a vital live contribution in ${String(competition.name||"your tournament")}. You are #${rank} on ${score.toFixed(2)} pts.`;
      } else if(previous&&rank<=4&&Number(previous.totalScore)!==score){
        const next=standings[rank]||null;
        const gap=next?score-Number(next.totalScore||0):999;
        const hasGk=(Array.isArray(scoring.cardScores)?scoring.cardScores:[]).some((card:any)=>String(card?.officialPosition||"").toUpperCase()==="GK"&&Number(card?.minutesPlayed||0)>0);
        if(hasGk&&gap>=0&&gap<=4){
          title="🧤 Your position is still at risk";
          message=`You are #${rank}, only ${gap.toFixed(2)} pts ahead in ${String(competition.name||"your tournament")}. Goalkeeper concession and clean-sheet points can still change the table.`;
          // Risk is a state, not a new event on every score-provider refresh.
          // Send it at most once per entry/rank in this competition.
          dedupeKey=`competition:${competitionId}:entry:${entryId}:gk-risk:rank:${rank}`;
        }
      }

      let notificationCreated=false;
      if(title&&dedupeKey){
        const notification=await createNotificationOnce(db,{userId:String(row.userId),type:rank<=3?"runner_up":"system",title,message,dedupeKey});
        notificationCreated=Boolean(notification?.id);
      }
      const sequence=Number(previous?.sequence||0)+(notificationCreated?1:0);
      await db.execute(sql`insert into app.competition_live_alert_state(competition_id,entry_id,user_id,rank,total_score,metrics,sequence,updated_at) values(${competitionId},${entryId},${String(row.userId)},${rank},${score},${JSON.stringify(metrics)}::jsonb,${sequence},now()) on conflict(competition_id,entry_id) do update set rank=excluded.rank,total_score=excluded.total_score,metrics=excluded.metrics,sequence=excluded.sequence,updated_at=now()`);
    }
  }

  private async sendPostScoreAlerts(competition:any,bootstrap:any,fixtures:any[]){
    const competitionId=Number(competition?.id||0);
    try{await this.sendLiveLeaderboardImpactAlerts(competition);}catch(error){console.error(`Live leaderboard alerts failed for competition ${competitionId}; scoring and settlement will continue:`,error);}
    try{await this.sendDeciderAlerts(competition,bootstrap,fixtures);}catch(error){console.error(`Decider alerts failed for competition ${competitionId}; scoring and settlement will continue:`,error);}
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
      .filter((score: any) => Number(score?.api_player_id || 0) <= 0 || String(score?.identity_status || "") !== "verified")
      .map((score: any) => Number(score?.card_id || 0))
      .filter(Boolean);
    const complete = cards.length === 5 && cardScores.length === 5 && unresolvedCardIds.length === 0;
    const updatedAt = new Date().toISOString();
    const detailedStatsCards = cardScores.filter((score: any) => score?.data_source === "verified-player-stats").length;
    const coreStatsOnlyCards = cardScores.length - detailedStatsCards;
    return {
      version: 7,
      source: "api-football-player-stats",
      scoringMethod: "API-Football fixture player statistics only; provider match rating and all FPL/ICT/BPS/fallback points are excluded",
      detailedStatsCards,
      coreStatsOnlyCards,
      competition: "premier-league-only",
      fixturePolicy: "Premier League gameweek fixtures and player actions come from API-Football only. Players who do not appear score zero; incomplete provider feeds remain pending rather than falling back to another source.",
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
        dataSource: score?.data_source || "verified-core-stats",
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

  private async scoreCompetitionEntries(competition: any, apiContext: ApiFootballGameweekScoringContext, final: boolean, persistCards: boolean): Promise<CompetitionScoreResult> {
    const gameWeek = Number(competition?.gameWeek || competition?.game_week || 0);
    if (!gameWeek) throw new Error("Competition gameweek is missing");
    if (!apiContext?.available) throw new Error(`API-Football Premier League fixtures are unavailable for GW${gameWeek}`);

    const settlementAt = this.settlementDeadline(competition);

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
        let cardScores = this.buildCardScores(cards, apiContext);
        const previousScoresByCard = new Map<number, any>(
          (Array.isArray(previousSnapshot.cardScores) ? previousSnapshot.cardScores : [])
            .map((score: any) => [Number(score?.cardId || 0), score]),
        );

        // SCORING_IDENTITY_POINT_PRESERVATION_V1
        // Never make an active team lose already-verified GW points merely
        // because a later provider refresh temporarily cannot re-link the name.
        // The entry stays unresolved (and therefore cannot finalize) until the
        // API identity is healthy again, but its last verified score is retained.
        if (Number(previousSnapshot?.gameWeek || 0) === gameWeek) {
          cardScores = cardScores.map((score: any) => {
            if (String(score?.identity_status || "") === "verified") return score;
            const previous = previousScoresByCard.get(Number(score?.card_id || 0));
            const previousVerified = String(previous?.identityStatus || "") === "verified"
              && Number(previous?.apiFootballPlayerId || 0) > 0;
            if (!previousVerified) return score;
            return {
              ...score,
              total_score: toNumber(previous?.score),
              breakdown: previous?.breakdown || score?.breakdown,
              football_metrics: previous?.footballMetrics || score?.football_metrics,
              reasons: Array.isArray(previous?.reasons) ? previous.reasons : score?.reasons,
              data_source: previous?.dataSource || score?.data_source,
              api_player_id: Number(previous?.apiFootballPlayerId || score?.api_player_id || 0),
              minutes_played: toNumber(previous?.minutesPlayed ?? score?.minutes_played),
              identity_message: `${String(score?.identity_message || "API-Football identity is refreshing.")} Last verified GW${gameWeek} points are being preserved until the link is healthy again.`,
            };
          });
        }

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
          const auditKey = [gameWeek, Number(score?.player_id || 0), String(score?.official_player_name || ""), String(score?.official_team || ""), String(score?.official_position || "")].join(":");
          if (!this.identityAuditLogged.has(auditKey)) {
            this.identityAuditLogged.add(auditKey);
            const sourceCard = cards.find((card: any) => Number(card?.id || 0) === Number(score?.card_id || 0));
            const candidates = sourceCard?.player
              ? diagnoseApiFootballPlayerMatch(sourceCard.player, apiContext.directory)
              : [];
            console.warn(
              `SCORING_IDENTITY_AUDIT gw=${gameWeek} competition=${Number(competition?.id || 0)} entry=${Number(entry?.id || 0)} card=${Number(score?.card_id || 0)} playerId=${Number(score?.player_id || 0)} name="${String(score?.official_player_name || "")}" team="${String(score?.official_team || "")}" position="${String(score?.official_position || "")}" status=${String(score?.identity_status || "identity-unlinked")} message="${String(score?.identity_message || "").replace(/"/g, "'")}" candidates=${JSON.stringify(candidates)}`,
            );
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
        if (persistCards) await this.persistCardScores(cards, cardScores, final);
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

      const apiContextByGameweek = new Map<number, Promise<ApiFootballGameweekScoringContext>>();
      const apiContextFor = (gameWeek: number) => {
        if (!apiContextByGameweek.has(gameWeek)) apiContextByGameweek.set(gameWeek, loadApiFootballGameweekScoringContext(gameWeek));
        return apiContextByGameweek.get(gameWeek)!;
      };

      let updatedEntries = 0;
      for (const item of toScore) {
        const gameWeek = Number(item.competition?.gameWeek || item.competition?.game_week || 0);
        const persistCards = item.final || gameWeek === currentGameweek;
        const result = await this.scoreCompetitionEntries(item.competition, await apiContextFor(gameWeek), item.final, persistCards);
        updatedEntries += result.updatedCount;
        if(!item.final)await this.sendPostScoreAlerts(item.competition,bootstrap,fixtures);
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
    const result = await this.scoreCompetitionEntries(comp, await loadApiFootballGameweekScoringContext(gameWeek), final, final || gameWeek === currentGameweek);
    if(!final)await this.sendPostScoreAlerts(comp,bootstrap,fixtures);
    if (final && result.complete) await this.setCompetitionStatus(Number(comp.id), "closed");
    return result;
  }
}
