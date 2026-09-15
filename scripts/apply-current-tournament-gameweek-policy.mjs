import fs from "node:fs";

const POLICY_MARKER = "CURRENT_TOURNAMENT_GAMEWEEK_POLICY_V1";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, source) {
  fs.writeFileSync(file, source);
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[current-gameweek-policy] anchor not found: ${label}`);
  }
  return source.replace(from, to);
}

// Tournament UI: always open on the newest gameweek that is actually open/active.
// This intentionally prefers the tournament lifecycle over a stale previous FPL
// "is_current" flag during the Tuesday rollover window.
{
  const file = "client/src/pages/competitions-vault.tsx";
  let source = read(file);

  if (!source.includes(POLICY_MARKER)) {
    source = source.replace(
      'type VaultPayload = { summary?: Record<string, VaultSummary> };',
      'type VaultPayload = { currentGameWeek?: number; summary?: Record<string, VaultSummary> };',
    );

    const oldBlock = `  const currentGw = useMemo(() => {\n    const live = official.filter((c) => ["open", "active"].includes(String(c.status))).map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean).sort((a, b) => a - b);\n    if (live.length) return live[0];\n    const upcoming = official.filter((c) => c.status === "upcoming").map((c) => Number(c.gameWeek || c.game_week || 0)).filter(Boolean).sort((a, b) => a - b);\n    return upcoming[0] || 1;\n  }, [official]);`;

    const newBlock = `  const currentGw = useMemo(() => {\n    // ${POLICY_MARKER}: when a new tournament week opens, it becomes the default immediately.\n    // Using the highest open/active GW prevents a lingering previous-week status from pinning Play backwards.\n    const live = official\n      .filter((c) => ["open", "active"].includes(String(c.status || "").toLowerCase()))\n      .map((c) => Number(c.gameWeek || c.game_week || 0))\n      .filter(Boolean)\n      .sort((a, b) => b - a);\n    if (live.length) return live[0];\n\n    const vaultGameWeek = Number(prizeVault?.currentGameWeek || 0);\n    if (vaultGameWeek > 0) return vaultGameWeek;\n\n    const vaultWeeks = (Object.values(prizeVault?.summary || {}) as VaultSummary[])\n      .map((summary) => Number(summary?.currentGameWeek || 0))\n      .filter((gw) => Number.isInteger(gw) && gw > 0);\n    if (vaultWeeks.length) return Math.max(...vaultWeeks);\n\n    const upcoming = official\n      .filter((c) => String(c.status || "").toLowerCase() === "upcoming")\n      .map((c) => Number(c.gameWeek || c.game_week || 0))\n      .filter(Boolean)\n      .sort((a, b) => a - b);\n    return upcoming[0] || 1;\n  }, [official, prizeVault?.currentGameWeek, prizeVault?.summary]);`;

    source = replaceRequired(source, oldBlock, newBlock, "competitions current gameweek selector");
    write(file, source);
    console.log("[current-gameweek-policy] Tournament UI now defaults to the newest open/active gameweek.");
  }
}

// Paid official tournaments: retain existing history, but never recreate a deleted
// past gameweek. The current tournament week rolls forward on its Tuesday opening
// window even when FPL still reports the just-finished week as is_current.
{
  const file = "scripts/sync-official-tournaments.mjs";
  let source = read(file);

  if (!source.includes(POLICY_MARKER)) {
    source = replaceRequired(
      source,
      `    const currentGw = Math.max(1, Math.min(38, Number(currentEvent?.id || 1)));`,
      `    const fplCurrentGw = Math.max(1, Math.min(38, Number(currentEvent?.id || 1)));`,
      "paid sync FPL gameweek variable",
    );

    source = replaceRequired(
      source,
      `    }\n\n    await client.query("BEGIN");`,
      `    }\n\n    // ${POLICY_MARKER}: tournament entry weeks roll on their Tuesday opening window.\n    // This can be one week ahead of FPL's is_current flag after the previous fixtures finish.\n    const entryWindowGw = windows.reduce((latest, window) =>\n      now.getTime() >= window.start.getTime() ? Math.max(latest, Number(window.gw || 0)) : latest, 0);\n    const currentGw = Math.max(fplCurrentGw, entryWindowGw || 1);\n\n    await client.query("BEGIN");`,
      "paid sync entry-window gameweek",
    );

    source = replaceRequired(
      source,
      `    let fallbackWindows = 0;\n\n    for (const window of windows) {`,
      `    let fallbackWindows = 0;\n\n    // Retire any stale previous-week official tournaments without deleting history.\n    // If an admin has already deleted a past tournament, this sync deliberately leaves it deleted.\n    const retiredPast = await client.query(\n      \`update app.competitions\n          set status = 'closed'::text::\${competitionStatusType}\n        where created_by_user_id is null\n          and season = $1\n          and game_week < $2\n          and status::text not in ('completed', 'cancelled', 'closed')\n        returning id\`,\n      [SEASON, currentGw],\n    );\n\n    for (const window of windows) {\n      if (window.gw < currentGw) continue;`,
      "paid sync past-week retirement",
    );

    const oldCoverage = `    // Deployment must not start with partial official coverage. Count unique GW/rarity pairs,\n    // not raw rows, so duplicates cannot hide a missing gameweek or rarity.\n    const coverageResult = await client.query(\n      \`select count(*)::int as coverage_pairs\n         from (\n           select c.game_week, c.tier::text as tier\n             from app.competitions c\n            where c.created_by_user_id is null\n              and c.season = $1\n              and c.prize_key = 'ladder'\n              and c.game_week between 1 and 38\n              and c.tier::text in ('common','rare','unique','epic','legendary')\n            group by c.game_week, c.tier::text\n         ) coverage\`,\n      [SEASON],\n    );\n    const coveragePairs = Number(coverageResult.rows?.[0]?.coverage_pairs || 0);\n    if (coveragePairs !== 190) {\n      throw new Error(\`Official tournament coverage incomplete: expected 190 unique GW/rarity slots, found \${coveragePairs}\`);\n    }\n\n    await client.query("COMMIT");\n    console.log(\`Official tournaments synced for \${SEASON}. Current GW: \${currentGw}. Created \${created}, updated \${updated}.\`);\n    console.log(\`Verified \${coveragePairs}/190 official GW/rarity slots across all 38 gameweeks.\`);\n    console.log("Created/updated 5 official Prize Ladder tournaments per gameweek (190 total season slots) with no admin platform fee.");`;

    const newCoverage = `    // Current and future official slots must stay complete. Past slots are historical only:\n    // preserve rows that exist, but do not recreate rows an admin intentionally removed.\n    const expectedCoverage = (39 - currentGw) * RARITIES.length;\n    const coverageResult = await client.query(\n      \`select count(*)::int as coverage_pairs\n         from (\n           select c.game_week, c.tier::text as tier\n             from app.competitions c\n            where c.created_by_user_id is null\n              and c.season = $1\n              and c.prize_key = 'ladder'\n              and c.game_week between $2 and 38\n              and c.tier::text in ('common','rare','unique','epic','legendary')\n            group by c.game_week, c.tier::text\n         ) coverage\`,\n      [SEASON, currentGw],\n    );\n    const coveragePairs = Number(coverageResult.rows?.[0]?.coverage_pairs || 0);\n    if (coveragePairs !== expectedCoverage) {\n      throw new Error(\`Official tournament coverage incomplete from GW\${currentGw}: expected \${expectedCoverage} unique GW/rarity slots, found \${coveragePairs}\`);\n    }\n\n    await client.query("COMMIT");\n    console.log(\`Official tournaments synced for \${SEASON}. Current entry GW: \${currentGw}. Created \${created}, updated \${updated}, retired stale past rows \${retiredPast.rowCount || 0}.\`);\n    console.log(\`Verified \${coveragePairs}/\${expectedCoverage} current/future official GW/rarity slots (GW\${currentGw}-GW38).\`);\n    console.log("Past official tournament rows are preserved only when they already exist; deleted past weeks are not recreated.");`;

    source = replaceRequired(source, oldCoverage, newCoverage, "paid sync current/future coverage");
    write(file, source);
    console.log("[current-gameweek-policy] Paid tournament sync now preserves history without recreating deleted past weeks.");
  }
}

// FREE Card Cups follow the paid tournament current-week boundary. Only current
// and future cups are required/recreated; past deleted cups stay deleted.
{
  const file = "scripts/sync-free-card-tournaments.mjs";
  let source = read(file);

  if (!source.includes(POLICY_MARKER)) {
    const oldCheck = `    if (officialBySlot.size !== 190) {\n      throw new Error(\`Cannot sync FREE Card Cups until paid official coverage is complete; expected 190 slots, found \${officialBySlot.size}\`);\n    }`;

    const newCheck = `    // ${POLICY_MARKER}: use the newest live paid GW as the entry week.\n    // Paid sync closes stale past weeks before this script runs.\n    const livePaidGameweeks = [...new Set(\n      paidRows.rows\n        .filter((row) => ["open", "active"].includes(String(row.status || "").toLowerCase()))\n        .map((row) => Number(row.game_week))\n        .filter(Boolean),\n    )].sort((a, b) => b - a);\n    const upcomingPaidGameweeks = [...new Set(\n      paidRows.rows\n        .filter((row) => String(row.status || "").toLowerCase() === "upcoming")\n        .map((row) => Number(row.game_week))\n        .filter(Boolean),\n    )].sort((a, b) => a - b);\n    const currentGw = livePaidGameweeks[0] || upcomingPaidGameweeks[0] || 1;\n    const expectedPaidCoverage = (39 - currentGw) * FREE_CUP_RARITIES.length;\n    const currentFuturePaidCoverage = [...officialBySlot.keys()]\n      .filter((key) => Number(String(key).split(":")[0]) >= currentGw).length;\n    if (currentFuturePaidCoverage !== expectedPaidCoverage) {\n      throw new Error(\`Cannot sync FREE Card Cups until paid current/future coverage is complete from GW\${currentGw}; expected \${expectedPaidCoverage} slots, found \${currentFuturePaidCoverage}\`);\n    }`;

    source = replaceRequired(source, oldCheck, newCheck, "free sync paid coverage boundary");
    source = replaceRequired(
      source,
      `    for (let gw = 1; gw <= 38; gw += 1) {`,
      `    for (let gw = currentGw; gw <= 38; gw += 1) {`,
      "free sync current/future loop",
    );

    const oldCoverage = `    const coverage = await client.query(\n      \`select count(*)::int as coverage_pairs\n         from (\n           select c.game_week, c.tier::text as tier\n             from app.competitions c\n            where c.created_by_user_id is null\n              and c.season = $1\n              and coalesce(c.entry_fee, 0) = 0\n              and coalesce(c.prize_key, '') like 'free-%-card'\n              and c.game_week between 1 and 38\n              and c.tier::text in ('common','rare','unique','epic','legendary')\n            group by c.game_week, c.tier::text\n         ) slots\`,\n      [SEASON],\n    );\n    const coveragePairs = Number(coverage.rows?.[0]?.coverage_pairs || 0);\n    if (coveragePairs !== 190) {\n      throw new Error(\`FREE Card Cup coverage incomplete: expected 190 GW/rarity slots, found \${coveragePairs}\`);\n    }\n\n    await client.query("COMMIT");\n    console.log(\`FREE Card Cups synced for \${SEASON}: created \${created}, updated \${updated}, verified \${coveragePairs}/190 slots.\`);`;

    const newCoverage = `    const expectedCoverage = (39 - currentGw) * FREE_CUP_RARITIES.length;\n    const coverage = await client.query(\n      \`select count(*)::int as coverage_pairs\n         from (\n           select c.game_week, c.tier::text as tier\n             from app.competitions c\n            where c.created_by_user_id is null\n              and c.season = $1\n              and coalesce(c.entry_fee, 0) = 0\n              and coalesce(c.prize_key, '') like 'free-%-card'\n              and c.game_week between $2 and 38\n              and c.tier::text in ('common','rare','unique','epic','legendary')\n            group by c.game_week, c.tier::text\n         ) slots\`,\n      [SEASON, currentGw],\n    );\n    const coveragePairs = Number(coverage.rows?.[0]?.coverage_pairs || 0);\n    if (coveragePairs !== expectedCoverage) {\n      throw new Error(\`FREE Card Cup coverage incomplete from GW\${currentGw}: expected \${expectedCoverage} GW/rarity slots, found \${coveragePairs}\`);\n    }\n\n    await client.query("COMMIT");\n    console.log(\`FREE Card Cups synced for \${SEASON}: current entry GW \${currentGw}, created \${created}, updated \${updated}, verified \${coveragePairs}/\${expectedCoverage} current/future slots.\`);\n    console.log("Deleted past FREE Card Cups are not recreated.");`;

    source = replaceRequired(source, oldCoverage, newCoverage, "free sync current/future coverage");
    write(file, source);
    console.log("[current-gameweek-policy] FREE Card Cup sync now starts at the current entry gameweek.");
  }
}
