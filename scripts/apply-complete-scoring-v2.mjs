import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Complete scoring patch anchor not found: ${label}`);
  return source.replace(from, to);
}

function replaceRegex(source, pattern, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!pattern.test(source)) throw new Error(`Complete scoring regex anchor not found: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

// Real tournament scoring: combine official FPL core events with stored API-Football
// all-around actions for the same Premier League gameweek.
{
  const file = "server/services/scoreUpdater.ts";
  let source = read(file);

  source = replaceOnce(
    source,
    ' * - Only official Premier League FPL data for the selected gameweek is scored.',
    ' * - Official FPL supplies core events; API-Football supplies detailed all-around actions when available.',
    "score updater integrity comment",
  );

  source = replaceOnce(
    source,
    'import { calculatePlayerScore, mapFplStatsToPlayerStats, calculateLineupScore } from "./scoring.js";',
    'import { calculatePlayerScore, mapFplStatsToPlayerStats, calculateLineupScore, mergePlayerStatsWithDetailedStats } from "./scoring.js";\nimport { loadDetailedScoringContext, resolveDetailedStatsForPlayer, type DetailedScoringContext } from "./apiFootballScoringBridge.js";',
    "score updater detailed imports",
  );

  source = replaceOnce(
    source,
    `  private buildCardScores(cards: any[], identityMap: IdentityMap, playerStatsMap: Map<any, any>) {
    return cards.map((card) => {
      if (!card?.player) return this.zeroScore(card);
      const elementId = this.resolveFplElementId(card.player, identityMap);
      const officialElement = elementId ? identityMap.byId.get(elementId) : null;
      if (!officialElement) return this.zeroScore(card, 0, \`\${String(card.player.name || "This player")} could not be matched securely to an official Premier League player.\`);
      const fplStats = elementId ? playerStatsMap.get(elementId) : undefined;
      if (!fplStats) return this.zeroScore(card, elementId, "Official gameweek statistics have not been published for this verified player yet.");
      const canonical = identityMap.canonical(officialElement);
      const score = calculatePlayerScore(fplStats, canonical.position);
      return {
        ...score,
        card_id: card.id,
        player_id: card.playerId,
        element_id: elementId,
        identity_status: "verified",
        identity_message: \`Verified official Premier League player: \${canonical.name}.\`,
        identity_provider: "fpl-fallback",
        official_player_name: canonical.name,
        official_team: canonical.team,
        official_position: canonical.position,
        minutes_played: Number(fplStats.minutes || 0),
      };
    });
  }`,
    `  private buildCardScores(cards: any[], identityMap: IdentityMap, playerStatsMap: Map<any, any>, detailedContext: DetailedScoringContext) {
    return cards.map((card) => {
      if (!card?.player) return this.zeroScore(card);
      const elementId = this.resolveFplElementId(card.player, identityMap);
      const officialElement = elementId ? identityMap.byId.get(elementId) : null;
      if (!officialElement) return this.zeroScore(card, 0, \`\${String(card.player.name || "This player")} could not be matched securely to an official Premier League player.\`);
      const fplStats = elementId ? playerStatsMap.get(elementId) : undefined;
      if (!fplStats) return this.zeroScore(card, elementId, "Official gameweek statistics have not been published for this verified player yet.");
      const canonical = identityMap.canonical(officialElement);
      const verifiedPlayer = { ...card.player, ...canonical };
      const detailedStats = resolveDetailedStatsForPlayer(verifiedPlayer, detailedContext);
      const combinedStats = mergePlayerStatsWithDetailedStats(fplStats, detailedStats);
      const verifiedPosition = String((detailedStats as any)?.api_position || canonical.position);
      const score = calculatePlayerScore(combinedStats, verifiedPosition);
      return {
        ...score,
        card_id: card.id,
        player_id: card.playerId,
        element_id: elementId,
        api_player_id: Number((detailedStats as any)?.api_player_id || 0),
        identity_status: "verified",
        identity_message: \`Verified official Premier League player: \${canonical.name}.\`,
        identity_provider: detailedStats ? "api-football+fpl" : "fpl-fallback",
        official_player_name: canonical.name,
        official_team: canonical.team,
        official_position: verifiedPosition,
        minutes_played: Number(combinedStats.minutes || 0),
      };
    });
  }`,
    "score updater card scoring",
  );

  source = replaceOnce(
    source,
    `    const complete = cards.length === 5 && cardScores.length === 5 && unresolvedCardIds.length === 0;
    const updatedAt = new Date().toISOString();
    return {
      version: 3,
      source: "official-fpl-live",`,
    `    const complete = cards.length === 5 && cardScores.length === 5 && unresolvedCardIds.length === 0;
    const updatedAt = new Date().toISOString();
    const detailedStatsCards = cardScores.filter((score: any) => score?.data_source === "official-fpl-plus-api-football").length;
    const fallbackStatsCards = cardScores.length - detailedStatsCards;
    return {
      version: 4,
      source: detailedStatsCards > 0 ? "official-fpl-plus-api-football" : "official-fpl-fallback",
      scoringMethod: "FPL core events plus API-Football detailed actions; ICT/BPS fallback is used only when detailed actions are unavailable",
      detailedStatsCards,
      fallbackStatsCards,`,
    "score snapshot provider metadata",
  );

  source = replaceOnce(
    source,
    `        elementId: Number(score?.element_id || 0),
        score: toNumber(score?.total_score),
        breakdown: score?.breakdown || null,`,
    `        elementId: Number(score?.element_id || 0),
        apiFootballPlayerId: Number(score?.api_player_id || 0),
        dataSource: score?.data_source || "official-fpl-fallback",
        score: toNumber(score?.total_score),
        breakdown: score?.breakdown || null,`,
    "score snapshot card provider",
  );

  source = replaceOnce(
    source,
    `    const identityMap = this.buildFplIdentityMap(bootstrap);
    const settlementAt = this.settlementDeadline(competition);
    for (const element of bootstrap?.elements || []) bootstrapElementById.set(Number(element.id), element);`,
    `    const identityMap = this.buildFplIdentityMap(bootstrap);
    const settlementAt = this.settlementDeadline(competition);
    const detailedContext = await loadDetailedScoringContext(bootstrap, gameWeek);
    for (const element of bootstrap?.elements || []) bootstrapElementById.set(Number(element.id), element);`,
    "score updater detailed context load",
  );

  source = replaceOnce(
    source,
    "        const cardScores = this.buildCardScores(cards, identityMap, playerStatsMap);",
    "        const cardScores = this.buildCardScores(cards, identityMap, playerStatsMap, detailedContext);",
    "score updater detailed card call",
  );

  write(file, source);
}

const canonicalPreview = `function scorePreview(stat: any) {
  const rawPosition = String(stat?.games?.position || "M").toUpperCase();
  const position = rawPosition === "G" ? "GK" : rawPosition === "D" ? "DEF" : rawPosition === "F" ? "FWD" : "MID";
  const result = calculatePlayerScore(mapApiFootballStatsToPlayerStats(stat), position);
  const allAround = Math.round((result.breakdown.performance + result.breakdown.penalties + result.breakdown.bonus) * 10) / 10;
  return {
    score: result.total_score,
    decisive: result.breakdown.decisive,
    allAround,
    decisiveScore: result.breakdown.decisive,
    allAroundScore: allAround,
    breakdown: { ...result.breakdown, reasons: result.reasons, dataSource: result.data_source },
  };
}

`;

// The API-Football sync preview and admin tester must use the exact same engine
// as tournament settlement, rather than a second formula with different values.
for (const [file, importAnchor, importReplacement] of [
  [
    "server/services/apiFootballSync.ts",
    'import { db } from "../db.js";',
    'import { db } from "../db.js";\nimport { calculatePlayerScore, mapApiFootballStatsToPlayerStats } from "./scoring.js";',
  ],
  [
    "server/routes/apiFootballAdmin.routes.ts",
    'import { db } from "../db.js";',
    'import { db } from "../db.js";\nimport { calculatePlayerScore, mapApiFootballStatsToPlayerStats } from "../services/scoring.js";',
  ],
]) {
  let source = read(file);
  source = replaceOnce(source, importAnchor, importReplacement, `${file} scoring imports`);
  source = replaceRegex(
    source,
    /function scorePreview\(stat: any\) \{[\s\S]*?\n\}\n\n(?=(?:async\s+)?function |export )/,
    canonicalPreview,
    `${file} canonical scorePreview`,
  );
  write(file, source);
}

// Keep the existing integrity gate aligned with snapshot v4 and hybrid scoring.
{
  const file = "scripts/verify-tournament-scoring-legal-integrity.mjs";
  let source = read(file);
  source = replaceOnce(source, '  "version: 3",', '  "version: 4",', "integrity snapshot version");
  source = replaceOnce(source, '  \'source: "official-fpl-live"\',', '  \'official-fpl-plus-api-football\',\n  "detailedStatsCards",\n  "fallbackStatsCards",', "integrity score source");
  source = replaceOnce(
    source,
    'includesAll(scoring, ["Captain receives +10%", "baseScore * 1.1", "rarity does NOT change football points"], "Scoring engine");',
    'includesAll(scoring, ["Captain receives +10%", "baseScore * 1.1", "rarity does NOT change football points", "Key / crucial passes", "detailed_stats_available", "official-fpl-plus-api-football"], "Scoring engine");',
    "integrity complete scoring checks",
  );
  write(file, source);
}

console.log("[scoring] Applied complete official scoring with crucial passes and detailed match actions");
