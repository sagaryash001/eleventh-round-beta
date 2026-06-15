-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Backfill onboarding_complete for existing sponsors
--
-- Sponsors now finish onboarding only once their company profile exists
-- (sponsor_profiles row), not when they answer the registration questionnaire.
--
-- Older sponsors may have a company profile but a stale onboarding_complete=false
-- (e.g. their row was created via /api/sponsor/onboard before that endpoint set
-- the flag). Without this, they'd be bounced back into company setup on login.
-- Mark every sponsor who already has a sponsor_profiles row as onboarded so they
-- reach their dashboard normally — no re-registration required.
--
-- Idempotent. Safe to re-run. Depends on: 0002 (profiles), 0002/0003 (sponsor_profiles).
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.profiles AS p
SET    onboarding_complete = true
FROM   public.sponsor_profiles AS sp
WHERE  sp.user_id = p.id
  AND  p.role = 'sponsor'
  AND  p.onboarding_complete IS DISTINCT FROM true;
