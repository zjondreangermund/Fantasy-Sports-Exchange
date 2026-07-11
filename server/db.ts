import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Older production databases were created before all five tournament rarities
// existed. Upgrade the existing PostgreSQL enum before any route can insert a
// Unique, Epic or Legendary tournament. The enum may live in either `app` or
// `public`, so discover its actual namespace instead of assuming one.
await pool.query(`
  DO $$
  DECLARE
    enum_schema text;
    enum_value text;
  BEGIN
    SELECT n.nspname
      INTO enum_schema
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'competition_tier'
     ORDER BY CASE WHEN n.nspname = 'app' THEN 0 WHEN n.nspname = 'public' THEN 1 ELSE 2 END
     LIMIT 1;

    IF enum_schema IS NOT NULL THEN
      FOREACH enum_value IN ARRAY ARRAY['common', 'rare', 'unique', 'epic', 'legendary']
      LOOP
        EXECUTE format(
          'ALTER TYPE %I.competition_tier ADD VALUE IF NOT EXISTS %L',
          enum_schema,
          enum_value
        );
      END LOOP;
    END IF;
  END
  $$;
`);

export const db = drizzle(pool, { schema });
