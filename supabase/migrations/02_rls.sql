-- Function to bypass infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $func
  SELECT role FROM public.profiles WHERE id = auth.uid();
$func;

-- Row Level Security Policies
-- Enable RLS on all tables

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PROFILES
-- ========================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Staff/Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "New users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ========================================
-- DEPARTMENTS (read by all authenticated, write by staff/admin)
-- ========================================
CREATE POLICY "Authenticated users can view departments"
  ON public.departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff/Admin can manage departments"
  ON public.departments FOR ALL
  USING (
    public.get_user_role() = 'staff_admin'
  );

-- ========================================
-- DOCTORS (read by all authenticated)
-- ========================================
CREATE POLICY "Authenticated users can view doctors"
  ON public.doctors FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ========================================
-- APPOINTMENT_SLOTS (read by all authenticated, write by staff/admin)
-- ========================================
CREATE POLICY "Authenticated users can view slots"
  ON public.appointment_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff/Admin can manage slots"
  ON public.appointment_slots FOR ALL
  USING (
    public.get_user_role() = 'staff_admin'
  );

-- ========================================
-- APPOINTMENTS
-- ========================================
CREATE POLICY "Patients can view own appointments"
  ON public.appointments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff/Medical can view all appointments"
  ON public.appointments FOR SELECT
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

CREATE POLICY "Patients can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Patients can update own appointments"
  ON public.appointments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Staff/Medical can update any appointment"
  ON public.appointments FOR UPDATE
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

-- ========================================
-- MEDICAL_RECORDS
-- ========================================
CREATE POLICY "Patients can view own medical records"
  ON public.medical_records FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Medical can view and create medical records"
  ON public.medical_records FOR ALL
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

-- ========================================
-- MEDICATIONS (read by all authenticated, write by pharmacist/admin)
-- ========================================
CREATE POLICY "Anyone can view medications"
  ON public.medications FOR SELECT
  USING (true);

CREATE POLICY "Medical/Staff/Admin can manage medications"
  ON public.medications FOR ALL
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

-- ========================================
-- INVENTORY_LOGS
-- ========================================
CREATE POLICY "Medical/Staff/Admin can view inventory logs"
  ON public.inventory_logs FOR SELECT
  USING (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

CREATE POLICY "Medical can create inventory logs"
  ON public.inventory_logs FOR INSERT
  WITH CHECK (
    public.get_user_role() IN ('medical', 'staff_admin')
  );

-- ========================================
-- MEDICATION_REMINDERS
-- ========================================
CREATE POLICY "Users can view own reminders"
  ON public.medication_reminders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own reminders"
  ON public.medication_reminders FOR ALL
  USING (user_id = auth.uid());

-- ========================================
-- MEDICATION_LOGS
-- ========================================
CREATE POLICY "Users can view own medication logs"
  ON public.medication_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medication_reminders
      WHERE id = medication_logs.reminder_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own medication logs"
  ON public.medication_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medication_reminders
      WHERE id = medication_logs.reminder_id AND user_id = auth.uid()
    )
  );

-- ========================================
-- NOTIFICATIONS
-- ========================================
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

