export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rejected';
export type PreviewRole = 'patient' | 'staff' | 'doctor';

export interface BookingSlot {
  id: string;
  date: string;
  start: string;
  end: string;
  department: string;
  doctorId: string;
  doctor: string;
  capacity: number;
  reservedByOthers: number;
  closed?: boolean;
}

export interface DemoAppointment {
  id: string;
  patientId: string;
  patient: string;
  slotId: string;
  queue: string;
  reason: string;
  status: AppointmentStatus;
  proposal?: { slotId: string; reason: string; deadline: string };
}

export interface AppointmentSnapshot {
  slots: BookingSlot[];
  appointments: DemoAppointment[];
}

export type AppointmentResult = { ok: true; message: string } | { ok: false; error: string };

/** Local preview contract only; it does not mutate the shared schedule or database. */
export interface AppointmentPreviewRepository {
  snapshot(): AppointmentSnapshot;
  book(slotId: string, reason: string): AppointmentResult;
  cancel(id: string): AppointmentResult;
  changeStatus(id: string, status: 'confirmed' | 'rejected' | 'in_progress' | 'no_show', role: PreviewRole): AppointmentResult;
  propose(id: string, slotId: string, reason: string): AppointmentResult;
  acceptProposal(id: string, alternativeSlotId?: string): AppointmentResult;
}

export const DEMO_TODAY = '2026-09-07';
export const DEMO_NOW = '2026-09-07T08:00:00+07:00';
export const DEMO_PATIENT_ID = 'profile-peter-parker';
export const DEMO_DOCTOR_ID = 'profile-stephen-strange';
export const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'รออนุมัติ', confirmed: 'ยืนยันแล้ว', in_progress: 'กำลังตรวจ', completed: 'ตรวจเสร็จ', cancelled: 'ยกเลิกแล้ว', no_show: 'ไม่มาตามนัด', rejected: 'ไม่อนุมัติ',
};

export function formatAppointmentDate(date: string) {
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`));
}

export function slotTimestamp(slot: BookingSlot) {
  return new Date(`${slot.date}T${slot.start}:00+07:00`).getTime();
}

export function remainingSeats(slot: BookingSlot, appointments: DemoAppointment[]) {
  const active = appointments.filter((item) => !['cancelled', 'rejected', 'no_show'].includes(item.status));
  return Math.max(0, slot.capacity - slot.reservedByOthers - active.filter((item) => item.slotId === slot.id || item.proposal?.slotId === slot.id).length);
}
