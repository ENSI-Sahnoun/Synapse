-- Remove NextBase boilerplate tables not used in SMP
DROP TABLE IF EXISTS public.content_blog_post_comments CASCADE;
DROP TABLE IF EXISTS public.content_blog_posts CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.private_items CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
