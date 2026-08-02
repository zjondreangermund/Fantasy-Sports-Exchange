ALTER TABLE app.pack_auctions
  ADD COLUMN IF NOT EXISTS settled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE app.pack_auction_escrow_holds
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS released_at timestamp,
  ADD COLUMN IF NOT EXISTS settled_at timestamp,
  ADD COLUMN IF NOT EXISTS hold_transaction_id integer,
  ADD COLUMN IF NOT EXISTS release_transaction_id integer,
  ADD COLUMN IF NOT EXISTS settlement_transaction_id integer;

CREATE INDEX IF NOT EXISTS pack_auctions_status_end_idx
  ON app.pack_auctions (status, ends_at, id);

CREATE INDEX IF NOT EXISTS pack_auction_holds_status_idx
  ON app.pack_auction_escrow_holds (pack_auction_id, status, id);
