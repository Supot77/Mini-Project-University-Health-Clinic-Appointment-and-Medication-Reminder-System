-- Migration 22: Fix appointments RLS policies and index to use patient_id
BEGIN;

-- 1. Drop all legacy and obsolete policies referencing user_id or old names
DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff/Medical can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff/Medical can update any appointment" ON public.appointments;
DROP POLICY IF EXISTS "Staff/Doctor can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update any appointment" ON public.appointments;
DROP POLICY IF EXISTS "Staff admin and medical can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff admin and medical can update appointments" ON public.appointments;

-- 2. Ensure RLS is enabled
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policies
CREATE POLICY "Patients can view own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

CREATE POLICY "Staff admin and medical can view appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('staff_admin', 'medical'));

-- 4. INSERT policies
CREATE POLICY "Patients can create appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Staff admin and medical can create appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('staff_admin', 'medical'));

-- 5. UPDATE policies
CREATE POLICY "Patients can update own appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Staff admin and medical can update appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('staff_admin', 'medical'))
  WITH CHECK (public.get_user_role() IN ('staff_admin', 'medical'));

-- 6. Index on patient_id
DROP INDEX IF EXISTS public.idx_appointments_user;
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments (patient_id);

COMMIT;

