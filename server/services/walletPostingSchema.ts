import { sql } from "drizzle-orm";
import { db } from "../db.js";

let ready: Promise<void> | null = null;

export async function ensureWalletPostingSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.wallet_posting_claims (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          posting_key text NOT NULL UNIQUE,
          user_id varchar(255) NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
          amount real NOT NULL CHECK (amount <> 0),
          transaction_type text NOT NULL,
          source_type text NOT NULL,
          actor_user_id varchar(255) REFERENCES app.users(id) ON DELETE RESTRICT,
          reason text,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          transaction_id integer UNIQUE REFERENCES app.transactions(id) ON DELETE RESTRICT,
          created_at timestamp NOT NULL DEFAULT now(),
          completed_at timestamp
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS wallet_posting_claims_user_created_idx ON app.wallet_posting_claims (user_id, created_at DESC, id DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS wallet_posting_claims_source_created_idx ON app.wallet_posting_claims (source_type, created_at DESC, id DESC)`);
      await db.execute(sql`
        ALTER TABLE app.competition_entries
          ADD COLUMN IF NOT EXISTS payout_posting_key text,
          ADD COLUMN IF NOT EXISTS payout_transaction_id integer REFERENCES app.transactions(id) ON DELETE RESTRICT,
          ADD COLUMN IF NOT EXISTS payout_completed_at timestamp
      `);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS competition_entries_payout_posting_key_unique ON app.competition_entries (payout_posting_key) WHERE payout_posting_key IS NOT NULL`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS competition_entries_payout_transaction_unique ON app.competition_entries (payout_transaction_id) WHERE payout_transaction_id IS NOT NULL`);

      await db.execute(sql`
        WITH parsed AS (
          SELECT t.id AS transaction_id, t.user_id, coalesce(t.amount, 0)::float AS amount,
            nullif(substring(coalesce(t.description, '') from 'competition:([0-9]+)'), '')::int AS competition_id,
            nullif(substring(coalesce(t.description, '') from 'rank:([0-9]+)'), '')::int AS payout_rank
          FROM app.transactions t
          WHERE t.type::text = 'tournament_payout'
            AND coalesce(t.source_type, '') = 'tournament_settlement'
        ), matched AS (
          SELECT parsed.*, ce.id AS entry_id,
            concat('tournament:', parsed.competition_id, ':entry:', ce.id, ':cash') AS posting_key,
            row_number() OVER (PARTITION BY ce.id ORDER BY parsed.transaction_id) AS duplicate_rank
          FROM parsed
          JOIN app.competition_entries ce
            ON ce.competition_id = parsed.competition_id
           AND ce.user_id = parsed.user_id
           AND ce.rank = parsed.payout_rank
          WHERE parsed.competition_id IS NOT NULL AND parsed.payout_rank IS NOT NULL
        )
        INSERT INTO app.wallet_posting_claims
          (posting_key, user_id, amount, transaction_type, source_type, reason, metadata, transaction_id, completed_at)
        SELECT matched.posting_key, matched.user_id, matched.amount, 'tournament_payout', 'tournament_settlement',
          'Backfilled legacy tournament payout',
          jsonb_build_object('competitionId', matched.competition_id, 'entryId', matched.entry_id, 'legacy', true),
          matched.transaction_id, now()
        FROM matched
        WHERE matched.duplicate_rank = 1
        ON CONFLICT (posting_key) DO NOTHING
      `);
      await db.execute(sql`
        UPDATE app.transactions t
        SET external_transaction_id = claims.posting_key
        FROM app.wallet_posting_claims claims
        WHERE claims.transaction_id = t.id
          AND coalesce(t.external_transaction_id, '') = ''
      `);
      await db.execute(sql`
        UPDATE app.competition_entries ce
        SET payout_posting_key = claims.posting_key,
            payout_transaction_id = claims.transaction_id,
            payout_completed_at = coalesce(ce.payout_completed_at, claims.completed_at, now())
        FROM app.wallet_posting_claims claims
        WHERE claims.source_type = 'tournament_settlement'
          AND (claims.metadata ->> 'entryId') ~ '^[0-9]+$'
          AND ce.id = (claims.metadata ->> 'entryId')::int
          AND ce.payout_posting_key IS NULL
      `);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}
