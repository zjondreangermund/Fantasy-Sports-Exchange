#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const marker = path.join(root, "scripts/.strict-player-identity-fixtures-v2");

function replace(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: missing expected text: ${before.slice(0, 80)}`);
  write(file, source.replace(before, after));
}

function replacePattern(file, pattern, after) {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(`${file}: missing expected pattern ${pattern}`);
  write(file, source.replace(pattern, after));
}

if (fs.existsSync(marker)) {
  console.log("Strict remaining patches already applied.");
  process.exit(0);
}

replace("server/services/apiFootballPlayerDirectory.ts",
  "    normalizePlayerText(candidate.lastName),\n", "");
replace("server/services/apiFootballPlayerDirectory.ts",
  "  if (source.length === 1 && candidateTokens.has(source[0]) && source[0].length >= 4) return 65;\n", "");
replace("server/services/apiFootballPlayerDirectory.ts",
  "  }).filter((row) => row.nameScore >= 65).sort((a, b) => b.score - a.score);",
  "  }).filter((row) => row.nameScore >= 92 && (!rawPosition || rawPosition === row.candidate.position || row.nameScore >= 105)).sort((a, b) => b.score - a.score);");
replace("server/services/apiFootballPlayerDirectory.ts",
  "  if (!best || best.score < 88) return null;",
  "  if (!best || best.nameScore < 92) return null;");
replace("server/services/apiFootballPlayerDirectory.ts",
  "best.score - second.score < 10",
  "best.score - second.score < 12");

replacePattern(
  "server/index.ts",
  /async function resolveFplPlayerImage\(name: string, team: string\) \{[^\n]+\}/,
  'async function resolveFplPlayerImage(name: string, team: string) { const [{ fplApi }, { buildFplPlayerIndex }] = await Promise.all([import("./services/fplApi.js"), import("./services/fplPlayerIdentity.js")]); const bootstrap = await fplApi.bootstrap(); const element = buildFplPlayerIndex(bootstrap).resolve({ name, team }); if (!element) return null; return fplApi.playerPhotoUrl(element, 250); }',
);
replacePattern(
  "server/index.ts",
  /\n  try \{ const response = await fetch\(`https:\/\/www\.thesportsdb\.com\/api\/v1\/json\/3\/searchplayers\.php\?p=\$\{encodeURIComponent\(name\)\}`,[^\n]+\n/,
  "\n",
);
replace("server/index.ts", 'message: "No image found"', 'message: "No exact official player image link found"');

replace("server/routes/cards.routes.ts",
  "imageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : player.imageUrl),",
  "imageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),");
replace("server/routes/cards.routes.ts",
  "verifiedImageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : undefined),",
  "verifiedImageUrl: apiFootballPlayer?.photo || (matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null),\n            identityVerified: Boolean(apiFootballPlayer || matchedElement),");
replace("server/routes/cards.routes.ts",
  'identitySource: apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",',
  'identitySource: apiFootballPlayer && matchedElement ? "fpl+api-football" : apiFootballPlayer ? "api-football-current-squad" : matchedElement ? "fpl" : "unverified-card-data",');
replace("server/routes/cards.routes.ts",
  "player: { name: player.name, team: player.team, position: player.position, imageUrl: player.imageUrl },",
  'player: { name: player.name, team: player.team, position: player.position, imageUrl: null, verifiedImageUrl: null, identityVerified: false, identitySource: "unverified-card-data" },');

replace("client/src/components/cards/CardProfileModal.tsx",
  "      imageUrl: card.player?.imageUrl ?? undefined,",
  "      imageUrl: undefined,");
replace("client/src/components/cards/CardProfileModal.tsx",
  "  const verifiedImage = data.player?.imageUrl || card.player?.imageUrl || undefined;",
  '  const identityVerified = data.source !== "card-fallback";\n  const verifiedImage = identityVerified ? data.player?.imageUrl || undefined : undefined;');
replace("client/src/components/cards/CardProfileModal.tsx",
  "      verifiedImageUrl: verifiedImage,\n      totalPoints:",
  '      verifiedImageUrl: verifiedImage,\n      identityVerified,\n      identitySource: identityVerified ? (data.source === "api-football" ? "api-football" : "fpl") : "unverified-card-data",\n      totalPoints:');
replace("client/src/components/cards/CardProfileModal.tsx",
  "      photo: verifiedImage ? null : (card.player as any)?.photo,\n      code: verifiedImage ? null : (card.player as any)?.code,",
  "      photo: null,\n      photoUrl: null,\n      image: null,\n      image_url: null,\n      officialPortraitUrl: null,\n      headshotUrl: null,\n      cutoutUrl: null,\n      code: identityVerified ? (card.player as any)?.code : null,");

replace("client/src/lib/fantasy-card-adapter.ts",
  'import { buildCardImageCandidates, CARD_IMAGE_FALLBACK } from "./card-image";',
  'import { buildCardImageCandidates, CARD_IMAGE_FALLBACK, isVerifiedPlayerIdentity } from "./card-image";');
replacePattern(
  "client/src/lib/fantasy-card-adapter.ts",
  /  const directCandidates = uniqueStrings\(\[[\s\S]*?\]\)\.filter\(\(src\) => !isLowQualityFallback\(src\)\);/,
  [
    "  const identityVerified = isVerifiedPlayerIdentity(player);",
    "  const directCandidates = identityVerified",
    "    ? uniqueStrings([",
    "        safeUrl(player?.verifiedImageUrl),",
    "        safeUrl(player?.imageUrl),",
    "        safeUrl(player?.photoUrl),",
    "        safeUrl(player?.image_url),",
    "      ]).filter((src) => !isLowQualityFallback(src))",
    "    : [];",
  ].join("\n"),
);

replacePattern(
  "server/routes/epl.routes.ts",
  /function normalizeFixture\(fixture: any, teams: Map<number, any>\) \{[\s\S]*?\n\}\n\nfunction buildStandingsFromFixtures/,
  [
    "function normalizeFixture(fixture: any, teams: Map<number, any>) {",
    "  const home = teams.get(Number(fixture.team_h));",
    "  const away = teams.get(Number(fixture.team_a));",
    "  const homeName = home?.name || `Team ${fixture.team_h}`;",
    "  const awayName = away?.name || `Team ${fixture.team_a}`;",
    "  const matchDate = fixture.kickoff_time || null;",
    "  const elapsed = Number(fixture.minutes || 0);",
    "  return {",
    "    id: fixture.id,",
    "    event: fixture.event,",
    "    gameweek: fixture.event,",
    "    round: fixture.event ? `Gameweek ${fixture.event}` : \"Premier League\",",
    "    matchDate, date: matchDate, kickoffTime: matchDate,",
    "    status: fixture.finished ? \"FT\" : fixture.started ? \"LIVE\" : \"NS\",",
    "    started: Boolean(fixture.started), finished: Boolean(fixture.finished),",
    "    elapsed, minutes: elapsed, venue: fixture.venue?.name || \"\",",
    "    homeTeam: homeName, awayTeam: awayName,",
    "    homeTeamLogo: home?.logo || \"\", awayTeamLogo: away?.logo || \"\",",
    "    homeGoals: fixture.team_h_score ?? null, awayGoals: fixture.team_a_score ?? null,",
    "    home: { id: fixture.team_h, name: homeName, shortName: home?.short_name || `T${fixture.team_h}`, score: fixture.team_h_score },",
    "    away: { id: fixture.team_a, name: awayName, shortName: away?.short_name || `T${fixture.team_a}`, score: fixture.team_a_score },",
    "  };",
    "}",
    "",
    "function buildStandingsFromFixtures",
  ].join("\n"),
);
replace("server/routes/epl.routes.ts",
  '      if (status === "completed") list = list.filter((fixture: any) => fixture.finished);',
  '      if (status === "completed" || status === "finished") list = list.filter((fixture: any) => fixture.finished);');

replace("client/src/pages/premier-league.tsx",
  "function assignRarity(player: EplPlayer): CardRarity {",
  [
    "function normalizeFixtureForView(fixture: any): EplFixture {",
    "  const homeNode = fixture?.homeTeam ?? fixture?.home;",
    "  const awayNode = fixture?.awayTeam ?? fixture?.away;",
    "  const homeTeam = typeof homeNode === \"string\" ? homeNode : String(homeNode?.name || \"Home\");",
    "  const awayTeam = typeof awayNode === \"string\" ? awayNode : String(awayNode?.name || \"Away\");",
    "  return {",
    "    ...fixture,",
    "    id: fixture?.id ?? `${homeTeam}-${awayTeam}-${fixture?.kickoffTime || fixture?.date || \"fixture\"}`,",
    "    round: fixture?.round || (fixture?.gameweek ? `Gameweek ${fixture.gameweek}` : \"Premier League\"),",
    "    matchDate: fixture?.matchDate || fixture?.kickoffTime || fixture?.date || null,",
    "    status: String(fixture?.status || (fixture?.finished ? \"FT\" : fixture?.started ? \"LIVE\" : \"NS\")),",
    "    homeTeam, awayTeam,",
    "    homeGoals: fixture?.homeGoals ?? (typeof homeNode === \"object\" ? homeNode?.score : fixture?.home?.score) ?? null,",
    "    awayGoals: fixture?.awayGoals ?? (typeof awayNode === \"object\" ? awayNode?.score : fixture?.away?.score) ?? null,",
    "    homeTeamLogo: fixture?.homeTeamLogo || homeNode?.logo || homeNode?.badge || \"\",",
    "    awayTeamLogo: fixture?.awayTeamLogo || awayNode?.logo || awayNode?.badge || \"\",",
    "    elapsed: fixture?.elapsed ?? fixture?.minutes ?? 0,",
    "  };",
    "}",
    "",
    "function assignRarity(player: EplPlayer): CardRarity {",
  ].join("\n"),
);
replace("client/src/pages/premier-league.tsx",
  '        return asArray<EplFixture>(data, ["fixtures", "response"]);',
  '        return asArray<EplFixture>(data, ["fixtures", "response"]).map(normalizeFixtureForView);');
replace("client/src/pages/premier-league.tsx",
  '    <div className="flex-1 overflow-auto relative">',
  '    <div className="relative min-h-full">');

replace("server/routes/marketplace.routes.ts",
  'import { applyMarketplaceTradeLedger } from "../services/walletLedger.js";',
  'import { applyMarketplaceTradeLedger } from "../services/walletLedger.js";\nimport { fplApi } from "../services/fplApi.js";\nimport { buildFplPlayerIndex } from "../services/fplPlayerIdentity.js";');

replacePattern(
  "server/routes/marketplace.routes.ts",
  /  app\.get\("\/api\/marketplace", async \(_req, res\) => \{[\s\S]*?\n  \}\);/,
  [
    '  app.get("/api/marketplace", async (_req, res) => {',
    "    try {",
    "      const [result, bootstrap] = await Promise.all([",
    "        db.execute(sql`select pc.*, p.name as player_name, p.team as player_team, p.position as player_position, p.image_url as player_image_url, p.fpl_id as player_fpl_id, p.code as player_code, p.photo as player_photo, p.web_name as player_web_name, p.nationality as player_nationality, p.league as player_league, p.overall as player_overall, p.total_points as player_total_points, p.form as player_form from app.player_cards pc join app.players p on p.id = pc.player_id where pc.for_sale = true order by pc.price asc nulls last, pc.id desc`),",
    "        fplApi.bootstrap().catch(() => null),",
    "      ]);",
    "      const fplIndex = buildFplPlayerIndex(bootstrap || {});",
    "      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];",
    "      const listings = rows.map((row: any) => {",
    "        const storedPlayer = { id: row.player_id, name: row.player_name, team: row.player_team, position: row.player_position, imageUrl: row.player_image_url, fplId: row.player_fpl_id, code: row.player_code, photo: row.player_photo, webName: row.player_web_name, nationality: row.player_nationality, league: row.player_league, overall: row.player_overall, totalPoints: row.player_total_points, form: row.player_form };",
    "        const matchedElement = fplIndex.resolve(storedPlayer);",
    "        const canonical = matchedElement ? fplIndex.canonical(matchedElement) : null;",
    "        const verifiedImageUrl = matchedElement ? fplApi.playerPhotoUrl(matchedElement, 250) : null;",
    "        return { ...row, player: { ...storedPlayer, ...(canonical || {}), imageUrl: verifiedImageUrl, verifiedImageUrl, identityVerified: Boolean(matchedElement), identitySource: matchedElement ? \"fpl\" : \"unverified-card-data\" } };",
    "      });",
    "      return res.json({ listings, cards: listings });",
    "    } catch (error: any) {",
    '      console.error("Failed to fetch marketplace listings:", error);',
    '      return res.status(500).json({ message: error?.message || "Failed to fetch marketplace" });',
    "    }",
    "  });",
  ].join("\n"),
);

for (const file of [
  "client/src/main.tsx",
  "client/public/sw.js",
  "scripts/verify-card-data-integrity.mjs",
  "scripts/verify-unified-scroll-architecture.mjs",
  "scripts/verify-verified-player-profiles.mjs",
  "scripts/verify-collection-actions-dialog.mjs",
]) {
  write(file, read(file).replaceAll("fantasy-site-v13", "fantasy-site-v14"));
}

write(marker, "applied\n");
console.log("Strict player identity, image and fixture patches applied.");
