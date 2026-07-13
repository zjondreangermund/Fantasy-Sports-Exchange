import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

export function registerAdminCardLookupRoutes(app: Express, deps: { requireAuth: any; isAdmin: any }) {
  const { requireAuth, isAdmin } = deps;

  app.get("/api/admin/cards/lookup", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const raw = String(req.query.q || "").trim();
      if (!raw) return res.status(400).json({ message: "Enter a card ID or serial number" });

      const normalized = raw.replace(/^#/, "");
      const numericId = /^\d+$/.test(normalized) ? Number(normalized) : null;
      const pattern = `%${raw}%`;

      const card = rowsOf(await db.execute(sql`
        select
          pc.id,
          pc.serial_id as "serialId",
          pc.serial_number as "serialNumber",
          pc.rarity::text as rarity,
          pc.owner_id as "ownerId",
          pc.for_sale as "forSale",
          pc.price::float as price,
          pc.level,
          pc.xp,
          pc.acquired_at as "acquiredAt",
          p.id as "playerId",
          p.name as "playerName",
          p.team,
          p.position::text as position,
          p.image_url as "imageUrl",
          p.photo,
          u.email as "ownerEmail",
          u.name as "ownerName",
          u.manager_team_name as "ownerTeamName",
          coalesce(w.balance,0)::float as "ownerWalletBalance"
        from app.player_cards pc
        left join app.players p on p.id=pc.player_id
        left join app.users u on u.id=pc.owner_id
        left join app.wallets w on w.user_id=pc.owner_id
        where (${numericId}::int is not null and pc.id=${numericId})
           or pc.serial_id ilike ${pattern}
        order by case when pc.id=${numericId} then 0 else 1 end, pc.id desc
        limit 1
      `))[0] || null;

      if (!card) return res.status(404).json({ message: `No card found for ${raw}` });

      const rewards = rowsOf(await db.execute(sql`
        select
          ce.id as "entryId",
          ce.rank,
          ce.total_score::float as "totalScore",
          ce.user_id as "rewardedUserId",
          c.id as "competitionId",
          c.name as "competitionName",
          c.game_week as "gameWeek",
          c.tier::text as rarity,
          c.status::text as "competitionStatus",
          coalesce(u.manager_team_name,u.name,u.email,u.id) as "rewardedManager",
          u.email as "rewardedEmail"
        from app.competition_entries ce
        join app.competitions c on c.id=ce.competition_id
        left join app.users u on u.id=ce.user_id
        where ce.prize_card_id=${Number(card.id)}
        order by ce.id desc
      `));

      const transactions = rowsOf(await db.execute(sql`
        select id,type::text as type,amount::float as amount,gross_amount::float as "grossAmount",
          fee_amount::float as "feeAmount",net_amount::float as "netAmount",status::text as status,
          description,source_type as "sourceType",created_at as "createdAt",user_id as "userId"
        from app.transactions
        where coalesce(description,'') ilike ${`%${card.id}%`}
           or coalesce(source_type,'') ilike ${`%card%`}
             and coalesce(description,'') ilike ${`%${card.serialId || ''}%`}
        order by created_at desc nulls last
        limit 20
      `));

      return res.json({
        card,
        owner: card.ownerId ? {
          id: card.ownerId,
          email: card.ownerEmail,
          name: card.ownerName,
          managerTeamName: card.ownerTeamName,
          walletBalance: Number(card.ownerWalletBalance || 0),
        } : null,
        rewardHistory: rewards,
        transactionHistory: transactions,
        awardedAsRunnerUp: rewards.some((row: any) => Number(row.rank) >= 2 && Number(row.rank) <= 5),
      });
    } catch (error: any) {
      console.error("Admin card lookup failed:", error);
      return res.status(500).json({ message: error?.message || "Card lookup failed" });
    }
  });
}
