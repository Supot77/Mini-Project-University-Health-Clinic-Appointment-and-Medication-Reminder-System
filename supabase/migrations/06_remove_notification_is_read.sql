-- Use read_at as the single source of truth for notification acknowledgement.
DROP INDEX IF EXISTS public.idx_notifications_user;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

UPDATE public.notifications
SET read_at = COALESCE(read_at, created_at)
WHERE is_read = true;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS is_read;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;
