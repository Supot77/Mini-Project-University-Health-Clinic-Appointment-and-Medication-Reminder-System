-- Extend the directory with the profile creation timestamp used for sorting.
-- Deploy to the approved development/staging target before releasing the client.
BEGIN;

-- PostgreSQL requires recreation when a TABLE return signature changes.
-- No CASCADE: unexpected dependencies must stop and roll back this migration.
DROP FUNCTION IF EXISTS public.get_staff_profile_directory();

CREATE FUNCTION public.get_staff_profile_directory()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  role text,
  is_active boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS actor
    WHERE actor.id = auth.uid()
      AND actor.role = 'staff_admin'
      AND actor.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Only staff_admin users can view the account directory'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT profile.id::uuid, profile.full_name::text, account.email::text,
    profile.phone::text, profile.role::text, profile.is_active::boolean,
    profile.created_at
  FROM public.profiles AS profile
  JOIN auth.users AS account ON account.id = profile.id
  ORDER BY profile.role, profile.full_name;
END
$function$;

REVOKE ALL ON FUNCTION public.get_staff_profile_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_profile_directory() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
