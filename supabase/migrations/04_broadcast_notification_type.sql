-- Additive upgrade for databases that applied 03_normalized_transactions.sql
-- before Broadcast topics were introduced.

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'broadcast';

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'broadcasts_notification_type_check'
      AND conrelid = 'public.broadcasts'::regclass
  ) THEN
    ALTER TABLE public.broadcasts
      ADD CONSTRAINT broadcasts_notification_type_check
      CHECK (notification_type IN ('reminder', 'appointment', 'broadcast', 'system'));
  END IF;
END
$constraints$;
