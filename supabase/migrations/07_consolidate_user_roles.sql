-- Consolidate application roles into patient, staff_admin, and medical.
UPDATE public.profiles
SET role = CASE
  WHEN role = 'doctor' THEN 'medical'
  WHEN role IN ('staff', 'admin', 'pharmacist') THEN 'staff_admin'
  ELSE role
END
WHERE role IN ('doctor', 'staff', 'admin', 'pharmacist');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'staff_admin', 'medical'));

DROP POLICY IF EXISTS "Staff/Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff/Admin can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Staff/Admin can manage slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Staff/Doctor can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update any appointment" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view and create medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Pharmacist/Admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Pharmacist/Admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Pharmacist can create inventory logs" ON public.inventory_logs;

CREATE POLICY "Staff admin and medical can view profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() IN ('staff_admin', 'medical'));

CREATE POLICY "Staff admin can manage departments"
  ON public.departments FOR ALL
  USING (public.get_user_role() = 'staff_admin');

CREATE POLICY "Staff admin can manage slots"
  ON public.appointment_slots FOR ALL
  USING (public.get_user_role() = 'staff_admin');

CREATE POLICY "Staff admin and medical can view appointments"
  ON public.appointments FOR SELECT
  USING (public.get_user_role() IN ('staff_admin', 'medical'));

CREATE POLICY "Staff admin and medical can update appointments"
  ON public.appointments FOR UPDATE
  USING (public.get_user_role() IN ('staff_admin', 'medical'));

CREATE POLICY "Medical can manage medical records"
  ON public.medical_records FOR ALL
  USING (public.get_user_role() = 'medical');

CREATE POLICY "Staff admin can manage medications"
  ON public.medications FOR ALL
  USING (public.get_user_role() = 'staff_admin');

CREATE POLICY "Staff admin can view inventory logs"
  ON public.inventory_logs FOR SELECT
  USING (public.get_user_role() = 'staff_admin');

CREATE POLICY "Staff admin can create inventory logs"
  ON public.inventory_logs FOR INSERT
  WITH CHECK (public.get_user_role() = 'staff_admin');
