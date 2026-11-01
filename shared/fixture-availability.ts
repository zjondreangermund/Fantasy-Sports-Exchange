import {dedupeAvailability,footballPlayerKey,footballTeamKey} from './football-data.js';
const rows=(v:any):any[]=>Array.isArray(v)?v:[];
const fixtureId=(f:any)=>Number(f?.fixture?.id||f?.id||0);
const kickoff=(f:any)=>Date.parse(String(f?.fixture?.date||f?.kickoffTime||''));
const status=(f:any)=>String(f?.fixture?.status?.short||f?.status||'').toUpperCase();
const done=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO','PST']);
/** Lineup presence proves a matchday selection, not medical fitness or selection in a future game. */
export function resolveFixtureAvailability(reports:any,fixtures:any,lineups:Array<{fixtureId:number;lineups:any[]}>,now=Date.now()){
  const relevant=rows(fixtures).filter(f=>Number.isFinite(kickoff(f))&&!done.has(status(f))&&kickoff(f)>=now-4*3600000).sort((a,b)=>kickoff(a)-kickoff(b));
  const nextByTeam=new Map<number,any>();
  for(const f of relevant)for(const team of [f?.teams?.home||f?.homeTeam,f?.teams?.away||f?.awayTeam])if(Number(team?.id)>0&&!nextByTeam.has(Number(team.id)))nextByTeam.set(Number(team.id),f);
  const selected=new Map<string,{row:any;fixture:any;state:string}>();
  for(const bundle of lineups){
    const f=relevant.find(f=>fixtureId(f)===Number(bundle.fixtureId));
    if(!f)continue;
    for(const teamLineup of rows(bundle.lineups)){
      if(fixtureId(nextByTeam.get(Number(teamLineup.team?.id)))!==fixtureId(f))continue;
      for(const [items,state] of [[teamLineup.startXI,'confirmed_starter'],[teamLineup.substitutes,'confirmed_bench']] as const)for(const player of rows(items)){
        // Confirmed IDs only: never clear another player's warning based on a similar name.
        if(Number(player?.player?.id)>0)selected.set(`${teamLineup.team?.id}:${player.player.id}`,{row:{player:player.player,team:teamLineup.team},fixture:f,state});
      }
    }
  }
  const current:any[]=[],historical:any[]=[],confirmed=new Map<string,any>();
  for(const row of rows(reports)){
    const key=`${footballTeamKey(row)}:${footballPlayerKey(row)}`,selection=selected.get(key);
    const next=nextByTeam.get(Number(row?.team?.id));
    const reportFixtureId=Number(row?.fixture?.id||0);
    const currentFixture=next&&reportFixtureId===fixtureId(next);
    if(selection){
      const f=selection.fixture;
      confirmed.set(key,{...row,...selection.row,fixture:{id:fixtureId(f),date:f?.fixture?.date||f?.kickoffTime},availabilityStatus:selection.state,player:{...row.player,...selection.row.player,type:selection.state==='confirmed_starter'?'Confirmed starter':'Confirmed substitute',reason:'Named in the confirmed lineup for this fixture. Older injury reports do not determine this matchday selection.'}});
      historical.push({...row,availabilityStatus:currentFixture?'superseded_by_lineup':Date.parse(String(row?.fixture?.date))>=now?'other_fixture':'historical'});
    }else if(currentFixture)current.push({...row,availabilityStatus:'reported_absence'});
    else historical.push({...row,availabilityStatus:Date.parse(String(row?.fixture?.date))>=now?'other_fixture':'historical'});
  }
  return {injuries:dedupeAvailability(current),confirmedAvailable:[...confirmed.values()],historicalInjuries:dedupeAvailability(historical),scope:'next_or_live_fixture',updatedAt:new Date(now).toISOString()};
}
