import fs from "node:fs";

const MARKER = "CURRENT_EPL_CHAT_ENTRY_NOTIFICATIONS_V1";

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[arena-live-entry] patched ${path}`);
  } else {
    console.log(`[arena-live-entry] ${path} already ready`);
  }
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[arena-live-entry] anchor not found: ${label}`);
  return source.replace(from, to);
}

function insertBefore(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[arena-live-entry] anchor not found: ${label}`);
  return source.replace(anchor, `${insertion}${anchor}`);
}

function insertAfter(source, anchor, insertion, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(anchor)) throw new Error(`[arena-live-entry] anchor not found: ${label}`);
  return source.replace(anchor, `${anchor}${insertion}`);
}

// Community Live: true rolling 24-hour history on both server and browser cache.
patchFile("client/src/lib/community-chat.ts", (original) => {
  return original.replace(
    "const MAX_SAVED_AGE_MS = 30 * 24 * 60 * 60 * 1000;",
    "const MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000; // COMMUNITY_24H_RETENTION_V1",
  );
});

patchFile("server/routes/communityChatV2.routes.ts", (original) => {
  let source = original;

  source = insertAfter(
    source,
    "let schemaReady: Promise<void> | null = null;\n",
    "let communityRetentionTimer: ReturnType<typeof setInterval> | null = null;\nconst COMMUNITY_RETENTION_HOURS = 24; // COMMUNITY_24H_RETENTION_V1\n",
    "COMMUNITY_24H_RETENTION_V1",
    "community retention constants",
  );

  const purgeBlock = `async function purgeExpiredCommunityMessages() {\n  await ensureSchema();\n  await ensureNotificationsSchema();\n  await db.execute(sql\`\n    DELETE FROM app.notifications n\n    USING app.community_chat_messages m\n    WHERE m.created_at < now() - interval '24 hours'\n      AND n.dedupe_key LIKE ('community-mention:' || m.id::text || ':%')\n  \`);\n  await db.execute(sql\`\n    DELETE FROM app.community_chat_messages\n    WHERE created_at < now() - interval '24 hours'\n  \`);\n}\n\n`;

  source = insertBefore(
    source,
    "function sameOrigin(req: any) {",
    purgeBlock,
    "async function purgeExpiredCommunityMessages()",
    "community retention purge",
  );

  source = replaceRequired(
    source,
    "  const row = rowsOf(await db.execute(messageSelect(sql`WHERE m.id = ${id} LIMIT 1`)))[0];",
    "  const row = rowsOf(await db.execute(messageSelect(sql`WHERE m.id = ${id} AND m.created_at >= now() - interval '24 hours' LIMIT 1`)))[0];",
    "single community message retention guard",
  );

  source = replaceRequired(
    source,
    "      const where = before > 0 ? sql`WHERE m.id < ${before}` : sql``;",
    "      await purgeExpiredCommunityMessages().catch((error) => console.warn(\"Community Live retention cleanup failed:\", error));\n      const where = before > 0\n        ? sql`WHERE m.created_at >= now() - interval '24 hours' AND m.id < ${before}`\n        : sql`WHERE m.created_at >= now() - interval '24 hours'`;",
    "community history 24-hour filter",
  );

  const scheduleAnchor = "  void ensureSchema().catch((error) => console.warn(\"Community Live v2 schema ensure failed:\", error));\n";
  const scheduleBlock = `  if (!communityRetentionTimer) {\n    void purgeExpiredCommunityMessages().catch((error) => console.warn("Community Live startup retention cleanup failed:", error));\n    communityRetentionTimer = setInterval(() => {\n      void purgeExpiredCommunityMessages().catch((error) => console.warn("Community Live scheduled retention cleanup failed:", error));\n    }, 60 * 60 * 1000);\n    (communityRetentionTimer as any).unref?.();\n  }\n`;
  source = insertAfter(
    source,
    scheduleAnchor,
    scheduleBlock,
    "Community Live scheduled retention cleanup failed",
    "community hourly purge scheduler",
  );

  return source;
});

// Keep automatic Common-card rewards away from stale/departed player rows.
patchFile("scripts/apply-common-reward-position-balance.mjs", (original) => {
  let source = original;
  const strictFilter = "      AND coalesce(p.fpl_id, 0) > 0\\n      AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\\n";
  const generatedLeagueLine = "    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\\n";
  if (!source.includes("NOT IN ('departed', 'superseded', 'unlinked', 'archived')")) {
    if (!source.includes(generatedLeagueLine)) throw new Error("[arena-live-entry] weekly Common generated player filter anchor missing");
    source = source.replace(generatedLeagueLine, `${generatedLeagueLine}${strictFilter}`);
  }
  return source;
});

patchFile("server/services/dailyLoginReward.ts", (original) => {
  let source = original;
  if (source.includes("COMMON_REWARD_POSITION_BALANCE_V1")) {
    const leagueLine = "    WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n";
    const strict = "      AND coalesce(p.fpl_id, 0) > 0\n      AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\n";
    if (!source.includes("NOT IN ('departed', 'superseded', 'unlinked', 'archived')")) {
      if (!source.includes(leagueLine)) throw new Error("[arena-live-entry] weekly Common runtime player filter anchor missing");
      source = source.replace(leagueLine, `${leagueLine}${strict}`);
    }
  } else {
    const leagueLine = "      WHERE regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') IN ('premierleague', 'englishpremierleague', 'epl')\n";
    const strict = "        AND coalesce(p.fpl_id, 0) > 0\n        AND lower(coalesce(p.status, 'a')) NOT IN ('departed', 'superseded', 'unlinked', 'archived')\n";
    if (!source.includes("NOT IN ('departed', 'superseded', 'unlinked', 'archived')")) {
      const occurrences = source.split(leagueLine).length - 1;
      if (occurrences < 1) throw new Error("[arena-live-entry] weekly reward player filter anchor missing");
      source = source.replaceAll(leagueLine, `${leagueLine}${strict}`);
    }
  }
  return source;
});

// Referral rewards already require FPL identity; also reject archived rows explicitly.
patchFile("server/routes/referrals.routes.ts", (original) => {
  return original.replace(
    "![\"departed\", \"superseded\", \"unlinked\"].includes(status)",
    "![\"departed\", \"superseded\", \"unlinked\", \"archived\"].includes(status)",
  );
});

// Reward-repair cards must never be minted from stale league-only rows.
patchFile("server/services/tournamentRewards.ts", (original) => {
  let source = original;
  const old = "  const allPlayers = shuffle(await storage.getPlayers());";
  const replacement = `  const allPlayers = shuffle((await storage.getPlayers()).filter((player: any) => {\n    const league = String(player?.league || "").toLowerCase().replace(/[^a-z0-9]+/g, "");\n    const fplId = Number(player?.fplId ?? player?.fpl_id ?? 0);\n    const status = String(player?.status || "a").toLowerCase();\n    return ["premierleague", "englishpremierleague", "epl"].includes(league)\n      && fplId > 0\n      && !["departed", "superseded", "unlinked", "archived"].includes(status);\n  })); // CURRENT_EPL_REWARD_REPAIR_V1`;
  source = replaceRequired(source, old, replacement, "tournament reward repair current EPL filter");
  return source;
});

// Free Cup live draw is already based on the current FPL feed. Tighten its DB fallback
// so a recently departed/unlinked player can never be selected when the live provider
// is temporarily unavailable.
patchFile("scripts/apply-free-card-cup-auto-awards.mjs", (original) => {
  let source = original;
  const old = "                where regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') in ('premierleague','englishpremierleague','epl')\\n                order by random()";
  const replacement = "                where regexp_replace(lower(coalesce(p.league, '')), '[^a-z0-9]+', '', 'g') in ('premierleague','englishpremierleague','epl')\\n                  and coalesce(p.fpl_id, 0) > 0\\n                  and lower(coalesce(p.status, 'a')) not in ('departed','superseded','unlinked','archived')\\n                order by random()";
  source = replaceRequired(source, old, replacement, "Free Cup strict local EPL fallback");
  return source;
});

// Tournament team submission + every-25-entry momentum pushes.
patchFile("server/routes/economyIntegrity.routes.ts", (original) => {
  let source = original;

  const helper = `// TOURNAMENT_ENTRY_PUSH_V1\nasync function notifyTournamentEntryActivity(userId: string, competitionId: number, entryId: number) {\n  await ensureNotificationsSchema();\n  const context = rowsOf(await db.execute(sql\`\n    select c.id, c.name, c.tier::text as tier, c.game_week as "gameWeek",\n      coalesce(c.entry_fee, 0)::float as "entryFee",\n      coalesce(c.prize_key, '') as "prizeKey", coalesce(c.prize_type, 'goods') as "prizeType",\n      coalesce(c.visibility, 'public') as visibility, c.created_by_user_id as "createdByUserId",\n      coalesce(nullif(btrim(u.manager_team_name), ''), nullif(btrim(u.name), ''),\n        split_part(coalesce(u.email, ''), '@', 1), 'Arena Manager') as "teamName"\n    from app.competitions c\n    join app.users u on u.id = \${userId}\n    where c.id = \${competitionId}\n    limit 1\n  \`))[0];\n  if (!context) return;\n\n  const teamName = String(context.teamName || "Arena Manager");\n  const tournamentName = String(context.name || "Fantasy Arena tournament");\n  const gameWeek = Number(context.gameWeek || 0);\n  await createNotificationOnce(db, {\n    userId,\n    title: \`✅ \${teamName} is entered!\`,\n    message: \`\${teamName} has been submitted to \${tournamentName}. Your five-player team is locked in and ready for Gameweek \${gameWeek}.\`,\n    dedupeKey: \`competition:\${competitionId}:entry:\${entryId}:submitted\`,\n  });\n\n  const ladder = String(context.visibility || "public").toLowerCase() === "public"\n    && !context.createdByUserId\n    && String(context.prizeKey || "").toLowerCase() === "ladder";\n\n  let milestoneCount = 0;\n  let recipients: any[] = [];\n  if (ladder) {\n    milestoneCount = Number(rowsOf(await db.execute(sql\`\n      select count(*)::int as count\n      from app.competition_entries ce\n      join app.competitions c on c.id = ce.competition_id\n      where c.game_week = \${gameWeek}\n        and c.tier::text = \${String(context.tier || "common")}\n        and coalesce(c.visibility, 'public') = 'public'\n        and coalesce(c.prize_key, '') = 'ladder'\n        and c.created_by_user_id is null\n    \`))[0]?.count || 0);\n    recipients = rowsOf(await db.execute(sql\`\n      select distinct ce.user_id as "userId"\n      from app.competition_entries ce\n      join app.competitions c on c.id = ce.competition_id\n      where c.game_week = \${gameWeek}\n        and c.tier::text = \${String(context.tier || "common")}\n        and coalesce(c.visibility, 'public') = 'public'\n        and coalesce(c.prize_key, '') = 'ladder'\n        and c.created_by_user_id is null\n    \`));\n  } else {\n    milestoneCount = Number(rowsOf(await db.execute(sql\`\n      select count(*)::int as count from app.competition_entries where competition_id = \${competitionId}\n    \`))[0]?.count || 0);\n    recipients = rowsOf(await db.execute(sql\`\n      select distinct user_id as "userId" from app.competition_entries where competition_id = \${competitionId}\n    \`));\n  }\n\n  if (milestoneCount < 25 || milestoneCount % 25 !== 0) return;\n\n  let title = \`🔥 \${milestoneCount} entries — \${tournamentName} is heating up!\`;\n  let message = \`\${milestoneCount} teams are now in \${tournamentName}. More managers are joining, the pressure is building, and the Arena is getting louder. 🔥\`;\n  let milestoneKey = \`competition:\${competitionId}:milestone:\${milestoneCount}\`;\n\n  if (ladder) {\n    const ladderState = getActivePrizeForEntries(String(context.tier || "common"), milestoneCount);\n    const activePrize = ladderState.activePrize;\n    const nextPrize = ladderState.nextPrize;\n    title = \`🔥 \${milestoneCount} entries — \${String(context.tier || "common").toUpperCase()} Prize Ladder moving!\`;\n    const activeText = activePrize ? \`\${activePrize.title} is unlocked. \` : "";\n    const nextText = nextPrize\n      ? \`Next bigger reward: \${nextPrize.title} at \${nextPrize.requiredEntrants} entries.\`\n      : "The top reward tier is live — now it is all about the leaderboard.";\n    message = \`Gameweek \${gameWeek} just hit \${milestoneCount} qualifying entries. \${activeText}\${nextText} 🚀 Keep the momentum going!\`;\n    milestoneKey = \`prize-ladder:\${gameWeek}:\${String(context.tier || "common")}:milestone:\${milestoneCount}\`;\n  }\n\n  for (const recipient of recipients) {\n    const recipientId = String(recipient.userId || "");\n    if (!recipientId) continue;\n    await createNotificationOnce(db, {\n      userId: recipientId,\n      title,\n      message,\n      dedupeKey: milestoneKey,\n    });\n  }\n}\n\n`;

  source = insertBefore(
    source,
    "export function registerEconomyIntegrityRoutes(app: Express, deps: RegisterEconomyIntegrityRoutesDeps) {",
    helper,
    "TOURNAMENT_ENTRY_PUSH_V1",
    "tournament entry notification helper",
  );

  source = insertAfter(
    source,
    "      });\n\n      let scoreRefresh: { updatedEntries: number; skipped: boolean } | null = null;",
    "\n      await notifyTournamentEntryActivity(userId, competitionId, Number(entry.id)).catch((error) => {\n        console.error(\"Tournament entry notification failed:\", error);\n      });\n",
    "Tournament entry notification failed:",
    "tournament entry notification call",
  );

  return source;
});

console.log(`${MARKER}: current EPL reward guards, 24-hour Community Live retention, mention-safe cleanup, tournament submission pushes and 25-entry momentum notifications are ready.`);
