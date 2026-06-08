-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Full Education Modules V1
--
-- Extends education_modules and module_progress with content types,
-- checklist support, status workflow, and a resources table.
-- All changes are idempotent (ADD COLUMN IF NOT EXISTS / IF NOT EXISTS).
--
-- Depends on: 0003_marketplace_opportunities.sql (education_modules, module_progress)
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND education_modules ──────────────────────────────────────────────

-- Content type: lesson | video | pdf | link | checklist | mixed
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS module_type TEXT NOT NULL DEFAULT 'lesson'
    CHECK (module_type IN ('lesson','video','pdf','link','checklist','mixed'));

-- Long-form text body for lesson/mixed modules
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS content_body TEXT;

-- Flexible JSON: checklist_items, supplementary links, etc.
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Whether this module is mandatory for all fighters
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false;

-- Target audience (kept simple for V1)
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all_fighters'
    CHECK (audience IN ('all_fighters','fighters_only'));

-- Explicit status replaces the boolean is_published for richer workflow
-- is_published is kept for backward compatibility with existing queries.
-- status drives new UI logic.
ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published','archived'));

ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE public.education_modules
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── 2. EXTEND module_progress ─────────────────────────────────────────────────

-- Explicit status so frontend can filter without computing from completion_pct
ALTER TABLE public.module_progress
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed'));

-- Per-fighter checklist state: { "item-id": true/false, ... }
ALTER TABLE public.module_progress
  ADD COLUMN IF NOT EXISTS checklist_state JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Optional fighter notes on the module
ALTER TABLE public.module_progress
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Track when fighter last viewed (for nudge notifications later)
ALTER TABLE public.module_progress
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- ── 3. EDUCATION MODULE RESOURCES ────────────────────────────────────────────
-- Supplementary files/links attached to a module (PDFs, videos, links).

CREATE TABLE IF NOT EXISTS public.education_module_resources (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     UUID        NOT NULL REFERENCES public.education_modules(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  resource_type TEXT        NOT NULL DEFAULT 'link'
                CHECK (resource_type IN ('pdf','link','video','file')),
  url           TEXT,
  storage_path  TEXT,
  order_num     SMALLINT    NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_resources_module
  ON public.education_module_resources (module_id, order_num);

ALTER TABLE public.education_module_resources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read resources for published modules
DROP POLICY IF EXISTS "resources auth read" ON public.education_module_resources;
CREATE POLICY "resources auth read" ON public.education_module_resources
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.education_modules em
      WHERE em.id = education_module_resources.module_id
        AND em.status = 'published'
    )
  );

-- ── 4. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_education_modules_status
  ON public.education_modules (status, order_num);

CREATE INDEX IF NOT EXISTS idx_education_modules_required
  ON public.education_modules (is_required) WHERE is_required = true;

-- ── 5. BACKFILL status from is_published ─────────────────────────────────────
-- Modules that were unpublished (is_published=false) default to 'published'
-- after ADD COLUMN, so we correct those to 'draft'.
UPDATE public.education_modules
  SET status = 'draft'
  WHERE is_published = false AND status = 'published';

-- ── 6. BACKFILL module_progress.status from completion_pct ──────────────────
-- New column defaults to 'not_started'. Existing rows with completion_pct > 0
-- must be promoted so fighters don't lose visible progress after migration.
UPDATE public.module_progress
  SET status = CASE
    WHEN completion_pct >= 100 THEN 'completed'
    WHEN completion_pct > 0    THEN 'in_progress'
    ELSE 'not_started'
  END
  WHERE status = 'not_started' AND completion_pct > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Run after 0016_billing_packages.sql.
-- ─────────────────────────────────────────────────────────────────────────────
