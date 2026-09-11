-- WU Clinic Booking System - Database Schema
-- รันสคริปต์นี้ใน Supabase SQL Editor
-- ลำดับตารางถูกต้องตาม Foreign Key dependency

-- ========================================
-- 1. MEDICATIONS (คลังยาและเวชภัณฑ์)
-- ========================================
CREATE TABLE IF NOT EXISTS public.medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  expiry_date date,
  description text,
  ingredients text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT medications_pkey PRIMARY KEY (id)
);

-- ========================================
-- 2. PROFILES (ข้อมูลผู้ใช้งาน ขยายจาก Supabase Auth)
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  student_id text UNIQUE,
  full_name text NOT NULL,
  phone text,
  emergency_phone text,
  address text,
  allergies text,
  chronic_diseases text,
  role text NOT NULL DEFAULT 'patient'::text,
  avatar_url text,
  patient_type text,
  employee_id text,
  organization text,
  allergy_status text,
  chronic_disease_status text,
  is_active boolean NOT NULL DEFAULT true,
  permission_version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'medical', 'staff_admin')),
  CONSTRAINT profiles_patient_type_check CHECK (patient_type IN ('student', 'employee') OR patient_type IS NULL),
  CONSTRAINT profiles_allergy_status_check CHECK (allergy_status IN ('yes', 'no', 'unknown') OR allergy_status IS NULL),
  CONSTRAINT profiles_chronic_disease_status_check CHECK (chronic_disease_status IN ('yes', 'no', 'unknown') OR chronic_disease_status IS NULL),
  CONSTRAINT profiles_permission_version_check CHECK (permission_version >= 1),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- ========================================
-- 3. DEPARTMENTS (แผนกการรักษา)
-- ========================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

-- ========================================
-- 4. DOCTORS (ข้อมูลแพทย์)
-- ========================================
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid NOT NULL,
  specialty text,
  department_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT doctors_pkey PRIMARY KEY (id),
  CONSTRAINT doctors_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT doctors_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);

-- ========================================
-- 5. APPOINTMENT_SLOTS (รอบเวลาตรวจของแพทย์)
-- ========================================
CREATE TABLE IF NOT EXISTS public.appointment_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL,
  slot_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  max_capacity integer NOT NULL DEFAULT 1,
  booked_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT appointment_slots_pkey PRIMARY KEY (id),
  CONSTRAINT appointment_slots_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
);

-- ========================================
-- 6. APPOINTMENTS (รายการนัดหมาย/คิวตรวจ)
-- ========================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  queue_number integer,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id),
  CONSTRAINT appointments_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.appointment_slots(id)
);

-- ========================================
-- 7. MEDICAL_RECORDS (ประวัติการตรวจและการสั่งยา)
-- ========================================
CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  diagnosis text,
  treatment_notes text,
  prescribed_medications jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medical_records_pkey PRIMARY KEY (id),
  CONSTRAINT medical_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT medical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.profiles(id),
  CONSTRAINT medical_records_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id)
);

-- ========================================
-- 8. INVENTORY_LOGS (ประวัติการจัดการคลังยา)
-- ========================================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL,
  pharmacist_id uuid NOT NULL,
  action text NOT NULL,
  quantity integer NOT NULL,
  reason text,
  dispensing_item_id uuid,
  performed_by uuid,
  idempotency_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_logs_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_logs_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id),
  CONSTRAINT inventory_logs_pharmacist_id_fkey FOREIGN KEY (pharmacist_id) REFERENCES public.profiles(id)
);

-- ========================================
-- 9. MEDICATION_REMINDERS (การตั้งเวลาเตือนกินยา)
-- ========================================
CREATE TABLE IF NOT EXISTS public.medication_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  reminder_times text[] NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active'::text,
  dispensing_item_id uuid,
  created_by uuid REFERENCES public.profiles(id),
  confirmed_by uuid REFERENCES public.profiles(id),
  confirmed_at timestamp with time zone,
  locked_at timestamp with time zone,
  email_pause_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT medication_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT medication_reminders_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id)
);

-- ========================================
-- 10. MEDICATION_LOGS (ประวัติบันทึกการกินยาแต่ละมื้อ)
-- ========================================
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL,
  scheduled_datetime timestamp with time zone NOT NULL,
  actual_datetime timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  record_deadline timestamp with time zone,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_logs_pkey PRIMARY KEY (id),
  CONSTRAINT medication_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.medication_reminders(id)
);

-- ========================================
-- 11. NOTIFICATIONS (กล่องแจ้งเตือนภายในระบบ)
-- ========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  event_key text,
  broadcast_id uuid,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles (student_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_doctor ON appointment_slots (doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON appointment_slots (slot_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments (slot_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records (patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor ON medical_records (doctor_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications (is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_medication ON inventory_logs (medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_user ON medication_reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_reminder ON medication_logs (reminder_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);
