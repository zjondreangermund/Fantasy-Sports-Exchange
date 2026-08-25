import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { createNotificationOnce, ensureNotificationsSchema } from "./notifications.js";

let adminRemovalSchemaReady: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export async function ensureAdminTournamentEntryRemovalSchema(): Promise<void> {
  if (!adminRemovalSchemaReady) {
    adminRemovalSchemaReady = (async () => {
      await ensureNotificationsSchema();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.competition_entry_admin_removals (
          id bigserial PRIMARY KEY,
          entry_id integer NOT NULL UNIQUE,
          competition_id integer NOT NULL REFERENCES app.competitions(id) ON DELETE RESTRICT,
          user_id varchar(255) NOT NULL REFERENCES app.users(id),
          entry_fee_paid real NOT NULL DEFAULT 0,
          lineup_card_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
          captain_id integer,
          total_score real NOT NULL DEFAULT 0,
          rank integer,
          prize_amount real NOT NULL DEFAULT 0,
          prize_card_id integer,
          joined_at timestamp,
          refund_amount real NOT NULL DEFAULT 0,
          refund_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          removed_by varchar(255) NOT NULL,
          removal_reason text NOT NULL,
          removed_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS competition_entry_admin_removals_competition_idx
        ON app.competition_entry_admin_removals (competition_id, removed_at DESC)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS tournament_admin_entry_refund_external_id_unique
        ON app.transactions (external_transaction_id)
        WHERE source_type = 'tournament_admin_entry_refund'
          AND external_transaction_id IS NOT NULL
      `);
    })().catch((error) => {
      adminRemovalSchemaReady = null;
      throw error;
    });
  }
  await adminRemovalSchemaReady;
}

export type RemoveTournamentEntryInput = {
  competitionId: number;
  entryId: number;
  actorId: string;
  reason: string;
};

export async function removeTournamentEntryWithRefund(input: RemoveTournamentEntryInput) {
  await ensureAdminTournamentEntryRemovalSchema();

  const competitionId = Number(input.competitionId);
  const entryId = Number(input.entryId);
  const actorId = String(input.actorId || "").trim();
  const reason = String(input.reason || "Administrative removal").trim().slice(0, 500) || "Administrative removal";

  if (!Number.isInteger(competitionId) || competitionId <= 0) throw new Error("Valid tournament ID required");
  if (!Number.isInteger(entryId) || entryId <= 0) throw new Error("Valid tournament entry ID required");
  if (!actorId) throw new Error("Authenticated admin required");

  return db.transaction(async (tx) => {
    const competition = rowsOf(await tx.execute(sql`
      SELECT id, name, status::text AS status,
        coalesce(entry_fee, 0)::float AS entry_fee,
        coalesce(platform_fee_rate, 0)::float AS platform_fee_rate,
        coalesce(prize_key, '') AS prize_key,
        coalesce(prize_type, '') AS prize_type
      FROM app.competitions
      WHERE id = ${competitionId}
      FOR UPDATE
    `))[0];

    if (!competition) throw new Error("Tournament not found");
    const status = String(competition.status || "").toLowerCase();
    if (status === "completed") throw new Error("Completed tournament entries cannot be removed after settlement");
    if (status === "cancelled") throw new Error("Cancelled tournament entries are already handled by the cancellation refund flow");

    const alreadyRemoved = rowsOf(await tx.execute(sql`
      SELECT id, entry_id AS "entryId", competition_id AS "competitionId", user_id AS "userId",
        coalesce(refund_amount, 0)::float AS "refundAmount",
        refund_transaction_id AS "refundTransactionId", removed_at AS "removedAt",
        removal_reason AS "reason"
      FROM app.competition_entry_admin_removals
      WHERE entry_id = ${entryId} AND competition_id = ${competitionId}
      LIMIT 1
    `))[0];
    if (alreadyRemoved) return { success: true, duplicate: true, removal: alreadyRemoved };

    const entry = rowsOf(await tx.execute(sql`
      SELECT ce.id, ce.competition_id, ce.user_id,
        coalesce(ce.entry_fee_paid, 0)::float AS entry_fee_paid,
        coalesce(ce.lineup_card_ids, '[]'::jsonb) AS lineup_card_ids,
        ce.captain_id, coalesce(ce.total_score, 0)::float AS total_score,
        ce.rank, coalesce(ce.prize_amount, 0)::float AS prize_amount,
        ce.prize_card_id, ce.joined_at
      FROM app.competition_entries ce
      WHERE ce.id = ${entryId} AND ce.competition_id = ${competitionId}
      FOR UPDATE
    `))[0];

    if (!entry) throw new Error("Tournament entry not found");
    if (Number(entry.prize_amount || 0) > 0 || entry.prize_card_id) {
      throw new Error("This entrant already has a settled prize. Reverse/repair the prize before removing the entry.");
    }

    const userId = String(entry.user_id || "");
    if (!userId) throw new Error("Tournament entrant user is invalid");
    const paidSnapshot = toMoney(entry.entry_fee_paid);
    const refundAmount = paidSnapshot > 0 ? paidSnapshot : toMoney(competition.entry_fee);
    let transactionId: number | null = null;

    if (refundAmount > 0) {
      await tx.execute(sql`
        INSERT INTO app.wallets (user_id, balance, locked_balance)
        VALUES (${userId}, 0, 0)
        ON CONFLICT (user_id) DO NOTHING
      `);
      const wallet = rowsOf(await tx.execute(sql`
        UPDATE app.wallets
        SET balance = balance + ${refundAmount}
        WHERE user_id = ${userId}
        RETURNING user_id
      `))[0];
      if (!wallet) throw new Error("Entrant wallet could not be credited");

      const externalTransactionId = `competition-entry-removal:${competitionId}:${entryId}`;
      const transaction = rowsOf(await tx.execute(sql`
        INSERT INTO app.transactions
          (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description, external_transaction_id)
        VALUES
          (${userId}, 'tournament_refund', ${refundAmount}, ${refundAmount}, 0, ${refundAmount},
           'tournament_admin_entry_refund', 'completed',
           ${`Admin tournament entrant refund competition:${competitionId} entry:${entryId} reason:${reason}`},
           ${externalTransactionId})
        RETURNING id
      `))[0];
      if (!transaction?.id) throw new Error("Refund transaction could not be recorded");
      transactionId = Number(transaction.id);
    }

    const lineupCardIds = Array.isArray(entry.lineup_card_ids) ? entry.lineup_card_ids : [];
    const removal = rowsOf(await tx.execute(sql`
      INSERT INTO app.competition_entry_admin_removals (
        entry_id, competition_id, user_id, entry_fee_paid, lineup_card_ids, captain_id,
        total_score, rank, prize_amount, prize_card_id, joined_at, refund_amount,
        refund_transaction_id, removed_by, removal_reason
      ) VALUES (
        ${entryId}, ${competitionId}, ${userId}, ${paidSnapshot}, ${JSON.stringify(lineupCardIds)}::jsonb,
        ${entry.captain_id ?? null}, ${Number(entry.total_score || 0)}, ${entry.rank ?? null},
        ${Number(entry.prize_amount || 0)}, ${entry.prize_card_id ?? null}, ${entry.joined_at ?? null},
        ${refundAmount}, ${transactionId}, ${actorId}, ${reason}
      )
      RETURNING id, entry_id AS "entryId", competition_id AS "competitionId", user_id AS "userId",
        refund_amount AS "refundAmount", refund_transaction_id AS "refundTransactionId",
        removed_at AS "removedAt", removal_reason AS "reason"
    `))[0];
    if (!removal) throw new Error("Admin removal audit row could not be recorded");

    const releasedLocks = rowsOf(await tx.execute(sql`
      DELETE FROM app.card_locks
      WHERE reason = 'competition'
        AND ref_id = ${String(competitionId)}
        AND user_id = ${userId}
      RETURNING id
    `)).length;

    const deleted = rowsOf(await tx.execute(sql`
      DELETE FROM app.competition_entries
      WHERE id = ${entryId} AND competition_id = ${competitionId}
      RETURNING id
    `))[0];
    if (!deleted) throw new Error("Tournament entry could not be removed");

    const category = String(competition.prize_key || "").toLowerCase() === "user-cash"
      || String(competition.prize_type || "").toLowerCase() === "cash_pool";
    if (category) {
      const retained = rowsOf(await tx.execute(sql`
        SELECT coalesce(sum(coalesce(entry_fee_paid, 0)), 0)::float AS retained
        FROM app.competition_entries
        WHERE competition_id = ${competitionId}
      `))[0];
      const retainedTotal = toMoney(retained?.retained || 0);
      const rate = Math.max(0, Math.min(1, Number(competition.platform_fee_rate || 0)));
      await tx.execute(sql`
        UPDATE app.competitions
        SET platform_fee_total = ${toMoney(retainedTotal * rate)},
            prize_pool_total = ${toMoney(retainedTotal * (1 - rate))}
        WHERE id = ${competitionId}
      `);
    }

    await createNotificationOnce(tx, {
      userId,
      title: refundAmount > 0 ? "Tournament entry removed and refunded" : "Tournament entry removed",
      message: refundAmount > 0
        ? `${String(competition.name || "Tournament")}: your entry was removed by an administrator and N$${refundAmount.toFixed(2)} was returned to your Fantasy Arena wallet. Reason: ${reason}`
        : `${String(competition.name || "Tournament")}: your entry was removed by an administrator. Reason: ${reason}`,
      dedupeKey: `admin-tournament-entry-removal:${competitionId}:${entryId}`,
    });

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (
        ${actorId},
        'admin.tournament.entry_removed_refunded',
        ${JSON.stringify({ competitionId, entryId, userId, refundAmount, refundTransactionId: transactionId, releasedLocks, reason })}::jsonb
      )
    `);

    return {
      success: true,
      duplicate: false,
      removal: { ...removal, releasedLocks },
      refundAmount,
      refundTransactionId: transactionId,
      removedUserId: userId,
    };
  });
}
