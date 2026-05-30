-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Marketplace Phase 3: Messaging + Notifications
--
-- Creates: conversations, conversation_participants, messages,
--          notifications, outbox_events
-- Adds messages + notifications to supabase_realtime publication
-- Sets up RLS policies for each table
--
-- Depends on: 0001_init.sql, 0002_marketplace_profiles.sql,
--             0003_marketplace_opportunities.sql
--
-- Reviewed-by: __________   Applied-to-staging: __________   Applied-to-prod: ____
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. CONVERSATIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT,
  context_type     TEXT CHECK (context_type IN ('direct','application','contract','support')) DEFAULT 'direct',
  context_id       UUID,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_context ON public.conversations (context_type, context_id) WHERE context_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. CONVERSATION PARTICIPANTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id  UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_thread   TEXT CHECK (role_in_thread IN ('member','owner','observer')) DEFAULT 'member',
  unread_count     INTEGER DEFAULT 0,
  last_read_at     TIMESTAMPTZ,
  muted            BOOLEAN DEFAULT false,
  left_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants (user_id) WHERE left_at IS NULL;

-- ── 3. MESSAGES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body             TEXT,
  message_type     TEXT CHECK (message_type IN ('text','system','attachment','application_update','contract_update')) DEFAULT 'text',
  attachments      JSONB DEFAULT '[]'::JSONB,
  edited_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at);

-- Trigger: on each new message, bump last_message_at on the conversation
-- and increment unread_count for all participants except the sender.
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Update conversation last_message_at
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Increment unread_count for all participants except the sender
  UPDATE public.conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_insert ON public.messages;
CREATE TRIGGER trg_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ── 4. NOTIFICATIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  action_url    TEXT,
  read_at       TIMESTAMPTZ,
  sent_email    BOOLEAN DEFAULT false,
  sent_email_at TIMESTAMPTZ,
  related_type  TEXT CHECK (related_type IN ('opportunity','application','contract','obligation','payment','message','conversation')),
  related_id    UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications (recipient_id, read_at NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (type);

-- ── 5. OUTBOX EVENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id               BIGSERIAL PRIMARY KEY,
  event_type       TEXT NOT NULL,
  aggregate_type   TEXT,
  aggregate_id     UUID,
  payload          JSONB NOT NULL DEFAULT '{}'::JSONB,
  status           TEXT CHECK (status IN ('pending','processing','sent','failed','dead')) DEFAULT 'pending',
  attempts         SMALLINT DEFAULT 0,
  last_error       TEXT,
  next_attempt_at  TIMESTAMPTZ DEFAULT now(),
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (status, next_attempt_at)
  WHERE status IN ('pending','failed');

-- ── 6. REALTIME PUBLICATION ──────────────────────────────────────────────────
-- Add new tables to the existing supabase_realtime publication so clients
-- can subscribe to postgres-changes events.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ── 7. ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- conversations: participant can read; backend (service role) handles writes
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant reads conversation" ON public.conversations;
CREATE POLICY "participant reads conversation"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- conversation_participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own participation" ON public.conversation_participants;
CREATE POLICY "user reads own participation"
  ON public.conversation_participants FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user updates own participation" ON public.conversation_participants;
CREATE POLICY "user updates own participation"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

-- messages: participant reads; participant inserts own messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant reads messages" ON public.messages;
CREATE POLICY "participant reads messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "participant inserts messages" ON public.messages;
CREATE POLICY "participant inserts messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- notifications: recipient reads and updates own
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipient reads notifications" ON public.notifications;
CREATE POLICY "recipient reads notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "recipient updates notifications" ON public.notifications;
CREATE POLICY "recipient updates notifications"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid());

-- outbox_events: no client policies (backend service-role only)
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
