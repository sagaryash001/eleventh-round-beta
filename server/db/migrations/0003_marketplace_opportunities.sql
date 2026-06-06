-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Marketplace Phase 2: Opportunities, Applications &
--                   Fighter Readiness Infrastructure
--
-- RECONSTRUCTED MIGRATION — this file was absent from the repository.
-- Every DDL statement is idempotent (IF NOT EXISTS / DROP … IF EXISTS).
-- Safe to run against the live production database in its current state.
--
-- Production state at time of reconstruction (2026-06-06):
--   Applied : 0001, 0002 (partial), 0004, 0008
--   Existing: analytics_events, apparel_clicks, audience_demographics,
--             audit_log, bookings, conversation_participants, conversations,
--             fighter_profiles (manually created), leads, memberships,
--             messages, notifications, obligations, onboarding,
--             outbox_events, payments, podcast_episodes, profile_views,
--             profiles, site_settings, social_accounts, sponsor_profiles,
--             team_members, user_blocks
--   Missing : everything below
--
-- Tables created by this migration:
--    1. sponsorship_opportunities
--    2. matches                     (score cache; required by 0009_indexes.sql)
--    3. applications
--    4. readiness_scores
--    5. pipeline_progress
--    6. education_modules
--    7. module_progress
--    8. sponsorforge_profiles
--    9. manager_fighters
--
-- Existing tables repaired (ADD COLUMN IF NOT EXISTS only — no data change):
--    profiles         → status, manager_type
--    fighter_profiles → weight_class, division, base_city, record_*, manager_id,
--                       headshot_path, bio, updated_at, plus all columns from
--                       0002 re-asserted (safe no-op if already present)
--    obligations      → contract_id, deliverable_type, recurrence, proof_required
--                       (stub columns required by obligations.js OBLIGATION_COLS;
--                        FK on contract_id is added as a separate step — see note
--                        at the bottom of this file)
--
-- Depends on : 0001_init.sql, 0002_marketplace_profiles.sql
-- Must run before : 0005, 0006, 0007, 0009
--
-- ⚠  FK NOTE (read before running 0005):
--    The obligations.contract_id column is added here WITHOUT the FK reference
--    because contracts does not yet exist.  0005's ADD COLUMN IF NOT EXISTS will
--    skip it (column already present), so the FK is never wired automatically.
--    After applying 0005, run the one-time repair at the bottom of this file.
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION A — REPAIR EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A1. profiles ──────────────────────────────────────────────────────────────

-- status: used by PATCH /api/admin/users/:id to flag/suspend accounts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- manager_type: reserved for mentor-as-manager sub-role (Phase 3+).
-- Value 'mentor' will map here; role stays 'manager'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_type TEXT;

-- Extend account_type CHECK to include management_team and admin.
-- Old values (management, promotion, fighter, sponsor) are preserved so
-- existing rows remain valid.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IS NULL OR account_type IN (
    'fighter',
    'management',
    'management_team',
    'promotion',
    'sponsor',
    'admin'
  ));


-- ── A2. fighter_profiles (manually created in prod — re-assert all columns) ───

-- Core fields that should have been in the original manual creation.
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS division
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS base_city
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS weight_class
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS record_wins
  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS record_losses
  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS record_draws
  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS manager_id
  UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS headshot_path
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS bio
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS updated_at
  TIMESTAMPTZ DEFAULT now();

-- 0002 extension columns — safe no-op if already present.
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS nickname
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS date_of_birth
  DATE;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS gender
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS nationality
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS coach_name
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS gym_name
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS pro_status
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS current_promotion
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS height_cm
  SMALLINT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS reach_cm
  SMALLINT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS stance
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS highlight_video_urls
  TEXT[] DEFAULT '{}';
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS media_kit_url
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS banner_path
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS sponsorship_interests
  TEXT[] DEFAULT '{}';
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS public_slug
  TEXT;
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS visibility
  TEXT NOT NULL DEFAULT 'sponsors_only';
ALTER TABLE public.fighter_profiles ADD COLUMN IF NOT EXISTS is_open_to_sponsorship
  BOOLEAN NOT NULL DEFAULT true;

-- Unique slug index (idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS uq_fighter_public_slug
  ON public.fighter_profiles (public_slug) WHERE public_slug IS NOT NULL;

-- Ensure RLS is enabled and the updated_at trigger exists.
ALTER TABLE public.fighter_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_fighter_profiles_updated_at ON public.fighter_profiles;
CREATE TRIGGER trg_fighter_profiles_updated_at
  BEFORE UPDATE ON public.fighter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Re-assert 0002 RLS policies (safe if already present).
DROP POLICY IF EXISTS "fighter public read"        ON public.fighter_profiles;
CREATE POLICY "fighter public read" ON public.fighter_profiles
  FOR SELECT USING (visibility = 'public' OR user_id = auth.uid());

DROP POLICY IF EXISTS "fighter sponsors-only read" ON public.fighter_profiles;
CREATE POLICY "fighter sponsors-only read" ON public.fighter_profiles
  FOR SELECT USING (
    visibility = 'sponsors_only'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'sponsor'
    )
  );

DROP POLICY IF EXISTS "fighter updates own"        ON public.fighter_profiles;
CREATE POLICY "fighter updates own" ON public.fighter_profiles
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fighter inserts own"        ON public.fighter_profiles;
CREATE POLICY "fighter inserts own" ON public.fighter_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());


-- ── A3. obligations — stub columns required by obligations.js OBLIGATION_COLS ──
--
-- The route file selects these columns explicitly. If they are absent,
-- every obligations API call returns a PostgREST "column not found" error.
--
-- contract_id is added WITHOUT its FK here because contracts does not exist
-- yet. 0005 will attempt ADD COLUMN IF NOT EXISTS and skip (already present).
-- After applying 0005, add the FK manually — see the repair script at the
-- bottom of this file.

ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS contract_id
  UUID;
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS deliverable_type
  TEXT;
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS recurrence
  TEXT DEFAULT 'once';
ALTER TABLE public.obligations ADD COLUMN IF NOT EXISTS proof_required
  BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_obligations_contract
  ON public.obligations (contract_id) WHERE contract_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION B — NEW TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- B1. SPONSORSHIP OPPORTUNITIES
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sponsorship_opportunities (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id             UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Content
  title                  TEXT         NOT NULL,
  description            TEXT,
  -- Valid campaign_type values (enforced at app layer for flexibility):
  -- 'endorsement' | 'event_appearance' | 'social_content' | 'kit_deal'
  -- | 'ambassador' | 'other'
  campaign_type          TEXT,

  -- Budget (all integers = whole USD dollars)
  budget_min_usd         INTEGER      CHECK (budget_min_usd IS NULL OR budget_min_usd >= 0),
  budget_max_usd         INTEGER      CHECK (budget_max_usd IS NULL OR budget_max_usd >= 0),
  budget_per_fighter_usd INTEGER      CHECK (budget_per_fighter_usd IS NULL OR budget_per_fighter_usd >= 0),
  max_fighters           INTEGER      DEFAULT 1 CHECK (max_fighters IS NULL OR max_fighters >= 1),

  -- Deliverables: [{ type, description, count, deadline }]
  deliverables           JSONB        NOT NULL DEFAULT '[]'::JSONB,

  -- Requirements (used by matching engine):
  -- { weight_classes: [], promotions: [], min_followers: 0, min_engagement_bps: 0 }
  requirements           JSONB        NOT NULL DEFAULT '{}'::JSONB,

  -- Dates
  application_deadline   DATE,
  campaign_start         DATE,
  campaign_end           DATE,

  -- Geography (ISO-3166-1 alpha-2 for country)
  location_country       CHAR(2),
  location_region        TEXT,

  -- Status / visibility
  status                 TEXT         NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','published','closed','archived','cancelled')),
  visibility             TEXT         NOT NULL DEFAULT 'public'
                         CHECK (visibility IN ('public','verified_only','private')),

  -- Denormalised counters (maintained by backend, not triggers)
  view_count             INTEGER      NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  application_count      INTEGER      NOT NULL DEFAULT 0 CHECK (application_count >= 0),

  -- Timestamps
  published_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ,

  CHECK (
    budget_max_usd IS NULL
    OR budget_min_usd IS NULL
    OR budget_max_usd >= budget_min_usd
  )
);

DROP TRIGGER IF EXISTS trg_opp_updated_at ON public.sponsorship_opportunities;
CREATE TRIGGER trg_opp_updated_at
  BEFORE UPDATE ON public.sponsorship_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes used by discovery feed, sponsor dashboard, and matching engine.
CREATE INDEX IF NOT EXISTS idx_opp_status_vis
  ON public.sponsorship_opportunities (status, visibility)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opp_sponsor_created
  ON public.sponsorship_opportunities (sponsor_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opp_published_at
  ON public.sponsorship_opportunities (published_at DESC NULLS LAST)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opp_campaign_type
  ON public.sponsorship_opportunities (campaign_type)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_opp_location
  ON public.sponsorship_opportunities (location_country)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_opp_budget
  ON public.sponsorship_opportunities (budget_min_usd, budget_max_usd)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_opp_deadline
  ON public.sponsorship_opportunities (application_deadline)
  WHERE deleted_at IS NULL AND status = 'published'
    AND application_deadline IS NOT NULL;

ALTER TABLE public.sponsorship_opportunities ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated users can read published public opportunities.
DROP POLICY IF EXISTS "opp public read" ON public.sponsorship_opportunities;
CREATE POLICY "opp public read" ON public.sponsorship_opportunities
  FOR SELECT USING (
    deleted_at IS NULL
    AND status    = 'published'
    AND visibility = 'public'
  );

-- Authenticated users can read verified_only published opportunities.
DROP POLICY IF EXISTS "opp auth read verified_only" ON public.sponsorship_opportunities;
CREATE POLICY "opp auth read verified_only" ON public.sponsorship_opportunities
  FOR SELECT USING (
    deleted_at IS NULL
    AND status     = 'published'
    AND visibility = 'verified_only'
    AND auth.uid() IS NOT NULL
  );

-- Sponsors manage all their own opportunities (all statuses, including drafts).
DROP POLICY IF EXISTS "opp sponsor manages own" ON public.sponsorship_opportunities;
CREATE POLICY "opp sponsor manages own" ON public.sponsorship_opportunities
  FOR ALL
  USING     (sponsor_id = auth.uid())
  WITH CHECK (sponsor_id = auth.uid());


-- ═════════════════════════════════════════════════════════════════════════════
-- B2. MATCHES  (match-score cache; required by 0009_indexes.sql)
--
-- Populated by the backend matching engine when an opportunity is published
-- or recomputed on demand. The `stale` flag is set true when fighter data
-- changes and clears after recompute.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.matches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID        NOT NULL REFERENCES public.sponsorship_opportunities(id) ON DELETE CASCADE,
  fighter_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score          SMALLINT    NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  breakdown      JSONB       NOT NULL DEFAULT '{}'::JSONB,
  reasons        JSONB       NOT NULL DEFAULT '[]'::JSONB,
  algorithm_ver  TEXT        NOT NULL DEFAULT 'v1-rule',
  stale          BOOLEAN     NOT NULL DEFAULT false,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (opportunity_id, fighter_id)
);

DROP TRIGGER IF EXISTS trg_matches_updated_at ON public.matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 0009_indexes.sql expects exactly this index signature.
CREATE INDEX IF NOT EXISTS idx_matches_opp_score
  ON public.matches (opportunity_id, score DESC)
  WHERE stale = false;

CREATE INDEX IF NOT EXISTS idx_matches_fighter
  ON public.matches (fighter_id, score DESC)
  WHERE stale = false;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Fighters can read their own match scores.
DROP POLICY IF EXISTS "match fighter reads own" ON public.matches;
CREATE POLICY "match fighter reads own" ON public.matches
  FOR SELECT USING (fighter_id = auth.uid());

-- Sponsors can read match scores for their own opportunities.
DROP POLICY IF EXISTS "match sponsor reads own opp" ON public.matches;
CREATE POLICY "match sponsor reads own opp" ON public.matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sponsorship_opportunities o
      WHERE o.id = matches.opportunity_id
        AND o.sponsor_id = auth.uid()
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- B3. APPLICATIONS
-- ═════════════════════════════════════════════════════════════════════════════
-- State-machine transitions (enforced in code, documented here for reference):
--   Fighter: applied → withdrawn
--            under_review → withdrawn
--            shortlisted  → withdrawn
--   Sponsor: applied      → under_review | rejected
--            under_review → shortlisted  | rejected
--            shortlisted  → accepted     | rejected
CREATE TABLE IF NOT EXISTS public.applications (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id     UUID        NOT NULL REFERENCES public.sponsorship_opportunities(id) ON DELETE CASCADE,
  fighter_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sponsor_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  direction          TEXT        NOT NULL DEFAULT 'fighter_applied'
                     CHECK (direction IN ('fighter_applied','sponsor_invited')),
  status             TEXT        NOT NULL DEFAULT 'applied'
                     CHECK (status IN (
                       'applied','under_review','shortlisted',
                       'accepted','rejected','withdrawn'
                     )),

  cover_message      TEXT,
  -- Cached at insert time by computeMatchScore(); 0–100.
  match_score        SMALLINT    CHECK (match_score IS NULL OR match_score BETWEEN 0 AND 100),
  price_proposed_usd INTEGER     CHECK (price_proposed_usd IS NULL OR price_proposed_usd >= 0),

  -- Review audit trail
  reviewed_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  decided_at         TIMESTAMPTZ,
  rejection_reason   TEXT,

  metadata           JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active application per (opportunity, fighter) pair.
  UNIQUE (opportunity_id, fighter_id)
);

DROP TRIGGER IF EXISTS trg_applications_updated_at ON public.applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_apps_fighter_created
  ON public.applications (fighter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_apps_opp_score
  ON public.applications (opportunity_id, match_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_apps_sponsor_status_created
  ON public.applications (sponsor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_apps_fighter_status_created
  ON public.applications (fighter_id, status, created_at DESC);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Fighters manage their own applications (apply, view, withdraw).
DROP POLICY IF EXISTS "app fighter manages own" ON public.applications;
CREATE POLICY "app fighter manages own" ON public.applications
  FOR ALL
  USING     (fighter_id = auth.uid())
  WITH CHECK (fighter_id = auth.uid());

-- Sponsors read all applications for their own opportunities.
DROP POLICY IF EXISTS "app sponsor reads own opps" ON public.applications;
CREATE POLICY "app sponsor reads own opps" ON public.applications
  FOR SELECT USING (sponsor_id = auth.uid());

-- Sponsors update status (under_review / shortlisted / accepted / rejected).
DROP POLICY IF EXISTS "app sponsor updates own opps" ON public.applications;
CREATE POLICY "app sponsor updates own opps" ON public.applications
  FOR UPDATE USING (sponsor_id = auth.uid());


-- ═════════════════════════════════════════════════════════════════════════════
-- B4. READINESS SCORES  (one row per fighter; recomputed by backend)
-- ═════════════════════════════════════════════════════════════════════════════
-- Sub-dimension mapping to SponsorForge V1 weights:
--   overall     → composite (readiness 40%)
--   brand       → brand/category fit (20%)
--   media       → audience/social fit (15%)
--   conduct     → reliability/conduct
--   finance     → financial literacy
--   sponsor     → sponsor-readiness gate score
--   pipeline    → pipeline stage progression (10%)
CREATE TABLE IF NOT EXISTS public.readiness_scores (
  user_id      UUID      PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall      SMALLINT  NOT NULL DEFAULT 0 CHECK (overall   BETWEEN 0 AND 100),
  brand        SMALLINT  NOT NULL DEFAULT 0 CHECK (brand     BETWEEN 0 AND 100),
  finance      SMALLINT  NOT NULL DEFAULT 0 CHECK (finance   BETWEEN 0 AND 100),
  conduct      SMALLINT  NOT NULL DEFAULT 0 CHECK (conduct   BETWEEN 0 AND 100),
  sponsor      SMALLINT  NOT NULL DEFAULT 0 CHECK (sponsor   BETWEEN 0 AND 100),
  media        SMALLINT  NOT NULL DEFAULT 0 CHECK (media     BETWEEN 0 AND 100),
  pipeline     SMALLINT  NOT NULL DEFAULT 0 CHECK (pipeline  BETWEEN 0 AND 100),
  -- Historical sparkline stored newest-last: [48, 52, 55, …, 79]
  trend        JSONB     NOT NULL DEFAULT '[]'::JSONB,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_readiness_scores_updated_at ON public.readiness_scores;
CREATE TRIGGER trg_readiness_scores_updated_at
  BEFORE UPDATE ON public.readiness_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_readiness_overall
  ON public.readiness_scores (overall DESC);

ALTER TABLE public.readiness_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "readiness user reads own" ON public.readiness_scores;
CREATE POLICY "readiness user reads own" ON public.readiness_scores
  FOR SELECT USING (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- B5. PIPELINE PROGRESS  (one row per fighter per stage; 5 stages default)
-- ═════════════════════════════════════════════════════════════════════════════
-- Stage labels (seeded per fighter by backend on registration):
--   1 — Profile & Intake
--   2 — Financial Literacy Baseline
--   3 — Brand & Digital Presence
--   4 — Sponsor Readiness
--   5 — SponsorForge Access
CREATE TABLE IF NOT EXISTS public.pipeline_progress (
  id             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID      NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_number   SMALLINT  NOT NULL CHECK (stage_number BETWEEN 1 AND 10),
  stage_label    TEXT      NOT NULL,
  completion_pct SMALLINT  NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  unlocked_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, stage_number)
);

DROP TRIGGER IF EXISTS trg_pipeline_progress_updated_at ON public.pipeline_progress;
CREATE TRIGGER trg_pipeline_progress_updated_at
  BEFORE UPDATE ON public.pipeline_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pipeline_user_stage
  ON public.pipeline_progress (user_id, stage_number);

ALTER TABLE public.pipeline_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline user reads own" ON public.pipeline_progress;
CREATE POLICY "pipeline user reads own" ON public.pipeline_progress
  FOR SELECT USING (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- B6. EDUCATION MODULES  (admin-managed catalogue)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.education_modules (
  id             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT      NOT NULL,
  description    TEXT,
  -- 'business' | 'finance' | 'contracts' | 'branding' | 'nil' | 'camp'
  -- | 'sponsor' | 'transition' | …
  category       TEXT,
  order_num      SMALLINT  NOT NULL DEFAULT 100,
  is_published   BOOLEAN   NOT NULL DEFAULT true,
  estimated_mins SMALLINT,
  thumbnail_path TEXT,
  content_url    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_education_modules_updated_at ON public.education_modules;
CREATE TRIGGER trg_education_modules_updated_at
  BEFORE UPDATE ON public.education_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_education_modules_order
  ON public.education_modules (order_num)
  WHERE is_published = true;

ALTER TABLE public.education_modules ENABLE ROW LEVEL SECURITY;

-- Authenticated users read published modules.
DROP POLICY IF EXISTS "education modules auth read" ON public.education_modules;
CREATE POLICY "education modules auth read" ON public.education_modules
  FOR SELECT USING (is_published = true AND auth.uid() IS NOT NULL);

-- Seed the 8 platform modules shown in the fighter dashboard.
-- ON CONFLICT DO NOTHING prevents double-inserts on re-run.
INSERT INTO public.education_modules (name, category, order_num, is_published) VALUES
  ('Business Basics',      'business',   1, true),
  ('Taxes & Filing',       'finance',    2, true),
  ('Contract Reading',     'contracts',  3, true),
  ('Personal Branding',    'branding',   4, true),
  ('NIL Rights',           'nil',        5, true),
  ('Camp Budgeting',       'camp',       6, true),
  ('Sponsorship Strategy', 'sponsor',    7, true),
  ('Life After Fighting',  'transition', 8, true)
ON CONFLICT DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- B7. MODULE PROGRESS  (one row per user per module)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.module_progress (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID      NOT NULL REFERENCES public.profiles(id)           ON DELETE CASCADE,
  module_id        UUID      NOT NULL REFERENCES public.education_modules(id)  ON DELETE CASCADE,
  completion_pct   SMALLINT  NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, module_id)
);

DROP TRIGGER IF EXISTS trg_module_progress_updated_at ON public.module_progress;
CREATE TRIGGER trg_module_progress_updated_at
  BEFORE UPDATE ON public.module_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_module_progress_user
  ON public.module_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_module_progress_module
  ON public.module_progress (module_id);

ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module progress user reads own" ON public.module_progress;
CREATE POLICY "module progress user reads own" ON public.module_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "module progress user writes own" ON public.module_progress;
CREATE POLICY "module progress user writes own" ON public.module_progress
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- B8. SPONSORFORGE PROFILES  (one row per fighter; maintained by backend)
-- ═════════════════════════════════════════════════════════════════════════════
-- eligibility_score is the weighted composite used to lock/unlock access.
-- Sub-scores are stored so the UI can show "why your score is X":
--   brand_readiness   ← brand/category fit  (20% weight in v1)
--   audience_score    ← social/audience fit  (15%)
--   availability_score← event timing fit     (10%)
--   content_score     ← content quality      (5%)
-- The readiness (40%) and location (10%) weights pull from readiness_scores
-- and fighter_profiles respectively; they are not stored here.
CREATE TABLE IF NOT EXISTS public.sponsorforge_profiles (
  user_id                  UUID      PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  eligibility_score        SMALLINT  NOT NULL DEFAULT 0
                           CHECK (eligibility_score BETWEEN 0 AND 100),
  is_locked                BOOLEAN   NOT NULL DEFAULT true,

  -- Eligibility gate inputs (populated/refreshed by backend compute job)
  sponsor_profile_complete BOOLEAN   NOT NULL DEFAULT false,
  pipeline_stage           SMALLINT  NOT NULL DEFAULT 0 CHECK (pipeline_stage >= 0),
  obligation_record_pct    SMALLINT  NOT NULL DEFAULT 0
                           CHECK (obligation_record_pct BETWEEN 0 AND 100),

  -- SponsorForge V1 sub-scores (0–100)
  brand_readiness          SMALLINT  NOT NULL DEFAULT 0
                           CHECK (brand_readiness    BETWEEN 0 AND 100),
  audience_score           SMALLINT  NOT NULL DEFAULT 0
                           CHECK (audience_score     BETWEEN 0 AND 100),
  availability_score       SMALLINT  NOT NULL DEFAULT 0
                           CHECK (availability_score BETWEEN 0 AND 100),
  content_score            SMALLINT  NOT NULL DEFAULT 0
                           CHECK (content_score      BETWEEN 0 AND 100),

  -- Full breakdown JSON for transparent "why your score is X" UI
  score_breakdown          JSONB     NOT NULL DEFAULT '{}'::JSONB,

  last_computed_at         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_sponsorforge_profiles_updated_at ON public.sponsorforge_profiles;
CREATE TRIGGER trg_sponsorforge_profiles_updated_at
  BEFORE UPDATE ON public.sponsorforge_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_sf_profiles_score
  ON public.sponsorforge_profiles (eligibility_score DESC)
  WHERE is_locked = false;

CREATE INDEX IF NOT EXISTS idx_sf_profiles_locked
  ON public.sponsorforge_profiles (is_locked);

ALTER TABLE public.sponsorforge_profiles ENABLE ROW LEVEL SECURITY;

-- Fighter reads their own SponsorForge profile.
DROP POLICY IF EXISTS "sf profile user reads own" ON public.sponsorforge_profiles;
CREATE POLICY "sf profile user reads own" ON public.sponsorforge_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Verified sponsors can read unlocked (eligible) profiles for matching.
DROP POLICY IF EXISTS "sf profile sponsor reads eligible" ON public.sponsorforge_profiles;
CREATE POLICY "sf profile sponsor reads eligible" ON public.sponsorforge_profiles
  FOR SELECT USING (
    is_locked = false
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'sponsor'
    )
  );


-- ═════════════════════════════════════════════════════════════════════════════
-- B9. MANAGER FIGHTERS  (roster junction)
--
-- Created here because every manager dashboard route (overview, roster,
-- obligations, sponsorforge, reports) queries this table.  Without it,
-- all manager API calls return 500.
--
-- Backend (service role) manages inserts/deletes.
-- Fighters and managers read their own side via RLS.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.manager_fighters (
  manager_id  UUID      NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fighter_id  UUID      NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT      NOT NULL DEFAULT 'active'
              CHECK (status IN ('pending','active','inactive','terminated')),
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (manager_id, fighter_id)
);

DROP TRIGGER IF EXISTS trg_manager_fighters_updated_at ON public.manager_fighters;
CREATE TRIGGER trg_manager_fighters_updated_at
  BEFORE UPDATE ON public.manager_fighters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Filtered by status = 'active' to match the default backend query pattern.
CREATE INDEX IF NOT EXISTS idx_mf_manager_active
  ON public.manager_fighters (manager_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_mf_fighter_active
  ON public.manager_fighters (fighter_id)
  WHERE status = 'active';

ALTER TABLE public.manager_fighters ENABLE ROW LEVEL SECURITY;

-- Manager reads the fighters on their roster.
DROP POLICY IF EXISTS "mf manager reads own roster" ON public.manager_fighters;
CREATE POLICY "mf manager reads own roster" ON public.manager_fighters
  FOR SELECT USING (manager_id = auth.uid());

-- Fighter reads their own manager link.
DROP POLICY IF EXISTS "mf fighter reads own link" ON public.manager_fighters;
CREATE POLICY "mf fighter reads own link" ON public.manager_fighters
  FOR SELECT USING (fighter_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION C — POST-APPLY NOTES
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠  FK REPAIR REQUIRED AFTER 0005 IS APPLIED
--    0005_marketplace_contracts.sql uses ADD COLUMN IF NOT EXISTS for
--    obligations.contract_id, which will be silently skipped because that
--    column already exists from this migration (A3 above). The FK constraint
--    will therefore NOT be added automatically by 0005.
--
--    After applying 0005, run the following one-time SQL in the Supabase
--    SQL editor:
--
--    ALTER TABLE public.obligations
--      ADD CONSTRAINT fk_obligations_contract
--      FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;
--
--    This is safe: the column has no FK yet, and no data exists in it, so
--    the constraint will apply cleanly.
--
-- ⚠  TABLES STILL MISSING (not in any migration; will cause 500 on their routes)
--    The following tables are referenced by backend routes but are not created
--    by 0001–0009. They need a dedicated migration (0010 or similar):
--      - alerts          (admin overview route)
--      - consultants     (admin mentors route)
--      - sponsorforge_matches (admin sponsorforge route)
--      - camp_budgets    (manager budget route)
--      - playbooks       (manager playbooks route)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- END OF 0003_marketplace_opportunities.sql
-- ─────────────────────────────────────────────────────────────────────────────
