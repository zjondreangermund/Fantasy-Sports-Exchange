import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { getActivePrizeForEntries } from "../services/prizeEngine.js";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

async function isAdminUser(userId: string) {
  if (!userId) return false;
  const ids = String(process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (ids.includes(userId)) return true;
  const emails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const user = rowsOf(await db.execute(sql`select lower(coalesce(email,'')) as email from app.users where id=${userId} limit 1`))[0];
  return Boolean(user?.email && emails.includes(String(user.email).toLowerCase()));
}

export function registerTestSimulatorDetailsRoutes(app: Express, deps: { requireAuth: any }) {
  const { requireAuth } = deps;

  app.get("/api/admin/simulator/tournament/:id/rankings-v2", requireAuth, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });

      const competitionId = Number(req.params.id);
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.max(10, Math.min(250, Number(req.query.limit || 100)));
      const offset = (page - 1) * limit;

      const tournament = rowsOf(await db.execute(sql`
        select c.id,c.name,c.tier::text as rarity,c.status::text as status,
          c.game_week as "gameWeek",c.max_entries as "maxEntries"
        from app.competitions c
        where c.id=${competitionId} and c.name like '[TEST]%'
        limit 1
      `))[0];
      if (!tournament) return res.status(404).json({ message: "Test tournament not found" });

      const total = Number(rowsOf(await db.execute(sql`
        select count(*)::int as count from app.competition_entries where competition_id=${competitionId}
      `))[0]?.count || 0);

      const rankings = rowsOf(await db.execute(sql`
        select ce.id as "entryId",ce.rank,ce.total_score::float as "totalScore",ce.user_id as "userId",
          coalesce(u.manager_team_name,u.name,u.email,u.id) as "managerName",ce.captain_id as "captainId",
          ce.lineup_card_ids as "cardIds",ce.tiebreak_meta as "pointsMeta",
          ce.prize_amount::float as "prizeAmount",ce.prize_card_id as "prizeCardId"
        from app.competition_entries ce join app.users u on u.id=ce.user_id
        where ce.competition_id=${competitionId}
        order by ce.rank asc nulls last,ce.total_score desc,ce.id asc
        limit ${limit} offset ${offset}
      `));

      const cardIds = Array.from(new Set(rankings.flatMap((row: any) => {
        const ids = Array.isArray(row.cardIds) ? row.cardIds : [];
        return ids.map(Number).filter(Number.isFinite);
      })));

      const cards = cardIds.length ? rowsOf(await db.execute(sql`
        select pc.id,pc.player_id as "playerId",pc.rarity::text as rarity,
          p.name,p.team,p.position::text as position,p.image_url as "imageUrl",p.photo,p.nationality,
          pgs.score::float as score,pgs.decisive_score::float as "decisiveScore",
          pgs.all_around_score::float as "allAroundScore",pgs.breakdown as performance
        from app.player_cards pc
        join app.players p on p.id=pc.player_id
        left join app.player_gameweek_scores pgs on pgs.player_id=pc.player_id and pgs.game_week=${Number(tournament.gameWeek)}
        where pc.id in (
          select value::int from jsonb_array_elements_text(${JSON.stringify(cardIds)}::jsonb)
        )
      `)) : [];
      const cardMap = new Map(cards.map((card: any) => [Number(card.id), card]));

      const enrichedRankings = rankings.map((row: any) => {
        const stored = row.pointsMeta && typeof row.pointsMeta === "object" ? row.pointsMeta : {};
        const storedCards = Array.isArray(stored.cardBreakdown) ? stored.cardBreakdown : [];
        const storedMap = new Map(storedCards.map((card: any) => [Number(card.id), card]));
        const ids = Array.isArray(row.cardIds) ? row.cardIds.map(Number) : [];
        const cardBreakdown = ids.map((cardId: number) => {
          const live = cardMap.get(cardId) || {};
          const compact = storedMap.get(cardId) || {};
          return {
            id: cardId,
            playerId: Number(live.playerId || compact.playerId || 0),
            name: live.name || compact.name || "Player",
            team: live.team || compact.team || "Unknown club",
            position: live.position || compact.position || "—",
            rarity: live.rarity || tournament.rarity,
            imageUrl: live.imageUrl || null,
            photo: live.photo || null,
            nationality: live.nationality || null,
            score: Number(live.score ?? compact.score ?? 0),
            decisiveScore: Number(live.decisiveScore ?? compact.decisiveScore ?? 0),
            allAroundScore: Number(live.allAroundScore ?? compact.allAroundScore ?? 0),
            performance: live.performance || compact.performance || {},
            points: compact.points,
          };
        });
        return {
          ...row,
          pointsMeta: {
            ...stored,
            cardBreakdown,
            captainMultiplier: Number(stored.captainMultiplier || 1.2),
          },
        };
      });

      const state = getActivePrizeForEntries(String(tournament.rarity), total);
      return res.json({
        tournament,
        total,
        page,
        limit,
        rankings: enrichedRankings,
        activePrize: state.activePrize,
        nextPrize: state.nextPrize,
        entrantsToNext: state.entrantsToNext,
      });
    } catch (error: any) {
      console.error("Failed to load detailed simulator rankings:", error);
      return res.status(500).json({ message: error?.message || "Failed to load detailed rankings" });
    }
  });
}
