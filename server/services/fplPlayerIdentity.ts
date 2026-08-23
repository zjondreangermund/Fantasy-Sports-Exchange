// STRICT_PLAYER_IDENTITY_FIX_V3_POSITION_LOCK
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

/** Fantasy Arena OVR: a platform rating derived from verified FPL inputs, not an official league rating. */
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

function normalizedNames(player: any): string[] {
  return Array.from(
    new Set(
      [player?.name, player?.webName, player?.web_name]
        .map(normalizePlayerText)
        .filter(Boolean),
    ),
  );
}

function tokens(value: string): string[] {
  return normalizePlayerText(value)
    .split(" ")
    .filter(Boolean);
}

function firstNameCompatible(left: string, right: string): boolean {
  if (left === right) return true;
  if ((left.length === 1 || right.length === 1) && left[0] === right[0]) return true;
  if (left.length < 3 || right.length < 3) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return longer.startsWith(shorter);
}

export function strongPlayerNameMatch(left: unknown, right: unknown): boolean {
  const a = normalizePlayerText(left);
  const b = normalizePlayerText(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.length < 2 || bTokens.length < 2) return false;
  if (!firstNameCompatible(aTokens[0], bTokens[0])) return false;

  const surnamesA = new Set(aTokens.slice(1).filter((token) => token.length > 1));
  return bTokens.slice(1).some((token) => token.length > 1 && surnamesA.has(token));
}

function normalizedPlayerPosition(value: unknown): FplPosition | "" {
  const position = String(value || "").trim().toUpperCase();
  return position === "GK" || position === "DEF" || position === "MID" || position === "FWD"
    ? position as FplPosition
    : "";
}

function positionCompatible(player: any, element: any): boolean {
  const storedPosition = normalizedPlayerPosition(player?.position);
  return !storedPosition || fplPlayerPosition(element) === storedPosition;
}

function playerMatchesElement(player: any, element: any): boolean {
  if (!positionCompatible(player, element)) return false;
  const names = normalizedNames(player);
  const elementNames = [fplPlayerFullName(element), element?.web_name]
    .map(normalizePlayerText)
    .filter(Boolean);
  return names.some((name) =>
    elementNames.some((candidate) => strongPlayerNameMatch(name, candidate)),
  );
}

export function buildFplPlayerIndex(bootstrap: any) {
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const teamById = new Map<number, any>(
    teams.map((team: any) => [Number(team.id), team]),
  );
  const byId = new Map<number, any>();
  const byCode = new Map<number, any>();
  const byName = new Map<string, any[]>();

  const addName = (value: unknown, element: any) => {
    const key = normalizePlayerText(value);
    if (!key) return;
    const list = byName.get(key) || [];
    if (!list.some((candidate) => Number(candidate.id) === Number(element.id))) {
      list.push(element);
    }
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

  const chooseCandidate = (player: any, candidates: any[]) => {
    const unique = Array.from(
      new Map(
        candidates.map((candidate) => [Number(candidate.id), candidate]),
      ).values(),
    ) as any[];

    if (unique.length === 1) return unique[0];

    const playerTeam = normalizePlayerText(player?.team);
    const playerPosition = String(player?.position || "").toUpperCase();

    if (playerTeam) {
      const teamMatches = unique.filter(
        (candidate) => normalizePlayerText(teamNameOf(candidate)) === playerTeam,
      );
      if (teamMatches.length === 1) return teamMatches[0];
    }

    if (playerPosition) {
      const positionMatches = unique.filter(
        (candidate) => fplPlayerPosition(candidate) === playerPosition,
      );
      if (positionMatches.length === 1) return positionMatches[0];
    }

    return null;
  };

  const resolve = (player: any) => {
    const storedCandidateIsSafe = (candidate: any) => {
      if (!candidate || !playerMatchesElement(player, candidate)) return false;
      const playerTeam = normalizePlayerText(player?.team);
      if (!playerTeam || normalizePlayerText(teamNameOf(candidate)) === playerTeam) return true;

      // A player may have transferred since this legacy card was minted. Keep
      // that valid stored ID unless another identity match exists at the
      // card's recorded club; in that case the stored ID is ambiguous/stale.
      return !elements.some((other: any) =>
        Number(other?.id || 0) !== Number(candidate?.id || 0)
        && normalizePlayerText(teamNameOf(other)) === playerTeam
        && playerMatchesElement(player, other),
      );
    };
    const fplId = numericField(player, "fplId", "fpl_id");
    const byStoredId = fplId > 0 ? byId.get(fplId) : null;
    if (storedCandidateIsSafe(byStoredId)) {
      return byStoredId;
    }

    const code = numericField(player, "code", "code");
    const byStoredCode = code > 0 ? byCode.get(code) : null;
    if (storedCandidateIsSafe(byStoredCode)) {
      return byStoredCode;
    }

    const exactCandidates: any[] = [];
    for (const name of normalizedNames(player)) {
      exactCandidates.push(...(byName.get(name) || []));
    }
    const exact = chooseCandidate(
      player,
      exactCandidates.filter((candidate) =>
        playerMatchesElement(player, candidate),
      ),
    );
    if (exact) return exact;

    const strongCandidates = elements.filter((candidate: any) =>
      playerMatchesElement(player, candidate),
    );
    return chooseCandidate(player, strongCandidates);
  };

  const canonical = (element: any) => ({
    name: fplPlayerFullName(element),
    webName: String(element?.web_name || fplPlayerFullName(element)).trim(),
    team: teamNameOf(element),
    league: "Premier League",
    position: fplPlayerPosition(element),
    fplId: Number(element?.id || 0),
    code: Number(element?.code || 0) || null,
    totalPoints: Number(element?.total_points || 0),
    form: Number(element?.form || 0),
    overall: overallFromFplElement(element),
  });

  return {
    teams,
    elements,
    teamById,
    byId,
    byCode,
    byName,
    resolve,
    teamNameOf,
    canonical,
  };
}
