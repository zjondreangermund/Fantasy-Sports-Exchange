import { sql } from "drizzle-orm";
import { db } from "../db.js";

let packAuctionSchemaReady: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
}

function toMoney(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function packLockRef(auctionId: number) {
  return `pack-auction:${auctionId}`;
}

function validRarity(value: unknown) {
  const rarity = String(value || "").toLowerCase();
  return ["rare", "unique", "epic", "legendary"].includes(rarity) ? rarity : "";
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
  if (!existing?.id) throw new Error("Failed to write pack auction ledger transaction");
  return Number(existing.id);
}

export async function ensurePackAuctionSchema() {
  if (!packAuctionSchemaReady) {
    packAuctionSchemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.pack_auctions (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          seller_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          rarity text NOT NULL CHECK (rarity IN ('rare', 'unique', 'epic', 'legendary')),
          card_ids jsonb NOT NULL CHECK (jsonb_typeof(card_ids) = 'array' AND jsonb_array_length(card_ids) = 5),
          status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'settled', 'cancelled')),
          start_price real NOT NULL CHECK (start_price > 0),
          buy_now_price real,
          min_increment real NOT NULL DEFAULT 1 CHECK (min_increment > 0),
          starts_at timestamp NOT NULL DEFAULT now(),
          ends_at timestamp NOT NULL,
          settled_at timestamp,
          cancelled_at timestamp,
          cancellation_reason text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.pack_auction_bids (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          pack_auction_id integer NOT NULL REFERENCES app.pack_auctions(id) ON DELETE RESTRICT,
          bidder_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          amount real NOT NULL CHECK (amount > 0),
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.pack_auction_escrow_holds (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          pack_auction_id integer NOT NULL REFERENCES app.pack_auctions(id) ON DELETE RESTRICT,
          bid_id integer UNIQUE REFERENCES app.pack_auction_bids(id) ON DELETE RESTRICT,
          bidder_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          amount real NOT NULL CHECK (amount > 0),
          status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'settled')),
          hold_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          release_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          settlement_transaction_id integer UNIQUE REFERENCES app.transactions(id),
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now(),
          released_at timestamp,
          settled_at timestamp
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS pack_auctions_status_end_idx ON app.pack_auctions (status, ends_at, id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS pack_auction_bids_auction_amount_idx ON app.pack_auction_bids (pack_auction_id, amount DESC, created_at, id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS pack_auction_holds_status_idx ON app.pack_auction_escrow_holds (pack_auction_id, status, id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS card_locks_pack_auction_ref_idx ON app.card_locks (reason, ref_id) WHERE reason = 'transfer_pending'`);
    })().catch((error) => {
      packAuctionSchemaReady = null;
      throw error;
    });
  }
  await packAuctionSchemaReady;
}

async function getPackForUpdate(tx: any, auctionId: number) {
  return rowsOf(await tx.execute(sql`
    SELECT id, seller_user_id, rarity, card_ids, status, start_price, buy_now_price,
      min_increment, starts_at, ends_at, settled_at, cancelled_at
    FROM app.pack_auctions
    WHERE id = ${auctionId}
    FOR UPDATE
  `))[0] || null;
}

async function getWinningBid(tx: any, auctionId: number) {
  return rowsOf(await tx.execute(sql`
    SELECT b.*
    FROM app.pack_auction_bids b
    WHERE b.pack_auction_id = ${auctionId}
    ORDER BY b.amount DESC, b.created_at ASC, b.id ASC
    LIMIT 1
  `))[0] || null;
}

async function getHoldForBid(tx: any, bidId: number) {
  return rowsOf(await tx.execute(sql`
    SELECT * FROM app.pack_auction_escrow_holds
    WHERE bid_id = ${bidId}
    FOR UPDATE
  `))[0] || null;
}

async function releaseHold(tx: any, hold: any, reason: string) {
  const fresh = rowsOf(await tx.execute(sql`
    SELECT * FROM app.pack_auction_escrow_holds
    WHERE id = ${Number(hold.id)}
    FOR UPDATE
  `))[0];
  if (!fresh || String(fresh.status) !== "held") return { released: false, amount: 0 };

  const amount = toMoney(fresh.amount);
  const userId = String(fresh.bidder_user_id || "");
  const wallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets
    SET balance = balance + ${amount}, locked_balance = locked_balance - ${amount}
    WHERE user_id = ${userId} AND locked_balance >= ${amount}
    RETURNING user_id
  `))[0];
  if (!wallet) throw new Error("Pack auction escrow wallet mismatch");

  const transactionId = await insertLedger(tx, {
    userId,
    type: "auction_bid_release",
    amount,
    grossAmount: amount,
    netAmount: amount,
    sourceType: "auction_bid_release",
    description: `Pack auction hold released pack:${fresh.pack_auction_id} hold:${fresh.id} reason:${reason}`,
    externalTransactionId: `pack-auction:${fresh.pack_auction_id}:hold:${fresh.id}:release`,
  });
  await tx.execute(sql`
    UPDATE app.pack_auction_escrow_holds
    SET status = 'released', release_transaction_id = ${transactionId}, released_at = now(), updated_at = now()
    WHERE id = ${Number(fresh.id)}
  `);
  return { released: true, amount };
}

async function releaseAllHeld(tx: any, auctionId: number, reason: string, exceptHoldId = 0) {
  const holds = rowsOf(await tx.execute(sql`
    SELECT * FROM app.pack_auction_escrow_holds
    WHERE pack_auction_id = ${auctionId} AND status = 'held'
      AND (${exceptHoldId} = 0 OR id <> ${exceptHoldId})
    ORDER BY id
    FOR UPDATE
  `));
  for (const hold of holds) await releaseHold(tx, hold, reason);
}

async function createHeldBid(tx: any, auctionId: number, bidderId: string, amount: number) {
  const wallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets
    SET balance = balance - ${amount}, locked_balance = locked_balance + ${amount}
    WHERE user_id = ${bidderId} AND balance >= ${amount}
    RETURNING user_id
  `))[0];
  if (!wallet) throw new Error("Insufficient available balance for bid");

  const bid = rowsOf(await tx.execute(sql`
    INSERT INTO app.pack_auction_bids (pack_auction_id, bidder_user_id, amount, created_at)
    VALUES (${auctionId}, ${bidderId}, ${amount}, now())
    RETURNING *
  `))[0];
  if (!bid?.id) throw new Error("Failed to create pack auction bid");

  const hold = rowsOf(await tx.execute(sql`
    INSERT INTO app.pack_auction_escrow_holds
      (pack_auction_id, bid_id, bidder_user_id, amount, status, created_at, updated_at)
    VALUES (${auctionId}, ${Number(bid.id)}, ${bidderId}, ${amount}, 'held', now(), now())
    RETURNING *
  `))[0];
  if (!hold?.id) throw new Error("Failed to create pack auction escrow hold");

  const transactionId = await insertLedger(tx, {
    userId: bidderId,
    type: "auction_bid_lock",
    amount: -amount,
    grossAmount: amount,
    netAmount: -amount,
    sourceType: "auction_bid_lock",
    description: `Pack auction bid hold pack:${auctionId} bid:${bid.id} hold:${hold.id}`,
    externalTransactionId: `pack-auction:${auctionId}:hold:${hold.id}:lock`,
  });
  await tx.execute(sql`UPDATE app.pack_auction_escrow_holds SET hold_transaction_id = ${transactionId} WHERE id = ${Number(hold.id)}`);
  return { bid, hold };
}

async function releasePackLocks(tx: any, auctionId: number) {
  return rowsOf(await tx.execute(sql`
    DELETE FROM app.card_locks
    WHERE reason = 'transfer_pending' AND ref_id = ${packLockRef(auctionId)}
    RETURNING id
  `)).length;
}

async function transferPackCards(tx: any, auction: any, buyerId: string) {
  const cardIds = Array.isArray(auction.card_ids) ? auction.card_ids.map(Number) : [];
  if (cardIds.length !== 5 || cardIds.some((id: number) => !Number.isInteger(id) || id <= 0)) {
    return { transferred: false, reason: "invalid_pack_card_ids" };
  }
  const idsJson = JSON.stringify(cardIds);
  const owned = rowsOf(await tx.execute(sql`
    WITH selected(card_id) AS (
      SELECT value::int FROM jsonb_array_elements_text(${idsJson}::jsonb)
    )
    SELECT pc.id
    FROM app.player_cards pc
    JOIN selected s ON s.card_id = pc.id
    WHERE pc.owner_id = ${String(auction.seller_user_id)}
    FOR UPDATE
  `));
  if (owned.length !== 5) return { transferred: false, reason: "seller_ownership_changed" };

  const conflict = rowsOf(await tx.execute(sql`
    WITH selected(card_id) AS (
      SELECT value::int FROM jsonb_array_elements_text(${idsJson}::jsonb)
    )
    SELECT cl.id
    FROM app.card_locks cl
    JOIN selected s ON s.card_id = cl.card_id
    WHERE (cl.expires_at IS NULL OR cl.expires_at > now())
      AND NOT (cl.reason = 'transfer_pending' AND cl.ref_id = ${packLockRef(Number(auction.id))})
    LIMIT 1
  `))[0];
  if (conflict) return { transferred: false, reason: "conflicting_card_lock" };

  await releasePackLocks(tx, Number(auction.id));
  const transferred = rowsOf(await tx.execute(sql`
    WITH selected(card_id) AS (
      SELECT value::int FROM jsonb_array_elements_text(${idsJson}::jsonb)
    )
    UPDATE app.player_cards pc
    SET owner_id = ${buyerId}, for_sale = false, price = 0
    FROM selected s
    WHERE pc.id = s.card_id AND pc.owner_id = ${String(auction.seller_user_id)}
    RETURNING pc.id
  `));
  return { transferred: transferred.length === 5, reason: transferred.length === 5 ? null : "guarded_transfer_failed" };
}

async function settleHold(tx: any, input: { auction: any; hold: any; winnerId: string; amount: number }) {
  const amount = toMoney(input.amount);
  const hold = rowsOf(await tx.execute(sql`
    SELECT * FROM app.pack_auction_escrow_holds
    WHERE id = ${Number(input.hold.id)}
    FOR UPDATE
  `))[0];
  if (!hold || String(hold.status) !== "held") throw new Error("Winning pack bid funds are not held");

  const winnerWallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets
    SET locked_balance = locked_balance - ${amount}
    WHERE user_id = ${input.winnerId} AND locked_balance >= ${amount}
    RETURNING user_id
  `))[0];
  if (!winnerWallet) throw new Error("Winning bidder funds are not locked");

  const sellerId = String(input.auction.seller_user_id);
  const fee = toMoney(amount * 0.08);
  const sellerReceives = toMoney(amount - fee);
  await tx.execute(sql`
    INSERT INTO app.wallets (user_id, balance, locked_balance)
    VALUES (${sellerId}, 0, 0)
    ON CONFLICT (user_id) DO NOTHING
  `);
  const sellerWallet = rowsOf(await tx.execute(sql`
    UPDATE app.wallets SET balance = balance + ${sellerReceives}
    WHERE user_id = ${sellerId}
    RETURNING user_id
  `))[0];
  if (!sellerWallet) throw new Error("Pack auction seller wallet not found");

  const buyerTransactionId = await insertLedger(tx, {
    userId: input.winnerId,
    type: "auction_settlement",
    amount: 0,
    grossAmount: amount,
    netAmount: 0,
    sourceType: "auction_settlement",
    description: `Five-card pack auction settled pack:${input.auction.id} buyer:${input.winnerId} seller:${sellerId}`,
    externalTransactionId: `pack-auction:${input.auction.id}:hold:${hold.id}:settlement`,
  });
  await insertLedger(tx, {
    userId: sellerId,
    type: "auction_sale",
    amount: sellerReceives,
    grossAmount: amount,
    feeAmount: fee,
    netAmount: sellerReceives,
    sourceType: "auction_sale",
    description: `Five-card pack auction sale pack:${input.auction.id} buyer:${input.winnerId}`,
    externalTransactionId: `pack-auction:${input.auction.id}:seller:${sellerId}:sale`,
  });
  await tx.execute(sql`
    UPDATE app.pack_auction_escrow_holds
    SET status = 'settled', settlement_transaction_id = ${buyerTransactionId}, settled_at = now(), updated_at = now()
    WHERE id = ${Number(hold.id)}
  `);
  return { amount, fee, sellerReceives };
}

export async function listActivePackAuctions() {
  await ensurePackAuctionSchema();
  const result = await db.execute(sql`
    SELECT pa.id, pa.seller_user_id AS "sellerUserId", pa.rarity, pa.status,
      pa.start_price::float AS "startPrice", pa.buy_now_price::float AS "buyNowPrice",
      pa.min_increment::float AS "minIncrement", pa.starts_at AS "startsAt", pa.ends_at AS "endsAt",
      coalesce(bid_data.current_bid, pa.start_price, 0)::float AS "currentBid",
      coalesce(bid_data.bid_count, 0)::int AS "bidCount",
      coalesce(card_data.cards, '[]'::jsonb) AS cards
    FROM app.pack_auctions pa
    LEFT JOIN LATERAL (
      SELECT max(b.amount)::float AS current_bid, count(*)::int AS bid_count
      FROM app.pack_auction_bids b
      WHERE b.pack_auction_id = pa.id
    ) bid_data ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pc.id,
          'rarity', pc.rarity::text,
          'serialId', pc.serial_id,
          'player', jsonb_build_object(
            'id', p.id, 'name', p.name, 'team', p.team,
            'position', p.position::text, 'imageUrl', p.image_url
          )
        ) ORDER BY ids.ord
      ) AS cards
      FROM jsonb_array_elements_text(pa.card_ids) WITH ORDINALITY ids(card_id, ord)
      JOIN app.player_cards pc ON pc.id = ids.card_id::int
      JOIN app.players p ON p.id = pc.player_id
    ) card_data ON true
    WHERE pa.status = 'live' AND pa.starts_at <= now() AND pa.ends_at > now()
    ORDER BY pa.ends_at ASC, pa.id DESC
  `);
  return rowsOf(result);
}

export async function createPackAuction(input: any) {
  await ensurePackAuctionSchema();
  const sellerId = String(input?.sellerId || "");
  const rarity = validRarity(input?.rarity);
  const startPrice = toMoney(input?.startPrice);
  const buyNowPrice = input?.buyNowPrice == null ? null : toMoney(input.buyNowPrice);
  const minIncrement = Math.max(1, toMoney(input?.minIncrement || 1));
  const startsAt = input?.startsAt ? new Date(String(input.startsAt)) : new Date();
  const endsAt = input?.endsAt ? new Date(String(input.endsAt)) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (!sellerId || !rarity || startPrice <= 0) throw new Error("Valid seller, rarity and start price required");
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new Error("Valid auction dates required");
  if (buyNowPrice != null && buyNowPrice > 0 && buyNowPrice < startPrice) throw new Error("Buy-now price cannot be below the start price");

  return db.transaction(async (tx) => {
    const cards = rowsOf(await tx.execute(sql`
      SELECT pc.id
      FROM app.player_cards pc
      WHERE pc.owner_id = ${sellerId}
        AND pc.rarity::text = ${rarity}
        AND pc.for_sale = false
        AND NOT EXISTS (
          SELECT 1 FROM app.card_locks cl
          WHERE cl.card_id = pc.id AND (cl.expires_at IS NULL OR cl.expires_at > now())
        )
        AND NOT EXISTS (
          SELECT 1 FROM app.auctions a
          WHERE a.card_id = pc.id AND a.status IN ('draft', 'live')
        )
      ORDER BY pc.acquired_at ASC NULLS LAST, pc.id ASC
      LIMIT 5
      FOR UPDATE SKIP LOCKED
    `));
    if (cards.length < 5) throw new Error(`You need 5 available ${rarity} cards to create this pack auction`);
    const cardIds = cards.map((card: any) => Number(card.id));
    const auction = rowsOf(await tx.execute(sql`
      INSERT INTO app.pack_auctions
        (seller_user_id, rarity, card_ids, status, start_price, buy_now_price, min_increment, starts_at, ends_at, created_at)
      VALUES
        (${sellerId}, ${rarity}, ${JSON.stringify(cardIds)}::jsonb, 'live', ${startPrice},
         ${buyNowPrice && buyNowPrice > 0 ? buyNowPrice : null}, ${minIncrement}, ${startsAt}, ${endsAt}, now())
      RETURNING *
    `))[0];
    if (!auction?.id) throw new Error("Failed to create pack auction");

    const lockRef = packLockRef(Number(auction.id));
    await tx.execute(sql`
      WITH selected(card_id) AS (
        SELECT value::int FROM jsonb_array_elements_text(${JSON.stringify(cardIds)}::jsonb)
      )
      INSERT INTO app.card_locks (card_id, user_id, reason, ref_id, created_at)
      SELECT card_id, ${sellerId}, 'transfer_pending', ${lockRef}, now()
      FROM selected
    `);
    const meta = { packAuctionId: Number(auction.id), rarity, cardIds, startPrice, buyNowPrice };
    await tx.execute(sql`INSERT INTO app.audit_logs (user_id, action, meta) VALUES (${sellerId}, 'pack_auction.created', ${JSON.stringify(meta)}::jsonb)`);
    return { ...auction, cardIds };
  });
}

export async function placePackAuctionBid(input: any) {
  await ensurePackAuctionSchema();
  const auctionId = Number(input?.auctionId);
  const bidderId = String(input?.bidderId || "");
  const amount = toMoney(input?.amount);
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !bidderId || amount <= 0) throw new Error("Valid pack auction bid required");

  return db.transaction(async (tx) => {
    const auction = await getPackForUpdate(tx, auctionId);
    if (!auction) throw new Error("Pack auction not found");
    if (String(auction.status) !== "live") throw new Error("Pack auction is not live");
    if (new Date(auction.starts_at).getTime() > Date.now()) throw new Error("Pack auction has not started");
    if (new Date(auction.ends_at).getTime() <= Date.now()) throw new Error("Pack auction has ended");
    if (String(auction.seller_user_id) === bidderId) throw new Error("You cannot bid on your own pack auction");

    const winningBid = await getWinningBid(tx, auctionId);
    const currentAmount = winningBid ? toMoney(winningBid.amount) : 0;
    const minimum = winningBid ? toMoney(currentAmount + Number(auction.min_increment || 1)) : toMoney(auction.start_price);
    if (amount < minimum) throw new Error(`Bid must be at least N$${minimum.toFixed(2)}`);

    if (winningBid) {
      const previousHold = await getHoldForBid(tx, Number(winningBid.id));
      if (!previousHold || String(previousHold.status) !== "held") throw new Error("Pack auction escrow requires admin review");
      await releaseHold(tx, previousHold, "outbid");
    }
    const created = await createHeldBid(tx, auctionId, bidderId, amount);
    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${bidderId}, 'pack_auction.bid.accepted', ${JSON.stringify({ auctionId, bidId: Number(created.bid.id), amount })}::jsonb)
    `);
    return { success: true, auctionId, bidId: Number(created.bid.id), amount };
  });
}

export async function buyPackAuctionNow(input: any) {
  await ensurePackAuctionSchema();
  const auctionId = Number(input?.auctionId);
  const buyerId = String(input?.buyerId || "");
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !buyerId) throw new Error("Valid pack auction purchase required");

  return db.transaction(async (tx) => {
    const auction = await getPackForUpdate(tx, auctionId);
    if (!auction) throw new Error("Pack auction not found");
    if (String(auction.status) !== "live") throw new Error("Pack auction is not live");
    if (new Date(auction.ends_at).getTime() <= Date.now()) throw new Error("Pack auction has ended");
    if (String(auction.seller_user_id) === buyerId) throw new Error("You cannot buy your own pack auction");
    const price = toMoney(auction.buy_now_price || 0);
    if (price <= 0) throw new Error("Buy now is not available");

    await releaseAllHeld(tx, auctionId, "buy_now_replaced");
    const created = await createHeldBid(tx, auctionId, buyerId, price);
    const transfer = await transferPackCards(tx, auction, buyerId);
    if (!transfer.transferred) {
      await releaseHold(tx, created.hold, "buy_now_transfer_failed");
      await releasePackLocks(tx, auctionId);
      await tx.execute(sql`
        UPDATE app.pack_auctions
        SET status = 'cancelled', cancelled_at = now(), cancellation_reason = ${`Card transfer failed: ${transfer.reason || "unknown"}`}
        WHERE id = ${auctionId}
      `);
      return { success: false, recovered: true, message: "Pack cards were unavailable; held funds were returned" };
    }

    const settlement = await settleHold(tx, { auction, hold: created.hold, winnerId: buyerId, amount: price });
    await tx.execute(sql`UPDATE app.pack_auctions SET status = 'settled', settled_at = now() WHERE id = ${auctionId}`);
    await tx.execute(sql`
      INSERT INTO app.notifications (user_id, type, title, message, read, created_at)
      VALUES (${buyerId}, 'system', 'Pack auction won', ${`Congratulations! You purchased the ${auction.rarity} five-card pack for N$${price.toFixed(2)}.`}, false, now())
    `);
    return { success: true, auctionId, price, ...settlement };
  });
}

export async function settlePackAuction(input: any) {
  await ensurePackAuctionSchema();
  const auctionId = Number(input?.auctionId);
  const actorId = String(input?.actorId || "");
  if (!Number.isInteger(auctionId) || auctionId <= 0 || !actorId) throw new Error("Valid pack auction settlement required");

  return db.transaction(async (tx) => {
    const auction = await getPackForUpdate(tx, auctionId);
    if (!auction) throw new Error("Pack auction not found");
    if (String(auction.status) === "settled") return { success: true, auctionId, duplicate: true };
    if (String(auction.status) !== "live") throw new Error("Pack auction is not live");
    if (new Date(auction.ends_at).getTime() > Date.now()) throw new Error("Pack auction has not ended");

    const winningBid = await getWinningBid(tx, auctionId);
    if (!winningBid) {
      await releasePackLocks(tx, auctionId);
      await tx.execute(sql`
        UPDATE app.pack_auctions SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Auction ended without bids'
        WHERE id = ${auctionId}
      `);
      return { success: true, auctionId, sold: false };
    }
    const winningHold = await getHoldForBid(tx, Number(winningBid.id));
    if (!winningHold || String(winningHold.status) !== "held") throw new Error("Pack auction escrow requires admin review");

    const winnerId = String(winningBid.bidder_user_id);
    const transfer = await transferPackCards(tx, auction, winnerId);
    if (!transfer.transferred) {
      await releaseAllHeld(tx, auctionId, "settlement_transfer_failed");
      await releasePackLocks(tx, auctionId);
      await tx.execute(sql`
        UPDATE app.pack_auctions
        SET status = 'cancelled', cancelled_at = now(), cancellation_reason = ${`Settlement transfer failed: ${transfer.reason || "unknown"}`}
        WHERE id = ${auctionId}
      `);
      return { success: false, recovered: true, message: "Pack transfer failed; held funds were returned" };
    }

    const amount = toMoney(winningBid.amount);
    const settlement = await settleHold(tx, { auction, hold: winningHold, winnerId, amount });
    await releaseAllHeld(tx, auctionId, "settlement_non_winner", Number(winningHold.id));
    await tx.execute(sql`UPDATE app.pack_auctions SET status = 'settled', settled_at = now() WHERE id = ${auctionId}`);
    await tx.execute(sql`
      INSERT INTO app.notifications (user_id, type, title, message, read, created_at)
      VALUES (${winnerId}, 'system', 'Pack auction won', ${`Congratulations! You won the ${auction.rarity} five-card pack for N$${amount.toFixed(2)}.`}, false, now())
    `);
    await tx.execute(sql`
      INSERT INTO app.audit_logs (user_id, action, meta)
      VALUES (${actorId}, 'pack_auction.settled', ${JSON.stringify({ auctionId, winnerId, amount })}::jsonb)
    `);
    return { success: true, auctionId, sold: true, winnerId, ...settlement };
  });
}
