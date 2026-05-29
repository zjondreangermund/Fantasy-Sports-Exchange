-- Non-destructive production integrity indexes.
-- Review current data before adding stricter constraints in later migrations.

CREATE INDEX IF NOT EXISTS transactions_user_created_idx
  ON app.transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_type_created_idx
  ON app.transactions (type, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_source_status_idx
  ON app.transactions (source_type, status);

CREATE INDEX IF NOT EXISTS competition_entries_competition_rank_idx
  ON app.competition_entries (competition_id, rank);

CREATE INDEX IF NOT EXISTS player_cards_owner_idx
  ON app.player_cards (owner_id);

CREATE INDEX IF NOT EXISTS player_cards_marketplace_idx
  ON app.player_cards (for_sale, rarity, price)
  WHERE for_sale = true;

CREATE INDEX IF NOT EXISTS player_cards_player_rarity_idx
  ON app.player_cards (player_id, rarity);

CREATE INDEX IF NOT EXISTS auctions_status_ends_idx
  ON app.auctions (status, ends_at);

CREATE INDEX IF NOT EXISTS auction_bids_auction_amount_idx
  ON app.auction_bids (auction_id, amount DESC);

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_created_idx
  ON app.withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS withdrawal_requests_status_release_idx
  ON app.withdrawal_requests (status, release_after);
