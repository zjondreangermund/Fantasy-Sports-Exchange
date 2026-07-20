-- Verified deposits must claim each external payment reference globally and credit wallets exactly once.
CREATE TABLE IF NOT EXISTS app.deposit_verifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id integer NOT NULL UNIQUE REFERENCES app.transactions(id) ON DELETE RESTRICT,
  reference_key text NOT NULL UNIQUE,
  external_transaction_id text NOT NULL,
  user_id varchar(255) NOT NULL REFERENCES app.users(id),
  gross_amount real NOT NULL CHECK (gross_amount > 0),
  fee_amount real NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount real NOT NULL CHECK (net_amount > 0),
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by varchar(255) REFERENCES app.users(id),
  reviewed_at timestamp,
  review_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deposit_verifications_status_created_idx
  ON app.deposit_verifications (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS deposit_verifications_user_created_idx
  ON app.deposit_verifications (user_id, created_at DESC, id DESC);

-- Prefer an already-completed payment as the canonical legacy claim. Pending duplicates are
-- rejected automatically; additional completed duplicates remain financially unchanged but are
-- relabelled for manual integrity review rather than silently hidden or reversed.
WITH ranked AS (
  SELECT
    t.id,
    upper(regexp_replace(trim(t.external_transaction_id), '\s+', '', 'g')) AS reference_key,
    row_number() OVER (
      PARTITION BY upper(regexp_replace(trim(t.external_transaction_id), '\s+', '', 'g'))
      ORDER BY CASE WHEN t.status::text = 'completed' OR t.source_type = 'deposit_verified' THEN 0 ELSE 1 END,
        t.created_at NULLS LAST, t.id
    ) AS reference_rank
  FROM app.transactions t
  WHERE t.type::text = 'deposit'
    AND nullif(trim(coalesce(t.external_transaction_id, '')), '') IS NOT NULL
)
UPDATE app.transactions t
SET status = CASE WHEN t.status::text = 'pending' THEN 'rejected' ELSE t.status END,
    source_type = 'deposit_duplicate_legacy',
    amount = CASE WHEN t.status::text = 'pending' THEN 0 ELSE t.amount END,
    description = concat(coalesce(t.description, 'Deposit verification'), ' | duplicate legacy reference requires review')
FROM ranked r
WHERE r.id = t.id
  AND r.reference_rank > 1;

WITH ranked AS (
  SELECT
    t.*,
    upper(regexp_replace(trim(t.external_transaction_id), '\s+', '', 'g')) AS reference_key,
    row_number() OVER (
      PARTITION BY upper(regexp_replace(trim(t.external_transaction_id), '\s+', '', 'g'))
      ORDER BY CASE WHEN t.status::text = 'completed' OR t.source_type = 'deposit_verified' THEN 0 ELSE 1 END,
        t.created_at NULLS LAST, t.id
    ) AS reference_rank
  FROM app.transactions t
  WHERE t.type::text = 'deposit'
    AND nullif(trim(coalesce(t.external_transaction_id, '')), '') IS NOT NULL
)
INSERT INTO app.deposit_verifications (
  transaction_id, reference_key, external_transaction_id, user_id,
  gross_amount, fee_amount, net_amount, payment_method, status, created_at, updated_at
)
SELECT
  r.id,
  r.reference_key,
  trim(r.external_transaction_id),
  r.user_id,
  greatest(coalesce(nullif(r.gross_amount, 0), abs(r.amount), 0), 0.01),
  greatest(coalesce(r.fee_amount, 0), 0),
  greatest(coalesce(nullif(r.net_amount, 0), nullif(r.gross_amount, 0), abs(r.amount), 0), 0.01),
  coalesce(nullif(trim(r.payment_method), ''), 'other'),
  CASE
    WHEN r.status::text = 'completed' OR r.source_type IN ('deposit_verified', 'deposit', 'admin_adjustment') THEN 'approved'
    WHEN r.status::text = 'rejected' OR r.source_type = 'deposit_rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  coalesce(r.created_at, now()),
  now()
FROM ranked r
WHERE r.reference_rank = 1
ON CONFLICT DO NOTHING;
