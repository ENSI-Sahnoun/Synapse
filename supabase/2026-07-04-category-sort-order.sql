-- Manual display order for product categories, set by drag-reorder in admin,
-- respected by both the admin list and the employee POS.
alter table public.product_categories add column if not exists sort_order integer not null default 0;

-- backfill existing categories by current alphabetical order
with ranked as (
  select id, row_number() over (order by name) - 1 as rn
  from public.product_categories
)
update public.product_categories c set sort_order = ranked.rn
from ranked where ranked.id = c.id;
