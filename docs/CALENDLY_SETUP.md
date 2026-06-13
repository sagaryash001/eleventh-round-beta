# Calendly Integration — Setup

OAuth + manual sync are **fully implemented**. Webhooks are **scaffolded but untested**
(they only fire once a subscription is registered — see below).

## 1. Create a Calendly OAuth app
1. https://calendly.com/integrations/api_webhooks → **OAuth applications** → New.
2. Set the **Redirect URI** to exactly:
   `https://<your-backend>/api/calendly/oauth/callback`
   (e.g. `https://er-api.onrender.com/api/calendly/oauth/callback`).
3. Copy the **Client ID** and **Client Secret**.

## 2. Set env vars (Render — backend only)
| Var | Value |
|---|---|
| `CALENDLY_CLIENT_ID` | from the OAuth app |
| `CALENDLY_CLIENT_SECRET` | from the OAuth app (secret — never `VITE_`) |
| `CALENDLY_REDIRECT_URI` | the exact callback URL above |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` (encrypts tokens at rest) |

No `VITE_` Calendly vars are used — the connect URL is generated server-side.

## 3. Run migration
Apply `server/db/migrations/0024_calendly_integration.sql`.

## 4. Flow
- User clicks **Connect Calendly** on the Event Calendar → backend mints a CSRF
  `state`, returns the Calendly authorize URL → user authorizes → Calendly
  redirects to the backend callback → backend validates `state`, exchanges the
  code, fetches the user, and stores **encrypted** tokens → redirects to the
  dashboard with `?calendly=connected`.
- **Sync Calendly** pulls upcoming `scheduled_events` into `events`
  (`source='calendly'`) and links them via `calendly_synced_events`.
- **Disconnect** nulls the stored tokens and sets `disconnected_at`.

## 5. Webhooks (auto-created on connect)
If `CALENDLY_WEBHOOK_SIGNING_KEY` is set, the backend **automatically registers**
a user-scoped `webhook_subscription` (`invitee.created` / `invitee.canceled`)
right after OAuth connect, pointing at `CALENDLY_WEBHOOK_URL` (or the origin of
`CALENDLY_REDIRECT_URI` + `/api/calendly/webhook`). The subscription URI is stored
on `calendly_connections.webhook_uri` and **deleted on disconnect**.

- Set `CALENDLY_WEBHOOK_SIGNING_KEY` to a secret you choose — the backend passes
  it as the subscription's `signing_key`, and `routes/calendly-webhook.js` uses
  the same value to verify the HMAC on inbound events.
- Without the key, auto-subscription is skipped and **manual "Sync Calendly"**
  is the fallback (always available).
- Webhook creation uses the connected user's token and requires the Calendly
  account to permit webhook creation; failures are non-fatal (logged, manual sync
  continues).

> Note: the inbound webhook handler is **not** exercised by the automated tests —
> confirm end-to-end against a live Calendly subscription before relying on it.

## 6. Calendly scopes

Calendly's OAuth authorize request does **not** take a granular `scope=` param —
the access token inherits the connected **user's** account permissions, and the
token response may include a `scope` string we store on `calendly_connections.scope`.
So the scopes below describe what the connected Calendly **account/app** must be
allowed to do; the backend reads the stored scope when present and otherwise
**attempts the action and handles a 402/403 cleanly** (never a crash).

**Read scopes (sync + display):**
`users:read`, `event_types:read`, `scheduled_events:read`

**Webhook scopes (auto-sync subscription):**
`webhooks:read`, `webhooks:write`

**Write scopes (booking links + cancel):**
- `scheduling_links:write` (and/or `shares:write`) — create a booking link from an event type
- `scheduled_events:write` — cancel a scheduled meeting

`GET /api/calendly/status` reports `can_create_scheduling_links` and
`can_cancel_events` (derived from the stored scope, optimistic when unknown) plus
`manual_sync_enabled`, `auto_sync_active`, and the raw `scopes`.

## 7. What the integration does
**Read / import / sync:**
- OAuth connect, encrypted token storage, refresh-on-expiry.
- Manual **Sync Calendly** (forces a pull) + freshness-gated **auto-sync** on
  dashboard/calendar load (runs at most once per ~8 min; never blocks the page).
- Webhook auto-subscription (when `CALENDLY_WEBHOOK_SIGNING_KEY` is set) →
  status shows **Auto-sync active**; otherwise **Manual sync enabled**.

**Write (booking links + cancel):**
- **Create booking link** — `POST /api/calendly/scheduling-links` creates a
  Calendly scheduling link (`/scheduling_links`, `owner_type: EventType`) for a
  chosen event type and saves the `booking_url` to `events.calendly_scheduling_url`
  (+ `calendly_event_type_uri`). The app **creates the link only**; the invitee
  still picks a time slot on Calendly. The detail modal then offers **Open /
  Copy / Replace** booking link.
- **Cancel meeting** — `POST /api/calendly/events/:syncedEventId/cancel` cancels a
  synced meeting via `POST {scheduled_event_uri}/cancellation` using the **stored**
  event URI (never a client-supplied URI) and the meeting **owner's** server-side
  token. It sets `calendly_synced_events.status = canceled` and the linked
  `events.status = cancelled`; re-sync/webhooks key on `calendly_event_uri`, so
  the cancellation is **not** duplicated.
- If the account lacks the plan/scope, both routes return a clean
  *"This Calendly account does not allow this action."* message — no fake success.

Tokens are never sent to the frontend; the UI only ever sees connection status
and capability booleans.
