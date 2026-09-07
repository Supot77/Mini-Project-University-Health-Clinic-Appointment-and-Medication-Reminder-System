-- WU Clinic Booking: migrate an existing database without deleting data
--
-- ผลลัพธ์:
--   1) ลบเฉพาะ legacy tables ที่อยู่นอก scope ปัจจุบัน เมื่อ table เหล่านั้นว่าง
--   2) คงข้อมูลใน 11 current tables ไว้ทั้งหมด
--   3) เพิ่ม contract columns ที่ขาดแบบ additive
--   4) รวม role เก่าให้เหลือ patient / medical / staff_admin
--
-- ถ้า legacy table ใดมีข้อมูล สคริปต์จะ RAISE EXCEPTION และ rollback ทั้งหมด
-- เพื่อไม่ให้ข้อมูลถูกลบโดยไม่ตั้งใจ

BEGIN;

DO $guard$
DECLARE
  legacy_table text;
  row_count bigint;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'reschedule_proposals',
    'prescription_items',
    'dispensing_events',
    'dispensing_items',
    'stock_reservations',
    'prescription_changes',
    'medication_log_changes',
    'email_jobs',
    'broadcasts',
    'broadcast_recipients'
  ]
  LOOP
    IF to_regclass(format('public.%s', legacy_table)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', legacy_table)
        INTO row_count;

      IF row_count > 0 THEN
        RAISE EXCEPTION
          'หยุด migration: public.% มีข้อมูล % แถว ให้สำรอง/ย้ายข้อมูลก่อนลบ',
          legacy_table,
          row_count;
      END IF;
    END IF;
  END LOOP;
END
$guard$;

DO $drop_legacy_fks$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT
      conrelid::regclass AS referencing_table,
      conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid IN (
        SELECT to_regclass(format('public.%s', legacy_table))
        FROM unnest(ARRAY[
          'reschedule_proposals',
          'prescription_items',
          'dispensing_events',
          'dispensing_items',
          'stock_reservations',
          'prescription_changes',
          'medication_log_changes',
          'email_jobs',
          'broadcasts',
          'broadcast_recipients'
        ]) AS legacy_tables(legacy_table)
        WHERE to_regclass(format('public.%s', legacy_table)) IS NOT NULL
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      constraint_row.referencing_table,
      constraint_row.conname
    );
  END LOOP;
END
$drop_legacy_fks$;

DROP TABLE IF EXISTS public.medication_log_changes RESTRICT;
DROP TABLE IF EXISTS public.prescription_changes RESTRICT;
DROP TABLE IF EXISTS public.stock_reservations RESTRICT;
DROP TABLE IF EXISTS public.dispensing_items RESTRICT;
DROP TABLE IF EXISTS public.dispensing_events RESTRICT;
DROP TABLE IF EXISTS public.prescription_items RESTRICT;
DROP TABLE IF EXISTS public.reschedule_proposals RESTRICT;
DROP TABLE IF EXISTS public.email_jobs RESTRICT;
DROP TABLE IF EXISTS public.broadcast_recipients RESTRICT;
DROP TABLE IF EXISTS public.broadcasts RESTRICT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS patient_type text,
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS allergy_status text,
  ADD COLUMN IF NOT EXISTS chronic_disease_status text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permission_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.inventory_logs
  ADD COLUMN IF NOT EXISTS dispensing_item_id uuid,
  ADD COLUMN IF NOT EXISTS performed_by uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.medication_reminders
  ADD COLUMN IF NOT EXISTS dispensing_item_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS locked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS email_pause_until timestamp with time zone;

ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS record_deadline timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS broadcast_id uuid,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

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
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('patient', 'medical', 'staff_admin'));

DO $profile_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_patient_type_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_patient_type_check
      CHECK (patient_type IN ('student', 'employee') OR patient_type IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_allergy_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_allergy_status_check
      CHECK (allergy_status IN ('yes', 'no', 'unknown') OR allergy_status IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_chronic_disease_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_chronic_disease_status_check
      CHECK (chronic_disease_status IN ('yes', 'no', 'unknown') OR chronic_disease_status IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_permission_version_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_permission_version_check
      CHECK (permission_version >= 1);
  END IF;
END
$profile_constraints$;

COMMIT;

-- ไม่ลบข้อมูลใน profiles/departments/medications หรือ 11 current tables
-- compatibility columns ถูกเก็บไว้ แม้ legacy table ที่เกี่ยวข้องจะถูกลบ
