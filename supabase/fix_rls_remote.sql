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

CREATE POLICY "Staff/Doctor can view all appointments" ON public.appointments FOR SELECT USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Staff can update any appointment" ON public.appointments FOR UPDATE USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Doctors can view and create medical records" ON public.medical_records FOR ALL USING (public.get_user_role() = 'medical');

-- เปิดให้อ่านข้อมูลยาได้โดยไม่ต้อง Login (Public Read)
CREATE POLICY "Anyone can view medications" ON public.medications FOR SELECT USING (true);

CREATE POLICY "Pharmacist/Admin can manage medications" ON public.medications FOR ALL USING (public.get_user_role() = 'staff_admin');
CREATE POLICY "Pharmacist/Admin can view inventory logs" ON public.inventory_logs FOR SELECT USING (public.get_user_role() = 'staff_admin');
CREATE POLICY "Pharmacist can create inventory logs" ON public.inventory_logs FOR INSERT WITH CHECK (public.get_user_role() = 'staff_admin');

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

