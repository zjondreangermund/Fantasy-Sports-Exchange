import { sql } from "drizzle-orm";
import { db } from "../db.js";

let tournamentSchemaReady: Promise<void> | null = null;

export function ensureTournamentSchema() {
  if (!tournamentSchemaReady) {
    tournamentSchemaReady = (async () => {
      await db.execute(sql`
        alter table app.competitions
          add column if not exists created_by_user_id text,
          add column if not exists join_pin text,
          add column if not exists visibility text not null default 'public',
          add column if not exists max_entries integer,
          add column if not exists platform_fee_rate real not null default 0.2,
          add column if not exists platform_fee_total real not null default 0,
          add column if not exists prize_pool_total real not null default 0
      `);

      await db.execute(sql`
        create unique index if not exists competitions_join_pin_unique_idx
        on app.competitions (join_pin)
        where join_pin is not null
      `);

      await db.execute(sql`
        update app.competitions
        set visibility = coalesce(nullif(visibility, ''), 'public'),
            platform_fee_rate = coalesce(platform_fee_rate, 0.2),
            platform_fee_total = coalesce(platform_fee_total, 0),
            prize_pool_total = coalesce(prize_pool_total, 0)
      `);
    })().catch((error) => {
      tournamentSchemaReady = null;
      throw error;
    });
  }
  return tournamentSchemaReady;
}
