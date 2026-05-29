-- User-created tournament support.
-- Adds private PIN tournaments and explicit platform-fee tracking.

ALTER TABLE app.competitions
ADD COLUMN IF NOT EXISTS created_by_user_id varchar(255) REFERENCES app.users(id),
ADD COLUMN IF NOT EXISTS join_pin text,
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
ADD COLUMN IF NOT EXISTS max_entries integer,
ADD COLUMN IF NOT EXISTS platform_fee_rate real NOT NULL DEFAULT 0.20,
ADD COLUMN IF NOT EXISTS platform_fee_total real NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_pool_total real NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS competitions_join_pin_unique_idx
ON app.competitions (join_pin)
WHERE join_pin IS NOT NULL AND join_pin <> '';

CREATE INDEX IF NOT EXISTS competitions_created_by_user_idx
ON app.competitions (created_by_user_id);

CREATE INDEX IF NOT EXISTS competitions_visibility_status_idx
ON app.competitions (visibility, status);
