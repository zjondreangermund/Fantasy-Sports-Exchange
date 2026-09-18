export const INACTIVE_PREMIER_LEAGUE_STATUSES = new Set([
  "departed",
  "superseded",
  "unlinked",
  "archived",
]);

export function apiFootballCurrentSquadDirectoryHealthy(directory: any[]): boolean {
  const rows = Array.isArray(directory) ? directory : [];
  const teamIds = new Set(
    rows
      .map((player) => Number(player?.apiTeamId || 0))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
  return rows.length >= 250 && teamIds.size >= 18;
}

export function storedPlayerExplicitlyOutsidePremierLeague(player: any): boolean {
  const league = String(player?.league || "").trim().toLowerCase();
  const status = String(player?.status || "").trim().toLowerCase();
  return league === "outside premier league" || INACTIVE_PREMIER_LEAGUE_STATUSES.has(status);
}

export function currentPremierLeagueIdentityVerified(input: {
  player: any;
  apiFootballPlayer: any;
  matchedFplElement: any;
  directory: any[];
}): boolean {
  if (storedPlayerExplicitlyOutsidePremierLeague(input.player)) return false;
  if (apiFootballCurrentSquadDirectoryHealthy(input.directory)) {
    // A healthy current-squad directory is stronger than a stale provider/FPL
    // identity link. Players on loan or transferred outside the EPL must not
    // score merely because an old FPL element still resolves.
    return Boolean(input.apiFootballPlayer);
  }
  return Boolean(input.apiFootballPlayer || input.matchedFplElement);
}
