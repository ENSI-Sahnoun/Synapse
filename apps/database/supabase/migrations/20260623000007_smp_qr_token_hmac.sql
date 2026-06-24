-- Add a check constraint enforcing the new HMAC token format
-- Format: SYNAPSE-{uuid}-{64 hex chars}
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_qr_token_format
  CHECK (
    qr_token IS NULL
    OR qr_token ~ '^SYNAPSE-[0-9a-f-]{36}-[0-9a-f]{64}$'
  );

-- Drop the constraint temporarily to allow backfill (re-added after)
-- The backfill script apps/web/src/scripts/backfill-qr-tokens.ts must run
-- before this migration is applied to production with the constraint active.
-- For local dev: run 'db reset' which re-seeds clean data from handle_new_user
-- (Phase 1A), then the backfill script updates all tokens.
COMMENT ON COLUMN public.profiles.qr_token IS
  'HMAC-signed QR token. Format: SYNAPSE-{student_id}-{hmac_sha256(student_id, QR_HMAC_SECRET)}. Backfill via apps/web/src/scripts/backfill-qr-tokens.ts';
