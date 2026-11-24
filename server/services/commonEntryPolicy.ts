import { sql } from 'drizzle-orm';
import { COMMON_COLLECTION_CAP } from '../../shared/common-collection.js';
export const COMMON_TWO_TEAM_START_GAMEWEEK = 12;
export const COMMON_TEAMS_PER_TOURNAMENT = 2;
const rows=(r:any):any[]=>r?.rows || [];

// Called after locking the competition row, before fees or cards are committed.
export async function assertCommonEntryPolicy(tx:any,userId:string,competition:any) {
  if(String(competition.tier).toLowerCase()!=='common' || Number(competition.gameWeek)<COMMON_TWO_TEAM_START_GAMEWEEK)return;
  const state=rows(await tx.execute(sql`
    select (select count(*)::int from app.player_cards where owner_id=${userId} and rarity::text='common') as "commonCount",
      (select count(*)::int from app.competition_entries where user_id=${userId} and competition_id=${Number(competition.id)}) as "entryCount"
  `))[0] || {};
  if(Number(state.commonCount)>COMMON_COLLECTION_CAP)
    throw new Error('From GW12, choose your best 10 Common cards in Collection before entering Common tournaments. Other rarities are unaffected.');
  if(Number(state.entryCount)>=COMMON_TEAMS_PER_TOURNAMENT)
    throw new Error('From GW12, each user may enter at most two teams per Common tournament. Other rarities are unaffected.');
}
