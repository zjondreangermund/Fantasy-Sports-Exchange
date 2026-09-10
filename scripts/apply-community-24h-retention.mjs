import fs from "node:fs";

function patchFile(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[community-24h] patched ${path}`);
  } else console.log(`[community-24h] ${path} already ready`);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[community-24h] anchor not found: ${label}`);
  return source.replace(from, to);
}

patchFile("client/src/lib/community-chat.ts", (source) => source.replace(
  "const MAX_SAVED_AGE_MS = 30 * 24 * 60 * 60 * 1000;",
  "const MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000; // COMMUNITY_24H_RETENTION_V2",
));

patchFile("server/routes/communityChatV2.routes.ts", (original) => {
  let source = original;

  if (!source.includes("COMMUNITY_24H_RETENTION_V2")) {
    source = replaceOnce(
      source,
      "let schemaReady: Promise<void> | null = null;\n",
      "let schemaReady: Promise<void> | null = null;\nlet communityRetentionTimer: ReturnType<typeof setInterval> | null = null;\nconst COMMUNITY_CHAT_RETENTION_MS = 24 * 60 * 60 * 1000; // COMMUNITY_24H_RETENTION_V2\n",
      "retention state",
    );
  }

  if (!source.includes("async function purgeExpiredCommunityMessages()")) {
    const anchor = "function sameOrigin(req: any) {";
    const helper = `async function purgeExpiredCommunityMessages() {\n  await ensureSchema();\n  // Rolling 24-hour Community Live: remove the chat row itself. Reply FKs are\n  // ON DELETE SET NULL, so newer conversations remain valid. Mention pushes are\n  // delivered when the message is created; their delivery is not disabled.\n  await db.execute(sql\`\n    DELETE FROM app.community_chat_messages\n    WHERE created_at < now() - interval '24 hours'\n  \`);\n}\n\n`;
    if (!source.includes(anchor)) throw new Error("[community-24h] sameOrigin anchor missing");
    source = source.replace(anchor, `${helper}${anchor}`);
  }

  source = replaceOnce(
    source,
    "  const row = rowsOf(await db.execute(messageSelect(sql`WHERE m.id = ${id} LIMIT 1`)))[0];",
    "  const row = rowsOf(await db.execute(messageSelect(sql`WHERE m.id = ${id} AND m.created_at >= now() - interval '24 hours' LIMIT 1`)))[0];",
    "single-message TTL",
  );

  source = replaceOnce(
    source,
    "      const where = before > 0 ? sql`WHERE m.id < ${before}` : sql``;",
    "      await purgeExpiredCommunityMessages().catch((error) => console.warn(\"Community Live retention cleanup failed:\", error));\n      const where = before > 0\n        ? sql`WHERE m.created_at >= now() - interval '24 hours' AND m.id < ${before}`\n        : sql`WHERE m.created_at >= now() - interval '24 hours'`;",
    "history TTL",
  );

  if (!source.includes("Community Live scheduled 24-hour cleanup failed")) {
    const anchor = "  void ensureSchema().catch((error) => console.warn(\"Community Live v2 schema ensure failed:\", error));\n";
    const scheduler = `  if (!communityRetentionTimer) {\n    void purgeExpiredCommunityMessages().catch((error) => console.warn("Community Live startup 24-hour cleanup failed:", error));\n    communityRetentionTimer = setInterval(() => {\n      void purgeExpiredCommunityMessages().catch((error) => console.warn("Community Live scheduled 24-hour cleanup failed:", error));\n    }, Math.min(COMMUNITY_CHAT_RETENTION_MS, 60 * 60 * 1000));\n    (communityRetentionTimer as any).unref?.();\n  }\n`;
    if (!source.includes(anchor)) throw new Error("[community-24h] route registration anchor missing");
    source = source.replace(anchor, `${anchor}${scheduler}`);
  }

  // A reply cannot target an expired message even if cleanup has not run yet.
  source = replaceOnce(
    source,
    "        const parent = rowsOf(await db.execute(sql`SELECT id FROM app.community_chat_messages WHERE id = ${replyToId} LIMIT 1`))[0];",
    "        const parent = rowsOf(await db.execute(sql`SELECT id FROM app.community_chat_messages WHERE id = ${replyToId} AND created_at >= now() - interval '24 hours' LIMIT 1`))[0];",
    "reply TTL",
  );

  return source;
});
