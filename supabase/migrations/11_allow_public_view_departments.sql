-- Allow public and unauthenticated users to view active departments
-- so that public doctor schedules show department names without requiring login

DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;

CREATE POLICY "Anyone can view departments"
  ON public.departments FOR SELECT
  USING (true);
