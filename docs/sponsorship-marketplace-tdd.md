# Eleventh Round — Sponsor ↔ Fighter Marketplace
## Technical Design Document v1.0

**Status:** Architecture only · no implementation in this document.
**Owner:** Backend / Platform
**Last updated:** 2026-05-30
**Reviewers required before Phase 1 build:** Founder (Kevin), Backend lead (Atharv), Frontend lead

---

## 0. TL;DR for stakeholders

We are layering a **two-sided marketplace** on top of the existing single-tenant Eleventh Round dashboard product. Today's app has `profiles` for fighters/managers/admins and a half-built "SponsorForge" concept (`sponsorforge_profiles`, `sponsorforge_matches`) that captures fighter-side readiness but has **no sponsor side, no opportunities, no applications, no real matching, no contracts, no in-app messaging, and no payments**.

This TDD specifies what changes — at the schema, API, RLS, frontend, and operations layers — to turn the existing app into a production marketplace **without rewriting the parts that already work**:

- Auth (Supabase Auth + branded SendGrid flow) stays as-is.
- `profiles` stays as the canonical user table; sponsors become a 4th role.
- `obligations` and `notifications` get repurposed as marketplace-wide primitives instead of fighter-only.
- The legacy `sponsorforge_matches` table is **deprecated** in favor of the new `applications`/`contracts` model. We keep it readable for ~30 days then drop it.

Phased delivery: 6 phases, ~10 weeks of focused work for the schema + APIs + minimum-viable UI. Stripe Connect (escrow/payout to fighters) is explicitly deferred to Phase 5.

---

## 1. Existing system audit (what we're building on)

### 1.1 What's already in production
- **Frontend**: React 18 + Vite + Tailwind + Framer + GSAP, deployed on Vercel at `eleventh-round-beta.vercel.app`.
- **Backend**: Node 18 / Express 4 on Render at `eleventh-round-beta.onrender.com`. Routes: `auth`, `fighter`, `manager`, `admin`, `stripe`.
- **DB**: Supabase Postgres (project `ovhrkbxmibyzbtrupukv`, region `us-east-2`, plan `ACTIVE_HEALTHY`).
- **Auth**: Supabase Auth, JWT verified by Express middleware, profile-row owned by backend (no triggers — see §1.3 below).
- **Realtime**: `obligations` is the only table on the `supabase_realtime` publication today.
- **Storage**: Buckets `team` (public) and `gallery` (public).

### 1.2 Existing 25 tables (today)

Auth & user: `profiles`, `onboarding`
Marketing / contact: `leads`, `team_members`, `podcast_episodes`, `apparel_clicks`, `site_settings`
Membership / payment (Stripe-ready, unused): `memberships`, `payments`, `bookings`
Fighter-side dashboard data: `fighter_profiles`, `pipeline_progress`, `readiness_scores`, `education_modules`, `module_progress`, `sponsorforge_profiles`, `consultants`, `sponsorforge_matches`, `camp_budgets`, `playbooks`, `manager_fighters`
Misc: `obligations`, `alerts`, `analytics_events`

### 1.3 Architectural debt to acknowledge before we layer on more
- **`sponsorforge_matches`** is a placeholder (`fighter_id` + `sponsor_name` text — no real sponsor entity). It will be **deprecated** by Phase 2.
- **No bidirectional follow / messaging / notification primitives** exist. `alerts` is admin-broadcast only (no recipient column).
- **No audit log** yet. We'll add one as part of Phase 1.
- **Auth-trigger pitfall**: an earlier migration's `on_auth_user_created` trigger conflicted with the backend's profile-insert flow. Drop has been applied live; the migration file fix is tracked as an out-of-scope task. Phase 1 must NOT re-introduce DB triggers on `auth.users`.

---

## 2. Product principles & non-goals

### 2.1 Principles
1. **Single user table, multiple role-extension tables.** A user is one `profiles` row; their fighter / sponsor / agency / gym / promoter details live in extension tables. A user can hold multiple role extensions (a manager who also represents themselves as a fighter, for example).
2. **Server is the boss for money, contracts, and state machines.** Frontend never writes to `contracts`, `payments`, `applications.status`, or `obligations.status`. All writes go through `/api/*` routes that validate, log, and broadcast.
3. **RLS is a safety net, not the primary auth boundary.** Service-role-key Express endpoints are the trusted path. RLS prevents accidents (a leaked anon key, a misconfigured supabase-js call) but isn't relied on for business logic.
4. **Realtime is for state, not events.** Use Supabase Realtime channels for "row X changed" subscriptions (live message threads, obligation status changes). For domain events (`payment.succeeded`, `application.accepted`) use the `outbox` pattern → backend worker → SendGrid/in-app notification fan-out.
5. **Soft-delete everything user-visible** (`deleted_at`). Hard-delete reserved for admin compliance flows.
6. **Public read is opt-in per row.** Default visibility on profiles and opportunities is "private until owner publishes."

### 2.2 Explicit non-goals (v1)
- **No payout to fighters in v1.** We process sponsor card payments and hold the funds on the platform. Payout to fighters via Stripe Connect Custom is **Phase 5b** (a follow-up after Phase 5 launches).
- **No in-app contract e-signing.** v1 stores agreed terms + a "both parties accept" two-click flow. DocuSign integration is a v2 candidate.
- **No AI matching in v1.** Rule-based score only. The `matches` table is shaped so an ML score column can be added without migration.
- **No marketplace fees / monetization logic in v1.** Charge model TBD. Schema reserves `platform_fee_bps` on contracts so we can enable later without migration.
- **No public discoverability for sponsors-only.** A "sponsor browsing public fighter profiles" use case is supported, but reverse-listings ("sponsors anyone can browse") is gated to logged-in fighters/managers to protect sponsor pipeline.

---

## 3. Domain model (conceptual)

```
                   ┌──────────┐
                   │ profiles │  (auth.users 1:1)
                   └────┬─────┘
        ┌───────────────┼───────────────┬────────────────┐
        ▼               ▼               ▼                ▼
 fighter_profiles  sponsor_profiles  agency_profiles  gym_profiles
        │               │
        │               │ posts
        │               ▼
        │      sponsorship_opportunities ──────┐
        │               │                       │
        │ applies to    │                       │
        └──────────►applications ◄──── invites  │
                        │                       │
                  accepted▼                     │
                    contracts ◄─────────────────┘
                        │
                ┌───────┼────────┐
                ▼       ▼        ▼
          obligations  payments  reviews

   conversations ─── messages          notifications
   audit_log     analytics_events      outbox_events
```

### 3.1 Actors (= `profiles.role` values, EXTENDED)

| Role | New? | Created by | Notes |
|---|---|---|---|
| `fighter` | existing | self-register | gets `fighter_profiles` row |
| `manager` | existing | self-register | can represent N fighters via `manager_fighters` |
| `admin` | existing | manual | platform ops |
| `sponsor` | **NEW** | self-register | gets `sponsor_profiles` row; can be a brand-rep or self-rep |
| `agency` | NEW (v2) | reserved | not built in this TDD |
| `gym`, `promoter` | NEW (v2+) | reserved | profile-only directory entries, no marketplace actions yet |

We extend the existing `profiles.role` CHECK constraint to allow `sponsor`. Future roles added via migration when needed — no schema gymnastics.

### 3.2 Why role-extension tables instead of one fat `profiles`?
- Sparse columns (sponsors don't have a weight class; fighters don't have an industry).
- RLS clarity: "sponsor reading their own row" → policy on `sponsor_profiles`, not on a shared table.
- Storage / index efficiency: each side gets its own indexes (`sponsor_profiles.industry`, `fighter_profiles.weight_class`).
- Already partially in use (`fighter_profiles` exists today).

---

## 4. Schema design — new tables

> Every new table: `id uuid PK default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` with the existing `set_updated_at()` trigger, `deleted_at timestamptz` where applicable, `metadata jsonb default '{}'::jsonb` for forward compat.

### 4.1 Profile-extension tables

#### `sponsor_profiles` (NEW)
One row per `profiles` user with `role='sponsor'`.

| col | type | notes |
|---|---|---|
| user_id | uuid PK FK→profiles.id ON DELETE CASCADE | |
| company_name | text NOT NULL | |
| logo_path | text | Storage path `sponsors/<user_id>.<ext>` |
| website_url | text | URL validation in app layer |
| industry | text | enum-table FK in v2 |
| company_size | text CHECK (`solo|small|mid|enterprise`) | |
| hq_country | text (ISO-2) | |
| hq_region | text | freeform state/province |
| description | text | |
| budget_min_usd | integer | annual budget range, in dollars (not cents) |
| budget_max_usd | integer | |
| preferred_demographics | jsonb | `{ age_min, age_max, genders[], regions[] }` |
| preferred_weight_classes | text[] | |
| preferred_promotions | text[] | UFC, ONE, Bellator, etc. |
| campaign_goals | text[] | `awareness | conversion | content | hiring | merch` |
| is_verified | boolean default false | platform-verified flag (admin-set) |
| visibility | text CHECK (`private|verified_only|public`) default `verified_only` | who can see this sponsor |
| total_active_contracts | integer default 0 | denormalized counter, maintained by trigger |

**Indexes:** `industry`, `is_verified`, `(visibility, is_verified)`, GIN on `preferred_weight_classes`, `campaign_goals`.

#### `fighter_profiles` (EXTEND — already exists)
Add these columns via migration:

| col | type | notes |
|---|---|---|
| nickname | text | |
| date_of_birth | date | privacy-sensitive; not exposed in public API |
| gender | text CHECK (`m|f|nb|other|prefer_not`) | |
| nationality | text (ISO-2) | |
| coach_name | text | freeform v1; user-FK in v2 |
| gym_name | text | duplicate of existing? keep one |
| status | text CHECK (`amateur|pro|retired`) default `amateur` | |
| current_promotion | text | |
| height_cm | smallint | |
| reach_cm | smallint | |
| stance | text CHECK (`orthodox|southpaw|switch`) | |
| highlight_video_urls | text[] | YouTube/Vimeo URLs; max 5 |
| media_kit_url | text | Storage signed URL |
| banner_path | text | Storage path |
| sponsorship_interests | text[] | which `campaign_goals` they're open to |
| public_slug | text UNIQUE | for `/f/:slug` public URL |
| visibility | text CHECK (`private|sponsors_only|public`) default `sponsors_only` | |
| is_open_to_sponsorship | boolean default true | |

**Indexes:** `(visibility, is_open_to_sponsorship)`, `current_promotion`, `weight_class`, `nationality`, `public_slug`, GIN on `sponsorship_interests`.

Note: `fighter_profiles` currently uses `user_id` as PK. Keep that; treat it as the canonical fighter ID.

#### `social_accounts` (NEW)
Polymorphic — works for any role.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→profiles.id ON DELETE CASCADE | |
| platform | text CHECK (`instagram|tiktok|youtube|x|facebook|twitch`) | |
| handle | text NOT NULL | without leading `@` |
| profile_url | text NOT NULL | |
| follower_count | integer | |
| engagement_rate_bps | integer | basis points (370 = 3.7%) |
| last_synced_at | timestamptz | when we last fetched stats |
| verified_by_platform | boolean | platform's blue-check |

**Unique:** `(user_id, platform)`. **Index:** `platform`, `follower_count desc`.

#### `audience_demographics` (NEW)
| col | type | notes |
|---|---|---|
| user_id | uuid PK FK→profiles.id | one row per user (composite of their socials) |
| age_brackets | jsonb | `{ "13-17": 0.08, "18-24": 0.42, ... }` |
| gender_split | jsonb | `{ "m": 0.71, "f": 0.27, "other": 0.02 }` |
| top_countries | jsonb | `[{ "iso": "US", "share": 0.62 }, ...]` |
| top_cities | jsonb | same shape |
| total_reach | integer | sum across platforms, deduped estimate |
| source | text CHECK (`self_reported|imported|computed`) | provenance |
| last_updated_at | timestamptz | |

### 4.2 Marketplace tables

#### `sponsorship_opportunities` (NEW)
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| sponsor_id | uuid FK→profiles.id (with role check) | the creator |
| title | text NOT NULL | |
| description | text | markdown |
| campaign_type | text CHECK (`single_event|seasonal|annual|one_off_post|brand_ambassador|appearance|other`) | |
| budget_min_usd, budget_max_usd | integer | |
| budget_per_fighter_usd | integer | optional, for multi-fighter campaigns |
| max_fighters | integer default 1 | how many can be accepted |
| deliverables | jsonb | structured: `[{type:'instagram_post', count:2, notes:'...'}]` |
| requirements | jsonb | `{ min_followers, min_engagement_bps, weight_classes[], regions[], promotions[], status_in: ['pro'] }` |
| application_deadline | timestamptz | nullable = open-ended |
| campaign_start, campaign_end | date | |
| status | text CHECK (`draft|published|paused|closed|archived`) default `draft` | |
| visibility | text CHECK (`public|invited_only|verified_fighters_only`) default `public` | |
| location_country, location_region | text | |
| view_count, application_count | integer default 0 | denormalized |
| published_at | timestamptz | |

**Indexes:** `sponsor_id`, `(status, published_at desc)`, `application_deadline`, GIN on `requirements`, GIN on `deliverables`.

#### `applications` (NEW) — replaces `sponsorforge_matches`
The marketplace's transactional core. A connection between a fighter and an opportunity.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| opportunity_id | uuid FK→sponsorship_opportunities.id ON DELETE CASCADE | |
| fighter_id | uuid FK→profiles.id | the applicant |
| sponsor_id | uuid FK→profiles.id | denormalized for RLS efficiency |
| direction | text CHECK (`fighter_applied|sponsor_invited`) | who initiated |
| status | text CHECK (`applied|under_review|shortlisted|accepted|rejected|withdrawn|expired`) default `applied` | |
| cover_message | text | applicant or inviter note |
| match_score | smallint | 0–100 from `matches` table; cached for sort |
| price_proposed_usd | integer | nullable; fighter or sponsor can counter |
| reviewed_by | uuid FK→profiles.id | sponsor admin who acted |
| reviewed_at, decided_at | timestamptz | |
| rejection_reason | text | freeform; sponsor optional |
| metadata | jsonb | |

**Unique:** `(opportunity_id, fighter_id)` — one application per fighter per opp.
**Indexes:** `(sponsor_id, status, created_at desc)`, `(fighter_id, status, created_at desc)`, `(opportunity_id, status)`.

#### `matches` (NEW)
Materialized scoring. Recomputed on relevant change (new opp, profile edit, audience refresh) via a backend worker. Storing scores rather than computing on read keeps the discovery feed fast.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| opportunity_id | uuid FK | |
| fighter_id | uuid FK→profiles.id | |
| score | smallint NOT NULL CHECK (`score BETWEEN 0 AND 100`) | overall % |
| factor_breakdown | jsonb | `{ geography: 22, weight: 18, reach: 24, ... }` |
| reasons | text[] | human-readable bullets for UI |
| stale | boolean default false | set true when inputs change; recomputed by worker |
| computed_at | timestamptz | |
| algorithm_version | text default `v1-rule` | so we can A/B against `v2-ai` |

**Unique:** `(opportunity_id, fighter_id, algorithm_version)`.
**Indexes:** `(opportunity_id, score desc)`, `(fighter_id, score desc) where stale = false`.

#### `contracts` (NEW)
Generated when a sponsor accepts an application. Both parties must sign-off (two-click acceptance) before `status='active'`.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| opportunity_id | uuid FK | |
| application_id | uuid FK UNIQUE | one contract per application |
| sponsor_id | uuid FK→profiles.id | |
| fighter_id | uuid FK→profiles.id | |
| value_usd | integer NOT NULL | total contract value in dollars |
| platform_fee_bps | integer default 0 | platform cut in basis points (e.g. 1000 = 10%) — disabled in v1 |
| payment_schedule | text CHECK (`upfront|milestones|monthly|on_completion`) | |
| start_date, end_date | date | |
| deliverables_snapshot | jsonb | frozen copy of opp.deliverables at contract time |
| terms_markdown | text | full agreed terms text |
| status | text CHECK (`draft|pending_fighter|pending_sponsor|active|in_dispute|completed|terminated|expired`) default `draft` | |
| sponsor_accepted_at, fighter_accepted_at | timestamptz | both must be set for `status='active'` |
| sponsor_accepted_ip, fighter_accepted_ip | inet | basic non-repudiation |
| terminated_by | uuid FK→profiles.id | |
| termination_reason | text | |
| completed_at, terminated_at | timestamptz | |

**Indexes:** `(sponsor_id, status)`, `(fighter_id, status)`, `status`, `end_date` (for cron that flips active→completed).

### 4.3 Obligations & deliverables

**Decision:** We **reuse the existing `obligations` table** rather than create a parallel one. We add columns to tie each obligation to a contract + deliverable. Old fighter-only obligations remain valid.

#### `obligations` (EXTEND — already exists)
Add columns:

| col | type | notes |
|---|---|---|
| contract_id | uuid FK→contracts.id ON DELETE CASCADE | nullable for legacy fighter-only obligations |
| deliverable_type | text | `instagram_post | story | tiktok | appearance | logo_placement | merch_promo | event_attendance | content_creation | other` |
| recurrence | text CHECK (`once|daily|weekly|monthly|per_event`) default `once` | |
| proof_required | boolean default true | |

Existing `status` enum already covers `pending|in_progress|completed|overdue|canceled` — works as-is.

#### `obligation_proofs` (NEW)
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| obligation_id | uuid FK | |
| submitted_by | uuid FK→profiles.id | always the fighter |
| proof_type | text CHECK (`url|file|text`) | |
| proof_value | text NOT NULL | URL string, storage path, or text |
| caption | text | fighter's note ("posted at 7pm EST as agreed") |
| reviewed_by | uuid FK→profiles.id | sponsor reviewer |
| review_status | text CHECK (`pending|approved|rejected`) default `pending` | |
| review_notes | text | |
| reviewed_at | timestamptz | |

**Index:** `(obligation_id, created_at desc)`, `(review_status) WHERE review_status='pending'`.

### 4.4 Messaging

#### `conversations` (NEW)
A thread between two or more parties. Most threads are 1:1 (fighter ↔ sponsor) but we shape for N to allow agency loops.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| subject | text | optional |
| context_type | text CHECK (`direct|application|contract|support`) | |
| context_id | uuid | application.id / contract.id when contextual |
| created_by | uuid FK→profiles.id | |
| last_message_at | timestamptz | denormalized for inbox sort |

**Indexes:** `last_message_at desc`.

#### `conversation_participants` (NEW)
| col | type | notes |
|---|---|---|
| conversation_id | uuid FK ON DELETE CASCADE | composite PK |
| user_id | uuid FK→profiles.id | composite PK |
| role_in_thread | text CHECK (`member|owner|observer`) default `member` | |
| unread_count | integer default 0 | maintained by trigger on `messages` insert |
| last_read_at | timestamptz | |
| muted | boolean default false | |
| left_at | timestamptz | for archive without delete |

**Indexes:** `(user_id) WHERE left_at IS NULL`.

#### `messages` (NEW)
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| conversation_id | uuid FK ON DELETE CASCADE | |
| sender_id | uuid FK→profiles.id | |
| body | text | nullable when message is a system event |
| message_type | text CHECK (`text|system|attachment|application_update|contract_update`) default `text` | |
| attachments | jsonb | `[{path, name, size, mime}]` |
| edited_at | timestamptz | |
| deleted_at | timestamptz | soft delete |

**Index:** `(conversation_id, created_at)`. Realtime publication: yes (see §6).

### 4.5 Payments

We add two tables, reusing existing `payments` only for member subscriptions (its current intent). Sponsorship payments get their own table because the schema differs (multi-party, contract-linked).

#### `sponsorship_payments` (NEW)
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK | |
| sponsor_id, fighter_id | uuid FK | |
| milestone_id | uuid FK→payment_milestones.id | nullable for upfront one-shot |
| amount_usd | integer NOT NULL | |
| platform_fee_usd | integer default 0 | |
| net_to_fighter_usd | integer NOT NULL | computed |
| currency | text default `usd` | |
| stripe_payment_intent_id | text UNIQUE | |
| stripe_charge_id | text | |
| stripe_transfer_id | text | nullable until Phase 5b (Connect payout to fighter) |
| status | text CHECK (`requires_payment|processing|succeeded|failed|refunded|held`) | |
| failure_code, failure_message | text | |
| paid_at | timestamptz | |

**Indexes:** `(sponsor_id, status)`, `(fighter_id, status)`, `contract_id`.

#### `payment_milestones` (NEW)
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK | |
| name | text NOT NULL | |
| amount_usd | integer | |
| due_date | date | |
| status | text CHECK (`pending|invoiced|paid|skipped`) | |
| sequence | smallint | UI ordering |

**Unique:** `(contract_id, sequence)`.

### 4.6 Notifications

#### `notifications` (NEW)
In-app inbox. Email/push fan-out is the worker's job; this table is the user-facing record.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| recipient_id | uuid FK→profiles.id | |
| type | text NOT NULL | machine code: `application.received`, `contract.signed`, `obligation.due_24h`, `payment.succeeded` … |
| title | text NOT NULL | |
| body | text | |
| action_url | text | deep link |
| read_at | timestamptz | |
| sent_email | boolean default false | did we also email? |
| sent_email_at | timestamptz | |
| related_type | text | `opportunity | application | contract | obligation | payment | message` |
| related_id | uuid | |

**Indexes:** `(recipient_id, read_at NULLS FIRST, created_at desc)`, `type`.

#### `outbox_events` (NEW) — for reliable notification fan-out
Standard outbox pattern. Backend writes events here in the same transaction as the domain change; a worker drains it, dispatches email/in-app/webhooks.

| col | type | notes |
|---|---|---|
| id | bigserial PK | |
| event_type | text NOT NULL | dot-namespaced |
| aggregate_type | text | `contract | application | …` |
| aggregate_id | uuid | |
| payload | jsonb NOT NULL | |
| status | text CHECK (`pending|processing|sent|failed|dead`) default `pending` | |
| attempts | smallint default 0 | |
| last_error | text | |
| next_attempt_at | timestamptz default now() | |
| processed_at | timestamptz | |

**Index:** `(status, next_attempt_at) WHERE status IN ('pending','failed')`.

### 4.7 Reviews & reputation

#### `reviews` (NEW)
Both sides rate each other after contract completion. Hidden until both submit OR 14 days pass, to prevent retaliation bias.

| col | type | notes |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK | |
| reviewer_id | uuid FK→profiles.id | |
| subject_id | uuid FK→profiles.id | who is being reviewed |
| rating | smallint CHECK (`rating BETWEEN 1 AND 5`) | |
| punctuality, communication, professionalism, deliverable_quality | smallint | sub-scores 1–5 |
| public_comment | text | shown after release |
| private_feedback | text | shown to subject only, never public |
| released_at | timestamptz | computed: min(both_submitted, +14d) |

**Unique:** `(contract_id, reviewer_id)`.

### 4.8 Cross-cutting

#### `audit_log` (NEW)
| col | type | notes |
|---|---|---|
| id | bigserial PK | |
| actor_id | uuid FK→profiles.id | nullable for system actions |
| actor_role | text | snapshot in case role changes later |
| action | text NOT NULL | `application.accept`, `contract.terminate`, `admin.user.ban` … |
| target_type | text | |
| target_id | uuid | |
| diff | jsonb | before/after for critical fields |
| ip | inet | |
| user_agent | text | |
| created_at | timestamptz default now() | |

**Index:** `(actor_id, created_at desc)`, `(target_type, target_id, created_at desc)`.

#### `user_blocks` (NEW)
Mute / block another user from messaging/inviting.

| col | type | notes |
|---|---|---|
| blocker_id | uuid FK→profiles.id | composite PK |
| blocked_id | uuid FK→profiles.id | composite PK |
| reason | text | |
| created_at | timestamptz default now() | |

#### `profile_views` (NEW, analytics)
Lightweight. We don't need full clickstream — just a daily-aggregated counter.

| col | type | notes |
|---|---|---|
| profile_id | uuid FK→profiles.id | composite PK |
| view_date | date | composite PK |
| viewer_role | text | `fighter | sponsor | anon | other` (aggregated; no PII) |
| view_count | integer default 0 | |

**Index:** `(profile_id, view_date desc)`. Insert with `ON CONFLICT … DO UPDATE SET view_count = view_count + 1`.

### 4.9 Reserved for Phase 6+

- `disputes(contract_id, opener_id, status, …)` — formal dispute flow
- `withdrawals(fighter_id, amount, status, …)` — when Stripe Connect lands
- `categories`, `industries` — lookup tables instead of free-text where it matters

### 4.10 Migrations strategy
- **One migration file per phase**, sequentially numbered (`0002_marketplace_profiles.sql`, `0003_marketplace_opportunities.sql`, …).
- **No destructive drops in the same migration as creates.** `sponsorforge_matches` is left intact; its deprecation is a separate migration (`0099_drop_sponsorforge_matches.sql`) that runs only after the data has been backfilled into `applications`.
- **`pg_dump`-based snapshot before every phase migration** in production (via Supabase backups UI).
- **No DB triggers on `auth.users`.** Profile/extension rows are created by backend in the `register` flow. (We learned this lesson the hard way last week.)

---

## 5. API surface (REST under `/api`)

Express, mounted in `server/index.js`. Convention: kebab-case URLs, snake_case JSON, all responses `{ ok, data?, error? }`.

```
# Phase 1
/api/auth/*                                        (existing)
/api/profile/me                  GET, PATCH        merged profile + extension
/api/profile/:userId             GET               public/sponsor-visible view
/api/sponsors/onboard            POST              create sponsor_profiles row
/api/sponsors/:id                GET, PATCH
/api/fighters/onboard            POST              extend fighter_profiles
/api/fighters/:id                GET, PATCH

# Phase 2
/api/opportunities               GET (search), POST
/api/opportunities/:id           GET, PATCH, DELETE (soft)
/api/opportunities/:id/publish   POST
/api/opportunities/:id/applications  GET            sponsor view
/api/applications                POST              fighter applies
/api/applications/:id            GET, PATCH        status transitions only
/api/applications/:id/invite     POST              sponsor invites fighter
/api/matches                     GET               my recommendations
/api/matches/recompute           POST (admin)      manual trigger

# Phase 3
/api/conversations               GET, POST
/api/conversations/:id/messages  GET, POST
/api/conversations/:id/read      POST              mark read
/api/notifications               GET
/api/notifications/:id/read      POST
/api/notifications/read-all      POST

# Phase 4
/api/contracts                   GET, POST         from accepted application
/api/contracts/:id               GET, PATCH (draft only)
/api/contracts/:id/accept        POST              two-party signoff
/api/contracts/:id/terminate     POST
/api/contracts/:id/obligations   GET, POST         add ad-hoc obligation
/api/obligations/:id             GET, PATCH
/api/obligations/:id/proof       POST              fighter uploads
/api/obligations/:id/proof/:pid/review  POST       sponsor approves/rejects

# Phase 5
/api/payments/intent             POST              create Stripe PaymentIntent
/api/payments/:id                GET
/api/contracts/:id/milestones    GET, POST
/api/stripe/webhook              POST (raw body)   payment status sync

# Phase 6
/api/admin/users                 GET (paginated)
/api/admin/users/:id/ban         POST
/api/admin/disputes              GET
/api/admin/analytics             GET
```

### 5.1 Cross-cutting middleware
- `requireAuth`, `requireRole(...roles)`, `requireOwnership(table, column)` (existing pattern, extended).
- `rateLimit('public' | 'auth' | 'write' | 'webhook')` — separate buckets per route class.
- `audit(action)` decorator that writes to `audit_log` after the handler returns 2xx.
- `withOutbox(handler)` wrapper that opens a Supabase transaction so domain writes + outbox-event writes are atomic.

### 5.2 Validation
- zod schemas per route in `server/lib/validate.js` (same pattern as today).
- Money inputs: always integer USD. We never accept float dollars over the wire.
- All status-transition routes (`/applications/:id`, `/contracts/:id/accept`, `/obligations/:id`) use a server-side state-machine guard. Frontend `PATCH status: 'accepted'` is rejected if the transition isn't legal for the current state.

### 5.3 State machines (the part most teams get wrong)

#### Application
```
applied ──┬─► under_review ──┬─► shortlisted ──► accepted ──► (creates contract)
          │                  └─► rejected
          ├─► withdrawn (fighter)
          └─► expired (deadline passed)
```
Only sponsor can move forward states. Fighter can `withdraw` from any non-terminal state. Acceptance is irrevocable from the application side (rollback happens via contract termination).

#### Contract
```
draft ──► pending_fighter ──► pending_sponsor ──► active ──┬─► completed
                                                            ├─► in_dispute ──► (admin resolves)
                                                            └─► terminated
```
Two-phase commit: when sponsor accepts, status goes `pending_fighter`; when fighter accepts, `pending_sponsor`; when both flags set, trigger → `active` + outbox events.

#### Obligation
```
pending ──► in_progress ──► completed
   └────► overdue (cron, when due_date passed) ──► completed | canceled
```

---

## 6. Realtime

### 6.1 What's published
| Table | Why | Channel name convention |
|---|---|---|
| `messages` | live chat | `chat:<conversation_id>` (RLS filters to participants) |
| `notifications` | inbox badge | `notif:<user_id>` |
| `obligations` | overdue alerts (existing) | `oblig:<owner_id>` |
| `applications` | sponsor dashboard live updates | `apps:<sponsor_id>` (server publishes; clients use postgres-changes filter) |

### 6.2 Patterns
- **Subscribe with RLS**: client subscribes via `supabase.channel().on('postgres_changes', { filter: 'conversation_id=eq.X' })`. RLS policies do the gate.
- **Server pushes via `broadcast` channels**, not `postgres_changes`, for derived events (e.g., "match score recomputed") so we don't burn a `matches` table publish.
- **Presence** (online/offline indicators) is a v2 nice-to-have, not part of v1.

### 6.3 What's NOT realtime
- Discovery feed / search results. These hit Postgres with filters; cached at edge. Realtime would melt the DB.
- Payment status. Polled or driven via webhook → notification.

---

## 7. Row Level Security policies

> Service-role bypasses RLS. These policies protect direct supabase-js (anon) reads/writes.

### 7.1 Profile-extension tables
```sql
-- sponsor_profiles
"sponsors read public/verified-only"      SELECT  USING (visibility IN ('public','verified_only') OR user_id = auth.uid())
"sponsors update own row"                 UPDATE  USING (user_id = auth.uid())

-- fighter_profiles
"fighters read public"                    SELECT  USING (visibility='public' OR user_id = auth.uid())
"fighters read sponsors-only when sponsor" SELECT USING (visibility='sponsors_only' AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='sponsor'))
"fighters update own"                     UPDATE  USING (user_id = auth.uid())
```

### 7.2 Opportunities
```sql
"public reads published opps"             SELECT  USING (status='published' AND visibility='public')
"sponsor reads own opps"                  SELECT  USING (sponsor_id = auth.uid())
"sponsor writes own opps"                 ALL     USING (sponsor_id = auth.uid())
```

### 7.3 Applications, contracts, messages — the sensitive ones
```sql
-- applications
"participant reads"                       SELECT  USING (fighter_id = auth.uid() OR sponsor_id = auth.uid())
"fighter inserts own"                     INSERT  WITH CHECK (fighter_id = auth.uid() AND direction='fighter_applied')
-- updates only via backend (service role)

-- contracts
"participant reads"                       SELECT  USING (fighter_id = auth.uid() OR sponsor_id = auth.uid())
-- no client INSERT/UPDATE — backend only

-- messages
"participant reads"                       SELECT  USING (EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid() AND cp.left_at IS NULL))
"participant inserts"                     INSERT  WITH CHECK (sender_id = auth.uid() AND EXISTS(... same ...))
```

### 7.4 Notifications, audit_log, outbox
- `notifications`: SELECT/UPDATE WHERE `recipient_id = auth.uid()`. No INSERT (backend only).
- `audit_log`, `outbox_events`: no client policies. Backend-only.

### 7.5 Storage buckets to create
| Bucket | Public? | Purpose |
|---|---|---|
| `sponsor-logos` | public | rendered on public sponsor cards |
| `fighter-headshots` | public | profile photos |
| `fighter-banners` | public | profile cover photos |
| `media-kits` | private | signed-URL only; sponsor must be matched |
| `obligation-proofs` | private | signed-URL only; contract participants |
| `message-attachments` | private | signed-URL only; conversation participants |

---

## 8. Matching engine (v1 rule-based)

### 8.1 Inputs
- Opportunity `requirements`, `preferred_*` fields, `location_*`.
- Fighter `fighter_profiles`, `social_accounts` (sum of follower_count), `audience_demographics`, `obligations` completion history.

### 8.2 Scoring function (deterministic, transparent)
Weighted sum normalized to 100. Stored in `matches.factor_breakdown` so we can show "why" in UI.

| Factor | Weight | How scored |
|---|---:|---|
| Geography fit | 15 | full match country/region = 15; same country = 10; same continent = 5; else 0 |
| Weight class | 15 | exact = 15; adjacent = 8; else 0 |
| Promotion fit | 10 | listed in preferred = 10; else 0 |
| Social reach | 20 | log10(total followers) scaled vs opp minimum |
| Engagement | 15 | engagement_rate_bps vs opp minimum |
| Demographics match | 15 | intersection-over-union of age × gender × country |
| Reliability | 10 | obligations completion rate over last N contracts |

Total = 100. We clamp the final score.

### 8.3 When recomputation runs
- Triggered on: opp publish/edit, fighter profile edit, social_accounts sync, contract completion (updates reliability).
- Marked `stale = true` first, then a worker picks up stale rows in batches.
- Cron sweep every 6h to catch missed invalidations.

### 8.4 Pluggability for ML v2
`algorithm_version` is part of the unique key. v2 ML scores are written alongside v1 rule scores, never replacing them. A site setting `matching.active_algorithm` decides which version the API returns. Lets us A/B silently.

---

## 9. Payments architecture

### 9.1 v1 (Phases 1–5a): Direct card capture, manual payout
- Sponsor enters card via Stripe Elements on frontend.
- Backend creates PaymentIntent server-side (existing pattern in `routes/stripe.js`).
- Stripe webhook (`payment_intent.succeeded`) → backend writes `sponsorship_payments.status='succeeded'`, emits `payment.succeeded` outbox event → notifies fighter ("Payment of $X received, awaiting payout").
- Platform admin pays fighter via separate process (bank transfer, manual). Tracked in `metadata`.

This avoids Stripe Connect's KYC complexity for launch but is honest with fighters (no escrow theater).

### 9.2 v1b (Phase 5b): Stripe Connect Custom for fighter payouts
- Fighter onboards a Connect Express account (Stripe-hosted KYC).
- When PaymentIntent succeeds, backend creates a Transfer to fighter's connected account minus `platform_fee_usd`.
- `sponsorship_payments.stripe_transfer_id` populated.

### 9.3 Webhook safety
- Raw body slot in `server/index.js` reserved (already there).
- Signature verification with `STRIPE_WEBHOOK_SECRET`.
- Idempotency: webhook handler upserts by `stripe_payment_intent_id`.

### 9.4 Money invariants
- All amounts stored in **integer USD dollars** in our DB, converted to Stripe's cents at the Stripe boundary. (Pick one; don't mix.)
- `net_to_fighter_usd + platform_fee_usd = amount_usd`. CHECK constraint.

---

## 10. Notifications fan-out

### 10.1 Channels per event type
| Event | In-app | Email | Push (future) |
|---|---|---|---|
| application.received (sponsor) | ✓ | ✓ digest | ✓ |
| application.accepted (fighter) | ✓ | ✓ immediate | ✓ |
| application.rejected | ✓ | ✓ immediate | — |
| contract.pending_signature | ✓ | ✓ immediate | ✓ |
| contract.signed | ✓ | ✓ immediate | ✓ |
| message.received | ✓ | ✓ if not seen in 1h | ✓ |
| obligation.due_24h | ✓ | ✓ | ✓ |
| obligation.overdue | ✓ | ✓ + admin CC | ✓ |
| payment.succeeded | ✓ | ✓ receipt | — |

### 10.2 Worker
Node process inside the same Express app initially (in `server/jobs/`). Polls `outbox_events` every 5s, dispatches in parallel with attempt-tracking and exponential backoff. Moves to dedicated worker dyno when message volume warrants.

---

## 11. Search & discovery

### 11.1 v1: Postgres-native
- `tsvector` GIN index on opportunity `title || description` for keyword search.
- Btree + GIN composite for filter facets (region, weight class, budget range, deadline).
- Cursor-based pagination (`created_at < ?`) not OFFSET — necessary for scale.

### 11.2 v2 (when listings > ~50k)
- Meilisearch (cheap, hosted) or Typesense. Backend writes to Postgres + outbox event → indexer worker syncs to search engine.

---

## 12. Frontend impact

### 12.1 What stays
- All existing landing-page components, dashboards, auth flow, demo accounts.
- `useAuth` hook (we add `userRole` getter).
- The 4-tab dashboard pattern (Fighter, Manager, Admin) — Sponsor becomes the 4th.

### 12.2 What's new
| Route | Phase | Notes |
|---|---|---|
| `/sponsor/onboard` | 1 | Multi-step wizard like fighter's |
| `/dashboard/sponsor` | 1 | New shell using existing `DashShell` |
| `/sponsor/opportunities/new` | 2 | Creation form |
| `/opportunities` | 2 | Public discovery; SEO-relevant |
| `/opportunities/:id` | 2 | Public detail, with "Apply" CTA gated to fighters |
| `/f/:slug` | 1 | Public fighter profile (SEO-relevant) |
| `/s/:slug` | 1 | Public sponsor profile |
| `/inbox` | 3 | Conversations + unread badge |
| `/contracts` | 4 | Both sides see their list |
| `/contracts/:id` | 4 | Detail + obligations + payments |

### 12.3 Pattern
- Reuse existing design tokens (`charcoal`, `blood-glow`, Bebas/Barlow stack).
- Server data fetched via thin wrapper on `supabase-js` directly for read paths, `apiFetch()` for write paths. Don't duplicate domain logic in `useEffect` — co-locate in `src/lib/api/<resource>.ts`.

---

## 13. Operational concerns

### 13.1 Background work
- Stripe webhook handler: in-process.
- Outbox dispatcher: in-process worker, 5s poll.
- Match recomputation: in-process worker, debounced 30s after invalidating event.
- Obligation overdue scan: cron, every 15 min (existing `OVERDUE_SCAN_INTERVAL_MIN`).
- Contract auto-complete: cron, daily — flips `active` → `completed` past `end_date`.

When Render single-dyno hurts: extract workers to a Render Background Worker service. Same codebase, different entrypoint (`server/jobs/index.js`).

### 13.2 Observability
- Pino structured logging already in place.
- Add request IDs to every log line (middleware).
- Sentry (or equivalent) for error tracking — set up alongside Phase 1.
- Supabase dashboard for slow-query inspection.

### 13.3 Backups & disaster recovery
- Supabase free tier: daily backups for 7 days.
- Pre-launch: upgrade to Pro for PITR (point-in-time recovery).
- Out-of-band export: weekly `pg_dump` to S3 (or Supabase Storage) via cron.

### 13.4 Rate-limit buckets
| Route class | Per-IP limit | Notes |
|---|---|---|
| public (browse, view) | 60 / min | |
| auth (register, login) | 20 / min | existing |
| write (POST/PATCH) | 30 / min | per authenticated user |
| messaging | 60 / min | per authenticated user |
| webhook | 600 / min | per Stripe/Calendly etc. |

---

## 14. Implementation roadmap (10-week target, single-dev cadence; double-up with Atharv to halve)

### Phase 1 — Profiles & roles (~2 weeks)
- Migration `0002_marketplace_profiles.sql`: extend `profiles.role`, create `sponsor_profiles`, extend `fighter_profiles`, create `social_accounts`, `audience_demographics`, `audit_log`, `profile_views`, `user_blocks`.
- RLS for all of the above.
- Storage buckets created.
- Backend: `/api/sponsors/onboard`, `/api/sponsors/:id`, extend `/api/fighters/*`, public `/api/profile/:id`.
- Frontend: `/sponsor/onboard` wizard, `/dashboard/sponsor` shell, fighter profile edit page extension, public `/f/:slug` and `/s/:slug`.
- **Exit criteria**: a sponsor can sign up via the live site and see their dashboard; a fighter can edit their full profile and view a public version.

### Phase 2 — Opportunities + applications + matching (~2 weeks)
- Migration `0003_marketplace_opportunities.sql`: `sponsorship_opportunities`, `applications`, `matches`.
- Backend: full opportunity CRUD, applications create/list, matching worker (rule-based), invalidation hooks.
- Frontend: `/sponsor/opportunities/new`, `/opportunities` discovery with filters, `/opportunities/:id`, apply + invite flows.
- **Exit criteria**: a sponsor posts an opp; a fighter sees it and applies; sponsor reviews and shortlists.

### Phase 3 — Messaging + notifications (~2 weeks)
- Migration `0004_marketplace_messaging.sql`: `conversations`, `conversation_participants`, `messages`, `notifications`, `outbox_events`.
- Realtime publication on `messages`, `notifications`.
- Backend: messaging routes, notification routes, outbox worker, email templates (SendGrid).
- Frontend: `/inbox`, message thread UI, notification badge + dropdown.
- **Exit criteria**: a sponsor messages a fighter from within an application; both see realtime; an email lands.

### Phase 4 — Contracts + obligations (~2 weeks)
- Migration `0005_marketplace_contracts.sql`: `contracts`, extend `obligations`, `obligation_proofs`.
- Backend: contract create-from-application, two-phase accept, obligation generation from deliverables, proof submission/review.
- Frontend: `/contracts`, `/contracts/:id`, obligation tracker, proof upload.
- **Exit criteria**: an accepted application generates a contract; both parties sign; obligations populate; proofs flow.

### Phase 5a — Stripe payments (~1.5 weeks)
- Migration `0006_marketplace_payments.sql`: `sponsorship_payments`, `payment_milestones`.
- Backend: payment intent creation, webhook handler (extends existing `routes/stripe.js`), milestone scheduling, idempotency.
- Frontend: payment form on contract page, milestone view.
- **Exit criteria**: sponsor pays for a live contract; webhook updates status; fighter sees confirmation.

### Phase 5b — Connect payout (~1 week, optional / can defer)
- Stripe Connect Express onboarding for fighters.
- Backend: `Transfer` creation after `PaymentIntent` success.
- Frontend: bank-link page in fighter dashboard.

### Phase 6 — Analytics + admin (~1.5 weeks)
- Migration `0007_marketplace_admin.sql`: `reviews`, `disputes` reserved.
- Backend: admin endpoints, analytics aggregation queries.
- Frontend: extend admin dashboard with marketplace tabs, fighter/sponsor analytics widgets.
- **Exit criteria**: admin can see GMV, active contracts, dispute queue; fighter sees their stats.

### Cross-phase: ops
- Sentry, Pro Supabase, weekly backup cron — set up before Phase 5.
- Load test with k6 before Phase 5 launch.

---

## 15. Open questions / decisions — RESOLVED 2026-05-30

Decisions locked by founder. Implementation proceeds on these.

1. **Marketplace fee model.** ✅ **DECIDED: Free for v1.** `platform_fee_bps=0` everywhere; schema captures the field so a fee can be switched on before Phase 5 with no migration.
2. **Sponsor verification.** ✅ **DECIDED: Open registration with verification badge.** Anyone registers as sponsor (`is_verified=false`). Admin grants the verified badge. Public opportunities require `is_verified=true` to publish to the public feed (unverified can still post `invited_only`).
3. **Public fighter profiles.** ✅ **DECIDED: `sponsors_only` default.** New fighter profiles visible to logged-in sponsors only; fighter opts in to `public` (SEO-indexed) when ready.
4. **Multi-fighter opportunities.** Default accepted: schema supports `max_fighters`; UI ships single-fighter in Phase 2, multi in Phase 6.
5. **Reviews enforcement.** Default accepted: mutual reveal or 14-day timer (§4.7).
6. **Dispute flow.** Default accepted: reserved table + manual admin process in v1; no fighter-facing dispute button until Phase 6.
7. **Contract template library.** Default accepted: freeform markdown in v1; template library is v2.

**Timeline:** Founder targets a 2-day solo sprint. Realistic scope for that window: **Phase 1 + Phase 2** (profiles, sponsors, opportunities, applications, rule-based matching) — schema + backend APIs + minimum-viable UI. Phases 3–5 (messaging, contracts, payments) follow after; payments in particular will not be rushed.

---

## 16. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sponsor stops paying mid-contract; we already paid fighter | M | H | Hold platform-side until obligations approved (escrow-lite); document clearly. Stripe Connect later. |
| Fake fighter profiles / inflated socials | H | M | Manual verification for first 100 sponsors + fighters; social handle verification via OAuth in v2. |
| RLS bug exposes private profile | L | H | Backend never relies on RLS; service-role checks duplicate the policy. RLS regression test suite (Phase 1 deliverable). |
| Postgres slow under listing load | M | M | Cursor pagination, GIN indexes day 1; Meilisearch escape hatch documented. |
| Realtime cost explosion (messages) | M | M | RLS-filtered subscriptions; rate-limit message inserts per user. |
| Outbox worker stuck → no notifications | L | H | Dead-letter status; admin endpoint to inspect; metric alert on `pending > 100`. |
| Solo dev burnout building all 6 phases | H | H | Phase 1 → 2 deliver a working marketplace; phases 3+ slot in as needed; ship value continuously. |

---

## 17. What we are NOT changing

To be crystal clear about scope and reduce review surface:

- `auth` flow (Supabase Auth + branded email + auto-confirm fallback) — untouched.
- Existing dashboards (Fighter, Manager, Admin) — only extended, never rewritten.
- Existing marketing site, hero, team, podcast, apparel pages — untouched.
- Existing Stripe `routes/stripe.js` (apparel checkout) — kept; sponsorship payments live in a sibling module.
- Existing 25 tables — only `profiles` (CHECK extension), `fighter_profiles` (columns added), and `obligations` (columns added) get modified in-place. All others left alone.

---

## 18. Appendix — file map (where new code will land)

```
server/
  db/migrations/
    0002_marketplace_profiles.sql       # Phase 1
    0003_marketplace_opportunities.sql  # Phase 2
    0004_marketplace_messaging.sql      # Phase 3
    0005_marketplace_contracts.sql      # Phase 4
    0006_marketplace_payments.sql       # Phase 5
    0007_marketplace_admin.sql          # Phase 6
  routes/
    sponsors.js                # Phase 1
    fighters.js                # Phase 1 (extend existing fighter.js)
    profile.js                 # Phase 1
    opportunities.js           # Phase 2
    applications.js            # Phase 2
    matches.js                 # Phase 2
    conversations.js           # Phase 3
    notifications.js           # Phase 3
    contracts.js               # Phase 4
    obligations.js             # Phase 4 (extend if any exists; else new)
    sponsorship-payments.js    # Phase 5
  jobs/
    outbox-dispatcher.js       # Phase 3
    match-recomputer.js        # Phase 2
    overdue-scanner.js         # existing extended
    contract-completer.js      # Phase 4 (daily cron)
  lib/
    state-machines.js          # status transition guards
    matching.js                # rule-based scoring
src/
  pages/
    sponsor/OnboardPage.tsx              # Phase 1
    sponsor/OpportunityFormPage.tsx      # Phase 2
    opportunities/DiscoveryPage.tsx      # Phase 2
    opportunities/DetailPage.tsx         # Phase 2
    public/FighterPublicPage.tsx         # Phase 1 (route /f/:slug)
    public/SponsorPublicPage.tsx         # Phase 1 (route /s/:slug)
    InboxPage.tsx                        # Phase 3
    contracts/ListPage.tsx               # Phase 4
    contracts/DetailPage.tsx             # Phase 4
    dashboards/SponsorDashboard.tsx      # Phase 1
  lib/api/
    sponsors.ts, fighters.ts, profile.ts # Phase 1
    opportunities.ts, applications.ts    # Phase 2
    conversations.ts, notifications.ts   # Phase 3
    contracts.ts, obligations.ts         # Phase 4
    payments.ts                          # Phase 5
docs/
  sponsorship-marketplace-tdd.md         # this file
```

---

## 19. Acceptance for this TDD

This document is considered "approved to implement" when:

1. Kevin signs off on §15 (open questions), or the defaults are explicitly accepted.
2. Atharv (or whoever owns backend) reviews §4 (schema) for any modeling concerns.
3. Phase 1 migration is reviewed line-by-line before being applied to staging Supabase.
4. We agree on the timeline scale (single-dev 10w vs. paired 5w).

— End of document.
