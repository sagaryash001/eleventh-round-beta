-- ═════════════════════════════════════════════════════════════════════════════
-- Missing indexes for every filtered / sorted column
--
-- Phase 2 tables (sponsorship_opportunities, applications, matches) were
-- applied directly to Supabase with no migration file, so they have no
-- indexes at all. All other gaps filled here.
--
-- Every index is IF NOT EXISTS — safe to run multiple times.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── sponsorship_opportunities ─────────────────────────────────────────────────
-- Discovery feed: WHERE status='published' ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_opp_status_published
  ON public.sponsorship_opportunities (status, published_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- Sponsor /mine endpoint: WHERE sponsor_id=X AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_opp_sponsor_created
  ON public.sponsorship_opportunities (sponsor_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Discovery filters
CREATE INDEX IF NOT EXISTS idx_opp_campaign_type
  ON public.sponsorship_opportunities (campaign_type)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_opp_location
  ON public.sponsorship_opportunities (location_country)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_opp_budget
  ON public.sponsorship_opportunities (budget_min_usd, budget_max_usd)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_opp_deadline
  ON public.sponsorship_opportunities (application_deadline)
  WHERE deleted_at IS NULL AND status = 'published' AND application_deadline IS NOT NULL;

-- ── applications ──────────────────────────────────────────────────────────────
-- Fighter /mine cursor: WHERE fighter_id=X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_apps_fighter_created
  ON public.applications (fighter_id, created_at DESC);

-- Sponsor applicant view: WHERE opportunity_id=X ORDER BY match_score DESC
CREATE INDEX IF NOT EXISTS idx_apps_opp_score
  ON public.applications (opportunity_id, match_score DESC NULLS LAST);

-- Sponsor dashboard / status transitions
CREATE INDEX IF NOT EXISTS idx_apps_sponsor_status_created
  ON public.applications (sponsor_id, status, created_at DESC);

-- Fighter status filter
CREATE INDEX IF NOT EXISTS idx_apps_fighter_status_created
  ON public.applications (fighter_id, status, created_at DESC);

-- ── matches ───────────────────────────────────────────────────────────────────
-- Matching engine reads: WHERE opportunity_id=X ORDER BY score DESC
CREATE INDEX IF NOT EXISTS idx_matches_opp_score
  ON public.matches (opportunity_id, score DESC)
  WHERE stale = false;

CREATE INDEX IF NOT EXISTS idx_matches_fighter_score
  ON public.matches (fighter_id, score DESC)
  WHERE stale = false;

-- ── contracts ─────────────────────────────────────────────────────────────────
-- Cursor queries: WHERE sponsor_id=X AND deleted_at IS NULL ORDER BY created_at DESC
-- Existing (sponsor_id, status) index helps filter but not the cursor sort;
-- add partial composite for the list endpoint.
CREATE INDEX IF NOT EXISTS idx_contracts_sponsor_created
  ON public.contracts (sponsor_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_fighter_created
  ON public.contracts (fighter_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── conversation_participants ─────────────────────────────────────────────────
-- Participation check: WHERE conversation_id=X AND user_id=Y AND left_at IS NULL
-- Existing idx_conv_participants_user covers (user_id) WHERE left_at IS NULL.
-- Add (conversation_id, user_id) for the hot participation check in message routes.
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv_user
  ON public.conversation_participants (conversation_id, user_id)
  WHERE left_at IS NULL;

-- ── messages ─────────────────────────────────────────────────────────────────
-- Cursor: WHERE conversation_id=X AND deleted_at IS NULL ORDER BY created_at DESC
-- Existing idx_messages_conversation covers (conversation_id, created_at).
-- Add partial to exclude deleted rows.
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── sponsorship_payments ─────────────────────────────────────────────────────
-- In-flight dedup check: WHERE contract_id=X AND status IN (...) AND milestone_id IS NULL
CREATE INDEX IF NOT EXISTS idx_spayments_contract_status
  ON public.sponsorship_payments (contract_id, status);

-- Milestone lookup
CREATE INDEX IF NOT EXISTS idx_spayments_milestone
  ON public.sponsorship_payments (milestone_id)
  WHERE milestone_id IS NOT NULL;

-- GMV aggregation: WHERE status='succeeded'
CREATE INDEX IF NOT EXISTS idx_spayments_succeeded
  ON public.sponsorship_payments (status, created_at DESC)
  WHERE status = 'succeeded';

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Admin users list: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_profiles_created_at
  ON public.profiles (created_at DESC);

-- ── outbox_events ─────────────────────────────────────────────────────────────
-- Already covered: idx_outbox_pending ON (status, next_attempt_at)
-- Add attempts for dead-letter queries
CREATE INDEX IF NOT EXISTS idx_outbox_attempts
  ON public.outbox_events (attempts, status)
  WHERE status = 'failed';

-- ── obligation_proofs ─────────────────────────────────────────────────────────
-- Sponsor proof review: WHERE obligation_id=X AND review_status='pending'
CREATE INDEX IF NOT EXISTS idx_proofs_obligation_status
  ON public.obligation_proofs (obligation_id, review_status);
