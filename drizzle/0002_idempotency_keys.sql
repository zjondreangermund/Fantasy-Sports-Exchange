-- Idempotency keys for safe retry handling on money and reward operations.

CREATE TABLE IF NOT EXISTS app.idempotency_keys (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  user_id varchar(255),
  route text NOT NULL DEFAULT '',
  request_hash text NOT NULL DEFAULT '',
  response_json jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_key_user_route_uq
  ON app.idempotency_keys (key, COALESCE(user_id, ''), route);

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON app.idempotency_keys (created_at DESC);
