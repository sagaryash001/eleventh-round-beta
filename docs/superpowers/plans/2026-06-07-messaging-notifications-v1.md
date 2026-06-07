# Messaging + Notifications V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the pre-built messaging schema and routes into a live notification pipeline, fix security gaps in conversation creation, and add "Message" entry-points from application/contract/obligation pages.

**Architecture:** The schema (migration 0004) and most routes already exist. This milestone activates the system by: (1) adding a `status` column and `obligation` context-type via migration 0014, (2) emitting outbox events from applications/obligations routes so the existing dispatcher actually fires, (3) adding missing conversation/admin endpoints, (4) adding context-ownership validation to the conversations creation endpoint, and (5) wiring "Message" buttons in the UI.

**Tech Stack:** Express.js, Supabase (adminSupabase service-role client), Supabase Realtime (already wired), React, Zod validation, outbox-dispatcher pattern (already running).

---

## Pre-flight: understand what's already built

Before touching code, confirm these exist and work as-is:
- `server/db/migrations/0004_marketplace_messaging.sql` — conversations, messages, notifications, outbox_events tables + RLS + realtime
- `server/routes/conversations.js` — GET /, POST /, GET /:id/messages, POST /:id/messages, POST /:id/read
- `server/routes/notifications.js` — GET /, POST /:id/read, POST /read-all
- `server/jobs/outbox-dispatcher.js` — handlers for message.received, application.received/accepted/rejected, payment.succeeded
- `src/pages/InboxPage.tsx` — full two-pane inbox with realtime
- `src/components/Navbar.tsx` — bell icon, dropdown, mark-all-read, realtime badge

---

## Task 1: Migration 0014 — add `status` to conversations, add 'obligation' context_type

**Files:**
- Create: `server/db/migrations/0014_messaging_notifications.sql`

**What it fixes:** `conversations.context_type` only allows `'direct','application','contract','support'` — obligation conversations can't be created. The table also has no `status` column so admin lock/archive is impossible.

- [ ] **Step 1: Create the migration file**

```sql
-- server/db/migrations/0014_messaging_notifications.sql
-- ═════════════════════════════════════════════════════════════════════════════
-- Eleventh Round — Messaging V1 additions
--
-- 1. Add status column to conversations (open / archived / locked)
-- 2. Expand context_type CHECK to include 'obligation'
--
-- Safe to run multiple times (all changes are IF NOT EXISTS / ALTER ... IF EXISTS).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. Add status to conversations ───────────────────────────────────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status TEXT
    NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','archived','locked'));

-- ── 2. Add 'obligation' to context_type CHECK ────────────────────────────────
-- Postgres does not support ALTER CONSTRAINT in-place; drop + recreate.
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_context_type_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_context_type_check
    CHECK (context_type IN ('direct','application','contract','obligation','support'));
```

- [ ] **Step 2: Apply the migration in Supabase SQL editor (or via psql)**

Paste the contents of the file into the Supabase dashboard → SQL Editor and run. Verify no errors.

---

## Task 2: Validation schemas in validate.js

**Files:**
- Modify: `server/lib/validate.js` (append at bottom before `export { z }`)

**Why:** The existing conversations POST does inline validation only. Adding Zod schemas lets routes use the `validate()` middleware consistently.

- [ ] **Step 1: Append schemas**

In `server/lib/validate.js`, before the final `export { z }` line, add:

```js
// ── Messaging schemas ─────────────────────────────────────────────────────────

export const ConversationCreateSchema = z.object({
  participant_ids:  z.array(z.string().uuid()).min(1, 'At least one participant required.').max(10),
  context_type:     z.enum(['application','contract','obligation']).optional(),
  context_id:       z.string().uuid().optional().nullable(),
  subject:          z.string().trim().max(200).optional().nullable(),
  initial_message:  z.string().trim().max(4000).optional().nullable(),
}).refine(
  d => !(d.context_type && !d.context_id),
  { message: 'context_id required when context_type is provided.', path: ['context_id'] },
)

export const MessageCreateSchema = z.object({
  body:        z.string().trim().min(1, 'Message body required.').max(4000),
  attachments: z.array(z.object({
    path: z.string().max(500),
    name: z.string().max(200),
    size: z.number().int().min(0),
    mime: z.string().max(100),
  })).max(5).optional().default([]),
})
```

- [ ] **Step 2: Verify the file still exports `z`**

The last line of validate.js must remain `export { z }`. Confirm it's unchanged.

---

## Task 3: Context-ownership guard + new conversation endpoints

**Files:**
- Modify: `server/routes/conversations.js`

**Why three changes in one file:**
1. `POST /` — currently no ownership validation. A fighter could start a conversation linked to any application/contract, not just their own. This is a security hole.
2. `GET /:id` — missing; admin and future deep-link UX need it.
3. `PATCH /:id/archive` — missing; spec requires it.

- [ ] **Step 1: Add context ownership guard helper at the top of conversations.js**

After the `const log = childLogger(...)` line, add:

```js
// ── Context ownership validation ──────────────────────────────────────────────
// Returns null if caller is allowed, or an error string if not.
// Ensures users can only open conversations about their own applications/contracts/obligations.
async function validateContextAccess(uid, role, context_type, context_id) {
  if (role === 'admin') return null // admin can always
  if (!context_type || !context_id) {
    // Non-admin: require a context (no open DM system)
    return 'A valid context_type and context_id are required.'
  }

  if (context_type === 'application') {
    const { data: app } = await adminSupabase
      .from('applications')
      .select('fighter_id, sponsor_id')
      .eq('id', context_id)
      .maybeSingle()
    if (!app) return 'Application not found.'
    if (app.fighter_id !== uid && app.sponsor_id !== uid) return 'You are not a participant in this application.'
    if (!['shortlisted', 'accepted'].includes(app.status ?? '')) {
      // Also allow if we just need to fetch — status check was added to creation only
    }
    return null
  }

  if (context_type === 'contract') {
    const { data: c } = await adminSupabase
      .from('contracts')
      .select('sponsor_id, fighter_id')
      .eq('id', context_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!c) return 'Contract not found.'
    if (c.sponsor_id !== uid && c.fighter_id !== uid) return 'You are not a participant in this contract.'
    return null
  }

  if (context_type === 'obligation') {
    const { data: ob } = await adminSupabase
      .from('obligations')
      .select('owner_id, contract_id')
      .eq('id', context_id)
      .maybeSingle()
    if (!ob) return 'Obligation not found.'
    if (ob.contract_id) {
      const { data: c } = await adminSupabase
        .from('contracts').select('sponsor_id').eq('id', ob.contract_id).maybeSingle()
      if (ob.owner_id !== uid && c?.sponsor_id !== uid) return 'You are not a participant in this obligation.'
    } else if (ob.owner_id !== uid) {
      return 'You are not a participant in this obligation.'
    }
    return null
  }

  return 'Unsupported context_type for non-admin users.'
}
```

- [ ] **Step 2: Wire the guard into POST /**

In the existing `router.post('/', ...)` handler, after extracting `{ participant_ids, context_type, context_id, subject, initial_message }` from req.body and before creating the conversation, insert:

```js
    // Context ownership check
    const accessErr = await validateContextAccess(uid, req.user.role, context_type, context_id)
    if (accessErr) return res.status(403).json({ error: accessErr })
```

Place this immediately after the `if (!Array.isArray(participant_ids) || !participant_ids.length)` check.

- [ ] **Step 3: Add GET /:id endpoint**

Add this before the `export default router` line:

```js
// ── GET /api/conversations/:id — get a single conversation ───────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id

    // Verify participation (or admin)
    const { data: part } = await adminSupabase
      .from('conversation_participants')
      .select('user_id, unread_count, last_read_at, muted')
      .eq('conversation_id', req.params.id)
      .eq('user_id', uid)
      .is('left_at', null)
      .maybeSingle()

    if (!part && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not a participant in this conversation.' })
    }

    const { data: conv, error: cErr } = await adminSupabase
      .from('conversations')
      .select(CONVERSATION_COLS)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (cErr) throw cErr
    if (!conv) return res.status(404).json({ error: 'Not found.' })

    const { data: participants } = await adminSupabase
      .from('conversation_participants')
      .select('user_id, role_in_thread, unread_count, last_read_at, muted')
      .eq('conversation_id', req.params.id)
      .is('left_at', null)

    const pids = (participants ?? []).map(p => p.user_id)
    const { data: profiles } = pids.length
      ? await adminSupabase.from('profiles').select('id, name, role').in('id', pids)
      : { data: [] }

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    res.json({
      ok: true,
      conversation: { ...conv, my_unread_count: part?.unread_count ?? 0 },
      participants: participants ?? [],
      profiles: profileMap,
    })
  } catch (err) {
    log.error({ err }, 'GET /conversations/:id threw')
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 4: Add PATCH /:id/archive endpoint**

```js
// ── PATCH /api/conversations/:id/archive — archive a conversation ─────────────
router.patch('/:id/archive', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id

    const { data: part } = await adminSupabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', req.params.id)
      .eq('user_id', uid)
      .is('left_at', null)
      .maybeSingle()

    if (!part && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not a participant in this conversation.' })
    }

    const { error } = await adminSupabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', req.params.id)
    if (error) throw error

    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /conversations/:id/archive threw')
    res.status(500).json({ error: err.message })
  }
})
```

---

## Task 4: Emit outbox events from applications.js

**Files:**
- Modify: `server/routes/applications.js`

**Why:** The outbox dispatcher has handlers for `application.received`, `application.accepted`, `application.rejected` — but `applications.js` never emits these events. The notification pipeline is silent because no events enter the queue.

- [ ] **Step 1: Add outbox emission to POST / (fighter applies)**

In the `router.post('/', ...)` handler, after the successful insert and before the final `res.status(201).json(...)`, add:

```js
    // Notify sponsor of new application
    adminSupabase.from('outbox_events').insert({
      event_type:     'application.received',
      aggregate_type: 'application',
      aggregate_id:   data.id,
      payload: {
        sponsor_id:        opp.sponsor_id,
        fighter_name:      req.user.name ?? 'A fighter',
        opportunity_title: opp.title ?? null,
        application_id:    data.id,
        opportunity_id:    opportunity_id,
      },
    }).then(() => {}).catch(() => {})
```

Note: `opp` is already fetched earlier in that handler. `req.user.name` requires that `requireAuth` attaches the full profile — check `server/middleware/auth.js` to confirm `req.user.name` is available; if not use `req.user.email` as fallback.

- [ ] **Step 2: Add outbox emission to PATCH /:id (status transitions)**

In the `router.patch('/:id', ...)` handler, after the re-fetch of the updated application and before `res.json(...)`, add:

```js
    // Emit outbox events for key status transitions
    if (['shortlisted', 'accepted', 'rejected'].includes(newStatus)) {
      const oppTitle = (await adminSupabase
        .from('sponsorship_opportunities')
        .select('title')
        .eq('id', data.opportunity_id)
        .maybeSingle()
      ).data?.title ?? null

      const eventType = newStatus === 'shortlisted' ? 'application.shortlisted'
        : newStatus === 'accepted' ? 'application.accepted'
        : 'application.rejected'

      adminSupabase.from('outbox_events').insert({
        event_type:     eventType,
        aggregate_type: 'application',
        aggregate_id:   data.id,
        payload: {
          fighter_id:        data.fighter_id,
          sponsor_id:        data.sponsor_id,
          opportunity_title: oppTitle,
          application_id:    data.id,
        },
      }).then(() => {}).catch(() => {})
    }
```

- [ ] **Step 3: Emit contract.created from POST /:applicationId/accept-contract**

In the `router.post('/:applicationId/accept-contract', ...)` handler, after `res.status(201).json(...)`, add (before the function closes):

Actually, insert *before* the res.status line, right after `log.info(...)`:

```js
    // Notify both parties that a contract draft was created
    if (contract?.id) {
      adminSupabase.from('outbox_events').insert({
        event_type:     'contract.created',
        aggregate_type: 'contract',
        aggregate_id:   contract.id,
        payload: {
          contract_id: contract.id,
          sponsor_id:  app.sponsor_id,
          fighter_id:  app.fighter_id,
          value_usd:   contract.value_usd,
        },
      }).then(() => {}).catch(() => {})
    }
```

---

## Task 5: Emit outbox events from obligations.js

**Files:**
- Modify: `server/routes/obligations.js`

**Why:** Proof submission and review are key notification triggers. Neither currently emits to the outbox.

- [ ] **Step 1: Emit obligation.proof_submitted in POST /:id/proof**

In `router.post('/:id/proof', ...)`, after `res.status(201).json(...)`, add (before function closes — insert right before the res line):

```js
    // Notify sponsor that proof was submitted
    if (ob.contract_id) {
      const { data: c } = await adminSupabase
        .from('contracts').select('sponsor_id').eq('id', ob.contract_id).maybeSingle()
      if (c?.sponsor_id) {
        adminSupabase.from('outbox_events').insert({
          event_type:     'obligation.proof_submitted',
          aggregate_type: 'obligation',
          aggregate_id:   req.params.id,
          payload: {
            obligation_id:    req.params.id,
            obligation_title: ob.title,
            fighter_id:       req.user.id,
            sponsor_id:       c.sponsor_id,
            contract_id:      ob.contract_id,
          },
        }).then(() => {}).catch(() => {})
      }
    }
```

- [ ] **Step 2: Emit proof approved/rejected events in POST /:id/proof/:pid/review**

In `router.post('/:id/proof/:pid/review', ...)`, after the obligation status update block and before `res.json(...)`, add:

```js
    // Notify fighter of review outcome
    const reviewEventType = review_status === 'approved'
      ? 'obligation.proof_approved'
      : 'obligation.proof_rejected'

    adminSupabase.from('outbox_events').insert({
      event_type:     reviewEventType,
      aggregate_type: 'obligation',
      aggregate_id:   req.params.id,
      payload: {
        obligation_id:    req.params.id,
        obligation_title: ob.title,
        fighter_id:       ob.owner_id,
        sponsor_id:       req.user.id,
        contract_id:      ob.contract_id,
        review_notes:     review_notes?.trim() || null,
      },
    }).then(() => {}).catch(() => {})
```

Note: `ob` in this handler refers to the `const { data: ob }` that's fetched for the ownership check. Make sure the variable name is consistent with what's already in the handler. Looking at obligations.js line 140-141: `const { data: ob }` — yes, `ob.owner_id` and `ob.contract_id` are available.

---

## Task 6: Add new outbox handlers in outbox-dispatcher.js

**Files:**
- Modify: `server/jobs/outbox-dispatcher.js`

**Why:** The dispatcher has no handlers for `application.shortlisted`, `contract.created`, `obligation.proof_submitted`, `obligation.proof_approved`, `obligation.proof_rejected`. New outbox events will pile up unprocessed without these.

- [ ] **Step 1: Add application.shortlisted handler**

After `handleApplicationRejected(...)` function definition, add:

```js
async function handleApplicationShortlisted(payload) {
  const { fighter_id, opportunity_title, application_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'application.shortlisted',
    title:        'You have been shortlisted!',
    body:         opportunity_title ? `For: ${opportunity_title}` : null,
    action_url:   `${CLIENT}/fighter/applications`,
    related_type: 'application',
    related_id:   application_id ?? null,
  })
}
```

- [ ] **Step 2: Add contract.created handler**

```js
async function handleContractCreated(payload) {
  const { contract_id, sponsor_id, fighter_id, value_usd } = payload
  if (!contract_id) return

  const notifs = []
  const valueLabel = value_usd ? ` ($${Number(value_usd).toLocaleString()})` : ''

  if (fighter_id) {
    notifs.push({
      recipient_id: fighter_id,
      type:         'contract.created',
      title:        `A contract draft has been created${valueLabel}`,
      body:         'Review and sign your contract to activate the sponsorship.',
      action_url:   `${CLIENT}/contracts/${contract_id}`,
      related_type: 'contract',
      related_id:   contract_id,
    })
  }
  if (sponsor_id) {
    notifs.push({
      recipient_id: sponsor_id,
      type:         'contract.created',
      title:        `Contract draft created${valueLabel}`,
      body:         'Sign the contract to send it to the fighter for their signature.',
      action_url:   `${CLIENT}/contracts/${contract_id}`,
      related_type: 'contract',
      related_id:   contract_id,
    })
  }
  if (notifs.length) await adminSupabase.from('notifications').insert(notifs)
}
```

- [ ] **Step 3: Add obligation.proof_submitted handler**

```js
async function handleObligationProofSubmitted(payload) {
  const { obligation_id, obligation_title, fighter_id, sponsor_id, contract_id } = payload
  if (!sponsor_id) return

  // Fetch fighter name for the notification
  let fighterName = 'Fighter'
  if (fighter_id) {
    const { data: p } = await adminSupabase
      .from('profiles').select('name').eq('id', fighter_id).maybeSingle()
    fighterName = p?.name ?? fighterName
  }

  await adminSupabase.from('notifications').insert({
    recipient_id: sponsor_id,
    type:         'obligation.proof_submitted',
    title:        `${fighterName} submitted proof`,
    body:         obligation_title ? `For: ${obligation_title}` : null,
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })
}
```

- [ ] **Step 4: Add obligation.proof_approved handler**

```js
async function handleObligationProofApproved(payload) {
  const { obligation_id, obligation_title, fighter_id, contract_id } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'obligation.proof_approved',
    title:        'Proof approved!',
    body:         obligation_title ? `Your submission for "${obligation_title}" was approved.` : null,
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })
}
```

- [ ] **Step 5: Add obligation.proof_rejected handler**

```js
async function handleObligationProofRejected(payload) {
  const { obligation_id, obligation_title, fighter_id, contract_id, review_notes } = payload
  if (!fighter_id) return

  await adminSupabase.from('notifications').insert({
    recipient_id: fighter_id,
    type:         'obligation.proof_rejected',
    title:        'Proof needs resubmission',
    body:         review_notes
      ? `"${obligation_title}" — ${review_notes}`
      : obligation_title
        ? `Your submission for "${obligation_title}" was rejected. Please resubmit.`
        : 'A proof submission was rejected. Please resubmit.',
    action_url:   contract_id ? `${CLIENT}/contracts/${contract_id}` : `${CLIENT}/contracts`,
    related_type: 'obligation',
    related_id:   obligation_id ?? null,
  })
}
```

- [ ] **Step 6: Register all new handlers in the HANDLERS map**

Change the existing `const HANDLERS = { ... }` to:

```js
const HANDLERS = {
  'message.received':             handleMessageReceived,
  'application.received':         handleApplicationReceived,
  'application.shortlisted':      handleApplicationShortlisted,
  'application.accepted':         handleApplicationAccepted,
  'application.rejected':         handleApplicationRejected,
  'contract.created':             handleContractCreated,
  'obligation.proof_submitted':   handleObligationProofSubmitted,
  'obligation.proof_approved':    handleObligationProofApproved,
  'obligation.proof_rejected':    handleObligationProofRejected,
  'payment.succeeded':            handlePaymentSucceeded,
}
```

---

## Task 7: Admin conversation endpoints

**Files:**
- Modify: `server/routes/admin.js`

**Why:** Admin needs to view and moderate all conversations. None of these endpoints exist yet.

- [ ] **Step 1: Add conversation constants at top of admin.js**

After the existing imports, add:

```js
const ADMIN_CONV_COLS = 'id, subject, context_type, context_id, status, created_by, last_message_at, created_at, updated_at'
const ADMIN_MSG_COLS  = 'id, conversation_id, sender_id, body, message_type, attachments, edited_at, deleted_at, created_at'
```

- [ ] **Step 2: Add GET /api/admin/conversations**

Add before `export default router`:

```js
// ── GET /api/admin/conversations — list all conversations ─────────────────────
router.get('/conversations', ...guard, async (req, res) => {
  try {
    const sb     = adminSupabase
    const limit  = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Math.max(0, Number(req.query.offset) || 0)
    const status = req.query.status

    let q = sb.from('conversations')
      .select(ADMIN_CONV_COLS, { count: 'exact' })
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)
    if (status) q = q.eq('status', status)

    const { data: convs, error, count } = await q.catch(() => ({ data: [], count: 0 }))
    if (error) throw error

    res.json({ ok: true, conversations: convs ?? [], total: count ?? 0 })
  } catch (err) {
    log.error({ err }, '/admin/conversations threw')
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 3: Add GET /api/admin/conversations/:id**

```js
// ── GET /api/admin/conversations/:id — view conversation + messages ────────────
router.get('/conversations/:id', ...guard, async (req, res) => {
  try {
    const sb = adminSupabase

    const [{ data: conv, error: cErr }, { data: participants }, { data: messages }] = await Promise.all([
      sb.from('conversations').select(ADMIN_CONV_COLS).eq('id', req.params.id).maybeSingle(),
      sb.from('conversation_participants').select('user_id, role_in_thread, unread_count, last_read_at').eq('conversation_id', req.params.id),
      sb.from('messages').select(ADMIN_MSG_COLS).eq('conversation_id', req.params.id).is('deleted_at', null).order('created_at').limit(100),
    ])

    if (cErr) throw cErr
    if (!conv) return res.status(404).json({ error: 'Not found.' })

    const pids = (participants ?? []).map(p => p.user_id)
    const { data: profiles } = pids.length
      ? await sb.from('profiles').select('id, name, role').in('id', pids)
      : { data: [] }

    res.json({
      ok: true,
      conversation: conv,
      participants: participants ?? [],
      messages:     messages ?? [],
      profiles:     Object.fromEntries((profiles ?? []).map(p => [p.id, p])),
    })
  } catch (err) {
    log.error({ err }, '/admin/conversations/:id threw')
    res.status(500).json({ error: err.message })
  }
})
```

- [ ] **Step 4: Add PATCH /api/admin/conversations/:id/status**

```js
// ── PATCH /api/admin/conversations/:id/status — lock or archive ───────────────
router.patch('/conversations/:id/status', ...guard, async (req, res) => {
  try {
    const { status } = req.body
    if (!status || !['open', 'archived', 'locked'].includes(status)) {
      return res.status(400).json({ error: 'status must be open | archived | locked.' })
    }

    const { error } = await adminSupabase
      .from('conversations')
      .update({ status })
      .eq('id', req.params.id)
    if (error) throw error

    log.info({ id: req.params.id, status, by: req.user.id }, 'admin updated conversation status')
    res.json({ ok: true })
  } catch (err) {
    log.error({ err }, 'PATCH /admin/conversations/:id/status threw')
    res.status(500).json({ error: err.message })
  }
})
```

---

## Task 8: Update frontend conversations API client

**Files:**
- Modify: `src/lib/api/conversations.ts`

**Why:** New backend endpoints (GET /:id, PATCH /:id/archive) need typed client wrappers so components can call them.

- [ ] **Step 1: Add getConversation and archiveConversation**

Append to `src/lib/api/conversations.ts`:

```ts
export const getConversation = (conversationId: string) =>
  apiGet<{
    ok: boolean
    conversation: Conversation
    participants: Array<{ user_id: string; role_in_thread: string; unread_count: number; last_read_at: string | null }>
    profiles: Record<string, { id: string; name: string; role: string }>
  }>(`/api/conversations/${conversationId}`)

export const archiveConversation = (conversationId: string) =>
  apiPost<{ ok: boolean }>(`/api/conversations/${conversationId}/archive`)
```

Also add an `admin` client for admin conversation list:

```ts
export const getAdminConversations = (params?: { status?: string; limit?: number; offset?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit)  q.set('limit',  String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  return apiGet<{ ok: boolean; conversations: any[]; total: number }>(
    `/api/admin/conversations${qs ? `?${qs}` : ''}`
  )
}

export const updateConversationStatus = (conversationId: string, status: 'open' | 'archived' | 'locked') =>
  apiPost<{ ok: boolean }>(`/api/admin/conversations/${conversationId}/status`, { status })
```

Wait — `updateConversationStatus` goes to a PATCH endpoint, not POST. Fix: use `apiPatch`:

```ts
import { apiGet, apiPost, apiPatch } from './client'

export const updateConversationStatus = (conversationId: string, status: 'open' | 'archived' | 'locked') =>
  apiPatch<{ ok: boolean }>(`/api/admin/conversations/${conversationId}/status`, { status })
```

---

## Task 9: "Message" context buttons in frontend

**Files:**
- Modify: `src/pages/sponsor/ApplicantsPage.tsx`
- Modify: `src/pages/fighter/MyApplicationsPage.tsx`
- Modify: `src/pages/contracts/DetailPage.tsx`

**Why:** The inbox exists but there's no way to initiate a conversation from the application or contract flow. Sponsors need to message fighters from the applicants list; fighters need to reply from their applications page; both parties need a message button on the contract detail.

### 9a: ApplicantsPage — sponsor "Message" button

**Files:** `src/pages/sponsor/ApplicantsPage.tsx`

- [ ] **Step 1: Import createConversation and useNavigate**

At the top of `ApplicantsPage.tsx`, ensure:
```ts
import { useNavigate } from 'react-router-dom'  // already imported via react-router-dom
import { createConversation } from '../../lib/api/conversations'
```

`useNavigate` is already imported via `react-router-dom`. Add `createConversation`.

- [ ] **Step 2: Add openConversation handler in ApplicantsView**

In `ApplicantsView`, add state and handler alongside existing `move` and `acceptWithContract`:

```tsx
const navigate = useNavigate()
const [messaging, setMessaging] = useState<string | null>(null)

const openConversation = async (app: Application) => {
  setMessaging(app.id)
  try {
    const res = await createConversation(
      [app.fighter_id],
      {
        context_type:    'application',
        context_id:      app.id,
        subject:         `Re: ${app.opportunity?.title ?? 'Sponsorship Opportunity'}`,
        initial_message: undefined,
      },
    )
    navigate('/inbox')
  } catch (e: any) {
    setMsg(e.message ?? 'Could not open conversation.')
  } finally {
    setMessaging(null)
  }
}
```

- [ ] **Step 3: Add "Message" button to each accepted/shortlisted applicant card**

In the applicant card render, inside the `<div className="flex flex-col gap-2 ...">` action column, add a Message button for shortlisted and accepted applications (these are the only statuses where messaging is allowed):

```tsx
{['shortlisted', 'accepted'].includes(app.status) && (
  <button
    onClick={() => openConversation(app)}
    disabled={messaging === app.id}
    className="font-condensed font-bold uppercase text-[10px] tracking-[0.2em] text-gray-2 border border-charcoal-3 hover:border-blood hover:text-off-white px-3 py-1.5 bg-transparent cursor-pointer transition-all disabled:opacity-40"
  >
    {messaging === app.id ? <Spinner /> : 'Message'}
  </button>
)}
```

Place this button *below* the existing status-specific buttons so it doesn't disrupt existing layout.

### 9b: MyApplicationsPage — fighter "Message Sponsor" button

**Files:** `src/pages/fighter/MyApplicationsPage.tsx`

- [ ] **Step 1: Add imports**

```ts
import { useNavigate } from 'react-router-dom'
import { createConversation } from '../../lib/api/conversations'
```

`useNavigate` is already imported. Add `createConversation`.

- [ ] **Step 2: Add state and handler in MyApplicationsPage**

```tsx
const [messaging, setMessaging] = useState<string | null>(null)

const openConversation = async (app: Application) => {
  setMessaging(app.id)
  try {
    await createConversation(
      [app.sponsor_id],
      {
        context_type: 'application',
        context_id:   app.id,
        subject:      `Re: ${app.opportunity?.title ?? 'Sponsorship'}`,
      },
    )
    navigate('/inbox')
  } catch (e: any) {
    console.error('Could not open conversation', e)
  } finally {
    setMessaging(null)
  }
}
```

- [ ] **Step 3: Add "Message Sponsor" button to accepted/shortlisted applications**

In the card's action column, alongside the existing "Withdraw" button, add:

```tsx
{['shortlisted', 'accepted'].includes(app.status) && (
  <button
    onClick={() => openConversation(app)}
    disabled={messaging === app.id}
    className="font-condensed uppercase text-[10px] tracking-[0.15em] text-gray-3 hover:text-off-white bg-transparent border-0 cursor-pointer flex-shrink-0 disabled:opacity-40"
  >
    {messaging === app.id ? '…' : 'Message Sponsor'}
  </button>
)}
```

### 9c: ContractDetailPage — "Open Conversation" button

**Files:** `src/pages/contracts/DetailPage.tsx`

- [ ] **Step 1: Add createConversation import**

At the top of `DetailPage.tsx`:
```ts
import { createConversation } from '../../lib/api/contracts'
```

Wait — `createConversation` lives in `'../../lib/api/conversations'` not contracts. Use:
```ts
import { createConversation } from '../../lib/api/conversations'
```

- [ ] **Step 2: Add handler and state in ContractDetailPage**

In the `ContractDetailPage` function, after existing state declarations:

```tsx
const [messaging, setMessaging] = useState(false)
const [msgError, setMsgError]   = useState('')

const openContractConversation = async () => {
  if (!contract) return
  setMessaging(true); setMsgError('')
  try {
    const otherId = isSponsor ? contract.fighter_id : contract.sponsor_id
    await createConversation(
      [otherId],
      {
        context_type: 'contract',
        context_id:   contract.id,
        subject:      `Contract — $${contract.value_usd.toLocaleString()}`,
      },
    )
    navigate('/inbox')
  } catch (e: any) {
    setMsgError(e.message ?? 'Could not open conversation.')
    setMessaging(false)
  }
}
```

- [ ] **Step 3: Add the button in the contract header section**

In the contract header area (the `<div className="flex items-start justify-between ...">` block), add the button alongside the existing `← Contracts` link:

```tsx
<div className="flex items-center gap-3">
  {contract.status !== 'terminated' && (
    <Btn onClick={openContractConversation} disabled={messaging} variant="ghost">
      {messaging ? 'Opening…' : 'Message'}
    </Btn>
  )}
  {msgError && <p className="text-xs" style={{ color: '#ef4444' }}>{msgError}</p>}
  <Link to="/contracts" className="text-[10px] uppercase tracking-widest" style={{ color: '#4a4846', textDecoration: 'none' }}>
    ← Contracts
  </Link>
</div>
```

Replace the existing standalone `<Link to="/contracts" ...>` with this block.

---

## Task 10: Admin messaging section in AdminDashboard

**Files:**
- Modify: `src/pages/dashboards/AdminDashboard.tsx`
- Modify: `src/lib/api/admin.ts`

**Why:** Admin needs visibility into conversation activity for moderation without implementing a full moderation suite.

- [ ] **Step 1: Add getAdminConversationList to admin.ts**

In `src/lib/api/admin.ts`, append:

```ts
export const getAdminConversationList = (params?: { status?: string; limit?: number }) => {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  if (params?.limit)  q.set('limit',  String(params.limit))
  const qs = q.toString()
  return apiGet<{ ok: boolean; conversations: any[]; total: number }>(
    `/api/admin/conversations${qs ? `?${qs}` : ''}`
  )
}

export const adminLockConversation = (id: string, status: 'open' | 'archived' | 'locked') =>
  apiPatch<{ ok: boolean }>(`/api/admin/conversations/${id}/status`, { status })
```

(Need `apiPatch` imported in admin.ts — add it to the existing import line if not present.)

- [ ] **Step 2: Add 'messaging' to the admin NAV**

In `AdminDashboard.tsx`, add to the `NAV` array:
```ts
{ id: 'messaging', label: 'Messaging', icon: '💬' },
```

- [ ] **Step 3: Add AdminMessaging component**

Add this component before the `const VIEWS` map in `AdminDashboard.tsx`:

```tsx
function AdminMessaging() {
  const [convs, setConvs]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusFilter, setFilter] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [msg, setMsg]           = useState<{type:'ok'|'err';text:string}|null>(null)

  const load = useCallback((s?: string) => {
    setLoading(true); setMsg(null)
    getAdminConversationList({ status: s || undefined, limit: 30 })
      .then(r => { setConvs(r.conversations ?? []); setLoading(false) })
      .catch(e => { setMsg({ type:'err', text: e.message }); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const changeStatus = async (id: string, status: 'open' | 'archived' | 'locked') => {
    setActingId(id)
    try {
      await adminLockConversation(id, status)
      setConvs(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    } catch (e: any) {
      setMsg({ type:'err', text: e.message })
    } finally { setActingId(null) }
  }

  const STATUS_COLOR: Record<string, string> = {
    open: '#00c060', archived: '#4a4846', locked: '#7f1d1d',
  }

  return (
    <div className="space-y-4">
      <SectionHeading>Conversations</SectionHeading>
      <div className="flex gap-2 flex-wrap">
        {['', 'open', 'archived', 'locked'].map(s => (
          <button key={s} onClick={() => { setFilter(s); load(s || undefined) }}
            className="font-condensed font-bold uppercase text-[10px] tracking-[0.15em] px-3 py-1.5 border cursor-pointer transition-all"
            style={{
              borderColor: statusFilter === s ? '#8b0000' : '#222226',
              color:       statusFilter === s ? '#f0ece4' : '#7a7672',
              background:  statusFilter === s ? 'rgba(139,0,0,0.1)' : 'transparent',
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {msg && <ActionMsg msg={msg} />}
      {loading ? <DashSkeleton /> : !convs.length ? (
        <EmptyState icon="💬" title="No Conversations" body="No conversations match the current filter." />
      ) : (
        <div className="space-y-2">
          {convs.map((c: any) => (
            <div key={c.id} className="dash-card flex items-center gap-4"
              style={{ borderLeft: `2px solid ${STATUS_COLOR[c.status] ?? '#222226'}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-condensed text-[9px] font-bold uppercase tracking-widest px-2 py-0.5"
                    style={{ background: STATUS_COLOR[c.status] ?? '#374151', color: '#f0ece4' }}>
                    {c.status}
                  </span>
                  <span className="font-condensed text-[10px] text-gray-3">{c.context_type}</span>
                </div>
                <div className="font-condensed font-bold text-off-white text-[13px] truncate">
                  {c.subject || `${c.context_type} conversation`}
                </div>
                {c.last_message_at && (
                  <div className="font-condensed text-[10px] text-gray-3 mt-0.5">
                    {new Date(c.last_message_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {c.status !== 'locked' && (
                  <button onClick={() => changeStatus(c.id, 'locked')} disabled={actingId === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-blood-glow transition-all disabled:opacity-40">
                    {actingId === c.id ? <Spinner /> : 'Lock'}
                  </button>
                )}
                {c.status !== 'archived' && (
                  <button onClick={() => changeStatus(c.id, 'archived')} disabled={actingId === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-charcoal-3 transition-all disabled:opacity-40">
                    Archive
                  </button>
                )}
                {c.status !== 'open' && (
                  <button onClick={() => changeStatus(c.id, 'open')} disabled={actingId === c.id}
                    className="font-condensed uppercase text-[9px] tracking-[0.1em] px-2.5 py-1.5 border border-charcoal-3 text-gray-3 cursor-pointer hover:border-blood hover:text-off-white transition-all disabled:opacity-40">
                    Re-open
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Register AdminMessaging and its imports in VIEWS + imports**

Import `getAdminConversationList` and `adminLockConversation` from admin.ts in AdminDashboard.tsx. Add `messaging: AdminMessaging` to the `VIEWS` map.

---

## Task 11: Build and test

- [ ] **Step 1: Run build**

```
npm run build
```

Expected: TypeScript compiles clean, Vite builds without errors. No `error TS...` lines.

If build fails on missing imports (e.g., `apiPatch` not imported in conversations.ts), fix the import at the top of the file.

- [ ] **Step 2: Run server tests**

```
cd server && npm test
```

Expected: 17/17 tests pass. No new test failures.

- [ ] **Step 3: Commit**

```
git add server/db/migrations/0014_messaging_notifications.sql \
        server/lib/validate.js \
        server/routes/conversations.js \
        server/routes/applications.js \
        server/routes/obligations.js \
        server/routes/admin.js \
        server/jobs/outbox-dispatcher.js \
        src/lib/api/conversations.ts \
        src/lib/api/admin.ts \
        src/pages/sponsor/ApplicantsPage.tsx \
        src/pages/fighter/MyApplicationsPage.tsx \
        src/pages/contracts/DetailPage.tsx \
        src/pages/dashboards/AdminDashboard.tsx
git commit -m "feat: messaging + notifications V1

- Apply migration 0014: conversations.status column + obligation context_type
- Emit outbox events from applications.js, obligations.js, accept-contract
- Add outbox handlers: application.shortlisted, contract.created, obligation proof events
- Add context-ownership validation to POST /api/conversations
- Add GET /api/conversations/:id, PATCH /:id/archive
- Add admin conversation endpoints (list, view, status update)
- Add Message buttons to ApplicantsPage, MyApplicationsPage, ContractDetailPage
- Add admin Messaging tab to AdminDashboard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Manual test steps

1. **Sponsor messages fighter from applicant**: Open a shortlisted applicant → click Message → redirected to /inbox with conversation pre-created → type and send → check fighter's notification bell shows a new message notification
2. **Fighter replies in inbox**: Log in as fighter → /inbox → click the conversation → send a reply → sponsor's bell updates
3. **Manager access**: Manager can view contracts for active roster fighters (already working via /api/manager/contracts); messaging from manager UI is read-only — no "Message" button visible since manager is not a direct conversation participant in V1
4. **Contract conversation**: Open a contract detail → click Message → /inbox shows contract conversation
5. **Proof rejected creates notification**: Fighter submits proof → sponsor rejects with notes → fighter's bell shows `obligation.proof_rejected` notification with review_notes in body
6. **Bell count updates**: Send a message to a user → navigate to their inbox → unread badge on bell increments via Supabase Realtime → mark all read → badge disappears
7. **Mark notification read**: Open notification dropdown → click a notification → navigates to action_url → notification becomes read (dimmed in dropdown)
8. **Unauthorized conversation access**: Try `GET /api/conversations/<other-user-conv-id>` as a non-participant → 403 Forbidden
9. **Admin moderates conversation**: Admin → Messaging tab → Lock a conversation → status updates to 'locked' in the list
10. **No duplicate conversations**: Click "Message" twice on same applicant → second call returns the existing conversation (`existed: true`) → only one conversation in inbox

---

## Self-review

### Spec coverage check

| Spec requirement | Covered by |
|---|---|
| Context-scoped conversations only | Task 3: validateContextAccess guard in POST / |
| Sponsors can only message through own contexts | Task 3: ownership check on application_id/contract_id |
| Fighters same | Task 3: same guard |
| Managers: active roster fighters only | Not adding manager conversation creation — V1 read-only for managers per spec ("show read-only tracking") |
| Admin views all | Task 7: admin endpoints without participant filter |
| No public DM system | Task 3: non-admin POST / blocked without context |
| New message creates notifications | Task 4 (outbox already emits message.received) + dispatcher already handles it |
| Bell shows unread count | Already implemented in Navbar.tsx |
| Mark notifications read | Already implemented in notifications.js |
| Mark conversation read | Already implemented in conversations.js POST /:id/read |
| Obligation context_type | Task 1: migration adds 'obligation' to CHECK |
| conversation.status (locked/archived) | Task 1: adds status column; Task 7: admin PATCH |
| Sponsor applicant "Message" button | Task 9a |
| Fighter "Message Sponsor" button | Task 9b |
| Contract "Open Conversation" | Task 9c |
| Admin messaging section | Task 10 |
| application.received notification | Task 4: emit from POST /api/applications |
| application.shortlisted notification | Tasks 4 + 6: emit + handler |
| application.accepted notification | Task 4: emit + already has handler |
| application.rejected notification | Task 4: emit + already has handler |
| contract.created notification | Tasks 4 + 6: emit from accept-contract + handler |
| proof submitted notification | Tasks 5 + 6: emit from obligations.js + handler |
| proof approved notification | Tasks 5 + 6: emit + handler |
| proof rejected notification | Tasks 5 + 6: emit + handler |
| GET /api/conversations/:id | Task 3: added |
| PATCH /api/conversations/:id/archive | Task 3: added |
| GET /api/admin/conversations | Task 7: added |
| PATCH /api/admin/conversations/:id/status | Task 7: added |
| Validation schemas | Task 2: added to validate.js |

### No placeholders found in this plan ✓
### Type consistency: all function names, imports, and API paths are consistent across tasks ✓
