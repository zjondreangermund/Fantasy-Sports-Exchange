/**
 * Score Update Service
 * 
 * Fetches live gameweek data from FPL and updates competition entry scores
 */

import { fplApi } from "./fplApi.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats, calculateLineupScore } from "./scoring.js";
import type { IStorage } from "../storage.js";

export class ScoreUpdateService {
  private storage: any; // Using any to avoid complex type issues
  private updateInterval: NodeJS.Timeout | null = null;
  
  constructor(storage: any) {
    this.storage = storage;
  }

  isAutoUpdateEnabled() {
    return Boolean(this.updateInterval);
  }

  private normalize(text: string) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private buildFplIdentityMap(bootstrap: any) {
    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];

    const teamNameById = new Map<number, string>();
    for (const team of teams) {
      teamNameById.set(Number(team.id), this.normalize(String(team.name || team.short_name || "")));
    }

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
    const explicit = Number(player?.externalId || 0);
    if (explicit > 0) return explicit;

    const teamNorm = this.normalize(String(player?.team || ""));
    const nameNorm = this.normalize(String(player?.name || ""));
    if (!teamNorm || !nameNorm) return 0;

    return (
      identityMap.byNameTeam.get(`${nameNorm}::${teamNorm}`) ||
      identityMap.byWebTeam.get(`${nameNorm}::${teamNorm}`) ||
      0
    );
  }

  private calculateXpFromElement(element: any) {
    const goals = Number(element?.goals_scored || 0);
    const assists = Number(element?.assists || 0);
    const appearances = Number(element?.starts || element?.appearances || 0);
    const minutes = Number(element?.minutes || 0);

    return goals * 45 + assists * 28 + appearances * 12 + Math.floor(minutes / 20);
  }

  private levelFromXp(xp: number) {
    return Math.max(1, Math.floor(Math.max(0, xp) / 2000) + 1);
  }

  private nextLast5Scores(existing: any, nextScore: number) {
    const previous = Array.isArray(existing) ? existing.map((v: any) => Number(v || 0)) : [];
    if (previous.length > 0 && previous[previous.length - 1] === nextScore) {
      return previous.slice(-5);
    }
    return [...previous.slice(-4), nextScore];
  }
  
  /**
   * Start automatic score updates (every 5 minutes during gameweeks)
   */
  startAutoUpdates() {
    if (this.updateInterval) {
      console.log("Score updates already running");
      return;
    }
    
    console.log("🔄 Starting automatic score updates (every 5 minutes)");
    
    // Run immediately
    this.updateAllActiveCompetitions().catch(err => 
      console.error("Initial score update failed:", err)
    );
    
    // Then every 5 minutes
    this.updateInterval = setInterval(() => {
      this.updateAllActiveCompetitions().catch(err =>
        console.error("Scheduled score update failed:", err)
      );
    }, 5 * 60 * 1000);
  }
  
  /**
   * Stop automatic updates
   */
  stopAutoUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log("⏹️ Stopped automatic score updates");
    }
  }
  
  /**
   * Update scores for all active competitions
   */
  async updateAllActiveCompetitions() {
    try {
      const competitions = await this.storage.getCompetitions();
      const activeComps = competitions.filter((c: any) => 
        c.status === "open" || c.status === "active"
      );
      
      if (activeComps.length === 0) {
        console.log("No active competitions to update");
        return;
      }
      
      console.log(`📊 Updating scores for ${activeComps.length} active competitions...`);
      
      // Fetch live gameweek data
      const [liveData, bootstrap] = await Promise.all([
        fplApi.getLiveGameweek(),
        fplApi.bootstrap(),
      ]);
      const playerStatsMap = new Map();
      const bootstrapElementById = new Map<number, any>();
      const identityMap = this.buildFplIdentityMap(bootstrap);

      for (const element of bootstrap?.elements || []) {
        bootstrapElementById.set(Number(element.id), element);
      }
      
      // Build map of FPL player ID -> stats
      for (const element of liveData.elements || []) {
        const stats = mapFplStatsToPlayerStats(element);
        playerStatsMap.set(element.id, stats);
      }
      
      let updatedEntries = 0;
      
      // Update each competition
      for (const comp of activeComps) {
        const entries = await this.storage.getCompetitionEntries(comp.id);
        
        for (const entry of entries) {
          try {
            // Get cards in lineup with player data
            const cards = await Promise.all(
              (entry.lineupCardIds || []).map((cardId: any) =>
                this.storage.getPlayerCardWithPlayer(cardId, entry.userId)
              )
            );
            
            // Calculate score for each card
            const cardScores = cards.map(card => {
              if (!card?.player) {
                return {
                  card_id: card?.id || 0,
                  player_id: card?.playerId || 0,
                  element_id: 0,
                  total_score: 0,
                  breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
                  is_all_around: false,
                };
              }
              
              const elementId = this.resolveFplElementId(card.player, identityMap);
              const fplStats = elementId ? playerStatsMap.get(elementId) : undefined;
              if (!fplStats) {
                // Player hasn't played yet this gameweek
                return {
                  card_id: card.id,
                  player_id: card.playerId,
                  element_id: elementId,
                  total_score: 0,
                  breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
                  is_all_around: false,
                };
              }
              
              const score = calculatePlayerScore(fplStats, card.player.position);
              return { ...score, card_id: card.id, player_id: card.playerId, element_id: elementId };
            });

            await Promise.all(
              cardScores.map(async (score: any, index: number) => {
                const card = cards[index];
                if (!card?.id || !score?.element_id) return;

                const element = bootstrapElementById.get(Number(score.element_id));
                if (!element) return;

                const xp = this.calculateXpFromElement(element);
                const level = this.levelFromXp(xp);
                const latestScore = Math.max(0, Math.min(100, Number(score.total_score || 0)));
                const last5Scores = this.nextLast5Scores(card.last5Scores, latestScore);

                const currentXp = Number(card.xp || 0);
                const currentLevel = Number(card.level || 1);
                const currentDs = Number(card.decisiveScore || 35);
                const currentLast5 = Array.isArray(card.last5Scores)
                  ? card.last5Scores.map((value: any) => Number(value || 0))
                  : [];

                const unchanged =
                  currentXp === xp &&
                  currentLevel === level &&
                  currentDs === latestScore &&
                  JSON.stringify(currentLast5) === JSON.stringify(last5Scores);

                if (unchanged) return;

                await this.storage.updatePlayerCard(card.id, {
                  xp,
                  level,
                  decisiveScore: latestScore,
                  last5Scores,
                });
              }),
            );
            
            // Calculate total lineup score (with captain bonus)
            const totalScore = calculateLineupScore(cardScores, entry.captainId || 0);
            
            // Update entry
            await this.storage.updateCompetitionEntry(entry.id, {
              totalScore,
            });
            
            updatedEntries++;
          } catch (err) {
            console.error(`Failed to update entry ${entry.id}:`, err);
          }
        }
      }
      
      console.log(`✅ Updated ${updatedEntries} competition entries`);
    } catch (error) {
      console.error("Failed to update competition scores:", error);
      throw error;
    }
  }
  
  /**
   * Manually trigger score update for specific competition
   */
  async updateCompetition(competitionId: number) {
    console.log(`🎯 Manually updating competition ${competitionId}...`);
    
    const comp = await this.storage.getCompetition(competitionId);
    if (!comp) {
      throw new Error(`Competition ${competitionId} not found`);
    }
    
    if (comp.status !== "open" && comp.status !== "active") {
      throw new Error(`Competition ${competitionId} is not active (status: ${comp.status})`);
    }
    
    // Use the same update logic
    const [liveData, bootstrap] = await Promise.all([
      fplApi.getLiveGameweek(),
      fplApi.bootstrap(),
    ]);
    const playerStatsMap = new Map();
    const bootstrapElementById = new Map<number, any>();
    const identityMap = this.buildFplIdentityMap(bootstrap);

    for (const element of bootstrap?.elements || []) {
      bootstrapElementById.set(Number(element.id), element);
    }
    
    for (const element of liveData.elements || []) {
      const stats = mapFplStatsToPlayerStats(element);
      playerStatsMap.set(element.id, stats);
    }
    
    const entries = await this.storage.getCompetitionEntries(comp.id);
    let updatedCount = 0;
    
    for (const entry of entries) {
      try {
        const cards = await Promise.all(
          (entry.lineupCardIds || []).map((cardId: any) =>
            this.storage.getPlayerCardWithPlayer(cardId, entry.userId)
          )
        );
        
        const cardScores = cards.map(card => {
          if (!card?.player) {
            return {
              card_id: card?.id || 0,
              player_id: card?.playerId || 0,
              element_id: 0,
              total_score: 0,
              breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
              is_all_around: false,
            };
          }
          
          const elementId = this.resolveFplElementId(card.player, identityMap);
          const fplStats = elementId ? playerStatsMap.get(elementId) : undefined;
          if (!fplStats) {
            return {
              card_id: card.id,
              player_id: card.playerId,
              element_id: elementId,
              total_score: 0,
              breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
              is_all_around: false,
            };
          }
          
          const score = calculatePlayerScore(fplStats, card.player.position);
          return { ...score, card_id: card.id, player_id: card.playerId, element_id: elementId };
        });

        await Promise.all(
          cardScores.map(async (score: any, index: number) => {
            const card = cards[index];
            if (!card?.id || !score?.element_id) return;

            const element = bootstrapElementById.get(Number(score.element_id));
            if (!element) return;

            const xp = this.calculateXpFromElement(element);
            const level = this.levelFromXp(xp);
            const latestScore = Math.max(0, Math.min(100, Number(score.total_score || 0)));
            const last5Scores = this.nextLast5Scores(card.last5Scores, latestScore);

            const currentXp = Number(card.xp || 0);
            const currentLevel = Number(card.level || 1);
            const currentDs = Number(card.decisiveScore || 35);
            const currentLast5 = Array.isArray(card.last5Scores)
              ? card.last5Scores.map((value: any) => Number(value || 0))
              : [];

            const unchanged =
              currentXp === xp &&
              currentLevel === level &&
              currentDs === latestScore &&
              JSON.stringify(currentLast5) === JSON.stringify(last5Scores);

            if (unchanged) return;

            await this.storage.updatePlayerCard(card.id, {
              xp,
              level,
              decisiveScore: latestScore,
              last5Scores,
            });
          }),
        );
        
        const totalScore = calculateLineupScore(cardScores, entry.captainId || 0);
        
        await this.storage.updateCompetitionEntry(entry.id, {
          totalScore,
        });
        
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update entry ${entry.id}:`, err);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} entries for competition ${competitionId}`);
    return { updatedCount, totalEntries: entries.length };
  }
}
