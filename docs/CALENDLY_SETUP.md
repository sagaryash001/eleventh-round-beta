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

### A note on OAuth scopes
Calendly's OAuth does not use granular scope strings in the authorize request —
an access token carries the connected user's account permissions. Webhook
creation therefore works when the user is allowed to manage webhooks on their
Calendly plan; there is no `scope=webhooks:write` parameter to add to the
authorize URL.
