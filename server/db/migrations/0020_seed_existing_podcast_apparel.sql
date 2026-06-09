-- ─────────────────────────────────────────────────────────────────────────────
-- 0020  Seed existing hardcoded podcast episodes and apparel products
--
-- Source: old frontend EPISODES and PRODUCTS constants (recovered from git
--         commit e5e1f6e before the CMS rewrite in commit e7a7fdb).
--
-- Rules:
--   - WHERE NOT EXISTS on slug — fully idempotent, safe to re-run.
--   - No fake/invented data — only real content from the old frontend.
--   - All rows marked status='published' (they were publicly visible).
--   - No Spotify/Apple/YouTube URLs — they were never in the old frontend.
--   - No external_url/shopify_url — old apparel used an internal cart.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Podcast episodes ──────────────────────────────────────────────────────────
-- E012  Building a Career After the Belt
INSERT INTO public.podcast_episodes
  (title, slug, episode_number, season, guest_name, guest_title,
   duration, tags, status, sort_order, published_at, created_at, updated_at)
SELECT
  'Building a Career After the Belt',
  'building-a-career-after-the-belt',
  12, 1,
  'Marcus Torres', 'Former WBA Champion',
  '58m', ARRAY['career-transition'],
  'published', 10, now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.podcast_episodes WHERE slug = 'building-a-career-after-the-belt'
);

-- E011  What Sponsors Actually Want
INSERT INTO public.podcast_episodes
  (title, slug, episode_number, season, guest_name, guest_title,
   duration, tags, status, sort_order, published_at, created_at, updated_at)
SELECT
  'What Sponsors Actually Want',
  'what-sponsors-actually-want',
  11, 1,
  'Kira Fontaine', 'Sports Brand Director',
  '44m', ARRAY['sponsorship'],
  'published', 20, now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.podcast_episodes WHERE slug = 'what-sponsors-actually-want'
);

-- E010  Managing a Roster Without Burning Out
INSERT INTO public.podcast_episodes
  (title, slug, episode_number, season, guest_name, guest_title,
   duration, tags, status, sort_order, published_at, created_at, updated_at)
SELECT
  'Managing a Roster Without Burning Out',
  'managing-a-roster-without-burning-out',
  10, 1,
  'Ray Callahan', 'Independent Manager',
  '51m', ARRAY['management'],
  'published', 30, now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.podcast_episodes WHERE slug = 'managing-a-roster-without-burning-out'
);

-- E009  Financial Literacy No One Taught You
INSERT INTO public.podcast_episodes
  (title, slug, episode_number, season, guest_name, guest_title,
   duration, tags, status, sort_order, published_at, created_at, updated_at)
SELECT
  'Financial Literacy No One Taught You',
  'financial-literacy-no-one-taught-you',
  9, 1,
  'Devon Price CPA', 'Combat Sports Accountant',
  '62m', ARRAY['finance'],
  'published', 40, now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.podcast_episodes WHERE slug = 'financial-literacy-no-one-taught-you'
);

-- E008  Brand Before the Fight Camp Starts
INSERT INTO public.podcast_episodes
  (title, slug, episode_number, season, guest_name, guest_title,
   duration, tags, status, sort_order, published_at, created_at, updated_at)
SELECT
  'Brand Before the Fight Camp Starts',
  'brand-before-the-fight-camp-starts',
  8, 1,
  'Anya Solis', 'Featherweight Contender',
  '39m', ARRAY['branding'],
  'published', 50, now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.podcast_episodes WHERE slug = 'brand-before-the-fight-camp-starts'
);

-- E007  The Contract You Should Have Read
INSERT INTO public.podcast_episodes
  (title, slug, episode_number, season, guest_name, guest_title,
   duration, tags, status, sort_order, published_at, created_at, updated_at)
SELECT
  'The Contract You Should Have Read',
  'the-contract-you-should-have-read',
  7, 1,
  'James Okafor Esq.', 'Combat Sports Attorney',
  '55m', ARRAY['contracts'],
  'published', 60, now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.podcast_episodes WHERE slug = 'the-contract-you-should-have-read'
);

-- ── Apparel products (Resilience Line) ───────────────────────────────────────
-- Classic Joggers — Onyx
INSERT INTO public.apparel_products
  (name, slug, description, price_display, category, collection,
   image_path, gallery_images, sizes, colors,
   badge, featured, status, sort_order, created_at, updated_at)
SELECT
  'Classic Joggers',
  'classic-joggers-onyx',
  'Heavyweight French terry construction. Tapered fit, ribbed cuffs, deep pockets. Built to move. The foundational piece of the Resilience Line.',
  '$40',
  'joggers', 'Resilience Line',
  '/apparel/products/black-joggers-1.png',
  ARRAY['/apparel/products/black-joggers-1.png', '/apparel/products/black-joggers-2.png',
        '/apparel/products/black-joggers-3.png', '/apparel/products/black-joggers-4.png'],
  ARRAY['XS/28', 'S/30', 'M/32', 'L/34', 'XL/36', 'XXL/38'],
  ARRAY['Onyx'],
  'Best Seller', true,
  'published', 10, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.apparel_products WHERE slug = 'classic-joggers-onyx'
);

-- Classic Joggers — Bone
INSERT INTO public.apparel_products
  (name, slug, description, price_display, category, collection,
   image_path, gallery_images, sizes, colors,
   badge, featured, status, sort_order, created_at, updated_at)
SELECT
  'Classic Joggers',
  'classic-joggers-bone',
  'Same heavyweight construction as the Onyx — in a clean off-white that holds its own. Pairs with every piece in the line.',
  '$40',
  'joggers', 'Resilience Line',
  '/apparel/products/white-joggers-1.png',
  ARRAY['/apparel/products/white-joggers-1.png', '/apparel/products/white-joggers-2.png',
        '/apparel/products/white-joggers-3.png', '/apparel/products/white-joggers-4.png'],
  ARRAY['XS/28', 'S/30', 'M/32', 'L/34', 'XL/36', 'XXL/38'],
  ARRAY['Bone'],
  'New', false,
  'published', 20, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.apparel_products WHERE slug = 'classic-joggers-bone'
);

-- Heavyweight Hoodie — Onyx
INSERT INTO public.apparel_products
  (name, slug, description, price_display, category, collection,
   image_path, gallery_images, sizes, colors,
   badge, featured, status, sort_order, created_at, updated_at)
SELECT
  'Heavyweight Hoodie',
  'heavyweight-hoodie-onyx',
  '16oz premium fleece. Dropped shoulders, double-lined hood, heavyweight ribbing. Worn during camp, worn after. Built for longevity.',
  '$45',
  'hoodie', 'Resilience Line',
  '/apparel/products/black-hoodie-1.png',
  ARRAY['/apparel/products/black-hoodie-1.png', '/apparel/products/black-hoodie-2.png',
        '/apparel/products/black-hoodie-3.png', '/apparel/products/black-hoodie-4.png'],
  ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  ARRAY['Onyx'],
  'Signature', true,
  'published', 30, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.apparel_products WHERE slug = 'heavyweight-hoodie-onyx'
);

-- Heavyweight Hoodie — Bone
INSERT INTO public.apparel_products
  (name, slug, description, price_display, category, collection,
   image_path, gallery_images, sizes, colors,
   badge, featured, status, sort_order, created_at, updated_at)
SELECT
  'Heavyweight Hoodie',
  'heavyweight-hoodie-bone',
  'The Bone Hoodie. Clean, minimal, and unmistakably Eleventh Round. The off-white tone was built to wear in with time.',
  '$45',
  'hoodie', 'Resilience Line',
  '/apparel/products/white-hoodie-1.png',
  ARRAY['/apparel/products/white-hoodie-1.png', '/apparel/products/white-hoodie-2.png',
        '/apparel/products/white-hoodie-3.png', '/apparel/products/white-hoodie-4.png'],
  ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  ARRAY['Bone'],
  'Signature', false,
  'published', 40, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.apparel_products WHERE slug = 'heavyweight-hoodie-bone'
);

-- Resilience Tee — White
INSERT INTO public.apparel_products
  (name, slug, description, price_display, category, collection,
   image_path, gallery_images, sizes, colors,
   badge, featured, status, sort_order, created_at, updated_at)
SELECT
  'Resilience Tee',
  'resilience-tee-white',
  '220gsm heavyweight cotton. Slightly oversized boxy cut, reinforced neckline, minimal Eleventh Round wordmark at chest.',
  '$35',
  'tee', 'Resilience Line',
  '/apparel/products/white-tee-1.png',
  ARRAY['/apparel/products/white-tee-1.png', '/apparel/products/white-tee-2.png',
        '/apparel/products/white-tee-3.png', '/apparel/products/white-tee-4.png'],
  ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  ARRAY['White'],
  'Essential', false,
  'published', 50, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.apparel_products WHERE slug = 'resilience-tee-white'
);

-- Resilience Tee — Onyx
INSERT INTO public.apparel_products
  (name, slug, description, price_display, category, collection,
   image_path, gallery_images, sizes, colors,
   badge, featured, status, sort_order, created_at, updated_at)
SELECT
  'Resilience Tee',
  'resilience-tee-onyx',
  'The tee that started the line. Same boxy cut and heavyweight cotton in jet black — designed to be worn until it earns its history.',
  '$35',
  'tee', 'Resilience Line',
  '/apparel/products/black-tee-1.png',
  ARRAY['/apparel/products/black-tee-1.png', '/apparel/products/black-tee-2.png',
        '/apparel/products/black-tee-3.png', '/apparel/products/black-tee-4.png'],
  ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  ARRAY['Onyx'],
  'Essential', false,
  'published', 60, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.apparel_products WHERE slug = 'resilience-tee-onyx'
);
