#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${file}: expected source block was not found`);
  write(file, source.replace(before, after));
}

function replaceBetween(file, startMarker, endMarker, replacement) {
  const source = read(file);
  if (source.includes(replacement)) return;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${file}: start marker not found`);
  const endStart = source.indexOf(endMarker, start);
  if (endStart < 0) throw new Error(`${file}: end marker not found`);
  const end = endStart + endMarker.length;
  write(file, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
}

const cardsFile = "server/routes/cards.routes.ts";
replaceOnce(
  cardsFile,
  'import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";\n',
  'import { buildFplPlayerIndex, overallFromFplElement } from "../services/fplPlayerIdentity.js";\nimport { getApiFootballPlayerProfileSnapshot, loadApiFootballPlayerDirectory, resolveApiFootballPlayer } from "../services/apiFootballPlayerDirectory.js";\n',
);

replaceBetween(
  cardsFile,
  "function lastScoresFallback(card: any) {",
  "}",
  `function lastScoresFallback(_card: any) {
  return [];
}`,
);

replaceOnce(
  cardsFile,
  '      const [bootstrap, liveData] = await Promise.all([fplApi.bootstrap().catch(() => null), fplApi.getLiveGameweek().catch(() => null)]);',
  '      const [bootstrap, liveData, apiFootballDirectory] = await Promise.all([fplApi.bootstrap().catch(() => null), fplApi.getLiveGameweek().catch(() => null), loadApiFootballPlayerDirectory().catch(() => [])]);',
);

replaceOnce(
  cardsFile,
  `        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;`,
  `        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
        const apiFootballPlayer = resolveApiFootballPlayer({ ...player, ...(canonical || {}) }, apiFootballDirectory);
        const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;`,
);

replaceOnce(
  cardsFile,
  `          player: {
            ...player,
            ...(canonical || {}),
            imageUrl: matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl,
            totalPoints,
            form,
            overall,
          },`,
  `          player: {
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
          },`,
);

const oldProfileEnd = '      return res.json({ source: "fpl-live", fplElementId: Number(matchedElement.id), player: { ...canonical, imageUrl: fplApi.playerPhotoUrl(matchedElement, 250), status: matchedElement.status, news: matchedElement.news || "" }, last10: last10.length ? last10 : lastScoresFallback(card), stats: { matchesPlayed: Number(matchedElement.starts || 0), minutes: Number(matchedElement.minutes || 0), goals: Number(matchedElement.goals_scored || 0), assists: Number(matchedElement.assists || 0), cleanSheets: Number(matchedElement.clean_sheets || 0), yellowCards: Number(matchedElement.yellow_cards || 0), redCards: Number(matchedElement.red_cards || 0), bonus: Number(matchedElement.bonus || 0), totalPoints: Number(matchedElement.total_points || 0), selectedBy: matchedElement.selected_by_percent, value: lastSaleValue } });';

replaceBetween(
  cardsFile,
  "      const bootstrap = await fplApi.bootstrap();",
  oldProfileEnd,
  `      const [bootstrap, apiFootballDirectory] = await Promise.all([
        fplApi.bootstrap().catch(() => null),
        loadApiFootballPlayerDirectory().catch(() => []),
      ]);
      const fplIndex = buildFplPlayerIndex(bootstrap || {});
      const teamShortById = new Map<number, string>();
      for (const team of fplIndex.teams) teamShortById.set(Number(team.id), String(team.short_name || team.name || \`T\${team.id}\`));
      const matchedElement = fplIndex.resolve(player);
      const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;
      const apiSnapshot = await getApiFootballPlayerProfileSnapshot({ ...player, ...(canonical || {}) }, apiFootballDirectory).catch(() => null);

      if (!matchedElement) {
        if (apiSnapshot) {
          return res.json({
            ...apiSnapshot,
            stats: { ...apiSnapshot.stats, value: lastSaleValue },
          });
        }
        return res.json({
          source: "card-fallback",
          providers: { identity: "Unverified legacy card data", stats: "No official match link" },
          player: { name: player.name, team: player.team, position: player.position, imageUrl: player.imageUrl },
          last10: [],
          stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, bonus: 0, totalPoints: Number(card.totalPoints || player.totalPoints || 0), selectedBy: null, value: lastSaleValue, saves: 0, averageRating: null },
        });
      }

      const summary = await fplApi.playerSummary(Number(matchedElement.id));
      const history = Array.isArray(summary?.history) ? summary.history : [];
      const last10 = history.slice(-10).map((row: any) => ({
        gameweek: Number(row.round || row.event || 0),
        opponent: teamShortById.get(Number(row.opponent_team)) || \`T\${row.opponent_team}\`,
        points: Number(row.total_points || 0),
        minutes: Number(row.minutes || 0),
        goals: Number(row.goals_scored || 0),
        assists: Number(row.assists || 0),
        cleanSheets: Number(row.clean_sheets || 0),
        yellowCards: Number(row.yellow_cards || 0),
        redCards: Number(row.red_cards || 0),
        bonus: Number(row.bonus || 0),
        kickoffTime: row.kickoff_time || null,
        wasHome: Boolean(row.was_home),
      }));
      const verifiedIdentity = apiSnapshot?.player || null;
      const verifiedImageUrl = verifiedIdentity?.imageUrl || fplApi.playerPhotoUrl(matchedElement, 250);
      return res.json({
        source: "fpl-live",
        fplElementId: Number(matchedElement.id),
        season: apiSnapshot?.season || null,
        providers: {
          identity: verifiedIdentity ? "API-Football current squads" : "Fantasy Premier League player list",
          stats: "Fantasy Premier League match history",
          fantasyPoints: "Official Fantasy Premier League points",
        },
        player: {
          ...canonical,
          name: canonical?.name,
          team: verifiedIdentity?.team || canonical?.team,
          position: verifiedIdentity?.position || canonical?.position,
          imageUrl: verifiedImageUrl,
          verifiedImageUrl,
          nationality: verifiedIdentity?.nationality,
          apiFootballId: verifiedIdentity?.apiFootballId,
          status: matchedElement.status,
          news: matchedElement.news || "",
        },
        last10,
        stats: {
          matchesPlayed: Number(matchedElement.starts || 0),
          minutes: Number(matchedElement.minutes || 0),
          goals: Number(matchedElement.goals_scored || 0),
          assists: Number(matchedElement.assists || 0),
          cleanSheets: Number(matchedElement.clean_sheets || 0),
          yellowCards: Number(matchedElement.yellow_cards || 0),
          redCards: Number(matchedElement.red_cards || 0),
          bonus: Number(matchedElement.bonus || 0),
          totalPoints: Number(matchedElement.total_points || 0),
          selectedBy: matchedElement.selected_by_percent,
          value: lastSaleValue,
          saves: Number(matchedElement.saves || 0),
          averageRating: apiSnapshot?.stats?.averageRating || null,
        },
      });`,
);

replaceOnce(
  "client/src/lib/card-image.ts",
  "    imageUrl?: string | null;\n",
  "    imageUrl?: string | null;\n    verifiedImageUrl?: string | null;\n",
);
replaceOnce(
  "client/src/lib/card-image.ts",
  "  const candidates: string[] = [];\n\n  // IMPORTANT: FPL element id is not the same as Premier League photo code.",
  `  const candidates: string[] = [];

  const verifiedImage = normalizeImageUrl(player?.verifiedImageUrl);
  if (verifiedImage && !LOCAL_PLACEHOLDER_PATTERN.test(verifiedImage)) candidates.push(toSafeImageUrl(verifiedImage));

  // IMPORTANT: FPL element id is not the same as Premier League photo code.`,
);
replaceOnce(
  "client/src/lib/fantasy-card-adapter.ts",
  "  const directCandidates = uniqueStrings([\n    safeUrl(player?.photo),",
  "  const directCandidates = uniqueStrings([\n    safeUrl(player?.verifiedImageUrl),\n    safeUrl(player?.photo),",
);

console.log("Card collection and profiles now prefer verified API-Football identity and honest official match records.");
