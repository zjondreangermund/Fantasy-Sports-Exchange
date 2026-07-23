export type FplPosition = "GK" | "DEF" | "MID" | "FWD";

export const FPL_POSITION_BY_ELEMENT_TYPE: Record<number, FplPosition> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export function normalizePlayerText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fplPlayerFullName(element: any): string {
  const fullName = `${String(element?.first_name || "").trim()} ${String(element?.second_name || "").trim()}`.trim();
  return fullName || String(element?.web_name || "Unknown Player").trim();
}

export function fplPlayerPosition(element: any): FplPosition {
  return FPL_POSITION_BY_ELEMENT_TYPE[Number(element?.element_type)] || "MID";
}

export function overallFromFplElement(element: any): number {
  const toNumber = (value: unknown, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const total = toNumber(element?.total_points, 0);
  const form = toNumber(element?.form, 0);
  const minutes = toNumber(element?.minutes, 0);
  const influence = toNumber(element?.influence, 0);
  return Math.max(
    1,
    Math.min(
      99,
      Math.round(
        35
          + Math.min(35, total / 6)
          + Math.min(15, form * 1.8)
          + Math.min(10, minutes / 260)
          + Math.min(4, influence / 250),
      ),
    ),
  );
}

function numericField(source: any, camel: string, snake: string): number {
  const value = Number(source?.[camel] ?? source?.[snake] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function buildFplPlayerIndex(bootstrap: any) {
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const teamById = new Map<number, any>(teams.map((team: any) => [Number(team.id), team]));
  const byId = new Map<number, any>();
  const byCode = new Map<number, any>();
  const byName = new Map<string, any[]>();

  const addName = (value: unknown, element: any) => {
    const key = normalizePlayerText(value);
    if (!key) return;
    const list = byName.get(key) || [];
    if (!list.some((candidate) => Number(candidate.id) === Number(element.id))) list.push(element);
    byName.set(key, list);
  };

  for (const element of elements) {
    const id = Number(element?.id || 0);
    const code = Number(element?.code || 0);
    if (id > 0) byId.set(id, element);
    if (code > 0) byCode.set(code, element);
    addName(fplPlayerFullName(element), element);
    addName(element?.web_name, element);
  }

  const teamNameOf = (element: any) => {
    const team = teamById.get(Number(element?.team));
    return String(team?.name || team?.short_name || "Premier League").trim();
  };

  const resolve = (player: any) => {
    const fplId = numericField(player, "fplId", "fpl_id");
    if (fplId > 0 && byId.has(fplId)) return byId.get(fplId) || null;

    const code = numericField(player, "code", "code");
    if (code > 0 && byCode.has(code)) return byCode.get(code) || null;

    const playerTeam = normalizePlayerText(player?.team);
    const names = [player?.name, player?.webName, player?.web_name]
      .map(normalizePlayerText)
      .filter(Boolean);

    for (const name of names) {
      const candidates = byName.get(name) || [];
      if (candidates.length === 1) return candidates[0];
      if (playerTeam && candidates.length > 1) {
        const teamMatch = candidates.find((candidate) => normalizePlayerText(teamNameOf(candidate)) === playerTeam);
        if (teamMatch) return teamMatch;
      }
    }

    return null;
  };

  const canonical = (element: any) => ({
    name: fplPlayerFullName(element),
    webName: String(element?.web_name || fplPlayerFullName(element)).trim(),
    team: teamNameOf(element),
    position: fplPlayerPosition(element),
    imageUrl: String(element?.photo || element?.code || "").trim(),
    fplId: Number(element?.id || 0),
    code: Number(element?.code || 0) || null,
    totalPoints: Number(element?.total_points || 0),
    form: Number(element?.form || 0),
    overall: overallFromFplElement(element),
  });

  return { teams, elements, teamById, byId, byCode, byName, resolve, teamNameOf, canonical };
}
