-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Attach a Calendly scheduling link / event type to an app event
--
-- Lets a user associate one of their Calendly event types (or a raw scheduling
-- URL) with a manually-created Event Calendar event, so the event can surface a
-- "Book / scheduling link". This is READ/attach only — it does NOT create or
-- cancel Calendly meetings (that requires scheduling_links:write /
-- scheduled_events:write, which Calendly OAuth tokens do not carry by default).
--
-- Idempotent. Depends on: 0023 (events).
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS calendly_scheduling_url  TEXT,
  ADD COLUMN IF NOT EXISTS calendly_event_type_uri  TEXT;
