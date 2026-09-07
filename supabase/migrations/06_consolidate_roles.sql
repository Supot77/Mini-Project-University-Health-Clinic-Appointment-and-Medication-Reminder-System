-- Consolidate the legacy five-role catalog into the three active roles.
-- This migration is prepared for a future database rollout; it is not run by the mock app.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE public.profiles
SET role = CASE role
  WHEN 'doctor' THEN 'medical'
  WHEN 'pharmacist' THEN 'medical'
  WHEN 'staff' THEN 'staff_admin'
  WHEN 'admin' THEN 'staff_admin'
  ELSE role
END
WHERE role IN ('doctor', 'pharmacist', 'staff', 'admin');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'medical', 'staff_admin'));
