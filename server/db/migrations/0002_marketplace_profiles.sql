-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Marketplace Phase 1: Profiles & Roles
--
-- Adds the sponsor side of the marketplace and extends fighter profiles with
-- the fields the matching engine and public pages need.
--
-- Safe to run multiple times (idempotent). Depends on 0001_init.sql
-- (profiles, set_updated_at()).
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
--
-- Locked product decisions baked into this migration (see TDD §15):
--   • Sponsors: open registration, is_verified defaults false
--   • Fighter profiles: visibility defaults 'sponsors_only'
--   • No DB triggers on auth.users (backend owns profile creation)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 0. Extend the profiles.role CHECK to allow 'sponsor' ─────────────────────
-- The existing constraint is profiles_role_check. Drop + recreate with sponsor.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('fighter','manager','admin','sponsor'));

-- account_type also gains 'sponsor' so registration can map cleanly.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IS NULL OR account_type IN ('fighter','management','promotion','sponsor'));

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. SPONSOR PROFILES
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sponsor_profiles (
  user_id                  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name             TEXT NOT NULL,
  logo_path                TEXT,
  website_url              TEXT,
  industry                 TEXT,
  company_size             TEXT CHECK (company_size IN ('solo','small','mid','enterprise')),
  hq_country               TEXT,                       -- ISO-2
  hq_region                TEXT,
  description              TEXT,
  budget_min_usd           INTEGER CHECK (budget_min_usd IS NULL OR budget_min_usd >= 0),
  budget_max_usd           INTEGER CHECK (budget_max_usd IS NULL OR budget_max_usd >= 0),
  preferred_demographics   JSONB DEFAULT '{}'::JSONB,
  preferred_weight_classes TEXT[] DEFAULT '{}',
  preferred_promotions     TEXT[] DEFAULT '{}',
  campaign_goals           TEXT[] DEFAULT '{}',
  public_slug              TEXT UNIQUE,                -- for /s/:slug
  is_verified              BOOLEAN DEFAULT false,
  visibility               TEXT NOT NULL DEFAULT 'verified_only'
                           CHECK (visibility IN ('private','verified_only','public')),
  total_active_contracts   INTEGER DEFAULT 0,
  metadata                 JSONB DEFAULT '{}'::JSONB,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  deleted_at               TIMESTAMPTZ,
  CHECK (budget_max_usd IS NULL OR budget_min_usd IS NULL OR budget_max_usd >= budget_min_usd)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_industry      ON public.sponsor_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_sponsor_verified      ON public.sponsor_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_sponsor_visibility    ON public.sponsor_profiles(visibility, is_verified);
CREATE INDEX IF NOT EXISTS idx_sponsor_weightclasses ON public.sponsor_profiles USING GIN (preferred_weight_classes);
CREATE INDEX IF NOT EXISTS idx_sponsor_goals         ON public.sponsor_profiles USING GIN (campaign_goals);

DROP TRIGGER IF EXISTS trg_sponsor_profiles_updated_at ON public.sponsor_profiles;
CREATE TRIGGER trg_sponsor_profiles_updated_at BEFORE UPDATE ON public.sponsor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sponsor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsor reads visible or own" ON public.sponsor_profiles;
CREATE POLICY "sponsor reads visible or own" ON public.sponsor_profiles
  FOR SELECT USING (
    deleted_at IS NULL AND (
      visibility IN ('public','verified_only') OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sponsor updates own" ON public.sponsor_profiles;
CREATE POLICY "sponsor updates own" ON public.sponsor_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. EXTEND fighter_profiles
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS nickname              TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS date_of_birth         DATE;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS gender                TEXT
  CHECK (gender IS NULL OR gender IN ('m','f','nb','other','prefer_not'));
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS nationality           TEXT;   -- ISO-2
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS coach_name            TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS gym_name              TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS pro_status            TEXT
  CHECK (pro_status IS NULL OR pro_status IN ('amateur','pro','retired'));
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS current_promotion     TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS height_cm             SMALLINT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS reach_cm              SMALLINT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS stance                TEXT
  CHECK (stance IS NULL OR stance IN ('orthodox','southpaw','switch'));
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS highlight_video_urls  TEXT[] DEFAULT '{}';
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS media_kit_url         TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS banner_path           TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS sponsorship_interests TEXT[] DEFAULT '{}';
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS public_slug           TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS visibility            TEXT NOT NULL DEFAULT 'sponsors_only'
  CHECK (visibility IN ('private','sponsors_only','public'));
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS is_open_to_sponsorship BOOLEAN DEFAULT true;

-- public_slug must be unique when present
CREATE UNIQUE INDEX IF NOT EXISTS uq_fighter_public_slug
  ON public.fighter_profiles(public_slug) WHERE public_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fighter_visibility ON public.fighter_profiles(visibility, is_open_to_sponsorship);
CREATE INDEX IF NOT EXISTS idx_fighter_promotion  ON public.fighter_profiles(current_promotion);
CREATE INDEX IF NOT EXISTS idx_fighter_weight     ON public.fighter_profiles(weight_class);
CREATE INDEX IF NOT EXISTS idx_fighter_nationality ON public.fighter_profiles(nationality);
CREATE INDEX IF NOT EXISTS idx_fighter_interests  ON public.fighter_profiles USING GIN (sponsorship_interests);

-- RLS: fighter_profiles likely already has RLS enabled from 0001. Re-assert
-- and add marketplace read policies. (Existing "own row" policies preserved.)
ALTER TABLE public.fighter_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fighter public read" ON public.fighter_profiles;
CREATE POLICY "fighter public read" ON public.fighter_profiles
  FOR SELECT USING (visibility = 'public' OR user_id = auth.uid());

DROP POLICY IF EXISTS "fighter sponsors-only read" ON public.fighter_profiles;
CREATE POLICY "fighter sponsors-only read" ON public.fighter_profiles
  FOR SELECT USING (
    visibility = 'sponsors_only'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'sponsor')
  );

DROP POLICY IF EXISTS "fighter updates own" ON public.fighter_profiles;
CREATE POLICY "fighter updates own" ON public.fighter_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. SOCIAL ACCOUNTS  (polymorphic — any role)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform             TEXT NOT NULL CHECK (platform IN ('instagram','tiktok','youtube','x','facebook','twitch')),
  handle               TEXT NOT NULL,
  profile_url          TEXT NOT NULL,
  follower_count       INTEGER CHECK (follower_count IS NULL OR follower_count >= 0),
  engagement_rate_bps  INTEGER CHECK (engagement_rate_bps IS NULL OR engagement_rate_bps >= 0),
  verified_by_platform BOOLEAN DEFAULT false,
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_platform  ON public.social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_followers ON public.social_accounts(follower_count DESC);

DROP TRIGGER IF EXISTS trg_social_accounts_updated_at ON public.social_accounts;
CREATE TRIGGER trg_social_accounts_updated_at BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- Social accounts are public read (they back public profile pages); owner writes.
DROP POLICY IF EXISTS "social public read" ON public.social_accounts;
CREATE POLICY "social public read" ON public.social_accounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "social owner writes" ON public.social_accounts;
CREATE POLICY "social owner writes" ON public.social_accounts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. AUDIENCE DEMOGRAPHICS  (one row per user)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audience_demographics (
  user_id        UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  age_brackets   JSONB DEFAULT '{}'::JSONB,
  gender_split   JSONB DEFAULT '{}'::JSONB,
  top_countries  JSONB DEFAULT '[]'::JSONB,
  top_cities     JSONB DEFAULT '[]'::JSONB,
  total_reach    INTEGER DEFAULT 0,
  source         TEXT DEFAULT 'self_reported'
                 CHECK (source IN ('self_reported','imported','computed')),
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audience_demographics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demographics public read" ON public.audience_demographics;
CREATE POLICY "demographics public read" ON public.audience_demographics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "demographics owner writes" ON public.audience_demographics;
CREATE POLICY "demographics owner writes" ON public.audience_demographics
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. AUDIT LOG  (backend-only)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  diff        JSONB,
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor  ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.audit_log(target_type, target_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only.

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. PROFILE VIEWS  (daily-aggregated analytics)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profile_views (
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  view_date   DATE NOT NULL DEFAULT current_date,
  viewer_role TEXT NOT NULL DEFAULT 'anon',
  view_count  INTEGER DEFAULT 0,
  PRIMARY KEY (profile_id, view_date, viewer_role)
);

CREATE INDEX IF NOT EXISTS idx_profile_views_date ON public.profile_views(profile_id, view_date DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Owner can read their own view stats; writes are backend-only.
DROP POLICY IF EXISTS "owner reads own views" ON public.profile_views;
CREATE POLICY "owner reads own views" ON public.profile_views
  FOR SELECT USING (profile_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. USER BLOCKS
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocker manages own blocks" ON public.user_blocks;
CREATE POLICY "blocker manages own blocks" ON public.user_blocks
  FOR ALL USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- ═════════════════════════════════════════════════════════════════════════════
-- DONE — Phase 1 schema.
--
-- Post-migration manual steps (Supabase dashboard):
--   • Storage → create buckets: sponsor-logos (public), fighter-headshots (public),
--     fighter-banners (public), media-kits (private)
--   • Verify profiles.role now accepts 'sponsor'
-- ═════════════════════════════════════════════════════════════════════════════
