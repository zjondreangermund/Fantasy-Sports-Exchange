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
          add column if not exists prize_pool_total real not null default 0,
          add column if not exists prize_distribution text not null default 'winner_takes_all',
          add column if not exists prize_distribution_rules jsonb not null default '[{"rank":1,"percent":100}]'::jsonb,
          add column if not exists gameweek_label text,
          add column if not exists fixture_window_start timestamp,
          add column if not exists fixture_window_end timestamp,
          add column if not exists reschedule_alerts_enabled boolean not null default true
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
            prize_pool_total = coalesce(prize_pool_total, 0),
            prize_distribution = coalesce(nullif(prize_distribution, ''), 'winner_takes_all'),
            prize_distribution_rules = coalesce(prize_distribution_rules, '[{"rank":1,"percent":100}]'::jsonb),
            gameweek_label = coalesce(gameweek_label, concat('GW ', game_week)),
            fixture_window_start = coalesce(fixture_window_start, start_date),
            fixture_window_end = coalesce(fixture_window_end, end_date),
            reschedule_alerts_enabled = coalesce(reschedule_alerts_enabled, true)
      `);
    })().catch((error) => {
      tournamentSchemaReady = null;
      throw error;
    });
  }
  return tournamentSchemaReady;
}
