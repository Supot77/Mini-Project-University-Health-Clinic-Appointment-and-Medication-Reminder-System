-- Refresh only Pai's workspace payload after adding the Pai-owned rejection reason.
BEGIN;
CREATE OR REPLACE FUNCTION public.pai_workspace() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text:=public.pai_actor_role(); v_appointments jsonb; v_slots jsonb; v_records jsonb; v_medications jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'user_id',a.patient_id,'patient',p.full_name,'slot_id',a.slot_id,
    'queue_number',a.queue_number,'reason',a.reason,'status',a.status,'cancel_requested_at',a.cancel_requested_at,'rejection_reason',a.rejection_reason,
    'has_record',EXISTS(SELECT 1 FROM public.pai_medical_records r WHERE r.appointment_id=a.id)) ORDER BY s.slot_date,s.start_time,a.queue_number),'[]') INTO v_appointments
  FROM public.pai_appointments a JOIN public.appointment_slots s ON s.id=a.slot_id JOIN public.profiles p ON p.id=a.patient_id
  WHERE public.pai_can_read_appointment(a.patient_id,a.slot_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'doctor_id',s.doctor_id,'doctor',p.full_name,'department',coalesce(dep.name,'ไม่ระบุบริการ'),
    'slot_date',s.slot_date,'start_time',s.start_time,'end_time',s.end_time,'max_capacity',s.max_capacity,
    'booked_count',greatest(s.booked_count,0)+(SELECT count(*) FROM public.pai_appointments a WHERE a.slot_id=s.id AND a.status NOT IN ('cancelled','rejected','no_show')),
    'status',s.status,'bookable',coalesce(s.status='available' AND p.is_active AND p.role='medical' AND dep.is_active AND
      (s.slot_date+s.start_time) AT TIME ZONE 'Asia/Bangkok'>now(),false)) ORDER BY s.slot_date,s.start_time),'[]') INTO v_slots
  FROM public.appointment_slots s JOIN public.doctors d ON d.id=s.doctor_id JOIN public.profiles p ON p.id=d.id LEFT JOIN public.departments dep ON dep.id=d.department_id
  WHERE (v_role='patient' AND s.slot_date>=(now() AT TIME ZONE 'Asia/Bangkok')::date) OR (v_role='medical' AND s.doctor_id=auth.uid()) OR v_role='staff_admin'
    OR EXISTS(SELECT 1 FROM public.pai_appointments a WHERE a.slot_id=s.id AND a.patient_id=auth.uid());
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'appointment_id',r.appointment_id,'patient_id',r.patient_id,'doctor_id',r.doctor_id,
    'patient',p.full_name,'doctor',d.full_name,'diagnosis',r.diagnosis,'treatment_notes',r.treatment_notes,'prescribed_medications',r.prescribed_medications,
    'created_at',r.created_at,'completed',a.status='completed') ORDER BY r.created_at DESC),'[]') INTO v_records
  FROM public.pai_medical_records r JOIN public.profiles p ON p.id=r.patient_id JOIN public.profiles d ON d.id=r.doctor_id JOIN public.pai_appointments a ON a.id=r.appointment_id
  WHERE public.pai_can_read_record(r.patient_id,r.doctor_id,r.appointment_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type) ORDER BY name),'[]') INTO v_medications
  FROM public.medications WHERE is_active=true AND v_role='medical';
  RETURN jsonb_build_object('actor',jsonb_build_object('id',auth.uid(),'role',v_role),'slots',v_slots,'appointments',v_appointments,'records',v_records,'medications',v_medications);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pai_workspace() TO authenticated;
COMMIT;
