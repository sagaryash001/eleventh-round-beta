-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Calendly OAuth integration
--
--   calendly_connections   — one per user; OAuth tokens stored ENCRYPTED
--   calendly_oauth_states   — short-lived CSRF state for the OAuth round-trip
--   calendly_synced_events  — Calendly scheduled events imported into Event Calendar
--   events.source           — 'manual' | 'calendly' (distinguish synced items)
--
-- Tokens are AES-256-GCM encrypted by server/lib/crypto.js before insert; the
-- raw access/refresh tokens never touch the database or the frontend.
--
-- Idempotent. Depends on: 0001 (profiles, set_updated_at), 0023 (events).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── events.source ─────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual','calendly'));

-- ── 1. CONNECTIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendly_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  calendly_user_uri       TEXT,
  calendly_org_uri        TEXT,
  scheduling_url          TEXT,
  access_token_encrypted  TEXT,
  refresh_token_encrypted TEXT,
  token_type              TEXT,
  scope                   TEXT,
  expires_at              TIMESTAMPTZ,
  last_synced_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendly_conn_user ON public.calendly_connections (user_id);

DROP TRIGGER IF EXISTS trg_calendly_conn_updated_at ON public.calendly_connections;
CREATE TRIGGER trg_calendly_conn_updated_at BEFORE UPDATE ON public.calendly_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: the user may read their own row, but the encrypted-token columns are never
-- selected by the API (only status fields are returned). All token access is via
-- the Express service-role key.
ALTER TABLE public.calendly_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendly conn read own" ON public.calendly_connections;
CREATE POLICY "calendly conn read own" ON public.calendly_connections
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- ── 2. OAUTH STATE (CSRF protection) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendly_oauth_states (
  state      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendly_states_created ON public.calendly_oauth_states (created_at);
ALTER TABLE public.calendly_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (backend) ever touches this table.

-- ── 3. SYNCED EVENTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendly_synced_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id             UUID REFERENCES public.events(id) ON DELETE SET NULL,
  calendly_event_uri   TEXT NOT NULL,
  calendly_invitee_uri TEXT,
  status               TEXT,                       -- active | canceled
  start_time           TIMESTAMPTZ,
  end_time             TIMESTAMPTZ,
  name                 TEXT,
  location             TEXT,
  raw_payload          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, calendly_event_uri)
);

CREATE INDEX IF NOT EXISTS idx_calendly_synced_user  ON public.calendly_synced_events (user_id);
CREATE INDEX IF NOT EXISTS idx_calendly_synced_event ON public.calendly_synced_events (event_id);

DROP TRIGGER IF EXISTS trg_calendly_synced_updated_at ON public.calendly_synced_events;
CREATE TRIGGER trg_calendly_synced_updated_at BEFORE UPDATE ON public.calendly_synced_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.calendly_synced_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendly synced read own" ON public.calendly_synced_events;
CREATE POLICY "calendly synced read own" ON public.calendly_synced_events
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
