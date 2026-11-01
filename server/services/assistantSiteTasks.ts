import {assistantAccess,type AssistantAudience} from './assistantAccess.js';
import {randomUUID,createHash} from 'node:crypto';
import {assistantTaskDefinitions,assistantTaskKind,type AssistantTaskDraft} from '../../shared/assistant-tasks.js';
import {AssistantError} from './assistantPolicy.js';
import type {AssistantQuery} from './supportWalletSnapshot.js';
import type {SiteTaskPlan} from './assistantSiteDispatcher.js';
import {validateTournamentRarityLineup,TOURNAMENT_REQUIRED_POSITIONS,TOURNAMENT_UTILITY_POSITIONS} from '../../shared/game-rules.js';
export const ASSISTANT_SITE_TASK_SCHEMA=`CREATE TABLE IF NOT EXISTS app.assistant_site_tasks(id uuid PRIMARY KEY,actor_id text NOT NULL,kind text NOT NULL,fields jsonb NOT NULL,fingerprint text NOT NULL,state text NOT NULL DEFAULT 'preview',result jsonb,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',finished_at timestamptz);
ALTER TABLE app.assistant_site_tasks ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'member'`;
const id=(v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw new AssistantError('Select a valid record number.');return n;};
export async function prepareAssistantSiteTask(q:AssistantQuery,actor:string,admin:boolean,draft:AssistantTaskDraft){
  if(!actor)throw new AssistantError('Sign in first.',401);
  if(!assistantTaskKind(draft?.kind))throw new AssistantError('This site task is not connected.');
  const def=assistantTaskDefinitions[draft.kind];if(def.admin&&!admin)throw new AssistantError('This task requires administrator access.',403);
  const fields=draft.fields||{},rows:any[]=[{accountId:actor,action:def.label}],snapshot:any[]=[];
  let plan:SiteTaskPlan;
  const route=(method:SiteTaskPlan['method'],pattern:string,params:Record<string,string>={},body:Record<string,any>={})=>({method,route:pattern,path:Object.entries(params).reduce((p,[k,v])=>p.replace(':'+k,encodeURIComponent(v)),pattern),params,body});
  let competitionId=fields.competitionId? id(fields.competitionId):0;
  if(draft.kind==='team_submit'||draft.kind==='team_edit'){
    if(draft.kind==='team_edit'){
      const entry=(await q('SELECT id,competition_id AS "competitionId",lineup_card_ids AS "cardIds",captain_id AS "captainId" FROM app.competition_entries WHERE id=$1 AND user_id=$2',[id(fields.entryId),actor]))[0];
      if(!entry)throw new AssistantError('Your entry was not found.',404);competitionId=Number(entry.competitionId);snapshot.push(entry);
    }
    const c=(await q(`SELECT id,name,tier::text AS tier,status::text AS status,game_week AS gameweek,entry_fee::float AS "entryFee",start_date AS "startDate" FROM app.competitions WHERE id=$1 AND (coalesce(visibility,'public')='public' OR created_by_user_id=$2 OR EXISTS(SELECT 1 FROM app.competition_entries e WHERE e.competition_id=app.competitions.id AND e.user_id=$2))`,[id(competitionId),actor]))[0];
    if(!c)throw new AssistantError('Tournament not found or not accessible.',404);if(c.status!=='open')throw new AssistantError('This tournament is not open.');
    const ids=Array.isArray(fields.cardIds)?fields.cardIds.map(id):[];
    if(ids.length!==5||new Set(ids).size!==5)throw new AssistantError('Select five different cards in GK, DEF, MID, FWD, Utility order.');
    const captain=id(fields.captainId);if(!ids.includes(captain))throw new AssistantError('Select a captain from those five cards.');
    const cards=await q(`SELECT pc.id,pc.player_id AS "playerId",pc.rarity::text AS rarity,pc.for_sale AS "forSale",p.name,p.position::text AS position FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id WHERE pc.owner_id=$1 AND pc.id IN(SELECT value::int FROM jsonb_array_elements_text($2::jsonb)) ORDER BY pc.id`,[actor,JSON.stringify(ids)]);
    if(cards.length!==5||cards.some(c=>c.forSale)||new Set(cards.map(c=>c.playerId)).size!==5)throw new AssistantError('All five distinct players must be owned by you and off sale.');
    const ordered=ids.map(n=>cards.find(c=>Number(c.id)===n));
    if(!ordered.every((c,i)=>i<4?c.position===TOURNAMENT_REQUIRED_POSITIONS[i]:TOURNAMENT_UTILITY_POSITIONS.includes(c.position)))throw new AssistantError('Use GK, DEF, MID, FWD, then a DEF/MID/FWD utility.');
    const rarity=validateTournamentRarityLineup(cards.map(c=>c.rarity),c.tier);if(!rarity.valid)throw new AssistantError(rarity.message);
    rows.push({tournamentId:c.id,tournament:c.name,gameweek:c.gameweek,entryFee:draft.kind==='team_submit'?c.entryFee:0,captainCardId:captain},...ordered.map((c,i)=>({slot:i+1,cardId:c.id,player:c.name,position:c.position,rarity:c.rarity,captain:c.id===captain})));
    snapshot.push(c,cards);
    plan=draft.kind==='team_submit'?route('post','/api/competitions/join',{}, {competitionId:c.id,cardIds:ids,captainId:captain,assistantExpectedEntryFee:Number(c.entryFee)}):route('patch','/api/competitions/entries/:entryId/lineup',{entryId:String(id(fields.entryId))},{cardIds:ids,captainId:captain});
  }else if(draft.kind==='prize_claim'){
    const entry=(await q('SELECT id,competition_id AS "competitionId",rank,prize_amount AS "prizeAmount" FROM app.competition_entries WHERE id=$1 AND user_id=$2',[id(fields.entryId),actor]))[0];if(!entry)throw new AssistantError('Your entry was not found.',404);rows.push(entry);snapshot.push(entry);plan=route('post','/api/competitions/prizes/:entryId/claim',{entryId:String(entry.id)});
  }else if(draft.kind==='weekly_claim'){plan=route('post','/api/rewards/daily-login/claim');rows.push({note:'The reward route verifies eligibility and the Common card cap. No card is promised before it succeeds.'});
  }else if(['listing_create','listing_cancel'].includes(draft.kind)){
    const card=(await q(`SELECT pc.id,pc.rarity::text AS rarity,pc.for_sale AS "forSale",pc.price,p.name FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id WHERE pc.id=$1 AND pc.owner_id=$2`,[id(fields.cardId),actor]))[0];if(!card)throw new AssistantError('Your card was not found.',404);snapshot.push(card);rows.push(card);
    if(draft.kind==='listing_create'){const price=Number(fields.price);if(!Number.isFinite(price)||price<=0||price>10000000||Math.abs(price*100-Math.round(price*100))>0.000001)throw new AssistantError('Enter a positive price with at most two decimal places.');rows.push({newAskingPrice:price,note:'This makes the card available for other users to buy.'});plan=route('post','/api/marketplace/list',{}, {cardId:card.id,price});}
    else plan=route('post','/api/marketplace/cancel/:cardId',{cardId:String(card.id)});
  }else if(draft.kind==='price_watch'||draft.kind==='price_unwatch'){const cardId=id(fields.cardId);rows.push({cardId});plan=route(draft.kind==='price_watch'?'post':'delete','/api/marketplace/price-watches/:cardId',{cardId:String(cardId)});
  }else if(draft.kind==='inbox_read_all'){plan=route('post','/api/notifications/read-all');rows.push({note:'All inbox notifications belonging to your signed-in account will be marked read.'});
  }else if(draft.kind==='alert_preference'){
    const category=String(fields.category);if(!['tournament','players','prizes','marketplace','community','mint','marketing'].includes(category)||typeof fields.enabled!=='boolean')throw new AssistantError('Choose an alert category and on/off.');rows.push({category,enabled:fields.enabled});plan=route('put','/api/notification-preferences',{}, {preferences:{[category]:fields.enabled}});
  }else if(draft.kind==='team_rename'){
    const name=String(fields.teamName||'').trim();if(name.length<3||name.length>50)throw new AssistantError('Use a team name of 3–50 characters.');rows.push({newTeamName:name});plan=route('patch','/api/user/profile',{}, {managerTeamName:name});
  }else if(draft.kind==='admin_sync'){
    const job=String(fields.jobType);if(!['fixtures','live','completed_stats','standings','teams','players'].includes(job))throw new AssistantError('Select a supported synchronization job.');rows.push({jobType:job,note:'This uses provider requests and the normal API budget controls.'});plan=route('post','/api/admin/live-data/sync/:jobType',{jobType:job});
  }else if(draft.kind==='admin_settle'){
    const c=(await q('SELECT id,name,status::text AS status,game_week AS gameweek FROM app.competitions WHERE id=$1',[id(fields.competitionId)]))[0];if(!c)throw new AssistantError('Tournament not found.',404);rows.push(c,{note:'This can award prizes or pay eligible winners. The normal settlement route verifies final scoring and posting integrity; it cannot be forced.'});snapshot.push(c);plan=route('post','/api/admin/competitions/settle/:id',{id:String(c.id)});
  }else throw new AssistantError('Unsupported task.');
  return {plan,rows,description:def.label,fingerprint:createHash('sha256').update(JSON.stringify({plan,snapshot})).digest('hex')};
}
export async function previewAssistantSiteTask(q:AssistantQuery,actor:string,admin:boolean,draft:AssistantTaskDraft,audience:AssistantAudience=admin?'admin':'member'){
  admin=assistantAccess(audience,admin).admin;
  const prepared=await prepareAssistantSiteTask(q,actor,admin,draft);const token=randomUUID();
  const row=(await q(`INSERT INTO app.assistant_site_tasks(id,actor_id,kind,fields,fingerprint,audience) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING expires_at AS "expiresAt"`,[token,actor,draft.kind,JSON.stringify(Object.fromEntries(assistantTaskDefinitions[draft.kind].fields.filter(key=>Object.hasOwn(draft.fields||{},key)).map(key=>[key,draft.fields[key]]))),prepared.fingerprint,audience]))[0];
  return {token,description:prepared.description,rows:prepared.rows,expiresAt:row.expiresAt,note:'Confirming runs this action for your signed-in account. The site rechecks permissions, eligibility, locks, available funds and kickoff as applicable. A preview does not establish eligibility.'};
}
export async function confirmAssistantSiteTask(q:AssistantQuery,actor:string,admin:boolean,token:string,execute:(plan:SiteTaskPlan)=>Promise<any>,audience:AssistantAudience=admin?'admin':'member'){
  admin=assistantAccess(audience,admin).admin;
  const task=(await q('SELECT *,expires_at>now() AS valid FROM app.assistant_site_tasks WHERE id=$1 AND actor_id=$2 AND audience=$3',[token,actor,audience]))[0];
  if(!task)throw new AssistantError('Your task preview was not found.',404);
  const storedKind:unknown=task.kind;
  if(!assistantTaskKind(storedKind))throw new AssistantError('Unsupported task.');
  if(assistantTaskDefinitions[storedKind].admin&&!admin)throw new AssistantError('Administrator access is required for this task.',403);
  if(task.state!=='preview')return {state:task.state,...(task.result||{message:'This task was already started. Check the relevant site page; it will not run again.'}),replayed:true};
  if(!task.valid)throw new AssistantError('The task preview expired. Prepare it again.',409);
  const prepared=await prepareAssistantSiteTask(q,actor,admin,{kind:task.kind,fields:task.fields});
  if(prepared.fingerprint!==task.fingerprint)throw new AssistantError('The records or price changed. Prepare a fresh preview.',409);
  const claimed=await q(`UPDATE app.assistant_site_tasks SET state='started' WHERE id=$1 AND actor_id=$2 AND state='preview' AND expires_at>now() RETURNING id`,[token,actor]);
  if(!claimed.length)return {state:'started',message:'This preview was already started or expired. Check the relevant page; no second action was started.',replayed:true};
  let result:any;
  try{result=await execute(prepared.plan);}catch{result={status:500,message:'The outcome could not be confirmed. Check the relevant site page before starting a new action.'};}
  const state=result.status<400?'succeeded':result.status<500?'rejected':'unknown';
  // Once claimed, a task can never execute again, even if the process dies before recording its outcome.
  await q(`UPDATE app.assistant_site_tasks SET state=$2,result=$3::jsonb,finished_at=now() WHERE id=$1`,[token,state,JSON.stringify(result)]);
  await q(`INSERT INTO app.audit_logs(user_id,action,meta) VALUES($1,'assistant.site_task',$2::jsonb)`,[actor,JSON.stringify({token,kind:task.kind,state,status:result.status})]);
  return {state,...result,replayed:false};
}
