#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const marker = "STRICT_PLAYER_IDENTITY_FIX_V1";

function replaceExact(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: expected source block was not found`);
  write(file, source.replace(before, after));
}

function replaceRegex(file, pattern, replacement) {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(`${file}: expected source pattern was not found`);
  write(file, source.replace(pattern, replacement));
}

if (read("server/services/fplPlayerIdentity.ts").includes(marker)) {
  console.log("Strict player identity and fixtures repair already applied.");
  process.exit(0);
}

write("server/services/fplPlayerIdentity.ts", `// ${marker}
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
  const fullName = \`${String(element?.first_name || "").trim()} ${String(element?.second_name || "").trim()}\`.trim();
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
  return Math.max(1, Math.min(99, Math.round(35 + Math.min(35, total / 6) + Math.min(15, form * 1.8) + Math.min(10, minutes / 260) + Math.min(4, influence / 250))));
}

function numericField(source: any, camel: string, snake: string): number {
  const value = Number(source?.[camel] ?? source?.[snake] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function normalizedNames(player: any): string[] {
  return Array.from(new Set([player?.name, player?.webName, player?.web_name]
    .map(normalizePlayerText)
    .filter(Boolean)));
}

function tokens(value: string): string[] {
  return normalizePlayerText(value).split(" ").filter((token) => token.length > 1);
}

export function strongPlayerNameMatch(left: unknown, right: unknown): boolean {
  const a = normalizePlayerText(left);
  const b = normalizePlayerText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = tokens(a);
  const bTokens = tokens(b);
  if (aTokens.length < 2 || bTokens.length < 2) return false;
  const firstA = aTokens[0];
  const firstB = bTokens[0];
  const firstCompatible = firstA === firstB || (firstA.length >= 3 && firstB.length >= 3 && (firstA.startsWith(firstB) || firstB.startsWith(firstA)));
  if (!firstCompatible) return false;
  const surnamesA = new Set(aTokens.slice(1));
  const surnameOverlap = bTokens.slice(1).filter((token) => surnamesA.has(token));
  return surnameOverlap.length >= 1;
}

function playerMatchesElement(player: any, element: any): boolean {
  const names = normalizedNames(player);
  const elementNames = [fplPlayerFullName(element), element?.web_name].map(normalizePlayerText).filter(Boolean);
  return names.some((name) => elementNames.some((candidate) => strongPlayerNameMatch(name, candidate)));
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

  const chooseCandidate = (player: any, candidates: any[]) => {
    const unique = Array.from(new Map(candidates.map((candidate) => [Number(candidate.id), candidate])).values());
    if (unique.length === 1) return unique[0];
    const playerTeam = normalizePlayerText(player?.team);
    const playerPosition = String(player?.position || "").toUpperCase();
    if (playerTeam) {
      const teamMatches = unique.filter((candidate) => normalizePlayerText(teamNameOf(candidate)) === playerTeam);
      if (teamMatches.length === 1) return teamMatches[0];
    }
    if (playerPosition) {
      const positionMatches = unique.filter((candidate) => fplPlayerPosition(candidate) === playerPosition);
      if (positionMatches.length === 1) return positionMatches[0];
    }
    return null;
  };

  const resolve = (player: any) => {
    const fplId = numericField(player, "fplId", "fpl_id");
    const byStoredId = fplId > 0 ? byId.get(fplId) : null;
    if (byStoredId && playerMatchesElement(player, byStoredId)) return byStoredId;

    const code = numericField(player, "code", "code");
    const byStoredCode = code > 0 ? byCode.get(code) : null;
    if (byStoredCode && playerMatchesElement(player, byStoredCode)) return byStoredCode;

    const exactCandidates: any[] = [];
    for (const name of normalizedNames(player)) exactCandidates.push(...(byName.get(name) || []));
    const exact = chooseCandidate(player, exactCandidates.filter((candidate) => playerMatchesElement(player, candidate)));
    if (exact) return exact;

    const strongCandidates = elements.filter((candidate: any) => playerMatchesElement(player, candidate));
    return chooseCandidate(player, strongCandidates);
  };

  const canonical = (element: any) => ({
    name: fplPlayerFullName(element),
    webName: String(element?.web_name || fplPlayerFullName(element)).trim(),
    team: teamNameOf(element),
    position: fplPlayerPosition(element),
    fplId: Number(element?.id || 0),
    code: Number(element?.code || 0) || null,
    totalPoints: Number(element?.total_points || 0),
    form: Number(element?.form || 0),
    overall: overallFromFplElement(element),
  });

  return { teams, elements, teamById, byId, byCode, byName, resolve, teamNameOf, canonical };
}
`);

write("client/src/lib/card-image.ts", `// ${marker}
import { type PlayerCardWithPlayer } from "../../../shared/schema";

export const CARD_IMAGE_FALLBACK = "/players/fallback.svg";
const LOCAL_PLACEHOLDER_PATTERN = /\\/(images\\/player-\\d+|players\\/fallback)\\.(png|jpg|jpeg|svg|webp)$/i;

type CardLike = Partial<PlayerCardWithPlayer> & {
  player?: {
    id?: number | string | null;
    fplId?: number | string | null;
    code?: number | string | null;
    name?: string | null;
    team?: string | null;
    club?: string | null;
    photo?: string | null;
    photoUrl?: string | null;
    image?: string | null;
    imageUrl?: string | null;
    verifiedImageUrl?: string | null;
    image_url?: string | null;
    officialPortraitUrl?: string | null;
    headshotUrl?: string | null;
    cutoutUrl?: string | null;
    fallbackImageUrl?: string | null;
    imageCandidates?: string[] | null;
    identitySource?: string | null;
    identityVerified?: boolean | null;
    apiFootballId?: number | string | null;
  } | null;
};

export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:)?\\/\\//i.test(value) || value.startsWith("data:")) return value;
  return value.startsWith("/") ? value : \`/${value}\`;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function premierLeaguePhotoFromCode(value?: string | number | null): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  const match = text.match(/(\\d+)/);
  if (!match) return null;
  return \`https://resources.premierleague.com/premierleague/photos/players/250x250/p${match[1]}.png\`;
}

export function toSafeImageUrl(url: string): string {
  if (/^https?:\\/\\/resources\\.premierleague\\.com\\//i.test(url)) return \`/api/image-proxy?url=${encodeURIComponent(url)}\`;
  return url;
}

export function isVerifiedPlayerIdentity(player: CardLike["player"]): boolean {
  if (!player) return false;
  if (player.identityVerified === true) return true;
  const source = String(player.identitySource || "").toLowerCase();
  return source === "fpl" || source === "api-football-current-squad" || source === "fpl+api-football" || source === "api-football";
}

export function buildCardImageCandidates(card: CardLike | null | undefined): string[] {
  const player = card?.player;
  const verified = isVerifiedPlayerIdentity(player);
  const candidates: string[] = [];

  if (verified) {
    const verifiedImage = normalizeImageUrl(player?.verifiedImageUrl);
    if (verifiedImage && !LOCAL_PLACEHOLDER_PATTERN.test(verifiedImage)) candidates.push(toSafeImageUrl(verifiedImage));

    for (const codeLike of [player?.code, player?.photo]) {
      const plPhoto = premierLeaguePhotoFromCode(codeLike);
      if (plPhoto) candidates.push(toSafeImageUrl(plPhoto));
    }

    const rawValues = uniqueStrings([
      player?.officialPortraitUrl,
      player?.cutoutUrl,
      player?.headshotUrl,
      player?.imageUrl,
      player?.image_url,
      player?.image,
      player?.photoUrl,
      ...(Array.isArray(player?.imageCandidates) ? player?.imageCandidates || [] : []),
    ]);

    for (const raw of rawValues) {
      const normalized = normalizeImageUrl(raw);
      if (!normalized || LOCAL_PLACEHOLDER_PATTERN.test(normalized)) continue;
      candidates.push(toSafeImageUrl(normalized));
    }
  }

  candidates.push(CARD_IMAGE_FALLBACK);
  return Array.from(new Set(candidates.filter(Boolean)));
}
`);

replaceExact(
  "server/services/apiFootballPlayerDirectory.ts",
`function aliasesOf(candidate: ApiFootballDirectoryPlayer) {
  return Array.from(new Set([
    normalizePlayerText(candidate.name),
    normalizePlayerText(\`${candidate.firstName} ${candidate.lastName}\`),
    normalizePlayerText(candidate.lastName),
  ].filter(Boolean)));
}`,
`function aliasesOf(candidate: ApiFootballDirectoryPlayer) {
  return Array.from(new Set([
    normalizePlayerText(candidate.name),
    normalizePlayerText(\`${candidate.firstName} ${candidate.lastName}\`),
  ].filter(Boolean)));
}`,
);

replaceExact(
  "server/services/apiFootballPlayerDirectory.ts",
`  if (source.length === 1 && candidateTokens.has(source[0]) && source[0].length >= 4) return 65;
  return 0;`,
`  return 0;`,
);

replaceExact(
  "server/services/apiFootballPlayerDirectory.ts",
`  }).filter((row) => row.nameScore >= 65).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 88) return null;
  const second = scored[1];
  if (second && best.nameScore < 120 && best.score - second.score < 10) return null;
  return best.candidate;`,
`  }).filter((row) => row.nameScore >= 92 && (!rawPosition || rawPosition === row.candidate.position || row.nameScore >= 105)).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.nameScore < 92) return null;
  const second = scored[1];
  if (second && best.nameScore < 120 && best.score - second.score < 12) return null;
  return best.candidate;`,
);

replaceExact(
  "server/index.ts",
`async function resolveFplPlayerImage(name: string, team: string) { const { fplApi } = await import("./services/fplApi.js"); const bootstrap = await fplApi.bootstrap(); const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : []; const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : []; const normalizedName = normalizeSearch(name); const normalizedTeam = normalizeSearch(team); const teamNameById = new Map<number, string>(); for (const item of teams) teamNameById.set(Number(item.id), normalizeSearch(String(item.name || item.short_name || ""))); const matches = elements.map((element: any) => { const fullName = normalizeSearch(\`${String(element.first_name || "")} ${String(element.second_name || "")}\`.trim()); const webName = normalizeSearch(String(element.web_name || "")); const elementTeam = teamNameById.get(Number(element.team)) || ""; let score = 0; if (fullName === normalizedName || webName === normalizedName) score += 40; if (fullName.includes(normalizedName) || normalizedName.includes(fullName) || webName.includes(normalizedName) || normalizedName.includes(webName)) score += 20; if (normalizedTeam && elementTeam && (elementTeam.includes(normalizedTeam) || normalizedTeam.includes(elementTeam))) score += 18; if (element.code || element.photo) score += 5; return { element, score }; }).filter((item: any) => item.score >= 20).sort((a: any, b: any) => b.score - a.score); const best = matches[0]?.element; if (!best) return null; return fplApi.playerPhotoUrl(best, 250); }`,
`async function resolveFplPlayerImage(name: string, team: string) { const [{ fplApi }, { buildFplPlayerIndex }] = await Promise.all([import("./services/fplApi.js"), import("./services/fplPlayerIdentity.js")]); const bootstrap = await fplApi.bootstrap(); const element = buildFplPlayerIndex(bootstrap).resolve({ name, team }); if (!element) return null; return fplApi.playerPhotoUrl(element, 250); }`,
);

replaceExact(
  "server/index.ts",
`  try { const fplImage = await resolveFplPlayerImage(name, team); if (fplImage) { const proxied = \`/api/image-proxy?url=${encodeURIComponent(fplImage)}\`; playerImageCache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60 * 1000, url: proxied }); res.setHeader("Cache-Control", "public, max-age=43200"); return res.redirect(302, proxied); } } catch (error) { console.warn("FPL player image resolve failed:", error); }
  try { const response = await fetch(\`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}\`, { headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" } }); if (!response.ok) throw new Error(\`TheSportsDB ${response.status}\`); const payload = await response.json(); const players = Array.isArray(payload?.player) ? payload.player : []; const image = bestSportsDbPlayerImage(players, team); playerImageCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, url: image }); if (image) { res.setHeader("Cache-Control", "public, max-age=86400"); return res.redirect(302, image); } } catch (error) { console.warn("Player image resolve failed:", error); }
  playerImageCache.set(cacheKey, { expiresAt: Date.now() + 60 * 60 * 1000, url: null }); return res.status(404).json({ message: "No image found" });`,
`  try { const fplImage = await resolveFplPlayerImage(name, team); if (fplImage) { const proxied = \`/api/image-proxy?url=${encodeURIComponent(fplImage)}\`; playerImageCache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60 * 1000, url: proxied }); res.setHeader("Cache-Control", "public, max-age=43200"); return res.redirect(302, proxied); } } catch (error) { console.warn("FPL player image resolve failed:", error); }
  playerImageCache.set(cacheKey, { expiresAt: Date.now() + 60 * 60 * 1000, url: null }); return res.status(404).json({ message: "No exact official player image link found" });`,
);

replaceExact(
  "server/routes/cards.routes.ts",
`        const totalPoints = matchedElement
          ? Number(matchedElement.total_points || 0)
          : Number(player.totalPoints ?? player.total_points ?? card.totalPoints ?? 0);
        const form = matchedElement
          ? Number(matchedElement.form || 0)
          : Number(player.form ?? card.decisiveScore ?? 0);
        const overall = matchedElement
          ? overallFromFplElement(matchedElement)
          : Number(player.overall || card.decisiveScore || 0);

        return {
          ...card,
          totalPoints,
          last5Scores,
          player: {
            ...player,
            ...(canonical || {}),
            name: canonical?.name || apiFootballPlayer?.name || player.name,
            team: apiFootballPlayer?.team || canonical?.team || player.team,
            position: apiFootballPlayer?.position || canonical?.position || player.position,
            nationality: apiFootballPlayer?.nationality || player.nationality,
            apiFootballId: apiFootballPlayer?.apiPlayerId || null,
            imageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl),
            verifiedImageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : undefined),
            identitySource: apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",
            totalPoints,
            form,
            overall,
          },
        };`,
`        const totalPoints = matchedElement
          ? Number(matchedElement.total_points || 0)
          : Number(player.totalPoints ?? player.total_points ?? card.totalPoints ?? 0);
        const form = matchedElement
          ? Number(matchedElement.form || 0)
          : Number(player.form ?? card.decisiveScore ?? 0);
        const overall = matchedElement
          ? overallFromFplElement(matchedElement)
          : Number(player.overall || card.decisiveScore || 0);
        const identityVerified = Boolean(apiFootballPlayer || matchedElement);
        const verifiedImageUrl = apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null);

        return {
          ...card,
          totalPoints,
          last5Scores,
          player: {
            ...player,
            ...(canonical || {}),
            name: canonical?.name || apiFootballPlayer?.name || player.name,
            team: apiFootballPlayer?.team || canonical?.team || player.team,
            position: apiFootballPlayer?.position || canonical?.position || player.position,
            nationality: apiFootballPlayer?.nationality || player.nationality,
            apiFootballId: apiFootballPlayer?.apiPlayerId || null,
            imageUrl: verifiedImageUrl,
            verifiedImageUrl,
            identityVerified,
            identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",
            totalPoints,
            form,
            overall,
          },
        };`,
);

replaceExact(
  "server/routes/cards.routes.ts",
`          player: { name: player.name, team: player.team, position: player.position, imageUrl: player.imageUrl },`,
`          player: { name: player.name, team: player.team, position: player.position, imageUrl: null, verifiedImageUrl: null, identityVerified: false, identitySource: "unverified-card-data" },`,
);

replaceExact(
  "client/src/components/cards/CardProfileModal.tsx",
`      imageUrl: card.player?.imageUrl ?? undefined,`,
`      imageUrl: undefined,`,
);

replaceExact(
  "client/src/components/cards/CardProfileModal.tsx",
`  const verifiedImage = data.player?.imageUrl || card.player?.imageUrl || undefined;
  const profileCard = {
    ...card,
    totalPoints: data.stats.totalPoints,
    player: {
      ...(card.player as any),
      ...data.player,
      name: displayName,
      team,
      position,
      imageUrl: verifiedImage,
      verifiedImageUrl: verifiedImage,
      totalPoints: data.stats.totalPoints,
      photo: verifiedImage ? null : (card.player as any)?.photo,
      code: verifiedImage ? null : (card.player as any)?.code,
    },
  } as PlayerCardWithPlayer;`,
`  const identityVerified = data.source !== "card-fallback";
  const verifiedImage = identityVerified ? data.player?.imageUrl || undefined : undefined;
  const profileCard = {
    ...card,
    totalPoints: data.stats.totalPoints,
    player: {
      ...(card.player as any),
      ...data.player,
      name: displayName,
      team,
      position,
      imageUrl: verifiedImage,
      verifiedImageUrl: verifiedImage,
      identityVerified,
      identitySource: identityVerified ? (data.source === "api-football" ? "api-football" : "fpl") : "unverified-card-data",
      totalPoints: data.stats.totalPoints,
      photo: null,
      photoUrl: null,
      image: null,
      image_url: null,
      officialPortraitUrl: null,
      headshotUrl: null,
      cutoutUrl: null,
      code: identityVerified ? (card.player as any)?.code : null,
    },
  } as PlayerCardWithPlayer;`,
);

replaceExact(
  "client/src/lib/fantasy-card-adapter.ts",
`import { buildCardImageCandidates, CARD_IMAGE_FALLBACK } from "./card-image";`,
`import { buildCardImageCandidates, CARD_IMAGE_FALLBACK, isVerifiedPlayerIdentity } from "./card-image";`,
);

replaceExact(
  "client/src/lib/fantasy-card-adapter.ts",
`  const directCandidates = uniqueStrings([
    safeUrl(player?.verifiedImageUrl),
    safeUrl(player?.photo),
    safeUrl(player?.imageUrl),
    safeUrl(player?.photoUrl),
    safeUrl(player?.image_url),
  ]).filter((src) => !isLowQualityFallback(src));`,
`  const identityVerified = isVerifiedPlayerIdentity(player);
  const directCandidates = identityVerified ? uniqueStrings([
    safeUrl(player?.verifiedImageUrl),
    safeUrl(player?.imageUrl),
    safeUrl(player?.photoUrl),
    safeUrl(player?.image_url),
  ]).filter((src) => !isLowQualityFallback(src)) : [];`,
);

replaceExact(
  "server/routes/epl.routes.ts",
`function normalizeFixture(fixture: any, teams: Map<number, any>) {
  const home = teams.get(Number(fixture.team_h));
  const away = teams.get(Number(fixture.team_a));
  return {
    id: fixture.id,
    event: fixture.event,
    gameweek: fixture.event,
    date: fixture.kickoff_time,
    kickoffTime: fixture.kickoff_time,
    status: fixture.finished ? "FT" : fixture.started ? "LIVE" : "NS",
    started: Boolean(fixture.started),
    finished: Boolean(fixture.finished),
    minutes: Number(fixture.minutes || 0),
    homeTeam: {
      id: fixture.team_h,
      name: home?.name || \`Team ${fixture.team_h}\`,
      shortName: home?.short_name || \`T${fixture.team_h}\`,
      score: fixture.team_h_score,
    },
    awayTeam: {
      id: fixture.team_a,
      name: away?.name || \`Team ${fixture.team_a}\`,
      shortName: away?.short_name || \`T${fixture.team_a}\`,
      score: fixture.team_a_score,
    },
  };
}`,
`function normalizeFixture(fixture: any, teams: Map<number, any>) {
  const home = teams.get(Number(fixture.team_h));
  const away = teams.get(Number(fixture.team_a));
  const homeName = home?.name || \`Team ${fixture.team_h}\`;
  const awayName = away?.name || \`Team ${fixture.team_a}\`;
  const matchDate = fixture.kickoff_time || null;
  const elapsed = Number(fixture.minutes || 0);
  return {
    id: fixture.id,
    event: fixture.event,
    gameweek: fixture.event,
    round: fixture.event ? \`Gameweek ${fixture.event}\` : "Premier League",
    matchDate,
    date: matchDate,
    kickoffTime: matchDate,
    status: fixture.finished ? "FT" : fixture.started ? "LIVE" : "NS",
    started: Boolean(fixture.started),
    finished: Boolean(fixture.finished),
    elapsed,
    minutes: elapsed,
    venue: fixture.venue?.name || "",
    homeTeam: homeName,
    awayTeam: awayName,
    homeTeamLogo: home?.logo || "",
    awayTeamLogo: away?.logo || "",
    homeGoals: fixture.team_h_score ?? null,
    awayGoals: fixture.team_a_score ?? null,
    home: { id: fixture.team_h, name: homeName, shortName: home?.short_name || \`T${fixture.team_h}\`, score: fixture.team_h_score },
    away: { id: fixture.team_a, name: awayName, shortName: away?.short_name || \`T${fixture.team_a}\`, score: fixture.team_a_score },
  };
}`,
);

replaceExact(
  "server/routes/epl.routes.ts",
`      if (status === "completed") list = list.filter((fixture: any) => fixture.finished);`,
`      if (status === "completed" || status === "finished") list = list.filter((fixture: any) => fixture.finished);`,
);

replaceExact(
  "client/src/pages/premier-league.tsx",
`function assignRarity(player: EplPlayer): CardRarity {`,
`function normalizeFixtureForView(fixture: any): EplFixture {
  const homeNode = fixture?.homeTeam ?? fixture?.home;
  const awayNode = fixture?.awayTeam ?? fixture?.away;
  const homeTeam = typeof homeNode === "string" ? homeNode : String(homeNode?.name || "Home");
  const awayTeam = typeof awayNode === "string" ? awayNode : String(awayNode?.name || "Away");
  return {
    ...fixture,
    id: fixture?.id ?? \`${homeTeam}-${awayTeam}-${fixture?.kickoffTime || fixture?.date || "fixture"}\`,
    round: fixture?.round || (fixture?.gameweek ? \`Gameweek ${fixture.gameweek}\` : "Premier League"),
    matchDate: fixture?.matchDate || fixture?.kickoffTime || fixture?.date || null,
    status: String(fixture?.status || (fixture?.finished ? "FT" : fixture?.started ? "LIVE" : "NS")),
    homeTeam,
    awayTeam,
    homeGoals: fixture?.homeGoals ?? (typeof homeNode === "object" ? homeNode?.score : fixture?.home?.score) ?? null,
    awayGoals: fixture?.awayGoals ?? (typeof awayNode === "object" ? awayNode?.score : fixture?.away?.score) ?? null,
    homeTeamLogo: fixture?.homeTeamLogo || homeNode?.logo || homeNode?.badge || "",
    awayTeamLogo: fixture?.awayTeamLogo || awayNode?.logo || awayNode?.badge || "",
    elapsed: fixture?.elapsed ?? fixture?.minutes ?? 0,
  };
}

function assignRarity(player: EplPlayer): CardRarity {`,
);

replaceExact(
  "client/src/pages/premier-league.tsx",
`        return asArray<EplFixture>(data, ["fixtures", "response"]);`,
`        return asArray<EplFixture>(data, ["fixtures", "response"]).map(normalizeFixtureForView);`,
);

replaceExact(
  "client/src/pages/premier-league.tsx",
`    <div className="flex-1 overflow-auto relative">`,
`    <div className="relative min-h-full">`,
);

replaceExact(
  "server/routes/marketplace.routes.ts",
`import { applyMarketplaceTradeLedger } from "../services/walletLedger.js";`,
`import { applyMarketplaceTradeLedger } from "../services/walletLedger.js";
import { fplApi } from "../services/fplApi.js";
import { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";
import { loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";`,
);

replaceExact(
  "server/routes/marketplace.routes.ts",
`  app.get("/api/marketplace", async (_req, res) => {
    try { const result = await db.execute(sql\`select pc.*, p.name as player_name, p.team as player_team, p.position as player_position, p.image_url as player_image_url from app.player_cards pc join app.players p on p.id = pc.player_id where pc.for_sale = true order by pc.price asc nulls last, pc.id desc\`); const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : []; const listings = rows.map((row: any) => ({ ...row, player: { id: row.player_id, name: row.player_name, team: row.player_team, position: row.player_position, imageUrl: row.player_image_url } })); return res.json({ listings, cards: listings }); } catch (error: any) { console.error("Failed to fetch marketplace listings:", error); return res.status(500).json({ message: error?.message || "Failed to fetch marketplace" }); }
  });`,
`  app.get("/api/marketplace", async (_req, res) => {
    try {
      const [result, bootstrap, directory] = await Promise.all([
        db.execute(sql\`select pc.*, p.name as player_name, p.team as player_team, p.position as player_position, p.image_url as player_image_url, p.fpl_id as player_fpl_id, p.code as player_code, p.photo as player_photo, p.web_name as player_web_name, p.nationality as player_nationality, p.league as player_league, p.overall as player_overall, p.total_points as player_total_points, p.form as player_form from app.player_cards pc join app.players p on p.id = pc.player_id where pc.for_sale = true order by pc.price asc nulls last, pc.id desc\`),
        fplApi.bootstrap().catch(() => null),
        loadApiFootballPlayerDirectory().catch(() => []),
      ]);
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      const listings = rows.map((row: any) => {
        const storedPlayer = { id: row.player_id, name: row.player_name, team: row.player_team, position: row.player_position, imageUrl: row.player_image_url, fplId: row.player_fpl_id, code: row.player_code, photo: row.player_photo, webName: row.player_web_name, nationality: row.player_nationality, league: row.player_league, overall: row.player_overall, totalPoints: row.player_total_points, form: row.player_form };
        const matchedElement = fplIndex.resolve(storedPlayer);
        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const apiPlayer = resolveApiFootballPlayer({ ...storedPlayer, ...(canonical || {}) }, directory);
        const verifiedImageUrl = apiPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null);
        const identityVerified = Boolean(apiPlayer || matchedElement);
        return { ...row, player: { ...storedPlayer, ...(canonical || {}), name: canonical?.name || apiPlayer?.name || storedPlayer.name, team: apiPlayer?.team || canonical?.team || storedPlayer.team, position: apiPlayer?.position || canonical?.position || storedPlayer.position, nationality: apiPlayer?.nationality || storedPlayer.nationality, apiFootballId: apiPlayer?.apiPlayerId || null, imageUrl: verifiedImageUrl, verifiedImageUrl, identityVerified, identitySource: apiPlayer && matchedElement ? "fpl+api-football" : apiPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data" } };
      });
      return res.json({ listings, cards: listings });
    } catch (error: any) { console.error("Failed to fetch marketplace listings:", error); return res.status(500).json({ message: error?.message || "Failed to fetch marketplace" }); }
  });`,
);

for (const file of [
  "client/src/main.tsx",
  "client/public/sw.js",
  "scripts/verify-card-data-integrity.mjs",
  "scripts/verify-unified-scroll-architecture.mjs",
  "scripts/verify-verified-player-profiles.mjs",
  "scripts/verify-collection-actions-dialog.mjs",
]) {
  const source = read(file);
  write(file, source.replaceAll("fantasy-site-v13", "fantasy-site-v14"));
}

console.log("Strict player identity, verified-only images and fixture response repair applied.");
