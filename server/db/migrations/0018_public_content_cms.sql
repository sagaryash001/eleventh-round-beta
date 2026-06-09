-- ─────────────────────────────────────────────────────────────────────────────
-- 0016  Public content CMS: podcast_episodes, apparel_products, consultants
--
-- Safe and idempotent:
--   CREATE TABLE IF NOT EXISTS
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS
--   No destructive changes. No seed data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. podcast_episodes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  description    text,
  episode_number integer,
  season         integer     DEFAULT 1,
  spotify_url    text,
  apple_url      text,
  youtube_url    text,
  embed_url      text,
  thumbnail_path text,
  duration       text,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'published', 'archived')),
  published_at   timestamptz,
  sort_order     integer     DEFAULT 100,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status     ON public.podcast_episodes (status);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published  ON public.podcast_episodes (published_at DESC) WHERE status = 'published';

-- ── 2. apparel_products ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apparel_products (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  price_display text,
  category      text,
  image_path    text,
  external_url  text,
  status        text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'published', 'archived')),
  featured      boolean     NOT NULL DEFAULT false,
  sort_order    integer     DEFAULT 100,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apparel_products_status   ON public.apparel_products (status);
CREATE INDEX IF NOT EXISTS idx_apparel_products_featured ON public.apparel_products (featured DESC) WHERE status = 'published';

-- ── 3. consultants — create or repair existing table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.consultants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  title           text,
  specialty       text,
  bio             text,
  email           text,
  phone           text,
  booking_url     text,
  image_path      text,
  location        text,
  tags            text[]      NOT NULL DEFAULT '{}',
  audience        text        NOT NULL DEFAULT 'all'
                              CHECK (audience IN ('all', 'fighter', 'manager', 'sponsor')),
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive', 'archived')),
  sort_order      integer     DEFAULT 100,
  hourly_rate_usd integer,
  linkedin_url    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Add any columns that may be missing on existing deployments
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS title           text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS bio             text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS phone           text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS booking_url     text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS image_path      text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS location        text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS tags            text[] DEFAULT '{}';
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS audience        text   DEFAULT 'all';
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS status          text   DEFAULT 'active';
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS sort_order      integer DEFAULT 100;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS hourly_rate_usd integer;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS linkedin_url    text;

CREATE INDEX IF NOT EXISTS idx_consultants_status   ON public.consultants (status);
CREATE INDEX IF NOT EXISTS idx_consultants_audience ON public.consultants (audience);
