import { sql } from "drizzle-orm";
import { db } from "./db.js";

export async function ensureRuntimeSchema() {
  try {
    await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS gross_amount real DEFAULT 0`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS fee_amount real DEFAULT 0`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS net_amount real DEFAULT 0`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS source_type text DEFAULT ''`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS destination_key text`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS destination_verified boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS verification_token text`);
    await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS release_after timestamp`);

    await db.execute(sql`
      WITH ranked AS (
        SELECT pc.id, pc.player_id, pc.rarity,
          row_number() OVER (PARTITION BY pc.player_id, pc.rarity ORDER BY pc.id)::int AS serial_number,
          upper(left(regexp_replace(coalesce(p.name, 'PLAYER'), '[^A-Za-z0-9]+', '', 'g'), 3)) AS initials
        FROM app.player_cards pc
        JOIN app.players p ON p.id = pc.player_id
      )
      UPDATE app.player_cards pc
      SET serial_number = ranked.serial_number,
          max_supply = CASE pc.rarity::text WHEN 'common' THEN 1000 WHEN 'rare' THEN 100 WHEN 'unique' THEN 10 WHEN 'epic' THEN 3 WHEN 'legendary' THEN 1 ELSE 0 END,
          serial_id = concat(coalesce(nullif(ranked.initials, ''), 'PLY'), '-', pc.player_id, '-', upper(left(pc.rarity::text, 1)), '-', lpad(ranked.serial_number::text, 4, '0'))
      FROM ranked
      WHERE ranked.id = pc.id
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS player_cards_player_rarity_serial_unique ON app.player_cards (player_id, rarity, serial_number) WHERE serial_number IS NOT NULL`);
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION app.enforce_player_card_serial_supply()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE supply_limit integer; current_supply integer; next_serial integer; player_initials text;
      BEGIN
        supply_limit := CASE NEW.rarity::text WHEN 'common' THEN 1000 WHEN 'rare' THEN 100 WHEN 'unique' THEN 10 WHEN 'epic' THEN 3 WHEN 'legendary' THEN 1 ELSE 0 END;
        PERFORM pg_advisory_xact_lock(NEW.player_id, hashtext(NEW.rarity::text));
        SELECT count(*)::int, coalesce(max(serial_number), 0)::int + 1 INTO current_supply, next_serial
        FROM app.player_cards WHERE player_id = NEW.player_id AND rarity = NEW.rarity;
        IF supply_limit > 0 AND current_supply >= supply_limit THEN
          RAISE EXCEPTION 'Supply cap reached for player %, rarity % (% max)', NEW.player_id, NEW.rarity, supply_limit USING ERRCODE = '23514';
        END IF;
        SELECT upper(left(regexp_replace(coalesce(name, 'PLAYER'), '[^A-Za-z0-9]+', '', 'g'), 3)) INTO player_initials FROM app.players WHERE id = NEW.player_id;
        NEW.serial_number := next_serial;
        NEW.max_supply := supply_limit;
        NEW.serial_id := concat(coalesce(nullif(player_initials, ''), 'PLY'), '-', NEW.player_id, '-', upper(left(NEW.rarity::text, 1)), '-', lpad(next_serial::text, 4, '0'));
        RETURN NEW;
      END;
      $$
    `);
    await db.execute(sql`DROP TRIGGER IF EXISTS player_cards_serial_supply_guard ON app.player_cards`);
    await db.execute(sql`CREATE TRIGGER player_cards_serial_supply_guard BEFORE INSERT ON app.player_cards FOR EACH ROW EXECUTE FUNCTION app.enforce_player_card_serial_supply()`);
  } catch (error) {
    console.warn("Runtime schema check failed:", error);
  }
}
