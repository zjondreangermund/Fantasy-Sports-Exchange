import type { Express, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

type CommunityChatV2Deps = {
  requireAuth: any;
  isAdmin: any;
};

type ChatMessage = {
  id: number;
  userId: string;
  teamName: string;
  avatarUrl: string | null;
  message: string;
  replyToId: number | null;
  replyTo: null | { id: number; teamName: string; message: string; deleted: boolean };
  mentions: string[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  isOwn: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const clients = new Set<Response>();
const lastWriteAt = new Map<string, number>();
let schemaReady: Promise<void> | null = null;

const blockedWords = [
  "fuck", "fucker", "fucking", "motherfucker", "shit", "bullshit", "bitch", "cunt",
  "asshole", "bastard", "dickhead", "pussy", "cock", "whore", "slut", "wanker", "twat",
  "nigger", "nigga", "faggot", "retard", "poes", "naai", "kak", "moer",
];

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function cleanMessage(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function moderationForms(value: string) {
  const base = value
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4|@/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/7/g, "t");
  const spaced = base.replace(/[^a-z]+/g, " ").trim();
  const compact = base.replace(/[^a-z]+/g, "");
  const collapsed = compact.replace(/(.)\1{2,}/g, "$1$1");
  return { tokens: spaced.split(/\s+/).filter(Boolean), compact, collapsed };
}

function containsBlockedLanguage(value: string) {
  const forms = moderationForms(value);
  return blockedWords.some((word) => {
    if (forms.tokens.includes(word)) return true;
    if (word.length >= 4 && (forms.compact.includes(word) || forms.collapsed.includes(word))) return true;
    return false;
  });
}

function mentionsIn(value: string) {
  const mentions = new Set<string>();
  for (const match of value.matchAll(/(?:^|\s)@([a-z0-9_]{2,30})/gi)) mentions.add(match[1]);
  return Array.from(mentions).slice(0, 12);
}

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function toMessage(row: any, currentUserId: string, admin = false): ChatMessage {
  const userId = String(row?.userId ?? row?.user_id ?? "");
  const deletedAt = iso(row?.deletedAt ?? row?.deleted_at);
  const rawMessage = deletedAt ? "Message deleted" : String(row?.message || "");
  const replyId = Number(row?.replyToId ?? row?.reply_to_id ?? 0) || null;
  const replyDeleted = Boolean(row?.replyDeletedAt ?? row?.reply_deleted_at);
  return {
    id: Number(row?.id || 0),
    userId,
    teamName: String(row?.teamName ?? row?.team_name ?? "Arena Manager"),
    avatarUrl: row?.avatarUrl ?? row?.avatar_url ?? null,
    message: rawMessage,
    replyToId: replyId,
    replyTo: replyId
      ? {
          id: replyId,
          teamName: String(row?.replyTeamName ?? row?.reply_team_name ?? "Arena Manager"),
          message: replyDeleted ? "Message deleted" : String(row?.replyMessage ?? row?.reply_message ?? "Message unavailable"),
          deleted: replyDeleted,
        }
      : null,
    mentions: deletedAt ? [] : mentionsIn(rawMessage),
    editedAt: iso(row?.editedAt ?? row?.edited_at),
    deletedAt,
    createdAt: iso(row?.createdAt ?? row?.created_at) || new Date().toISOString(),
    isOwn: userId === currentUserId,
    canEdit: !deletedAt && userId === currentUserId,
    canDelete: !deletedAt && (admin || userId === currentUserId),
  };
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.community_chat_messages (
          id bigserial PRIMARY KEY,
          user_id varchar(255) NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
          message text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        ALTER TABLE app.community_chat_messages
          ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES app.community_chat_messages(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS edited_at timestamptz,
          ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
          ADD COLUMN IF NOT EXISTS deleted_by varchar(255)
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS community_chat_messages_created_at_idx ON app.community_chat_messages (created_at DESC, id DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS community_chat_messages_reply_idx ON app.community_chat_messages (reply_to_id) WHERE reply_to_id IS NOT NULL`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function sameOrigin(req: any) {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return true;
  const allowed = new Set<string>([
    `${req.protocol}://${req.get("host")}`,
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
  ]);
  for (const raw of [process.env.APP_URL, process.env.PUBLIC_URL, ...(process.env.CORS_ORIGINS || "").split(",")]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    try { allowed.add(new URL(value).origin); } catch { /* ignore malformed deployment values */ }
  }
  return allowed.has(origin);
}

function enforceWriteRate(userId: string, minimumMs = 1_200) {
  const now = Date.now();
  const previous = lastWriteAt.get(userId) || 0;
  if (now - previous < minimumMs) return false;
  lastWriteAt.set(userId, now);
  return true;
}

function messageSelect(where: any) {
  return sql`
    SELECT m.id, m.user_id AS "userId", m.message, m.reply_to_id AS "replyToId",
      m.edited_at AS "editedAt", m.deleted_at AS "deletedAt", m.created_at AS "createdAt",
      COALESCE(NULLIF(btrim(u.manager_team_name), ''), NULLIF(btrim(u.name), ''), split_part(COALESCE(u.email, ''), '@', 1), 'Arena Manager') AS "teamName",
      u.avatar_url AS "avatarUrl",
      pm.message AS "replyMessage", pm.deleted_at AS "replyDeletedAt",
      COALESCE(NULLIF(btrim(pu.manager_team_name), ''), NULLIF(btrim(pu.name), ''), split_part(COALESCE(pu.email, ''), '@', 1), 'Arena Manager') AS "replyTeamName"
    FROM app.community_chat_messages m
    JOIN app.users u ON u.id = m.user_id
    LEFT JOIN app.community_chat_messages pm ON pm.id = m.reply_to_id
    LEFT JOIN app.users pu ON pu.id = pm.user_id
    ${where}
  `;
}

async function loadMessage(id: number, currentUserId: string, admin = false) {
  const row = rowsOf(await db.execute(messageSelect(sql`WHERE m.id = ${id} LIMIT 1`)))[0];
  return row ? toMessage(row, currentUserId, admin) : null;
}

function broadcast(message: ChatMessage) {
  const publicMessage = { ...message, isOwn: false, canEdit: false, canDelete: false };
  const payload = `event: community-message\ndata: ${JSON.stringify(publicMessage)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { clients.delete(client); }
  }
}

async function ensureUser(req: any) {
  const userId = String(req.authUserId || "");
  await db.execute(sql`
    INSERT INTO app.users (id, email, name, avatar_url, created_at, updated_at)
    VALUES (
      ${userId},
      ${req.user?.email || req.user?.claims?.email || ""},
      ${req.user?.name || req.user?.claims?.name || ""},
      ${req.user?.avatarUrl || req.user?.photo || req.user?.claims?.picture || ""},
      now(), now()
    )
    ON CONFLICT (id) DO NOTHING
  `);
  return userId;
}

function rejectLanguage(res: any) {
  return res.status(400).json({
    code: "COMMUNITY_LANGUAGE_BLOCKED",
    message: "Please keep Community Live respectful. Profanity and slurs are not allowed.",
  });
}

export function registerCommunityChatV2Routes(app: Express, deps: CommunityChatV2Deps) {
  const { requireAuth, isAdmin } = deps;
  void ensureSchema().catch((error) => console.warn("Community Live v2 schema ensure failed:", error));

  app.get("/community-live/messages", requireAuth, async (req: any, res) => {
    try {
      await ensureSchema();
      const userId = String(req.authUserId || "");
      const limit = Math.max(10, Math.min(100, Number(req.query?.limit || 60) || 60));
      const before = Math.max(0, Number(req.query?.before || 0) || 0);
      const where = before > 0 ? sql`WHERE m.id < ${before}` : sql``;
      const result = await db.execute(sql`${messageSelect(where)} ORDER BY m.id DESC LIMIT ${limit}`);
      const messages = rowsOf(result).map((row) => toMessage(row, userId)).reverse();
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ messages });
    } catch (error) {
      console.error("Community Live fetch failed:", error);
      return res.status(500).json({ message: "Failed to load Community Live" });
    }
  });

  app.post("/community-live/messages", requireAuth, async (req: any, res) => {
    try {
      if (!sameOrigin(req)) return res.status(403).json({ message: "Request origin is not allowed" });
      await ensureSchema();
      const userId = await ensureUser(req);
      if (!enforceWriteRate(userId)) return res.status(429).json({ message: "Please wait before sending another message" });
      const message = cleanMessage(req.body?.message);
      const replyToId = Math.max(0, Number(req.body?.replyToId || 0) || 0) || null;
      if (!message) return res.status(400).json({ message: "Message cannot be empty" });
      if (message.length > 280) return res.status(400).json({ message: "Message must be 280 characters or fewer" });
      if (containsBlockedLanguage(message)) return rejectLanguage(res);
      if (replyToId) {
        const parent = rowsOf(await db.execute(sql`SELECT id FROM app.community_chat_messages WHERE id = ${replyToId} LIMIT 1`))[0];
        if (!parent) return res.status(400).json({ message: "The replied-to message no longer exists" });
      }
      const inserted = rowsOf(await db.execute(sql`
        INSERT INTO app.community_chat_messages (user_id, message, reply_to_id)
        VALUES (${userId}, ${message}, ${replyToId})
        RETURNING id
      `))[0];
      const chatMessage = await loadMessage(Number(inserted?.id || 0), userId);
      if (!chatMessage) throw new Error("Failed to load created message");
      await db.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${userId}, 'community.message.created', ${JSON.stringify({ messageId: chatMessage.id, replyToId })}::jsonb)`);
      broadcast(chatMessage);
      return res.status(201).json({ message: chatMessage });
    } catch (error) {
      console.error("Community Live send failed:", error);
      return res.status(500).json({ message: "Failed to send community message" });
    }
  });

  app.patch("/community-live/messages/:id", requireAuth, async (req: any, res) => {
    try {
      if (!sameOrigin(req)) return res.status(403).json({ message: "Request origin is not allowed" });
      await ensureSchema();
      const userId = String(req.authUserId || "");
      const messageId = Number(req.params.id);
      const message = cleanMessage(req.body?.message);
      if (!Number.isInteger(messageId) || messageId <= 0) return res.status(400).json({ message: "Valid message required" });
      if (!message || message.length > 280) return res.status(400).json({ message: "Edited message must contain 1–280 characters" });
      if (containsBlockedLanguage(message)) return rejectLanguage(res);
      const updated = rowsOf(await db.execute(sql`
        UPDATE app.community_chat_messages
        SET message = ${message}, edited_at = now()
        WHERE id = ${messageId} AND user_id = ${userId} AND deleted_at IS NULL
        RETURNING id
      `))[0];
      if (!updated) return res.status(403).json({ message: "You can edit only your own active messages" });
      const chatMessage = await loadMessage(messageId, userId);
      if (!chatMessage) throw new Error("Failed to load edited message");
      await db.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${userId}, 'community.message.edited', ${JSON.stringify({ messageId })}::jsonb)`);
      broadcast(chatMessage);
      return res.json({ message: chatMessage });
    } catch (error) {
      console.error("Community Live edit failed:", error);
      return res.status(500).json({ message: "Failed to edit community message" });
    }
  });

  app.delete("/community-live/messages/:id", requireAuth, async (req: any, res) => {
    try {
      if (!sameOrigin(req)) return res.status(403).json({ message: "Request origin is not allowed" });
      await ensureSchema();
      const userId = String(req.authUserId || "");
      const messageId = Number(req.params.id);
      const removed = rowsOf(await db.execute(sql`
        UPDATE app.community_chat_messages
        SET message = 'Message deleted', deleted_at = now(), deleted_by = ${userId}
        WHERE id = ${messageId} AND user_id = ${userId} AND deleted_at IS NULL
        RETURNING id
      `))[0];
      if (!removed) return res.status(403).json({ message: "You can delete only your own active messages" });
      const chatMessage = await loadMessage(messageId, userId);
      if (!chatMessage) throw new Error("Failed to load deleted message");
      await db.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${userId}, 'community.message.deleted', ${JSON.stringify({ messageId, admin: false })}::jsonb)`);
      broadcast(chatMessage);
      return res.json({ success: true, message: chatMessage });
    } catch (error) {
      console.error("Community Live delete failed:", error);
      return res.status(500).json({ message: "Failed to delete community message" });
    }
  });

  app.delete("/community-live/admin/messages/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      if (!sameOrigin(req)) return res.status(403).json({ message: "Request origin is not allowed" });
      await ensureSchema();
      const adminId = String(req.authUserId || "");
      const messageId = Number(req.params.id);
      const removed = rowsOf(await db.execute(sql`
        UPDATE app.community_chat_messages
        SET message = 'Message deleted by moderator', deleted_at = now(), deleted_by = ${adminId}
        WHERE id = ${messageId} AND deleted_at IS NULL
        RETURNING id
      `))[0];
      if (!removed) return res.status(404).json({ message: "Message not found or already deleted" });
      const chatMessage = await loadMessage(messageId, adminId, true);
      if (!chatMessage) throw new Error("Failed to load moderated message");
      await db.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${adminId}, 'community.message.deleted', ${JSON.stringify({ messageId, admin: true })}::jsonb)`);
      broadcast(chatMessage);
      return res.json({ success: true, message: chatMessage });
    } catch (error) {
      console.error("Community Live admin delete failed:", error);
      return res.status(500).json({ message: "Failed to moderate community message" });
    }
  });

  app.get("/community-live/stream", requireAuth, async (_req: any, res: Response) => {
    try {
      await ensureSchema();
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.write("retry: 5000\n\nevent: ready\ndata: {}\n\n");
      clients.add(res);
      const heartbeat = setInterval(() => {
        try { res.write(`event: ping\ndata: ${Date.now()}\n\n`); }
        catch { clearInterval(heartbeat); clients.delete(res); }
      }, 25_000);
      res.on("close", () => { clearInterval(heartbeat); clients.delete(res); });
    } catch (error) {
      console.error("Community Live stream failed:", error);
      if (!res.headersSent) res.status(500).json({ message: "Failed to connect to Community Live" });
    }
  });
}
