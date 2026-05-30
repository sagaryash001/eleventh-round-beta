-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Marketplace Phase 6: Reviews + Disputes (stub)
--
-- Creates: reviews, disputes
-- Both sides rate each other after contract completion. Reviews are hidden
-- until both submit OR 14 days pass (retaliation-bias protection).
-- Disputes are a manual-admin v1 stub; no fighter-facing dispute button yet.
--
-- Depends on: 0005_marketplace_contracts.sql
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. REVIEWS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  reviewer_id          UUID NOT NULL REFERENCES public.profiles(id),
  subject_id           UUID NOT NULL REFERENCES public.profiles(id),
  rating               SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  punctuality          SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
  communication        SMALLINT CHECK (communication BETWEEN 1 AND 5),
  professionalism      SMALLINT CHECK (professionalism BETWEEN 1 AND 5),
  deliverable_quality  SMALLINT CHECK (deliverable_quality BETWEEN 1 AND 5),
  public_comment       TEXT,
  private_feedback     TEXT,
  released_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contract_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_subject    ON public.reviews (subject_id, released_at);
CREATE INDEX IF NOT EXISTS idx_reviews_contract   ON public.reviews (contract_id);
CREATE INDEX IF NOT EXISTS idx_reviews_unreleased ON public.reviews (contract_id) WHERE released_at IS NULL;

-- ── 2. DISPUTES (stub) ────────────────────────────────────────────────────────
-- v1: admin resolves manually. No fighter-facing UI yet.
CREATE TABLE IF NOT EXISTS public.disputes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id      UUID NOT NULL REFERENCES public.contracts(id),
  opener_id        UUID NOT NULL REFERENCES public.profiles(id),
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','under_review','resolved','closed')),
  description      TEXT NOT NULL,
  resolution_notes TEXT,
  resolved_by      UUID REFERENCES public.profiles(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_status   ON public.disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_contract ON public.disputes (contract_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.disputes;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participant reads own review" ON public.reviews;
CREATE POLICY "Participant reads own review"
  ON public.reviews FOR SELECT
  USING (reviewer_id = auth.uid() OR subject_id = auth.uid());

DROP POLICY IF EXISTS "Reviewer inserts own review" ON public.reviews;
CREATE POLICY "Reviewer inserts own review"
  ON public.reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participant reads dispute" ON public.disputes;
CREATE POLICY "Participant reads dispute"
  ON public.disputes FOR SELECT
  USING (
    opener_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = disputes.contract_id
        AND (c.sponsor_id = auth.uid() OR c.fighter_id = auth.uid())
    )
  );
