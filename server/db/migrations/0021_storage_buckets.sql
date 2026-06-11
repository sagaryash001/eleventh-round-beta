-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Storage buckets + policies
--
-- ROOT CAUSE FIX: fighter headshot / banner / media-kit uploads were failing
-- with the Supabase error "The related resource does not exist". That message
-- is returned by storage.createSignedUploadUrl() when the target BUCKET does
-- not exist. Migrations 0001 / 0002 / 0015 only *documented* that these buckets
-- must be created "manually in the dashboard" — they never were.
--
-- This migration creates the three documented buckets idempotently so uploads
-- work without any manual dashboard step.
--
--   public-assets      (public) — fighter headshots/banners/media-kits, sponsor logos
--   obligation-proofs  (public) — obligation proof uploads
--   education-content  (public) — admin module PDFs
--
-- Upload authorization note:
--   Uploads are signed server-side with the SERVICE-ROLE key (see
--   server/routes/uploads.js), which BYPASSES RLS. The clients then PUT to the
--   short-lived signed URL. So the storage.objects policies below are
--   defense-in-depth (and to make public reads explicit) — the hard requirement
--   for uploads to work is simply that the bucket EXISTS.
--
-- Idempotent: bucket inserts use ON CONFLICT; policies use DROP ... IF EXISTS
-- then CREATE (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. BUCKETS ───────────────────────────────────────────────────────────────
-- file_size_limit = 10 MB covers the largest allowed upload (media-kit / PDF).
-- Per-type limits (headshot 5 MB, banner 8 MB, media-kit 10 MB) are enforced in
-- server/routes/uploads.js before the signed URL is issued.
insert into storage.buckets (id, name, public, file_size_limit)
values ('public-assets', 'public-assets', true, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit);

insert into storage.buckets (id, name, public, file_size_limit)
values ('obligation-proofs', 'obligation-proofs', true, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit);

insert into storage.buckets (id, name, public, file_size_limit)
values ('education-content', 'education-content', true, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), excluded.file_size_limit);

-- ── 2. PUBLIC READ ───────────────────────────────────────────────────────────
-- Public buckets already serve objects over the public URL, but make the SELECT
-- grant explicit so the policy intent is visible and auditable.
drop policy if exists "storage public read assets" on storage.objects;
create policy "storage public read assets" on storage.objects
  for select
  using (bucket_id in ('public-assets', 'obligation-proofs', 'education-content'));

-- ── 3. OWNER-SCOPED WRITES (public-assets) ───────────────────────────────────
-- Upload paths are: {prefix}/{userId}/{file}  e.g. headshots/<uid>/<ts>-<rand>.jpg
-- so the user id is always the SECOND path segment: (storage.foldername(name))[2].
-- These apply when a client uses its own (authenticated) token; the service-role
-- signing path bypasses them entirely.
drop policy if exists "public-assets owner insert" on storage.objects;
create policy "public-assets owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "public-assets owner update" on storage.objects;
create policy "public-assets owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "public-assets owner delete" on storage.objects;
create policy "public-assets owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
