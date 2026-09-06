import {
  DEMO_DOCTOR_ID, DEMO_NOW, DEMO_PATIENT_ID, DEMO_TODAY, remainingSeats, slotTimestamp,
  type AppointmentPreviewRepository, type AppointmentResult, type AppointmentSnapshot, type BookingSlot,
} from './repository';
import type { ClinicMockTables } from '@/mocks/clinicDatabase';

const activeStatuses = ['pending', 'confirmed', 'in_progress'];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function makeSnapshot(): AppointmentSnapshot {
  const slots: BookingSlot[] = [];
  for (const date of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-21']) {
    for (const [index, department, doctor] of [[1, 'เวชปฏิบัติทั่วไป', 'นพ.กิตติ สุขใจ'], [2, 'ทันตกรรม', 'ทพญ.ธารา ยิ้มดี'], [3, 'กายภาพบำบัด', 'พญ.ปวีณ์ ใจดี']] as const) {
      for (const [start, end] of [['09:00', '09:30'], ['09:30', '10:00'], ['10:00', '10:30']]) {
        slots.push({ id: `${date}-${index}-${start}`, date, start, end, department, doctorId: [DEMO_DOCTOR_ID, 'profile-charles-xavier', 'profile-bruce-banner'][index - 1], doctor, capacity: 3, reservedByOthers: start === '09:30' && date !== DEMO_TODAY ? 3 : 0, closed: start === '10:00' && index === 2 });
      }
    }
  }
  return {
    slots,
    appointments: [
      { id: 'APT-001', patientId: DEMO_PATIENT_ID, patient: 'Peter Parker', slotId: '2026-09-07-1-09:00', queue: 'A001', reason: 'ไข้และปวดศีรษะ', status: 'confirmed' },
      { id: 'APT-002', patientId: 'patient-02', patient: 'ธนกร เรียนดี', slotId: '2026-09-07-1-09:30', queue: 'A002', reason: 'ติดตามอาการ', status: 'pending' },
      { id: 'APT-003', patientId: 'patient-03', patient: 'พิมพ์ชนก สดใส', slotId: '2026-09-07-1-10:00', queue: 'A003', reason: 'ตรวจตามนัด', status: 'in_progress' },
      { id: 'APT-004', patientId: 'patient-04', patient: 'อนันต์ สุขดี', slotId: '2026-09-07-2-09:00', queue: 'B001', reason: 'ตรวจสุขภาพช่องปาก', status: 'confirmed' },
      { id: 'APT-005', patientId: DEMO_PATIENT_ID, patient: 'Peter Parker', slotId: '2026-09-09-2-09:00', queue: 'B002', reason: 'ติดตามอาการ', status: 'pending' },
      { id: 'APT-006', patientId: DEMO_PATIENT_ID, patient: 'Peter Parker', slotId: '2026-09-10-1-09:00', queue: 'A004', reason: 'ติดตามอาการ', status: 'confirmed', proposal: { slotId: '2026-09-11-1-09:00', reason: 'แพทย์งดตรวจในวันเดิม', deadline: '8 ก.ย. 2569 เวลา 08:00 น.' } },
    ],
  };
}

export function appointmentSnapshotFromSharedMock(tables: ClinicMockTables): AppointmentSnapshot {
  const profiles = new Map(tables.profiles.map((profile) => [profile.id, profile]));
  const departments = new Map(tables.departments.map((department) => [department.id, department]));
  const doctors = new Map(tables.doctors.map((doctor) => [doctor.id, doctor]));
  const slots = tables.appointment_slots.map((slot) => {
    const doctor = doctors.get(slot.doctor_id);
    return { id: slot.id, date: slot.slot_date, start: slot.start_time.slice(0, 5), end: slot.end_time.slice(0, 5), doctorId: slot.doctor_id, doctor: profiles.get(slot.doctor_id)?.full_name ?? 'ไม่ระบุแพทย์', department: departments.get(doctor?.department_id ?? '')?.name ?? 'ไม่ระบุแผนก', capacity: slot.max_capacity, reservedByOthers: slot.booked_count, closed: slot.status === 'closed' };
  });
  return { slots, appointments: tables.appointments.map((item) => ({ id: item.id, patientId: item.user_id, patient: profiles.get(item.user_id)?.full_name ?? 'ไม่ระบุผู้ป่วย', slotId: item.slot_id, queue: item.queue_number ? `Q${String(item.queue_number).padStart(3, '0')}` : '-', reason: item.reason ?? '', status: item.status })) };
}

export function createAppointmentPreviewRepository(seed?: AppointmentSnapshot): AppointmentPreviewRepository {
  const state = clone(seed ?? makeSnapshot());
  const error = (message: string): AppointmentResult => ({ ok: false, error: message });
  const success = (message: string): AppointmentResult => ({ ok: true, message });
  const findSlot = (id: string) => state.slots.find((slot) => slot.id === id);

  function validateSlot(slotId: string, patientId: string, excludingId?: string): string | null {
    const slot = findSlot(slotId);
    if (!slot || slot.closed) return 'รอบนี้ปิดรับจอง กรุณาเลือกรอบอื่น';
    if (slot.date <= DEMO_TODAY || slot.date > '2026-09-21') return 'กรุณาเลือกรอบล่วงหน้า 1–14 วันจากวันจำลอง';
    const ownProposal = state.appointments.find((item) => item.id === excludingId)?.proposal?.slotId === slotId;
    if (remainingSeats(slot, state.appointments) === 0 && !ownProposal) return 'รอบนี้เต็มแล้ว กรุณาเลือกรอบอื่น';
    const overlap = state.appointments.some((item) => {
      if (item.id === excludingId || item.patientId !== patientId || !activeStatuses.includes(item.status)) return false;
      return [item.slotId, item.proposal?.slotId].some((id) => {
        const other = id ? findSlot(id) : undefined;
        return other && other.date === slot.date && slot.start < other.end && slot.end > other.start;
      });
    });
    return overlap ? 'มีนัดหรือรอบที่เสนอในช่วงเวลานี้แล้ว กรุณาเลือกเวลาอื่น' : null;
  }

  return {
    snapshot: () => clone(state),
    book(slotId, reason) {
      if (!reason.trim()) return error('กรุณาระบุอาการเบื้องต้นหรือเหตุผลที่นัด');
      const invalid = validateSlot(slotId, DEMO_PATIENT_ID);
      if (invalid) return error(invalid);
      const number = state.appointments.length + 1;
      state.appointments.push({ id: `APT-${String(number).padStart(3, '0')}`, patientId: DEMO_PATIENT_ID, patient: 'ณัฐชา ใจดี', slotId, queue: `Q${String(number).padStart(3, '0')}`, reason: reason.trim(), status: 'pending' });
      return success('ส่งคำขอนัดหมายตัวอย่างแล้ว · รอเจ้าหน้าที่อนุมัติ');
    },
    cancel(id) {
      const item = state.appointments.find((appointment) => appointment.id === id && appointment.patientId === DEMO_PATIENT_ID);
      if (!item || !['pending', 'confirmed'].includes(item.status)) return error('นัดนี้ไม่สามารถยกเลิกได้');
      const slot = findSlot(item.slotId);
      if (!slot || slotTimestamp(slot) - new Date(DEMO_NOW).getTime() < 2 * 60 * 60 * 1000) return error('ยกเลิกเองได้ก่อนเริ่มนัดอย่างน้อย 2 ชั่วโมง กรุณาติดต่อเจ้าหน้าที่');
      item.status = 'cancelled';
      delete item.proposal;
      return success('ยกเลิกนัดหมายตัวอย่างแล้ว');
    },
    changeStatus(id, status, role) {
      const item = state.appointments.find((appointment) => appointment.id === id);
      const slot = item && findSlot(item.slotId);
      if (!item || !slot || role === 'patient' || (role === 'doctor' && slot.doctorId !== DEMO_DOCTOR_ID)) return error('มุมมองนี้ไม่สามารถจัดการนัดดังกล่าวได้');
      const approve = role === 'staff' && item.status === 'pending' && ['confirmed', 'rejected'].includes(status);
      const start = item.status === 'confirmed' && status === 'in_progress' && slot.date === DEMO_TODAY;
      const noShow = item.status === 'confirmed' && status === 'no_show' && new Date(`${slot.date}T${slot.end}:00+07:00`).getTime() < new Date(DEMO_NOW).getTime();
      if (!approve && !start && !noShow) return error('เปลี่ยนสถานะนี้ไม่ได้จากสถานะปัจจุบัน');
      item.status = status;
      if (status === 'rejected') delete item.proposal;
      return success('อัปเดตสถานะนัดหมายตัวอย่างแล้ว');
    },
    propose(id, slotId, reason) {
      const item = state.appointments.find((appointment) => appointment.id === id);
      if (!item || !['pending', 'confirmed'].includes(item.status) || item.proposal) return error('นัดนี้ไม่สามารถเสนอเลื่อนได้ หรือมีข้อเสนอรออยู่แล้ว');
      if (!reason.trim()) return error('กรุณาระบุเหตุผลในการเสนอเลื่อนนัด');
      const slot = findSlot(slotId);
      const oldSlot = findSlot(item.slotId);
      if (!slot || !oldSlot || slot.id === item.slotId || slot.doctorId !== oldSlot.doctorId || slotTimestamp(slot) <= new Date(DEMO_NOW).getTime() + 24 * 60 * 60 * 1000) return error('เลือกรอบใหม่ของแพทย์เดิมที่เริ่มหลังพ้น 24 ชั่วโมง');
      const invalid = validateSlot(slotId, item.patientId, id);
      if (invalid) return error(invalid);
      item.proposal = { slotId, reason: reason.trim(), deadline: '8 ก.ย. 2569 เวลา 08:00 น.' };
      return success('สร้างข้อเสนอเลื่อนนัดตัวอย่างแล้ว · ยังรอผู้ป่วยตอบรับ');
    },
    acceptProposal(id, alternativeSlotId) {
      const item = state.appointments.find((appointment) => appointment.id === id && appointment.patientId === DEMO_PATIENT_ID);
      if (!item?.proposal || !['pending', 'confirmed'].includes(item.status)) return error('ไม่พบข้อเสนอที่รอคำตอบ');
      const nextId = alternativeSlotId ?? item.proposal.slotId;
      const slot = findSlot(nextId);
      if (!slot || slot.doctorId !== findSlot(item.slotId)?.doctorId || nextId === item.slotId) return error('กรุณาเลือกรอบใหม่ของแพทย์เดิม');
      const invalid = validateSlot(nextId, item.patientId, id);
      if (invalid) return error(invalid);
      item.slotId = nextId;
      item.status = 'confirmed';
      delete item.proposal;
      return success('ยืนยันวันนัดใหม่ในตัวอย่างแล้ว');
    },
  };
}
