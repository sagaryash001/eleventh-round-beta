-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Initial Schema
--
-- Run in Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).
-- Idempotent: safe to re-run. Drop tables manually if you need a clean slate.
--
-- Covers all 8 phases:
--   1. Auth profiles  + onboarding  (Phase 1)
--   2. Leads                         (Phase 2)
--   3. Memberships + payments        (Phase 3)
--   4. Bookings                      (Phase 4)
--   5. Apparel clicks + podcast      (Phase 5)
--   6. Obligations                   (Phase 6)
--   7. Analytics events              (Phase 7)
--   *  Team members + site settings  (admin-managed reference data)
--
-- All tables have RLS enabled. The service role (used by the Express
-- backend) bypasses RLS automatically — that's why we DON'T grant
-- broad SELECT to authenticated users on most tables. Policies below
-- only cover what users genuinely read directly via supabase-js.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── updated_at trigger helper ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. PROFILES (1:1 with auth.users)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('fighter','manager','admin')),
  account_type        TEXT CHECK (account_type IN ('fighter','management','promotion')),
  team_name           TEXT,
  subdomain           TEXT UNIQUE,
  onboarding_complete BOOLEAN DEFAULT false,
  avatar_url          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role      ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_subdomain ON public.profiles(subdomain) WHERE subdomain IS NOT NULL;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users read their own profile
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users update their own profile (limited fields enforced at app layer)
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ONBOARDING ANSWERS
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.onboarding (
  user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  q1_role            TEXT,   -- fighter | management | promotion
  q2_goal            TEXT,   -- track_onboarding | professionalism | sponsor_ready
  q3_common_problem  TEXT,
  q4_end_goal        TEXT,
  q5_upcoming_event  TEXT,   -- yes | no
  completed_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own onboarding" ON public.onboarding;
CREATE POLICY "Users read own onboarding" ON public.onboarding
  FOR SELECT USING (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. LEADS (Phase 2 — contact form)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT,
  source      TEXT,                              -- 'contact' | 'newsletter' | 'apparel' | ...
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','contacted','qualified','closed','spam')),
  metadata    JSONB DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status     ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
-- Leads are written by the backend (service role) only. Admin reads via backend too.
-- No public policies = no client-side access. Good.

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. MEMBERSHIPS + PAYMENTS (Phase 3 — Stripe)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.memberships (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT UNIQUE,
  tier                    TEXT,                  -- 'monthly' | 'annual' | custom price IDs
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','active','past_due','canceled','incomplete')),
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  metadata                JSONB DEFAULT '{}'::JSONB,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status  ON public.memberships(status);

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.memberships;
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own memberships" ON public.memberships;
CREATE POLICY "Users read own memberships" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  membership_id               UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  stripe_payment_intent_id    TEXT UNIQUE,
  stripe_charge_id            TEXT,
  amount                      INTEGER NOT NULL,   -- in smallest currency unit (cents)
  currency                    TEXT NOT NULL DEFAULT 'usd',
  status                      TEXT NOT NULL,      -- 'succeeded' | 'failed' | 'refunded' | ...
  description                 TEXT,
  receipt_url                 TEXT,
  metadata                    JSONB DEFAULT '{}'::JSONB,
  created_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
CREATE POLICY "Users read own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. BOOKINGS (Phase 4 — Calendly)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  calendly_event_uri    TEXT UNIQUE,                 -- e.g. https://api.calendly.com/scheduled_events/<uuid>
  calendly_invitee_uri  TEXT,
  invitee_name          TEXT,
  invitee_email         TEXT NOT NULL,
  event_type            TEXT,                        -- 'mentorship' | future types
  scheduled_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','canceled','completed','no_show')),
  metadata              JSONB DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id      ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON public.bookings(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_email        ON public.bookings(invitee_email);

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own bookings" ON public.bookings;
CREATE POLICY "Users read own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. APPAREL CLICK TRACKING + PODCAST EPISODES (Phase 5)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.apparel_clicks (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id   TEXT,                              -- Shopify product handle, optional
  product_name TEXT,
  source_page  TEXT,                              -- '/apparel' | '/' | ...
  user_agent   TEXT,
  ip_hash      TEXT,                              -- store hashed IP, never raw
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apparel_clicks_created_at ON public.apparel_clicks(created_at DESC);

ALTER TABLE public.apparel_clicks ENABLE ROW LEVEL SECURITY;
-- Writes via backend only; no client read policies.

CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id    TEXT UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  published_at  TIMESTAMPTZ,
  cover_url     TEXT,
  audio_url     TEXT,
  spotify_url   TEXT,
  duration_ms   INTEGER,
  is_published  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podcast_published_at ON public.podcast_episodes(published_at DESC);

DROP TRIGGER IF EXISTS trg_podcast_updated_at ON public.podcast_episodes;
CREATE TRIGGER trg_podcast_updated_at BEFORE UPDATE ON public.podcast_episodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

-- Podcast episodes are public — anyone (even anon) can read published ones.
DROP POLICY IF EXISTS "Anyone reads published episodes" ON public.podcast_episodes;
CREATE POLICY "Anyone reads published episodes" ON public.podcast_episodes
  FOR SELECT USING (is_published = true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. OBLIGATIONS (Phase 6 — Realtime overdue notifications)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.obligations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','completed','overdue','canceled')),
  priority     TEXT NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high','critical')),
  category     TEXT,                              -- 'sponsor' | 'media' | 'admin' | ...
  metadata     JSONB DEFAULT '{}'::JSONB,
  overdue_notified_at TIMESTAMPTZ,                -- set when first overdue alert fires (prevents spam)
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obligations_owner_id  ON public.obligations(owner_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_date  ON public.obligations(due_date);
CREATE INDEX IF NOT EXISTS idx_obligations_status    ON public.obligations(status);

DROP TRIGGER IF EXISTS trg_obligations_updated_at ON public.obligations;
CREATE TRIGGER trg_obligations_updated_at BEFORE UPDATE ON public.obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own obligations" ON public.obligations;
CREATE POLICY "Users read own obligations" ON public.obligations
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users update own obligations" ON public.obligations;
CREATE POLICY "Users update own obligations" ON public.obligations
  FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users insert own obligations" ON public.obligations;
CREATE POLICY "Users insert own obligations" ON public.obligations
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Enable Realtime on this table (Supabase Dashboard → Database → Replication
-- → toggle `obligations` ON). If you prefer SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.obligations;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. TEAM MEMBERS (admin-managed reference data, public read)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  bio         TEXT,
  photo_path  TEXT,                              -- Supabase Storage path: 'team/manager-01.jpg'
  sort_order  INTEGER DEFAULT 100,
  is_founder  BOOLEAN DEFAULT false,
  published   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads published team" ON public.team_members;
CREATE POLICY "Anyone reads published team" ON public.team_members
  FOR SELECT USING (published = true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. ANALYTICS EVENTS (Phase 7 — optional server-side mirror of GA4)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,                      -- 'membership_cta_click' | 'stripe_checkout_start' | ...
  props       JSONB DEFAULT '{}'::JSONB,
  session_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_name        ON public.analytics_events(name);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at  ON public.analytics_events(created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- Writes via backend only.

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. SITE SETTINGS (admin-managed integration config, key/value)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.site_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
-- Backend-only writes/reads.

-- Seed minimal defaults
INSERT INTO public.site_settings (key, value, description) VALUES
  ('shopify_store_url',   '""'::JSONB, 'Public Shopify storefront URL'),
  ('spotify_show_url',    '""'::JSONB, 'Public Spotify show URL'),
  ('calendly_event_url',  '""'::JSONB, 'Mentorship Calendly event URL')
ON CONFLICT (key) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- DONE.
--
-- Next steps:
--  1. Storage → create bucket 'team' (public) and 'gallery' (public).
--  2. Authentication → URL Configuration → set Site URL to your production
--     URL, add http://localhost:5173 to Redirect URLs for dev.
--  3. Authentication → Email Templates → optionally customize, or let the
--     Express backend send branded SendGrid emails instead.
-- ═════════════════════════════════════════════════════════════════════════════
