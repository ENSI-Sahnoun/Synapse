-- Add optional emoji per product category, shown on POS tiles when a product
-- has no image, and pickable when creating a category.
alter table public.product_categories add column if not exists emoji text;

-- seed the existing categories
update public.product_categories set emoji = '🥤' where name = 'Boissons'  and emoji is null;
update public.product_categories set emoji = '🍫' where name = 'Snacks'    and emoji is null;
update public.product_categories set emoji = '✏️' where name = 'Papeterie' and emoji is null;
update public.product_categories set emoji = '📦' where name = 'Autre'     and emoji is null;
