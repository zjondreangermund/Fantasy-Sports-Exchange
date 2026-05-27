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
  } catch (error) {
    console.warn("Runtime schema check failed:", error);
  }
}
