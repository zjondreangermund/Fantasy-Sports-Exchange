import fs from "node:fs";

const ECONOMY = "server/routes/economyIntegrity.routes.ts";
const NOTIFICATIONS = "server/services/notifications.ts";
const NATIVE_PUSH = "server/services/nativePush.ts";
const MARKER = "DURABLE_TOURNAMENT_ENTRY_NOTIFICATIONS_V1";
const RECONCILE_MARKER = "TOURNAMENT_ENTRY_NOTIFICATION_RECONCILE_V1";

function patch(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[durable-entry-push] patched ${path}`);
  } else {
    console.log(`[durable-entry-push] ${path} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[durable-entry-push] anchor not found: ${label}`);
  return source.replace(from, to);
}

patch(ECONOMY, (original) => {
  if (original.includes(MARKER)) return original;
  if (!original.includes("createFantasyArenaAdminNotificationOnce")) {
    throw new Error("[durable-entry-push] admin notification helper must be applied before durability patch");
  }

  let source = original;
  const transactionAnchor = `      const entry = await db.transaction(async (tx) => {\n`;
  source = replaceRequired(
    source,
    transactionAnchor,
    `      // ${MARKER}: create the entrant/admin notification rows and delivery jobs in\n      // the same DB transaction as the entry. A deploy/restart after commit can no\n      // longer leave a valid tournament entry without its notifications.\n      await ensureNotificationsSchema();\n      const entry = await db.transaction(async (tx) => {\n`,
    "entry transaction start",
  );

  const returnAnchor = `        return createdEntry;\n      });\n`;
  const durableBlock = `        const notificationIdentity = rowsOf(await tx.execute(sql\`\n          select coalesce(\n            nullif(btrim(manager_team_name), ''),\n            nullif(btrim(name), ''),\n            split_part(coalesce(email, ''), '@', 1),\n            'Arena Manager'\n          ) as "teamName"\n          from app.users\n          where id = \${userId}\n          limit 1\n        \`))[0];\n        const submittedTeamName = String(notificationIdentity?.teamName || "Arena Manager");\n        const submittedEntryId = Number(createdEntry.id);\n        const submittedGameWeek = Number(competition.gameWeek || 0);\n        const submittedTournamentName = String(competition.name || "Fantasy Arena tournament");\n\n        await createNotificationOnce(tx, {\n          userId,\n          title: \`✅ \${submittedTeamName} is entered!\`,\n          message: \`\${submittedTeamName} has been entered into \${submittedTournamentName}. Your 5-player team is locked in and ready for Gameweek \${submittedGameWeek}. ⚽🔥\`,\n          dedupeKey: \`competition:\${competitionId}:entry:\${submittedEntryId}:submitted\`,\n        });\n        await createFantasyArenaAdminNotificationOnce(tx, {\n          title: \`🎟️ New tournament entry — \${submittedTeamName}\`,\n          message: \`\${submittedTeamName} just entered \${submittedTournamentName} for Gameweek \${submittedGameWeek}. Open Admin to view the tournament and entry activity.\`,\n          dedupeKey: \`admin:competition:\${competitionId}:entry:\${submittedEntryId}\`,\n        });\n\n        return createdEntry;\n      });\n`;
  source = replaceRequired(source, returnAnchor, durableBlock, "atomic entry notification insert");
  return source;
});

patch(NOTIFICATIONS, (original) => {
  if (original.includes(RECONCILE_MARKER)) return original;
  if (!original.includes("createFantasyArenaAdminNotificationOnce")) {
    throw new Error("[durable-entry-push] admin notification helper missing from notifications service");
  }

  const reconcile = `\n// ${RECONCILE_MARKER}: repair notification rows for recently committed tournament\n// entries. Dedupe keys make this safe to run repeatedly and allow a replacement\n// deployment to recover the narrow window that existed before ${MARKER}.\nexport async function reconcileRecentTournamentEntryNotifications(limit = 100) {\n  await ensureNotificationsSchema();\n  const safeLimit = Math.max(1, Math.min(200, Number(limit || 100)));\n  const result = await db.execute(sql\`\n    select ce.id as "entryId", ce.user_id as "userId", ce.competition_id as "competitionId",\n      c.name as "tournamentName", c.game_week as "gameWeek",\n      coalesce(\n        nullif(btrim(u.manager_team_name), ''),\n        nullif(btrim(u.name), ''),\n        split_part(coalesce(u.email, ''), '@', 1),\n        'Arena Manager'\n      ) as "teamName"\n    from app.competition_entries ce\n    join app.competitions c on c.id = ce.competition_id\n    join app.users u on u.id = ce.user_id\n    left join app.users admin_user\n      on lower(coalesce(admin_user.email, '')) = \${FANTASY_ARENA_ADMIN_NOTIFICATION_EMAIL}\n    where ce.joined_at >= now() - interval '14 days'\n      and (\n        not exists (\n          select 1\n          from app.notifications n\n          where n.user_id = ce.user_id\n            and n.dedupe_key = ('competition:' || ce.competition_id || ':entry:' || ce.id || ':submitted')\n        )\n        or (\n          admin_user.id is not null\n          and not exists (\n            select 1\n            from app.notifications n\n            where n.user_id = admin_user.id\n              and n.dedupe_key = ('admin:competition:' || ce.competition_id || ':entry:' || ce.id)\n          )\n        )\n      )\n    order by ce.joined_at desc, ce.id desc\n    limit \${safeLimit}\n  \`);\n  const entries = Array.isArray(result?.rows) ? result.rows : [];\n\n  let repaired = 0;\n  for (const entry of entries) {\n    const entryId = Number(entry.entryId);\n    const competitionId = Number(entry.competitionId);\n    const userId = String(entry.userId || "");\n    const teamName = String(entry.teamName || "Arena Manager");\n    const tournamentName = String(entry.tournamentName || "Fantasy Arena tournament");\n    const gameWeek = Number(entry.gameWeek || 0);\n    if (!entryId || !competitionId || !userId) continue;\n\n    await db.transaction(async (tx: any) => {\n      await createNotificationOnce(tx, {\n        userId,\n        title: \`✅ \${teamName} is entered!\`,\n        message: \`\${teamName} has been entered into \${tournamentName}. Your 5-player team is locked in and ready for Gameweek \${gameWeek}. ⚽🔥\`,\n        dedupeKey: \`competition:\${competitionId}:entry:\${entryId}:submitted\`,\n      });\n      await createFantasyArenaAdminNotificationOnce(tx, {\n        title: \`🎟️ New tournament entry — \${teamName}\`,\n        message: \`\${teamName} just entered \${tournamentName} for Gameweek \${gameWeek}. Open Admin to view the tournament and entry activity.\`,\n        dedupeKey: \`admin:competition:\${competitionId}:entry:\${entryId}\`,\n      });\n    });\n    repaired += 1;\n  }\n\n  return repaired;\n}\n`;
  return `${original.trimEnd()}\n${reconcile}`;
});

patch(NATIVE_PUSH, (original) => {
  if (original.includes(RECONCILE_MARKER)) return original;
  let source = original;
  source = replaceRequired(
    source,
    `import { ensureNotificationsSchema } from "./notifications.js";\n`,
    `import { ensureNotificationsSchema, reconcileRecentTournamentEntryNotifications } from "./notifications.js";\n`,
    "native push reconciliation import",
  );

  const workerAnchor = `let workerTimer: NodeJS.Timeout | null = null;\n\nexport function startNativePushDeliveryWorker() {\n  if (workerTimer) return;\n  const run = () => {\n    void processPendingNativePushDeliveries().catch((error) => {\n      console.error("Native push delivery worker failed:", error);\n    });\n  };\n`;
  const durableWorker = `// ${RECONCILE_MARKER}: periodically heal any recently committed entry that is\n// missing its personal or admin notification before processing pending pushes.\nlet lastTournamentEntryReconcileAt = 0;\nlet workerTimer: NodeJS.Timeout | null = null;\n\nexport function startNativePushDeliveryWorker() {\n  if (workerTimer) return;\n  const run = () => {\n    void (async () => {\n      const now = Date.now();\n      if (now - lastTournamentEntryReconcileAt >= 60_000) {\n        lastTournamentEntryReconcileAt = now;\n        try {\n          const repaired = await reconcileRecentTournamentEntryNotifications();\n          if (repaired > 0) console.info(\`Repaired \${repaired} tournament entry notification set(s).\`);\n        } catch (error) {\n          console.error("Tournament entry notification reconciliation failed:", error);\n        }\n      }\n      await processPendingNativePushDeliveries();\n    })().catch((error) => {\n      console.error("Native push delivery worker failed:", error);\n    });\n  };\n`;
  source = replaceRequired(source, workerAnchor, durableWorker, "native push worker reconciliation");
  return source;
});

console.log("Tournament entry notifications are atomic with entry commits and recent missing entry notifications are self-healing.");
