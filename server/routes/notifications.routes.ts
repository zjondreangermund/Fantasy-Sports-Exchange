import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensureNotificationsSchema } from "../services/notifications.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function registerNotificationRoutes(app: Express, deps: { requireAuth: any }) {
  const { requireAuth } = deps;

  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      await ensureNotificationsSchema();
      const userId = String(req.authUserId || "");
      const notifications = rowsOf(await db.execute(sql`
        select id, user_id as "userId", type::text as type, title, message, read, created_at as "createdAt"
        from app.notifications
        where user_id = ${userId}
        order by created_at desc nulls last, id desc
        limit 100
      `));
      const unreadCount = notifications.filter((item) => !item.read).length;
      return res.json({ notifications, unreadCount });
    } catch (error: any) {
      console.error("Failed to load notifications:", error);
      return res.status(500).json({ message: error?.message || "Failed to load notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      await ensureNotificationsSchema();
      const userId = String(req.authUserId || "");
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Valid notification required" });
      const notification = rowsOf(await db.execute(sql`
        update app.notifications
        set read = true
        where id = ${id} and user_id = ${userId}
        returning id, read
      `))[0];
      if (!notification) return res.status(404).json({ message: "Notification not found" });
      return res.json({ success: true, notification });
    } catch (error: any) {
      console.error("Failed to mark notification read:", error);
      return res.status(500).json({ message: error?.message || "Failed to update notification" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      await ensureNotificationsSchema();
      const userId = String(req.authUserId || "");
      const updated = rowsOf(await db.execute(sql`
        update app.notifications
        set read = true
        where user_id = ${userId} and read = false
        returning id
      `));
      return res.json({ success: true, updated: updated.length });
    } catch (error: any) {
      console.error("Failed to mark notifications read:", error);
      return res.status(500).json({ message: error?.message || "Failed to update notifications" });
    }
  });
}
