-- Persist marketplace purchase intents so retried requests cannot debit twice.
CREATE TABLE IF NOT EXISTS app.idempotency_keys (
  key text PRIMARY KEY,
  user_id varchar(255) NOT NULL REFERENCES app.users(id),
  created_at timestamp DEFAULT now(),
  expires_at timestamp
);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_at_idx
  ON app.idempotency_keys (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_marketplace_purchase_idempotency_idx
  ON app.audit_logs (user_id, (meta ->> 'idempotencyKey'))
  WHERE action = 'marketplace.purchase.completed';
