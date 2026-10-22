import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }

/** The trophy cabinet is a READ-ONLY history of actual completed awards.
 * Never mint rewards, infer winners from live rankings, or promise paid prizes.
 * Issued cards remain in the historical cabinet even when subsequently traded.
 */
export function registerTrophyCabinetRoutes(app: Express, deps: { requireAuth: any }) {
  app.get("/api/trophy-cabinet", deps.requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      if (!userId) return res.status(401).json({ message: "Sign in to see your trophies" });
      // Shared with the existing tournament-settlement schema, created on
      // demand for installations that have not yet settled a Prize Vault cup.
      await db.execute(sql`CREATE TABLE IF NOT EXISTS app.competition_prize_awards (
        id bigserial primary key, competition_id integer not null, entry_id integer not null,
        user_id varchar(255) not null, game_week integer not null, rarity text not null,
        prize_key text not null, prize_title text not null, prize_value real not null default 0,
        prize_category text, status text not null default 'pending_claim',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamp not null default now(), updated_at timestamp not null default now(),
        unique(competition_id,entry_id)
      )`);
      const result = await db.execute(sql`
        SELECT ce.id AS "entryId", ce.competition_id AS "competitionId",
          c.name AS "competitionName", c.game_week AS "gameWeek",
          c.tier::text AS "tier", c.status::text AS "competitionStatus",
          c.prize_key AS "competitionPrizeKey", c.entry_fee AS "entryFee",
          c.start_date AS "competitionDate",
          ce.rank AS rank, ce.total_score AS "points",
          ce.prize_amount AS "cashAward", ce.prize_card_id AS "prizeCardId",
          ce.payout_completed_at AS "payoutCompletedAt",
          ce.tiebreak_meta -> 'settlement' -> 'prizeAward' AS "settlementAward",
          pc.rarity::text AS "cardRarity", pc.serial_id AS "serialId",
          p.name AS "playerName", p.team AS "playerTeam", p.position::text AS "position",
          p.image_url AS "imageUrl",
          pa.id AS "vaultAwardId", pa.prize_title AS "vaultTitle",
          pa.prize_category AS "vaultCategory", pa.prize_value AS "vaultValue",
          pa.status AS "vaultStatus", pa.created_at AS "vaultCreatedAt"
        FROM app.competition_entries ce
        JOIN app.competitions c ON c.id = ce.competition_id
        LEFT JOIN app.player_cards pc ON pc.id = ce.prize_card_id
        LEFT JOIN app.players p ON p.id = pc.player_id
        LEFT JOIN app.competition_prize_awards pa ON pa.entry_id=ce.id AND pa.user_id=ce.user_id
        WHERE ce.user_id = ${userId} AND c.status::text = 'completed'
          AND (
            ce.prize_card_id IS NOT NULL
            OR COALESCE(ce.prize_amount, 0) > 0
            OR pa.id IS NOT NULL
            OR (c.tier::text='common' AND COALESCE(c.entry_fee,0)=0
              AND LOWER(COALESCE(c.prize_key,'')) LIKE 'free-%' AND ce.rank BETWEEN 1 AND 3)
          )
        ORDER BY COALESCE(pa.created_at,c.start_date) DESC, ce.id DESC
        LIMIT 500
      `);
      const entries:any[] = [];
      for (const row of rowsOf(result)) {
        const freeCup = String(row.tier)==="common" && Number(row.entryFee||0)<=0 &&
          String(row.competitionPrizeKey||"").toLowerCase().startsWith("free-") &&
          Number(row.rank)>0 && Number(row.rank)<=3;
        const cardId=Number(row.prizeCardId||0);
        const base={
          entryId:Number(row.entryId),competitionId:Number(row.competitionId),
          competitionName:String(row.competitionName||"Tournament"),
          gameWeek:Number(row.gameWeek||0),rank:Number(row.rank||0),
          tier:String(row.tier||"common"),points:Number(row.points||0),
          competitionDate:row.competitionDate,
        };
        if(freeCup || (cardId>0 && !row.vaultAwardId)){
          const rarity=String(row.cardRarity|| (Number(row.rank)===1?"rare":"common")).toLowerCase();
          entries.push({...base,kind:"card",rarity,title:`${rarity.toUpperCase()} Player Card`,
            status:cardId>0?"minted":"ready_to_mint",cardId:cardId||null,
            playerName:row.playerName||null,playerTeam:row.playerTeam||null,
            position:row.position||null,imageUrl:row.imageUrl||null,
            serialId:row.serialId||null});
        }
        if(row.vaultAwardId){
          entries.push({...base,kind:"vault",title:String(row.vaultTitle||"Prize Vault reward"),
            value:Number(row.vaultValue||0),category:String(row.vaultCategory||"prize"),
            status:String(row.vaultStatus||"pending_claim"),awardId:Number(row.vaultAwardId)});
        }
        if(Number(row.cashAward||0)>0){
          entries.push({...base,kind:"cash",title:"Tournament cash award",
            value:Number(row.cashAward),status:row.payoutCompletedAt?"credited":"pending"});
        }
      }
      return res.json({awards:entries,summary:{
        total:entries.length,mintedCards:entries.filter(x=>x.kind==="card"&&x.status==="minted").length,
        readyToMint:entries.filter(x=>x.kind==="card"&&x.status==="ready_to_mint").length,
        vaultAwards:entries.filter(x=>x.kind==="vault").length,
        cashAwards:entries.filter(x=>x.kind==="cash").length,
      }});
    } catch(error){
      console.error("[trophy-cabinet] Could not load winnings:",error);
      return res.status(500).json({message:"Could not load the Trophy Cabinet. Please try again."});
    }
  });
}
