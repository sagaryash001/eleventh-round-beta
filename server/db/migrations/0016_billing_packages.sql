-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Billing + Package Checkout V1
--
-- Extends payments, memberships, and packages to support Stripe Checkout.
-- All changes are idempotent (ADD COLUMN IF NOT EXISTS / IF NOT EXISTS).
--
-- Depends on: 0001_init.sql (payments, memberships), 0010_packages.sql (packages)
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND packages ───────────────────────────────────────────────────────
-- stripe_product_id: links the package to a Stripe Product for subscription mgmt
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

-- ── 2. EXTEND payments ───────────────────────────────────────────────────────
-- package_id: which package this payment was for
-- stripe_checkout_session_id: Stripe Checkout Session ID (for idempotency)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_payments_package
  ON public.payments (package_id) WHERE package_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_checkout_session
  ON public.payments (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- ── 3. EXTEND memberships ────────────────────────────────────────────────────
-- package_id: which package this membership is for
-- billing_interval: monthly | annual | one_time (mirrors packages.billing_interval)
-- current_period_start: when the current billing period started
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS billing_interval TEXT
    CHECK (billing_interval IS NULL OR billing_interval IN ('monthly','annual','one_time'));

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_memberships_package
  ON public.memberships (package_id) WHERE package_id IS NOT NULL;
