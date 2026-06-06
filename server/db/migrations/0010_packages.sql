-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Admin Package Catalogue
--
-- Creates the packages table for admin-editable pricing tiers.
-- Separate from memberships (which tracks Stripe subscriptions per user).
-- packages = the product catalogue; memberships = the purchase records.
--
-- Safe to run multiple times (idempotent).
-- Depends on: 0001_init.sql (set_updated_at trigger function)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.packages (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  audience         TEXT         NOT NULL DEFAULT 'all'
                   CHECK (audience IN ('fighter','manager','sponsor','all')),
  description      TEXT,
  price_cents      INTEGER      NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  billing_interval TEXT         NOT NULL DEFAULT 'monthly'
                   CHECK (billing_interval IN ('monthly','annual','one_time')),
  features         JSONB        NOT NULL DEFAULT '[]'::JSONB,
  active           BOOLEAN      NOT NULL DEFAULT true,
  sort_order       INTEGER      NOT NULL DEFAULT 100,
  -- populated later once Stripe is wired
  stripe_price_id  TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_audience
  ON public.packages (audience) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_packages_sort
  ON public.packages (sort_order, name);

DROP TRIGGER IF EXISTS trg_packages_updated_at ON public.packages;
CREATE TRIGGER trg_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Active packages are publicly readable (used for pricing page / future checkout)
DROP POLICY IF EXISTS "packages public read" ON public.packages;
CREATE POLICY "packages public read" ON public.packages
  FOR SELECT USING (active = true);

-- ── Seed starter packages ──────────────────────────────────────────────────────
-- ON CONFLICT DO NOTHING makes this re-runnable safely.
INSERT INTO public.packages
  (name, audience, description, price_cents, billing_interval, features, sort_order)
VALUES
  (
    'Pipeline Pro',
    'fighter',
    'Full fighter career pipeline, education modules, and SponsorForge access.',
    9900,
    'monthly',
    '["Fighter pipeline tracking","Education modules","SponsorForge eligibility","Obligation management","Mentor booking"]',
    10
  ),
  (
    'MGMT-SUITE',
    'manager',
    'Complete management operations suite for fighter teams.',
    19900,
    'monthly',
    '["Roster management","Obligation tracking","Camp budget planning","Operations playbooks","SponsorForge roster view"]',
    20
  ),
  (
    'PRMTN-HUB',
    'sponsor',
    'Promotion and brand hub for sponsors and event organizers.',
    29900,
    'monthly',
    '["Opportunity publishing","Fighter matching","Contract management","Analytics dashboard","Direct fighter messaging"]',
    30
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Run after 0009_indexes.sql.
-- ─────────────────────────────────────────────────────────────────────────────
