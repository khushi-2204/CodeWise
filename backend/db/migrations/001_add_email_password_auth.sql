-- Extend the existing auth tables additively. This migration does not delete data.
ALTER TABLE app_users
  ADD COLUMN name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE app_sessions
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN session_data jsonb NOT NULL DEFAULT '{}'::jsonb;
