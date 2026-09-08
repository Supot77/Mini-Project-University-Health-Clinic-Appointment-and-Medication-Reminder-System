import { allowedActions, recordInputSchema, type PaiRepository, type PaiSnapshot, type PaiRole } from './contract';

/** Explicit test/offline adapter; never imported by the production composition point. */
export function createPaiMockRepository(seed: PaiSnapshot, now = new Date('2026-09-08T08:00:00+07:00')): PaiRepository {
  const state = structuredClone(seed);
  let sequence = 100;
  const id = () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
  const ownAppointment = (a: PaiSnapshot['appointments'][number]) => state.actor.role === 'staff_admin' ||
    (state.actor.role === 'patient' ? a.user_id === state.actor.id : state.slots.some((s) => s.id === a.slot_id && s.doctor_id === state.actor.id));
  function requireRole(role: PaiRole) { if (state.actor.role !== role) throw new Error('ไม่มีสิทธิ์ทำรายการนี้'); }
  return {
    async load() {
      const result = structuredClone(state);
      result.appointments = result.appointments.filter(ownAppointment);
      result.records = result.records.filter((r) => state.actor.role === 'patient' ? r.patient_id === state.actor.id && r.completed :
        state.actor.role === 'medical' && (r.doctor_id === state.actor.id || (r.completed && result.appointments.some((a) => a.user_id === r.patient_id && ['confirmed','in_progress','completed'].includes(a.status)))));
      if (state.actor.role !== 'medical') result.medications = [];
      return result;
    },
    async book(slotId, reason) {
      requireRole('patient');
      if (!reason.trim() || reason.trim().length > 2000) throw new Error('กรุณากรอกอาการหรือเหตุผลไม่เกิน 2000 ตัวอักษร');
      const slot = state.slots.find((s) => s.id === slotId);
      if (!slot || !slot.bookable || slot.status !== 'available' || new Date(`${slot.slot_date}T${slot.start_time}+07:00`) <= now) throw new Error('รอบตรวจนี้ไม่เปิดรับจอง');
      const active = state.appointments.filter((a) => a.slot_id === slotId && !['cancelled','rejected','no_show'].includes(a.status));
      if (active.some((a) => a.user_id === state.actor.id)) throw new Error('มีนัดในรอบนี้แล้ว');
      const occupied = Math.max(slot.booked_count, active.length);
      if (occupied >= slot.max_capacity) throw new Error('รอบตรวจเต็มแล้ว');
      const queue = Math.max(0, ...state.appointments.filter((a) => a.slot_id === slotId).map((a) => a.queue_number ?? 0)) + 1;
      state.appointments.push({ id: id(), user_id: state.actor.id, patient: 'ผู้ป่วยทดสอบ', slot_id: slotId, queue_number: queue, reason: reason.trim(), status: 'pending', cancel_requested_at: null, rejection_reason: null, has_record: false });
      slot.booked_count = occupied + 1;
    },
    async transition(appointmentId, action, reason) {
      const a = state.appointments.find((v) => v.id === appointmentId);
      if (!a || !ownAppointment(a) || !allowedActions(state.actor.role, a).includes(action)) throw new Error('ไม่มีสิทธิ์หรือสถานะไม่อนุญาต');
      if (action === 'rejected' && !reason?.trim()) throw new Error('กรุณาระบุเหตุผลการปฏิเสธ');
      if (action === 'request_cancel') a.cancel_requested_at = now.toISOString();
      else {
        a.status = action;
        if (action === 'rejected') a.rejection_reason = reason!.trim();
        if (action === 'cancelled' || action === 'rejected') {
          const slot = state.slots.find((s) => s.id === a.slot_id)!;
          slot.booked_count = Math.max(0, slot.booked_count - 1);
        }
        if (action === 'completed') state.records.filter((r) => r.appointment_id === a.id).forEach((r) => { r.completed = true; });
      }
    },
    async saveRecord(input) {
      requireRole('medical');
      const parsed = recordInputSchema.parse(input);
      const a = state.appointments.find((v) => v.id === parsed.appointmentId);
      if (!a || !ownAppointment(a) || a.status !== 'in_progress' || a.has_record) throw new Error('ต้องเป็นนัดของตนที่กำลังตรวจและยังไม่มีผลตรวจ');
      const items = parsed.prescriptions.map((p) => {
        const m = state.medications.find((m) => m.id === p.medication_id);
        if (!m) throw new Error('ไม่พบยาหรือยาถูกปิดใช้งาน');
        return { ...p, name: m.name };
      });
      state.records.push({ id: id(), appointment_id: a.id, patient_id: a.user_id, doctor_id: state.actor.id,
        patient: a.patient, doctor: 'แพทย์ทดสอบ', diagnosis: parsed.diagnosis, treatment_notes: parsed.advice,
        prescribed_medications: items, created_at: now.toISOString(), completed: parsed.complete });
      a.has_record = true;
      if (parsed.complete) a.status = 'completed';
    },
  };
}
