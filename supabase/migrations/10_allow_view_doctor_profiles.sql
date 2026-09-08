-- Allow authenticated users and public to view doctor / medical profiles
-- so that patient schedules and appointments show doctor names instead of "ไม่ระบุชื่อ"

DROP POLICY IF EXISTS "Anyone can view medical profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view doctor profiles" ON public.profiles;

CREATE POLICY "Anyone can view medical profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'medical'
    OR EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = profiles.id)
  );

-- Ensure doctors table is viewable by all users
DROP POLICY IF EXISTS "Authenticated users can view doctors" ON public.doctors;
DROP POLICY IF EXISTS "Anyone can view doctors" ON public.doctors;

CREATE POLICY "Anyone can view doctors"
  ON public.doctors FOR SELECT
  USING (true);
