-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Event participant confirmation status
--
-- When a manager / promotion creates an event for a fighter, that fighter's
-- participation is 'pending' until they confirm (or decline) it. Self-created
-- participation and non-fighter roles (manager/promoter/sponsor) default to
-- 'confirmed' so existing rows and quick-adds are unaffected.
--
-- Participant-level (not event-level) so multiple linked fighters can each have
-- their own confirmation state.
--
-- Idempotent. Depends on: 0023 (event_participants).
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
  CHECK (status IN ('pending','confirmed','declined'));

CREATE INDEX IF NOT EXISTS idx_event_participants_status
  ON public.event_participants (user_id, status);
