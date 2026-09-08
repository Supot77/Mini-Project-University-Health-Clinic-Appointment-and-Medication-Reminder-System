import { createClient } from '@/utils/supabase/client';
import type { Medication, MedicationReminder, MedicationLog, MedicationReminderWithMedication } from '@/types/database';

const supabase = createClient();

// --- Medication Reminders ---
export async function getReminders(userId: string): Promise<MedicationReminderWithMedication[]> {
  const { data, error } = await supabase
    .from('medication_reminders')
    .select('*, medication:medications(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAvailableMedications(): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createReminder(reminder: Pick<MedicationReminder, 'user_id' | 'medication_id' | 'reminder_times' | 'start_date' | 'end_date'>) {
  const { data, error } = await supabase
    .from('medication_reminders')
    .insert({ ...reminder, status: 'active' })
    .select('*, medication:medications(*)')
    .single();
  if (error) throw error;
  return data as MedicationReminderWithMedication;
}

export async function updateReminder(id: string, updates: Partial<MedicationReminder>) {
  const { data, error } = await supabase
    .from('medication_reminders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, medication:medications(*)')
    .single();
  if (error) throw error;
  return data as MedicationReminderWithMedication;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase
    .from('medication_reminders')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function seedSampleReminders(userId: string): Promise<MedicationReminderWithMedication[]> {
  const meds = await getAvailableMedications();
  if (!meds || meds.length === 0) return [];

  const sampleItems = [
    { medName: 'Paracetamol', times: ['08:00', '12:00', '18:00'] },
    { medName: 'Amoxicillin', times: ['08:00', '13:00', '20:00'] },
    { medName: 'Omeprazole', times: ['07:30'] },
    { medName: 'Cetirizine', times: ['21:00'] },
  ];

  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const toInsert = sampleItems
    .map((sample) => {
      const match = meds.find((m) => m.name.toLowerCase().includes(sample.medName.toLowerCase()));
      if (!match) return null;
      return {
        user_id: userId,
        medication_id: match.id,
        reminder_times: sample.times,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (toInsert.length === 0) return [];

  const { data, error } = await supabase
    .from('medication_reminders')
    .insert(toInsert)
    .select('*, medication:medications(*)');
  if (error) throw error;
  return (data ?? []) as MedicationReminderWithMedication[];
}

export async function pauseReminder(id: string) {
  return updateReminder(id, { status: 'paused' });
}

export async function resumeReminder(id: string) {
  return updateReminder(id, { status: 'active' });
}

export async function completeReminder(id: string) {
  return updateReminder(id, { status: 'completed' });
}

// --- Medication Logs ---
export async function getMedicationLogs(reminderId: string): Promise<MedicationLog[]> {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('reminder_id', reminderId)
    .order('scheduled_datetime', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function logMedicationTaken(reminderId: string, scheduledDatetime: string) {
  const { data, error } = await supabase
    .from('medication_logs')
    .upsert({
      reminder_id: reminderId,
      scheduled_datetime: scheduledDatetime,
      actual_datetime: new Date().toISOString(),
      status: 'taken',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function logMedicationMissed(reminderId: string, scheduledDatetime: string) {
  const { data, error } = await supabase
    .from('medication_logs')
    .upsert({
      reminder_id: reminderId,
      scheduled_datetime: scheduledDatetime,
      status: 'missed',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMedicationLogsByReminderIds(reminderIds: string[]): Promise<MedicationLog[]> {
  if (reminderIds.length === 0) return [];
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .in('reminder_id', reminderIds)
    .order('scheduled_datetime', { ascending: false });
  if (error) return [];
  return data ?? [];
}
