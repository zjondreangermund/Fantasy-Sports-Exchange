import { sql } from "drizzle-orm";
import { db } from "../db.js";

let auctionEscrowSchemaReady: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function auctionLockRef(auctionId: number) {
  return `auction:${auctionId}`;
}

function operationKey(userId: string, auctionId: number, operation: string, rawKey?: unknown, amount?: number) {
  const supplied = String(rawKey ?? "").trim().slice(0, 120);
  if (supplied) return `${userId}:auction:${auctionId}:${operation}:${supplied}`;
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `${userId}:auction:${auctionId}:${operation}:${toMoney(amount || 0)}:${bucket}`;
}

export async function ensureAuctionEscrowSchema(): Promise<void> {
  if (!auctionEscrowSchemaReady) {
    auctionEscrowSchemaReady = (async () => {
      await db.execute(sql`
        ALTER TABLE app.auctions
          ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
          ADD COLUMN IF NOT EXISTS cancelled_by varchar(255),
          ADD COLUMN IF NOT EXISTS cancellation_reason text,
          ADD COLUMN IF NOT EXISTS settled_at timestamp,
          ADD COLUMN IF NOT EXISTS settlement_error text,
          ADD COLUMN IF NOT EXISTS settlement_attempts integer NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS recovery_completed_at timestamp
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.auction_escrow_holds (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          auction_id integer NOT NULL REFERENCES app.auctions(id) ON DELETE RESTRICT,
          bid_id integer UNIQUE REFERENCES app.auction_bids(id) ON DELETE RESTRICT,
          bidder_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          amount real NOT NULL CHECK (amount > 0),
          status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'settled')),
          legacy boolean NOT NULL DEFAULT false,
          hold_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          release_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          settlement_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now(),
          released_at timestamp,
          settled_at timestamp
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS auction_escrow_holds_auction_status_idx ON app.auction_escrow_holds (auction_id, status, id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS auction_escrow_holds_bidder_status_idx ON app.auction_escrow_holds (bidder_user_id, status, id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS auctions_card_status_idx ON app.auctions (card_id, status, id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS card_locks_auction_ref_idx ON app.card_locks (reason, ref_id) WHERE reason = 'transfer_pending'`);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS auction_escrow_transaction_external_id_unique
        ON app.transactions (external_transaction_id)
        WHERE source_type IN ('auction_bid_lock', 'auction_bid_release', 'auction_settlement', 'auction_sale')
          AND external_transaction_id IS NOT NULL
      `);
    })().catch((error) => {
      auctionEscrowSchemaReady = null;
      throw error;
    });
  }
  await auctionEscrowSchemaReady;
}

async function claimIdempotencyKey(tx: any, input: { key: string; userId: string; action: string; auctionId: number }) {
  const claimed = rowsOf(await tx.execute(sql`
    INSERT INTO app.idempotency_keys (key, user_id, created_at, expires_at)
    VALUES (${input.key}, ${input.userId}, now(), now() + interval '24 hours')
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `))[0];
  if (claimed) return null;

  const existing = rowsOf(await tx.execute(sql`
    SELECT meta
    FROM app.audit_logs
    WHERE user_id = ${input.userId}
      AND action = ${input.action}
      AND meta ->> 'idempotencyKey' = ${input.key}
      AND meta ->> 'auctionId' = ${String(input.auctionId)}
    ORDER BY id DESC
    LIMIT 1
  `))[0];
  if (existing?.meta) return typeof existing.meta === "string" ? JSON.parse(existing.meta) : existing.meta;
  throw new Error("Auction operation is already being processed");
}

async function insertLedger(tx: any, input: {
  userId: string;
  type: string;
  amount: number;
  grossAmount: number;
  feeAmount?: number;
  netAmount: number;
  sourceType: string;
  description: string;
  externalTransactionId: string;
}) {
  const inserted = rowsOf(await tx.execute(sql`
    INSERT INTO app.transactions
      (user_id, type, amount, gross_amount, fee_amount, net_amount, source_type, status, description, external_transaction_id)
    VALUES
      (${input.userId}, CAST(${input.type} AS app.transaction_type), ${toMoney(input.amount)}, ${toMoney(input.grossAmount)},
       ${toMoney(input.feeAmount || 0)}, ${toMoney(input.netAmount)}, ${input.sourceType}, 'completed',
       ${input.description}, ${input.externalTransactionId})
    ON CONFLICT DO NOTHING
    RETURNING id
  `))[0];
  if (inserted?.id) return Number(inserted.id);

  const existing = rowsOf(await tx.execute(sql`
    SELECT id FROM app.transactions
    WHERE external_transaction_id = ${input.externalTransactionId}
    LIMIT 1
  `))[0];
  if (!existing?.id) throw new Error("Failed to write auction ledger transaction");
  return Number(existing.id);
}

async function getAuctionForUpdate(tx: any, auctionId: number) {
  return rowsOf(await tx.execute(sql`
    SELECT a.*, a.status::text AS status
    FROM app.auctions a
    WHERE a.id = ${auctionId}
    FOR UPDATE
  `))[0] || null;
}

async function getWinningBid(tx: any, auctionId: number) {
  return rowsOf(await tx.execute(sql`
    SELECT b.*
    FROM app.auction_bids b
    WHERE b.auction_id = ${auctionId}
    ORDER BY b.amount DESC, b.created_at ASC, b.id ASC
    LIMIT 1
  `))[0] || null;
}

async function getHoldForBid(tx: any, bidId: number) {
  return rowsOf(await tx.execute(sql`
    SELECT * FROM app.auction_escrow_holds
    WHERE bid_id = ${bidId}
    FOR UPDATE
  `))[0] || null;
}

async function ensureAuctionCardLock(tx: any, auction: any) {
  const conflicting = rowsOf(await tx.execute(sql`
    SELECT id, reason::text AS reason, ref_id
    FROM app.card_locks
    WHERE card_id = ${Number(auction.card_id)}
      AND (expires_at IS NULL OR expires_at > now())
      AND NOT (reason = 'transfer_pending' AND ref_id = ${auctionLockRef(Number(auction.id))})
    LIMIT 1
  `))[0];
  if (conflicting) throw new Error("Auction card is locked by another operation");

  await tx.execute(sql`
    INSERT INTO app.card_locks (card_id, user_id, reason, ref_id, created_at)
    SELECT ${Number(auction.card_id)}, ${String(auction.seller_user_id)}, 'transfer_pending', ${auctionLockRef(Number(auction.id))}, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM app.card_locks
      WHERE card_id = ${Number(auction.card_id)}
        AND reason = 'transfer_pending'
        AND ref_id = ${auctionLockRef(Number(auction.id))}
        AND (expires_at IS NULL OR expires_at > now())
    )
  `);
}

async function releaseAuctionCardLock(tx: any, auctionId: number) {
  return rowsOf(await tx.execute(sql`
    DELETE FROM app.card_locks
    WHERE reason = 'transfer_pending' AND ref_id = ${auctionLockRef(auctionId)}
    RETURNING id
  `)).length;
}

async function transferAuctionCard(tx: any, auction: any, buyerId: string) {
  const card = rowsOf(await tx.execute(sql`
    SELECT id, owner_id
    FROM app.player_cards
    WHERE id = ${Number(auction.card_id)}
    FOR UPDATE
  `))[0];
  if (!card || String(card.owner_id || "") !== String(auction.seller_user_id || "")) {
    const releasedLocks = await releaseAuctionCardLock(tx, Number(auction.id));
    return { transferred: false, releasedLocks };
  }

  const releasedLocks = await releaseAuctionCardLock(tx, Number(auction.id));
  const transferred = rowsOf(await tx.execute(sql`
    UPDATE app.player_cards
    SET owner_id = ${buyerId}, for_sale = false, price = 0
    WHERE id = ${Number(auction.card_id)} AND owner_id = ${String(auction.seller_user_id)}
    RETURNING id
  `))[0];
  return { transferred: Boolean(transferred), releasedLocks };
}

async function releaseHold(tx: any, hold: any, reason: string) {
  const fresh = rowsOf(await tx.execute(sql`
    SELECT * FROM app.auction_escrow_holds
    WHERE id = ${Number(hold.id)}
    FOR UPDATE
  `))[0];
  if (!fresh || String(fresh.status) !== "held") return { released: false, amount: 0, holdId: Number(hold.id) };

  const amount = toMoney(fresh.amount);
  const userId = String(fresh.bidder_user_id || "");
  const wallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets
    SET balance = balance + ${amount}, locked_balance = locked_balance - ${amount}
    WHERE user_id = ${userId} AND locked_balance >= ${amount}
    RETURNING user_id
  `))[0];
  if (!wallet) throw new Error(`Auction escrow wallet mismatch for bidder ${userId}`);

  const transactionId = await insertLedger(tx, {
    userId,
    type: "auction_bid_release",
    amount,
    grossAmount: amount,
    netAmount: amount,
    sourceType: "auction_bid_release",
    description: `Auction hold released auction:${fresh.auction_id} hold:${fresh.id} reason:${reason}`,
    externalTransactionId: `auction:${fresh.auction_id}:hold:${fresh.id}:release`,
  });
  await tx.execute(sql`
    UPDATE app.auction_escrow_holds
    SET status = 'released', release_transaction_id = ${transactionId}, released_at = now(), updated_at = now()
    WHERE id = ${Number(fresh.id)}
  `);
  return { released: true, amount, holdId: Number(fresh.id), userId };
}

async function releaseHeldHolds(tx: any, auctionId: number, reason: string, exceptHoldId?: number) {
  const holds = rowsOf(await tx.execute(sql`
    SELECT * FROM app.auction_escrow_holds
    WHERE auction_id = ${auctionId}
      AND status = 'held'
      AND (${exceptHoldId || 0} = 0 OR id <> ${exceptHoldId || 0})
    ORDER BY id
    FOR UPDATE
  `));
  let releasedCount = 0;
  let releasedTotal = 0;
  for (const hold of holds) {
    const released = await releaseHold(tx, hold, reason);
    if (released.released) {
      releasedCount += 1;
      releasedTotal = toMoney(releasedTotal + released.amount);
    }
  }
  return { releasedCount, releasedTotal };
}

async function createHeldBid(tx: any, auction: any, bidderId: string, amount: number) {
  const wallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets
    SET balance = balance - ${amount}, locked_balance = locked_balance + ${amount}
    WHERE user_id = ${bidderId} AND balance >= ${amount}
    RETURNING user_id
  `))[0];
  if (!wallet) throw new Error("Insufficient available balance for bid");

  const bid = rowsOf(await tx.execute(sql`
    INSERT INTO app.auction_bids (auction_id, bidder_user_id, amount, created_at)
    VALUES (${Number(auction.id)}, ${bidderId}, ${amount}, now())
    RETURNING *
  `))[0];
  if (!bid?.id) throw new Error("Failed to create auction bid");

  const hold = rowsOf(await tx.execute(sql`
    INSERT INTO app.auction_escrow_holds (auction_id, bid_id, bidder_user_id, amount, status, legacy, created_at, updated_at)
    VALUES (${Number(auction.id)}, ${Number(bid.id)}, ${bidderId}, ${amount}, 'held', false, now(), now())
    RETURNING *
  `))[0];
  if (!hold?.id) throw new Error("Failed to create auction escrow hold");

  const transactionId = await insertLedger(tx, {
    userId: bidderId,
    type: "auction_bid_lock",
    amount: -amount,
    grossAmount: amount,
    netAmount: -amount,
    sourceType: "auction_bid_lock",
    description: `Auction bid hold auction:${auction.id} bid:${bid.id} hold:${hold.id}`,
    externalTransactionId: `auction:${auction.id}:hold:${hold.id}:lock`,
  });
  await tx.execute(sql`UPDATE app.auction_escrow_holds SET hold_transaction_id = ${transactionId} WHERE id = ${Number(hold.id)}`);
  return { bid, hold };
}

async function settleWinningHold(tx: any, input: { auction: any; hold: any; winnerId: string; sellerId: string; amount: number }) {
  const amount = toMoney(input.amount);
  const fresh = rowsOf(await tx.execute(sql`
    SELECT * FROM app.auction_escrow_holds
    WHERE id = ${Number(input.hold.id)}
    FOR UPDATE
  `))[0];
  if (!fresh || String(fresh.status) !== "held") throw new Error("Winning bid escrow is not held");

  const winnerWallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets
    SET locked_balance = locked_balance - ${amount}
    WHERE user_id = ${input.winnerId} AND locked_balance >= ${amount}
    RETURNING user_id
  `))[0];
  if (!winnerWallet) throw new Error("Winning bidder funds are not locked");

  const fee = toMoney(amount * 0.08);
  const sellerReceives = toMoney(amount - fee);
  await tx.execute(sql`
    INSERT INTO app.wallets (user_id, balance, locked_balance)
    VALUES (${input.sellerId}, 0, 0)
    ON CONFLICT (user_id) DO NOTHING
  `);
  const sellerWallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets SET balance = balance + ${sellerReceives}
    WHERE user_id = ${input.sellerId}
    RETURNING user_id
  `))[0];
  if (!sellerWallet) throw new Error("Auction seller wallet not found");

  const buyerTransactionId = await insertLedger(tx, {
    userId: input.winnerId,
    type: "auction_settlement",
    amount: 0,
    grossAmount: amount,
    netAmount: 0,
    sourceType: "auction_settlement",
    description: `Auction escrow settled auction:${input.auction.id} card:${input.auction.card_id} buyer:${input.winnerId} seller:${input.sellerId}`,
    externalTransactionId: `auction:${input.auction.id}:hold:${fresh.id}:settlement`,
  });
  await insertLedger(tx, {
    userId: input.sellerId,
    type: "auction_sale",
    amount: sellerReceives,
    grossAmount: amount,
    feeAmount: fee,
    netAmount: sellerReceives,
    sourceType: "auction_sale",
    description: `Auction sale auction:${input.auction.id} card:${input.auction.card_id} buyer:${input.winnerId} seller:${input.sellerId}`,
    externalTransactionId: `auction:${input.auction.id}:seller:${input.sellerId}:sale`,
  });
  await tx.execute(sql`
    UPDATE app.auction_escrow_holds
    SET status = 'settled', settlement_transaction_id = ${buyerTransactionId}, settled_at = now(), updated_at = now()
    WHERE id = ${Number(fresh.id)}
  `);
  return { amount, fee, sellerReceives };
}

async function missingLegacyBidCount(tx: any, auctionId: number) {
  const row = rowsOf(await tx.execute(sql`
    SELECT count(*)::int AS count
    FROM app.auction_bids b
    LEFT JOIN app.auction_escrow_holds h ON h.bid_id = b.id
    WHERE b.auction_id = ${auctionId} AND h.id IS NULL
  `))[0];
  return Number(row?.count || 0);
}

export async function listActiveAuctions() {
  await ensureAuctionEscrowSchema();
  const result = await db.execute(sql`
    SELECT a.id, a.card_id AS "cardId", a.seller_user_id AS "sellerUserId", a.status::text AS status,
      a.reserve_price::float AS "reservePrice", a.start_price::float AS "startPrice",
      a.buy_now_price::float AS "buyNowPrice", a.min_increment::float AS "minIncrement",
      a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.created_at AS "createdAt",
      pc.rarity::text AS rarity, pc.serial_id AS "serialId", pc.owner_id AS "ownerId",
      p.id AS "playerId", p.name AS "playerName", p.team, p.position::text AS position, p.image_url AS "imageUrl",
      coalesce(max(b.amount), a.start_price, 0)::float AS "currentBid", count(b.id)::int AS "bidCount"
    FROM app.auctions a
    JOIN app.player_cards pc ON pc.id = a.card_id
    JOIN app.players p ON p.id = pc.player_id
    LEFT JOIN app.auction_bids b ON b.auction_id = a.id
    WHERE a.status = 'live' AND (a.starts_at IS NULL OR a.starts_at <= now()) AND (a.ends_at IS NULL OR a.ends_at > now())
    GROUP BY a.id, pc.id, p.id
    ORDER BY a.ends_at ASC NULLS LAST, a.id DESC
  `);
  return rowsOf(result).map((row: any) => ({
    ...row,
    card: {
      id: Number(row.cardId), rarity: row.rarity, serialId: row.serialId, ownerId: row.ownerId,
      player: { id: Number(row.playerId), name: row.playerName, team: row.team, position: row.position, imageUrl: row.imageUrl },
    },
  }));
}

export async function getAuctionDetails(auctionId: number) {
  await ensureAuctionEscrowSchema();
  const auction = rowsOf(await db.execute(sql`
    SELECT a.id, a.card_id AS "cardId", a.seller_user_id AS "sellerUserId", a.status::text AS status,
      a.reserve_price::float AS "reservePrice", a.start_price::float AS "startPrice",
      a.buy_now_price::float AS "buyNowPrice", a.min_increment::float AS "minIncrement",
      a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.created_at AS "createdAt",
      a.cancelled_at AS "cancelledAt", a.cancellation_reason AS "cancellationReason",
      a.settled_at AS "settledAt", a.settlement_error AS "settlementError",
      pc.rarity::text AS rarity, pc.serial_id AS "serialId", pc.owner_id AS "ownerId",
      p.id AS "playerId", p.name AS "playerName", p.team, p.position::text AS position, p.image_url AS "imageUrl"
    FROM app.auctions a
    JOIN app.player_cards pc ON pc.id = a.card_id
    JOIN app.players p ON p.id = pc.player_id
    WHERE a.id = ${auctionId}
    LIMIT 1
  `))[0];
  if (!auction) return null;
  const bids = rowsOf(await db.execute(sql`
    SELECT b.id, b.bidder_user_id AS "bidderUserId", b.amount::float, b.created_at AS "createdAt",
      coalesce(u.manager_team_name, u.name, u.email, 'Bidder') AS "bidderName"
    FROM app.auction_bids b
    LEFT JOIN app.users u ON u.id = b.bidder_user_id
    WHERE b.auction_id = ${auctionId}
    ORDER BY b.amount DESC, b.created_at ASC, b.id ASC
  `));
  return {
    ...auction,
    bids,
    currentBid: bids.length ? toMoney(bids[0].amount) : toMoney(auction.startPrice),
    bidCount: bids.length,
    card: {
      id: Number(auction.cardId), rarity: auction.rarity, serialId: auction.serialId, ownerId: auction.ownerId,
      player: { id: Number(auction.playerId), name: auction.playerName, team: auction.team, position: auction.position, imageUrl: auction.imageUrl },
    },
  };
}

export async function createAuction(input: any) {
  await ensureAuctionEscrowSchema();
  const sellerId = String(input?.sellerId || "");
  const cardId = Number(input?.cardId);
  const startPrice = toMoney(input?.startPrice);
  const reservePrice = toMoney(input?.reservePrice || 0);
  const buyNowPrice = input?.buyNowPrice == null ? null : toMoney(input.buyNowPrice);
  const minIncrement = Math.max(0.01, toMoney(input?.minIncrement || 1));
  const startsAt = input?.startsAt ? new Date(String(input.startsAt)) : new Date();
  const endsAt = input?.endsAt ? new Date(String(input.endsAt)) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (!sellerId || !Number.isInteger(cardId) || cardId <= 0 || startPrice <= 0) throw new Error("Valid auction seller, card and start price required");
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new Error("Valid auction dates required");
  if (buyNowPrice != null && buyNowPrice < startPrice) throw new Error("Buy-now price cannot be below the start price");

  return db.transaction(async (tx) => {
    const card = rowsOf(await tx.execute(sql`
      SELECT id, owner_id, for_sale, rarity::text AS rarity
      FROM app.player_cards WHERE id = ${cardId} FOR UPDATE
    `))[0];
    if (!card) throw new Error("Card not found");
    if (String(card.owner_id || "") !== sellerId) throw new Error("You do not own this card");
    if (Boolean(card.for_sale)) throw new Error("Remove the card from the marketplace before auctioning it");
    if (String(card.rarity || "") === "common") throw new Error("Common cards cannot be auctioned");

    const existing = rowsOf(await tx.execute(sql`
      SELECT id FROM app.auctions
      WHERE card_id = ${cardId} AND status IN ('draft', 'live')
      LIMIT 1 FOR UPDATE
    `))[0];
    if (existing) throw new Error("Card already has an active auction");

    const auction = rowsOf(await tx.execute(sql`
      INSERT INTO app.auctions
        (card_id, seller_user_id, status, reserve_price, start_price, buy_now_price, min_increment, starts_at, ends_at, created_at)
      VALUES
        (${cardId}, ${sellerId}, 'live', ${reservePrice}, ${startPrice}, ${buyNowPrice}, ${minIncrement}, ${startsAt}, ${endsAt}, now())
      RETURNING *
    `))[0];
    await ensureAuctionCardLock(tx, auction);
    const meta = { auctionId: Number(auction.id), cardId, startPrice, reservePrice, buyNowPrice, minIncrement };
    await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${sellerId}, 'auction.created', ${JSON.stringify(meta)}::jsonb)`);
    return auction;
  });
}

export async function placeAuctionBid(input: any) {
  await ensureAuctionEscrowSchema();
  const auctionId = Number(input?.auctionId);
  const bidderId = String(input?.bidderId || "");
  const amount = toMoney(input?.amount);
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !bidderId || amount <= 0) throw new Error("Valid auction bid required");
  const idempotencyKey = operationKey(bidderId, auctionId, "bid", input?.idempotencyKey, amount);

  return db.transaction(async (tx) => {
    const duplicate = await claimIdempotencyKey(tx, { key: idempotencyKey, userId: bidderId, action: "auction.bid.accepted", auctionId });
    if (duplicate) return { ...duplicate, duplicate: true };

    const auction = await getAuctionForUpdate(tx, auctionId);
    if (!auction) throw new Error("Auction not found");
    if (String(auction.status) !== "live") throw new Error("Auction is not live");
    if (auction.starts_at && new Date(auction.starts_at).getTime() > Date.now()) throw new Error("Auction has not started");
    if (auction.ends_at && new Date(auction.ends_at).getTime() <= Date.now()) throw new Error("Auction has ended");
    if (String(auction.seller_user_id || "") === bidderId) throw new Error("You cannot bid on your own auction");

    const card = rowsOf(await tx.execute(sql`SELECT id, owner_id FROM app.player_cards WHERE id = ${Number(auction.card_id)} FOR UPDATE`))[0];
    if (!card || String(card.owner_id || "") !== String(auction.seller_user_id || "")) throw new Error("Auction card is no longer owned by the seller");
    await ensureAuctionCardLock(tx, auction);

    const winningBid = await getWinningBid(tx, auctionId);
    const currentAmount = winningBid ? toMoney(winningBid.amount) : 0;
    const minimum = winningBid ? toMoney(currentAmount + Number(auction.min_increment || 1)) : toMoney(auction.start_price || 0);
    if (amount < minimum) throw new Error(`Bid must be at least N$${minimum.toFixed(2)}`);

    if (winningBid) {
      const previousHold = await getHoldForBid(tx, Number(winningBid.id));
      if (!previousHold || String(previousHold.status) !== "held") throw new Error("Auction escrow requires admin recovery before another bid");
      await releaseHold(tx, previousHold, "outbid");
    }

    const created = await createHeldBid(tx, auction, bidderId, amount);
    const meta = { success: true, auctionId, bidId: Number(created.bid.id), holdId: Number(created.hold.id), bidderId, amount, idempotencyKey };
    await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${bidderId}, 'auction.bid.accepted', ${JSON.stringify(meta)}::jsonb)`);
    return { ...meta, duplicate: false };
  });
}

export async function buyAuctionNow(input: any) {
  await ensureAuctionEscrowSchema();
  const auctionId = Number(input?.auctionId);
  const buyerId = String(input?.buyerId || "");
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !buyerId) throw new Error("Valid auction purchase required");
  const idempotencyKey = operationKey(buyerId, auctionId, "buy-now", input?.idempotencyKey);

  return db.transaction(async (tx) => {
    const auction = await getAuctionForUpdate(tx, auctionId);
    if (!auction) throw new Error("Auction not found");
    if (String(auction.status) === "settled") {
      const card = rowsOf(await tx.execute(sql`SELECT owner_id FROM app.player_cards WHERE id = ${Number(auction.card_id)} LIMIT 1`))[0];
      if (String(card?.owner_id || "") === buyerId) return { success: true, auctionId, duplicate: true };
      throw new Error("Auction already settled");
    }
    if (String(auction.status) !== "live") throw new Error("Auction is not live");
    if (auction.ends_at && new Date(auction.ends_at).getTime() <= Date.now()) throw new Error("Auction has ended");
    if (String(auction.seller_user_id || "") === buyerId) throw new Error("You cannot buy your own auction");
    const price = toMoney(auction.buy_now_price || 0);
    if (price <= 0) throw new Error("Buy now is not available");

    const duplicate = await claimIdempotencyKey(tx, { key: idempotencyKey, userId: buyerId, action: "auction.buy_now.completed", auctionId });
    if (duplicate) return { ...duplicate, duplicate: true };
    if ((await missingLegacyBidCount(tx, auctionId)) > 0) throw new Error("Auction escrow requires admin recovery before buy now");

    await releaseHeldHolds(tx, auctionId, "buy_now_replaced");
    const created = await createHeldBid(tx, auction, buyerId, price);
    const transfer = await transferAuctionCard(tx, auction, buyerId);
    if (!transfer.transferred) {
      await releaseHold(tx, created.hold, "buy_now_transfer_failed");
      await tx.execute(sql`
        UPDATE app.auctions
        SET status = 'cancelled', cancelled_at = now(), cancelled_by = ${buyerId},
          cancellation_reason = 'Card transfer failed during buy now', settlement_error = 'Card unavailable for transfer', recovery_completed_at = now()
        WHERE id = ${auctionId}
      `);
      const meta = { auctionId, buyerId, price, releasedLocks: transfer.releasedLocks, idempotencyKey };
      await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${buyerId}, 'auction.buy_now.recovered_transfer_failure', ${JSON.stringify(meta)}::jsonb)`);
      return { success: false, recovered: true, auctionId, message: "Auction card was unavailable; held funds were returned" };
    }

    const settlement = await settleWinningHold(tx, { auction, hold: created.hold, winnerId: buyerId, sellerId: String(auction.seller_user_id), amount: price });
    await tx.execute(sql`
      UPDATE app.auctions
      SET status = 'settled', settled_at = now(), settlement_error = NULL, recovery_completed_at = now(), settlement_attempts = settlement_attempts + 1
      WHERE id = ${auctionId}
    `);
    const meta = { success: true, auctionId, buyerId, sellerId: String(auction.seller_user_id), cardId: Number(auction.card_id), price, fee: settlement.fee, sellerReceives: settlement.sellerReceives, releasedLocks: transfer.releasedLocks, idempotencyKey };
    await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${buyerId}, 'auction.buy_now.completed', ${JSON.stringify(meta)}::jsonb)`);
    return { ...meta, duplicate: false };
  });
}

export async function settleAuctionWithEscrowRecovery(input: any) {
  await ensureAuctionEscrowSchema();
  const auctionId = Number(input?.auctionId);
  const actorId = String(input?.actorId || "");
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !actorId) throw new Error("Valid auction settlement required");

  return db.transaction(async (tx) => {
    const auction = await getAuctionForUpdate(tx, auctionId);
    if (!auction) throw new Error("Auction not found");
    const status = String(auction.status || "");
    if (status === "settled") return { success: true, duplicate: true, auctionId, status };
    if (status === "cancelled") {
      const released = await releaseHeldHolds(tx, auctionId, "cancelled_reconciliation");
      const releasedLocks = await releaseAuctionCardLock(tx, auctionId);
      return { success: true, duplicate: true, auctionId, status, releasedLocks, ...released };
    }
    if (!["live", "ended"].includes(status)) throw new Error("Auction is not eligible for settlement");

    await tx.execute(sql`UPDATE app.auctions SET settlement_attempts = settlement_attempts + 1 WHERE id = ${auctionId}`);
    const winningBid = await getWinningBid(tx, auctionId);
    if (!winningBid) {
      const released = await releaseHeldHolds(tx, auctionId, "no_bids");
      const releasedLocks = await releaseAuctionCardLock(tx, auctionId);
      await tx.execute(sql`UPDATE app.auctions SET status = 'ended', settlement_error = NULL, recovery_completed_at = now() WHERE id = ${auctionId}`);
      const meta = { auctionId, releasedLocks, ...released };
      await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${actorId}, 'auction.settle.no_bids', ${JSON.stringify(meta)}::jsonb)`);
      return { success: true, auctionId, outcome: "no_bids", ...meta };
    }

    const winningAmount = toMoney(winningBid.amount);
    const reservePrice = toMoney(auction.reserve_price || 0);
    if (winningAmount < reservePrice) {
      const released = await releaseHeldHolds(tx, auctionId, "reserve_not_met");
      const releasedLocks = await releaseAuctionCardLock(tx, auctionId);
      await tx.execute(sql`UPDATE app.auctions SET status = 'ended', settlement_error = NULL, recovery_completed_at = now() WHERE id = ${auctionId}`);
      const meta = { auctionId, winningAmount, reservePrice, releasedLocks, ...released };
      await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${actorId}, 'auction.settle.reserve_not_met', ${JSON.stringify(meta)}::jsonb)`);
      return { success: true, auctionId, outcome: "reserve_not_met", ...meta };
    }

    const winningHold = await getHoldForBid(tx, Number(winningBid.id));
    if (!winningHold || String(winningHold.status) !== "held") {
      const released = await releaseHeldHolds(tx, auctionId, "missing_winning_escrow");
      const releasedLocks = await releaseAuctionCardLock(tx, auctionId);
      await tx.execute(sql`
        UPDATE app.auctions SET status = 'ended', settlement_error = 'Winning bid has no durable escrow hold', recovery_completed_at = NULL
        WHERE id = ${auctionId}
      `);
      const meta = { auctionId, winningBidId: Number(winningBid.id), winningAmount, releasedLocks, ...released };
      await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${actorId}, 'auction.settle.missing_escrow', ${JSON.stringify(meta)}::jsonb)`);
      return { success: false, recovered: true, auctionId, outcome: "missing_winning_escrow", ...meta };
    }

    const losingReleased = await releaseHeldHolds(tx, auctionId, "settlement_loser_release", Number(winningHold.id));
    const winnerId = String(winningBid.bidder_user_id || "");
    const sellerId = String(auction.seller_user_id || "");
    if (!winnerId || !sellerId) throw new Error("Auction winner or seller is invalid");

    const transfer = await transferAuctionCard(tx, auction, winnerId);
    if (!transfer.transferred) {
      const winnerReleased = await releaseHold(tx, winningHold, "settlement_transfer_failed");
      await tx.execute(sql`
        UPDATE app.auctions
        SET status = 'cancelled', cancelled_at = now(), cancelled_by = ${actorId},
          cancellation_reason = 'Card transfer failed during settlement', settlement_error = 'Card unavailable for transfer', recovery_completed_at = now()
        WHERE id = ${auctionId}
      `);
      const meta = { auctionId, winnerId, winningAmount, releasedLocks: transfer.releasedLocks, winnerReleased, ...losingReleased };
      await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${actorId}, 'auction.settle.recovered_transfer_failure', ${JSON.stringify(meta)}::jsonb)`);
      return { success: false, recovered: true, auctionId, outcome: "transfer_failed", ...meta };
    }

    const settlement = await settleWinningHold(tx, { auction, hold: winningHold, winnerId, sellerId, amount: winningAmount });
    await tx.execute(sql`UPDATE app.auctions SET status = 'settled', settled_at = now(), settlement_error = NULL, recovery_completed_at = now() WHERE id = ${auctionId}`);
    const meta = { auctionId, cardId: Number(auction.card_id), winnerId, sellerId, winningAmount, fee: settlement.fee, sellerReceives: settlement.sellerReceives, releasedLocks: transfer.releasedLocks, ...losingReleased };
    await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${actorId}, 'auction.settle.completed', ${JSON.stringify(meta)}::jsonb)`);
    return { success: true, auctionId, outcome: "settled", ...meta, ...settlement };
  });
}

export async function cancelAuctionWithEscrowRecovery(input: any) {
  await ensureAuctionEscrowSchema();
  const auctionId = Number(input?.auctionId);
  const actorId = String(input?.actorId || "");
  const ownerId = input?.ownerId ? String(input.ownerId) : "";
  const allowBids = Boolean(input?.allowBids);
  const reason = String(input?.reason || "Auction cancelled").trim().slice(0, 500) || "Auction cancelled";
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !actorId) throw new Error("Valid auction cancellation required");

  return db.transaction(async (tx) => {
    const auction = await getAuctionForUpdate(tx, auctionId);
    if (!auction || (ownerId && String(auction.seller_user_id || "") !== ownerId)) throw new Error("Auction not found");
    if (String(auction.status) === "settled") throw new Error("Settled auctions cannot be cancelled");

    const bidCount = Number(rowsOf(await tx.execute(sql`SELECT count(*)::int AS count FROM app.auction_bids WHERE auction_id = ${auctionId}`))[0]?.count || 0);
    if (bidCount > 0 && !allowBids && String(auction.status) !== "cancelled") throw new Error("Auctions with bids require admin cancellation");

    const released = await releaseHeldHolds(tx, auctionId, "auction_cancelled");
    const releasedLocks = await releaseAuctionCardLock(tx, auctionId);
    const legacyBidsWithoutHolds = await missingLegacyBidCount(tx, auctionId);
    const alreadyCancelled = String(auction.status) === "cancelled";
    await tx.execute(sql`
      UPDATE app.auctions
      SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), cancelled_by = coalesce(cancelled_by, ${actorId}),
        cancellation_reason = coalesce(cancellation_reason, ${reason}),
        settlement_error = CASE WHEN ${legacyBidsWithoutHolds} > 0 THEN 'Legacy bids exist without durable escrow records' ELSE NULL END,
        recovery_completed_at = CASE WHEN ${legacyBidsWithoutHolds} = 0 THEN now() ELSE recovery_completed_at END
      WHERE id = ${auctionId}
    `);
    const meta = { auctionId, bidCount, reason, releasedLocks, legacyBidsWithoutHolds, ...released };
    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${actorId}, ${alreadyCancelled ? "auction.cancellation.reconciled" : "auction.cancelled"}, ${JSON.stringify(meta)}::jsonb)
    `);
    return { success: true, auctionId, duplicate: alreadyCancelled && released.releasedCount === 0, ...meta };
  });
}

export async function getAuctionEscrowIntegrityReport(auctionId?: number) {
  await ensureAuctionEscrowSchema();
  const filter = Number.isInteger(Number(auctionId)) && Number(auctionId) > 0 ? Number(auctionId) : 0;
  const auctions = rowsOf(await db.execute(sql`
    SELECT a.id, a.card_id AS "cardId", a.seller_user_id AS "sellerId", a.status::text AS status,
      a.ends_at AS "endsAt", a.settlement_error AS "settlementError",
      coalesce(h.held_count, 0)::int AS "heldCount", coalesce(h.held_total, 0)::float AS "heldTotal",
      coalesce(m.missing_count, 0)::int AS "legacyBidsWithoutHolds", pc.owner_id AS "cardOwnerId"
    FROM app.auctions a
    LEFT JOIN app.player_cards pc ON pc.id = a.card_id
    LEFT JOIN (
      SELECT auction_id, count(*) FILTER (WHERE status = 'held') AS held_count,
        coalesce(sum(amount) FILTER (WHERE status = 'held'), 0) AS held_total
      FROM app.auction_escrow_holds GROUP BY auction_id
    ) h ON h.auction_id = a.id
    LEFT JOIN (
      SELECT b.auction_id, count(*) AS missing_count
      FROM app.auction_bids b LEFT JOIN app.auction_escrow_holds h2 ON h2.bid_id = b.id
      WHERE h2.id IS NULL GROUP BY b.auction_id
    ) m ON m.auction_id = a.id
    WHERE (${filter} = 0 OR a.id = ${filter})
    ORDER BY a.id DESC
  `));
  const walletDeficits = rowsOf(await db.execute(sql`
    SELECT h.bidder_user_id AS "userId", coalesce(sum(h.amount), 0)::float AS "auctionHeld",
      coalesce(w.locked_balance, 0)::float AS "walletLocked"
    FROM app.auction_escrow_holds h
    LEFT JOIN app.wallets w ON w.user_id = h.bidder_user_id
    WHERE h.status = 'held'
    GROUP BY h.bidder_user_id, w.locked_balance
    HAVING coalesce(w.locked_balance, 0) + 0.005 < coalesce(sum(h.amount), 0)
  `));

  const rows = auctions.map((auction: any) => {
    const flags = [
      ["cancelled", "ended", "settled"].includes(String(auction.status)) && Number(auction.heldCount || 0) > 0 ? "terminal_auction_has_held_funds" : null,
      String(auction.status) === "live" && auction.endsAt && new Date(auction.endsAt).getTime() <= Date.now() ? "expired_live_auction" : null,
      Number(auction.legacyBidsWithoutHolds || 0) > 0 ? "legacy_bid_without_escrow" : null,
      String(auction.status) === "settled" && String(auction.cardOwnerId || "") === String(auction.sellerId || "") ? "settled_card_not_transferred" : null,
      auction.settlementError ? "settlement_error" : null,
    ].filter(Boolean);
    return { ...auction, flags, status: flags.length ? "review" : "ok" };
  });
  return {
    summary: {
      auctionsChecked: rows.length,
      reviewAuctions: rows.filter((row: any) => row.status === "review").length,
      heldOnTerminalAuctions: rows.filter((row: any) => row.flags.includes("terminal_auction_has_held_funds")).length,
      expiredLiveAuctions: rows.filter((row: any) => row.flags.includes("expired_live_auction")).length,
      legacyBidsWithoutEscrow: rows.reduce((sum: number, row: any) => sum + Number(row.legacyBidsWithoutHolds || 0), 0),
      walletDeficits: walletDeficits.length,
    },
    rows,
    walletDeficits,
  };
}

export async function recoverAuctionEscrow(input: any) {
  await ensureAuctionEscrowSchema();
  const auctionId = Number(input?.auctionId);
  const actorId = String(input?.actorId || "");
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !actorId) throw new Error("Valid auction recovery required");

  const statusRow = rowsOf(await db.execute(sql`SELECT status::text AS status, ends_at FROM app.auctions WHERE id = ${auctionId} LIMIT 1`))[0];
  if (!statusRow) throw new Error("Auction not found");
  const status = String(statusRow.status || "");
  if (status === "live" && (!statusRow.ends_at || new Date(statusRow.ends_at).getTime() <= Date.now())) {
    return settleAuctionWithEscrowRecovery({ auctionId, actorId });
  }
  if (["cancelled", "ended", "settled"].includes(status)) {
    return db.transaction(async (tx) => {
      await getAuctionForUpdate(tx, auctionId);
      const winningBid = await getWinningBid(tx, auctionId);
      const winningHold = winningBid ? await getHoldForBid(tx, Number(winningBid.id)) : null;
      const exceptWinningHold = status === "settled" && winningHold && String(winningHold.status) === "held" ? Number(winningHold.id) : undefined;
      const released = await releaseHeldHolds(tx, auctionId, "admin_recovery", exceptWinningHold);
      const releasedLocks = await releaseAuctionCardLock(tx, auctionId);
      const legacyBidsWithoutHolds = await missingLegacyBidCount(tx, auctionId);
      const unresolvedWinningHold = exceptWinningHold ? 1 : 0;
      await tx.execute(sql`
        UPDATE app.auctions
        SET recovery_completed_at = CASE WHEN ${legacyBidsWithoutHolds + unresolvedWinningHold} = 0 THEN now() ELSE recovery_completed_at END,
          settlement_error = CASE
            WHEN ${unresolvedWinningHold} > 0 THEN 'Settled auction still has winning escrow held; manual ledger review required'
            WHEN ${legacyBidsWithoutHolds} > 0 THEN 'Legacy bids exist without durable escrow records'
            ELSE settlement_error
          END
        WHERE id = ${auctionId}
      `);
      const meta = { auctionId, status, releasedLocks, legacyBidsWithoutHolds, unresolvedWinningHold, ...released };
      await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${actorId}, 'auction.escrow.recovered', ${JSON.stringify(meta)}::jsonb)`);
      return { success: true, ...meta };
    });
  }
  return { success: true, auctionId, status, noOp: true, message: "Auction does not currently require automatic recovery" };
}
