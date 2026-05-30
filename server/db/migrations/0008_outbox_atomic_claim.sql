-- ═════════════════════════════════════════════════════════════════════════════
-- Atomic outbox claim function
--
-- Replaces the non-atomic SELECT + UPDATE pattern in the outbox dispatcher
-- with a single UPDATE ... RETURNING that row-locks claimed rows, preventing
-- duplicate processing if two worker ticks overlap.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_outbox_batch(batch_size int, cutoff_time timestamptz)
RETURNS SETOF public.outbox_events
LANGUAGE sql
AS $$
  UPDATE public.outbox_events
  SET    status = 'processing'
  WHERE  id IN (
    SELECT id
    FROM   public.outbox_events
    WHERE  status IN ('pending', 'failed')
      AND  next_attempt_at <= cutoff_time
    ORDER  BY id
    LIMIT  batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
