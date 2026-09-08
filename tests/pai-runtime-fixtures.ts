import type { PaiRole, PaiSnapshot } from '@/features/pai/runtime/contract';
export const patientId = '00000000-0000-4000-8000-000000000001';
export const doctorId = '00000000-0000-4000-8000-000000000002';
export const staffId = '00000000-0000-4000-8000-000000000003';
export const slotId = '00000000-0000-4000-8000-000000000004';
export const appointmentId = '00000000-0000-4000-8000-000000000005';
export const medicationId = '00000000-0000-4000-8000-000000000006';
export function fixture(role: PaiRole = 'patient'): PaiSnapshot {
  return { actor: { id: role === 'patient' ? patientId : role === 'medical' ? doctorId : staffId, role },
    slots: [{ id: slotId, doctor_id: doctorId, doctor: 'แพทย์ทดสอบ', department: 'ทั่วไป', slot_date: '2026-09-09', start_time: '09:00:00', end_time: '09:30:00', max_capacity: 1, booked_count: 0, status: 'available', bookable: true }],
    appointments: [], records: [], medications: [{ id: medicationId, name: 'ยาทดสอบ', type: 'เม็ด' }],
  };
}
export function withAppointment(role: PaiRole = 'medical'): PaiSnapshot {
  const result = fixture(role);
  result.slots[0].booked_count = 1;
  result.appointments = [{ id: appointmentId, user_id: patientId, patient: 'ผู้ป่วยทดสอบ', slot_id: slotId, queue_number: 1, reason: 'ทดสอบ', status: 'in_progress', cancel_requested_at: null, rejection_reason: null, has_record: false }];
  return result;
}
