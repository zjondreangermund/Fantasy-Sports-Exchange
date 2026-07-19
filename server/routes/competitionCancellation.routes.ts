import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { cancelCompetitionWithRefunds, ensureCompetitionCancellationSchema } from "../services/competitionCancellation.js";

interface RegisterCompetitionCancellationRoutesDeps {
  requireAuth: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

async function isAdminUser(userId: string) {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredIds.includes(userId)) return true;
  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`select lower(coalesce(email, '')) as email from app.users where id = ${userId} limit 1`))[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
}

function cancellationStatus(error: any) {
  const message = String(error?.message || "Failed to cancel tournament");
  if (message === "Tournament not found") return 404;
  if (message.includes("require admin") || message.includes("cannot be cancelled") || message.includes("Completed")) return 400;
  if (message.includes("Valid competition")) return 400;
  return 500;
}

export function registerCompetitionCancellationRoutes(app: Express, deps: RegisterCompetitionCancellationRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/user-tournaments/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      const result = await cancelCompetitionWithRefunds({
        competitionId,
        actorId: userId,
        ownerId: userId,
        allowActive: false,
        reason: req.body?.reason,
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = cancellationStatus(error);
      if (status === 500) console.error("Failed to cancel creator tournament:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to cancel tournament") });
    }
  });

  app.post("/api/admin/competitions/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });
      const competitionId = Number(req.params.id);
      const result = await cancelCompetitionWithRefunds({
        competitionId,
        actorId: adminId,
        allowActive: true,
        reason: req.body?.reason || req.body?.adminNotes,
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = cancellationStatus(error);
      if (status === 500) console.error("Failed to cancel admin tournament:", error);
      return res.status(status).json({ message: String(error?.message || "Failed to cancel tournament") });
    }
  });

  // Registered before the legacy creator route so cancellation cannot bypass refunds.
  app.post("/api/user-tournaments/:id/status", requireAuth, async (req: any, res) => {
    try {
      await ensureCompetitionCancellationSchema();
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      const requestedStatus = String(req.body?.status || "").toLowerCase();
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });

      if (requestedStatus === "cancelled") {
        const result = await cancelCompetitionWithRefunds({ competitionId, actorId: userId, ownerId: userId, allowActive: false, reason: req.body?.reason });
        return res.json({ success: true, ...result });
      }

      if (!["open", "closed", "active"].includes(requestedStatus)) return res.status(400).json({ message: "Invalid status" });
      const tournament = await db.transaction(async (tx) => {
        const current = rowsOf(await tx.execute(sql`
          SELECT id, status::text AS status
          FROM app.competitions
          WHERE id = ${competitionId} AND created_by_user_id = ${userId}
          FOR UPDATE
        `))[0];
        if (!current) throw new Error("Tournament not found");
        if (["completed", "cancelled"].includes(String(current.status))) throw new Error(`Tournament is already ${current.status}`);
        return rowsOf(await tx.execute(sql`
          UPDATE app.competitions
          SET status = ${requestedStatus}
          WHERE id = ${competitionId} AND created_by_user_id = ${userId}
          RETURNING *
        `))[0] || null;
      });
      return res.json({ success: true, tournament });
    } catch (error: any) {
      const message = String(error?.message || "Failed to update status");
      const status = message === "Tournament not found" ? 404 : message.includes("already") ? 400 : 500;
      if (status === 500) console.error("Failed to update tournament status safely:", error);
      return res.status(status).json({ message });
    }
  });

  // Preserve all entered tournaments as financial history. They must be cancelled, never deleted.
  app.delete("/api/admin/competitions/:id", requireAuth, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });

      const deleted = await db.transaction(async (tx) => {
        const tournament = rowsOf(await tx.execute(sql`
          SELECT c.id, c.name, c.status::text AS status,
            (SELECT count(*)::int FROM app.competition_entries ce WHERE ce.competition_id = c.id) AS entry_count
          FROM app.competitions c
          WHERE c.id = ${competitionId}
          FOR UPDATE
        `))[0];
        if (!tournament) throw new Error("Tournament not found");
        if (Number(tournament.entry_count || 0) > 0) {
          throw new Error("Entered tournaments cannot be deleted. Cancel the tournament to refund entrants and preserve ledger history.");
        }
        await tx.execute(sql`DELETE FROM app.card_locks WHERE reason = 'competition' AND ref_id = ${String(competitionId)}`);
        await tx.execute(sql`DELETE FROM app.competitions WHERE id = ${competitionId}`);
        await tx.execute(sql`
          INSERT INTO app.audit_logs (user_id, action, meta)
          VALUES (${adminId}, 'admin.tournament.deleted', ${JSON.stringify({ competitionId, name: tournament.name, entryCount: 0 })}::jsonb)
        `);
        return tournament;
      });
      return res.json({ success: true, deletedId: competitionId, tournament: deleted });
    } catch (error: any) {
      const message = String(error?.message || "Failed to delete tournament");
      const status = message === "Tournament not found" ? 404 : message.includes("cannot be deleted") ? 400 : 500;
      if (status === 500) console.error("Failed to delete empty tournament safely:", error);
      return res.status(status).json({ message });
    }
  });
}
