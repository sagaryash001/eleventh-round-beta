-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Event Calendar
--
-- New, self-contained tables. The existing `obligations` table is contract-bound
-- (owner_id + contract semantics, status pending/…/canceled) and is NOT reused —
-- event obligations have different fields (event_id, assigned_to, 4-level
-- visibility, proof, templates) and a different status set.
--
--   events              — fights / promotion / media / weigh-in / camp / sponsor / other
--   event_participants  — links fighters / manager / promoter / sponsor to an event
--   event_obligations   — template- or manually-generated tasks leading up to an event
--
-- All access is brokered by the Express API on the service-role key; RLS policies
-- below are defense-in-depth (read-own).
--
-- Idempotent. Depends on: 0001 (profiles, set_updated_at).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. EVENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  event_type     TEXT NOT NULL DEFAULT 'fight'
                 CHECK (event_type IN ('fight','promotion_event','media_event','weigh_in','camp','sponsor_activation','other')),
  event_date     TIMESTAMPTZ NOT NULL,
  timezone       TEXT,
  location       TEXT,
  opponent       TEXT,
  promotion_name TEXT,
  weight_class   TEXT,
  status         TEXT NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','active','completed','cancelled')),
  notes          TEXT,
  visibility     TEXT NOT NULL DEFAULT 'manager_visible'
                 CHECK (visibility IN ('private','manager_visible','promoter_visible','public')),
  external_url   TEXT,
  -- owner_id = primary subject (usually the fighter); created_by = author.
  owner_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  promoter_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_owner      ON public.events (owner_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events (created_by);
CREATE INDEX IF NOT EXISTS idx_events_date       ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_manager    ON public.events (manager_id);
CREATE INDEX IF NOT EXISTS idx_events_promoter   ON public.events (promoter_id);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events read own" ON public.events;
CREATE POLICY "events read own" ON public.events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (created_by, owner_id, manager_id, promoter_id));

-- ── 2. EVENT PARTICIPANTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'fighter'
             CHECK (role IN ('fighter','manager','promoter','sponsor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants (event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user  ON public.event_participants (user_id);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event participants read own" ON public.event_participants;
CREATE POLICY "event participants read own" ON public.event_participants
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- ── 3. EVENT OBLIGATIONS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_obligations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT,
  assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date            TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'not_started'
                      CHECK (status IN ('not_started','in_progress','completed','overdue','skipped')),
  visibility          TEXT NOT NULL DEFAULT 'manager_visible'
                      CHECK (visibility IN ('private','manager_visible','promoter_visible','sponsor_visible')),
  proof_required      BOOLEAN NOT NULL DEFAULT false,
  proof_path          TEXT,
  proof_url           TEXT,
  template_key        TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_obligations_event    ON public.event_obligations (event_id);
CREATE INDEX IF NOT EXISTS idx_event_obligations_assigned ON public.event_obligations (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_event_obligations_status   ON public.event_obligations (status);
CREATE INDEX IF NOT EXISTS idx_event_obligations_due      ON public.event_obligations (due_date);

DROP TRIGGER IF EXISTS trg_event_obligations_updated_at ON public.event_obligations;
CREATE TRIGGER trg_event_obligations_updated_at BEFORE UPDATE ON public.event_obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_obligations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event obligations read own" ON public.event_obligations;
CREATE POLICY "event obligations read own" ON public.event_obligations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (assigned_to_user_id, created_by));
