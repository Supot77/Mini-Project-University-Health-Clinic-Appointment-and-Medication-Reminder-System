-- Allow medical users to search patient profiles.
-- Safe for databases that still have the legacy policy name.

DROP POLICY IF EXISTS "Staff/Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff admin and medical can view profiles" ON public.profiles;

CREATE POLICY "Staff admin and medical can view profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() IN ('staff_admin', 'medical'));
