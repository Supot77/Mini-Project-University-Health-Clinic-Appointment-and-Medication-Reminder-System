-- Approved normalized transaction schema (2026-09-06).
-- Additive only: preserves legacy tables/data and does not enable database runtime.

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

CREATE TABLE IF NOT EXISTS public.reschedule_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  old_slot_id uuid NOT NULL REFERENCES public.appointment_slots(id) ON DELETE RESTRICT,
  proposed_slot_id uuid NOT NULL REFERENCES public.appointment_slots(id) ON DELETE RESTRICT,
  proposed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  response_deadline timestamp with time zone NOT NULL,
  reservation_expires_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  responded_at timestamp with time zone,
  responded_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  request_key text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reschedule_proposals_distinct_slots CHECK (old_slot_id <> proposed_slot_id),
  CONSTRAINT reschedule_proposals_deadline CHECK (response_deadline = sent_at + interval '24 hours'),
  CONSTRAINT reschedule_proposals_version CHECK (version > 0),
  CONSTRAINT reschedule_proposals_status CHECK (status IN ('pending', 'accepted', 'alternative_selected', 'auto_confirmed', 'rejected', 'expired', 'withdrawn', 'superseded'))
);

CREATE TABLE IF NOT EXISTS public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_record_id uuid NOT NULL REFERENCES public.medical_records(id) ON DELETE RESTRICT,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE RESTRICT,
  prescribed_quantity integer NOT NULL,
  cancelled_quantity integer NOT NULL DEFAULT 0,
  unit text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  duration_days integer,
  instructions text,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prescription_items_quantity CHECK (prescribed_quantity > 0 AND cancelled_quantity >= 0 AND cancelled_quantity <= prescribed_quantity),
  CONSTRAINT prescription_items_duration CHECK (duration_days IS NULL OR duration_days > 0),
  CONSTRAINT prescription_items_version CHECK (version > 0),
  CONSTRAINT prescription_items_status CHECK (status IN ('active', 'partially_dispensed', 'dispensed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.dispensing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  dispensed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  dispensed_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispensing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensing_event_id uuid NOT NULL REFERENCES public.dispensing_events(id) ON DELETE RESTRICT,
  prescription_item_id uuid NOT NULL REFERENCES public.prescription_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  partial_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dispensing_items_quantity CHECK (quantity > 0),
  CONSTRAINT dispensing_items_event_prescription_unique UNIQUE (dispensing_event_id, prescription_item_id)
);

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_item_id uuid NOT NULL REFERENCES public.prescription_items(id) ON DELETE RESTRICT,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  confirmed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  consumed_at timestamp with time zone,
  released_at timestamp with time zone,
  release_reason text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_reservations_quantity CHECK (quantity > 0),
  CONSTRAINT stock_reservations_version CHECK (version > 0),
  CONSTRAINT stock_reservations_status CHECK (status IN ('active', 'consumed', 'released', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.prescription_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_item_id uuid NOT NULL REFERENCES public.prescription_items(id) ON DELETE RESTRICT,
  from_version integer NOT NULL,
  to_version integer NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prescription_changes_version CHECK (from_version > 0 AND to_version = from_version + 1),
  CONSTRAINT prescription_changes_version_unique UNIQUE (prescription_item_id, to_version)
);

CREATE TABLE IF NOT EXISTS public.medication_log_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_log_id uuid NOT NULL REFERENCES public.medication_logs(id) ON DELETE RESTRICT,
  before_status text NOT NULL,
  after_status text NOT NULL,
  before_actual_datetime timestamp with time zone,
  after_actual_datetime timestamp with time zone,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT medication_log_changes_before_status CHECK (before_status IN ('pending', 'taken', 'missed')),
  CONSTRAINT medication_log_changes_after_status CHECK (after_status IN ('pending', 'taken', 'missed'))
);

CREATE TABLE IF NOT EXISTS public.email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  medication_log_id uuid REFERENCES public.medication_logs(id) ON DELETE RESTRICT,
  job_type text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone,
  sent_at timestamp with time zone,
  provider_message_id text,
  last_error text,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_reason text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_jobs_attempt_count CHECK (attempt_count >= 0),
  CONSTRAINT email_jobs_type CHECK (job_type IN ('dose_advance', 'dose_final_repeat', 'staff_override', 'appointment', 'backorder_ready')),
  CONSTRAINT email_jobs_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped_paused'))
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'broadcast',
  audience jsonb NOT NULL,
  request_key text NOT NULL UNIQUE,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT broadcasts_notification_type_check CHECK (notification_type IN ('reminder', 'appointment', 'broadcast', 'system')),
  CONSTRAINT broadcasts_audience_check CHECK (
    jsonb_typeof(audience) = 'object'
    AND jsonb_typeof(audience -> 'all') = 'boolean'
    AND jsonb_typeof(audience -> 'roles') = 'array'
    AND NOT (audience ? 'userIds')
  )
);

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_patient_type_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_patient_type_check CHECK (patient_type IS NULL OR patient_type IN ('student', 'employee'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_allergy_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_allergy_status_check CHECK (allergy_status IS NULL OR allergy_status IN ('yes', 'no', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_chronic_disease_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_chronic_disease_status_check CHECK (chronic_disease_status IS NULL OR chronic_disease_status IN ('yes', 'no', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_permission_version_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_permission_version_check CHECK (permission_version > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_slots_time_check') THEN
    ALTER TABLE public.appointment_slots ADD CONSTRAINT appointment_slots_time_check CHECK (start_time < end_time);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_slots_capacity_check') THEN
    ALTER TABLE public.appointment_slots ADD CONSTRAINT appointment_slots_capacity_check CHECK (max_capacity > 0 AND booked_count BETWEEN 0 AND max_capacity);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointment_slots_status_check') THEN
    ALTER TABLE public.appointment_slots ADD CONSTRAINT appointment_slots_status_check CHECK (status IN ('available', 'full', 'closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_status_check') THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medications_stock_check') THEN
    ALTER TABLE public.medications ADD CONSTRAINT medications_stock_check CHECK (stock >= 0 AND min_stock >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_reminders_status_check') THEN
    ALTER TABLE public.medication_reminders ADD CONSTRAINT medication_reminders_status_check CHECK (status IN ('pending_confirmation', 'active', 'completed', 'cancelled', 'paused'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_reminders_date_check') THEN
    ALTER TABLE public.medication_reminders ADD CONSTRAINT medication_reminders_date_check CHECK (end_date IS NULL OR end_date >= start_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_logs_status_check') THEN
    ALTER TABLE public.medication_logs ADD CONSTRAINT medication_logs_status_check CHECK (status IN ('pending', 'taken', 'missed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_logs_dispensing_item_fkey') THEN
    ALTER TABLE public.inventory_logs ADD CONSTRAINT inventory_logs_dispensing_item_fkey FOREIGN KEY (dispensing_item_id) REFERENCES public.dispensing_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_logs_performed_by_fkey') THEN
    ALTER TABLE public.inventory_logs ADD CONSTRAINT inventory_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_reminders_dispensing_item_fkey') THEN
    ALTER TABLE public.medication_reminders ADD CONSTRAINT medication_reminders_dispensing_item_fkey FOREIGN KEY (dispensing_item_id) REFERENCES public.dispensing_items(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_reminders_created_by_fkey') THEN
    ALTER TABLE public.medication_reminders ADD CONSTRAINT medication_reminders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medication_reminders_confirmed_by_fkey') THEN
    ALTER TABLE public.medication_reminders ADD CONSTRAINT medication_reminders_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_broadcast_id_fkey') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.broadcasts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_broadcast_user_unique') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_broadcast_user_unique UNIQUE (broadcast_id, user_id);
  END IF;
END
$constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_employee_id_unique ON public.profiles (employee_id) WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_records_appointment_unique ON public.medical_records (appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_slot_queue_unique ON public.appointments (slot_id, queue_number) WHERE queue_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_logs_idempotency_unique ON public.inventory_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_logs_dose_unique ON public.medication_logs (reminder_id, scheduled_datetime);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_user_unique ON public.notifications (user_id, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reschedule_proposals_pending ON public.reschedule_proposals (status, response_deadline);
CREATE INDEX IF NOT EXISTS idx_prescription_items_record ON public.prescription_items (medical_record_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_items_prescription ON public.dispensing_items (prescription_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_active ON public.stock_reservations (medication_id, status);
CREATE INDEX IF NOT EXISTS idx_email_jobs_due ON public.email_jobs (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON public.notifications (broadcast_id, user_id);

ALTER TABLE public.reschedule_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_log_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
