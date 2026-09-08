-- Persist one clinic-wide Broadcast and freeze its recipients atomically.
-- Both functions derive the actor from auth.uid(); the browser cannot choose
-- another sender or bypass the staff_admin role check.

-- Keep this migration safe for projects that applied only the base schema or
-- an older notification migration before running the Broadcast feature.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'broadcast',
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS broadcast_id uuid,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'broadcast',
  audience jsonb NOT NULL DEFAULT jsonb_build_object('all', true, 'roles', jsonb_build_array()),
  request_key text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'broadcast',
  ADD COLUMN IF NOT EXISTS audience jsonb NOT NULL DEFAULT jsonb_build_object('all', true, 'roles', jsonb_build_array()),
  ADD COLUMN IF NOT EXISTS request_key text,
  ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS broadcasts_request_key_unique
  ON public.broadcasts (request_key);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_broadcast_user_unique
  ON public.notifications (broadcast_id, user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- Keep the migration self-contained when the role helper was not installed
-- by an earlier migration.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT profile.role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff admin can create notifications" ON public.notifications;

CREATE POLICY "Staff admin can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.get_user_role() = 'staff_admin');

DROP FUNCTION IF EXISTS public.send_broadcast(text, text, text);
DROP FUNCTION IF EXISTS public.get_broadcast_history(integer);

CREATE OR REPLACE FUNCTION public.send_broadcast(
  p_title text,
  p_message text,
  p_request_key text
)
RETURNS TABLE(recipient_count integer, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_broadcast_id uuid;
  v_title text := btrim(COALESCE(p_title, ''));
  v_message text := btrim(COALESCE(p_message, ''));
  v_request_key text := btrim(COALESCE(p_request_key, ''));
  v_recipient_count integer := 0;
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = v_actor_id
      AND profile.role = 'staff_admin'
      AND profile.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Only active staff_admin users can send Broadcasts'
      USING ERRCODE = '42501';
  END IF;

  IF v_title = '' OR v_message = '' OR v_request_key = '' THEN
    RAISE EXCEPTION 'Title, message, and request key are required'
      USING ERRCODE = '23514';
  END IF;

  IF char_length(v_title) > 120 OR char_length(v_message) > 1000 THEN
    RAISE EXCEPTION 'Broadcast content exceeds the allowed length'
      USING ERRCODE = '22001';
  END IF;

  SELECT broadcast.id
  INTO v_broadcast_id
  FROM public.broadcasts AS broadcast
  WHERE broadcast.request_key = v_request_key;

  IF v_broadcast_id IS NOT NULL THEN
    SELECT count(*)::integer
    INTO v_recipient_count
    FROM public.notifications AS notification
    WHERE notification.broadcast_id = v_broadcast_id;

    RETURN QUERY SELECT v_recipient_count, false;
    RETURN;
  END IF;

  INSERT INTO public.broadcasts (
    sent_by,
    title,
    message,
    notification_type,
    audience,
    request_key
  )
  VALUES (
    v_actor_id,
    v_title,
    v_message,
    'broadcast',
    jsonb_build_object('all', true, 'roles', jsonb_build_array()),
    v_request_key
  )
  ON CONFLICT (request_key) DO NOTHING
  RETURNING id INTO v_broadcast_id;

  IF v_broadcast_id IS NULL THEN
    SELECT broadcast.id
    INTO v_broadcast_id
    FROM public.broadcasts AS broadcast
    WHERE broadcast.request_key = v_request_key;

    SELECT count(*)::integer
    INTO v_recipient_count
    FROM public.notifications AS notification
    WHERE notification.broadcast_id = v_broadcast_id;

    RETURN QUERY SELECT v_recipient_count, false;
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    event_key,
    broadcast_id
  )
  SELECT
    profile.id,
    'broadcast',
    v_title,
    v_message,
    'broadcast:' || v_broadcast_id::text || ':' || profile.id::text,
    v_broadcast_id
  FROM public.profiles AS profile
  WHERE profile.is_active IS DISTINCT FROM false
  ON CONFLICT (broadcast_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_recipient_count = ROW_COUNT;

  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'No active Broadcast recipients were found'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY SELECT v_recipient_count, true;
END
$function$;

CREATE OR REPLACE FUNCTION public.get_broadcast_history(p_limit integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  title text,
  message text,
  sent_at timestamp with time zone,
  recipient_count bigint,
  read_count bigint,
  role_read_counts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.role = 'staff_admin'
      AND profile.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Only active staff_admin users can view Broadcast history'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    broadcast.id,
    broadcast.title,
    broadcast.message,
    broadcast.sent_at,
    count(notification.id) AS recipient_count,
    count(notification.id) FILTER (WHERE notification.read_at IS NOT NULL) AS read_count,
    jsonb_build_object(
      'patient', jsonb_build_object(
        'read', count(notification.id) FILTER (WHERE profile.role = 'patient' AND notification.read_at IS NOT NULL),
        'total', count(notification.id) FILTER (WHERE profile.role = 'patient')
      ),
      'medical', jsonb_build_object(
        'read', count(notification.id) FILTER (WHERE profile.role = 'medical' AND notification.read_at IS NOT NULL),
        'total', count(notification.id) FILTER (WHERE profile.role = 'medical')
      ),
      'staff_admin', jsonb_build_object(
        'read', count(notification.id) FILTER (WHERE profile.role = 'staff_admin' AND notification.read_at IS NOT NULL),
        'total', count(notification.id) FILTER (WHERE profile.role = 'staff_admin')
      )
    ) AS role_read_counts
  FROM public.broadcasts AS broadcast
  LEFT JOIN public.notifications AS notification
    ON notification.broadcast_id = broadcast.id
  LEFT JOIN public.profiles AS profile
    ON profile.id = notification.user_id
  GROUP BY broadcast.id, broadcast.title, broadcast.message, broadcast.sent_at
  ORDER BY broadcast.sent_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
END
$function$;

REVOKE ALL ON FUNCTION public.send_broadcast(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_broadcast_history(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_broadcast(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_broadcast_history(integer) TO authenticated;
