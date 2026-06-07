-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Messaging Phase 2: Conversation Status + Extended Context Types
--
-- Extends: conversations (adds status, extends context_type to include 'obligation')
--
-- Depends on: 0001_init.sql, 0004_marketplace_messaging.sql, 0005_marketplace_contracts.sql
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. ADD STATUS COLUMN TO CONVERSATIONS ────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','archived','locked'));

-- ── 2. EXTEND CONTEXT_TYPE TO INCLUDE 'obligation' ──────────────────────────
-- Drop the old constraint if it exists and recreate with 'obligation' added
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_context_type_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_context_type_check
    CHECK (context_type IN ('direct','application','contract','obligation','support'));

-- ── 3. CREATE INDEX ON STATUS FOR FILTERING ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations (status) WHERE status != 'archived';
