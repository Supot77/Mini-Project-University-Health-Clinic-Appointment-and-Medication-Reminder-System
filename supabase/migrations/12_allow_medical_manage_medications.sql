-- Allow both medical (doctors/pharmacists) and staff_admin to manage medications and inventory logs
-- so that doctors and clinic staff can add, update, and delete medications

DROP POLICY IF EXISTS "Staff admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Pharmacist/Admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Medical/Staff/Admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Medical and Staff admin can manage medications" ON public.medications;

CREATE POLICY "Medical and Staff admin can manage medications"
  ON public.medications FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin')
  )
  WITH CHECK (
    public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin')
  );

-- Also allow inventory logs for medical
DROP POLICY IF EXISTS "Staff admin can create inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Pharmacist can create inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Medical can create inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Medical and Staff admin can create inventory logs" ON public.inventory_logs;

CREATE POLICY "Medical and Staff admin can create inventory logs"
  ON public.inventory_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin')
  );

DROP POLICY IF EXISTS "Staff admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Pharmacist/Admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Medical/Staff/Admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Medical and Staff admin can view inventory logs" ON public.inventory_logs;

CREATE POLICY "Medical and Staff admin can view inventory logs"
  ON public.inventory_logs FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin')
  );
