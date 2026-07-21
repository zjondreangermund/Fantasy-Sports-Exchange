import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensureWalletPostingSchema } from "./walletPostingSchema.js";

let ready: Promise<void> | null = null;

export async function ensureLoanPaymentSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await ensureWalletPostingSchema();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.card_loans (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          card_id integer NOT NULL REFERENCES app.player_cards(id),
          original_owner_id varchar(255) NOT NULL REFERENCES app.users(id),
          borrower_user_id varchar(255) REFERENCES app.users(id),
          status text NOT NULL DEFAULT 'open',
          price_per_gameweek real NOT NULL,
          gameweeks integer NOT NULL,
          gross_amount real NOT NULL DEFAULT 0,
          fee_amount real NOT NULL DEFAULT 0,
          owner_receives real NOT NULL DEFAULT 0,
          starts_at timestamp,
          expires_at timestamp,
          returned_at timestamp,
          borrower_posting_key text,
          borrower_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT,
          owner_posting_key text,
          owner_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT,
          payment_completed_at timestamp,
          created_at timestamp DEFAULT now()
        )
      `);
      await db.execute(sql`
        ALTER TABLE app.card_loans
          ADD COLUMN IF NOT EXISTS borrower_posting_key text,
          ADD COLUMN IF NOT EXISTS borrower_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT,
          ADD COLUMN IF NOT EXISTS owner_posting_key text,
          ADD COLUMN IF NOT EXISTS owner_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT,
          ADD COLUMN IF NOT EXISTS payment_completed_at timestamp
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS card_loans_card_status_idx ON app.card_loans(card_id, status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS card_loans_borrower_status_idx ON app.card_loans(borrower_user_id, status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS card_loans_expiry_idx ON app.card_loans(expires_at) WHERE status = 'active'`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS card_loans_borrower_posting_key_unique ON app.card_loans(borrower_posting_key) WHERE borrower_posting_key IS NOT NULL`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS card_loans_borrower_transaction_unique ON app.card_loans(borrower_transaction_id) WHERE borrower_transaction_id IS NOT NULL`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS card_loans_owner_posting_key_unique ON app.card_loans(owner_posting_key) WHERE owner_posting_key IS NOT NULL`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS card_loans_owner_transaction_unique ON app.card_loans(owner_transaction_id) WHERE owner_transaction_id IS NOT NULL`);

      await db.execute(sql`
        WITH candidates AS (
          SELECT l.id AS loan_id, l.borrower_user_id AS user_id,
            -abs(coalesce(l.gross_amount, 0))::float AS amount,
            t.id AS transaction_id,
            count(*) OVER (PARTITION BY l.id) AS match_count
          FROM app.card_loans l
          JOIN app.transactions t
            ON t.user_id = l.borrower_user_id
           AND t.type::text = 'purchase'
           AND coalesce(t.source_type, '') = 'card_loan_accept'
           AND coalesce(t.status::text, 'completed') = 'completed'
           AND substring(coalesce(t.description, '') from 'loan:([0-9]+)') = l.id::text
           AND round(coalesce(t.amount, 0)::numeric, 2) = round((-abs(coalesce(l.gross_amount, 0)))::numeric, 2)
          WHERE l.status IN ('active', 'returned')
            AND l.borrower_user_id IS NOT NULL
            AND coalesce(l.gross_amount, 0) > 0
        )
        INSERT INTO app.wallet_posting_claims
          (posting_key, user_id, amount, transaction_type, source_type, reason, metadata, transaction_id, completed_at)
        SELECT concat('loan:', loan_id, ':borrower-debit'), user_id, amount, 'purchase', 'card_loan_accept',
          'Backfilled legacy loan borrower debit',
          jsonb_build_object('loanId', loan_id, 'role', 'borrower', 'legacy', true),
          transaction_id, now()
        FROM candidates
        WHERE match_count = 1
        ON CONFLICT DO NOTHING
      `);
      await db.execute(sql`
        WITH candidates AS (
          SELECT l.id AS loan_id, l.original_owner_id AS user_id,
            coalesce(l.owner_receives, 0)::float AS amount,
            t.id AS transaction_id,
            count(*) OVER (PARTITION BY l.id) AS match_count
          FROM app.card_loans l
          JOIN app.transactions t
            ON t.user_id = l.original_owner_id
           AND t.type::text = 'sale'
           AND coalesce(t.source_type, '') = 'card_loan_income'
           AND coalesce(t.status::text, 'completed') = 'completed'
           AND substring(coalesce(t.description, '') from 'loan:([0-9]+)') = l.id::text
           AND round(coalesce(t.amount, 0)::numeric, 2) = round(coalesce(l.owner_receives, 0)::numeric, 2)
          WHERE l.status IN ('active', 'returned')
            AND coalesce(l.owner_receives, 0) > 0
        )
        INSERT INTO app.wallet_posting_claims
          (posting_key, user_id, amount, transaction_type, source_type, reason, metadata, transaction_id, completed_at)
        SELECT concat('loan:', loan_id, ':owner-credit'), user_id, amount, 'sale', 'card_loan_income',
          'Backfilled legacy loan owner credit',
          jsonb_build_object('loanId', loan_id, 'role', 'owner', 'legacy', true),
          transaction_id, now()
        FROM candidates
        WHERE match_count = 1
        ON CONFLICT DO NOTHING
      `);
      await db.execute(sql`
        UPDATE app.transactions t
        SET external_transaction_id = claims.posting_key
        FROM app.wallet_posting_claims claims
        WHERE claims.transaction_id = t.id
          AND claims.source_type IN ('card_loan_accept', 'card_loan_income')
          AND coalesce(t.external_transaction_id, '') = ''
      `);
      await db.execute(sql`
        UPDATE app.card_loans l
        SET borrower_posting_key = claims.posting_key,
            borrower_transaction_id = claims.transaction_id
        FROM app.wallet_posting_claims claims
        WHERE claims.source_type = 'card_loan_accept'
          AND (claims.metadata ->> 'loanId') ~ '^[0-9]+$'
          AND l.id = (claims.metadata ->> 'loanId')::int
          AND l.borrower_posting_key IS NULL
          AND l.borrower_transaction_id IS NULL
      `);
      await db.execute(sql`
        UPDATE app.card_loans l
        SET owner_posting_key = claims.posting_key,
            owner_transaction_id = claims.transaction_id
        FROM app.wallet_posting_claims claims
        WHERE claims.source_type = 'card_loan_income'
          AND (claims.metadata ->> 'loanId') ~ '^[0-9]+$'
          AND l.id = (claims.metadata ->> 'loanId')::int
          AND l.owner_posting_key IS NULL
          AND l.owner_transaction_id IS NULL
      `);
      await db.execute(sql`
        UPDATE app.card_loans
        SET payment_completed_at = coalesce(payment_completed_at, now())
        WHERE borrower_transaction_id IS NOT NULL
          AND owner_transaction_id IS NOT NULL
          AND payment_completed_at IS NULL
      `);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}
