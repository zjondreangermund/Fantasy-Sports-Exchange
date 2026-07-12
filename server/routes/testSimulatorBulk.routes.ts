import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { getActivePrizeForEntries } from "../services/prizeEngine.js";
import { generateSimulatedGameweekScores, getGameweekScores } from "../services/gameweekScoring.js";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const BOT_PREFIX = "test-bot-";
const RARITIES = ["common", "rare", "unique", "epic", "legendary"];

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function isAdminUser(userId: string) {
  if (!userId) return false;
  const ids = String(process.env.ADMIN_USER_IDS || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (ids.includes(userId)) return true;
  const emails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`select lower(coalesce(email,'')) as email from app.users where id=${userId} limit 1`))[0];
  return Boolean(user?.email && emails.includes(String(user.email).toLowerCase()));
}

function rarityOf(value: unknown) {
  const rarity = String(value || "common").toLowerCase();
  return RARITIES.includes(rarity) ? rarity : "common";
}

export function registerTestSimulatorBulkRoutes(app: Express, deps: { requireAuth: any }) {
  const { requireAuth } = deps;

  app.post("/api/admin/simulator/run-v2", requireAuth, async (req: any, res) => {
    let competitionId = 0;
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });

      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek) || 1));
      const rarity = rarityOf(req.body?.rarity);
      const entries = Math.max(1, Math.min(5000, Math.floor(Number(req.body?.entries) || 100)));
      const rawName = String(req.body?.name || `GW${gameWeek} ${rarity.toUpperCase()} ${entries} Entries`).slice(0, 150);
      const name = rawName.startsWith("[TEST]") ? rawName : `[TEST] ${rawName}`;

      await generateSimulatedGameweekScores(gameWeek, false);
      const officialScores = await getGameweekScores(gameWeek);
      const scoreByPlayer = new Map(officialScores.map((row: any) => [Number(row.playerId), row]));

      const created = rowsOf(await db.execute(sql`
        insert into app.competitions (
          name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity,
          created_by_user_id, visibility, max_entries, platform_fee_rate, platform_fee_total,
          prize_pool_total, prize_type, prize_description
        ) values (
          ${name}, ${rarity}::competition_tier, 0, 'active', ${gameWeek}, now(), now() + interval '7 days', ${rarity}::rarity,
          ${adminId}, 'private', ${entries}, 0, 0, 0, 'goods', 'Shared rarity Prize Vault ladder'
        ) returning id, name, tier::text as tier, game_week as "gameWeek"
      `))[0];
      if (!created) throw new Error("Tournament creation failed");
      competitionId = Number(created.id);

      const players = rowsOf(await db.execute(sql`
        select id, name, team, position::text as position
        from app.players where position::text in ('GK','DEF','MID','FWD') order by id
      `));
      const pools = new Map<string, any[]>();
      for (const position of ["GK", "DEF", "MID", "FWD"]) pools.set(position, players.filter((p) => p.position === position));
      if ([...pools.values()].some((pool) => !pool.length)) throw new Error("Player database requires GK, DEF, MID and FWD players");

      const botRows = Array.from({ length: entries }, (_, index) => {
        const number = index + 1;
        const id = `${BOT_PREFIX}${rarity}-${String(number).padStart(5, "0")}`;
        return { id, n: number, email: `${id}@fantasy-arena.test`, name: `Arena Bot ${number}`, team: `Bot XI ${number}` };
      });

      for (let start = 0; start < botRows.length; start += 500) {
        const chunk = botRows.slice(start, start + 500);
        await db.execute(sql`
          insert into app.users (id,email,name,manager_team_name,created_at,updated_at)
          select x.id,x.email,x.name,x.team,now(),now()
          from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) as x(id text,email text,name text,team text,n int)
          on conflict (id) do update set email=excluded.email,name=excluded.name,manager_team_name=excluded.manager_team_name,updated_at=now()
        `);
      }

      const cardRows: any[] = [];
      const plans = ["GK", "DEF", "MID", "FWD", "MID"];
      for (let index = 0; index < botRows.length; index += 1) {
        for (let slot = 0; slot < 5; slot += 1) {
          const position = slot === 4 && index % 2 ? "DEF" : plans[slot];
          const pool = pools.get(position)!;
          const rotation = (index * (slot + 3) + slot * 7 + gameWeek) % pool.length;
          const player = pool[rotation];
          cardRows.push({
            playerId: Number(player.id),
            ownerId: botRows[index].id,
            rarity,
            serialId: `TEST-${rarity.toUpperCase()}-${String(index + 1).padStart(5, "0")}-${slot + 1}`,
            serialNumber: index + 1,
          });
        }
      }

      for (let start = 0; start < cardRows.length; start += 1000) {
        const chunk = cardRows.slice(start, start + 1000);
        await db.execute(sql`
          insert into app.player_cards (
            player_id,owner_id,rarity,serial_id,serial_number,max_supply,level,xp,decisive_score,last_5_scores,for_sale,price,acquired_at
          )
          select x."playerId",x."ownerId",x.rarity::rarity,x."serialId",x."serialNumber",500000,1,0,35,'[0,0,0,0,0]'::jsonb,false,0,now()
          from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb)
            as x("playerId" int,"ownerId" text,rarity text,"serialId" text,"serialNumber" int)
          on conflict (serial_id) do update set owner_id=excluded.owner_id,player_id=excluded.player_id,rarity=excluded.rarity,for_sale=false,price=0
        `);
      }

      for (let start = 0; start < botRows.length; start += 500) {
        const ids = botRows.slice(start, start + 500).map((row) => row.id);
        await db.execute(sql`
          insert into app.competition_entries (competition_id,user_id,lineup_card_ids,captain_id,total_score,rank,tiebreak_meta,joined_at)
          select ${competitionId},u.id,
            (select jsonb_agg(pc.id order by pc.id) from app.player_cards pc where pc.owner_id=u.id and pc.rarity::text=${rarity}),
            (select pc.id from app.player_cards pc where pc.owner_id=u.id and pc.rarity::text=${rarity} order by pc.id limit 1),
            0,null,'{}'::jsonb,now()
          from app.users u
          where u.id in (select value from jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
            and not exists (select 1 from app.competition_entries ce where ce.competition_id=${competitionId} and ce.user_id=u.id)
        `);
      }

      const allCards = rowsOf(await db.execute(sql`
        select pc.id,pc.player_id as "playerId",pc.owner_id as "ownerId",p.name,p.team,p.position::text as position
        from app.player_cards pc join app.players p on p.id=pc.player_id
        where pc.owner_id like ${`${BOT_PREFIX}${rarity}-%`} and pc.rarity::text=${rarity}
        order by pc.owner_id,pc.id
      `));
      const cardsByOwner = new Map<string, any[]>();
      for (const card of allCards) {
        const list = cardsByOwner.get(String(card.ownerId)) || [];
        list.push(card);
        cardsByOwner.set(String(card.ownerId), list);
      }

      const scoreRows = botRows.map((bot) => {
        const cards = (cardsByOwner.get(bot.id) || []).slice(0, 5);
        const captainId = Number(cards[0]?.id || 0);
        const breakdown = cards.map((card) => {
          const official = scoreByPlayer.get(Number(card.playerId));
          const score = Number(official?.score || 0);
          return {
            id: Number(card.id),
            playerId: Number(card.playerId),
            name: card.name,
            team: card.team,
            position: card.position,
            score,
            decisiveScore: Number(official?.decisiveScore || 0),
            allAroundScore: Number(official?.allAroundScore || 0),
            performance: official?.breakdown || {},
          };
        });
        const captain = breakdown.find((card) => card.id === captainId);
        const baseTotal = breakdown.reduce((sum, card) => sum + card.score, 0);
        const captainBonus = Number(((captain?.score || 0) * 0.2).toFixed(1));
        const totalScore = Number((baseTotal + captainBonus).toFixed(1));
        const highestCard = Math.max(0, ...breakdown.map((card) => card.score));
        const allAroundTotal = Number(breakdown.reduce((sum, card) => sum + card.allAroundScore, 0).toFixed(1));
        return {
          userId: bot.id,
          totalScore,
          meta: {
            source: "shared_gameweek_engine",
            gameWeek,
            rarity,
            cardBreakdown: breakdown,
            captainMultiplier: 1.2,
            captainBonus,
            highestCard,
            allAroundTotal,
          },
        };
      });

      for (let start = 0; start < scoreRows.length; start += 500) {
        const chunk = scoreRows.slice(start, start + 500);
        await db.execute(sql`
          update app.competition_entries ce
          set total_score=x."totalScore",tiebreak_meta=x.meta
          from jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) as x("userId" text,"totalScore" real,meta jsonb)
          where ce.competition_id=${competitionId} and ce.user_id=x."userId"
        `);
      }

      await db.execute(sql`
        with ranked as (
          select id,row_number() over(
            order by total_score desc,
              coalesce((tiebreak_meta->>'highestCard')::real,0) desc,
              coalesce((tiebreak_meta->>'allAroundTotal')::real,0) desc,
              joined_at asc,id asc
          )::int as position
          from app.competition_entries where competition_id=${competitionId}
        )
        update app.competition_entries ce set rank=ranked.position from ranked where ce.id=ranked.id
      `);

      const state = getActivePrizeForEntries(rarity, entries);
      const activePrize = state.activePrize || state.nextPrize;
      await db.execute(sql`
        insert into app.audit_logs (user_id,action,meta)
        values (${adminId},'admin.simulator.shared_gameweek_run',${JSON.stringify({ competitionId,gameWeek,rarity,entries,activePrize })}::jsonb)
      `).catch(() => undefined);

      return res.json({ success: true, tournament: created, entries, activePrize, scoring: { source: "shared_gameweek_engine", cardsPerLineup: 5, captainMultiplier: 1.2 } });
    } catch (error: any) {
      if (competitionId) {
        await db.execute(sql`delete from app.competition_entries where competition_id=${competitionId}`).catch(() => undefined);
        await db.execute(sql`delete from app.competitions where id=${competitionId}`).catch(() => undefined);
      }
      console.error("Bulk test simulation failed:", error);
      return res.status(500).json({ message: error?.message || "Bulk test simulation failed" });
    }
  });
}
