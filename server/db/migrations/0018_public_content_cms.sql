-- ─────────────────────────────────────────────────────────────────────────────
-- 0018 Public content CMS: podcast_episodes, apparel_products, consultants
---------------------------------------------------------------------------

-- Safe and idempotent:
--   CREATE TABLE IF NOT EXISTS
--   ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   CREATE INDEX IF NOT EXISTS
--   No destructive changes. No seed data.
-- ─────────────────────────────────────────────────────────────────────────────

-- Required for gen_random_uuid() on most Supabase projects
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS description    text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS episode_number integer;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS season         integer DEFAULT 1;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS spotify_url    text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS apple_url      text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS youtube_url    text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS embed_url      text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS thumbnail_path text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS duration       text;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS status         text DEFAULT 'draft';
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS published_at   timestamptz;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS sort_order     integer DEFAULT 100;
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();
ALTER TABLE public.podcast_episodes ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status
ON public.podcast_episodes (status);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published
ON public.podcast_episodes (published_at DESC)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_sort
ON public.podcast_episodes (sort_order ASC);

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

ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS price_display text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS category      text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS image_path    text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS external_url  text;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS status        text DEFAULT 'draft';
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS featured      boolean DEFAULT false;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS sort_order    integer DEFAULT 100;
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS metadata      jsonb DEFAULT '{}';
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();
ALTER TABLE public.apparel_products ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_apparel_products_status
ON public.apparel_products (status);

CREATE INDEX IF NOT EXISTS idx_apparel_products_featured
ON public.apparel_products (featured DESC)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_apparel_products_sort
ON public.apparel_products (sort_order ASC);

-- ── 3. consultants ────────────────────────────────────────────────────────────

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

ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS title           text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS specialty       text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS bio             text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS phone           text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS booking_url     text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS image_path      text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS location        text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS tags            text[] DEFAULT '{}';
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS audience        text DEFAULT 'all';
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS status          text DEFAULT 'active';
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS sort_order      integer DEFAULT 100;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS hourly_rate_usd integer;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS linkedin_url    text;
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();
ALTER TABLE public.consultants ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_consultants_status
ON public.consultants (status);

CREATE INDEX IF NOT EXISTS idx_consultants_audience
ON public.consultants (audience);

CREATE INDEX IF NOT EXISTS idx_consultants_sort
ON public.consultants (sort_order ASC);
