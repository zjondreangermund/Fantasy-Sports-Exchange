-- Competition cancellations must refund every entry exactly once while preserving ledger history.
ALTER TYPE app.competition_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE app.competition_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE app.transaction_type ADD VALUE IF NOT EXISTS 'tournament_refund';

ALTER TABLE app.competition_entries
  ADD COLUMN IF NOT EXISTS entry_fee_paid real NOT NULL DEFAULT 0;

UPDATE app.competition_entries ce
SET entry_fee_paid = GREATEST(coalesce(c.entry_fee, 0), 0)
FROM app.competitions c
WHERE c.id = ce.competition_id
  AND coalesce(ce.entry_fee_paid, 0) = 0
  AND coalesce(c.entry_fee, 0) > 0;

CREATE OR REPLACE FUNCTION app.snapshot_competition_entry_fee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(NEW.entry_fee_paid, 0) = 0 THEN
    SELECT GREATEST(coalesce(entry_fee, 0), 0)
    INTO NEW.entry_fee_paid
    FROM app.competitions
    WHERE id = NEW.competition_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS competition_entry_fee_snapshot ON app.competition_entries;
CREATE TRIGGER competition_entry_fee_snapshot
BEFORE INSERT ON app.competition_entries
FOR EACH ROW
EXECUTE FUNCTION app.snapshot_competition_entry_fee();

ALTER TABLE app.competitions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS cancelled_by varchar(255),
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS refund_total real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_entry_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS app.competition_entry_refunds (
  entry_id integer PRIMARY KEY REFERENCES app.competition_entries(id) ON DELETE RESTRICT,
  competition_id integer NOT NULL REFERENCES app.competitions(id) ON DELETE RESTRICT,
  user_id varchar(255) NOT NULL REFERENCES app.users(id),
  amount real NOT NULL CHECK (amount >= 0),
  transaction_id integer UNIQUE REFERENCES app.transactions(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competition_entry_refunds_competition_idx
  ON app.competition_entry_refunds (competition_id, entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS tournament_cancellation_refund_external_id_unique
  ON app.transactions (external_transaction_id)
  WHERE source_type = 'tournament_cancellation_refund'
    AND external_transaction_id IS NOT NULL;
