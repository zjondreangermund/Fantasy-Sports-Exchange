import { sql } from "drizzle-orm";
import { db } from "../db.js";

let cancellationSchemaReady: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export async function ensureCompetitionCancellationSchema(): Promise<void> {
  if (!cancellationSchemaReady) {
    cancellationSchemaReady = (async () => {
      await db.execute(sql`ALTER TYPE app.competition_status ADD VALUE IF NOT EXISTS 'closed'`);
      await db.execute(sql`ALTER TYPE app.competition_status ADD VALUE IF NOT EXISTS 'cancelled'`);
      await db.execute(sql`ALTER TYPE app.transaction_type ADD VALUE IF NOT EXISTS 'tournament_refund'`);
      await db.execute(sql`
        ALTER TABLE app.competition_entries
          ADD COLUMN IF NOT EXISTS entry_fee_paid real NOT NULL DEFAULT 0
      `);
      await db.execute(sql`
        UPDATE app.competition_entries ce
        SET entry_fee_paid = GREATEST(coalesce(c.entry_fee, 0), 0)
        FROM app.competitions c
        WHERE c.id = ce.competition_id
          AND coalesce(ce.entry_fee_paid, 0) = 0
          AND coalesce(c.entry_fee, 0) > 0
      `);
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION app.snapshot_competition_entry_fee()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF coalesce(NEW.entry_fee_paid, 0) = 0 THEN
            SELECT GREATEST(coalesce(entry_fee, 0), 0)
            INTO NEW.entry_fee_paid
            FROM app.competitions
            WHERE id = NEW.competition_id;
          END IF;
          RETURN NEW;
        END;
        $$
      `);
      await db.execute(sql`DROP TRIGGER IF EXISTS competition_entry_fee_snapshot ON app.competition_entries`);
      await db.execute(sql`
        CREATE TRIGGER competition_entry_fee_snapshot
        BEFORE INSERT ON app.competition_entries
        FOR EACH ROW EXECUTE FUNCTION app.snapshot_competition_entry_fee()
      `);
      await db.execute(sql`
        ALTER TABLE app.competitions
          ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
          ADD COLUMN IF NOT EXISTS cancelled_by varchar(255),
          ADD COLUMN IF NOT EXISTS cancellation_reason text,
          ADD COLUMN IF NOT EXISTS refund_total real NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS refunded_entry_count integer NOT NULL DEFAULT 0
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.competition_entry_refunds (
          entry_id integer PRIMARY KEY REFERENCES app.competition_entries(id) ON DELETE RESTRICT,
          competition_id integer NOT NULL REFERENCES app.competitions(id) ON DELETE RESTRICT,
          user_id varchar(255) NOT NULL REFERENCES app.users(id),
          amount real NOT NULL CHECK (amount >= 0),
          transaction_id integer UNIQUE REFERENCES app.transactions(id),
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS competition_entry_refunds_competition_idx
        ON app.competition_entry_refunds (competition_id, entry_id)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS tournament_cancellation_refund_external_id_unique
        ON app.transactions (external_transaction_id)
        WHERE source_type = 'tournament_cancellation_refund'
          AND external_transaction_id IS NOT NULL
      `);
    })().catch((error) => {
      cancellationSchemaReady = null;
      throw error;
    });
  }
  await cancellationSchemaReady;
}

export type CancelCompetitionInput = {
  competitionId: number;
  actorId: string;
  ownerId?: string;
  allowActive?: boolean;
  reason?: string;
};

export async function cancelCompetitionWithRefunds(input: CancelCompetitionInput) {
  await ensureCompetitionCancellationSchema();

  const competitionId = Number(input.competitionId);
  const actorId = String(input.actorId || "");
  const ownerId = input.ownerId ? String(input.ownerId) : "";
  const reason = String(input.reason || "Tournament cancelled").trim().slice(0, 500) || "Tournament cancelled";

  if (!Number.isInteger(competitionId) || competitionId <= 0 || !actorId) {
    throw new Error("Valid competition and actor required");
  }

  return db.transaction(async (tx) => {
    const competition = rowsOf(await tx.execute(sql`
      SELECT id, name, status::text AS status, created_by_user_id,
        coalesce(entry_fee, 0)::float AS entry_fee,
        cancelled_at, cancelled_by, cancellation_reason
      FROM app.competitions
      WHERE id = ${competitionId}
      FOR UPDATE
    `))[0];

    if (!competition || (ownerId && String(competition.created_by_user_id || "") !== ownerId)) {
      throw new Error("Tournament not found");
    }

    const currentStatus = String(competition.status || "");
    if (currentStatus === "completed") throw new Error("Completed tournaments cannot be cancelled");
    if (currentStatus === "active" && !input.allowActive) throw new Error("Active tournaments require admin cancellation");
    if (!["open", "upcoming", "closed", "active", "cancelled"].includes(currentStatus)) {
      throw new Error(`Tournament cannot be cancelled from status ${currentStatus || "unknown"}`);
    }

    const entries = rowsOf(await tx.execute(sql`
      SELECT ce.id, ce.user_id,
        CASE
          WHEN coalesce(ce.entry_fee_paid, 0) > 0 THEN ce.entry_fee_paid
          ELSE GREATEST(coalesce(${competition.entry_fee}, 0), 0)
        END::float AS refund_amount
      FROM app.competition_entries ce
      WHERE ce.competition_id = ${competitionId}
      ORDER BY ce.id
      FOR UPDATE
    `));

    let newlyRefundedEntries = 0;
    let newlyRefundedTotal = 0;

    for (const entry of entries) {
      const entryId = Number(entry.id);
      const userId = String(entry.user_id || "");
      const refundAmount = toMoney(entry.refund_amount);
      if (!Number.isInteger(entryId) || entryId <= 0 || !userId) throw new Error("Tournament entry is invalid");

      const claimed = rowsOf(await tx.execute(sql`
        INSERT INTO app.competition_entry_refunds
          (entry_id, competition_id, user_id, amount)
        VALUES (${entryId}, ${competitionId}, ${userId}, ${refundAmount})
        ON CONFLICT (entry_id) DO NOTHING
        RETURNING entry_id
      `))[0];
      if (!claimed) continue;

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
        if (!wallet) throw new Error(`Wallet not found for entrant ${userId}`);

        const externalTransactionId = `competition-refund:${competitionId}:entry:${entryId}`;
        const transaction = rowsOf(await tx.execute(sql`
          INSERT INTO app.transactions
            (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description, external_transaction_id)
          VALUES
            (${userId}, 'tournament_refund', ${refundAmount}, ${refundAmount}, 0, ${refundAmount},
             'tournament_cancellation_refund', 'completed',
             ${`Tournament cancellation refund competition:${competitionId} entry:${entryId}`},
             ${externalTransactionId})
          RETURNING id
        `))[0];
        if (!transaction?.id) throw new Error("Failed to create tournament refund ledger entry");
        transactionId = Number(transaction.id);
      }

      await tx.execute(sql`
        UPDATE app.competition_entry_refunds
        SET transaction_id = ${transactionId}
        WHERE entry_id = ${entryId}
      `);
      newlyRefundedEntries += 1;
      newlyRefundedTotal = toMoney(newlyRefundedTotal + refundAmount);
    }

    const releasedLocks = rowsOf(await tx.execute(sql`
      DELETE FROM app.card_locks
      WHERE reason = 'competition' AND ref_id = ${String(competitionId)}
      RETURNING id
    `)).length;

    const totals = rowsOf(await tx.execute(sql`
      SELECT count(*)::int AS refunded_entry_count,
        coalesce(sum(amount), 0)::float AS refund_total
      FROM app.competition_entry_refunds
      WHERE competition_id = ${competitionId}
    `))[0] || { refunded_entry_count: 0, refund_total: 0 };

    const refundedEntryCount = Number(totals.refunded_entry_count || 0);
    const refundTotal = toMoney(totals.refund_total);
    const wasAlreadyCancelled = currentStatus === "cancelled";

    const updated = rowsOf(await tx.execute(sql`
      UPDATE app.competitions
      SET status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        cancelled_by = coalesce(cancelled_by, ${actorId}),
        cancellation_reason = coalesce(cancellation_reason, ${reason}),
        refund_total = ${refundTotal},
        refunded_entry_count = ${refundedEntryCount},
        platform_fee_total = 0,
        prize_pool_total = 0
      WHERE id = ${competitionId}
      RETURNING *
    `))[0];

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (
        ${actorId},
        ${wasAlreadyCancelled ? "competition.cancellation.reconciled" : "competition.cancelled"},
        ${JSON.stringify({
          competitionId,
          previousStatus: currentStatus,
          refundedEntryCount,
          refundTotal,
          newlyRefundedEntries,
          newlyRefundedTotal,
          releasedLocks,
          reason,
        })}::jsonb
      )
    `);

    return {
      competition: updated,
      duplicate: wasAlreadyCancelled && newlyRefundedEntries === 0,
      refundedEntryCount,
      refundTotal,
      newlyRefundedEntries,
      newlyRefundedTotal,
      releasedLocks,
    };
  });
}
