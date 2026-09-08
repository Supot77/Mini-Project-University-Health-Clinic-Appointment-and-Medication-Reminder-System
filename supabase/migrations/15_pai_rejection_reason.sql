-- Add rejection reason to the Pai-owned appointment table only.
BEGIN;
ALTER TABLE public.pai_appointments
  ADD COLUMN IF NOT EXISTS rejection_reason text
  CHECK (rejection_reason IS NULL OR length(btrim(rejection_reason)) BETWEEN 1 AND 2000);

-- Three-argument version is used by the new UI. The existing two-argument
-- function remains available for compatibility and is not changed.
CREATE OR REPLACE FUNCTION public.pai_transition_appointment(
  p_appointment_id uuid, p_action text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_action='rejected' AND (p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000) THEN
    RAISE EXCEPTION 'กรุณาระบุเหตุผลการปฏิเสธไม่เกิน 2000 ตัวอักษร';
  END IF;
  PERFORM public.pai_transition_appointment(p_appointment_id,p_action);
  IF p_action='rejected' THEN
    UPDATE public.pai_appointments SET rejection_reason=btrim(p_reason),updated_at=now()
    WHERE id=p_appointment_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pai_transition_appointment(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pai_transition_appointment(uuid,text,text) TO authenticated;
COMMIT;
