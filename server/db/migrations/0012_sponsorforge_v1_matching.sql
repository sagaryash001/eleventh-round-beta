-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — SponsorForge V1 Matching
--
-- Extends matches table with:
--   status  — sponsor workflow state (suggested → viewed → dismissed/invited)
--   sponsor_id — denormalised for fast per-sponsor queries
--
-- Safe to run multiple times (idempotent).
-- Depends on: 0003_marketplace_opportunities.sql (matches base table)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. status column ─────────────────────────────────────────────────────────
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'suggested';

-- Add constraint only if it doesn't exist yet (idempotent via DROP IF EXISTS + ADD)
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('suggested','viewed','invited','dismissed','applied'));

-- ── 2. sponsor_id column ─────────────────────────────────────────────────────
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sponsor_id UUID
  REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Backfill sponsor_id from the related opportunity row.
UPDATE public.matches m
  SET sponsor_id = o.sponsor_id
  FROM public.sponsorship_opportunities o
  WHERE m.opportunity_id = o.id
    AND m.sponsor_id IS NULL;

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
-- Per-opportunity ranked matches, filtered to non-dismissed
CREATE INDEX IF NOT EXISTS idx_matches_opp_status_score
  ON public.matches (opportunity_id, status, score DESC)
  WHERE stale = false;

-- Per-sponsor view for cross-opportunity dashboards
CREATE INDEX IF NOT EXISTS idx_matches_sponsor_score
  ON public.matches (sponsor_id, score DESC)
  WHERE stale = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Run after 0011_manager_roster_workflow.sql.
-- ─────────────────────────────────────────────────────────────────────────────
