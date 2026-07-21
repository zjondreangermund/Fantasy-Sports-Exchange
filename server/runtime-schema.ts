import { sql } from "drizzle-orm";
import { db } from "./db.js";
import { ensureCompetitionCancellationSchema } from "./services/competitionCancellation.js";
import { ensureAuctionEscrowSchema } from "./services/auctionEscrow.js";
import { ensureDepositVerificationSchema } from "./services/depositVerificationSchema.js";
import { ensureWithdrawalPayoutSchema } from "./services/withdrawalPayoutSchema.js";
import { ensurePlayerCardSerialIntegrity } from "./services/playerCardSerials.js";
import { ensureWalletPostingSchema } from "./services/walletPostingSchema.js";

export async function ensureRuntimeSchema() {
  // External-money flows read the extended ledger and withdrawal columns. Prepare those
  // prerequisites first, and fail startup if verification or payout integrity cannot load.
  await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS gross_amount real DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS fee_amount real DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS net_amount real DEFAULT 0`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS source_type text DEFAULT ''`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS destination_key text`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS destination_verified boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS verification_token text`);
  await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS release_after timestamp`);
  await ensureDepositVerificationSchema();
  await ensureWithdrawalPayoutSchema();
  await ensureWalletPostingSchema();

  // Seeding runs only after this function completes. Canonicalize serials here so
  // legacy duplicate or missing values cannot crash the seed path first.
  const serialResult = await ensurePlayerCardSerialIntegrity();
  if (serialResult.repairedCount > 0) {
    console.log(`Canonicalized ${serialResult.repairedCount} player card serial records.`);
  }

  try {
    await ensureCompetitionCancellationSchema();
    await ensureAuctionEscrowSchema();
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS auction_escrow_one_held_per_auction_unique ON app.auction_escrow_holds (auction_id) WHERE status = 'held'`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS auctions_one_active_per_card_unique ON app.auctions (card_id) WHERE status IN ('draft', 'live')`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app.idempotency_keys (
        key text PRIMARY KEY,
        user_id varchar(255) NOT NULL REFERENCES app.users(id),
        created_at timestamp DEFAULT now(),
        expires_at timestamp
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx ON app.idempotency_keys (expires_at) WHERE expires_at IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_logs_marketplace_purchase_idempotency_idx ON app.audit_logs (user_id, (meta ->> 'idempotencyKey')) WHERE action = 'marketplace.purchase.completed'`);
  } catch (error) {
    console.warn("Runtime schema check failed:", error);
  }
}
