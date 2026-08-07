import pg from "pg";

const { Client } = pg;

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function resolveEnumSchema(client, enumName) {
  const result = await client.query(
    `SELECT n.nspname AS enum_schema
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = $1
        AND t.typtype = 'e'
      ORDER BY CASE WHEN n.nspname = 'app' THEN 0 WHEN n.nspname = 'public' THEN 1 ELSE 2 END
      LIMIT 1`,
    [enumName],
  );
  return String(result.rows?.[0]?.enum_schema || "");
}

async function ensureEnumValues(client, enumName, values) {
  const enumSchema = await resolveEnumSchema(client, enumName);
  if (!enumSchema) {
    throw new Error(`Base schema is missing the ${enumName} enum; database schema push must complete before startup`);
  }
  const qualifiedType = `${quoteIdentifier(enumSchema)}.${quoteIdentifier(enumName)}`;
  for (const value of values) {
    await client.query(`ALTER TYPE ${qualifiedType} ADD VALUE IF NOT EXISTS '${String(value).replace(/'/g, "''")}'`);
  }
  console.log(`Prepared enum ${enumSchema}.${enumName}`);
}

async function ensureCompetitionMultiEntrySchema(client) {
  const tableResult = await client.query(`select to_regclass('app.competition_entries') as table_name`);
  if (!tableResult.rows?.[0]?.table_name) {
    console.log("Tournament multi-entry preflight skipped: app.competition_entries does not exist yet.");
    return;
  }

  await client.query(`ALTER TABLE app.competition_entries ADD COLUMN IF NOT EXISTS entry_fee_paid real NOT NULL DEFAULT 0`);
  await client.query(`ALTER TABLE app.competition_entries DROP CONSTRAINT IF EXISTS competition_entries_competition_user_uq`);
  await client.query(`ALTER TABLE app.competition_entries DROP CONSTRAINT IF EXISTS competition_entries_competition_id_user_id_key`);
  await client.query(`DROP INDEX IF EXISTS app.competition_entries_competition_user_uq`);
  await client.query(`DROP INDEX IF EXISTS app.competition_entries_competition_id_user_id_key`);
  const backfill = await client.query(`
    UPDATE app.competition_entries ce
    SET entry_fee_paid = coalesce(c.entry_fee, 0)
    FROM app.competitions c
    WHERE c.id = ce.competition_id
      AND coalesce(ce.entry_fee_paid, 0) = 0
      AND coalesce(c.entry_fee, 0) > 0
  `);
  console.log(`Prepared tournament entries for multiple teams and backfilled ${Number(backfill.rowCount || 0)} entry-fee snapshots.`);
}

async function ensureTournamentPrizeAwards(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app.competition_prize_awards (
      id bigserial PRIMARY KEY,
      competition_id integer NOT NULL,
      entry_id integer NOT NULL,
      user_id varchar(255) NOT NULL,
      game_week integer NOT NULL,
      rarity text NOT NULL,
      prize_key text NOT NULL,
      prize_title text NOT NULL,
      prize_value real NOT NULL DEFAULT 0,
      prize_category text,
      status text NOT NULL DEFAULT 'pending_claim',
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (competition_id, entry_id)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS competition_prize_awards_user_idx ON app.competition_prize_awards (user_id, created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS competition_prize_awards_status_idx ON app.competition_prize_awards (status, created_at DESC)`);
  console.log("Prepared durable tournament prize-award records.");
}

async function ensurePlayerCardSerials(client) {
  const tableResult = await client.query(`select to_regclass('app.player_cards') as table_name`);
  if (!tableResult.rows?.[0]?.table_name) {
    console.log("Player-card serial preflight skipped: app.player_cards does not exist yet.");
    return 0;
  }

  await client.query("BEGIN");
  try {
    await client.query(`
      ALTER TABLE app.player_cards
        ADD COLUMN IF NOT EXISTS serial_id text,
        ADD COLUMN IF NOT EXISTS serial_number integer,
        ADD COLUMN IF NOT EXISTS max_supply integer DEFAULT 0
    `);
    await client.query(`
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
    await client.query(`
      ALTER TABLE app.player_card_serial_counters
      DROP CONSTRAINT IF EXISTS player_card_serial_counters_player_id_fkey
    `);

    // Allow controlled one-time metadata repair if a previous boot installed immutability already.
    await client.query(`DROP TRIGGER IF EXISTS player_cards_mint_identity_guard ON app.player_cards`);
    await client.query(`LOCK TABLE app.player_cards IN SHARE ROW EXCLUSIVE MODE`);

    // Import the highest serial still present without ever lowering an existing permanent counter.
    await client.query(`
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

    const impossibleMissing = await client.query(`
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
    `);
    if (impossibleMissing.rows?.length) {
      const row = impossibleMissing.rows[0];
      throw new Error(`Cannot repair missing serials for player ${row.player_id}, rarity ${row.rarity}: supply cap would be exceeded`);
    }

    // Missing legacy serials get NEW numbers above all numbers already used. Existing numbers stay untouched.
    await client.query(`
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

    // Capture any fresh legacy assignments in the durable mint ledger.
    await client.query(`
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

    await client.query(`DROP TABLE IF EXISTS pg_temp.player_card_serial_repair_plan`);
    await client.query(`
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

    const mismatchResult = await client.query(`
      SELECT count(*)::int AS count
      FROM app.player_cards pc
      JOIN player_card_serial_repair_plan plan ON plan.id = pc.id
      WHERE pc.serial_id IS DISTINCT FROM plan.serial_id
         OR pc.max_supply IS DISTINCT FROM plan.max_supply
    `);
    const repairedCount = Number(mismatchResult.rows?.[0]?.count || 0);

    if (repairedCount > 0) {
      await client.query(`
        UPDATE app.player_cards pc
        SET serial_id = concat('__serial_metadata_repair__', pc.id)
        FROM player_card_serial_repair_plan plan
        WHERE plan.id = pc.id
          AND pc.serial_id IS DISTINCT FROM plan.serial_id
      `);
      await client.query(`
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

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS player_cards_player_rarity_serial_unique
      ON app.player_cards (player_id, rarity, serial_number)
      WHERE serial_number IS NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS player_cards_serial_id_unique
      ON app.player_cards (serial_id)
      WHERE serial_id IS NOT NULL AND serial_id <> ''
    `);

    await client.query(`
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
    await client.query(`DROP TRIGGER IF EXISTS player_cards_serial_supply_guard ON app.player_cards`);
    await client.query(`
      CREATE TRIGGER player_cards_serial_supply_guard
      BEFORE INSERT ON app.player_cards
      FOR EACH ROW EXECUTE FUNCTION app.enforce_player_card_serial_supply()
    `);

    await client.query(`
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
    await client.query(`DROP TRIGGER IF EXISTS player_cards_mint_identity_guard ON app.player_cards`);
    await client.query(`
      CREATE TRIGGER player_cards_mint_identity_guard
      BEFORE UPDATE OF player_id, rarity, serial_number, serial_id, max_supply ON app.player_cards
      FOR EACH ROW EXECUTE FUNCTION app.prevent_player_card_mint_identity_change()
    `);

    await client.query("COMMIT");
    return repairedCount;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await ensureEnumValues(client, "competition_tier", ["common", "rare", "unique", "epic", "legendary"]);
    await ensureEnumValues(client, "withdrawal_status", ["pending", "approved", "paid", "rejected", "failed"]);
    await ensureCompetitionMultiEntrySchema(client);
    await ensureTournamentPrizeAwards(client);
    const repairedCount = await ensurePlayerCardSerials(client);
    console.log(`Runtime startup preflight complete. Repaired ${repairedCount} player-card serial metadata records without renumbering existing mints.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Runtime startup preflight failed:", error);
  process.exitCode = 1;
});
