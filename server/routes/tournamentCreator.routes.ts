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
const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";

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

async function isAdminUser(userId: string) {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredIds.includes(userId)) return true;
  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`select lower(coalesce(email, '')) as email from app.users where id = ${userId} limit 1`))[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
}

async function requireAdminUser(req: any, res: any) {
  const userId = String(req.authUserId || "");
  if (!(await isAdminUser(userId))) {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return userId;
}

function allowedRarity(value: unknown) {
  const rarity = String(value || "common").toLowerCase();
  return ["common", "rare", "unique", "epic", "legendary"].includes(rarity) ? rarity : "common";
}

function entryFeeFor(rarity: string) {
  return ({ common: 10, rare: 20, unique: 50, epic: 100, legendary: 250 } as Record<string, number>)[rarity] || 10;
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
          ${userId}, ${pin}, ${source.visibility || "private"}, ${source.max_entries || source.maxEntries || null}, ${Number(source.platform_fee_rate || 0.1)}, 0, 0
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

  app.delete("/api/admin/competitions/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Admin access required" });
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament ID required" });

      const tournament = rowsOf(await db.execute(sql`select id, name from app.competitions where id = ${competitionId} limit 1`))[0];
      if (!tournament) return res.status(404).json({ message: "Tournament not found" });

      await db.transaction(async (tx) => {
        await tx.execute(sql`delete from app.competition_entries where competition_id = ${competitionId}`);
        await tx.execute(sql`delete from app.competitions where id = ${competitionId}`);
      });
      await db.execute(sql`
        insert into app.audit_logs (user_id, action, meta)
        values (${userId}, 'admin.tournament.deleted', ${JSON.stringify({ competitionId, name: tournament.name })}::jsonb)
      `).catch(() => undefined);
      return res.json({ success: true, deletedId: competitionId });
    } catch (error: any) {
      console.error("Failed to delete admin tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to delete tournament" });
    }
  });

  app.get("/api/admin/test-console", requireAuth, async (req: any, res) => {
    try {
      if (!(await requireAdminUser(req, res))) return;
      const tournaments = rowsOf(await db.execute(sql`
        select c.id, c.name, c.tier::text as tier, c.status::text as status, c.game_week as "gameWeek",
          coalesce(c.entry_fee, 0)::float as "entryFee", c.max_entries as "maxEntries", count(ce.id)::int as "entryCount"
        from app.competitions c
        left join app.competition_entries ce on ce.competition_id = c.id
        where c.name like '[TEST]%'
        group by c.id
        order by c.id desc
      `));
      const users = rowsOf(await db.execute(sql`
        select u.id, u.email, u.name, u.manager_team_name as "managerTeamName", coalesce(w.balance,0)::float as balance
        from app.users u left join app.wallets w on w.user_id = u.id
        order by u.created_at desc nulls last limit 100
      `));
      const counts = rowsOf(await db.execute(sql`
        select
          (select count(*)::int from app.competitions where name like '[TEST]%') as "testTournaments",
          (select count(*)::int from app.competition_entries ce join app.competitions c on c.id=ce.competition_id where c.name like '[TEST]%') as "testEntries",
          (select count(*)::int from app.transactions where source_type='admin_test') as "testTransactions"
      `))[0] || {};
      return res.json({ tournaments, users, counts });
    } catch (error: any) {
      console.error("Failed to load test console:", error);
      return res.status(500).json({ message: error?.message || "Failed to load test console" });
    }
  });

  app.post("/api/admin/test-console/create-tournament", requireAuth, async (req: any, res) => {
    try {
      const adminId = await requireAdminUser(req, res);
      if (!adminId) return;
      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek) || 1));
      const rarity = allowedRarity(req.body?.rarity);
      const maxEntries = Math.max(2, Math.min(500, Number(req.body?.maxEntries) || 20));
      const fee = entryFeeFor(rarity);
      const result = await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total
        ) values (
          ${`[TEST] GW${gameWeek} ${rarity.toUpperCase()} Sandbox`}, ${rarity}, ${fee}, 'open', ${gameWeek}, now(), now() + interval '7 days', ${rarity},
          ${adminId}, 'private', ${maxEntries}, .1, 0, 0
        ) returning *
      `);
      await db.execute(sql`insert into app.audit_logs (user_id, action, meta) values (${adminId}, 'admin.test.tournament_created', ${JSON.stringify({ gameWeek, rarity, maxEntries })}::jsonb)`).catch(() => undefined);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null });
    } catch (error: any) {
      console.error("Failed to create test tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to create test tournament" });
    }
  });

  app.post("/api/admin/test-console/tournament/:id/fill", requireAuth, async (req: any, res) => {
    try {
      if (!(await requireAdminUser(req, res))) return;
      const competitionId = Number(req.params.id);
      const requested = Math.max(1, Math.min(200, Number(req.body?.count) || 1));
      const tournament = rowsOf(await db.execute(sql`select * from app.competitions where id=${competitionId} and name like '[TEST]%' limit 1`))[0];
      if (!tournament) return res.status(404).json({ message: "Test tournament not found" });
      const candidates = rowsOf(await db.execute(sql`
        select u.id as "userId", array_agg(pc.id order by pc.id) filter (where pc.id is not null) as cards
        from app.users u
        join app.player_cards pc on pc.owner_id=u.id and pc.rarity::text=${String(tournament.tier)} and pc.for_sale=false
        where not exists (select 1 from app.competition_entries ce where ce.competition_id=${competitionId} and ce.user_id=u.id)
        group by u.id having count(pc.id) >= 5
        limit ${requested}
      `));
      let inserted = 0;
      for (const candidate of candidates) {
        const cards = Array.isArray(candidate.cards) ? candidate.cards.slice(0, 5).map(Number) : [];
        if (cards.length < 5) continue;
        await db.execute(sql`
          insert into app.competition_entries (competition_id, user_id, lineup_card_ids, captain_id, total_score, joined_at)
          values (${competitionId}, ${String(candidate.userId)}, ${JSON.stringify(cards)}::jsonb, ${cards[0]}, 0, now())
          on conflict do nothing
        `);
        inserted += 1;
      }
      return res.json({ success: true, inserted });
    } catch (error: any) {
      console.error("Failed to fill test tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to fill test tournament" });
    }
  });

  app.post("/api/admin/test-console/tournament/:id/score", requireAuth, async (req: any, res) => {
    try {
      if (!(await requireAdminUser(req, res))) return;
      const competitionId = Number(req.params.id);
      const mode = String(req.body?.mode || "random");
      const tournament = rowsOf(await db.execute(sql`select id from app.competitions where id=${competitionId} and name like '[TEST]%' limit 1`))[0];
      if (!tournament) return res.status(404).json({ message: "Test tournament not found" });
      const entries = rowsOf(await db.execute(sql`select id from app.competition_entries where competition_id=${competitionId} order by id asc`));
      for (let index = 0; index < entries.length; index += 1) {
        const score = mode === "tie" ? 55 : mode === "ascending" ? 20 + index * 5 : 25 + Math.floor(Math.random() * 76);
        await db.execute(sql`update app.competition_entries set total_score=${score} where id=${Number(entries[index].id)}`);
      }
      await db.execute(sql`
        with ranked as (
          select id, rank() over (order by total_score desc, joined_at asc, id asc)::int as new_rank
          from app.competition_entries where competition_id=${competitionId}
        )
        update app.competition_entries ce set rank=ranked.new_rank from ranked where ce.id=ranked.id
      `);
      return res.json({ success: true, scored: entries.length });
    } catch (error: any) {
      console.error("Failed to score test tournament:", error);
      return res.status(500).json({ message: error?.message || "Failed to score test tournament" });
    }
  });

  app.post("/api/admin/test-console/tournament/:id/status", requireAuth, async (req: any, res) => {
    try {
      if (!(await requireAdminUser(req, res))) return;
      const competitionId = Number(req.params.id);
      const status = String(req.body?.status || "").toLowerCase();
      if (!["open", "active", "completed"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const result = await db.execute(sql`update app.competitions set status=${status} where id=${competitionId} and name like '[TEST]%' returning *`);
      if (!rowsOf(result)[0]) return res.status(404).json({ message: "Test tournament not found" });
      return res.json({ success: true, tournament: rowsOf(result)[0] });
    } catch (error: any) {
      console.error("Failed to update test status:", error);
      return res.status(500).json({ message: error?.message || "Failed to update status" });
    }
  });

  app.post("/api/admin/test-console/wallet", requireAuth, async (req: any, res) => {
    try {
      const adminId = await requireAdminUser(req, res);
      if (!adminId) return;
      const userId = String(req.body?.userId || "");
      const amount = Math.round(Number(req.body?.amount || 0) * 100) / 100;
      if (!userId || !Number.isFinite(amount) || amount === 0) return res.status(400).json({ message: "Valid user and non-zero amount required" });
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          insert into app.wallets (user_id, balance, locked_balance) values (${userId}, ${amount}, 0)
          on conflict (user_id) do update set balance=app.wallets.balance + ${amount}
        `);
        await tx.execute(sql`
          insert into app.transactions (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description)
          values (${userId}, 'admin_adjustment', ${amount}, ${amount}, 0, ${amount}, 'admin_test', 'completed', ${`Test console adjustment by ${adminId}`})
        `);
      });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Failed test wallet adjustment:", error);
      return res.status(500).json({ message: error?.message || "Failed to adjust wallet" });
    }
  });

  app.delete("/api/admin/test-console/cleanup", requireAuth, async (req: any, res) => {
    try {
      if (!(await requireAdminUser(req, res))) return;
      const ids = rowsOf(await db.execute(sql`select id from app.competitions where name like '[TEST]%'`)).map((row) => Number(row.id));
      await db.transaction(async (tx) => {
        if (ids.length) {
          await tx.execute(sql`delete from app.competition_entries where competition_id = any(${ids}::int[])`);
          await tx.execute(sql`delete from app.competitions where id = any(${ids}::int[])`);
        }
      });
      return res.json({ success: true, deletedTournaments: ids.length });
    } catch (error: any) {
      console.error("Failed to clean test data:", error);
      return res.status(500).json({ message: error?.message || "Failed to clean test data" });
    }
  });
}
