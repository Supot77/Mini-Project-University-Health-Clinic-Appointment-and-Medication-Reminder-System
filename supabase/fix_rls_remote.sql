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

-- 2. ลบ Policy เดิมที่มีปัญหาหรือต้องการแก้ไข
DROP POLICY IF EXISTS "Staff/Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff/Admin can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Staff/Admin can manage slots" ON public.appointment_slots;
DROP POLICY IF EXISTS "Staff/Doctor can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update any appointment" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view and create medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Authenticated users can view medications" ON public.medications;
DROP POLICY IF EXISTS "Pharmacist/Admin can manage medications" ON public.medications;
DROP POLICY IF EXISTS "Pharmacist/Admin can view inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "Pharmacist can create inventory logs" ON public.inventory_logs;

-- 3. สร้าง Policy ใหม่
CREATE POLICY "Staff/Admin can view all profiles" ON public.profiles FOR SELECT USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Staff/Admin can manage departments" ON public.departments FOR ALL USING (public.get_user_role() = 'staff_admin');
CREATE POLICY "Staff/Admin can manage slots" ON public.appointment_slots FOR ALL USING (public.get_user_role() = 'staff_admin');
CREATE POLICY "Staff/Doctor can view all appointments" ON public.appointments FOR SELECT USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Staff can update any appointment" ON public.appointments FOR UPDATE USING (public.get_user_role() IN ('staff_admin', 'medical'));
CREATE POLICY "Doctors can view and create medical records" ON public.medical_records FOR ALL USING (public.get_user_role() = 'medical');

-- เปิดให้อ่านข้อมูลยาได้โดยไม่ต้อง Login (Public Read)
CREATE POLICY "Anyone can view medications" ON public.medications FOR SELECT USING (true);

CREATE POLICY "Pharmacist/Admin can manage medications" ON public.medications FOR ALL USING (public.get_user_role() = 'staff_admin');
CREATE POLICY "Pharmacist/Admin can view inventory logs" ON public.inventory_logs FOR SELECT USING (public.get_user_role() = 'staff_admin');
CREATE POLICY "Pharmacist can create inventory logs" ON public.inventory_logs FOR INSERT WITH CHECK (public.get_user_role() = 'staff_admin');
