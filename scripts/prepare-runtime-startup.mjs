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

  await client.query(`ALTER TABLE app.competition_entries DROP CONSTRAINT IF EXISTS competition_entries_competition_user_uq`);
  await client.query(`ALTER TABLE app.competition_entries DROP CONSTRAINT IF EXISTS competition_entries_competition_id_user_id_key`);
  await client.query(`DROP INDEX IF EXISTS app.competition_entries_competition_user_uq`);
  await client.query(`DROP INDEX IF EXISTS app.competition_entries_competition_id_user_id_key`);
  console.log("Prepared tournament entries for multiple teams per user.");
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
    await client.query(`LOCK TABLE app.player_cards IN SHARE ROW EXCLUSIVE MODE`);
    await client.query(`DROP TABLE IF EXISTS pg_temp.player_card_serial_repair_plan`);
    await client.query(`
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

    const mismatchResult = await client.query(`
      SELECT count(*)::int AS count
      FROM app.player_cards pc
      JOIN player_card_serial_repair_plan plan ON plan.id = pc.id
      WHERE pc.serial_id IS DISTINCT FROM plan.serial_id
         OR pc.serial_number IS DISTINCT FROM plan.serial_number
         OR pc.max_supply IS DISTINCT FROM plan.max_supply
    `);
    const repairedCount = Number(mismatchResult.rows?.[0]?.count || 0);

    if (repairedCount > 0) {
      await client.query(`
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
      await client.query(`
        UPDATE app.player_cards pc
        SET serial_id = plan.serial_id,
            serial_number = plan.serial_number,
            max_supply = plan.max_supply
        FROM player_card_serial_repair_plan plan
        WHERE plan.id = pc.id
          AND pc.serial_id = concat('__serial_repair__', pc.id)
      `);
    }

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS player_cards_player_rarity_serial_unique
      ON app.player_cards (player_id, rarity, serial_number)
      WHERE serial_number IS NOT NULL
    `);
    await client.query(`
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
    await client.query(`DROP TRIGGER IF EXISTS player_cards_serial_supply_guard ON app.player_cards`);
    await client.query(`
      CREATE TRIGGER player_cards_serial_supply_guard
      BEFORE INSERT ON app.player_cards
      FOR EACH ROW EXECUTE FUNCTION app.enforce_player_card_serial_supply()
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
    const repairedCount = await ensurePlayerCardSerials(client);
    console.log(`Runtime startup preflight complete. Canonicalized ${repairedCount} player-card serial records.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Runtime startup preflight failed:", error);
  process.exitCode = 1;
});
