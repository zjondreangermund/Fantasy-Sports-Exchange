import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { registerLoanMarketRoutes } from "./loanMarket.routes.js";

interface RegisterTournamentCreatorRoutesDeps {
  requireAuth: any;
}

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function normalizePin(raw: unknown) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const PIN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomPin(length = 6) {
  let pin = "";
  for (let i = 0; i < length; i += 1) pin += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)];
  return pin;
}

async function generateUniquePin() {
  for (let i = 0; i < 25; i += 1) {
    const pin = randomPin();
    const existing = await db.execute(sql`select id from app.competitions where join_pin = ${pin} limit 1`);
    if (rowsOf(existing).length === 0) return pin;
  }
  throw new Error("Could not generate tournament PIN");
}

async function getOwnedTournament(userId: string, competitionId: number) {
  const result = await db.execute(sql`
    select c.*, count(ce.id)::int as entry_count
    from app.competitions c
    left join app.competition_entries ce on ce.competition_id = c.id
    where c.id = ${competitionId}
      and c.created_by_user_id = ${userId}
    group by c.id
    limit 1
  `);
  return rowsOf(result)[0] || null;
}

export function registerTournamentCreatorRoutes(app: Express, deps: RegisterTournamentCreatorRoutesDeps) {
  const { requireAuth } = deps;

  registerLoanMarketRoutes(app, { requireAuth });

  app.get("/api/user-tournaments/mine", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const result = await db.execute(sql`
        select
          c.*,
          count(ce.id)::int as entry_count,
          coalesce(sum(coalesce(c.entry_fee, 0)), 0)::float as gross_display
        from app.competitions c
        left join app.competition_entries ce on ce.competition_id = c.id
        where c.created_by_user_id = ${userId}
        group by c.id
        order by c.start_date desc nulls last, c.id desc
      `);
      return res.json({ tournaments: rowsOf(result) });
    } catch (error: any) {
      console.error("Failed to fetch creator tournaments:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch tournaments" });
    }
  });

  app.get("/api/user-tournaments/:id/entrants", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });
      const tournament = await getOwnedTournament(userId, competitionId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      const result = await db.execute(sql`
        with ranked as (
          select
            ce.id as "entryId",
            ce.user_id as "userId",
            coalesce(u.manager_team_name, u.name, u.email, 'Manager') as "teamName",
            u.email as email,
            ce.lineup_card_ids as "lineupCardIds",
            ce.captain_id as "captainId",
            coalesce(ce.total_score, 0)::float as "totalScore",
            ce.joined_at as "joinedAt",
            rank() over (order by coalesce(ce.total_score, 0) desc, ce.joined_at asc, ce.id asc) as rank
          from app.competition_entries ce
          left join app.users u on u.id = ce.user_id
          where ce.competition_id = ${competitionId}
        )
        select * from ranked order by rank asc, "entryId" asc
      `);
      return res.json({ tournament, entrants: rowsOf(result) });
    } catch (error: any) {
      console.error("Failed to fetch tournament entrants:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch entrants" });
    }
  });

  app.post("/api/user-tournaments/:id/status", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      const status = String(req.body?.status || "").toLowerCase();
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });
      if (!["open", "closed", "active"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const tournament = await getOwnedTournament(userId, competitionId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      const result = await db.execute(sql`
        update app.competitions
        set status = ${status}
        where id = ${competitionId} and created_by_user_id = ${userId}
        returning *
      `);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null });
    } catch (error: any) {
      console.error("Failed to update tournament status:", error);
      return res.status(500).json({ message: error?.message || "Failed to update status" });
    }
  });

  app.post("/api/user-tournaments/:id/duplicate", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });
      const source = await getOwnedTournament(userId, competitionId);
      if (!source) return res.status(404).json({ message: "Tournament not found" });
      const pin = String(source.visibility || "private") === "private" ? await generateUniquePin() : null;
      const result = await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total
        ) values (
          ${`${source.name || "Tournament"} Copy`}, ${source.tier}, ${Number(source.entry_fee || source.entryFee || 0)}, 'open', ${Number(source.game_week || source.gameWeek || 1)}, now(), now() + interval '7 days', ${source.prize_card_rarity || source.prizeCardRarity || source.tier},
          ${userId}, ${pin}, ${source.visibility || "private"}, ${source.max_entries || source.maxEntries || null}, ${Number(source.platform_fee_rate || 0.2)}, 0, 0
        ) returning *
      `);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null, pin });
    } catch (error: any) {
      console.error("Failed to duplicate tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to duplicate tournament" });
    }
  });

  app.delete("/api/user-tournaments/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });
      const tournament = await getOwnedTournament(userId, competitionId);
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });
      if (Number(tournament.entry_count || 0) > 0) return res.status(400).json({ message: "Cannot delete a tournament after users have entered. Close entries instead." });
      await db.execute(sql`delete from app.competitions where id = ${competitionId} and created_by_user_id = ${userId}`);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to delete tournament" });
    }
  });
}
