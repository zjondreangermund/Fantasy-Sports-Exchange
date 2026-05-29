-- Safety checks before adding strict uniqueness constraints.
-- Run these SELECTs in production before enabling the optional UNIQUE indexes below.

-- Duplicate wallet rows by user. Should return zero rows.
SELECT user_id, COUNT(*) AS duplicate_count
FROM app.wallets
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Duplicate competition entries. Should return zero rows.
SELECT competition_id, user_id, COUNT(*) AS duplicate_count
FROM app.competition_entries
GROUP BY competition_id, user_id
HAVING COUNT(*) > 1;

-- Duplicate reward claims by entry. Should return zero rows.
SELECT entry_id, COUNT(*) AS duplicate_count
FROM app.competition_reward_claims
GROUP BY entry_id
HAVING COUNT(*) > 1;

-- Duplicate non-empty card serials. Should return zero rows.
SELECT serial_id, COUNT(*) AS duplicate_count
FROM app.player_cards
WHERE serial_id IS NOT NULL AND serial_id <> ''
GROUP BY serial_id
HAVING COUNT(*) > 1;

-- Optional strict indexes. Apply only after the checks above return zero rows.
-- CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_uq ON app.wallets (user_id);
-- CREATE UNIQUE INDEX IF NOT EXISTS competition_entries_competition_user_uq ON app.competition_entries (competition_id, user_id);
-- CREATE UNIQUE INDEX IF NOT EXISTS competition_reward_claims_entry_id_uq ON app.competition_reward_claims (entry_id);
-- CREATE UNIQUE INDEX IF NOT EXISTS player_cards_serial_id_uq ON app.player_cards (serial_id) WHERE serial_id IS NOT NULL AND serial_id <> '';
