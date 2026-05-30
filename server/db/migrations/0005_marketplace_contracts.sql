-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Marketplace Phase 4: Contracts + Obligations
--
-- Creates: contracts, obligation_proofs
-- Extends: obligations (adds contract_id, deliverable_type, recurrence,
--           proof_required)
--
-- Depends on: 0001_init.sql, 0002_marketplace_profiles.sql,
--             Phase 2 tables (applications, sponsorship_opportunities)
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. CONTRACTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id          UUID REFERENCES public.sponsorship_opportunities(id) ON DELETE SET NULL,
  application_id          UUID UNIQUE REFERENCES public.applications(id) ON DELETE SET NULL,
  sponsor_id              UUID NOT NULL REFERENCES public.profiles(id),
  fighter_id              UUID NOT NULL REFERENCES public.profiles(id),
  value_usd               INTEGER NOT NULL CHECK (value_usd >= 0),
  platform_fee_bps        INTEGER DEFAULT 0,
  payment_schedule        TEXT CHECK (payment_schedule IN ('upfront','milestones','monthly','on_completion')) DEFAULT 'upfront',
  start_date              DATE,
  end_date                DATE,
  deliverables_snapshot   JSONB DEFAULT '[]'::JSONB,
  terms_markdown          TEXT,
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','pending_fighter','pending_sponsor','active','in_dispute','completed','terminated','expired')),
  sponsor_accepted_at     TIMESTAMPTZ,
  sponsor_accepted_ip     INET,
  fighter_accepted_at     TIMESTAMPTZ,
  fighter_accepted_ip     INET,
  terminated_by           UUID REFERENCES public.profiles(id),
  termination_reason      TEXT,
  completed_at            TIMESTAMPTZ,
  terminated_at           TIMESTAMPTZ,
  metadata                JSONB DEFAULT '{}'::JSONB,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contracts_sponsor  ON public.contracts (sponsor_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_fighter  ON public.contracts (fighter_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_status   ON public.contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts (end_date) WHERE status = 'active';

DROP TRIGGER IF EXISTS set_updated_at ON public.contracts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. EXTEND OBLIGATIONS ────────────────────────────────────────────────────
-- Add marketplace columns; existing fighter-only obligations remain valid
-- (contract_id nullable).
ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS contract_id      UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deliverable_type TEXT,
  ADD COLUMN IF NOT EXISTS recurrence       TEXT DEFAULT 'once'
                                            CHECK (recurrence IN ('once','daily','weekly','monthly','per_event')),
  ADD COLUMN IF NOT EXISTS proof_required   BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_obligations_contract ON public.obligations (contract_id) WHERE contract_id IS NOT NULL;

-- Extend RLS to allow contract participants to read obligations
DROP POLICY IF EXISTS "Contract participants read obligations" ON public.obligations;
CREATE POLICY "Contract participants read obligations"
  ON public.obligations FOR SELECT
  USING (
    auth.uid() = owner_id
    OR (
      contract_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = obligations.contract_id
          AND (c.sponsor_id = auth.uid() OR c.fighter_id = auth.uid())
      )
    )
  );

-- ── 3. OBLIGATION PROOFS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.obligation_proofs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id    UUID NOT NULL REFERENCES public.obligations(id) ON DELETE CASCADE,
  submitted_by     UUID NOT NULL REFERENCES public.profiles(id),
  proof_type       TEXT NOT NULL CHECK (proof_type IN ('url','file','text')),
  proof_value      TEXT NOT NULL,
  caption          TEXT,
  reviewed_by      UUID REFERENCES public.profiles(id),
  review_status    TEXT NOT NULL DEFAULT 'pending'
                   CHECK (review_status IN ('pending','approved','rejected')),
  review_notes     TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proofs_obligation  ON public.obligation_proofs (obligation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proofs_pending     ON public.obligation_proofs (review_status) WHERE review_status = 'pending';

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participant reads contract" ON public.contracts;
CREATE POLICY "Participant reads contract"
  ON public.contracts FOR SELECT
  USING (sponsor_id = auth.uid() OR fighter_id = auth.uid());

-- No client INSERT/UPDATE — backend service role only.

ALTER TABLE public.obligation_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contract participant reads proofs" ON public.obligation_proofs;
CREATE POLICY "Contract participant reads proofs"
  ON public.obligation_proofs FOR SELECT
  USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.obligations o
      JOIN public.contracts c ON c.id = o.contract_id
      WHERE o.id = obligation_proofs.obligation_id
        AND (c.sponsor_id = auth.uid() OR c.fighter_id = auth.uid())
    )
  );
