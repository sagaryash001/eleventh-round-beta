-- ─────────────────────────────────────────────────────────────────────────────
-- 0019  Expand public content CMS — podcast & apparel enrichment columns
--
-- Safe and idempotent:
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS
--   No destructive changes. No seed data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. podcast_episodes — new columns ────────────────────────────────────────
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS slug              text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS guest_name        text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS guest_title       text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS show_notes        text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS tags              text[]  DEFAULT '{}';
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS is_featured       boolean DEFAULT false;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS meta_title        text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS meta_description  text;

-- ── 2. apparel_products — new columns ────────────────────────────────────────
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS slug              text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS collection        text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS sizes             text[]  DEFAULT '{}';
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS colors            text[]  DEFAULT '{}';
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS gallery_images    text[]  DEFAULT '{}';
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS hover_image_path  text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS badge             text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS stock_status      text    DEFAULT 'in_stock'
    CHECK (stock_status IN ('in_stock', 'low_stock', 'sold_out', 'hidden'));
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS material          text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS fit               text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS care_instructions text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS shopify_url       text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS meta_title        text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS meta_description  text;

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_slug      ON public.podcast_episodes (slug)        WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_featured  ON public.podcast_episodes (is_featured)  WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_tags      ON public.podcast_episodes USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_apparel_products_slug       ON public.apparel_products (slug)       WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apparel_products_collection ON public.apparel_products (collection) WHERE collection IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apparel_products_feat2      ON public.apparel_products (featured)   WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_apparel_products_sizes      ON public.apparel_products USING gin (sizes);
CREATE INDEX IF NOT EXISTS idx_apparel_products_colors     ON public.apparel_products USING gin (colors);
