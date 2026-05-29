-- Card Not Found diagnostics and safe repair helpers
-- Use this after taking a production database backup.
-- Start with SELECTs only. Only run UPDATE/DELETE sections after reviewing results.

BEGIN;

-- 1) Marketplace/listing records that reference missing cards.
SELECT 'broken_marketplace_card' AS issue,
       l.*
FROM app.marketplace_listings l
LEFT JOIN app.player_cards pc ON pc.id = l.card_id
WHERE pc.id IS NULL;

-- 2) Player cards listed for sale but owner/listing data no longer matches.
SELECT 'marketplace_owner_mismatch' AS issue,
       l.id AS listing_id,
       l.card_id,
       l.seller_id AS listing_seller_id,
       pc.owner_id AS actual_card_owner_id,
       pc.for_sale,
       pc.price
FROM app.marketplace_listings l
JOIN app.player_cards pc ON pc.id = l.card_id
WHERE COALESCE(l.seller_id, '') <> COALESCE(pc.owner_id, '')
   OR pc.for_sale IS DISTINCT FROM true;

-- 3) Auctions that reference missing cards.
SELECT 'broken_auction_card' AS issue,
       a.*
FROM app.auctions a
LEFT JOIN app.player_cards pc ON pc.id = a.card_id
WHERE pc.id IS NULL;

-- 4) Tournament entries where a prize card id points nowhere.
SELECT 'broken_prize_card' AS issue,
       ce.id AS entry_id,
       ce.competition_id,
       ce.user_id,
       ce.rank,
       ce.prize_card_id
FROM app.competition_entries ce
LEFT JOIN app.player_cards pc ON pc.id = ce.prize_card_id
WHERE ce.prize_card_id IS NOT NULL
  AND pc.id IS NULL;

-- 5) Tournament reward claims where the claimed card no longer exists.
SELECT 'broken_reward_claim_card' AS issue,
       crc.*
FROM app.competition_reward_claims crc
LEFT JOIN app.player_cards pc ON pc.id = crc.card_id
WHERE crc.card_id IS NOT NULL
  AND pc.id IS NULL;

-- 6) Lineups with card IDs that no longer exist.
-- This assumes lineups.card_ids is json/jsonb array of card ids.
SELECT 'broken_lineup_card' AS issue,
       l.user_id,
       broken.card_id
FROM app.lineups l
CROSS JOIN LATERAL jsonb_array_elements_text(l.card_ids::jsonb) AS broken(card_id)
LEFT JOIN app.player_cards pc ON pc.id = broken.card_id::int
WHERE pc.id IS NULL;

-- 7) Competition entry lineups with card IDs that no longer exist.
SELECT 'broken_competition_lineup_card' AS issue,
       ce.id AS entry_id,
       ce.competition_id,
       ce.user_id,
       broken.card_id
FROM app.competition_entries ce
CROSS JOIN LATERAL jsonb_array_elements_text(ce.lineup_card_ids::jsonb) AS broken(card_id)
LEFT JOIN app.player_cards pc ON pc.id = broken.card_id::int
WHERE pc.id IS NULL;

-- 8) Summary counts.
SELECT
  (SELECT COUNT(*) FROM app.marketplace_listings l LEFT JOIN app.player_cards pc ON pc.id = l.card_id WHERE pc.id IS NULL) AS broken_marketplace_listings,
  (SELECT COUNT(*) FROM app.auctions a LEFT JOIN app.player_cards pc ON pc.id = a.card_id WHERE pc.id IS NULL) AS broken_auctions,
  (SELECT COUNT(*) FROM app.competition_entries ce LEFT JOIN app.player_cards pc ON pc.id = ce.prize_card_id WHERE ce.prize_card_id IS NOT NULL AND pc.id IS NULL) AS broken_prize_cards,
  (SELECT COUNT(*) FROM app.competition_reward_claims crc LEFT JOIN app.player_cards pc ON pc.id = crc.card_id WHERE crc.card_id IS NOT NULL AND pc.id IS NULL) AS broken_reward_claim_cards;

-- SAFE REPAIR OPTIONS
-- Review all SELECT outputs before running these.

-- A) Remove marketplace listings that reference missing cards.
-- DELETE FROM app.marketplace_listings l
-- WHERE NOT EXISTS (SELECT 1 FROM app.player_cards pc WHERE pc.id = l.card_id);

-- B) Reset cards that are flagged for sale but have no active listing.
-- UPDATE app.player_cards pc
-- SET for_sale = false,
--     price = NULL
-- WHERE pc.for_sale = true
--   AND NOT EXISTS (SELECT 1 FROM app.marketplace_listings l WHERE l.card_id = pc.id);

-- C) Clear broken prize card ids so reward repair can regenerate them.
-- UPDATE app.competition_entries ce
-- SET prize_card_id = NULL
-- WHERE ce.prize_card_id IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM app.player_cards pc WHERE pc.id = ce.prize_card_id);

-- D) Remove reward claims that point to missing cards so users can claim repaired rewards again.
-- DELETE FROM app.competition_reward_claims crc
-- WHERE crc.card_id IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM app.player_cards pc WHERE pc.id = crc.card_id);

-- E) Clear saved lineup cards if they point to deleted/legacy cards.
-- UPDATE app.lineups
-- SET card_ids = '[]'::jsonb,
--     captain_id = NULL
-- WHERE EXISTS (
--   SELECT 1
--   FROM jsonb_array_elements_text(app.lineups.card_ids::jsonb) AS broken(card_id)
--   LEFT JOIN app.player_cards pc ON pc.id = broken.card_id::int
--   WHERE pc.id IS NULL
-- );

-- Keep rollback active by default.
-- Change to COMMIT only after you confirm the repair statements are correct.
ROLLBACK;
