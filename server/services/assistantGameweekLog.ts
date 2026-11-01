import {AssistantError} from './assistantPolicy.js';
import type {AssistantQuery} from './supportWalletSnapshot.js';
export async function assistantGameweekLog(q:AssistantQuery,admin:boolean,question:string){
  if(!admin)throw new AssistantError('Gameweek operational logs are available to administrators only.',403);
  const exists=async(table:string)=>Boolean((await q('SELECT to_regclass($1) AS present',['app.'+table]))[0]?.present);
  const requested=question.match(/\b(?:gw\s*|game\s*week\s*#?\s*)(\d+)\b/i)?.[1];
  if(requested&&(Number(requested)<1||Number(requested)>38))throw new AssistantError('Choose a Premier League gameweek from 1 to 38.');
  const season=new Date().getUTCFullYear()-(new Date().getUTCMonth()<6?1:0);
  const from=`${season}-07-01T00:00:00Z`,to=`${season+1}-07-01T00:00:00Z`;
  let gameweek=requested?Number(requested):0,selection=requested?'Requested gameweek in the current season.':'',fixture:any;
  const hasFixtures=await exists('api_football_fixtures');
  if(!gameweek&&hasFixtures){
    fixture=(await q(`SELECT round,kickoff_at AS "kickoffAt",updated_at AS "updatedAt" FROM app.api_football_fixtures WHERE league_id=39 AND season=$1 AND round ~ '^Regular Season - [0-9]+$' ORDER BY CASE WHEN status_short IN ('1H','HT','2H','ET','BT','P','LIVE','INT') THEN 0 WHEN kickoff_at<=now() THEN 1 ELSE 2 END,CASE WHEN kickoff_at<=now() THEN kickoff_at END DESC,kickoff_at ASC LIMIT 1`,[season]))[0];
    gameweek=Number(String(fixture?.round||'').match(/(\d+)$/)?.[1]||0);
    if(gameweek)selection='Live or latest started Premier League round in the stored API-Football feed; upcoming round if no match has started. This is not a live provider refresh.';
  }
  if(!gameweek){
    const c=(await q(`SELECT game_week AS gameweek FROM app.competitions WHERE start_date >= $1::timestamptz AND start_date < $2::timestamptz AND start_date<=now() ORDER BY start_date DESC,id DESC LIMIT 1`,[from,to]))[0];
    gameweek=Number(c?.gameweek||0);selection='Latest started stored tournament this season. Current provider gameweek could not be verified.';
  }
  if(!gameweek)return {answer:'I could not identify a gameweek from the connected records. Specify a week, for example “Show GW9 log”. No gameweek status was inferred from help text.',sections:[],followUps:['Show GW… log']};
  const competitions=await q(`SELECT c.id,c.name,c.status::text AS status,c.game_week AS gameweek,c.start_date AS "startDate",count(e.id)::int AS entries,count(e.id) FILTER(WHERE coalesce(e.tiebreak_meta->'scoring'->>'complete','false')='true')::int AS "completeScoringSnapshots",count(e.id) FILTER(WHERE coalesce(e.tiebreak_meta->'scoring'->>'final','false')='true')::int AS "finalScoringSnapshots",count(e.id) FILTER(WHERE e.tiebreak_meta ? 'settlement')::int AS "settlementSnapshots" FROM app.competitions c LEFT JOIN app.competition_entries e ON e.competition_id=c.id WHERE c.game_week=$1 AND c.start_date >= $2::timestamptz AND c.start_date < $3::timestamptz GROUP BY c.id,c.name,c.status,c.game_week,c.start_date ORDER BY c.id DESC LIMIT 100`,[gameweek,from,to]);
  const sections:Array<{title:string;rows:any[];note?:string}>=[];
  sections.push({title:'Gameweek log scope',rows:[{gameweek,season,selection,fixtureFeedUpdatedAt:fixture?.updatedAt||null}],note:'Current season only. These are stored records, not proof that synchronization or settlement has completed.'});
  sections.push({title:'Gameweek tournament and scoring state',rows:competitions,note:'Current snapshots for up to 100 tournaments. A recorded rank or prize amount alone does not establish delivery.'});
  if(hasFixtures)sections.push({title:'Gameweek fixture synchronization',rows:await q(`SELECT api_fixture_id AS "fixtureId",kickoff_at AS kickoff,status_short AS status,stats_synced_at AS "statsSyncedAt",updated_at AS "updatedAt" FROM app.api_football_fixtures WHERE league_id=39 AND season=$1 AND round=$2 ORDER BY kickoff_at,api_fixture_id LIMIT 100`,[season,`Regular Season - ${gameweek}`])});
  sections.push({title:'Recorded gameweek operations',rows:await q(`SELECT a.id,a.action,a.meta->>'competitionId' AS "competitionId",a.created_at AS "createdAt" FROM app.audit_logs a WHERE a.meta->>'competitionId' IN(SELECT c.id::text FROM app.competitions c WHERE c.game_week=$1 AND c.start_date >= $2::timestamptz AND c.start_date < $3::timestamptz) AND (a.action='admin.tournament.settled' OR a.action LIKE 'competition.%' OR a.action LIKE 'tournament.%' OR a.action LIKE 'wallet.tournament_%') ORDER BY a.created_at DESC,a.id DESC LIMIT 100`,[gameweek,from,to]),note:'Latest 100 recorded actions for this season/week, across all dates. Missing audit events do not prove an action failed or never happened. Raw audit payloads and account identifiers are omitted.'});
  if(await exists('api_football_sync_runs'))sections.push({title:'Latest provider sync jobs (all gameweeks)',rows:await q(`SELECT id,job_type AS "jobType",status,provider_calls AS "providerCalls",records_processed AS "recordsProcessed",started_at AS "startedAt",finished_at AS "finishedAt" FROM app.api_football_sync_runs ORDER BY started_at DESC,id DESC LIMIT 20`),note:'Latest 20 jobs across all dates. This table has no gameweek identifier, so these jobs cannot establish success for this gameweek. Raw messages/details are omitted.'});
  else sections.push({title:'Provider sync job availability',rows:[],note:'The provider sync-job table is unavailable on this installation. No sync outcome could be verified.'});
  const pending=competitions.filter(c=>Number(c.completeScoringSnapshots)<Number(c.entries)||Number(c.finalScoringSnapshots)<Number(c.entries)).length;
  return {answer:`GW${gameweek}, season ${season}: ${competitions.length} stored tournaments shown; ${pending} have entries with incomplete or provisional scoring snapshots. ${selection} Expand the records below for fixture synchronization and recorded operations. No synchronization, minting or settlement was triggered.`,sections,followUps:['Show GW… log','Why is tournament #… not settled?']};
}
