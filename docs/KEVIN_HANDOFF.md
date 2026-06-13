# The Eleventh Round — Kevin Handoff Requirements (Option A: Managed Handoff)

> No secret values appear in this document — variable **names** and **where to get them** only.
> Generated from a full repo audit (code, `render.yaml`, `.env.example`, `vercel.json`).

---

## A. Final managed-handoff model

- **Kevin** gets **app admin access** (admin dashboard login) and **owns the business accounts** (Stripe, SendGrid, domain, social).
- **Buildora** keeps **Vercel + Render + GitHub** deployment/hosting control and configures all production keys securely.
- **Kevin does NOT need Vercel or Render access.** He never logs into hosting.
- **Buildora needs specific keys/details from Kevin** (business-owned) to finish production configuration. Buildora pastes them into the hosting dashboards — Kevin never touches env vars.

---

## B. Required from Kevin before production launch

### 1. Stripe
- **Does Kevin need a Stripe account?** **Yes** — it must be the business's own Stripe account (revenue lands there).
- **Test vs live:** Configure in **test mode** first to verify, then switch to **live mode** for launch. Each mode has its own keys + its own webhook secret.
- **Values needed:**
  - `VITE_STRIPE_PUBLISHABLE_KEY` — `pk_live_…` (frontend, safe to expose)
  - `STRIPE_SECRET_KEY` — `sk_live_…` (backend, secret)
  - `STRIPE_WEBHOOK_SECRET` — `whsec_…` (created when the webhook endpoint is added)
- **Webhook URL** (note: repo's real backend service is `er-api`, not `eleventh-round-api` — confirm the live Render URL before saving):
  - `https://er-api.onrender.com/api/stripe/webhook`
- **Events the code handles** (select these when creating the webhook):
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `payment_intent.succeeded`  *(also handled — recommended)*
  - `payment_intent.payment_failed`  *(also handled — recommended)*
- **Dashboard steps:**
  1. Kevin: create/confirm the business Stripe account; complete business + bank details for payouts.
  2. Kevin: copy the publishable + secret keys (Developers → API keys) and share securely.
  3. Buildora: Developers → Webhooks → **Add endpoint** with the URL above, select the events, copy the signing secret (`whsec_…`).
  4. Buildora: set the 3 values in Render/Vercel and redeploy.
- **Note:** Stripe **Connect / fighter payouts are NOT connected** — this is **package/membership + apparel checkout billing only**. No money is split or paid out to fighters by the platform.

### 2. SendGrid / Email
- **Used?** Yes — the email service **prefers SendGrid**, with optional SMTP fallback. Transactional emails (verification, password reset, notifications) need it to actually send.
- **Values needed:**
  - `SENDGRID_API_KEY` — from SendGrid → Settings → API Keys (Mail Send permission)
  - `SENDGRID_FROM_EMAIL` — likely `contact@eleventh-rnd.us`
  - `SENDGRID_FROM_NAME` — `The Eleventh Round` (Buildora can default this)
- **Sender email needed:** confirm **`contact@eleventh-rnd.us`** (current default in code).
- **Domain verification / DNS:** SendGrid **Sender Authentication** requires adding CNAME records to the domain's DNS so emails aren't marked spam (Kevin/domain owner adds them, or grants Buildora DNS access).
- **Supabase custom SMTP (later, for branded auth emails):** Supabase's built-in auth emails are generic. To brand them, point Supabase Auth → SMTP at SendGrid:
  - Host: `smtp.sendgrid.net`
  - Port: `587`
  - Username: `apikey` (literally the word)
  - Password: the SendGrid API key
- **Optional until live:** Email is **optional to boot** — the server runs without it and just skips sending. It becomes **required once transactional/branded emails go live**. (An SMTP provider — `EMAIL_HOST/EMAIL_USER/EMAIL_PASS` — can substitute for SendGrid if preferred.)

### 3. Domain / DNS
- **Domain(s) seen in repo:** `eleventh-rnd.us` (sender email, footer, contact) **and** `eleventh-rnd.com` (subdomain feature default + README example). **Kevin must confirm the one canonical production domain.**
- **Current beta URL (live now):** `https://eleventh-round-beta.vercel.app`
- **Does Kevin own the domain?** Confirm ownership / registrar login (or grant Buildora DNS access).
- **DNS needed for:**
  - Frontend custom domain → **Vercel** (CNAME/A per Vercel instructions) — only if moving off the `.vercel.app` URL.
  - Optional backend custom domain → **Render** — only if you don't want the `onrender.com` URL.
  - **SendGrid** domain authentication (CNAMEs) — for deliverability.
  - **Supabase** auth redirect URLs — must be updated if a custom domain is used (see §4).
- If staying on the beta URL for launch, **no DNS work is required** — everything already points to `eleventh-round-beta.vercel.app`.

### 4. Supabase
**Buildora currently owns/controls the Supabase project.** These are **Buildora-held** (already configured):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**What Kevin needs to do / decide:**
- Confirm his **admin email address** (used to create his admin login).
- Complete **password reset / first login** to the admin dashboard.
- **Ownership decision:** stay on Buildora's Supabase project (managed) or migrate to a business-owned Supabase org later (optional; not required for launch).

**Auth URL config (Supabase → Authentication → URL Configuration):**
- **Site URL:** `https://eleventh-round-beta.vercel.app` (or the final domain)
- **Redirect URLs:**
  - `https://eleventh-round-beta.vercel.app/**`
  - `https://eleventh-round-beta.vercel.app/reset-password`
  - `https://eleventh-round-beta.vercel.app/verify-email`
  - `http://localhost:5173/**`

**Storage buckets required (Supabase → Storage):**
- `public-assets` (public) — fighter headshots/banners/media-kits, sponsor logos
- `obligation-proofs` (public) — obligation proof uploads
- `education-content` (public) — admin module PDFs

*(Migration `0021_storage_buckets.sql` creates these; Buildora runs it or creates them in the dashboard.)*

### 5. Hosting
- **Buildora keeps Vercel + Render + GitHub.** Kevin provides **no** Vercel/Render keys and needs no hosting login.
- **Render cold starts:** the API is on Render's **free** plan today (sleeps after ~15 min idle → 5–30s first-load delay). Recommend upgrading to remove cold starts.
- **Cost approval (Kevin, if passed to him):**
  - Render **Starter ($7/mo)** = always-on, removes cold starts (minimum recommended), or
  - Render **Pro (~$25/mo)** + compute for more headroom.
- **Vercel** can stay on its current plan unless traffic/limits are hit.

### 6. Social links / brand assets — Kevin to confirm
- **Instagram:** `https://www.instagram.com/eleventhrnd` (confirm correct handle)
- **Logo files** (final, high-res)
- **Team headshots** (final images for the Team page)
- **Podcast links** (Spotify / Apple / YouTube show URLs)
- **Apparel purchase URLs** — apparel checkout currently runs through **Stripe** (built in). If any products should instead link out to **Shopify/external** stores, Kevin must provide those product URLs (Shopify is **not** wired in code today).

### 7. Optional / not currently implemented (searched, not used in code)
- **Shopify API / Storefront** — declared in config only; **not implemented**. Apparel uses Stripe checkout.
- **Twilio / SMS / OTP** — **not present** (no phone/SMS auth by design).
- **Stripe Connect / fighter payouts** — **not connected** (package/apparel billing only).
- **Google Analytics 4 / GA4 / Meta / Facebook Pixel** — GA4 vars declared in config only; **not implemented**.
- **Instagram API / LinkedIn API** — **not present** (social handles are static links only).
- **OpenAI / Anthropic** — **not present** (no AI features).
- **Cloudinary / AWS S3** — **not present** (file storage is Supabase Storage).
- **Calendly** — vars declared in config only; **not wired in code** (mentorship links are static).
- **Spotify Web API** — vars declared in config only; podcast uses static/embed links.

---

## C. Exact environment variable table

> "Provider = Buildora" means Buildora already has/controls it. "Kevin" means it must come from Kevin's business account.

### Backend — Render dashboard

| Env var | Location | Required for launch? | Who provides | Where to get it | Notes |
|---|---|---|---|---|---|
| `NODE_ENV` | Render | Yes | Buildora | set to `production` | — |
| `PORT` | Render | Auto | Render | injected by Render | code honors `process.env.PORT` |
| `LOG_LEVEL` | Render | No | Buildora | `info` | optional |
| `CLIENT_URL` | Render | Yes | Buildora | Vercel frontend URL | used for CORS + email links + Stripe redirects |
| `CORS_EXTRA_ORIGINS` | Render | No | Buildora | comma-list of extra origins | only if custom domain added |
| `DATABASE_URL` | Render | Recommended | Buildora | Supabase → Settings → Database (pooler URL) | removes "no pool" fallback; improves speed |
| `SUPABASE_DB_URL` | Render | No | Buildora | alt to `DATABASE_URL` | either one |
| `PG_POOL_MAX` / `PG_IDLE_MS` / `PG_CONN_MS` | Render | No | Buildora | tuning defaults (15 / 10000 / 5000) | optional |
| `SUPABASE_URL` | Render | Yes | Buildora | Supabase → Settings → API | — |
| `SUPABASE_ANON_KEY` | Render | Yes | Buildora | Supabase → Settings → API | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Render | Yes | Buildora | Supabase → Settings → API | **server-only secret** |
| `SENDGRID_API_KEY` | Render | For email | Kevin/Buildora | SendGrid → API Keys | optional until emails go live |
| `SENDGRID_FROM_EMAIL` | Render | For email | Kevin | `contact@eleventh-rnd.us` | verified sender |
| `SENDGRID_FROM_NAME` | Render | No | Buildora | `The Eleventh Round` | display name |
| `FROM_EMAIL` | Render | No | Buildora | fallback sender | defaults to `contact@eleventh-rnd.us` |
| `EMAIL_HOST` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_PORT` / `EMAIL_SECURE` | Render | No | Kevin/Buildora | SMTP provider | only if using SMTP instead of SendGrid |
| `STRIPE_SECRET_KEY` | Render | Yes (billing) | Kevin | Stripe → API keys | `sk_live_…` secret |
| `STRIPE_WEBHOOK_SECRET` | Render | Yes (billing) | Kevin/Buildora | Stripe → Webhooks | `whsec_…` per endpoint |
| `AUTH_AUTOCONFIRM` | Render | No | Buildora | leave unset in prod | dev convenience only; off = real email confirmation |
| `RATE_LIMIT_PUBLIC_PER_MIN` | Render | No | Buildora | default 20 | optional |
| `OUTBOX_POLL_MS` / `OUTBOX_BATCH_SIZE` | Render | No | Buildora | job tuning | optional |

### Frontend — Vercel dashboard

| Env var | Location | Required for launch? | Who provides | Where to get it | Notes |
|---|---|---|---|---|---|
| `VITE_API_BASE_URL` | Vercel | Yes | Buildora | Render backend URL (e.g. `https://er-api.onrender.com`) | no trailing slash, no `/api` |
| `VITE_SUPABASE_URL` | Vercel | Yes | Buildora | same as `SUPABASE_URL` | — |
| `VITE_SUPABASE_ANON_KEY` | Vercel | Yes | Buildora | same as `SUPABASE_ANON_KEY` | client-safe |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Vercel | Yes (billing) | Kevin | Stripe → API keys | `pk_live_…` client-safe |
| `VITE_DOMAIN` | Vercel | No | Buildora/Kevin | canonical domain | only for the team-subdomain feature |

### Declared in config but NOT consumed by current code (skip for launch)
`SUPABASE_JWT_SECRET`, `STRIPE_PRICE_MEMBERSHIP_MONTHLY`, `STRIPE_PRICE_MEMBERSHIP_ANNUAL`, `TEAM_NOTIFY_EMAIL`, `OVERDUE_SCAN_INTERVAL_MIN`, `RATE_LIMIT_WEBHOOK_PER_MIN`, `CALENDLY_*`, `SHOPIFY_STORE_URL`, `SHOPIFY_STOREFRONT_TOKEN`, `SPOTIFY_SHOW_ID`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `GA4_API_SECRET`, `VITE_GA4_MEASUREMENT_ID` — future phases; not needed to launch.

---

## D. Kevin action checklist

- [ ] Confirm your **admin email address** for the dashboard.
- [ ] Complete **password reset / first login** once Buildora sends the link.
- [ ] Create/confirm the **business Stripe account** and finish business + bank details.
- [ ] Share **Stripe publishable + secret keys** securely (test first, then live).
- [ ] Approve Buildora **creating the Stripe webhook** on your account.
- [ ] Provide a **SendGrid API key** (or approve Buildora creating SendGrid on the business account).
- [ ] Confirm the **sender email** (`contact@eleventh-rnd.us`).
- [ ] Provide **domain/registrar/DNS access** (or add the DNS records Buildora sends) — only if using a custom domain or SendGrid domain auth.
- [ ] Confirm the **canonical domain** (`eleventh-rnd.us` vs `.com`).
- [ ] Approve **Render Starter ($7/mo)** (or Pro) to remove cold starts.
- [ ] Provide **external apparel purchase URLs** if any products should link out instead of Stripe checkout.
- [ ] Confirm **podcast links** (Spotify/Apple/YouTube) and the **Instagram** handle.
- [ ] Confirm the **launch domain/URL**.

## E. Buildora action checklist

- [ ] Set all backend env vars in **Render**; set frontend `VITE_*` in **Vercel**.
- [ ] Run **Supabase migrations** (including `0021_storage_buckets.sql`).
- [ ] Create/verify **storage buckets**: `public-assets`, `obligation-proofs`, `education-content`.
- [ ] Configure **Supabase Auth URLs** (Site URL + redirect URLs).
- [ ] Create the **Stripe webhook** endpoint, capture `STRIPE_WEBHOOK_SECRET`.
- [ ] Configure SendGrid sender + (optional) Supabase custom SMTP.
- [ ] Send Kevin his **password reset / admin login** link.
- [ ] Deploy **backend (Render)** and **frontend (Vercel)**.
- [ ] Test **billing checkout** (apparel + membership).
- [ ] Test **SendGrid email** send.
- [ ] Test **forgot password** flow.
- [ ] Test **file upload** (headshot/banner/media kit).
- [ ] Test **all dashboards** (fighter/manager/admin/sponsor).
- [ ] (Recommended) Upgrade Render off free plan to remove cold starts.

## F. Copy-paste message to Kevin

> Hi Kevin — we're getting The Eleventh Round ready for production. Good news: **you don't need any hosting or technical logins** — we manage all the deployment and configure the production keys securely on our side.
>
> To finish setup, we just need a few **business-owned accounts** from you:
>
> 1. **Stripe** — your business Stripe account so payments go to you. We'll need the API keys (we'll walk you through copying them), and we'll set up the payment webhook for you. (This covers memberships and apparel checkout — there are no fighter payouts to configure.)
> 2. **Email sending** — approval to use SendGrid for system emails (verification, password resets, notifications), and confirmation that **contact@eleventh-rnd.us** is the right "from" address.
> 3. **Domain** — confirmation of your main domain (we see both **eleventh-rnd.us** and **eleventh-rnd.com** in the project) and, if you want a custom web address, access to add a couple of DNS records (or we can send you the exact records to paste).
> 4. **Hosting cost** — to remove the small first-load delay, we recommend a **$7/mo** always-on server plan; just need your OK.
> 5. **A few confirmations** — your admin email for login, your Instagram handle, podcast links, and whether any apparel items should link to an outside store.
>
> One important thing: **please don't send passwords or keys over plain email or WhatsApp.** Let's do a quick screen-share call, or share them through a password manager / secure link — we'll guide you so it takes only a few minutes.
>
> Once we have these, we'll handle the rest and get you a login. Thanks!
