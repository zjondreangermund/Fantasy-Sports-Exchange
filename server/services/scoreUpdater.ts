/**
 * Score Update Service
 *
 * Premier League only. Tournament scores reset per gameweek and only update for
 * competitions whose gameWeek matches the current FPL/Premier League gameweek.
 */

import { fplApi } from "./fplApi.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats, calculateLineupScore } from "./scoring.js";

export class ScoreUpdateService {
  private storage: any;
  private updateInterval: NodeJS.Timeout | null = null;
  private lastProcessedGameweek: number | null = null;

  constructor(storage: any) { this.storage = storage; }
  isAutoUpdateEnabled() { return Boolean(this.updateInterval); }

  private zeroScore(card: any, elementId = 0) {
    return { card_id: card?.id || 0, player_id: card?.playerId || 0, element_id: elementId, total_score: 0, breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 }, reasons: [], is_all_around: false };
  }
  private normalize(text: string) { return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  private buildFplIdentityMap(bootstrap: any) {
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
  private resolveFplElementId(player: any, identityMap: { byNameTeam: Map<string, number>; byWebTeam: Map<string, number> }) {
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
  private buildCardScores(cards: any[], identityMap: { byNameTeam: Map<string, number>; byWebTeam: Map<string, number> }, playerStatsMap: Map<any, any>) {
    return cards.map((card) => { if (!card?.player) return this.zeroScore(card); const elementId = this.resolveFplElementId(card.player, identityMap); const fplStats = elementId ? playerStatsMap.get(elementId) : undefined; if (!fplStats) return this.zeroScore(card, elementId); const score = calculatePlayerScore(fplStats, card.player.position); return { ...score, card_id: card.id, player_id: card.playerId, element_id: elementId }; });
  }
  private async persistCardScores(cards: any[], cardScores: any[], bootstrapElementById: Map<number, any>) {
    await Promise.all(cardScores.map(async (score: any, index: number) => {
      const card = cards[index];
      if (!card?.id || !score?.element_id) return;
      const element = bootstrapElementById.get(Number(score.element_id));
      if (!element) return;
      const xp = this.calculateXpFromElement(element);
      const level = this.levelFromXp(xp);
      const latestScore = Math.max(0, Math.min(100, Number(score.total_score || 0)));
      const last5Scores = this.nextLast5Scores(card.last5Scores, latestScore);
      const currentLast5 = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)) : [];
      if (Number(card.xp || 0) === xp && Number(card.level || 1) === level && Number(card.decisiveScore || 35) === latestScore && JSON.stringify(currentLast5) === JSON.stringify(last5Scores)) return;
      await this.storage.updatePlayerCard(card.id, { xp, level, decisiveScore: latestScore, last5Scores });
    }));
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
      const currentGameweek = await fplApi.getCurrentGameweek();
      const activeComps = competitions.filter((c: any) => (c.status === "open" || c.status === "active") && Number(c.gameWeek || c.game_week || 0) === Number(currentGameweek));
      const otherActiveComps = competitions.filter((c: any) => (c.status === "open" || c.status === "active") && Number(c.gameWeek || c.game_week || 0) !== Number(currentGameweek));
      for (const comp of otherActiveComps) {
        const entries = await this.storage.getCompetitionEntries(comp.id);
        for (const entry of entries) await this.storage.updateCompetitionEntry(entry.id, { totalScore: 0 });
      }
      if (this.lastProcessedGameweek !== null && this.lastProcessedGameweek !== currentGameweek) await this.resetForNewGameweek(competitions.filter((c: any) => c.status === "open" || c.status === "active"));
      this.lastProcessedGameweek = currentGameweek;
      if (activeComps.length === 0) { console.log(`No active competitions for Premier League GW${currentGameweek}`); return; }
      console.log(`📊 Updating ${activeComps.length} Premier League GW${currentGameweek} competitions...`);
      const [liveData, bootstrap] = await Promise.all([fplApi.getLiveGameweek(currentGameweek), fplApi.bootstrap()]);
      const playerStatsMap = new Map();
      const bootstrapElementById = new Map<number, any>();
      const identityMap = this.buildFplIdentityMap(bootstrap);
      for (const element of bootstrap?.elements || []) bootstrapElementById.set(Number(element.id), element);
      for (const element of liveData.elements || []) playerStatsMap.set(element.id, mapFplStatsToPlayerStats(element));
      let updatedEntries = 0;
      for (const comp of activeComps) {
        const entries = await this.storage.getCompetitionEntries(comp.id);
        for (const entry of entries) {
          try {
            const cards = await Promise.all((entry.lineupCardIds || []).map((cardId: any) => this.storage.getPlayerCardWithPlayer(cardId, entry.userId)));
            const cardScores = this.buildCardScores(cards, identityMap, playerStatsMap);
            await this.persistCardScores(cards, cardScores, bootstrapElementById);
            await this.storage.updateCompetitionEntry(entry.id, { totalScore: calculateLineupScore(cardScores, entry.captainId || 0) });
            updatedEntries++;
          } catch (err) { console.error(`Failed to update entry ${entry.id}:`, err); }
        }
      }
      console.log(`✅ Updated ${updatedEntries} GW${currentGameweek} entries`);
    } catch (error) { console.error("Failed to update competition scores:", error); throw error; }
  }

  private async resetForNewGameweek(activeComps: any[]) {
    try {
      const touchedCardIds = new Set<number>();
      for (const comp of activeComps) {
        const entries = await this.storage.getCompetitionEntries(comp.id);
        for (const entry of entries) {
          await this.storage.updateCompetitionEntry(entry.id, { totalScore: 0 });
          (Array.isArray(entry?.lineupCardIds) ? entry.lineupCardIds : []).forEach((id: number) => { const value = Number(id); if (Number.isFinite(value) && value > 0) touchedCardIds.add(value); });
        }
      }
      await Promise.all(Array.from(touchedCardIds).map(async (cardId) => this.storage.updatePlayerCard(cardId, { decisiveScore: 0 })));
      console.log(`🔁 New Premier League gameweek reset complete: ${activeComps.length} competitions, ${touchedCardIds.size} cards reset to 0`);
    } catch (error) { console.error("Failed weekly points reset:", error); }
  }

  async updateCompetition(competitionId: number) {
    const comp = await this.storage.getCompetition(competitionId);
    if (!comp) throw new Error(`Competition ${competitionId} not found`);
    const currentGameweek = await fplApi.getCurrentGameweek();
    if (Number(comp.gameWeek || comp.game_week || 0) !== Number(currentGameweek)) {
      const entries = await this.storage.getCompetitionEntries(comp.id);
      for (const entry of entries) await this.storage.updateCompetitionEntry(entry.id, { totalScore: 0 });
      return { updatedCount: 0, totalEntries: entries.length, skipped: true, reason: `Only Premier League GW${currentGameweek} counts now` };
    }
    if (comp.status !== "open" && comp.status !== "active") throw new Error(`Competition ${competitionId} is not active (status: ${comp.status})`);
    const [liveData, bootstrap] = await Promise.all([fplApi.getLiveGameweek(currentGameweek), fplApi.bootstrap()]);
    const playerStatsMap = new Map();
    const bootstrapElementById = new Map<number, any>();
    const identityMap = this.buildFplIdentityMap(bootstrap);
    for (const element of bootstrap?.elements || []) bootstrapElementById.set(Number(element.id), element);
    for (const element of liveData.elements || []) playerStatsMap.set(element.id, mapFplStatsToPlayerStats(element));
    const entries = await this.storage.getCompetitionEntries(comp.id);
    let updatedCount = 0;
    for (const entry of entries) {
      try {
        const cards = await Promise.all((entry.lineupCardIds || []).map((cardId: any) => this.storage.getPlayerCardWithPlayer(cardId, entry.userId)));
        const cardScores = this.buildCardScores(cards, identityMap, playerStatsMap);
        await this.persistCardScores(cards, cardScores, bootstrapElementById);
        await this.storage.updateCompetitionEntry(entry.id, { totalScore: calculateLineupScore(cardScores, entry.captainId || 0) });
        updatedCount++;
      } catch (err) { console.error(`Failed to update entry ${entry.id}:`, err); }
    }
    return { updatedCount, totalEntries: entries.length };
  }
}
