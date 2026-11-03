import {sql} from 'drizzle-orm';
import {db} from '../db.js';
import {fplApi} from './fplApi.js';
import {buildFplPlayerIndex} from './fplPlayerIdentity.js';
import {apiFootballSeasonNow,loadApiFootballPlayerDirectory,resolveApiFootballPlayer} from './apiFootballPlayerDirectory.js';
const rowsOf=(result:any):any[]=>Array.isArray(result?.rows)?result.rows:[];
const unavailable=()=>new Error('Current Premier League reward eligibility could not be verified. No card was minted; your reward remains available. Please try again shortly.');
const excluded=new Set(['departed','loaned_out','superseded','unlinked','archived']);
/** New rewards need present membership, not a historical PL label, photo or ID.
 * FPL is roster/identity corroboration only; it never supplies tournament points.
 */
export async function currentPremierLeagueMintIds(executor:any=db):Promise<number[]> {
  let bootstrap:any,directory:any[];
  try{[bootstrap,directory]=await Promise.all([fplApi.mintBootstrap(),loadApiFootballPlayerDirectory()]);}catch{throw unavailable();}
  const elements=Array.isArray(bootstrap?.elements)?bootstrap.elements:[];
  const teams=Array.isArray(bootstrap?.teams)?bootstrap.teams:[];
  if(elements.length<300||teams.length!==20)throw unavailable();
  const season=apiFootballSeasonNow(),now=Date.now();
  const clubs=rowsOf(await executor.execute(sql`SELECT DISTINCT team_id AS id FROM (
    SELECT home_team_id AS team_id FROM app.api_football_fixtures WHERE league_id=39 AND season=${season}
    UNION SELECT away_team_id FROM app.api_football_fixtures WHERE league_id=39 AND season=${season}
  ) current_pl_teams WHERE team_id IS NOT NULL`));
  const clubIds=new Set(clubs.map(row=>Number(row.id)));
  if(clubIds.size<18||clubIds.size>20)throw unavailable();
  const currentDirectory=directory.filter(player=>{
    const updated=Date.parse(String(player.updatedAt||''));
    return player.active===true&&Number(player.season)===season&&clubIds.has(Number(player.apiTeamId))
      &&Number.isFinite(updated)&&updated<=now+300000&&now-updated<=48*3600000;
  });
  if(!currentDirectory.length)throw unavailable();
  const locals=rowsOf(await executor.execute(sql`SELECT id,name,team,position::text AS position,league,status,
    fpl_id AS "fplId",code,web_name AS "webName" FROM app.players
    WHERE regexp_replace(lower(coalesce(league,'')), '[^a-z0-9]+', '', 'g') IN ('premierleague','englishpremierleague','epl')`));
  const index=buildFplPlayerIndex(bootstrap);
  const teamIds=new Set(teams.map((team:any)=>Number(team.id)));
  const candidates=locals.flatMap(player=>{
    if(excluded.has(String(player.status||'').toLowerCase()))return [];
    const official=index.resolve(player);
    if(!official||!teamIds.has(Number(official.team)))return [];
    const provider=resolveApiFootballPlayer({...player,...index.canonical(official)},currentDirectory);
    return provider?[{playerId:Number(player.id),providerId:Number(provider.apiPlayerId)}]:[];
  });
  const blocked=new Set<number>();
  const tables=rowsOf(await executor.execute(sql`SELECT to_regclass('app.real_life_player_loans') AS loans,to_regclass('app.api_football_transfers') AS transfers`))[0]||{};
  if(tables.loans)for(const row of rowsOf(await executor.execute(sql`SELECT app_player_id AS id FROM app.real_life_player_loans WHERE active=true`)))blocked.add(Number(row.id));
  const departedProviderIds=new Set<number>();
  if(tables.transfers)for(const row of rowsOf(await executor.execute(sql`SELECT DISTINCT ON(api_player_id) api_player_id AS id,to_team_id AS "teamId"
    FROM app.api_football_transfers WHERE transfer_date<=current_date ORDER BY api_player_id,transfer_date DESC,updated_at DESC`))){
    if(Number(row.teamId)>0&&!clubIds.has(Number(row.teamId)))departedProviderIds.add(Number(row.id));
  }
  const valid=candidates.filter(row=>!blocked.has(row.playerId)&&!departedProviderIds.has(row.providerId));
  if(!valid.length)throw unavailable();
  // Identity proof must exist for the mint-time database guard, including newly
  // discovered local rows. Never overwrite an established provider identity.
  await executor.execute(sql`INSERT INTO app.player_provider_identities(player_id,api_player_id)
    SELECT player_id,api_player_id FROM jsonb_to_recordset(${JSON.stringify(valid.map(row=>({player_id:row.playerId,api_player_id:row.providerId})))}::jsonb)
    AS verified(player_id integer,api_player_id integer) ON CONFLICT(player_id) DO NOTHING`);
  return valid.map(row=>row.playerId);
}
export async function assertCurrentPremierLeagueMintPlayer(executor:any,playerId:number){
  if(!(await currentPremierLeagueMintIds(executor)).includes(Number(playerId)))throw new Error('This player is no longer eligible for a new Premier League card. No card was minted. Choose a current Premier League player.');
}
