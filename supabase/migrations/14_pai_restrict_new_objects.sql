-- Hardens only objects introduced by migration 13. No pre-existing object is changed.
BEGIN;
REVOKE ALL ON public.pai_appointments, public.pai_medical_records FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.pai_appointments, public.pai_medical_records FROM authenticated;
REVOKE ALL ON FUNCTION public.pai_actor_role(),
  public.pai_can_read_appointment(uuid,uuid),
  public.pai_can_read_record(uuid,uuid,uuid),
  public.pai_book_appointment(uuid,text),
  public.pai_transition_appointment(uuid,text),
  public.pai_save_record(uuid,text,text,jsonb,boolean),
  public.pai_workspace() FROM PUBLIC, anon;
GRANT SELECT ON public.pai_appointments, public.pai_medical_records TO authenticated;
GRANT EXECUTE ON FUNCTION public.pai_actor_role(),
  public.pai_can_read_appointment(uuid,uuid),
  public.pai_can_read_record(uuid,uuid,uuid),
  public.pai_book_appointment(uuid,text),
  public.pai_transition_appointment(uuid,text),
  public.pai_save_record(uuid,text,text,jsonb,boolean),
  public.pai_workspace() TO authenticated;
COMMIT;
