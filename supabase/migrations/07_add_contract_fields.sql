-- Persist fields already defined in src/types/database.ts.
-- Additive future database rollout; the mock app does not execute this migration.

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
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.profiles(id),
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
