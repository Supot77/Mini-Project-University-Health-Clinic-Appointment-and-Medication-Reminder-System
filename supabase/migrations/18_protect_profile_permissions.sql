-- Let active staff administrators edit accounts from /staff/accounts.
CREATE OR REPLACE FUNCTION public.staff_admin_update_profile(
  p_profile_id uuid,
  p_full_name text,
  p_phone text,
  p_role text,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_actor_active boolean;
BEGIN
  SELECT role, is_active
    INTO v_actor_role, v_actor_active
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role IS DISTINCT FROM 'staff_admin'
     OR v_actor_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'เฉพาะสตาฟแอดมินที่เปิดใช้งานเท่านั้นที่แก้ไขบัญชีได้';
  END IF;

  IF p_profile_id = auth.uid()
     AND (p_role IS DISTINCT FROM 'staff_admin' OR p_is_active IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'ไม่สามารถเปลี่ยน Role หรือปิดบัญชีของตนเองได้';
  END IF;

  IF nullif(btrim(p_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'กรุณากรอกชื่อ-นามสกุล';
  END IF;

  IF p_role NOT IN ('patient', 'medical', 'staff_admin') THEN
    RAISE EXCEPTION 'Role ไม่ถูกต้อง';
  END IF;

  UPDATE public.profiles
  SET full_name = btrim(p_full_name),
      phone = nullif(btrim(p_phone), ''),
      role = p_role,
      is_active = p_is_active,
      permission_version = permission_version + 1,
      updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีผู้ใช้งาน';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_admin_update_profile(uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_admin_update_profile(uuid, text, text, text, boolean) TO authenticated;
