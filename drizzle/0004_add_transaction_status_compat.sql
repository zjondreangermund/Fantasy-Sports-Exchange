-- Compatibility migration for production databases created before transaction status was added.
-- Several server paths read or write app.transactions.status.

ALTER TABLE app.transactions
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

UPDATE app.transactions
SET status = 'completed'
WHERE status IS NULL OR status = '';
