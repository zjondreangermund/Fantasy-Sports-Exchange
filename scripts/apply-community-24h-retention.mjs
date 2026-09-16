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

// Start this rollout with a clean local room and keep only the current 24-hour room
// in browser storage. The server-supplied reset timestamp below prevents stale
// messages from being restored after future automatic resets.
patchFile("client/src/lib/community-chat.ts", (original) => {
  let source = original;
  source = source.replace(
    "const MAX_SAVED_AGE_MS = 30 * 24 * 60 * 60 * 1000;",
    "const MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000; // COMMUNITY_24H_RESET_V3",
  );
  source = source.replace(
    'const CHAT_STORAGE_PREFIX = "fantasy_arena_community_messages_v3:";',
    'const CHAT_STORAGE_PREFIX = "fantasy_arena_community_messages_v4:"; // COMMUNITY_CACHE_RESET_V4',
  );
  return source;
});

patchFile("server/routes/communityChatV2.routes.ts", (original) => {
  let source = original;

  if (!source.includes("COMMUNITY_24H_RESET_V3")) {
    source = replaceOnce(
      source,
      "let schemaReady: Promise<void> | null = null;\n",
      "let schemaReady: Promise<void> | null = null;\nlet communityRetentionTimer: ReturnType<typeof setInterval> | null = null;\nlet communityResetCheckInFlight: Promise<Date> | null = null;\nconst COMMUNITY_CHAT_RESET_MS = 24 * 60 * 60 * 1000; // COMMUNITY_24H_RESET_V3\n",
      "daily reset state",
    );
  }

  if (!source.includes("app.community_chat_maintenance")) {
    const anchor = "      await db.execute(sql`CREATE INDEX IF NOT EXISTS community_chat_messages_reply_idx ON app.community_chat_messages (reply_to_id) WHERE reply_to_id IS NOT NULL`);\n";
    const maintenanceSchema = `      await db.execute(sql\`\n        CREATE TABLE IF NOT EXISTS app.community_chat_maintenance (\n          singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),\n          last_cleared_at timestamptz\n        )\n      \`);\n      await db.execute(sql\`\n        INSERT INTO app.community_chat_maintenance (singleton, last_cleared_at)\n        VALUES (true, NULL)\n        ON CONFLICT (singleton) DO NOTHING\n      \`);\n`;
    if (!source.includes(anchor)) throw new Error("[community-24h] schema index anchor missing");
    source = source.replace(anchor, `${anchor}${maintenanceSchema}`);
  }

  if (!source.includes("async function resetCommunityChatIfDue()")) {
    const anchor = "function sameOrigin(req: any) {";
    const helper = `async function resetCommunityChatIfDue() {\n  if (communityResetCheckInFlight) return communityResetCheckInFlight;\n\n  communityResetCheckInFlight = (async () => {\n    await ensureSchema();\n    return db.transaction(async (tx) => {\n      const state = rowsOf(await tx.execute(sql\`\n        SELECT last_cleared_at AS \"lastClearedAt\"\n        FROM app.community_chat_maintenance\n        WHERE singleton = true\n        FOR UPDATE\n      \`))[0];\n\n      const parsed = state?.lastClearedAt ? new Date(state.lastClearedAt) : null;\n      const lastClearedAt = parsed && Number.isFinite(parsed.getTime()) ? parsed : null;\n      if (lastClearedAt && Date.now() - lastClearedAt.getTime() < COMMUNITY_CHAT_RESET_MS) {\n        return lastClearedAt;\n      }\n\n      await tx.execute(sql\`DELETE FROM app.community_chat_messages\`);\n      const updated = rowsOf(await tx.execute(sql\`\n        UPDATE app.community_chat_maintenance\n        SET last_cleared_at = now()\n        WHERE singleton = true\n        RETURNING last_cleared_at AS \"lastClearedAt\"\n      \`))[0];\n      const resetAt = new Date(updated?.lastClearedAt || Date.now());\n      console.log(\`Community Live cleared for its 24-hour reset at \${resetAt.toISOString()}\`);\n      return resetAt;\n    });\n  })().finally(() => {\n    communityResetCheckInFlight = null;\n  });\n\n  return communityResetCheckInFlight;\n}\n\n`;
    if (!source.includes(anchor)) throw new Error("[community-24h] sameOrigin anchor missing");
    source = source.replace(anchor, `${helper}${anchor}`);
  }

  if (!source.includes("Community Live scheduled 24-hour reset failed")) {
    const anchor = "  void ensureSchema().catch((error) => console.warn(\"Community Live v2 schema ensure failed:\", error));\n";
    const scheduler = `  if (!communityRetentionTimer) {\n    void resetCommunityChatIfDue().catch((error) => console.warn("Community Live startup 24-hour reset failed:", error));\n    communityRetentionTimer = setInterval(() => {\n      void resetCommunityChatIfDue().catch((error) => console.warn("Community Live scheduled 24-hour reset failed:", error));\n    }, 60 * 1000);\n    (communityRetentionTimer as any).unref?.();\n  }\n`;
    if (!source.includes(anchor)) throw new Error("[community-24h] route registration anchor missing");
    source = source.replace(anchor, `${anchor}${scheduler}`);
  }

  source = replaceOnce(
    source,
    "      await ensureSchema();\n      const userId = String(req.authUserId || \"\");\n      const limit = Math.max(10, Math.min(100, Number(req.query?.limit || 60) || 60));",
    "      await ensureSchema();\n      const historyResetAt = await resetCommunityChatIfDue();\n      const userId = String(req.authUserId || \"\");\n      const limit = Math.max(10, Math.min(100, Number(req.query?.limit || 60) || 60));",
    "history reset lookup",
  );

  source = replaceOnce(
    source,
    "      const where = before > 0 ? sql`WHERE m.id < ${before}` : sql``;",
    "      const where = before > 0\n        ? sql`WHERE m.created_at >= ${historyResetAt.toISOString()}::timestamptz AND m.id < ${before}`\n        : sql`WHERE m.created_at >= ${historyResetAt.toISOString()}::timestamptz`;",
    "history reset query",
  );

  source = replaceOnce(
    source,
    "        latestMessageId: Number(messages[messages.length - 1]?.id || 0) || null,\n      });",
    "        latestMessageId: Number(messages[messages.length - 1]?.id || 0) || null,\n        historyResetAt: historyResetAt.toISOString(),\n      });",
    "history reset response",
  );

  source = replaceOnce(
    source,
    "      await ensureSchema();\n      const messageId = Number(req.params.id);",
    "      await ensureSchema();\n      await resetCommunityChatIfDue();\n      const messageId = Number(req.params.id);",
    "single message reset guard",
  );

  source = replaceOnce(
    source,
    "      await ensureSchema();\n      const userId = await ensureUser(req);",
    "      await ensureSchema();\n      await resetCommunityChatIfDue();\n      const userId = await ensureUser(req);",
    "message creation reset guard",
  );

  return source;
});

patchFile("client/src/components/FloatingSupportWidget.tsx", (original) => {
  let source = original;
  const old = `      const incoming = Array.isArray(payload) ? payload : payload.messages || [];\n      if (!Array.isArray(incoming)) throw new Error("Community Live returned an invalid conversation.");\n      setHasOlderMessages(Boolean(payload?.hasMore));\n      const current = queryClient.getQueryData<ChatMessage[]>(chatQueryKey);\n      const restored = readCommunityMessageHistory(currentUserId);\n      const merged = mergeCommunityMessages(restored, current, incoming);\n      saveCommunityMessageHistory(currentUserId, merged);\n      return merged;`;
  const replacement = `      const incoming = Array.isArray(payload) ? payload : payload.messages || [];\n      if (!Array.isArray(incoming)) throw new Error("Community Live returned an invalid conversation.");\n      setHasOlderMessages(Boolean(payload?.hasMore));\n      const historyResetAt = Date.parse(String(payload?.historyResetAt || "")) || 0; // COMMUNITY_CLIENT_RESET_V3\n      const keepCurrentRoom = (items: ChatMessage[] | undefined | null) => {\n        if (!Array.isArray(items) || !historyResetAt) return Array.isArray(items) ? items : [];\n        return items.filter((item) => {\n          const createdAt = Date.parse(String(item?.createdAt || ""));\n          return Number.isFinite(createdAt) && createdAt >= historyResetAt;\n        });\n      };\n      const current = queryClient.getQueryData<ChatMessage[]>(chatQueryKey);\n      const restored = readCommunityMessageHistory(currentUserId);\n      const merged = mergeCommunityMessages(\n        keepCurrentRoom(restored),\n        keepCurrentRoom(current),\n        keepCurrentRoom(incoming),\n      );\n      saveCommunityMessageHistory(currentUserId, merged);\n      return merged;`;
  if (!source.includes("COMMUNITY_CLIENT_RESET_V3")) {
    if (!source.includes(old)) throw new Error("[community-24h] FloatingSupportWidget chat merge anchor missing");
    source = source.replace(old, replacement);
  }
  return source;
});

console.log("Community Live 24-hour hard reset is ready: the current room clears once on rollout, then every 24 hours across restarts, and browser caches follow the server reset timestamp.");
