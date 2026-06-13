-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — SponsorForge access reviews + required-module flag
--
-- Adds the approval workflow that gates SponsorForge:
--   1. education_modules.required_for_sponsorforge — admin marks WHICH modules
--      are prerequisites (NOT every published module).
--   2. sponsorforge_reviews — one row per user tracking their request to unlock
--      SponsorForge: draft → pending → approved / rejected.
--
-- Unlock is driven by sponsorforge_profiles.is_locked (already exists): admin
-- approval flips it to false. This table records the request + admin decision.
--
-- Idempotent. Depends on: 0003 (sponsorforge_profiles), 0017 (education_modules).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Which modules are prerequisites for SponsorForge ──────────────────────
-- Distinct from the generic `is_required` flag: a module can be generally
-- required without being a SponsorForge prerequisite, and vice-versa.
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS required_for_sponsorforge BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_education_modules_sf_required
  ON public.education_modules (required_for_sponsorforge)
  WHERE required_for_sponsorforge = true;

-- ── 2. SponsorForge access reviews ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsorforge_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'fighter'
               CHECK (role IN ('fighter','sponsor')),
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending','approved','rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active review per user; resubmits reuse the row (draft→pending→…).
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_sf_reviews_status
  ON public.sponsorforge_reviews (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_reviews_user
  ON public.sponsorforge_reviews (user_id);

DROP TRIGGER IF EXISTS trg_sf_reviews_updated_at ON public.sponsorforge_reviews;
CREATE TRIGGER trg_sf_reviews_updated_at
  BEFORE UPDATE ON public.sponsorforge_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sponsorforge_reviews ENABLE ROW LEVEL SECURITY;

-- Users may read only their own review row. All writes + admin/manager reads go
-- through the Express API on the service-role key (bypasses RLS).
DROP POLICY IF EXISTS "sf reviews user reads own" ON public.sponsorforge_reviews;
CREATE POLICY "sf reviews user reads own" ON public.sponsorforge_reviews
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
