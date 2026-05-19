# The Eleventh Round — React App

Premium cinematic platform website for The Eleventh Round combat sports ecosystem.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Tech Stack

- **React 18** + **TypeScript**
- **Vite 5**
- **Tailwind CSS 3**
- **React Router DOM 6**
- **GSAP 3** + ScrollTrigger (hero scroll sequence)
- **Google Fonts** — Bebas Neue · Barlow Condensed · Barlow

---

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Full landing page with intro, hero, problems, products, dashboard preview, CTA |
| `/login` | Unified login — role auto-detected from credentials |
| `/podcast` | Podcast ecosystem page |
| `/apparel` | Apparel collections page |
| `/dashboard/fighter` | Fighter dashboard (protected) |
| `/dashboard/manager` | Manager dashboard (protected) |
| `/dashboard/admin` | Admin dashboard (protected) |

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Fighter | `fighter@demo.com` | `fighter123` |
| Manager | `manager@demo.com` | `manager123` |
| Admin | `admin@demo.com` | `admin123` |

---

## Landing Page Sections

1. **Intro Sequence** — Animated 1→100 counter with soft diffuse strobe lights, red seep gradient, cinematic exit
2. **Hero** — GSAP ScrollTrigger canvas frame sequence (40 video frames, scroll-driven)
3. **Problems** — Zigzag hexagon map, staggered scroll reveal, click-to-expand detail panels
4. **Products Carousel** — Drag/swipe horizontal carousel, click-to-expand product cards, Podcast + Apparel ecosystem cards link to dedicated pages
5. **Dashboard Preview** — Role-tab switcher showing Command Center, Fighter, Manager, Promotions mock UIs
6. **Final CTA** — Ghost XI number, bold closing copy, three CTAs

---

## Dashboard Features

### Fighter Dashboard
- Personal readiness score ring
- Pipeline stage tracker (5 stages)
- Obligations tracker (sponsor + media)
- Education module progress grid
- SponsorForge access (gated)
- Mentorship session management
- Transition planning (gated)
- Profile management

### Manager Dashboard (MGMT-SUITE Lite)
- Operations overview
- Roster management with readiness per fighter
- Sponsor/media obligation tracking
- SponsorForge eligibility per fighter
- Operations playbooks
- Budget & camp planning
- Reporting & export

### Admin Dashboard
- Platform-wide overview
- User/role management
- Mentor & consultant management
- SponsorForge network admin
- Package & subscription overview
- Content & education module management
- System reports & exports

---

## Project Structure

```
src/
  components/
    IntroSequence.tsx     # Animated intro with soft strobes
    HeroSection.tsx       # GSAP ScrollTrigger canvas frames
    ProblemsSection.tsx   # Zigzag hex map with scroll reveal
    ProductsCarousel.tsx  # Drag/swipe carousel
    DashboardPreview.tsx  # Landing page dashboard preview
    FinalCTA.tsx
    Navbar.tsx
    Footer.tsx
  pages/
    HomePage.tsx
    LoginPage.tsx
    PodcastPage.tsx
    ApparelPage.tsx
    dashboards/
      DashShell.tsx       # Shared sidebar + topbar shell
      DashWidgets.tsx     # Reusable dashboard UI components
      FighterDashboard.tsx
      ManagerDashboard.tsx
      AdminDashboard.tsx
  hooks/
    useAuth.tsx           # Auth context with demo credentials
    useScrollReveal.ts    # Intersection observer helper
  data/
    frames.ts             # Base64 hero frame sequence (40 frames)
    problems.ts           # 9 problem definitions
    products.ts           # 4 product cards
  index.css               # Tailwind + design system
  App.tsx                 # Router + auth provider
  main.tsx
```

---

## Backend

The backend lives in `/server` as an Express API on port 3001. The Vite dev
server proxies `/api/*` to it (see `vite.config.ts`), so calls like
`fetch('/api/auth/me')` from the frontend just work — no CORS, no env shuffling.

### Stack

| Layer | Choice |
|---|---|
| Runtime | Node 18+ (ESM) |
| Framework | Express 4 |
| Database | **Supabase Postgres** (with RLS) |
| Auth | **Supabase Auth** (email + password, branded SendGrid emails) |
| Realtime | **Supabase Realtime** (overdue obligation broadcasts) |
| Storage | **Supabase Storage** (team headshots, gallery) |
| Email | **SendGrid** (verification, welcome, leads, receipts, alerts) |
| Payments | **Stripe** (Checkout + webhooks) — Phase 3 |
| Bookings | **Calendly** (link-out + webhook) — Phase 4 |
| Apparel | **Shopify** (external storefront + click tracking) — Phase 5 |
| Podcast | **Spotify** (RSS / Web API sync) — Phase 5 |
| Analytics | **GA4** (client) + Measurement Protocol (server) — Phase 7 |
| Validation | **zod** |
| Rate limit | **express-rate-limit** |
| Logging | **pino** + **pino-http** |

### One-time Supabase setup

1. **Create a project** at https://supabase.com/dashboard.
   Choose the closest region. Save the database password — you won't need
   it day-to-day, but you'll need it to reset the DB.

2. **Grab credentials** from *Project Settings → API*:
   - Project URL → `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - JWT Secret → `SUPABASE_JWT_SECRET`

3. **Run the migration**. Open *SQL Editor → New query*, paste the contents
   of `server/db/migrations/0001_init.sql`, and click *Run*. This creates
   every table for every phase, with Row Level Security policies.

4. **Enable Realtime on `obligations`** (the migration already does this
   via SQL, but if it didn't run, you can toggle it in
   *Database → Replication → supabase_realtime*).

5. **Create storage buckets**: *Storage → Create bucket* → `team` (public),
   then again for `gallery` (public).

6. **Configure auth URLs**: *Authentication → URL Configuration*
   - Site URL: your production URL (e.g. `https://eleventh-rnd.com`)
   - Redirect URLs: add `http://localhost:5173/**` for dev and your
     production URL too. The `/verify-email` route will catch the redirect.

7. **(Optional) Email templates**: We override Supabase's verification email
   with our own branded SendGrid template, so the default Supabase emails are
   never sent. No template work needed in the dashboard.

### Backend setup

```bash
# 1. Copy the example env and fill in the keys you have
cp .env.example .env

# 2. Install backend deps
cd server && npm install && cd ..

# 3. Install frontend deps (adds @supabase/supabase-js)
npm install

# 4. Run the API and the Vite dev server in two terminals
cd server && npm run dev      # → http://localhost:3001
npm run dev                   # → http://localhost:5173
```

The API's `/api/health` endpoint reports which integrations are wired up:
```bash
curl http://localhost:3001/api/health
# { "ok": true, "supabase": true, "sendgrid": false, ... }
```

### Folder structure

```
server/
├── index.js                 # Express bootstrap
├── db/
│   ├── supabase.js          # Service-role singleton
│   └── migrations/
│       └── 0001_init.sql    # Full schema for all 8 phases
├── lib/
│   ├── logger.js            # pino structured logger
│   └── validate.js          # zod schemas + validate() middleware
├── middleware/
│   └── auth.js              # requireAuth, requireAdmin, optionalAuth
├── routes/
│   └── auth.js              # /api/auth/* (Supabase Auth + branded emails)
└── services/
    └── email.js             # SendGrid branded transactional templates
```

Each subsequent phase adds new files in the same shape — see the architecture
proposal in this PR's history for the full Phase 1–8 plan.

### Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` are **server-only**.
  They are never prefixed `VITE_*` and never imported from anything in `src/`.
- All public endpoints (`/api/auth/*`, leads, etc.) are rate-limited per IP.
- All inputs are validated with zod schemas before they touch the database.
- Stripe webhook signature verification uses the **raw body** — wired ahead
  of `express.json()` in `index.js`.
- Every table has RLS enabled. Users only see their own rows. The Express
  backend uses the service role, which bypasses RLS for admin/cross-user reads.
- Pino redacts `authorization`, `cookie`, `password`, and `token` fields
  from logs automatically.

---

## Deployment

The app deploys to **two services**:

| Service | Hosts | Provider |
|---|---|---|
| Frontend (Vite SPA) | `eleventh-round-beta.vercel.app` | Vercel |
| Backend (Express API) | `er-api.onrender.com` | Render |

### Vercel (frontend)

Already connected. `vercel.json` handles SPA fallback so deep links to
`/team`, `/login`, etc. don't 404. Add these env vars in
*Vercel Dashboard → Project → Settings → Environment Variables*:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_API_BASE_URL=https://er-api.onrender.com
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX           # Phase 7
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...        # Phase 3
```

Redeploy after adding env vars (Vercel doesn't rebuild automatically when
they change).

### Render (backend)

The repo has a `render.yaml` Blueprint, so setup is one click:

1. Go to https://dashboard.render.com → **New → Blueprint**
2. Connect this GitHub repo → Render reads `render.yaml` and proposes a
   service called `er-api`
3. Click **Apply**. Render builds and starts. You'll get a URL like
   `https://er-api.onrender.com`
4. In *Service → Environment*, paste the values for the variables marked
   `sync: false` in `render.yaml`. At minimum for Phase 1 you need:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `SENDGRID_API_KEY` (or leave blank — emails just skip)
5. Render redeploys with the new env vars. Smoke-test:
   ```bash
   curl https://er-api.onrender.com/api/health
   # { "ok": true, "supabase": true, "sendgrid": true, ... }
   ```
6. Back in Vercel, set `VITE_API_BASE_URL=https://er-api.onrender.com` and
   redeploy the frontend.

**Free-tier caveat:** Render's free plan sleeps the service after 15 min
idle. First request after sleep takes ~30s to spin up. Bump to the $7/mo
"Starter" plan for always-on production. Not a problem during development.

### Frontend ↔ backend wiring

The frontend uses `src/lib/api.ts` → `apiFetch()` for every backend call.
In development, `VITE_API_BASE_URL` is unset and Vite's dev proxy forwards
`/api/*` to `localhost:3001`. In production, `VITE_API_BASE_URL` points
at Render and the same calls go cross-origin (CORS allow-list in
`server/index.js` already permits `*.vercel.app` and `*.eleventh-rnd.com`).

