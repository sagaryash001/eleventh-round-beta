-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Uploads + Public Profiles
--
-- Extends fighter_profiles with headshot_path and bio.
-- All other upload-related columns already exist (banner_path, media_kit_url,
-- highlight_video_urls in 0002; obligation_proofs.proof_value in 0005).
--
-- Depends on: 0001_init.sql, 0002_marketplace_profiles.sql
--
-- Storage buckets to create manually in Supabase dashboard:
--   public-assets   (public)  — headshots, banners, logos
--   obligation-proofs (public) — proof file uploads
--   education-content (public) — module PDFs
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND fighter_profiles ───────────────────────────────────────────────
-- headshot_path: Supabase Storage path in 'public-assets' bucket
-- bio:           short public bio for fighter profile page
ALTER TABLE public.fighter_profiles
  ADD COLUMN IF NOT EXISTS headshot_path TEXT;

ALTER TABLE public.fighter_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- ── 2. INDEX for fast public slug lookups ────────────────────────────────────
-- idx_fighter_public_slug already created by 0002 — no-op needed.
-- Add index on manager profiles subdomain for team page lookups.
CREATE INDEX IF NOT EXISTS idx_profiles_subdomain_role
  ON public.profiles (subdomain, role)
  WHERE subdomain IS NOT NULL;
