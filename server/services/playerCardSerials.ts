import { sql } from "drizzle-orm";
import { db } from "../db.js";

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

let serialSchemaReady: Promise<{ repairedCount: number }> | null = null;

export async function ensurePlayerCardSerialIntegrity(): Promise<{ repairedCount: number }> {
  if (!serialSchemaReady) {
    serialSchemaReady = db.transaction(async (tx) => {
      await tx.execute(sql`
        ALTER TABLE app.player_cards
          ADD COLUMN IF NOT EXISTS serial_id text,
          ADD COLUMN IF NOT EXISTS serial_number integer,
          ADD COLUMN IF NOT EXISTS max_supply integer DEFAULT 0
      `);

      await tx.execute(sql`LOCK TABLE app.player_cards IN SHARE ROW EXCLUSIVE MODE`);
      await tx.execute(sql`DROP TABLE IF EXISTS pg_temp.player_card_serial_repair_plan`);
      await tx.execute(sql`
        CREATE TEMP TABLE player_card_serial_repair_plan ON COMMIT DROP AS
        WITH ranked AS (
          SELECT pc.id,
            pc.player_id,
            pc.rarity::text AS rarity,
            row_number() OVER (PARTITION BY pc.player_id, pc.rarity ORDER BY pc.id)::int AS serial_number,
            upper(left(regexp_replace(coalesce(p.name, 'PLAYER'), '[^A-Za-z0-9]+', '', 'g'), 3)) AS initials
          FROM app.player_cards pc
          JOIN app.players p ON p.id = pc.player_id
        )
        SELECT id,
          serial_number,
          CASE rarity
            WHEN 'common' THEN 1000
            WHEN 'rare' THEN 100
            WHEN 'unique' THEN 10
            WHEN 'epic' THEN 3
            WHEN 'legendary' THEN 1
            ELSE 0
          END::int AS max_supply,
          concat(
            coalesce(nullif(initials, ''), 'PLY'), '-', player_id, '-',
            upper(left(rarity, 1)), '-', lpad(serial_number::text, 4, '0')
          ) AS serial_id
        FROM ranked
      `);

      const mismatches = rowsOf(await tx.execute(sql`
        SELECT count(*)::int AS count
        FROM app.player_cards pc
        JOIN player_card_serial_repair_plan plan ON plan.id = pc.id
        WHERE pc.serial_id IS DISTINCT FROM plan.serial_id
           OR pc.serial_number IS DISTINCT FROM plan.serial_number
           OR pc.max_supply IS DISTINCT FROM plan.max_supply
      `));
      const repairedCount = Number(mismatches[0]?.count || 0);

      if (repairedCount > 0) {
        // Move only rows that need repair to collision-proof temporary values first.
        // This avoids transient failures against the global serial_id unique index and
        // the per-player rarity/serial-number unique index during canonicalization.
        await tx.execute(sql`
          UPDATE app.player_cards pc
          SET serial_id = concat('__serial_repair__', pc.id),
              serial_number = NULL
          FROM player_card_serial_repair_plan plan
          WHERE plan.id = pc.id
            AND (
              pc.serial_id IS DISTINCT FROM plan.serial_id
              OR pc.serial_number IS DISTINCT FROM plan.serial_number
              OR pc.max_supply IS DISTINCT FROM plan.max_supply
            )
        `);
        await tx.execute(sql`
          UPDATE app.player_cards pc
          SET serial_id = plan.serial_id,
              serial_number = plan.serial_number,
              max_supply = plan.max_supply
          FROM player_card_serial_repair_plan plan
          WHERE plan.id = pc.id
            AND pc.serial_id = concat('__serial_repair__', pc.id)
        `);
      }

      await tx.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS player_cards_player_rarity_serial_unique
        ON app.player_cards (player_id, rarity, serial_number)
        WHERE serial_number IS NOT NULL
      `);
      await tx.execute(sql`
        CREATE OR REPLACE FUNCTION app.enforce_player_card_serial_supply()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
          supply_limit integer;
          current_supply integer;
          next_serial integer;
          player_initials text;
        BEGIN
          supply_limit := CASE NEW.rarity::text
            WHEN 'common' THEN 1000
            WHEN 'rare' THEN 100
            WHEN 'unique' THEN 10
            WHEN 'epic' THEN 3
            WHEN 'legendary' THEN 1
            ELSE 0
          END;
          PERFORM pg_advisory_xact_lock(NEW.player_id, hashtext(NEW.rarity::text));
          SELECT count(*)::int, coalesce(max(serial_number), 0)::int + 1
            INTO current_supply, next_serial
          FROM app.player_cards
          WHERE player_id = NEW.player_id AND rarity = NEW.rarity;
          IF supply_limit > 0 AND current_supply >= supply_limit THEN
            RAISE EXCEPTION 'Supply cap reached for player %, rarity % (% max)', NEW.player_id, NEW.rarity, supply_limit
              USING ERRCODE = '23514';
          END IF;
          SELECT upper(left(regexp_replace(coalesce(name, 'PLAYER'), '[^A-Za-z0-9]+', '', 'g'), 3))
            INTO player_initials
          FROM app.players
          WHERE id = NEW.player_id;
          NEW.serial_number := next_serial;
          NEW.max_supply := supply_limit;
          NEW.serial_id := concat(
            coalesce(nullif(player_initials, ''), 'PLY'), '-', NEW.player_id, '-',
            upper(left(NEW.rarity::text, 1)), '-', lpad(next_serial::text, 4, '0')
          );
          RETURN NEW;
        END;
        $$
      `);
      await tx.execute(sql`DROP TRIGGER IF EXISTS player_cards_serial_supply_guard ON app.player_cards`);
      await tx.execute(sql`
        CREATE TRIGGER player_cards_serial_supply_guard
        BEFORE INSERT ON app.player_cards
        FOR EACH ROW EXECUTE FUNCTION app.enforce_player_card_serial_supply()
      `);

      return { repairedCount };
    }).catch((error) => {
      serialSchemaReady = null;
      throw error;
    });
  }

  return await serialSchemaReady!;
}
