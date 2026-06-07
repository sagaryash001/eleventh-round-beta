-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Manager Roster Workflow
--
-- Extends manager_fighters to support:
--   • Email-only invites (fighter may not have an account yet)
--   • Manager-created pending fighter profiles (no auth user)
--   • Bidirectional status tracking (pending/active/declined/removed)
--   • Surrogate id for single-row endpoint routing
--
-- Safe to run multiple times (idempotent).
-- Depends on: 0003_marketplace_opportunities.sql (manager_fighters base table)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Surrogate id ───────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS fills existing rows with the default value.
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Backfill any rows that somehow got NULL (safety net for re-runs).
UPDATE public.manager_fighters SET id = gen_random_uuid() WHERE id IS NULL;

-- Promote id to NOT NULL now that every row has a value.
ALTER TABLE public.manager_fighters ALTER COLUMN id SET NOT NULL;

-- Drop the old (manager_id, fighter_id) composite primary key so we can
-- (a) use id as the surrogate key and (b) allow fighter_id to be NULL.
ALTER TABLE public.manager_fighters DROP CONSTRAINT IF EXISTS manager_fighters_pkey;

-- Unique index on id is the new de-facto primary key for single-row lookups.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mf_id
  ON public.manager_fighters (id);

-- Retain uniqueness for pairs that have both columns populated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mf_manager_fighter
  ON public.manager_fighters (manager_id, fighter_id)
  WHERE fighter_id IS NOT NULL;

-- ── 2. Make fighter_id nullable ───────────────────────────────────────────────
-- Required for email-only invites and manually-created pending profiles.
-- Running DROP NOT NULL on an already-nullable column is a safe no-op.
ALTER TABLE public.manager_fighters ALTER COLUMN fighter_id DROP NOT NULL;

-- ── 3. Expand status check ────────────────────────────────────────────────────
-- Original only had: pending, active, inactive, terminated.
-- New workflow adds:  declined, removed.
-- PostgreSQL auto-names inline CHECK constraints as <table>_<col>_check.
ALTER TABLE public.manager_fighters DROP CONSTRAINT IF EXISTS manager_fighters_status_check;
ALTER TABLE public.manager_fighters ADD CONSTRAINT manager_fighters_status_check
  CHECK (status IN ('pending','active','inactive','terminated','declined','removed'));

-- ── 4. New workflow columns ───────────────────────────────────────────────────
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS team_name            TEXT;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS permissions          JSONB        NOT NULL DEFAULT '{}';
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS invited_email        TEXT;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS invited_name         TEXT;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS request_message      TEXT;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS requested_by         UUID         REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS declined_at          TIMESTAMPTZ;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS removed_at           TIMESTAMPTZ;
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS source               TEXT         NOT NULL DEFAULT 'manual';
ALTER TABLE public.manager_fighters ADD COLUMN IF NOT EXISTS pending_fighter_data JSONB        NOT NULL DEFAULT '{}';

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mf_manager_status
  ON public.manager_fighters (manager_id, status);

CREATE INDEX IF NOT EXISTS idx_mf_fighter_status
  ON public.manager_fighters (fighter_id, status)
  WHERE fighter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mf_invited_email
  ON public.manager_fighters (invited_email)
  WHERE invited_email IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Run after 0010_packages.sql.
-- ─────────────────────────────────────────────────────────────────────────────
