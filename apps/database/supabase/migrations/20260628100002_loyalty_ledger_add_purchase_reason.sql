-- Add 'purchase' as a valid reason in loyalty_ledger.
-- The POS action inserts with reason='purchase' but the original CHECK
-- constraint only allowed subscription/redemption/adjustment.
ALTER TABLE public.loyalty_ledger
  DROP CONSTRAINT IF EXISTS loyalty_ledger_reason_check;

ALTER TABLE public.loyalty_ledger
  ADD CONSTRAINT loyalty_ledger_reason_check
  CHECK (reason IN ('subscription', 'redemption', 'adjustment', 'purchase'));
