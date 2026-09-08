import { z } from 'zod';

export const roleSchema = z.enum(['patient', 'medical', 'staff_admin']);
export type PaiRole = z.infer<typeof roleSchema>;
export const appointmentStateSchema = z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected', 'no_show']);
export const prescriptionSchema = z.object({
  medication_id: z.string().uuid(), name: z.string().trim().min(1),
  dosage: z.string().trim().min(1).max(500), frequency: z.string().trim().min(1).max(500),
  duration_days: z.number().int().min(1).max(365), quantity: z.number().int().min(1).max(100000),
});
export const recordInputSchema = z.object({
  appointmentId: z.string().uuid(), diagnosis: z.string().trim().min(1, 'กรุณากรอกผลวินิจฉัย').max(5000),
  advice: z.string().trim().max(5000), prescriptions: z.array(prescriptionSchema).max(50), complete: z.boolean(),
}).refine((v) => new Set(v.prescriptions.map((p) => p.medication_id)).size === v.prescriptions.length, 'รายการยาซ้ำ');
export type RecordInput = z.infer<typeof recordInputSchema>;
export const snapshotSchema = z.object({
  actor: z.object({ id: z.string().uuid(), role: roleSchema }),
  slots: z.array(z.object({
    id: z.string().uuid(), doctor_id: z.string().uuid(), doctor: z.string(), department: z.string(),
    slot_date: z.string(), start_time: z.string(), end_time: z.string(), max_capacity: z.number(),
    booked_count: z.number(), status: z.string(), bookable: z.boolean(),
  })),
  appointments: z.array(z.object({
    id: z.string().uuid(), user_id: z.string().uuid(), patient: z.string(), slot_id: z.string().uuid(),
    queue_number: z.number().nullable(), reason: z.string().nullable(), status: appointmentStateSchema,
    cancel_requested_at: z.string().nullable(), rejection_reason: z.string().nullable(), has_record: z.boolean(),
  })),
  records: z.array(z.object({
    id: z.string().uuid(), appointment_id: z.string().uuid(), patient_id: z.string().uuid(), doctor_id: z.string().uuid(),
    patient: z.string(), doctor: z.string(), diagnosis: z.string().nullable(), treatment_notes: z.string().nullable(),
    prescribed_medications: z.array(prescriptionSchema).nullable(), created_at: z.string(), completed: z.boolean(),
  })),
  medications: z.array(z.object({ id: z.string().uuid(), name: z.string(), type: z.string() })),
});
export type PaiSnapshot = z.infer<typeof snapshotSchema>;
export type PaiAppointment = PaiSnapshot['appointments'][number];
export type PaiAction = 'confirmed' | 'rejected' | 'in_progress' | 'completed' | 'cancelled' | 'request_cancel';
export interface PaiRepository {
  load(): Promise<PaiSnapshot>;
  book(slotId: string, reason: string): Promise<void>;
  transition(appointmentId: string, action: PaiAction, reason?: string): Promise<void>;
  saveRecord(input: RecordInput): Promise<void>;
}

export function allowedActions(role: PaiRole, appointment: PaiAppointment): PaiAction[] {
  if (role === 'patient') return ['pending', 'confirmed'].includes(appointment.status) && !appointment.cancel_requested_at ? ['request_cancel'] : [];
  if (role === 'medical') return appointment.status === 'confirmed' ? ['in_progress'] : appointment.status === 'in_progress' && appointment.has_record ? ['completed'] : [];
  if (appointment.status === 'pending') return ['confirmed', 'rejected', 'cancelled'];
  if (appointment.status === 'confirmed') return ['in_progress', 'cancelled'];
  if (appointment.status === 'in_progress' && appointment.has_record) return ['completed'];
  return [];
}

export const actionLabels: Record<PaiAction, string> = {
  confirmed: 'อนุมัตินัด', rejected: 'ปฏิเสธนัด', in_progress: 'เริ่มตรวจ', completed: 'จบตรวจ',
  cancelled: 'ยกเลิกนัด', request_cancel: 'ขอยกเลิกนัด',
};
export function bangkokDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
