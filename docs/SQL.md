# SQL ฐานเดิมสำหรับอ้างอิง

ปรับปรุง 5 กันยายน 2569 (2026-09-05) — ข้อกำหนดสำหรับพัฒนา ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

SQL ด้านล่างเป็นฐานเก่าก่อนข้อสรุปการเลื่อนนัด แบ่งจ่าย กันยาและเตือนใหม่ **ไม่ใช่ migration สำหรับข้อสรุปล่าสุด และไม่ควรคัดลอกไปรันเพื่ออัปเดตฐานปัจจุบัน** ดู [03](03_database_design_and_er.md) และ [09](09_implementation_plan.md) ก่อนออกแบบ migration ภายหลัง

```sql
-- SQL เดิม เก็บเพื่ออ้างอิงประวัติเท่านั้น

CREATE TABLE public.medications (
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

CREATE TABLE public.profiles (
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.doctors (
  id uuid NOT NULL,
  specialty text,
  department_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT doctors_pkey PRIMARY KEY (id),
  CONSTRAINT doctors_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT doctors_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);

CREATE TABLE public.appointment_slots (
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

CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  queue_number integer,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text, -- pending, confirmed, in_progress, completed, cancelled, no_show, rejected
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT appointments_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.appointment_slots(id)
);

CREATE TABLE public.medical_records (
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

CREATE TABLE public.inventory_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL,
  pharmacist_id uuid NOT NULL,
  action text NOT NULL,
  quantity integer NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_logs_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_logs_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id),
  CONSTRAINT inventory_logs_pharmacist_id_fkey FOREIGN KEY (pharmacist_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.medication_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  reminder_times text[] NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT medication_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT medication_reminders_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id)
);

CREATE TABLE public.medication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL,
  scheduled_datetime timestamp with time zone NOT NULL,
  actual_datetime timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_logs_pkey PRIMARY KEY (id),
  CONSTRAINT medication_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.medication_reminders(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
```
