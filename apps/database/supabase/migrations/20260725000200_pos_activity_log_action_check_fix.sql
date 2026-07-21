-- 20260721000000_purchase_void.sql dropped and recreated
-- pos_activity_log_action_check without carrying forward 'purchase_edit',
-- 'subscription_edit', 'subscription_void', 'charge_void' from
-- 20260719020000_pos_corrections.sql — so voiding/editing a subscription (or
-- charge) has been failing this constraint ever since with "new row for
-- relation pos_activity_log violates check constraint
-- pos_activity_log_action_check". Restore the full action set.

ALTER TABLE public.pos_activity_log DROP CONSTRAINT pos_activity_log_action_check;
ALTER TABLE public.pos_activity_log ADD CONSTRAINT pos_activity_log_action_check
  CHECK (action IN (
    'sale', 'restock', 'product_create', 'product_update', 'employee_charge',
    'purchase_edit', 'purchase_void',
    'subscription_edit', 'subscription_void',
    'charge_void'
  ));
