import "./apply-gw1-entry-extension-v2.mjs";
import "./apply-admin-readonly-bypass.mjs";
import fs from "node:fs";

const file = "server/routes/onboarding.routes.ts";
const source = fs.readFileSync(file, "utf8");

if (source.includes("FAIR_STARTER_DRAFT_V1")) {
  console.log("Starter Draft full-squad randomization already applied.");
  process.exit(0);
}

const startMarker = "  const getOnboardingPlayerPool = async () => {";
const endMarker = "  const buildPackCards = (playersPool: any[]) => {";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Could not locate onboarding player-pool function for Starter Draft randomization patch.");
}

const replacement = `  const getOnboardingPlayerPool = async () => {
    // FAIR_STARTER_DRAFT_V1
    // Draw Starter Draft offers from the complete CURRENT Premier League/FPL
    // player list before touching the local player table. This avoids the old
    // starts/minutes/top-120 and matchday-team bias that made the same popular
    // players appear disproportionately often for new signups.
    const [fplPlayers, bootstrap] = await Promise.all([
      fplApi.getPlayers(),
      fplApi.bootstrap(),
    ]);

    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const teamMap = new Map<number, any>(teams.map((t: any) => [Number(t.id), t] as [number, any]));
    const currentTeamIds = new Set<number>(teams.map((team: any) => Number(team.id)).filter((id: number) => Number.isFinite(id) && id > 0));
    const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

    const currentPlayers = (Array.isArray(fplPlayers) ? fplPlayers : []).filter((player: any) => {
      const teamId = Number(player?.team);
      const elementType = Number(player?.element_type);
      return currentTeamIds.has(teamId) && Boolean(positionMap[elementType]);
    });

    const byPosition = {
      GK: currentPlayers.filter((player: any) => Number(player.element_type) === 1),
      DEF: currentPlayers.filter((player: any) => Number(player.element_type) === 2),
      MID: currentPlayers.filter((player: any) => Number(player.element_type) === 3),
      FWD: currentPlayers.filter((player: any) => Number(player.element_type) === 4),
    };

    if (byPosition.GK.length < 3 || byPosition.DEF.length < 3 || byPosition.MID.length < 3 || byPosition.FWD.length < 3) {
      console.warn("Starter Draft cannot build a full offer from the current Premier League player list", {
        gk: byPosition.GK.length,
        def: byPosition.DEF.length,
        mid: byPosition.MID.length,
        fwd: byPosition.FWD.length,
      });
      return [];
    }

    // Every current player in the relevant position pool has the same chance
    // of being drawn. Choose the four required rows first, then draw three
    // wildcards from every remaining current Premier League player.
    const requiredPlayers = [
      ...shuffle(byPosition.GK).slice(0, 3),
      ...shuffle(byPosition.DEF).slice(0, 3),
      ...shuffle(byPosition.MID).slice(0, 3),
      ...shuffle(byPosition.FWD).slice(0, 3),
    ];
    const usedFplIds = new Set<number>(requiredPlayers.map((player: any) => Number(player.id)));
    const wildcardPlayers = shuffle(currentPlayers.filter((player: any) => !usedFplIds.has(Number(player.id)))).slice(0, 3);
    const candidates = [...requiredPlayers, ...wildcardPlayers];

    if (candidates.length !== 15) {
      console.warn("Starter Draft did not produce exactly 15 unique current-player candidates", { count: candidates.length });
      return [];
    }

    const existingPlayers = await storage.getPlayers();
    const mapKey = (name: string, team: string, pos: string) => \`${"${name.toLowerCase()}::${team.toLowerCase()}::${pos}"}\`;
    const existingMap = new Map<string, any>();
    existingPlayers.forEach((p: any) => existingMap.set(mapKey(String(p.name), String(p.team), String(p.position)), p));

    const ensurePlayer = async (fplPlayer: any) => {
      const teamName = String(teamMap.get(Number(fplPlayer.team))?.name || "Unknown");
      const position = positionMap[Number(fplPlayer.element_type)] || "MID";
      const fullName = \`${"${String(fplPlayer.first_name || \"\").trim()} ${String(fplPlayer.second_name || \"\").trim()}"}\`.trim() || String(fplPlayer.web_name || "Unknown");
      const key = mapKey(fullName, teamName, position);
      const existing = existingMap.get(key);
      if (existing) return existing;

      const photoUrl = fplApi.playerPhotoUrl(fplPlayer, 250);
      const overall = Math.max(55, Math.min(95, Math.round(Number(fplPlayer.now_cost || 50) + 30)));
      const created = await storage.createPlayer({
        name: fullName,
        team: teamName,
        league: "Premier League",
        position,
        nationality: "Unknown",
        age: 24,
        overall,
        imageUrl: photoUrl,
      } as any);
      existingMap.set(key, created);
      return created;
    };

    const result: any[] = [];
    for (const player of candidates) result.push(await ensurePlayer(player));
    return result;
  };

`;

const next = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, next);
console.log("Applied full current-Premier-League Starter Draft randomization.");