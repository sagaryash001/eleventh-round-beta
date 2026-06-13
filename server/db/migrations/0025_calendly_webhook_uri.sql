-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Calendly webhook subscription URI
--
-- Stores the Calendly webhook_subscription resource URI created for a user after
-- OAuth connect, so it can be deleted on disconnect.
--
-- Idempotent. Depends on: 0024 (calendly_connections).
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.calendly_connections
  ADD COLUMN IF NOT EXISTS webhook_uri TEXT;
