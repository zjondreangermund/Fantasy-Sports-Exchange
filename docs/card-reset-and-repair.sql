-- Card reset and broken-reference repair guide
-- Use this only after backing up production.
-- Goal: remove old user-owned cards/listings/lineups that point to obsolete card records,
-- then allow the current card generation/onboarding flow to issue fresh cards.

BEGIN;

-- 1) Inspect old/broken references first.
SELECT 'player_cards' AS table_name, COUNT(*) AS rows FROM app.player_cards;
SELECT 'lineups' AS table_name, COUNT(*) AS rows FROM app.lineups;
SELECT 'auctions' AS table_name, COUNT(*) AS rows FROM app.auctions;
SELECT 'swap_offers' AS table_name, COUNT(*) AS rows FROM app.swap_offers;
SELECT 'competition_entries' AS table_name, COUNT(*) AS rows FROM app.competition_entries;

-- Broken competition prize cards.
SELECT ce.id, ce.competition_id, ce.user_id, ce.prize_card_id
FROM app.competition_entries ce
LEFT JOIN app.player_cards pc ON pc.id = ce.prize_card_id
WHERE ce.prize_card_id IS NOT NULL AND pc.id IS NULL;

-- Broken auction cards.
SELECT a.id, a.card_id, a.seller_user_id, a.status
FROM app.auctions a
LEFT JOIN app.player_cards pc ON pc.id = a.card_id
WHERE pc.id IS NULL;

-- Broken swap cards.
SELECT s.id, s.offered_card_id, s.requested_card_id, s.status
FROM app.swap_offers s
LEFT JOIN app.player_cards offered ON offered.id = s.offered_card_id
LEFT JOIN app.player_cards requested ON requested.id = s.requested_card_id
WHERE offered.id IS NULL OR requested.id IS NULL;

-- 2) Soft-clean records that reference old cards.
DELETE FROM app.card_locks;
DELETE FROM app.auction_bids WHERE auction_id IN (SELECT id FROM app.auctions);
DELETE FROM app.auctions;
DELETE FROM app.swap_offers;

-- 3) Clear saved lineups and tournament card references.
-- Keeps tournament entry history and scores, but removes obsolete card IDs.
UPDATE app.lineups SET card_ids = '[]'::jsonb, captain_id = NULL;
UPDATE app.competition_entries SET lineup_card_ids = '[]'::jsonb, captain_id = NULL, prize_card_id = NULL;

-- 4) Remove old user-owned cards.
-- Keeps player master data intact.
DELETE FROM app.player_cards;

-- 5) Reset onboarding so users can receive/select current cards again.
UPDATE app.user_onboarding
SET completed = false,
    pack_cards = '[]'::jsonb,
    selected_cards = '[]'::jsonb;

-- 6) Verify clean state.
SELECT 'player_cards_after' AS table_name, COUNT(*) AS rows FROM app.player_cards;
SELECT 'lineups_after' AS table_name, COUNT(*) AS rows FROM app.lineups;
SELECT 'auctions_after' AS table_name, COUNT(*) AS rows FROM app.auctions;
SELECT 'swap_offers_after' AS table_name, COUNT(*) AS rows FROM app.swap_offers;

-- If the results look correct, COMMIT. Otherwise ROLLBACK.
-- COMMIT;
ROLLBACK;
