import fs from "node:fs";

const NOTIFICATION_ROUTES = "server/routes/notifications.routes.ts";
const COMMUNITY = "server/routes/communityChatV2.routes.ts";
const ECONOMY = "server/routes/economyIntegrity.routes.ts";
const DAILY = "server/services/dailyLoginReward.ts";
const PACK = "server/services/packAuctionEscrow.ts";
const MARKER = "NOTIFICATION_TRUTH_GUARDS_V1";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[notification-truth] patched ${path}`);
  } else {
    console.log(`[notification-truth] ${path} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[notification-truth] anchor not found: ${label}`);
  return source.replace(from, to);
}

patch(NOTIFICATION_ROUTES, (original) => {
  if (original.includes(`${MARKER}:gameweek-clock`)) return original;
  let source = original;
  source = replaceRequired(
    source,
    '      c.start_date as "startDate",',
    '      c.start_date as "startDate", c.fixture_window_start as "fixtureStart",',
    "fixture-window start field",
  );
  source = replaceRequired(
    source,
    '      const minutes = minutesUntil(competition.startDate);',
    `      // ${MARKER}:gameweek-clock\n      // start_date is the Tuesday entry-opening date. Start/lock alerts must use the\n      // first eligible Premier League kickoff, otherwise users can be warned days early.\n      const minutes = minutesUntil(competition.fixtureStart || competition.startDate);`,
    "upcoming gameweek clock",
  );
  source = replaceRequired(
    source,
    '    const earliest = [...gameweekRows].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];\n    const minutes = minutesUntil(earliest?.startDate);',
    '    const earliest = [...gameweekRows].sort((a, b) => new Date(a.fixtureStart || a.startDate).getTime() - new Date(b.fixtureStart || b.startDate).getTime())[0];\n    const minutes = minutesUntil(earliest?.fixtureStart || earliest?.startDate);',
    "earliest kickoff clock",
  );
  return source;
});

patch(ECONOMY, (original) => {
  if (original.includes(`${MARKER}:entry-evidence`)) return original;
  let source = original;
  const from = `    from app.competitions c\n    join app.users u on u.id = \${userId}\n    where c.id = \${competitionId}\n    limit 1`;
  const to = `    from app.competitions c\n    join app.users u on u.id = \${userId}\n    // ${MARKER}:entry-evidence\n    // A confirmation/admin alert is only allowed for the exact committed entry.\n    join app.competition_entries ce\n      on ce.id = \${entryId}\n     and ce.competition_id = c.id\n     and ce.user_id = u.id\n    where c.id = \${competitionId}\n    limit 1`;
  source = replaceRequired(source, from, to, "exact tournament-entry evidence");
  return source;
});

patch(COMMUNITY, (original) => {
  if (original.includes(`${MARKER}:unique-mention`)) return original;
  const oldBlock = `  const recipients = rowsOf(await db.execute(sql\`\n    SELECT id,\n      COALESCE(NULLIF(btrim(manager_team_name), ''), NULLIF(btrim(name), ''),\n        split_part(COALESCE(email, ''), '@', 1), 'Arena Manager') AS "teamName"\n    FROM app.users\n    WHERE id <> \${message.userId}\n      AND lower(left(regexp_replace(\n        regexp_replace(btrim(COALESCE(NULLIF(btrim(manager_team_name), ''),\n          NULLIF(btrim(name), ''), split_part(COALESCE(email, ''), '@', 1),\n          'Arena Manager')), '[[:space:]]+', '_', 'g'),\n        '[^A-Za-z0-9_]', '', 'g'), 30)) IN (\n          SELECT lower(mention_handle.handle)\n          FROM jsonb_array_elements_text(\${JSON.stringify(handles)}::jsonb)\n            AS mention_handle(handle)\n        )\n  \`));`;
  const newBlock = `  // ${MARKER}:unique-mention\n  // A text handle is not a unique account identifier. If two managers normalize to\n  // the same handle, do not guess which person was mentioned and notify neither.\n  const recipients = rowsOf(await db.execute(sql\`\n    WITH candidates AS (\n      SELECT id,\n        COALESCE(NULLIF(btrim(manager_team_name), ''), NULLIF(btrim(name), ''),\n          split_part(COALESCE(email, ''), '@', 1), 'Arena Manager') AS "teamName",\n        lower(left(regexp_replace(\n          regexp_replace(btrim(COALESCE(NULLIF(btrim(manager_team_name), ''),\n            NULLIF(btrim(name), ''), split_part(COALESCE(email, ''), '@', 1),\n            'Arena Manager')), '[[:space:]]+', '_', 'g'),\n          '[^A-Za-z0-9_]', '', 'g'), 30)) AS handle\n      FROM app.users\n      WHERE id <> \${message.userId}\n    ), unique_mentions AS (\n      SELECT candidates.handle, min(candidates.id) AS id\n      FROM candidates\n      WHERE candidates.handle IN (\n        SELECT lower(mention_handle.handle)\n        FROM jsonb_array_elements_text(\${JSON.stringify(handles)}::jsonb) AS mention_handle(handle)\n      )\n      GROUP BY candidates.handle\n      HAVING count(*) = 1\n    )\n    SELECT candidate.id, candidate."teamName"\n    FROM candidates candidate\n    JOIN unique_mentions unique_mention ON unique_mention.id = candidate.id\n  \`));`;
  return replaceRequired(original, oldBlock, newBlock, "unique community mention recipients");
});

patch(DAILY, (original) => {
  if (original.includes(`${MARKER}:weekly-reward`)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { db } from "../db.js";',
    'import { db } from "../db.js";\nimport { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
    "weekly notification import",
  );
  source = replaceRequired(
    source,
    'export async function claimDailyLoginReward(userId: string) {\n  await ensureDailyLoginRewardSchema();',
    `export async function claimDailyLoginReward(userId: string) {\n  await ensureDailyLoginRewardSchema();\n  await ensureNotificationsSchema();\n  // ${MARKER}:weekly-reward`,
    "weekly notification schema",
  );
  const raw = `    await tx.execute(sql\`\n      INSERT INTO app.notifications (user_id, type, title, message)\n      VALUES (\n        \${userId},\n        'system',\n        'Weekly common card collected',\n        \${\`You received \${String(player.name || "a Premier League player")} as this week's free common-card reward.\`}\n      )\n    \`);`;
  const guarded = `    // The reward row and owned card were created in this same transaction before\n    // the alert, so a rolled-back/failed reward can never leave a success notification.\n    await createNotificationOnce(tx, {\n      userId,\n      title: "Weekly common card collected",\n      message: \`You received \${String(player.name || "a Premier League player")} as this week's free common-card reward.\`,\n      dedupeKey: \`weekly-common:\${rewardDay}:card:\${Number(card.id)}\`,\n    });`;
  source = replaceRequired(source, raw, guarded, "weekly reward notification");
  return source;
});

patch(PACK, (original) => {
  if (original.includes(`${MARKER}:pack-auction`)) return original;
  let source = original;
  source = replaceRequired(
    source,
    'import { db } from "../db.js";',
    'import { db } from "../db.js";\nimport { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";',
    "pack notification import",
  );
  source = replaceRequired(
    source,
    '    packAuctionSchemaReady = (async () => {',
    `    packAuctionSchemaReady = (async () => {\n      await ensureNotificationsSchema();\n      // ${MARKER}:pack-auction`,
    "pack notification schema",
  );
  const buyNowRaw = `    await tx.execute(sql\`\n      INSERT INTO app.notifications (user_id, type, title, message, read, created_at)\n      VALUES (\${buyerId}, 'system', 'Pack auction won', \${\`Congratulations! You purchased the \${auction.rarity} five-card pack for N$\${price.toFixed(2)}.\`}, false, now())\n    \`);`;
  const buyNowGuarded = `    await createNotificationOnce(tx, {\n      userId: buyerId,\n      title: "Pack auction won",\n      message: \`Congratulations! You purchased the \${auction.rarity} five-card pack for N$\${price.toFixed(2)}.\`,\n      dedupeKey: \`pack-auction:\${auctionId}:settled:\${buyerId}\`,\n    });`;
  source = replaceRequired(source, buyNowRaw, buyNowGuarded, "buy-now settlement notification");

  const settleRaw = `    await tx.execute(sql\`\n      INSERT INTO app.notifications (user_id, type, title, message, read, created_at)\n      VALUES (\${winnerId}, 'system', 'Pack auction won', \${\`Congratulations! You won the \${auction.rarity} five-card pack for N$\${amount.toFixed(2)}.\`}, false, now())\n    \`);`;
  const settleGuarded = `    await createNotificationOnce(tx, {\n      userId: winnerId,\n      title: "Pack auction won",\n      message: \`Congratulations! You won the \${auction.rarity} five-card pack for N$\${amount.toFixed(2)}.\`,\n      dedupeKey: \`pack-auction:\${auctionId}:settled:\${winnerId}\`,\n    });`;
  source = replaceRequired(source, settleRaw, settleGuarded, "auction settlement notification");
  return source;
});

console.log("Notification truth guards ready: kickoff-based gameweek timing, exact entry evidence, unique mentions, and transaction-backed reward/auction notifications.");