export function gameweekHasKickedOff(fixtures: any[], gameweek: number, now=Date.now()): boolean {
  return fixtures.some(f=>Number(f?.event)===gameweek && (Boolean(f.started || f.finished || f.finished_provisional) || (Number.isFinite(Date.parse(String(f.kickoff_time||''))) && Date.parse(String(f.kickoff_time))<=now)));
}
export function availabilityReminderCopy(locked: boolean) {
  return locked ? {
    title:'Premier League games are about to resume',
    message:'Premier League games are about to resume. Check injuries, suspensions and confirmed starting lineups on the Premier League page. This gameweek is already locked: teams and captains cannot be edited after its first match kicks off. Later matches do not reopen team editing.',
  } : {
    title:'Premier League kickoff is approaching',
    message:'Premier League kickoff is approaching. Check injuries, suspensions and confirmed starting lineups. You can edit your submitted team and captain in My Entries only before the first match of this gameweek kicks off. After that first kickoff, teams remain locked for the rest of the gameweek.',
  };
}
export function playerAvailabilityCopy(player: string,label: string,locked: boolean) {
  return `${player} is ${label} in the official Premier League data and is in your submitted team. ${locked?'This gameweek has already started. Teams and captains are locked; later fixtures do not reopen editing. Check availability on the Premier League page and plan for future gameweeks.':'Check this player and edit your team or captain in My Entries before this gameweek’s first kickoff. No changes are allowed after the first match begins.'}`;
}
