-- Consolidate each frozen Broadcast recipient into the notifications inbox row.
-- New Broadcasts target either every active account or one or more roles only.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS broadcast_id uuid;

DO $migration$
BEGIN
  IF to_regclass('public.broadcast_recipients') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'broadcast_recipient_id'
    )
  THEN
    EXECUTE $sql$
      UPDATE public.notifications AS notification
      SET broadcast_id = recipient.broadcast_id
      FROM public.broadcast_recipients AS recipient
      WHERE notification.broadcast_recipient_id = recipient.id
        AND notification.broadcast_id IS NULL
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS broadcast_recipient_id;

DROP TABLE IF EXISTS public.broadcast_recipients;

UPDATE public.broadcasts
SET audience = jsonb_build_object(
  'all', COALESCE((audience ->> 'all')::boolean, false),
  'roles', COALESCE(audience -> 'roles', '[]'::jsonb)
)
WHERE audience ? 'userIds';

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_broadcast_id_fkey'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_broadcast_id_fkey
      FOREIGN KEY (broadcast_id) REFERENCES public.broadcasts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_broadcast_user_unique'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_broadcast_user_unique UNIQUE (broadcast_id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broadcasts_audience_check'
      AND conrelid = 'public.broadcasts'::regclass
  ) THEN
    ALTER TABLE public.broadcasts
      ADD CONSTRAINT broadcasts_audience_check CHECK (
        jsonb_typeof(audience) = 'object'
        AND jsonb_typeof(audience -> 'all') = 'boolean'
        AND jsonb_typeof(audience -> 'roles') = 'array'
        AND NOT (audience ? 'userIds')
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_notifications_broadcast
  ON public.notifications (broadcast_id, user_id);
