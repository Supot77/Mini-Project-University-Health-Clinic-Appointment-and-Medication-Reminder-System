// 👤 รับผิดชอบโดย: ปาย
// ระบบนัดหมายและประวัติการรักษา

import { supabase } from '@/lib/supabase';
import type { AppointmentWithDetails, MedicalRecord, AppointmentStatus } from '@/types/database';

export async function getAppointments(patientId: string): Promise<AppointmentWithDetails[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      slot:appointment_slots(
        *,
        doctor:doctors(
          *,
          profile:profiles(full_name, avatar_url),
          department:departments(name)
        )
      )
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTodaysQueue(doctorId?: string): Promise<AppointmentWithDetails[]> {
  const today = new Date().toISOString().split('T')[0];
  let query = supabase
    .from('appointments')
    .select(`
      *,
      slot:appointment_slots!inner(*),
      patient:profiles!appointments_patient_id_fkey(full_name, phone, student_id)
    `)
    .eq('slot.slot_date', today)
    .order('queue_number');

  if (doctorId) {
    query = query.eq('slot.doctor_id', doctorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AppointmentWithDetails[];
}

export async function createAppointment(patientId: string, slotId: string, reason?: string, queueNumber?: number) {
  let assignedQueue = queueNumber;
  if (!assignedQueue) {
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slotId);
    assignedQueue = (count ?? 0) + 1;
  }

  const trimmedReason = reason?.trim() || 'ตรวจสุขภาพทั่วไป';

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      slot_id: slotId,
      queue_number: assignedQueue,
      reason: trimmedReason,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelAppointment(id: string) {
  return updateAppointmentStatus(id, 'cancelled');
}

// --- Medical Records ---
export async function createMedicalRecord(record: {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis: string;
  treatment_notes?: string;
  prescribed_medications?: MedicalRecord['prescribed_medications'];
}) {
  const { data, error } = await supabase
    .from('medical_records')
    .insert({
      appointment_id: record.appointment_id,
      patient_id: record.patient_id,
      doctor_id: record.doctor_id,
      diagnosis: record.diagnosis.trim() || 'ตรวจร่างกายทั่วไป ไม่พบความผิดปกติสำคัญ',
      treatment_notes: record.treatment_notes ?? '',
      prescribed_medications: record.prescribed_medications ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMedicalRecords(patientId: string) {
  const { data, error } = await supabase
    .from('medical_records')
    .select(`
      *,
      doctor:doctors(*, profile:profiles(full_name)),
      appointment:appointments(*, slot:appointment_slots(slot_date, start_time))
    `)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
