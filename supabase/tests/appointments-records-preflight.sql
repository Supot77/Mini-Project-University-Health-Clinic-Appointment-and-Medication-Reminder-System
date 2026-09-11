-- READ ONLY. Run in SQL Editor for project fjzqcmcyemtzrtvmlqdv before migration 13.
-- Metadata and counts only: no patient records or credentials.
SELECT current_database() AS database_name, version() AS postgres_version;
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('appointments','medical_records','appointment_slots','profiles')
ORDER BY table_name, ordinal_position;
SELECT count(*) AS invalid_roles FROM public.profiles WHERE role NOT IN ('patient','medical','staff_admin');
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('profiles','appointments','medical_records') ORDER BY tablename,policyname;
SELECT routine_name,security_type FROM information_schema.routines
WHERE routine_schema='public' AND (routine_name LIKE 'pai_%' OR routine_name='get_user_role');
-- Auth owner must verify users cannot change their own role/is_active.
SELECT grantee,privilege_type,column_name FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('role','is_active')
  AND grantee IN ('anon','authenticated') ORDER BY grantee,column_name,privilege_type;
