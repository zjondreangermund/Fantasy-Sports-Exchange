/** Presentation normalization only: never add together repeated provider snapshots. */
type Row = Record<string, any>;
const list = (value: any): Row[] => Array.isArray(value) ? value.filter(item=>item!=null) : [];
export const footballText = (value: unknown) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const id = (value: any) => value != null && value !== '' && value !== 0 && value !== '0' ? String(value) : '';
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? '';
}
export function uniqueFootballRows<T>(rows: readonly T[] | null | undefined, key: (row: T) => string = row=>canonical(row)): T[] {
  const result=new Map<string,T>();
  for (const row of Array.isArray(rows)?rows:[]) { if(row!=null)result.set(key(row),row); }
  return [...result.values()];
}
export const footballTeamKey = (row: any) => {
  const team=row?.team ?? row?.statistics?.[0]?.team;
  return id(team?.id ?? row?.teamId) || footballText(typeof team==='string'?team:team?.name || row?.teamName) || 'unknown-team';
};
export const footballPlayerKey = (row: any) => id(row?.player?.id ?? row?.playerId ?? row?.id) || footballText(row?.player?.name || row?.playerName || row?.name) || canonical(row);
export const footballFixtureKey = (row: any) => {
  const fixtureId=id(row?.fixture?.id ?? row?.fixtureId ?? row?.id);
  if(fixtureId)return fixtureId;
  const parts=[row?.league?.id || row?.leagueId,row?.teams?.home?.id || row?.homeTeam?.id || row?.team_h || row?.homeTeam,row?.teams?.away?.id || row?.awayTeam?.id || row?.team_a || row?.awayTeam,row?.fixture?.date || row?.kickoffTime || row?.kickoff_time || row?.matchDate || row?.date];
  return parts.some(Boolean)?canonical(parts):canonical(row);
};
const fixtureDate = (row: any) => {
  const date=Date.parse(String(row?.fixture?.date || row?.updatedAt || row?.date || ''));
  return Number.isFinite(date)?date:0;
};
export function dedupeAvailability(rows: any): Row[] {
  // Alias an ID-less row only when its name identifies exactly one ID in that club.
  const aliases=new Map<string,Set<string>>();
  for(const row of list(rows)) {
    const name=`${footballTeamKey(row)}:${footballText(row?.player?.name || row?.playerName || row?.name)}`;
    const playerId=id(row?.player?.id ?? row?.playerId ?? row?.id);
    if(!aliases.has(name))aliases.set(name,new Set());
    if(playerId)aliases.get(name)!.add(playerId);
  }
  const byPlayer=new Map<string,Row>();
  for(const row of list(rows)) {
    const team=footballTeamKey(row), name=footballText(row?.player?.name || row?.playerName || row?.name);
    const ids=aliases.get(`${team}:${name}`);
    const player=id(row?.player?.id ?? row?.playerId ?? row?.id) || (ids?.size===1?[...ids][0]:name) || canonical(row);
    const key=`${team}:${player}`;
    const previous=byPlayer.get(key);
    if(!previous || fixtureDate(row)>=fixtureDate(previous))byPlayer.set(key,row);
  }
  return [...byPlayer.values()];
}
export function groupAvailabilityByTeam(rows: any) {
  const teams=new Map<string,{key:string;name:string;logo:string;players:Row[]}>();
  for(const row of dedupeAvailability(rows)) {
    const key=footballTeamKey(row),team=row?.team;
    if(!teams.has(key))teams.set(key,{key,name:String(typeof team==='string'?team:team?.name || row?.teamName || 'Other'),logo:String(team?.logo || ''),players:[]});
    teams.get(key)!.players.push(row);
  }
  return [...teams.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(team=>({...team,players:team.players.sort((a,b)=>String(a?.player?.name || a?.name || a?.playerName).localeCompare(String(b?.player?.name || b?.name || b?.playerName)))}));
}
function normalizePlayers(rows: any): Row[] {
  const players=new Map<string,Row>();
  for(const row of list(rows)) {
    const key=footballPlayerKey(row),old=players.get(key);
    const stats=[...list(old?.statistics),...list(row.statistics)];
    players.set(key,{...old,...row,...(stats.length?{statistics:uniqueFootballRows(stats,(stat:any)=>canonical([stat.team?.id || stat.team?.name,stat.league?.id,stat.league?.season]))}:{})});
  }
  return [...players.values()];
}
function normalizeTransfers(rows:any) {
  const players=new Map<string,Row>();
  const singles:Row[]=[];
  for(const row of list(rows)) {
    if(!Array.isArray(row.transfers)) { singles.push(row);continue; }
    const key=footballPlayerKey(row),previous=players.get(key);
    players.set(key,{...previous,...row,transfers:uniqueFootballRows([...list(previous?.transfers),...row.transfers])});
  }
  return [...players.values(),...uniqueFootballRows(singles)];
}
function standingsGroups(groups: any) {
  return uniqueFootballRows(list(groups).map(group=>uniqueFootballRows(list(group),(row:any)=>`${footballText(row.group)}:${footballTeamKey(row)}`)),group=>canonical(group.map((row:any)=>`${footballText(row.group)}:${footballTeamKey(row)}`).sort()));
}
function normalizeTeamBlocks(rows: any,kind:'lineups'|'statistics'|'players') {
  return uniqueFootballRows(list(rows),footballTeamKey).map(row=>({...row,
    ...(kind==='lineups'?{startXI:normalizePlayers(row.startXI),substitutes:normalizePlayers(row.substitutes).filter(player=>!list(row.startXI).some(starter=>footballPlayerKey(starter)===footballPlayerKey(player)))}:{}),
    ...(kind==='statistics'?{statistics:uniqueFootballRows(row.statistics,(stat:any)=>footballText(stat.type))}:{}),
    ...(kind==='players'?{players:normalizePlayers(row.players)}:{})}));
}
/** Normalizes both fresh provider responses and previously cached browser/API payloads. */
export function normalizeFootballData(payload: any): any {
  if(!payload || typeof payload!=='object' || Array.isArray(payload))return payload;
  const out={...payload};
  for(const field of ['fixtures','headToHead','recent','upcoming','liveGames','games'])if(Array.isArray(out[field]))out[field]=uniqueFootballRows(out[field],footballFixtureKey);
  if(Array.isArray(out.injuries))out.injuries=dedupeAvailability(out.injuries);
  if(Array.isArray(out.groups))out.groups=standingsGroups(out.groups);
  if(Array.isArray(out.standings))out.standings=uniqueFootballRows(out.standings,(row:any)=>`${footballText(row.group)}:${footballTeamKey(row)}`);
  for(const field of ['topScorers','topAssists','topYellowCards','topRedCards','players'])if(Array.isArray(out[field])) {
    out[field]=out[field].some((row:any)=>Array.isArray(row.players))?normalizeTeamBlocks(out[field],'players'):normalizePlayers(out[field]);
  }
  if(Array.isArray(out.teams))out.teams=uniqueFootballRows(out.teams,(row:any)=>footballTeamKey(row.team?row:{team:row}));
  if(Array.isArray(out.coaches))out.coaches=uniqueFootballRows(out.coaches,(row:any)=>id(row.id)||footballText(row.name));
  for(const field of ['lineups','statistics','halfStatistics'])if(Array.isArray(out[field]))out[field]=normalizeTeamBlocks(out[field],field==='lineups'?'lineups':'statistics');
  if(Array.isArray(out.rounds))out.rounds=uniqueFootballRows(out.rounds,(row:any)=>footballText(typeof row==='string'?row:row?.round || row?.name) || canonical(row));
  for(const field of ['events','trophies','sidelined'])if(Array.isArray(out[field]))out[field]=uniqueFootballRows(out[field]);
  if(Array.isArray(out.transfers))out.transfers=normalizeTransfers(out.transfers);
  if(out.profile?.statistics)out.profile={...out.profile,statistics:uniqueFootballRows(out.profile.statistics,(stat:any)=>canonical([stat.team?.id || stat.team?.name,stat.league?.id,stat.league?.season]))};
  if(out.profile?.career)out.profile={...out.profile,career:uniqueFootballRows(out.profile.career)};
  if(out.form?.matches)out.form={...out.form,matches:uniqueFootballRows(out.form.matches,footballFixtureKey)};
  return out;
}
