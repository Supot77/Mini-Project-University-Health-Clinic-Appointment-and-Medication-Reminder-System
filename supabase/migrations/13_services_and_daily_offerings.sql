-- Services replace departments as the bookable unit.
-- Departments remain doctor expertise classifications.

CREATE TABLE IF NOT EXISTS public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_code_key UNIQUE (code),
  CONSTRAINT services_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT services_code_check CHECK (length(trim(code)) > 0)
);

CREATE TABLE IF NOT EXISTS public.daily_service_offerings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  offering_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_service_offerings_pkey PRIMARY KEY (id),
  CONSTRAINT daily_service_offerings_unique_day UNIQUE (service_id, doctor_id, offering_date),
  CONSTRAINT daily_service_offerings_identity_key UNIQUE (id, doctor_id, offering_date)
);

ALTER TABLE public.appointment_slots
  ADD COLUMN IF NOT EXISTS daily_service_offering_id uuid;

-- Preserve existing slots by creating inactive-safe legacy service records.
INSERT INTO public.services (code, name, description, is_active)
SELECT 'LEGACY-' || d.id::text, d.name, d.description, true
FROM public.departments d
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.services (code, name, description, is_active)
VALUES ('LEGACY-UNASSIGNED', 'บริการเดิมที่ยังไม่ระบุ', 'บริการที่ผูกกับ slot เดิมซึ่งยังไม่มีแผนกอ้างอิง', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.daily_service_offerings (service_id, doctor_id, offering_date, is_active)
SELECT DISTINCT
  COALESCE(dept_service.id, fallback_service.id),
  slot.doctor_id,
  slot.slot_date,
  true
FROM public.appointment_slots slot
JOIN public.doctors doc ON doc.id = slot.doctor_id
LEFT JOIN public.departments dept ON dept.id = doc.department_id
LEFT JOIN public.services dept_service ON dept_service.code = 'LEGACY-' || dept.id::text
JOIN public.services fallback_service ON fallback_service.code = 'LEGACY-UNASSIGNED'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.daily_service_offerings existing
  WHERE existing.service_id = COALESCE(dept_service.id, fallback_service.id)
    AND existing.doctor_id = slot.doctor_id
    AND existing.offering_date = slot.slot_date
);

UPDATE public.appointment_slots slot
SET daily_service_offering_id = offering.id
FROM public.doctors doc
LEFT JOIN public.departments dept ON dept.id = doc.department_id
LEFT JOIN public.services dept_service ON dept_service.code = 'LEGACY-' || dept.id::text
JOIN public.services fallback_service ON fallback_service.code = 'LEGACY-UNASSIGNED'
JOIN public.daily_service_offerings offering
  ON offering.service_id = COALESCE(dept_service.id, fallback_service.id)
 AND offering.doctor_id = doc.id
WHERE doc.id = slot.doctor_id
  AND offering.offering_date = slot.slot_date;

ALTER TABLE public.appointment_slots
  ALTER COLUMN daily_service_offering_id SET NOT NULL;

ALTER TABLE public.appointment_slots
  ADD CONSTRAINT appointment_slots_daily_service_offering_fkey
  FOREIGN KEY (daily_service_offering_id, doctor_id, slot_date)
  REFERENCES public.daily_service_offerings (id, doctor_id, offering_date);

CREATE INDEX IF NOT EXISTS idx_services_active ON public.services (is_active, name);
CREATE INDEX IF NOT EXISTS idx_daily_service_offerings_date ON public.daily_service_offerings (offering_date, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_service_offerings_doctor ON public.daily_service_offerings (doctor_id, offering_date);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_offering ON public.appointment_slots (daily_service_offering_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_service_offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;
DROP POLICY IF EXISTS "Medical and staff admin can manage services" ON public.services;
CREATE POLICY "Authenticated users can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (is_active OR public.get_user_role() IN ('medical', 'staff_admin'));
CREATE POLICY "Medical and staff admin can manage services"
  ON public.services FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('medical', 'staff_admin'))
  WITH CHECK (public.get_user_role() IN ('medical', 'staff_admin'));

DROP POLICY IF EXISTS "Authenticated users can view daily service offerings" ON public.daily_service_offerings;
DROP POLICY IF EXISTS "Medical and staff admin can manage daily service offerings" ON public.daily_service_offerings;
CREATE POLICY "Authenticated users can view daily service offerings"
  ON public.daily_service_offerings FOR SELECT
  TO authenticated
  USING (is_active OR public.get_user_role() IN ('medical', 'staff_admin'));
CREATE POLICY "Medical and staff admin can manage daily service offerings"
  ON public.daily_service_offerings FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'staff_admin'
    OR (public.get_user_role() = 'medical' AND doctor_id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'staff_admin'
    OR (public.get_user_role() = 'medical' AND doctor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can view slots" ON public.appointment_slots;
CREATE POLICY "Authenticated users can view active service slots"
  ON public.appointment_slots FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
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

DROP POLICY IF EXISTS "Staff admin can manage slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Staff/Admin can manage slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Staff admin and medical can manage slots" ON public.appointment_slots;
CREATE POLICY "Staff admin and medical can manage slots"
  ON public.appointment_slots FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'staff_admin'
    OR (public.get_user_role() = 'medical' AND doctor_id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'staff_admin'
    OR (public.get_user_role() = 'medical' AND doctor_id = auth.uid())
  );
