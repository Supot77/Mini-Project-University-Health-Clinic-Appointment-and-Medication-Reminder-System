-- ตรวจสอบว่าผู้ใช้งานปัจจุบันเป็น staff_admin
-- และบัญชียังเปิดใช้งานอยู่

CREATE OR REPLACE FUNCTION public.is_active_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'staff_admin'
      AND is_active IS DISTINCT FROM false
  );
$$;

-- เปิด RLS สำหรับตาราง profiles
ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

-- ลบ Policy เดิมที่อนุญาตให้แก้ Profile ตัวเอง
-- ชื่ออาจมาจาก Migration รุ่นต่างกัน
DROP POLICY IF EXISTS "Users can update own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Users update own profile"
ON public.profiles;

DROP POLICY IF EXISTS "Staff admin can update profiles"
ON public.profiles;

DROP POLICY IF EXISTS "Users and staff admin update profiles"
ON public.profiles;

-- สร้าง Policy ใหม่
CREATE POLICY "Users and staff admin update profiles"
ON public.profiles
FOR UPDATE
USING (
  -- ผู้ใช้งานแก้ Profile ของตัวเอง
  auth.uid() = id

  -- หรือสตาฟแอดมินที่บัญชียังเปิดใช้งาน
  OR public.is_active_staff_admin()
)
WITH CHECK (
  auth.uid() = id
  OR public.is_active_staff_admin()
);