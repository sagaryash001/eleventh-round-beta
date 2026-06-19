-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Roster invite email delivery status
--
-- Tracks the real delivery state of a non-platform roster invite email so the
-- manager UI can tell the truth: queued → sent / failed. NULL means "no email
-- invite" (manager-only draft, or an in-app invite to an existing fighter).
--
-- Safe to run multiple times (idempotent).
-- Depends on: 0011_manager_roster_workflow.sql
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.manager_fighters
  ADD COLUMN IF NOT EXISTS invite_email_status TEXT
    CHECK (invite_email_status IN ('queued','sent','failed'));
