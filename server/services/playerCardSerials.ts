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

      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS app.player_card_serial_counters (
          player_id integer NOT NULL,
          rarity text NOT NULL,
          last_serial_number integer NOT NULL DEFAULT 0,
          max_supply integer NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (player_id, rarity),
          CHECK (last_serial_number >= 0)
        )
      `);
      // Mint history must outlive a player/card row. Never cascade-delete the counter ledger.
      await tx.execute(sql`
        ALTER TABLE app.player_card_serial_counters
        DROP CONSTRAINT IF EXISTS player_card_serial_counters_player_id_fkey
      `);

      // A previous boot may already have installed the immutability guard. Temporarily
      // remove it while repairing legacy metadata; it is recreated before this transaction commits.
      await tx.execute(sql`DROP TRIGGER IF EXISTS player_cards_mint_identity_guard ON app.player_cards`);

      // Lock while importing existing serial history and repairing only missing metadata.
      // Existing non-null serial numbers are deliberately never renumbered.
      await tx.execute(sql`LOCK TABLE app.player_cards IN SHARE ROW EXCLUSIVE MODE`);

      await tx.execute(sql`
        INSERT INTO app.player_card_serial_counters (player_id, rarity, last_serial_number, max_supply)
        SELECT
          pc.player_id,
          pc.rarity::text,
          coalesce(max(pc.serial_number), 0)::int,
          CASE pc.rarity::text
            WHEN 'common' THEN 1000
            WHEN 'rare' THEN 100
            WHEN 'unique' THEN 10
            WHEN 'epic' THEN 3
            WHEN 'legendary' THEN 1
            ELSE 0
          END::int
        FROM app.player_cards pc
        GROUP BY pc.player_id, pc.rarity
        ON CONFLICT (player_id, rarity) DO UPDATE
        SET last_serial_number = greatest(
              app.player_card_serial_counters.last_serial_number,
              excluded.last_serial_number
            ),
            max_supply = excluded.max_supply,
            updated_at = now()
      `);

      const impossibleMissing = rowsOf(await tx.execute(sql`
        WITH missing AS (
          SELECT pc.player_id, pc.rarity::text AS rarity, count(*)::int AS missing_count
          FROM app.player_cards pc
          WHERE pc.serial_number IS NULL OR pc.serial_number <= 0
          GROUP BY pc.player_id, pc.rarity
        )
        SELECT m.player_id, m.rarity, m.missing_count,
          coalesce(c.last_serial_number, 0)::int AS last_serial_number,
          coalesce(c.max_supply, 0)::int AS max_supply
        FROM missing m
        LEFT JOIN app.player_card_serial_counters c
          ON c.player_id = m.player_id AND c.rarity = m.rarity
        WHERE coalesce(c.max_supply, 0) > 0
          AND coalesce(c.last_serial_number, 0) + m.missing_count > c.max_supply
      `));
      if (impossibleMissing.length > 0) {
        const row = impossibleMissing[0];
        throw new Error(
          `Cannot repair missing serials for player ${row.player_id}, rarity ${row.rarity}: supply cap would be exceeded`,
        );
      }

      // Legacy rows without a mint number receive fresh numbers ABOVE every number already used.
      // This preserves all existing serial identities and prevents historical serial reuse.
      await tx.execute(sql`
        WITH missing AS (
          SELECT
            pc.id,
            pc.player_id,
            pc.rarity::text AS rarity,
            row_number() OVER (PARTITION BY pc.player_id, pc.rarity ORDER BY pc.id)::int AS offset_number
          FROM app.player_cards pc
          WHERE pc.serial_number IS NULL OR pc.serial_number <= 0
        ),
        assigned AS (
          SELECT
            m.id,
            m.player_id,
            m.rarity,
            (c.last_serial_number + m.offset_number)::int AS serial_number,
            c.max_supply,
            upper(left(regexp_replace(coalesce(p.name, 'PLAYER'), '[^A-Za-z0-9]+', '', 'g'), 3)) AS initials
          FROM missing m
          JOIN app.player_card_serial_counters c
            ON c.player_id = m.player_id AND c.rarity = m.rarity
          JOIN app.players p ON p.id = m.player_id
        )
        UPDATE app.player_cards pc
        SET serial_number = assigned.serial_number,
            max_supply = assigned.max_supply,
            serial_id = concat(
              coalesce(nullif(assigned.initials, ''), 'PLY'), '-', assigned.player_id, '-',
              upper(left(assigned.rarity, 1)), '-', lpad(assigned.serial_number::text, 4, '0')
            )
        FROM assigned
        WHERE pc.id = assigned.id
      `);

      // Advance counters after any one-time legacy repair. GREATEST makes this safe to run repeatedly.
      await tx.execute(sql`
        INSERT INTO app.player_card_serial_counters (player_id, rarity, last_serial_number, max_supply)
        SELECT
          pc.player_id,
          pc.rarity::text,
          coalesce(max(pc.serial_number), 0)::int,
          CASE pc.rarity::text
            WHEN 'common' THEN 1000
            WHEN 'rare' THEN 100
            WHEN 'unique' THEN 10
            WHEN 'epic' THEN 3
            WHEN 'legendary' THEN 1
            ELSE 0
          END::int
        FROM app.player_cards pc
        GROUP BY pc.player_id, pc.rarity
        ON CONFLICT (player_id, rarity) DO UPDATE
        SET last_serial_number = greatest(
              app.player_card_serial_counters.last_serial_number,
              excluded.last_serial_number
            ),
            max_supply = excluded.max_supply,
            updated_at = now()
      `);

      await tx.execute(sql`DROP TABLE IF EXISTS pg_temp.player_card_serial_repair_plan`);
      await tx.execute(sql`
        CREATE TEMP TABLE player_card_serial_repair_plan ON COMMIT DROP AS
        SELECT
          pc.id,
          pc.serial_number,
          CASE pc.rarity::text
            WHEN 'common' THEN 1000
            WHEN 'rare' THEN 100
            WHEN 'unique' THEN 10
            WHEN 'epic' THEN 3
            WHEN 'legendary' THEN 1
            ELSE 0
          END::int AS max_supply,
          concat(
            coalesce(
              nullif(upper(left(regexp_replace(coalesce(p.name, 'PLAYER'), '[^A-Za-z0-9]+', '', 'g'), 3)), ''),
              'PLY'
            ), '-', pc.player_id, '-', upper(left(pc.rarity::text, 1)), '-',
            lpad(pc.serial_number::text, 4, '0')
          ) AS serial_id
        FROM app.player_cards pc
        JOIN app.players p ON p.id = pc.player_id
        WHERE pc.serial_number IS NOT NULL AND pc.serial_number > 0
      `);

      const mismatches = rowsOf(await tx.execute(sql`
        SELECT count(*)::int AS count
        FROM app.player_cards pc
        JOIN player_card_serial_repair_plan plan ON plan.id = pc.id
        WHERE pc.serial_id IS DISTINCT FROM plan.serial_id
           OR pc.max_supply IS DISTINCT FROM plan.max_supply
      `));
      const repairedCount = Number(mismatches[0]?.count || 0);

      if (repairedCount > 0) {
        // Use collision-proof temporary IDs while normalizing labels/max-supply only.
        // Serial numbers themselves remain immutable.
        await tx.execute(sql`
          UPDATE app.player_cards pc
          SET serial_id = concat('__serial_metadata_repair__', pc.id)
          FROM player_card_serial_repair_plan plan
          WHERE plan.id = pc.id
            AND pc.serial_id IS DISTINCT FROM plan.serial_id
        `);
        await tx.execute(sql`
          UPDATE app.player_cards pc
          SET serial_id = plan.serial_id,
              max_supply = plan.max_supply
          FROM player_card_serial_repair_plan plan
          WHERE plan.id = pc.id
            AND (
              pc.serial_id IS DISTINCT FROM plan.serial_id
              OR pc.max_supply IS DISTINCT FROM plan.max_supply
            )
        `);
      }

      await tx.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS player_cards_player_rarity_serial_unique
        ON app.player_cards (player_id, rarity, serial_number)
        WHERE serial_number IS NOT NULL
      `);
      await tx.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS player_cards_serial_id_unique
        ON app.player_cards (serial_id)
        WHERE serial_id IS NOT NULL AND serial_id <> ''
      `);

      await tx.execute(sql`
        CREATE OR REPLACE FUNCTION app.enforce_player_card_serial_supply()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
          supply_limit integer;
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

          IF supply_limit <= 0 THEN
            RAISE EXCEPTION 'Unsupported card rarity %', NEW.rarity
              USING ERRCODE = '23514';
          END IF;

          -- The counter row is permanent mint history. Deleting/transferring a card never lowers it.
          INSERT INTO app.player_card_serial_counters (
            player_id, rarity, last_serial_number, max_supply, updated_at
          ) VALUES (
            NEW.player_id, NEW.rarity::text, 1, supply_limit, now()
          )
          ON CONFLICT (player_id, rarity) DO UPDATE
          SET last_serial_number = app.player_card_serial_counters.last_serial_number + 1,
              max_supply = excluded.max_supply,
              updated_at = now()
          RETURNING last_serial_number INTO next_serial;

          IF next_serial > supply_limit THEN
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

      await tx.execute(sql`
        CREATE OR REPLACE FUNCTION app.prevent_player_card_mint_identity_change()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.player_id IS DISTINCT FROM OLD.player_id
             OR NEW.rarity IS DISTINCT FROM OLD.rarity
             OR NEW.serial_number IS DISTINCT FROM OLD.serial_number
             OR NEW.serial_id IS DISTINCT FROM OLD.serial_id
             OR NEW.max_supply IS DISTINCT FROM OLD.max_supply THEN
            RAISE EXCEPTION 'Mint identity is immutable for player card %', OLD.id
              USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
      await tx.execute(sql`DROP TRIGGER IF EXISTS player_cards_mint_identity_guard ON app.player_cards`);
      await tx.execute(sql`
        CREATE TRIGGER player_cards_mint_identity_guard
        BEFORE UPDATE OF player_id, rarity, serial_number, serial_id, max_supply ON app.player_cards
        FOR EACH ROW EXECUTE FUNCTION app.prevent_player_card_mint_identity_change()
      `);

      return { repairedCount };
    }).catch((error) => {
      serialSchemaReady = null;
      throw error;
    });
  }

  return await serialSchemaReady!;
}
