-- Manual display order for products, set by drag-reorder in admin, respected
-- by both the admin list and the employee POS. Ordered within each category.
alter table public.products add column if not exists sort_order integer not null default 0;

-- backfill: number existing products per category by current alphabetical order
with ranked as (
  select id, row_number() over (partition by category order by name) - 1 as rn
  from public.products
)
update public.products p set sort_order = ranked.rn
from ranked where ranked.id = p.id;
