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
      const activeComps = competitions.filter(c => 
        c.status === "open" || c.status === "active"
      );
      
      if (activeComps.length === 0) {
        console.log("No active competitions to update");
        return;
      }
      
      console.log(`📊 Updating scores for ${activeComps.length} active competitions...`);
      
      // Fetch live gameweek data
      const liveData = await fplApi.getLiveGameweek();
      const playerStatsMap = new Map();
      
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
              (entry.lineupCardIds || []).map(cardId =>
                this.storage.getPlayerCardWithPlayer(cardId, entry.userId)
              )
            );
            
            // Calculate score for each card
            const cardScores = cards.map(card => {
              if (!card?.player || !(card.player as any).externalId) {
                // Player has no FPL ID, give base score
                return {
                  player_id: card?.playerId || 0,
                  total_score: 0,
                  breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
                  is_all_around: false,
                };
              }
              
              const fplStats = playerStatsMap.get((card.player as any).externalId);
              if (!fplStats) {
                // Player hasn't played yet this gameweek
                return {
                  player_id: card.playerId,
                  total_score: 0,
                  breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
                  is_all_around: false,
                };
              }
              
              const score = calculatePlayerScore(fplStats, card.player.position);
              return { ...score, player_id: card.playerId };
            });
            
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
    const liveData = await fplApi.getLiveGameweek();
    const playerStatsMap = new Map();
    
    for (const element of liveData.elements || []) {
      const stats = mapFplStatsToPlayerStats(element);
      playerStatsMap.set(element.id, stats);
    }
    
    const entries = await this.storage.getCompetitionEntries(comp.id);
    let updatedCount = 0;
    
    for (const entry of entries) {
      try {
        const cards = await Promise.all(
          (entry.lineupCardIds || []).map(cardId =>
            this.storage.getPlayerCardWithPlayer(cardId, entry.userId)
          )
        );
        
        const cardScores = cards.map(card => {
          if (!card?.player || !(card.player as any).externalId) {
            return {
              player_id: card?.playerId || 0,
              total_score: 0,
              breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
              is_all_around: false,
            };
          }
          
          const fplStats = playerStatsMap.get((card.player as any).externalId);
          if (!fplStats) {
            return {
              player_id: card.playerId,
              total_score: 0,
              breakdown: { decisive: 0, performance: 0, penalties: 0, bonus: 0 },
              is_all_around: false,
            };
          }
          
          const score = calculatePlayerScore(fplStats, card.player.position);
          return { ...score, player_id: card.playerId };
        });
        
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
