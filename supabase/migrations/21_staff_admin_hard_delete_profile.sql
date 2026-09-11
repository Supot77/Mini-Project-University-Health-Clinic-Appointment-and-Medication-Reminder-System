-- Permanently delete a suspended account and its auth identity.
-- This is intentionally restricted to staff_admin and is only available
-- after the account has been soft-deleted (is_active = false).

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.staff_admin_delete_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'staff_admin'
      AND actor.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Only active staff_admin users can delete accounts'
      USING ERRCODE = '42501';
  END IF;

  IF p_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'ไม่สามารถลบบัญชีของตัวเองได้';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS target
    WHERE target.id = p_profile_id
      AND target.is_active IS FALSE
  ) THEN
    RAISE EXCEPTION 'ลบถาวรได้เฉพาะบัญชีที่ถูกระงับแล้ว';
  END IF;

  DELETE FROM public.profiles
  WHERE id = p_profile_id;

  DELETE FROM auth.users
  WHERE id = p_profile_id;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'บัญชีนี้มีข้อมูลที่เชื่อมโยงอยู่ จึงไม่สามารถลบถาวรได้ กรุณาคงสถานะระงับไว้แทน';
END
$function$;

REVOKE ALL ON FUNCTION private.staff_admin_delete_profile(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_admin_delete_profile(uuid) TO authenticated;

-- Keep the callable RPC in the exposed schema as an invoker wrapper. The
-- privileged delete stays in the private schema and still validates auth.uid().
CREATE OR REPLACE FUNCTION public.staff_admin_delete_profile(p_profile_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private, pg_temp
AS $function$
  SELECT private.staff_admin_delete_profile(p_profile_id);
$function$;

REVOKE ALL ON FUNCTION public.staff_admin_delete_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_admin_delete_profile(uuid) TO authenticated;
