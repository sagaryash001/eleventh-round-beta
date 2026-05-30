-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Marketplace Phase 5: Payments
--
-- Creates: sponsorship_payments, payment_milestones
--
-- Money invariant: all amounts stored in integer USD dollars.
-- net_to_fighter_usd + platform_fee_usd = amount_usd enforced by CHECK.
-- Stripe amounts converted to cents only at the Stripe boundary in code.
--
-- Depends on: 0005_marketplace_contracts.sql
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. PAYMENT MILESTONES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount_usd   INTEGER NOT NULL CHECK (amount_usd > 0),
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','invoiced','paid','skipped')),
  sequence     SMALLINT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_seq ON public.payment_milestones (contract_id, sequence);
CREATE INDEX        IF NOT EXISTS idx_milestones_contract ON public.payment_milestones (contract_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.payment_milestones;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.payment_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. SPONSORSHIP PAYMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsorship_payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id               UUID NOT NULL REFERENCES public.contracts(id),
  sponsor_id                UUID NOT NULL REFERENCES public.profiles(id),
  fighter_id                UUID NOT NULL REFERENCES public.profiles(id),
  milestone_id              UUID REFERENCES public.payment_milestones(id),
  amount_usd                INTEGER NOT NULL CHECK (amount_usd > 0),
  platform_fee_usd          INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_usd >= 0),
  net_to_fighter_usd        INTEGER NOT NULL CHECK (net_to_fighter_usd >= 0),
  currency                  TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id  TEXT UNIQUE,
  stripe_charge_id          TEXT,
  stripe_transfer_id        TEXT,
  status                    TEXT NOT NULL DEFAULT 'requires_payment'
                            CHECK (status IN ('requires_payment','processing','succeeded','failed','refunded','held')),
  failure_code              TEXT,
  failure_message           TEXT,
  paid_at                   TIMESTAMPTZ,
  metadata                  JSONB DEFAULT '{}'::JSONB,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  -- Money invariant
  CONSTRAINT payment_amounts_sum CHECK (net_to_fighter_usd + platform_fee_usd = amount_usd)
);

CREATE INDEX IF NOT EXISTS idx_spayments_sponsor   ON public.sponsorship_payments (sponsor_id, status);
CREATE INDEX IF NOT EXISTS idx_spayments_fighter   ON public.sponsorship_payments (fighter_id, status);
CREATE INDEX IF NOT EXISTS idx_spayments_contract  ON public.sponsorship_payments (contract_id);
CREATE INDEX IF NOT EXISTS idx_spayments_intent    ON public.sponsorship_payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.sponsorship_payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sponsorship_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contract participant reads milestones" ON public.payment_milestones;
CREATE POLICY "Contract participant reads milestones"
  ON public.payment_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = payment_milestones.contract_id
        AND (c.sponsor_id = auth.uid() OR c.fighter_id = auth.uid())
    )
  );

ALTER TABLE public.sponsorship_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participant reads payment" ON public.sponsorship_payments;
CREATE POLICY "Participant reads payment"
  ON public.sponsorship_payments FOR SELECT
  USING (sponsor_id = auth.uid() OR fighter_id = auth.uid());
