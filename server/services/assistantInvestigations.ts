import {validateTournamentRarityLineup,TOURNAMENT_REQUIRED_POSITIONS,TOURNAMENT_UTILITY_POSITIONS} from '../../shared/game-rules.js';
import {gameweekHasKickedOff} from '../../shared/availability-notice.js';
import type {AssistantQuery} from './supportWalletSnapshot.js';
export type InvestigationContext={competitionId?:number;entryId?:number;playerSearch?:string;paymentReference?:string};
export type AssistantConnections={fixtures?:()=>Promise<any[]>;availability?:()=>Promise<any>};
const positive=(value:any)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):undefined;
export function investigationContext(question:string,previous?:any):InvestigationContext {
  const competitionId=positive(question.match(/(?:competition|tournament)\s*#?\s*(\d+)/i)?.[1])||positive(previous?.competitionId);
  const entryId=positive(question.match(/\bentry\s*#?\s*(\d+)/i)?.[1])||(/(?:competition|tournament)\s*#?\s*\d+/i.test(question)?undefined:positive(previous?.entryId));
  const playerSearch=question.match(/(?:player|footballer)\s+["“]([^"”]{1,80})["”]/i)?.[1]
    ||question.match(/\b(?:isak|izak)\b/i)?.[0]?.replace(/izak/i,'isak')
    ||question.match(/(?:is|was)\s+([a-z][a-z .'-]{1,60}?)\s+(?:injured|starting|suspended|available|on the bench)/i)?.[1]
    ||question.match(/will\s+([a-z][a-z .'-]{1,60}?)\s+play/i)?.[1]
    ||(/all (?:players|injuries|availability|clubs)/i.test(question)?undefined:String(previous?.playerSearch||'').slice(0,80)||undefined);
  const paymentReference=question.match(/(?:payment\s+)?reference\s+["“]([^"”]{1,120})["”]/i)?.[1]||String(previous?.paymentReference||'').slice(0,120)||undefined;
  return {competitionId,entryId,playerSearch,paymentReference};
}
// Pure explanation of stored evidence. This deliberately cannot authorize an entry or settlement.
export function diagnoseLineup(competition:any,entry:any,cards:any[],locks:any[],balance:any,fixtures:any[]|null,now=Date.now()) {
  const checks:Array<{check:string;status:string;evidence:string;nextStep:string}>=[];
  const add=(check:string,status:string,evidence:string,nextStep:string)=>checks.push({check,status,evidence,nextStep});
  add('Tournament status',competition.status==='open'?'pass':'blocked',String(competition.status),'Use an open tournament.');
  const gw=Number(competition.gameweek),matches=fixtures?.filter(f=>Number(f.event)===gw)||[];
  const kickoff=matches.map(f=>Date.parse(f.kickoff_time)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  const oldSeason=Number.isFinite(kickoff)&&Math.abs(kickoff-Date.parse(competition.startDate))>35*86400000;
  if(!matches.length||!Number.isFinite(kickoff)||oldSeason)add('First kickoff','unknown','Current gameweek schedule could not be verified for this tournament.','Reopen My Entries or Play; the server must verify the deadline.');
  else add('First kickoff',gameweekHasKickedOff(matches,gw,now)?'blocked':'pass',new Date(kickoff).toISOString(),'Teams and captains stay locked after the first match, including before later matches.');
  if(!entry){
    const funds=balance==null?null:Number(balance);
    add('Entry fee',funds==null?'unknown':funds<Number(competition.entryFee)?'blocked':'pass',`Fee N$${competition.entryFee}; available ${funds==null?'unknown':`N$${funds.toFixed(2)}`}`,'Only available funds can pay the fee.');
    add('Selected lineup','unknown','No submitted entry selected. Owned cards alone do not show which five cards you tried to submit.','Provide an entry number for an existing team, or select the five cards in Play for authoritative validation.');
    return checks;
  }
  const ids=Array.isArray(entry.cardIds)?entry.cardIds.map(Number):[];
  const ordered=ids.map((id:number)=>cards.find(c=>Number(c.id)===id));
  add('Five distinct footballers',ids.length===5&&new Set(ids).size===5&&ordered.every(Boolean)&&new Set(ordered.map((c:any)=>c.playerId)).size===5?'pass':'blocked',`${ids.length} selected cards; ${ordered.filter(Boolean).length} card records found.`,'Choose five distinct players.');
  add('Captain',ids.includes(Number(entry.captainId))?'pass':'blocked',`Captain card ${entry.captainId??'missing'}`,'Choose a captain from the five selected cards.');
  const wrong=ordered.filter((c:any)=>!c||c.ownerId!==entry.userId||c.forSale);
  add('Ownership and sale listings',wrong.length?'blocked':'pass',`${wrong.length} missing, unowned or listed cards.`,'Keep selected cards owned and off the marketplace.');
  const positions=ordered.every((c:any,i:number)=>c&&(i<4?c.position===TOURNAMENT_REQUIRED_POSITIONS[i]:TOURNAMENT_UTILITY_POSITIONS.includes(c.position)));
  add('Stored positions',positions?'pass':'blocked',ordered.map((c:any)=>c?.position||'missing').join(', '),'GK, DEF, MID, FWD, then a DEF/MID/FWD utility. Live provider identity is rechecked when saving.');
  const rarity=validateTournamentRarityLineup(ordered.map((c:any)=>c?.rarity),competition.tier);
  add('Rarity',rarity.valid?'pass':'blocked',rarity.message||'Stored rarity requirements met.','Use the tournament’s permitted rarity mix.');
  const foreign=locks.filter(l=>ids.includes(Number(l.cardId))&&!(l.reason==='competition'&&String(l.reference)===String(competition.id)&&l.userId===entry.userId));
  add('Other active locks',foreign.length?'blocked':'pass',`${foreign.length} selected cards have other active locks.`,'Finish the conflicting activity or use other cards.');
  const departed=ordered.filter((c:any)=>c&&(['departed','superseded','unlinked','archived'].includes(String(c.status).toLowerCase())||(c.league&&!['premierleague','englishpremierleague','epl'].includes(String(c.league).toLowerCase().replace(/[^a-z]/g,'')))));
  add('Stored player eligibility',departed.length?'blocked':'unknown',departed.length?`${departed.length} selected players are marked outside current eligibility.`:'Stored cards show no departure flag; current provider identity is still required.','The normal save route verifies current Premier League identity. Injury alone does not make a card invalid.');
  return checks;
}
export async function investigateEntry(q:AssistantQuery,target:string,context:InvestigationContext,connections:AssistantConnections) {
  let competitionId=context.competitionId,entry:any;
  if(context.entryId){
    entry=(await q(`SELECT id,user_id AS "userId",competition_id AS "competitionId",lineup_card_ids AS "cardIds",captain_id AS "captainId" FROM app.competition_entries WHERE id=$1 AND user_id=$2`,[context.entryId,target]))[0];
    if(!entry)return {answer:'That entry was not found in the selected account. Check the entry number.',sections:[],followUps:[]};
    competitionId=Number(entry.competitionId);
  }
  if(!competitionId)return {answer:'For a specific entry diagnosis, give the tournament number or an existing entry number.',sections:[],followUps:['Why can’t I enter tournament #…?','Investigate entry #…']};
  const competition=(await q(`SELECT id,name,tier::text AS tier,status::text AS status,game_week AS gameweek,start_date AS "startDate",entry_fee::float AS "entryFee" FROM app.competitions WHERE id=$1 AND (coalesce(visibility,'public')='public' OR created_by_user_id=$2 OR EXISTS(SELECT 1 FROM app.competition_entries e WHERE e.competition_id=app.competitions.id AND e.user_id=$2))`,[competitionId,target]))[0];
  if(!competition)return {answer:'Tournament not found or not accessible to the selected account.',sections:[],followUps:[]};
  const cards=entry?await q(`SELECT pc.id,pc.owner_id AS "ownerId",pc.player_id AS "playerId",pc.rarity::text AS rarity,pc.for_sale AS "forSale",p.position::text AS position,p.status,p.league FROM app.player_cards pc JOIN app.players p ON p.id=pc.player_id WHERE pc.id IN(SELECT value::int FROM jsonb_array_elements_text($1::jsonb))`,[JSON.stringify(entry.cardIds)]):[];
  const hasLocks=(await q("SELECT to_regclass('app.card_locks') AS present"))[0]?.present;
  const locks=hasLocks?await q(`SELECT card_id AS "cardId",reason,ref_id AS reference,user_id AS "userId" FROM app.card_locks WHERE user_id=$1 AND (expires_at IS NULL OR expires_at>now())`,[target]):[];
  const wallet=(await q('SELECT balance FROM app.wallets WHERE user_id=$1',[target]))[0];
  const fixtures=await connections.fixtures?.().catch(()=>null)??null;
  const checks=diagnoseLineup(competition,entry,cards,locks,wallet?.balance,fixtures);
  if(!hasLocks)checks.push({check:'Card lock data',status:'unknown',evidence:'Lock records unavailable.',nextStep:'Verify through the normal entry form.'});
  return {answer:`${checks.filter(c=>c.status==='blocked').length} recorded blockers; ${checks.filter(c=>c.status==='unknown').length} checks need more evidence. This is a diagnostic snapshot. Entry submission and edits are revalidated by the normal server controls.`,sections:[{title:'Entry investigation',rows:checks,note:'Current diagnostic snapshot, independent of transaction report dates. Stored positions and player status are not a substitute for current provider validation.'},{title:'Investigated tournament',rows:[competition]}],followUps:entry?[]:['Investigate entry #…']};
}
export async function investigateSettlement(q:AssistantQuery,target:string,admin:boolean,context:InvestigationContext,connections:AssistantConnections){
  if(!context.competitionId)return {answer:'Give the tournament number to check its settlement evidence.',sections:[],followUps:['Why is tournament #… not settled?']};
  const c=(await q(`SELECT c.id,c.name,c.status::text AS status,c.game_week AS gameweek,c.start_date AS "startDate" FROM app.competitions c WHERE c.id=$1 AND ($2::boolean OR EXISTS(SELECT 1 FROM app.competition_entries e WHERE e.competition_id=c.id AND e.user_id=$3))`,[context.competitionId,admin,target]))[0];
  if(!c)return {answer:'No accessible tournament found. Members can investigate tournaments they entered.',sections:[],followUps:[]};
  const scoreTable=(await q("SELECT to_regclass('app.player_gameweek_scores') AS present"))[0]?.present;
  const summary=(await q(`SELECT count(*)::int AS entries,count(*) FILTER(WHERE coalesce(tiebreak_meta->'scoring'->>'complete','false')='true')::int AS "completeSnapshots",count(*) FILTER(WHERE coalesce(tiebreak_meta->'scoring'->>'final','false')='true')::int AS "finalSnapshots",count(*) FILTER(WHERE tiebreak_meta ? 'settlement')::int AS "settlementSnapshots" FROM app.competition_entries WHERE competition_id=$1 AND ($2::boolean OR user_id=$3)`,[c.id,admin,target]))[0]||{};
  const scores=scoreTable?await q(`SELECT DISTINCT pc.id AS "cardId",p.name AS player,(s.player_id IS NULL) AS "scoreMissing",s.is_final AS "isFinal",s.source FROM app.competition_entries e CROSS JOIN LATERAL jsonb_array_elements_text(e.lineup_card_ids) a(card_id) LEFT JOIN app.player_cards pc ON pc.id=a.card_id::int LEFT JOIN app.players p ON p.id=pc.player_id LEFT JOIN app.player_gameweek_scores s ON s.player_id=pc.player_id AND s.game_week=$2 WHERE e.competition_id=$1 AND ($3::boolean OR e.user_id=$4) AND (s.player_id IS NULL OR NOT s.is_final) LIMIT 101`,[c.id,c.gameweek,admin,target]):[];
  const allFixtures=await connections.fixtures?.().catch(()=>null)??null;
  const fixtures=allFixtures?.filter(f=>Number(f.event)===Number(c.gameweek))||[];
  const seasonMismatch=fixtures.some(f=>Math.abs(Date.parse(f.kickoff_time)-Date.parse(c.startDate))>35*86400000);
  const contextKnown=fixtures.length>0&&!seasonMismatch;
  const unfinished=contextKnown?fixtures.filter(f=>!f.finished):[];
  const issues:string[]=[];
  if(c.status==='open')issues.push('Tournament is still open.');
  if(!Number(summary.entries))issues.push('No entries recorded.');
  if(Number(summary.completeSnapshots)<Number(summary.entries))issues.push('Some entry scoring snapshots are incomplete.');
  if(Number(summary.finalSnapshots)<Number(summary.entries))issues.push('Some entry scoring snapshots are provisional.');
  if(scores.length)issues.push('Selected cards have missing or provisional score rows.');
  if(unfinished.length)issues.push(`${unfinished.length} gameweek fixtures are not marked finished.`);
  if(!contextKnown)issues.push('Matching season/gameweek fixture completion could not be verified.');
  if(!scoreTable)issues.push('Player score table is unavailable.');
  return {answer:`${issues.join(' ')||'No blockers found in the connected snapshot.'} ${c.status==='completed'?'Tournament status is completed; confirm actual prize delivery separately.':'The authoritative settlement route must refresh and recheck provider scoring before issuing prizes.'} No settlement was triggered.`,sections:[{title:'Settlement evidence',note:admin?'Current tournament-wide scoring and fixture snapshot.':'Your entries only. Other entrants’ scoring records and settlement snapshots are excluded.',rows:[{...c,...summary,fixtureContextVerified:contextKnown,unfinishedFixtures:contextKnown?unfinished.length:null}]},{title:'Missing or provisional scoring',rows:scores.slice(0,100),hasMore:scores.length>100},{title:'Unfinished fixtures',rows:unfinished.map(f=>({id:f.id,kickoff:f.kickoff_time,started:f.started,finished:f.finished}))}],followUps:[]};
}
export async function footballInvestigation(connections:AssistantConnections,context:InvestigationContext){
  if(!connections.availability)return {answer:'Live football availability is unavailable.',sections:[],followUps:[]};
  const data=await connections.availability();
  const term=String(context.playerSearch||'').toLowerCase();
  const match=(r:any)=>!term||String(r.player?.id)===term||String(r.player?.name||'').toLowerCase().includes(term)||String(r.team?.name||'').toLowerCase().includes(term);
  const rows=(items:any[])=>items.filter(match).slice(0,100).map(r=>({playerId:r.player?.id,player:r.player?.name,team:r.team?.name,status:r.availabilityStatus||r.player?.type,reason:r.player?.reason,fixtureId:r.fixture?.id,kickoff:r.fixture?.date}));
  const current=rows(data.injuries||[]),confirmed=rows(data.confirmedAvailable||[]),history=rows(data.historicalInjuries||[]);
  return {answer:`${term?`Matching “${context.playerSearch}”: `:''}${current.length} current absence reports; ${confirmed.length} confirmed match selections; ${history.length} earlier or superseded reports shown. Confirmed selections override older injury flags for the same fixture. No report is not proof of fitness. ${data.warning||''}`,sections:[{title:'Football source freshness',rows:[{checkedAt:data.asOf,injurySourceUpdatedAt:data.sourceUpdatedAt,stale:Boolean(data.stale),lineupSources:data.lineupSourceUpdatedAt}]},{title:'Current fixture absences',rows:current},{title:'Confirmed starters and bench',rows:confirmed},{title:'Earlier or superseded reports',rows:history}],followUps:['Is player “…” starting?']};
}
