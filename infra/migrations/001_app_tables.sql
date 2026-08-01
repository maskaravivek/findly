CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS shopping_requests (
  id text PRIMARY KEY,
  thread_id text NOT NULL UNIQUE,
  user_id text,
  status text NOT NULL,
  input jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_requests_user_created_idx ON shopping_requests(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS browser_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id text NOT NULL REFERENCES shopping_requests(id) ON DELETE CASCADE,
  kind text NOT NULL, storage_key text NOT NULL, retailer_id text, created_at timestamptz NOT NULL DEFAULT now()
);
