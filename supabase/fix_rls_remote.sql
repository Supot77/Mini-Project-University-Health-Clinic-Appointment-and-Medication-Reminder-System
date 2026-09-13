-- รันสคริปต์นี้ใน Supabase SQL Editor เพื่อแก้ไขปัญหา Infinite Recursion และเปิดให้ดูข้อมูลยาได้โดยไม่ต้อง Login

-- 1. สร้างฟังก์ชันเพื่อดึง Role โดยไม่ติด RLS
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Consolidate legacy profile roles before the new policies are evaluated.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

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
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'medical', 'staff_admin'));

-- 2. ลบ Policy เดิมที่มีปัญหาหรือต้องการแก้ไข
DROP POLICY IF EXISTS "Staff/Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff/Admin can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Staff admin can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Staff/Admin can manage slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Doctors can manage own slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Staff/Doctor can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff/Medical can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update any appointment" ON public.appointments;
DROP POLICY IF EXISTS "Staff/Medical can update any appointment" ON public.appointments;
DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff admin and medical can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff admin and medical can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view and create medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Medical can view and create medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Authenticated users can view medications" ON public.medications;
DROP POLICY IF EXISTS "Pharmacist/Admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Medical/Staff/Admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Pharmacist/Admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Medical/Staff/Admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Pharmacist can create inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Medical can create inventory logs" ON public.inventory_logs;

-- 3. สร้าง Policy ใหม่
CREATE POLICY "Staff/Admin can view all profiles" ON public.profiles FOR SELECT USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Staff/Admin can manage departments"
  ON public.departments
  FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('staff_admin', 'staff', 'admin'))
  WITH CHECK (public.get_user_role() IN ('staff_admin', 'staff', 'admin'));
CREATE POLICY "Staff/Admin can manage slots"
  ON public.appointment_slots
  FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('staff_admin', 'staff', 'admin'))
  WITH CHECK (public.get_user_role() IN ('staff_admin', 'staff', 'admin'));
CREATE POLICY "Doctors can manage own slots"
  ON public.appointment_slots
  FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('medical', 'doctor') AND doctor_id = auth.uid())
  WITH CHECK (public.get_user_role() IN ('medical', 'doctor') AND doctor_id = auth.uid());

-- เปิดให้อ่านรอบตรวจได้ทั่วไป (Public Read) ไม่ติด 403
DROP POLICY IF EXISTS "Authenticated users can view slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Anyone can view slots" ON public.appointment_slots;
CREATE POLICY "Anyone can view slots"
  ON public.appointment_slots
  FOR SELECT
  USING (true);

CREATE POLICY "Patients can view own appointments" ON public.appointments FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Patients can create appointments" ON public.appointments FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Patients can update own appointments" ON public.appointments FOR UPDATE USING (patient_id = auth.uid());
CREATE POLICY "Staff/Doctor can view all appointments" ON public.appointments FOR SELECT USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Staff can update any appointment" ON public.appointments FOR UPDATE USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Staff admin and medical can create appointments" ON public.appointments FOR INSERT WITH CHECK (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Doctors can view and create medical records" ON public.medical_records FOR ALL USING (public.get_user_role() = 'medical');

-- เปิดให้อ่านข้อมูลยาได้โดยไม่ต้อง Login (Public Read)
CREATE POLICY "Anyone can view medications" ON public.medications FOR SELECT USING (true);

CREATE POLICY "Medical and Staff admin can manage medications" ON public.medications FOR ALL TO authenticated USING (public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin')) WITH CHECK (public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin'));
CREATE POLICY "Medical and Staff admin can view inventory logs" ON public.inventory_logs FOR SELECT TO authenticated USING (public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin'));
CREATE POLICY "Medical and Staff admin can create inventory logs" ON public.inventory_logs FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN ('medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin'));

-- เปิดให้อ่านโปรไฟล์แพทย์และข้อมูลแพทย์ได้ทั่วไป เพื่อให้ชื่อแพทย์แสดงในตารางตรวจและนัดหมาย
DROP POLICY IF EXISTS "Anyone can view medical profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view doctor profiles" ON public.profiles;
CREATE POLICY "Anyone can view medical profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'medical'
    OR EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = profiles.id)
  );

DROP POLICY IF EXISTS "Authenticated users can view doctors" ON public.doctors;
DROP POLICY IF EXISTS "Anyone can view doctors" ON public.doctors;
CREATE POLICY "Anyone can view doctors"
  ON public.doctors FOR SELECT
  USING (true);

-- เปิดให้เจ้าหน้าที่คลินิก/แพทย์ (medical, staff_admin) จัดการข้อมูลการเตือนยาและการจ่ายยาให้ผู้ป่วยได้
DROP POLICY IF EXISTS "Users can view own reminders" ON public.medication_reminders;
DROP POLICY IF EXISTS "Users can manage own reminders" ON public.medication_reminders;
DROP POLICY IF EXISTS "Staff and medical can manage medication reminders" ON public.medication_reminders;
CREATE POLICY "Staff and medical can manage medication reminders"
  ON public.medication_reminders
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN ('staff_admin', 'medical')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() IN ('staff_admin', 'medical')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can view own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Users can manage own medication logs" ON public.medication_logs;
DROP POLICY IF EXISTS "Staff and medical can manage medication logs" ON public.medication_logs;
CREATE POLICY "Staff and medical can manage medication logs"
  ON public.medication_logs
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN ('staff_admin', 'medical')
    OR EXISTS (
      SELECT 1 FROM public.medication_reminders
      WHERE id = medication_logs.reminder_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('staff_admin', 'medical')
    OR EXISTS (
      SELECT 1 FROM public.medication_reminders
      WHERE id = medication_logs.reminder_id AND user_id = auth.uid()
    )
  );

-- 4. เพิ่มตัวอย่างยาลงในตาราง medications (กรณีที่ยังไม่มีข้อมูลยา)
INSERT INTO public.medications (name, type, category, stock, min_stock, description)
SELECT 'Paracetamol 500mg', 'เม็ด', 'ยาแก้ปวดลดไข้', 500, 50, 'ยาแก้ปวดและลดไข้ทั่วไป'
WHERE NOT EXISTS (SELECT 1 FROM public.medications WHERE name = 'Paracetamol 500mg');

INSERT INTO public.medications (name, type, category, stock, min_stock, description)
SELECT 'Amoxicillin 500mg', 'แคปซูล', 'ยาปฏิชีวนะ', 200, 30, 'ยาปฏิชีวนะกลุ่มเพนิซิลลิน'
WHERE NOT EXISTS (SELECT 1 FROM public.medications WHERE name = 'Amoxicillin 500mg');

INSERT INTO public.medications (name, type, category, stock, min_stock, description)
SELECT 'Omeprazole 20mg', 'แคปซูล', 'ยาระบบทางเดินอาหาร', 300, 40, 'ยาลดกรดในกระเพาะอาหาร'
WHERE NOT EXISTS (SELECT 1 FROM public.medications WHERE name = 'Omeprazole 20mg');

INSERT INTO public.medications (name, type, category, stock, min_stock, description)
SELECT 'Loratadine 10mg', 'เม็ด', 'ยาแก้แพ้', 150, 20, 'ยาแก้แพ้ ลดอาการคัดจมูก'
WHERE NOT EXISTS (SELECT 1 FROM public.medications WHERE name = 'Loratadine 10mg');

INSERT INTO public.medications (name, type, category, stock, min_stock, description)
SELECT 'Ibuprofen 400mg', 'เม็ด', 'ยาแก้ปวดลดไข้', 250, 30, 'ยาแก้ปวด ลดไข้ ต้านการอักเสบ'
WHERE NOT EXISTS (SELECT 1 FROM public.medications WHERE name = 'Ibuprofen 400mg');

INSERT INTO public.medications (name, type, category, stock, min_stock, description)
SELECT 'Cetirizine 10mg', 'เม็ด', 'ยาแก้แพ้', 200, 25, 'ยาแก้แพ้ ลดอาการคันและผื่น'
WHERE NOT EXISTS (SELECT 1 FROM public.medications WHERE name = 'Cetirizine 10mg');


