-- Allow clinical staff (medical, staff_admin) to manage medication reminders and logs for all patients.
-- Patients retain access to view and manage their own reminders and logs.

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

