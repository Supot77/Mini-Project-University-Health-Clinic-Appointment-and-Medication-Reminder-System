-- Migration 21: Point Pai workspace RPCs to canonical public.appointments and public.medical_records tables
BEGIN;

-- 1. Read access helpers
CREATE OR REPLACE FUNCTION public.pai_actor_role() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id=auth.uid() AND is_active=true;
  IF v_role IS NULL OR v_role NOT IN ('patient','medical','staff_admin') THEN
    RAISE EXCEPTION 'กรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้งานได้';
  END IF;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.pai_can_read_appointment(p_patient uuid, p_slot uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE public.pai_actor_role()
    WHEN 'patient' THEN p_patient=auth.uid()
    WHEN 'staff_admin' THEN true
    WHEN 'medical' THEN EXISTS (SELECT 1 FROM public.appointment_slots WHERE id=p_slot AND doctor_id=auth.uid())
    ELSE false END;
$$;

CREATE OR REPLACE FUNCTION public.pai_can_read_record(p_patient uuid, p_doctor uuid, p_appointment uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE public.pai_actor_role()
    WHEN 'patient' THEN p_patient=auth.uid()
    WHEN 'medical' THEN p_doctor=auth.uid()
    WHEN 'staff_admin' THEN false
    ELSE false END;
$$;

-- 2. Book appointment into public.appointments
CREATE OR REPLACE FUNCTION public.pai_book_appointment(p_slot_id uuid, p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_slot public.appointment_slots%ROWTYPE;
  v_existing integer;
  v_active integer;
  v_queue integer;
  v_id uuid;
BEGIN
  IF public.pai_actor_role()<>'patient' THEN
    RAISE EXCEPTION 'เฉพาะผู้ป่วยเท่านั้นที่จองรอบตรวจได้';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'กรุณากรอกอาการหรือเหตุผลการนัดหมาย 1 ถึง 2000 ตัวอักษร';
  END IF;
  SELECT * INTO v_slot FROM public.appointment_slots WHERE id=p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรอบตรวจ'; END IF;
  IF v_slot.status<>'available' OR (v_slot.slot_date+v_slot.start_time) AT TIME ZONE 'Asia/Bangkok'<=now() OR
    NOT EXISTS (
      SELECT 1 FROM public.doctors d
      JOIN public.profiles p ON p.id=d.id
      JOIN public.departments dep ON dep.id=d.department_id
      WHERE d.id=v_slot.doctor_id AND p.is_active AND p.role='medical' AND dep.is_active
    )
  THEN
    RAISE EXCEPTION 'รอบตรวจนี้ไม่เปิดรับจอง';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE patient_id=auth.uid() AND slot_id=p_slot_id AND status NOT IN ('cancelled','rejected','no_show')
  ) THEN
    RAISE EXCEPTION 'มีนัดในรอบนี้แล้ว';
  END IF;
  v_existing:=greatest(v_slot.booked_count,0);
  SELECT count(*) INTO v_active FROM public.appointments WHERE slot_id=p_slot_id AND status NOT IN ('cancelled','rejected','no_show');
  IF v_existing+v_active>=v_slot.max_capacity THEN
    RAISE EXCEPTION 'รอบตรวจเต็มแล้ว';
  END IF;
  SELECT coalesce(max(queue_number),v_existing)+1 INTO v_queue FROM public.appointments WHERE slot_id=p_slot_id;
  INSERT INTO public.appointments(patient_id, slot_id, queue_number, reason, status)
    VALUES(auth.uid(), p_slot_id, v_queue, btrim(p_reason), 'pending')
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 3. Transition appointment
CREATE OR REPLACE FUNCTION public.pai_transition_appointment(p_appointment_id uuid, p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_role text:=public.pai_actor_role();
  v_apt public.appointments%ROWTYPE;
  v_doctor uuid;
BEGIN
  SELECT * INTO v_apt FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบนัดหรือไม่มีสิทธิ์'; END IF;
  SELECT doctor_id INTO v_doctor FROM public.appointment_slots WHERE id=v_apt.slot_id;
  IF v_role='patient' THEN
    IF v_apt.patient_id<>auth.uid() OR p_action<>'request_cancel' THEN RAISE EXCEPTION 'ไม่มีสิทธิ์ทำรายการนี้'; END IF;
    IF v_apt.status NOT IN ('pending','confirmed') OR v_apt.cancel_requested_at IS NOT NULL THEN
      RAISE EXCEPTION 'ไม่สามารถส่งคำขอยกเลิกในสถานะนี้';
    END IF;
    UPDATE public.appointments SET cancel_requested_at=now(), updated_at=now() WHERE id=p_appointment_id;
    RETURN;
  END IF;
  IF v_role='medical' AND (v_doctor<>auth.uid() OR p_action NOT IN ('in_progress','completed')) THEN
    RAISE EXCEPTION 'แพทย์ทำรายการได้เฉพาะนัดของตน';
  END IF;
  IF p_action IS NULL OR NOT (
    (p_action IN ('confirmed','rejected') AND v_role='staff_admin' AND v_apt.status='pending') OR
    (p_action='cancelled' AND v_role='staff_admin' AND v_apt.status IN ('pending','confirmed')) OR
    (p_action='in_progress' AND v_apt.status='confirmed') OR
    (p_action='completed' AND v_apt.status='in_progress'))
  THEN
    RAISE EXCEPTION 'สถานะนัดเปลี่ยนแล้วหรือไม่อนุญาตคำสั่งนี้ กรุณาโหลดใหม่';
  END IF;
  IF p_action='completed' AND NOT EXISTS (SELECT 1 FROM public.medical_records WHERE appointment_id=p_appointment_id) THEN
    RAISE EXCEPTION 'ต้องบันทึกผลตรวจก่อนจบตรวจ';
  END IF;
  UPDATE public.appointments SET status=p_action, updated_at=now() WHERE id=p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pai_transition_appointment(p_appointment_id uuid, p_action text, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_action='rejected' AND (p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000) THEN
    RAISE EXCEPTION 'กรุณาระบุเหตุผลการปฏิเสธไม่เกิน 2000 ตัวอักษร';
  END IF;
  PERFORM public.pai_transition_appointment(p_appointment_id, p_action);
  IF p_action='rejected' THEN
    UPDATE public.appointments SET rejection_reason=btrim(p_reason), updated_at=now()
    WHERE id=p_appointment_id;
  END IF;
END;
$$;

-- 4. Save record
CREATE OR REPLACE FUNCTION public.pai_save_record(p_appointment_id uuid, p_diagnosis text, p_advice text, p_prescriptions jsonb, p_complete boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_apt public.appointments%ROWTYPE;
  v_doctor uuid;
  v_item jsonb;
  v_med public.medications%ROWTYPE;
  v_meds jsonb:='[]'::jsonb;
  v_ids uuid[]:='{}';
  v_id uuid;
BEGIN
  IF public.pai_actor_role()<>'medical' THEN RAISE EXCEPTION 'เฉพาะแพทย์เจ้าของนัดบันทึกผลตรวจได้'; END IF;
  SELECT * INTO v_apt FROM public.appointments WHERE id=p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบนัด'; END IF;
  SELECT doctor_id INTO v_doctor FROM public.appointment_slots WHERE id=v_apt.slot_id;
  IF v_doctor<>auth.uid() OR v_apt.status<>'in_progress' THEN RAISE EXCEPTION 'ต้องเป็นนัดของตนที่กำลังตรวจ'; END IF;
  IF EXISTS (SELECT 1 FROM public.medical_records WHERE appointment_id=p_appointment_id) THEN
    RAISE EXCEPTION 'บันทึกผลตรวจแล้ว ไม่สามารถแก้ใบสั่งหลังบันทึก';
  END IF;
  IF p_diagnosis IS NULL OR length(btrim(p_diagnosis)) NOT BETWEEN 1 AND 5000 OR length(coalesce(p_advice,''))>5000 THEN
    RAISE EXCEPTION 'กรุณากรอกผลตรวจและคำแนะนำไม่เกิน 5000 ตัวอักษร';
  END IF;
  IF p_prescriptions IS NULL OR jsonb_typeof(p_prescriptions)<>'array' OR jsonb_array_length(p_prescriptions)>50 THEN
    RAISE EXCEPTION 'รูปแบบรายการยาไม่ถูกต้อง';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_prescriptions) LOOP
    IF jsonb_typeof(v_item)<>'object' OR coalesce(v_item->>'quantity','')!~'^[1-9][0-9]{0,5}$' OR
      coalesce(v_item->>'duration_days','')!~'^[1-9][0-9]{0,2}$' OR coalesce(length(btrim(v_item->>'dosage')),0) NOT BETWEEN 1 AND 500 OR
      coalesce(length(btrim(v_item->>'frequency')),0) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'กรุณากรอกรายการยา จำนวน และวิธีใช้ให้ครบ';
    END IF;
    IF (v_item->>'quantity')::integer>100000 OR (v_item->>'duration_days')::integer>365 THEN
      RAISE EXCEPTION 'จำนวนยาหรือระยะเวลาไม่ถูกต้อง';
    END IF;
    SELECT * INTO v_med FROM public.medications WHERE id=(v_item->>'medication_id')::uuid AND is_active=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบยาหรือยาถูกปิดใช้งาน'; END IF;
    IF v_med.id=ANY(v_ids) THEN RAISE EXCEPTION 'รายการยาซ้ำ'; END IF;
    v_ids:=array_append(v_ids,v_med.id);
    v_meds:=v_meds||jsonb_build_array(jsonb_build_object('medication_id',v_med.id,'name',v_med.name,
      'quantity',(v_item->>'quantity')::integer,'dosage',btrim(v_item->>'dosage'),
      'frequency',btrim(v_item->>'frequency'),'duration_days',(v_item->>'duration_days')::integer));
  END LOOP;
  INSERT INTO public.medical_records(appointment_id, patient_id, doctor_id, diagnosis, treatment_notes, prescribed_medications)
    VALUES(v_apt.id, v_apt.patient_id, auth.uid(), btrim(p_diagnosis), btrim(coalesce(p_advice,'')), v_meds)
    RETURNING id INTO v_id;
  IF p_complete THEN
    UPDATE public.appointments SET status='completed', updated_at=now() WHERE id=v_apt.id;
  END IF;
  RETURN v_id;
END;
$$;

-- 5. Main Workspace RPC pointing to public.appointments and public.medical_records
CREATE OR REPLACE FUNCTION public.pai_workspace() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_role text:=public.pai_actor_role();
  v_appointments jsonb;
  v_slots jsonb;
  v_records jsonb;
  v_medications jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'user_id', a.patient_id,
    'patient', p.full_name,
    'slot_id', a.slot_id,
    'queue_number', a.queue_number,
    'reason', a.reason,
    'status', a.status,
    'cancel_requested_at', a.cancel_requested_at,
    'rejection_reason', a.rejection_reason,
    'has_record', EXISTS(SELECT 1 FROM public.medical_records r WHERE r.appointment_id=a.id)
  ) ORDER BY s.slot_date, s.start_time, a.queue_number), '[]') INTO v_appointments
  FROM public.appointments a
  JOIN public.appointment_slots s ON s.id=a.slot_id
  JOIN public.profiles p ON p.id=a.patient_id
  WHERE public.pai_can_read_appointment(a.patient_id, a.slot_id);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'doctor_id', s.doctor_id,
    'doctor', p.full_name,
    'department', coalesce(dep.name, 'ไม่ระบุบริการ'),
    'slot_date', s.slot_date,
    'start_time', s.start_time,
    'end_time', s.end_time,
    'max_capacity', s.max_capacity,
    'booked_count', greatest(s.booked_count, 0) + (
      SELECT count(*) FROM public.appointments a WHERE a.slot_id=s.id AND a.status NOT IN ('cancelled','rejected','no_show')
    ),
    'status', s.status,
    'bookable', coalesce(
      s.status='available' AND p.is_active AND p.role='medical' AND dep.is_active AND
      (s.slot_date+s.start_time) AT TIME ZONE 'Asia/Bangkok' > now(),
      false
    )
  ) ORDER BY s.slot_date, s.start_time), '[]') INTO v_slots
  FROM public.appointment_slots s
  JOIN public.doctors d ON d.id=s.doctor_id
  JOIN public.profiles p ON p.id=d.id
  LEFT JOIN public.departments dep ON dep.id=d.department_id
  WHERE (v_role='patient' AND s.slot_date>=(now() AT TIME ZONE 'Asia/Bangkok')::date)
     OR (v_role='medical' AND s.doctor_id=auth.uid())
     OR v_role='staff_admin'
     OR EXISTS(SELECT 1 FROM public.appointments a WHERE a.slot_id=s.id AND a.patient_id=auth.uid());

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'appointment_id', r.appointment_id,
    'patient_id', r.patient_id,
    'doctor_id', r.doctor_id,
    'patient', p.full_name,
    'doctor', d.full_name,
    'diagnosis', r.diagnosis,
    'treatment_notes', r.treatment_notes,
    'prescribed_medications', r.prescribed_medications,
    'created_at', r.created_at,
    'completed', a.status='completed'
  ) ORDER BY r.created_at DESC), '[]') INTO v_records
  FROM public.medical_records r
  JOIN public.profiles p ON p.id=r.patient_id
  JOIN public.profiles d ON d.id=r.doctor_id
  JOIN public.appointments a ON a.id=r.appointment_id
  WHERE public.pai_can_read_record(r.patient_id, r.doctor_id, r.appointment_id);

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type) ORDER BY name), '[]') INTO v_medications
  FROM public.medications WHERE is_active=true AND v_role='medical';

  RETURN jsonb_build_object(
    'actor', jsonb_build_object('id', auth.uid(), 'role', v_role),
    'slots', v_slots,
    'appointments', v_appointments,
    'records', v_records,
    'medications', v_medications
  );
END;
$$;

-- 6. Permissions
REVOKE ALL ON FUNCTION public.pai_actor_role(),
  public.pai_can_read_appointment(uuid,uuid),
  public.pai_can_read_record(uuid,uuid,uuid),
  public.pai_book_appointment(uuid,text),
  public.pai_transition_appointment(uuid,text),
  public.pai_transition_appointment(uuid,text,text),
  public.pai_save_record(uuid,text,text,jsonb,boolean),
  public.pai_workspace() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pai_actor_role(),
  public.pai_can_read_appointment(uuid,uuid),
  public.pai_can_read_record(uuid,uuid,uuid),
  public.pai_book_appointment(uuid,text),
  public.pai_transition_appointment(uuid,text),
  public.pai_transition_appointment(uuid,text,text),
  public.pai_save_record(uuid,text,text,jsonb,boolean),
  public.pai_workspace() TO authenticated;

COMMIT;
