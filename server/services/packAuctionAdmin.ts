import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { ensurePackAuctionSchema } from "./packAuctionEscrow.js";

let runtimeSchemaReady: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function hasOwn(value: any, key: string) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

export async function ensurePackAuctionRuntimeSchema() {
  if (!runtimeSchemaReady) {
    runtimeSchemaReady = (async () => {
      await ensurePackAuctionSchema();
      await db.execute(sql`
        ALTER TABLE app.pack_auctions
          ADD COLUMN IF NOT EXISTS settled_at timestamp,
          ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
          ADD COLUMN IF NOT EXISTS cancellation_reason text
      `);
      await db.execute(sql`
        ALTER TABLE app.pack_auction_escrow_holds
          ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS released_at timestamp,
          ADD COLUMN IF NOT EXISTS settled_at timestamp,
          ADD COLUMN IF NOT EXISTS hold_transaction_id integer,
          ADD COLUMN IF NOT EXISTS release_transaction_id integer,
          ADD COLUMN IF NOT EXISTS settlement_transaction_id integer
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS pack_auctions_status_end_idx
        ON app.pack_auctions (status, ends_at, id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS pack_auction_holds_status_idx
        ON app.pack_auction_escrow_holds (pack_auction_id, status, id)
      `);
    })().catch((error) => {
      runtimeSchemaReady = null;
      throw error;
    });
  }
  await runtimeSchemaReady;
}

export async function updatePackAuction(input: any) {
  await ensurePackAuctionRuntimeSchema();
  const auctionId = Number(input?.auctionId);
  const actorId = String(input?.actorId || "");
  const durationHours = Number(input?.durationHours || 0);
  const endsAtInput = input?.endsAt ? new Date(String(input.endsAt)) : null;
  const startPriceProvided = hasOwn(input, "startPrice");
  const buyNowProvided = hasOwn(input, "buyNowPrice");
  const minIncrementProvided = hasOwn(input, "minIncrement");

  if (!Number.isInteger(auctionId) || auctionId <= 0 || !actorId) {
    throw new Error("Valid pack auction and administrator required");
  }

  let nextEndsAt: Date | null = null;
  if (durationHours > 0) {
    if (durationHours < 0.25 || durationHours > 720) {
      throw new Error("Auction duration must be between 15 minutes and 30 days");
    }
    nextEndsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
  } else if (endsAtInput) {
    if (!Number.isFinite(endsAtInput.getTime()) || endsAtInput.getTime() <= Date.now() + 60_000) {
      throw new Error("Auction end time must be in the future");
    }
    nextEndsAt = endsAtInput;
  }

  return db.transaction(async (tx) => {
    const auction = rowsOf(await tx.execute(sql`
      SELECT * FROM app.pack_auctions
      WHERE id = ${auctionId}
      FOR UPDATE
    `))[0];
    if (!auction) throw new Error("Pack auction not found");
    if (String(auction.status) !== "live") throw new Error("Only live pack auctions can be edited");

    const bidCount = Number(rowsOf(await tx.execute(sql`
      SELECT count(*)::int AS count
      FROM app.pack_auction_bids
      WHERE pack_auction_id = ${auctionId}
    `))[0]?.count || 0);

    if (bidCount > 0 && (startPriceProvided || buyNowProvided || minIncrementProvided)) {
      throw new Error("Only duration can be edited after bidding has started");
    }

    const currentStartPrice = toMoney(auction.start_price);
    const nextStartPrice = startPriceProvided ? toMoney(input.startPrice) : currentStartPrice;
    const nextBuyNowPrice = buyNowProvided
      ? (input.buyNowPrice == null || toMoney(input.buyNowPrice) <= 0 ? null : toMoney(input.buyNowPrice))
      : (auction.buy_now_price == null ? null : toMoney(auction.buy_now_price));
    const nextMinIncrement = minIncrementProvided ? toMoney(input.minIncrement) : toMoney(auction.min_increment || 1);

    if (nextStartPrice <= 0) throw new Error("Start price must be greater than zero");
    if (nextMinIncrement <= 0) throw new Error("Minimum increment must be greater than zero");
    if (nextBuyNowPrice != null && nextBuyNowPrice < nextStartPrice) {
      throw new Error("Buy-now price cannot be below the start price");
    }

    if (nextEndsAt) {
      await tx.execute(sql`UPDATE app.pack_auctions SET ends_at = ${nextEndsAt} WHERE id = ${auctionId}`);
    }
    if (bidCount === 0 && startPriceProvided) {
      await tx.execute(sql`UPDATE app.pack_auctions SET start_price = ${nextStartPrice} WHERE id = ${auctionId}`);
    }
    if (bidCount === 0 && buyNowProvided) {
      await tx.execute(sql`UPDATE app.pack_auctions SET buy_now_price = ${nextBuyNowPrice} WHERE id = ${auctionId}`);
    }
    if (bidCount === 0 && minIncrementProvided) {
      await tx.execute(sql`UPDATE app.pack_auctions SET min_increment = ${nextMinIncrement} WHERE id = ${auctionId}`);
    }

    const updated = rowsOf(await tx.execute(sql`
      SELECT id, seller_user_id AS "sellerUserId", rarity, status,
        start_price::float AS "startPrice", buy_now_price::float AS "buyNowPrice",
        min_increment::float AS "minIncrement", starts_at AS "startsAt", ends_at AS "endsAt"
      FROM app.pack_auctions
      WHERE id = ${auctionId}
    `))[0];

    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${actorId}, 'pack_auction.updated', ${JSON.stringify({
        auctionId,
        bidCount,
        durationHours: durationHours || null,
        endsAt: nextEndsAt?.toISOString() || null,
        startPrice: startPriceProvided ? nextStartPrice : null,
        buyNowPrice: buyNowProvided ? nextBuyNowPrice : undefined,
        minIncrement: minIncrementProvided ? nextMinIncrement : null,
      })}::jsonb)
    `);

    return { success: true, auction: updated, bidCount };
  });
}

export async function cancelPackAuction(input: any) {
  await ensurePackAuctionRuntimeSchema();
  const auctionId = Number(input?.auctionId);
  const actorId = String(input?.actorId || "");
  const reason = String(input?.reason || "Removed by administrator").trim().slice(0, 500);
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !actorId) {
    throw new Error("Valid pack auction and administrator required");
  }

  return db.transaction(async (tx) => {
    const auction = rowsOf(await tx.execute(sql`
      SELECT * FROM app.pack_auctions
      WHERE id = ${auctionId}
      FOR UPDATE
    `))[0];
    if (!auction) throw new Error("Pack auction not found");
    if (String(auction.status) === "cancelled") {
      return { success: true, auctionId, duplicate: true, refundedBids: 0 };
    }
    if (String(auction.status) === "settled") throw new Error("Settled pack auctions cannot be deleted");

    const missingHolds = Number(rowsOf(await tx.execute(sql`
      SELECT count(*)::int AS count
      FROM app.pack_auction_bids b
      LEFT JOIN app.pack_auction_escrow_holds h ON h.bid_id = b.id
      WHERE b.pack_auction_id = ${auctionId} AND h.id IS NULL
    `))[0]?.count || 0);
    if (missingHolds > 0) throw new Error("Pack auction escrow requires admin review before deletion");

    const holds = rowsOf(await tx.execute(sql`
      SELECT * FROM app.pack_auction_escrow_holds
      WHERE pack_auction_id = ${auctionId} AND status = 'held'
      ORDER BY id
      FOR UPDATE
    `));

    let refundedTotal = 0;
    for (const hold of holds) {
      const amount = toMoney(hold.amount);
      const bidderId = String(hold.bidder_user_id || "");
      const wallet = rowsOf(await tx.execute(sql`
        UPDATE app.wallets
        SET balance = balance + ${amount}, locked_balance = locked_balance - ${amount}
        WHERE user_id = ${bidderId} AND locked_balance >= ${amount}
        RETURNING user_id
      `))[0];
      if (!wallet) throw new Error("Pack auction escrow wallet mismatch");

      const externalId = `pack-auction:${auctionId}:hold:${Number(hold.id)}:admin-delete-release`;
      const transaction = rowsOf(await tx.execute(sql`
        INSERT INTO app.transactions
          (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description, external_transaction_id)
        VALUES
          (${bidderId}, CAST('auction_bid_release' AS app.transaction_type), ${amount}, ${amount}, 0, ${amount},
           'auction_bid_release', 'completed', ${`Pack auction ${auctionId} cancelled by admin; escrow returned`}, ${externalId})
        ON CONFLICT DO NOTHING
        RETURNING id
      `))[0] || rowsOf(await tx.execute(sql`
        SELECT id FROM app.transactions WHERE external_transaction_id = ${externalId} LIMIT 1
      `))[0];
      if (!transaction?.id) throw new Error("Failed to record pack auction refund");

      await tx.execute(sql`
        UPDATE app.pack_auction_escrow_holds
        SET status = 'released', release_transaction_id = ${Number(transaction.id)}, released_at = now(), updated_at = now()
        WHERE id = ${Number(hold.id)}
      `);
      refundedTotal = toMoney(refundedTotal + amount);
    }

    await tx.execute(sql`
      DELETE FROM app.card_locks
      WHERE reason = 'transfer_pending' AND ref_id = ${`pack-auction:${auctionId}`}
    `);
    await tx.execute(sql`
      UPDATE app.pack_auctions
      SET status = 'cancelled', cancelled_at = now(), cancellation_reason = ${reason}
      WHERE id = ${auctionId}
    `);
    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${actorId}, 'pack_auction.cancelled', ${JSON.stringify({
        auctionId,
        reason,
        refundedBids: holds.length,
        refundedTotal,
      })}::jsonb)
    `);

    return { success: true, auctionId, refundedBids: holds.length, refundedTotal };
  });
}
