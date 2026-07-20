import { sql } from "drizzle-orm";
import { db } from "../db.js";

let ready: Promise<void> | null = null;

export async function ensureWithdrawalPayoutSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`ALTER TYPE app.withdrawal_status ADD VALUE IF NOT EXISTS 'failed'`);
      await db.execute(sql`
        ALTER TABLE app.withdrawal_requests
          ADD COLUMN IF NOT EXISTS hold_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT,
          ADD COLUMN IF NOT EXISTS reviewed_by varchar(255) REFERENCES app.users(id),
          ADD COLUMN IF NOT EXISTS approved_at timestamp,
          ADD COLUMN IF NOT EXISTS paid_at timestamp,
          ADD COLUMN IF NOT EXISTS rejected_at timestamp,
          ADD COLUMN IF NOT EXISTS failed_at timestamp,
          ADD COLUMN IF NOT EXISTS payout_reference text,
          ADD COLUMN IF NOT EXISTS payout_reference_key text,
          ADD COLUMN IF NOT EXISTS payout_error text,
          ADD COLUMN IF NOT EXISTS payout_attempts integer NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS recovery_completed_at timestamp
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.withdrawal_payout_attempts (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          withdrawal_id integer NOT NULL REFERENCES app.withdrawal_requests(id) ON DELETE RESTRICT,
          admin_id varchar(255) NOT NULL REFERENCES app.users(id),
          attempt_no integer NOT NULL CHECK (attempt_no > 0),
          status text NOT NULL CHECK (status IN ('paid', 'failed')),
          payout_reference text,
          payout_reference_key text,
          error_text text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now(),
          UNIQUE (withdrawal_id, attempt_no)
        )
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_hold_transaction_unique ON app.withdrawal_requests (hold_transaction_id) WHERE hold_transaction_id IS NOT NULL`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_verification_token_unique ON app.withdrawal_requests (verification_token) WHERE verification_token IS NOT NULL`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_payout_reference_unique ON app.withdrawal_payout_attempts (payout_reference_key) WHERE payout_reference_key IS NOT NULL`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS withdrawal_payout_attempts_withdrawal_idx ON app.withdrawal_payout_attempts (withdrawal_id, attempt_no DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS withdrawal_requests_status_created_idx ON app.withdrawal_requests (status, created_at DESC, id DESC)`);

      await db.execute(sql`
        WITH candidates AS (
          SELECT wr.id AS withdrawal_id, t.id AS transaction_id,
            row_number() OVER (
              PARTITION BY wr.id
              ORDER BY CASE WHEN t.source_type IN ('withdrawal_hold', 'withdrawal_settlement', 'withdrawal_refund') THEN 0 ELSE 1 END,
                t.created_at NULLS LAST, t.id
            ) AS candidate_rank
          FROM app.withdrawal_requests wr
          JOIN app.transactions t
            ON t.user_id = wr.user_id
           AND t.type::text = 'withdrawal'
           AND nullif(wr.verification_token, '') IS NOT NULL
           AND t.external_transaction_id = wr.verification_token
        )
        UPDATE app.withdrawal_requests wr
        SET hold_transaction_id = c.transaction_id
        FROM candidates c
        WHERE wr.id = c.withdrawal_id
          AND c.candidate_rank = 1
          AND wr.hold_transaction_id IS NULL
      `);
      await db.execute(sql`UPDATE app.withdrawal_requests SET approved_at = coalesce(approved_at, reviewed_at, created_at) WHERE status::text = 'approved'`);
      await db.execute(sql`
        UPDATE app.withdrawal_requests
        SET paid_at = coalesce(paid_at, reviewed_at, created_at),
            payout_error = coalesce(payout_error, CASE WHEN payout_reference_key IS NULL THEN 'Legacy paid withdrawal has no external payout reference' ELSE NULL END)
        WHERE status::text = 'paid'
      `);
      await db.execute(sql`UPDATE app.withdrawal_requests SET rejected_at = coalesce(rejected_at, reviewed_at, created_at) WHERE status::text = 'rejected'`);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}
