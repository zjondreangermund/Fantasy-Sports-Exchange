import type { Express } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { storage } from "../storage.js";
import { rankCompetitionEntries } from "../services/tournamentRules.js";
import {
  getWalletPostingIntegrityReport,
  postWalletAmountExactlyOnce,
  tournamentPayoutPostingKey,
} from "../services/walletPosting.js";

interface RegisterEconomyIntegrityRoutesDeps {
  requireAuth: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
let cardLockGuardPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

async function ensureCardLockGuard(): Promise<void> {
  if (!cardLockGuardPromise) {
    cardLockGuardPromise = (async () => {
      await db.execute(sql`
        create or replace function app.prevent_locked_card_transfer()
        returns trigger
        language plpgsql
        as $$
        begin
          if exists (
            select 1
            from app.card_locks cl
            where cl.card_id = old.id
              and (cl.expires_at is null or cl.expires_at > now())
          ) and (
            new.owner_id is distinct from old.owner_id
            or (new.for_sale is distinct from old.for_sale and new.for_sale = true)
          ) then
            raise exception 'Card is locked for competition';
          end if;
          return new;
        end;
        $$
      `);
      await db.execute(sql`drop trigger if exists player_cards_lock_guard on app.player_cards`);
      await db.execute(sql`
        create trigger player_cards_lock_guard
        before update of owner_id, for_sale on app.player_cards
        for each row execute function app.prevent_locked_card_transfer()
      `);
    })().catch((error) => {
      cardLockGuardPromise = null;
      throw error;
    });
  }
  await cardLockGuardPromise;
}

async function isAdminUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const configuredIds = String(process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredIds.includes(userId)) return true;

  const configuredEmails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const user = rowsOf(await db.execute(sql`
    select lower(coalesce(email, '')) as email
    from app.users
    where id = ${userId}
    limit 1
  `))[0];
  return Boolean(user?.email && configuredEmails.includes(String(user.email).toLowerCase()));
}

export function registerEconomyIntegrityRoutes(app: Express, deps: RegisterEconomyIntegrityRoutesDeps) {
  const { requireAuth } = deps;

  app.post("/api/competitions/join", requireAuth, async (req: any, res) => {
    try {
      await ensureCardLockGuard();
      const userId = String(req.authUserId || "");
      const competitionId = Number(req.body?.competitionId);
      const cardIds = Array.isArray(req.body?.cardIds)
        ? req.body.cardIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0)
        : [];
      const captainId = Number(req.body?.captainId || cardIds[0]);

      if (!Number.isInteger(competitionId) || competitionId <= 0 || cardIds.length !== 5 || new Set(cardIds).size !== 5) {
        return res.status(400).json({ message: "Tournament ID and exactly 5 different card IDs required" });
      }
      if (!cardIds.includes(captainId)) {
        return res.status(400).json({ message: "Captain must be one of the five selected cards" });
      }

      const cards = rowsOf(await db.execute(sql`
        select pc.id, pc.owner_id as "ownerId", pc.rarity::text as rarity,
          pc.for_sale as "forSale", pc.player_id as "playerId", p.position::text as position
        from app.player_cards pc
        join app.players p on p.id = pc.player_id
        where pc.id = any(${cardIds}::int[])
      `));
      if (cards.length !== 5 || cards.some((card) => String(card.ownerId) !== userId)) {
        return res.status(403).json({ message: "You don't own all selected cards" });
      }
      if (cards.some((card) => Boolean(card.forSale))) {
        return res.status(400).json({ message: "Cannot use marketplace-listed cards." });
      }
      if (new Set(cards.map((card) => Number(card.playerId))).size !== 5) {
        return res.status(400).json({ message: "Lineup must use 5 different players" });
      }
      const positions = cards.map((card) => String(card.position));
      if (!positions.includes("GK") || !positions.includes("DEF") || !positions.includes("MID") || !positions.includes("FWD")) {
        return res.status(400).json({ message: "Invalid lineup: must have 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility player" });
      }

      const entry = await db.transaction(async (tx) => {
        const competition = rowsOf(await tx.execute(sql`
          select id, name, tier::text as tier, status::text as status,
            coalesce(entry_fee, 0)::float as "entryFee", max_entries as "maxEntries",
            start_date as "startDate"
          from app.competitions
          where id = ${competitionId}
          for update
        `))[0];
        if (!competition) throw new Error("Tournament not found");
        if (String(competition.status) !== "open") throw new Error("Tournament is not open for entries");
        if (new Date(competition.startDate).getTime() <= Date.now()) throw new Error("Gameweek entries are closed");
        if (cards.some((card) => String(card.rarity).toLowerCase() !== String(competition.tier).toLowerCase())) {
          throw new Error(`${competition.tier} tournaments only accept ${competition.tier} cards.`);
        }

        const existing = rowsOf(await tx.execute(sql`
          select id from app.competition_entries
          where competition_id = ${competitionId} and user_id = ${userId}
          limit 1
        `))[0];
        if (existing) throw new Error("Already entered this tournament");

        const countRow = rowsOf(await tx.execute(sql`
          select count(*)::int as count
          from app.competition_entries
          where competition_id = ${competitionId}
        `))[0];
        const maxEntries = Number(competition.maxEntries || 0);
        if (maxEntries > 0 && Number(countRow?.count || 0) >= maxEntries) throw new Error("Tournament is full");

        const lockedCard = rowsOf(await tx.execute(sql`
          select card_id as "cardId"
          from app.card_locks
          where card_id = any(${cardIds}::int[])
            and (expires_at is null or expires_at > now())
          limit 1
        `))[0];
        if (lockedCard) throw new Error("One or more selected cards are already locked");

        const entryFee = toMoney(competition.entryFee);
        if (entryFee > 0) {
          const wallet = rowsOf(await tx.execute(sql`
            update app.wallets
            set balance = balance - ${entryFee}
            where user_id = ${userId} and balance >= ${entryFee}
            returning user_id
          `))[0];
          if (!wallet) throw new Error("Insufficient balance for entry fee");
          await tx.execute(sql`
            insert into app.transactions
              (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description)
            values
              (${userId}, 'entry_fee', ${-entryFee}, ${entryFee}, 0, ${-entryFee},
               'tournament_entry', 'completed', ${`Entered tournament: ${competition.name}`})
          `);
        }

        const createdEntry = rowsOf(await tx.execute(sql`
          insert into app.competition_entries
            (competition_id, user_id, lineup_card_ids, captain_id, total_score, joined_at)
          values
            (${competitionId}, ${userId}, ${JSON.stringify(cardIds)}::jsonb, ${captainId}, 0, now())
          returning *
        `))[0];

        await tx.execute(sql`
          insert into app.card_locks (card_id, user_id, reason, ref_id, created_at)
          select card_id, ${userId}, 'competition', ${String(competitionId)}, now()
          from unnest(${cardIds}::int[]) as card_id
        `);

        return createdEntry;
      });

      return res.json({ success: true, message: "Successfully joined tournament", entryId: entry.id });
    } catch (error: any) {
      const message = error?.message || "Failed to join tournament";
      const status = message === "Tournament not found" ? 404 :
        ["Already entered this tournament", "Tournament is full", "Insufficient balance for entry fee", "Tournament is not open for entries", "Gameweek entries are closed", "One or more selected cards are already locked"].includes(message) || message.includes("tournaments only accept") ? 400 : 500;
      if (status === 500) console.error("Failed to join competition atomically:", error);
      return res.status(status).json({ message });
    }
  });

  app.get("/api/admin/wallet-postings/integrity", requireAuth, async (req: any, res) => {
    try {
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });
      return res.json(await getWalletPostingIntegrityReport());
    } catch (error: any) {
      console.error("Failed to inspect wallet postings:", error);
      return res.status(500).json({ message: error?.message || "Failed to inspect wallet postings" });
    }
  });

  app.post("/api/admin/competitions/settle/:id", requireAuth, async (req: any, res) => {
    try {
      await ensureCardLockGuard();
      const adminId = String(req.authUserId || "");
      if (!(await isAdminUser(adminId))) return res.status(403).json({ message: "Admin access required" });
      const competitionId = Number(req.params.id);
      if (!Number.isInteger(competitionId) || competitionId <= 0) return res.status(400).json({ message: "Valid tournament required" });

      const entries = await storage.getCompetitionEntries(competitionId);
      const ranked = await rankCompetitionEntries(storage, entries);
      if (!ranked.length) return res.status(400).json({ message: "Cannot settle a tournament without entries" });

      const settlement = await db.transaction(async (tx) => {
        const competition = rowsOf(await tx.execute(sql`
          select id, name, status::text as status, coalesce(entry_fee, 0)::float as "entryFee",
            coalesce(platform_fee_rate, 0.2)::float as "platformFeeRate"
          from app.competitions
          where id = ${competitionId}
          for update
        `))[0];
        if (!competition) throw new Error("Tournament not found");
        if (!["active", "completed"].includes(String(competition.status))) {
          throw new Error("Tournament must be active before settlement");
        }
        const alreadyCompleted = String(competition.status) === "completed";

        const lockedEntries = rowsOf(await tx.execute(sql`
          select id, user_id as "userId", coalesce(total_score, 0)::float as "totalScore",
            coalesce(prize_amount, 0)::float as "prizeAmount", payout_posting_key as "payoutPostingKey",
            payout_transaction_id as "payoutTransactionId"
          from app.competition_entries
          where competition_id = ${competitionId}
          order by id
          for update
        `));
        const rankedIds = ranked.map((entry: any) => Number(entry.id)).sort((a: number, b: number) => a - b);
        const lockedIds = lockedEntries.map((entry: any) => Number(entry.id)).sort((a: number, b: number) => a - b);
        if (rankedIds.length !== lockedIds.length || rankedIds.some((id: number, index: number) => id !== lockedIds[index])) {
          throw new Error("Tournament entries changed during settlement; recalculate rankings and retry");
        }

        const grossPool = toMoney(ranked.length * Number(competition.entryFee || 0));
        const feeRate = Math.max(0, Math.min(1, Number(competition.platformFeeRate || 0.2)));
        const platformFee = toMoney(grossPool * feeRate);
        const prizePool = toMoney(grossPool - platformFee);
        const payoutPercentages = [0.6, 0.3, 0.1];

        if (alreadyCompleted) {
          for (let index = 0; index < ranked.length; index += 1) {
            const rankedEntry = ranked[index];
            const lockedEntry = lockedEntries.find((entry: any) => Number(entry.id) === Number(rankedEntry.id));
            const payout = toMoney(prizePool * (payoutPercentages[index] || 0));
            const expectedKey = payout > 0 ? tournamentPayoutPostingKey(competitionId, Number(rankedEntry.id)) : null;
            if (!lockedEntry || toMoney(lockedEntry.prizeAmount) !== payout || String(lockedEntry.payoutPostingKey || "") !== String(expectedKey || "")) {
              throw new Error("Completed tournament payout state no longer matches calculated rankings");
            }
          }
        }

        let replayedPostings = 0;
        for (let index = 0; index < ranked.length; index += 1) {
          const rankedEntry = ranked[index];
          const entryId = Number(rankedEntry.id);
          const payout = toMoney(prizePool * (payoutPercentages[index] || 0));
          await tx.execute(sql`
            update app.competition_entries
            set rank = ${index + 1}, prize_amount = ${payout}, tiebreak_meta = ${JSON.stringify(rankedEntry.tiebreak || {})}::jsonb
            where id = ${entryId} and competition_id = ${competitionId}
          `);
          if (payout <= 0) continue;

          const winnerId = String(rankedEntry.userId || "");
          const postingKey = tournamentPayoutPostingKey(competitionId, entryId);
          const posting = await postWalletAmountExactlyOnce(tx, {
            postingKey,
            userId: winnerId,
            amount: payout,
            transactionType: "tournament_payout",
            sourceType: "tournament_settlement",
            description: `Tournament payout competition:${competitionId} rank:${index + 1} entry:${entryId}`,
            actorUserId: adminId,
            reason: `Tournament ${competitionId} rank ${index + 1} cash payout`,
            metadata: { competitionId, entryId, rank: index + 1, grossPool, platformFee, prizePool },
            auditAction: "wallet.tournament_payout.completed",
          });
          if (posting.replayed) replayedPostings += 1;
          await tx.execute(sql`
            update app.competition_entries
            set payout_posting_key = ${posting.postingKey},
                payout_transaction_id = ${posting.transactionId},
                payout_completed_at = coalesce(payout_completed_at, now())
            where id = ${entryId} and competition_id = ${competitionId}
          `);
        }

        await tx.execute(sql`
          update app.competitions
          set status = 'completed', platform_fee_total = ${platformFee}, prize_pool_total = ${prizePool}
          where id = ${competitionId}
        `);
        await tx.execute(sql`
          delete from app.card_locks
          where reason = 'competition' and ref_id = ${String(competitionId)}
        `);
        await tx.execute(sql`
          insert into app.audit_logs (user_id, action, meta)
          values (${adminId}, 'admin.tournament.settled', ${JSON.stringify({ competitionId, grossPool, platformFee, prizePool, cardLocksReleased: true, replayedPostings })}::jsonb)
        `);

        return { grossPool, platformFee, prizePool, winnersCount: Math.min(3, ranked.length), replayedPostings, replayed: alreadyCompleted };
      });

      return res.json({
        success: true,
        message: settlement.replayed ? "Tournament settlement already completed and verified" : "Tournament settled with Arena v2 tiebreak rules",
        winner: ranked[0] || null,
        winnersCount: settlement.winnersCount,
        settlement,
      });
    } catch (error: any) {
      const message = error?.message || "Failed to settle tournament";
      const status = message === "Tournament not found" ? 404 :
        ["Tournament must be active before settlement", "Cannot settle a tournament without entries", "Tournament entries changed during settlement; recalculate rankings and retry", "Completed tournament payout state no longer matches calculated rankings"].includes(message) ? 400 : 500;
      if (status === 500) console.error("Failed to settle competition atomically:", error);
      return res.status(status).json({ message });
    }
  });
}
