import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { getActivePrizeForEntries } from "../services/prizeEngine.js";

interface RegisterTestSimulatorRoutesDeps {
  requireAuth: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const TEST_PREFIX = "[TEST]";
const BOT_PREFIX = "test-bot-";
const RARITIES = ["common", "rare", "unique", "epic", "legendary"];

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function isAdminUser(userId: string) {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (configuredIds.includes(userId)) return true;
  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`select lower(coalesce(email, '')) as email from app.users where id=${userId} limit 1`))[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
}

async function requireAdmin(req: any, res: any) {
  const userId = String(req.authUserId || "");
  if (!(await isAdminUser(userId))) {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return userId;
}

function rarityOf(value: unknown) {
  const rarity = String(value || "common").toLowerCase();
  return RARITIES.includes(rarity) ? rarity : "common";
}

function scoreForCard(position: string, seed: number) {
  const base = 2 + (seed % 8);
  const minutes = 2;
  const goal = position === "FWD" ? (seed % 5 === 0 ? 4 : 0) : position === "MID" ? (seed % 7 === 0 ? 5 : 0) : position === "DEF" ? (seed % 13 === 0 ? 6 : 0) : 0;
  const assist = seed % 6 === 0 ? 3 : 0;
  const cleanSheet = ["GK", "DEF"].includes(position) && seed % 4 === 0 ? 4 : position === "MID" && seed % 4 === 0 ? 1 : 0;
  const bonus = seed % 4;
  const cards = seed % 19 === 0 ? -3 : seed % 11 === 0 ? -1 : 0;
  return { minutes, goal, assist, cleanSheet, bonus, cards, total: Math.max(0, base + minutes + goal + assist + cleanSheet + bonus + cards) };
}

async function ensureBotUsersAndCards(count: number, rarity: string) {
  const safeCount = Math.max(1, Math.min(5000, Math.floor(count)));
  const players = rowsOf(await db.execute(sql`
    select id, position::text as position, name
    from app.players
    where position::text in ('GK','DEF','MID','FWD')
    order by id asc
    limit 200
  `));
  if (players.length < 4) throw new Error("At least four players are required before bots can be generated");

  const byPosition = new Map<string, any[]>();
  for (const position of ["GK", "DEF", "MID", "FWD"]) byPosition.set(position, players.filter((p) => p.position === position));
  if ([...byPosition.values()].some((items) => !items.length)) throw new Error("Player database must include GK, DEF, MID and FWD players");

  const botIds = Array.from({ length: safeCount }, (_, index) => `${BOT_PREFIX}${rarity}-${String(index + 1).padStart(5, "0")}`);
  const chunkSize = 500;
  for (let start = 0; start < botIds.length; start += chunkSize) {
    const chunk = botIds.slice(start, start + chunkSize);
    const values = chunk.map((id, offset) => ({ id, n: start + offset + 1 }));
    await db.execute(sql`
      insert into app.users (id, email, name, manager_team_name, created_at, updated_at)
      select x.id, x.id || '@fantasy-arena.test', 'Arena Bot ' || x.n, 'Bot XI ' || x.n, now(), now()
      from jsonb_to_recordset(${JSON.stringify(values)}::jsonb) as x(id text, n int)
      on conflict (id) do update set manager_team_name=excluded.manager_team_name, updated_at=now()
    `);
  }

  const existing = rowsOf(await db.execute(sql`
    select owner_id as "ownerId", count(*)::int as count
    from app.player_cards
    where owner_id = any(${botIds}::text[]) and rarity::text=${rarity}
    group by owner_id
  `));
  const existingMap = new Map(existing.map((row) => [String(row.ownerId), Number(row.count || 0)]));

  for (let index = 0; index < botIds.length; index += 1) {
    const ownerId = botIds[index];
    if ((existingMap.get(ownerId) || 0) >= 5) continue;
    const positionPlan = ["GK", "DEF", "MID", "FWD", index % 2 === 0 ? "MID" : "DEF"];
    for (let slot = 0; slot < positionPlan.length; slot += 1) {
      const pool = byPosition.get(positionPlan[slot])!;
      const player = pool[(index + slot) % pool.length];
      const serialId = `TEST-${rarity.toUpperCase()}-${String(index + 1).padStart(5, "0")}-${slot + 1}`;
      await db.execute(sql`
        insert into app.player_cards (player_id, owner_id, rarity, serial_id, serial_number, max_supply, level, xp, decisive_score, last_5_scores, for_sale, price, acquired_at)
        values (${Number(player.id)}, ${ownerId}, ${rarity}, ${serialId}, ${index + 1}, 500000, 1, 0, 35, '[0,0,0,0,0]'::jsonb, false, 0, now())
        on conflict (serial_id) do nothing
      `);
    }
  }

  return botIds;
}

export function registerTestSimulatorRoutes(app: Express, deps: RegisterTestSimulatorRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/admin/simulator/run", requireAuth, async (req: any, res) => {
    try {
      const adminId = await requireAdmin(req, res);
      if (!adminId) return;
      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek) || 1));
      const rarity = rarityOf(req.body?.rarity);
      const entries = Math.max(1, Math.min(5000, Number(req.body?.entries) || 100));
      const name = String(req.body?.name || `${TEST_PREFIX} GW${gameWeek} ${rarity.toUpperCase()} ${entries} Entries`).slice(0, 160);

      const created = rowsOf(await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, visibility, max_entries, platform_fee_rate, platform_fee_total,
          prize_pool_total, prize_type, prize_description
        ) values (
          ${name.startsWith(TEST_PREFIX) ? name : `${TEST_PREFIX} ${name}`}, ${rarity}, 0, 'active', ${gameWeek}, now(), now() + interval '7 days', ${rarity},
          ${adminId}, 'private', ${entries}, 0, 0, 0, 'goods', 'Shared rarity Prize Vault ladder'
        ) returning id, name, tier::text as tier, game_week as "gameWeek"
      `))[0];
      if (!created) throw new Error("Tournament creation failed");

      const botIds = await ensureBotUsersAndCards(entries, rarity);
      const competitionId = Number(created.id);
      const batchSize = 500;
      for (let start = 0; start < botIds.length; start += batchSize) {
        const chunk = botIds.slice(start, start + batchSize);
        await db.execute(sql`
          insert into app.competition_entries (competition_id, user_id, lineup_card_ids, captain_id, total_score, rank, tiebreak_meta, joined_at)
          select ${competitionId}, u.id,
            (select jsonb_agg(id order by id) from (select pc.id from app.player_cards pc where pc.owner_id=u.id and pc.rarity::text=${rarity} order by pc.id limit 5) cards),
            (select pc.id from app.player_cards pc where pc.owner_id=u.id and pc.rarity::text=${rarity} order by pc.id limit 1),
            0, null, '{}'::jsonb, now()
          from app.users u
          where u.id = any(${chunk}::text[])
            and not exists (select 1 from app.competition_entries ce where ce.competition_id=${competitionId} and ce.user_id=u.id)
        `);
      }

      const entryRows = rowsOf(await db.execute(sql`
        select ce.id, ce.user_id as "userId", ce.lineup_card_ids as "cardIds"
        from app.competition_entries ce where ce.competition_id=${competitionId} order by ce.id asc
      `));
      for (let index = 0; index < entryRows.length; index += 1) {
        const entry = entryRows[index];
        const cardIds = Array.isArray(entry.cardIds) ? entry.cardIds.map(Number) : [];
        const cardRows = cardIds.length ? rowsOf(await db.execute(sql`
          select pc.id, p.name, p.team, p.position::text as position
          from app.player_cards pc join app.players p on p.id=pc.player_id
          where pc.id = any(${cardIds}::int[]) order by pc.id
        `)) : [];
        const breakdown = cardRows.map((card, cardIndex) => ({ ...card, points: scoreForCard(String(card.position), index * 7 + cardIndex * 11 + gameWeek) }));
        const captainId = Number(cardIds[0] || 0);
        const totalScore = breakdown.reduce((sum, item) => sum + Number(item.points.total || 0) * (Number(item.id) === captainId ? 2 : 1), 0);
        await db.execute(sql`
          update app.competition_entries
          set total_score=${totalScore}, tiebreak_meta=${JSON.stringify({ source: "test_simulator", gameWeek, rarity, cardBreakdown: breakdown, captainMultiplier: 2 })}::jsonb
          where id=${Number(entry.id)}
        `);
      }
      await db.execute(sql`
        with ranked as (
          select id, row_number() over (order by total_score desc, joined_at asc, id asc)::int as position
          from app.competition_entries where competition_id=${competitionId}
        )
        update app.competition_entries ce set rank=ranked.position from ranked where ce.id=ranked.id
      `);

      const prize = getActivePrizeForEntries(rarity, entries).activePrize || getActivePrizeForEntries(rarity, entries).nextPrize;
      await db.execute(sql`insert into app.audit_logs (user_id, action, meta) values (${adminId}, 'admin.simulator.run', ${JSON.stringify({ competitionId, gameWeek, rarity, entries, prize })}::jsonb)`).catch(() => undefined);
      return res.json({ success: true, tournament: created, entries, activePrize: prize });
    } catch (error: any) {
      console.error("Test simulation failed:", error);
      return res.status(500).json({ message: error?.message || "Test simulation failed" });
    }
  });

  app.get("/api/admin/simulator/tournament/:id/rankings", requireAuth, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const competitionId = Number(req.params.id);
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.max(10, Math.min(250, Number(req.query.limit || 100)));
      const offset = (page - 1) * limit;
      const tournament = rowsOf(await db.execute(sql`
        select c.id, c.name, c.tier::text as rarity, c.status::text as status, c.game_week as "gameWeek", c.max_entries as "maxEntries"
        from app.competitions c where c.id=${competitionId} and c.name like '[TEST]%' limit 1
      `))[0];
      if (!tournament) return res.status(404).json({ message: "Test tournament not found" });
      const total = Number(rowsOf(await db.execute(sql`select count(*)::int as count from app.competition_entries where competition_id=${competitionId}`))[0]?.count || 0);
      const rankings = rowsOf(await db.execute(sql`
        select ce.id as "entryId", ce.rank, ce.total_score::float as "totalScore", ce.user_id as "userId",
          coalesce(u.manager_team_name,u.name,u.email,u.id) as "managerName", ce.captain_id as "captainId",
          ce.lineup_card_ids as "cardIds", ce.tiebreak_meta as "pointsMeta", ce.prize_amount::float as "prizeAmount", ce.prize_card_id as "prizeCardId"
        from app.competition_entries ce join app.users u on u.id=ce.user_id
        where ce.competition_id=${competitionId}
        order by ce.rank asc nulls last, ce.total_score desc, ce.id asc
        limit ${limit} offset ${offset}
      `));
      const state = getActivePrizeForEntries(tournament.rarity, total);
      return res.json({ tournament, total, page, limit, rankings, activePrize: state.activePrize, nextPrize: state.nextPrize, entrantsToNext: state.entrantsToNext });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to load rankings" });
    }
  });

  app.post("/api/admin/simulator/tournament/:id/settle", requireAuth, async (req: any, res) => {
    try {
      const adminId = await requireAdmin(req, res);
      if (!adminId) return;
      const competitionId = Number(req.params.id);
      const tournament = rowsOf(await db.execute(sql`
        select c.id, c.name, c.tier::text as rarity, c.status::text as status, c.game_week as "gameWeek"
        from app.competitions c where c.id=${competitionId} and c.name like '[TEST]%' limit 1
      `))[0];
      if (!tournament) return res.status(404).json({ message: "Test tournament not found" });
      const entries = rowsOf(await db.execute(sql`
        select ce.*, coalesce(u.manager_team_name,u.name,u.email,u.id) as "managerName"
        from app.competition_entries ce join app.users u on u.id=ce.user_id
        where ce.competition_id=${competitionId} order by ce.rank asc nulls last, ce.total_score desc, ce.id asc
      `));
      if (!entries.length) return res.status(400).json({ message: "Tournament has no rankings to settle" });
      if (entries.some((row) => !Number(row.rank))) return res.status(400).json({ message: "Rankings must be calculated before settlement" });

      const state = getActivePrizeForEntries(tournament.rarity, entries.length);
      const prize = state.activePrize;
      if (!prize) return res.status(400).json({ message: "No Prize Vault tier is unlocked at this entry count" });
      const winner = entries[0];
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          insert into app.notifications (user_id,type,title,message,read,created_at)
          values (${String(winner.user_id)}, 'win', 'Congratulations — You won!', ${`You finished #1 in ${tournament.name} with ${Number(winner.total_score || 0)} points and won ${prize.title}. Some physical prizes may take time to source. Please confirm whether you prefer the prize or its N$${Number(prize.value).toLocaleString()} cash value.`}, false, now())
        `);
        await tx.execute(sql`update app.competition_entries set prize_amount=${Number(prize.value)} where id=${Number(winner.id)}`);

        if (entries.length > 100) {
          for (const runner of entries.slice(1, 5)) {
            const card = rowsOf(await tx.execute(sql`
              select pc.id from app.player_cards pc
              where pc.rarity::text=${tournament.rarity} and pc.owner_id like ${`${BOT_PREFIX}%`}
              order by random() limit 1
            `))[0];
            if (card?.id) {
              await tx.execute(sql`update app.player_cards set owner_id=${String(runner.user_id)}, acquired_at=now() where id=${Number(card.id)}`);
              await tx.execute(sql`update app.competition_entries set prize_card_id=${Number(card.id)} where id=${Number(runner.id)}`);
              await tx.execute(sql`
                insert into app.notifications (user_id,type,title,message,read,created_at)
                values (${String(runner.user_id)}, 'runner_up', ${`Top ${Number(runner.rank)} reward unlocked`}, ${`Thank you for competing in ${tournament.name}. You finished #${Number(runner.rank)} with ${Number(runner.total_score || 0)} points and received a random ${tournament.rarity} player card.`}, false, now())
              `);
            }
          }
        }
        await tx.execute(sql`update app.competitions set status='completed' where id=${competitionId}`);
        await tx.execute(sql`insert into app.audit_logs (user_id,action,meta) values (${adminId}, 'admin.simulator.settled', ${JSON.stringify({ competitionId, winnerUserId: winner.user_id, prize, runnerCards: entries.length > 100 })}::jsonb)`);
      });
      return res.json({ success: true, winner: { userId: winner.user_id, managerName: winner.managerName, score: Number(winner.total_score || 0) }, prize, runnerUpCardsAwarded: entries.length > 100 ? Math.min(4, entries.length - 1) : 0 });
    } catch (error: any) {
      console.error("Test settlement failed:", error);
      return res.status(500).json({ message: error?.message || "Test settlement failed" });
    }
  });
}
