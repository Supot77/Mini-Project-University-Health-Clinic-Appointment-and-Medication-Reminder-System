-- Allow public and unauthenticated users to view active services,
-- daily offerings, and active appointment slots so that guest visitors
-- can view doctor schedules and service names without logging in.

-- 1. services: allow anyone to view active services
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;

CREATE POLICY "Anyone can view active services"
  ON public.services FOR SELECT
  USING (
    is_active
    OR (auth.uid() IS NOT NULL AND public.get_user_role() IN ('medical', 'staff_admin'))
  );

-- 2. daily_service_offerings: allow anyone to view active daily offerings
DROP POLICY IF EXISTS "Authenticated users can view daily service offerings" ON public.daily_service_offerings;
DROP POLICY IF EXISTS "Anyone can view active daily service offerings" ON public.daily_service_offerings;

CREATE POLICY "Anyone can view active daily service offerings"
  ON public.daily_service_offerings FOR SELECT
  USING (
    is_active
    OR (auth.uid() IS NOT NULL AND public.get_user_role() IN ('medical', 'staff_admin'))
  );

-- 3. appointment_slots: allow anyone to view active service slots
DROP POLICY IF EXISTS "Authenticated users can view slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Authenticated users can view active service slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Anyone can view active service slots" ON public.appointment_slots;

CREATE POLICY "Anyone can view active service slots"
  ON public.appointment_slots FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND public.get_user_role() IN ('medical', 'staff_admin'))
    OR EXISTS (
      SELECT 1
      FROM public.daily_service_offerings offering
      JOIN public.services service ON service.id = offering.service_id
      WHERE offering.id = appointment_slots.daily_service_offering_id
        AND offering.doctor_id = appointment_slots.doctor_id
        AND offering.offering_date = appointment_slots.slot_date
        AND offering.is_active
        AND service.is_active
    )
  );

