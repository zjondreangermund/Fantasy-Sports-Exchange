import fs from "node:fs";

const SERVICE = "server/services/dailyLoginReward.ts";
const PANEL = "client/src/components/dashboard/DailyLoginRewardPanel.tsx";
const MARKER = "COMMON_REWARD_POSITION_BALANCE_V1";

function patchFile(file, transform) {
  const source = fs.readFileSync(file, "utf8");
  const next = transform(source);
  if (next !== source) {
    fs.writeFileSync(file, next);
    console.log(`[common-position-balance] patched ${file}`);
  } else {
    console.log(`[common-position-balance] ${file} already patched`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Common reward position-balance anchor not found: ${label}`);
  return source.replace(from, to);
}

patchFile(SERVICE, (original) => {
  if (original.includes(MARKER)) return original;
  let source = original;

  const rowsAnchor = `function rowsOf(result: any): any[] {\n  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];\n}\n`;
  const helpers = `${rowsAnchor}\n// ${MARKER}\n// Weekly Common cards are the one free rarity users cannot simply buy to repair\n// a tournament squad. Keep the player random, but choose the position that most\n// improves the owner's ability to field distinct 1 GK / 1 DEF / 1 MID / 1 FWD\n// + 1 Utility tournament teams.\nconst COMMON_TOURNAMENT_POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;\ntype CommonTournamentPosition = (typeof COMMON_TOURNAMENT_POSITIONS)[number];\ntype CommonPositionCounts = Record<CommonTournamentPosition, number>;\n\nfunction emptyCommonPositionCounts(): CommonPositionCounts {\n  return { GK: 0, DEF: 0, MID: 0, FWD: 0 };\n}\n\nasync function loadCommonPositionCounts(executor: any, userId: string): Promise<CommonPositionCounts> {\n  const counts = emptyCommonPositionCounts();\n  const rows = rowsOf(await executor.execute(sql\`\n    SELECT p.position::text AS position, count(*)::int AS count\n    FROM app.player_cards pc\n    JOIN app.players p ON p.id = pc.player_id\n    WHERE pc.owner_id = \${userId}\n      AND pc.rarity::text = 'common'\n      AND p.position::text IN ('GK', 'DEF', 'MID', 'FWD')\n    GROUP BY p.position::text\n  \`));\n  for (const row of rows) {\n    const position = String(row.position || "").toUpperCase() as CommonTournamentPosition;\n    if (COMMON_TOURNAMENT_POSITIONS.includes(position)) counts[position] = Math.max(0, Number(row.count || 0));\n  }\n  return counts;\n}\n\nfunction commonTournamentTeamCapacity(counts: CommonPositionCounts, totalCards: number): number {\n  return Math.max(0, Math.min(\n    Math.floor(Math.max(0, totalCards) / 5),\n    counts.GK,\n    counts.DEF,\n    counts.MID,\n    counts.FWD,\n  ));\n}\n\nfunction commonRewardTargetTeams(commonCountAfterReward: number): number {\n  // Start balancing toward the *next* 5-card milestone immediately. This gives\n  // five rewards to fill the four mandatory positions before 10/15/20 cards.\n  return Math.min(4, Math.max(1, Math.ceil(Math.max(1, commonCountAfterReward) / 5)));\n}\n\nfunction commonRewardPositionPriority(\n  counts: CommonPositionCounts,\n  commonCountAfterReward: number,\n): CommonTournamentPosition[] {\n  const targetTeams = commonRewardTargetTeams(commonCountAfterReward);\n  const tieBreaker = new Map(COMMON_TOURNAMENT_POSITIONS.map((position) => [position, Math.random()]));\n  return [...COMMON_TOURNAMENT_POSITIONS].sort((a, b) => {\n    const deficitA = Math.max(0, targetTeams - counts[a]);\n    const deficitB = Math.max(0, targetTeams - counts[b]);\n    if (deficitA !== deficitB) return deficitB - deficitA;\n    if (counts[a] !== counts[b]) return counts[a] - counts[b];\n    return Number(tieBreaker.get(a) || 0) - Number(tieBreaker.get(b) || 0);\n  });\n}\n\nasync function findWeeklyCommonPlayerForPosition(\n  executor: any,\n  userId: string,\n  position: CommonTournamentPosition,\n  avoidOwnedPlayer: boolean,\n) {\n  return rowsOf(await executor.execute(sql\`\n    SELECT p.id, p.name, p.position::text AS position\n    FROM app.players p\n    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n      AND p.position::text = \${position}\n      AND (\${avoidOwnedPlayer}::boolean = false OR NOT EXISTS (\n        SELECT 1 FROM app.player_cards owned\n        WHERE owned.owner_id = \${userId}\n          AND owned.player_id = p.id\n          AND owned.rarity::text = 'common'\n      ))\n      AND (\n        SELECT count(*) FROM app.player_cards supply\n        WHERE supply.player_id = p.id AND supply.rarity::text = 'common'\n      ) < 1000\n    ORDER BY random()\n    LIMIT 1\n  \`))[0] || null;\n}\n`;
  source = replaceRequired(source, rowsAnchor, helpers, "position helpers");

  const oldPlayerBlock = `    let player = rowsOf(await tx.execute(sql\`\n      SELECT p.id, p.name\n      FROM app.players p\n      WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n        AND NOT EXISTS (\n          SELECT 1 FROM app.player_cards owned\n          WHERE owned.owner_id = \${userId}\n            AND owned.player_id = p.id\n            AND owned.rarity::text = 'common'\n        )\n        AND (\n          SELECT count(*) FROM app.player_cards supply\n          WHERE supply.player_id = p.id AND supply.rarity::text = 'common'\n        ) < 1000\n      ORDER BY random()\n      LIMIT 1\n    \`))[0];\n\n    if (!player) {\n      player = rowsOf(await tx.execute(sql\`\n        SELECT p.id, p.name\n        FROM app.players p\n        WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n          AND (\n            SELECT count(*) FROM app.player_cards supply\n            WHERE supply.player_id = p.id AND supply.rarity::text = 'common'\n          ) < 1000\n        ORDER BY random()\n        LIMIT 1\n      \`))[0];\n    }\n\n    if (!player) throw new Error("No eligible Premier League player is available for the weekly reward");`;

  const newPlayerBlock = `    const positionCountsBefore = await loadCommonPositionCounts(tx, userId);\n    const commonCountAfterReward = commonCount + 1;\n    const targetTeamsAfterReward = commonRewardTargetTeams(commonCountAfterReward);\n    const teamCapacityBefore = commonTournamentTeamCapacity(positionCountsBefore, commonCount);\n    const positionPriority = commonRewardPositionPriority(positionCountsBefore, commonCountAfterReward);\n\n    let player: any = null;\n    let selectedPosition: CommonTournamentPosition | null = null;\n\n    // Prefer a new player identity in the most-needed position. If the user\n    // already owns every available player in that position, allow a duplicate\n    // Common identity rather than giving an unusable surplus position.\n    for (const position of positionPriority) {\n      player = await findWeeklyCommonPlayerForPosition(tx, userId, position, true);\n      if (!player) player = await findWeeklyCommonPlayerForPosition(tx, userId, position, false);\n      if (player) {\n        selectedPosition = position;\n        break;\n      }\n    }\n\n    if (!player || !selectedPosition) {\n      throw new Error("No eligible Premier League GK/DEF/MID/FWD player is available for the weekly Common reward");\n    }\n\n    const positionCountsAfter = { ...positionCountsBefore };\n    positionCountsAfter[selectedPosition] += 1;\n    const teamCapacityAfter = commonTournamentTeamCapacity(positionCountsAfter, commonCountAfterReward);`;
  source = replaceRequired(source, oldPlayerBlock, newPlayerBlock, "weekly player selection");

  source = replaceRequired(
    source,
    `${`        ${userId},\n        'system',\n        'Weekly common card collected',\n        ${\`You received ${String(player.name || "a Premier League player")} as this week's free common-card reward.\`}\n      )`}`,
    `${`        ${userId},\n        'system',\n        'Weekly common card collected',\n        ${\`You received ${String(player.name || "a Premier League player")} (${selectedPosition}) as this week's free Common-card reward. Weekly Common rewards prioritize positions that help you build more tournament teams.\`}\n      )`}`,
    "position-aware notification",
  );

  source = replaceRequired(
    source,
    `${`        ${userId},\n        'reward.weekly_common.claimed',\n        ${JSON.stringify({ rewardDay, cardId: Number(card.id), playerId: Number(player.id), commonCountAfter: commonCount + 1, cap: DAILY_LOGIN_COMMON_CARD_CAP, cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS })}::jsonb`}`,
    `${`        ${userId},\n        'reward.weekly_common.claimed',\n        ${JSON.stringify({\n          rewardDay,\n          cardId: Number(card.id),\n          playerId: Number(player.id),\n          selectedPosition,\n          rewardPositionStrategy: "tournament-team-balance",\n          targetTeamsAfterReward,\n          teamCapacityBefore,\n          teamCapacityAfter,\n          positionCountsBefore,\n          positionCountsAfter,\n          commonCountAfter: commonCountAfterReward,\n          cap: DAILY_LOGIN_COMMON_CARD_CAP,\n          cadenceDays: WEEKLY_COMMON_REWARD_INTERVAL_DAYS,\n        })}::jsonb`}`,
    "position-aware audit metadata",
  );

  return source;
});

patchFile(PANEL, (original) => {
  if (original.includes("COMMON_REWARD_POSITION_BALANCE_COPY_V1")) return original;
  const from = "Starter cards and weekly rewards count toward a maximum of ${cap} common cards.";
  const to = "Starter cards and weekly rewards count toward a maximum of ${cap} common cards. Weekly Common rewards prioritize the GK, DEF, MID or FWD position that helps unlock more tournament teams. /* COMMON_REWARD_POSITION_BALANCE_COPY_V1 */";
  if (!original.includes(from)) throw new Error("Common reward position-balance anchor not found: dashboard copy");
  return original.replace(from, to);
});

console.log("Weekly Common position balancing is ready: players remain random within the position needed to increase tournament-team capacity.");
