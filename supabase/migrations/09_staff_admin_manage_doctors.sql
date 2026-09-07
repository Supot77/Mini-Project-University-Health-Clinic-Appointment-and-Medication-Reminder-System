-- Allow staff_admin to manage doctors and update profile active statuses
DROP POLICY IF EXISTS "Staff/Admin can manage doctors" ON public.doctors;
DROP POLICY IF EXISTS "Staff/Admin can update profiles active status" ON public.profiles;

CREATE POLICY "Staff/Admin can manage doctors"
  ON public.doctors FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN ('staff_admin', 'admin', 'staff')
  )
  WITH CHECK (
    public.get_user_role() IN ('staff_admin', 'admin', 'staff')
  );

CREATE POLICY "Staff/Admin can update profiles active status"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('staff_admin', 'admin', 'staff')
  );
