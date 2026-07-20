-- Durable auction escrow ownership and recovery metadata.
ALTER TABLE app.auctions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancelled_by varchar(255),
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS settled_at timestamp,
  ADD COLUMN IF NOT EXISTS settlement_error text,
  ADD COLUMN IF NOT EXISTS settlement_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_completed_at timestamp;

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
);

CREATE INDEX IF NOT EXISTS auction_escrow_holds_auction_status_idx
  ON app.auction_escrow_holds (auction_id, status, id);

CREATE INDEX IF NOT EXISTS auction_escrow_holds_bidder_status_idx
  ON app.auction_escrow_holds (bidder_user_id, status, id);

CREATE UNIQUE INDEX IF NOT EXISTS auction_escrow_one_held_per_auction_unique
  ON app.auction_escrow_holds (auction_id)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS auctions_card_status_idx
  ON app.auctions (card_id, status, id);

CREATE UNIQUE INDEX IF NOT EXISTS auctions_one_active_per_card_unique
  ON app.auctions (card_id)
  WHERE status IN ('draft', 'live');

CREATE INDEX IF NOT EXISTS card_locks_auction_ref_idx
  ON app.card_locks (reason, ref_id)
  WHERE reason = 'transfer_pending';

CREATE UNIQUE INDEX IF NOT EXISTS auction_escrow_transaction_external_id_unique
  ON app.transactions (external_transaction_id)
  WHERE source_type IN ('auction_bid_lock', 'auction_bid_release', 'auction_settlement', 'auction_sale')
    AND external_transaction_id IS NOT NULL;
