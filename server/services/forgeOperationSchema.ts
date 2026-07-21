import { sql } from "drizzle-orm";
import { db } from "../db.js";

let ready: Promise<void> | null = null;

export async function ensureForgeOperationSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.forge_operations (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          operation_key text NOT NULL UNIQUE,
          source_signature text NOT NULL UNIQUE,
          user_id varchar(255) NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
          player_id integer NOT NULL REFERENCES app.players(id) ON DELETE RESTRICT,
          source_card_ids jsonb NOT NULL,
          burn_count integer NOT NULL DEFAULT 5,
          target_rarity text NOT NULL DEFAULT 'rare',
          fee_amount real NOT NULL,
          fee_posting_key text UNIQUE,
          fee_transaction_id integer UNIQUE REFERENCES app.transactions(id) ON DELETE RESTRICT,
          minted_card_id integer UNIQUE REFERENCES app.player_cards(id) ON DELETE RESTRICT,
          status text NOT NULL DEFAULT 'processing',
          created_at timestamp NOT NULL DEFAULT now(),
          completed_at timestamp
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.forge_burn_items (
          operation_id integer NOT NULL REFERENCES app.forge_operations(id) ON DELETE RESTRICT,
          card_id integer NOT NULL UNIQUE REFERENCES app.player_cards(id) ON DELETE RESTRICT,
          ordinal integer NOT NULL,
          PRIMARY KEY (operation_id, card_id),
          UNIQUE (operation_id, ordinal)
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS forge_operations_user_created_idx ON app.forge_operations (user_id, created_at DESC, id DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS forge_operations_player_created_idx ON app.forge_operations (player_id, created_at DESC, id DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS forge_operations_status_idx ON app.forge_operations (status, created_at DESC, id DESC)`);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}
