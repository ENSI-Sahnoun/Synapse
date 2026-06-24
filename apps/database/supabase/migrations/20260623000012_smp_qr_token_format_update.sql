-- Drop old HMAC-format constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_qr_token_format;

-- Clear stale long-format tokens so the backfill script assigns new short ones
UPDATE public.profiles
  SET qr_token = NULL
  WHERE qr_token IS NOT NULL
    AND qr_token !~ '^SYNAPSE-[A-Z0-9]{8}$';

-- Add new constraint for the short token format
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_qr_token_format
  CHECK (
    qr_token IS NULL
    OR qr_token ~ '^SYNAPSE-[A-Z0-9]{8}$'
  );
