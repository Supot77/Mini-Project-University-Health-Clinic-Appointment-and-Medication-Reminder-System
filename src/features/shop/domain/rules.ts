import type {
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleSlot,
  ScheduleSlotStatus,
} from '@/types/schedule';

export type ShopResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

export interface SlotInput {
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
}

const success = <T>(value: T): ShopResult<T> => ({ ok: true, value });
const failure = <T>(error: string, field?: string): ShopResult<T> => ({ ok: false, error, field });

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function isValidClinicDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidClinicTime(value: string) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return false;
  const [, hour, minute] = match.map(Number);
  return hour <= 23 && minute <= 59;
}

export function deriveSlotStatus(
  bookedCount: number,
  maxCapacity: number,
  currentStatus?: ScheduleSlotStatus,
): ScheduleSlotStatus {
  if (currentStatus === 'closed') return 'closed';
  return bookedCount >= maxCapacity ? 'full' : 'available';
}

export function validateSlot(
  input: SlotInput,
  slots: ScheduleSlot[],
  doctors: ScheduleDoctor[],
  departments: ScheduleDepartment[],
  editingId?: string,
  bookedCount = 0,
): ShopResult<SlotInput> {
  if (!input.doctorId || !input.slotDate || !input.startTime || !input.endTime) {
    return failure('กรอกแพทย์ วันที่ และเวลาให้ครบ');
  }
  if (!isValidClinicDate(input.slotDate)) return failure('วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD', 'slotDate');
  if (!isValidClinicTime(input.startTime) || !isValidClinicTime(input.endTime)) {
    return failure('เวลาต้องอยู่ในรูปแบบ HH:mm', 'startTime');
  }
  const doctor = doctors.find((item) => item.id === input.doctorId);
  const department = doctor && departments.find((item) => item.id === doctor.departmentId);
  if (!doctor || doctor.availability !== 'active' || !department?.isActive) {
    return failure('แพทย์และแผนกต้องเปิดใช้งานก่อนสร้างรอบ', 'doctorId');
  }
  if (input.startTime >= input.endTime) {
    return failure('เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด', 'startTime');
  }
  // Date-only values are interpreted in Asia/Bangkok. Bangkok has no DST,
  // so UTC calendar arithmetic keeps validation deterministic in every runtime.
  const [year, month, day] = input.slotDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (weekday === 0 || weekday === 6) {
    return failure('คลินิกเปิดรอบตรวจเฉพาะวันจันทร์ถึงศุกร์', 'slotDate');
  }
  if (input.startTime < '08:30' || input.endTime > '16:30') {
    return failure('รอบตรวจต้องอยู่ระหว่าง 08:30–16:30 น.', 'startTime');
  }
  if (input.startTime < '13:00' && input.endTime > '12:00') {
    return failure('ไม่สามารถสร้างรอบทับช่วงพัก 12:00–13:00 น.', 'startTime');
  }
  if (!Number.isInteger(input.maxCapacity) || input.maxCapacity < 1) {
    return failure('ความจุต้องเป็นจำนวนเต็มมากกว่า 0', 'maxCapacity');
  }
  if (!Number.isInteger(bookedCount) || bookedCount < 0) {
    return failure('จำนวนจองต้องเป็นจำนวนเต็มไม่ติดลบ', 'maxCapacity');
  }
  if (bookedCount > input.maxCapacity) {
    return failure(`ลดความจุต่ำกว่าจำนวนจองปัจจุบัน ${bookedCount} คนไม่ได้`, 'maxCapacity');
  }
  const overlaps = slots.some(
    (slot) =>
      slot.id !== editingId &&
      slot.doctorId === input.doctorId &&
      slot.slotDate === input.slotDate &&
      input.startTime < slot.endTime &&
      input.endTime > slot.startTime,
  );
  if (overlaps) return failure('แพทย์มีรอบเวลาทับซ้อนกับรายการเดิม');
  return success(input);
}

export function validateDepartmentName(
  name: string,
  code: string,
  departments: ScheduleDepartment[],
  editingId?: string,
): ShopResult<true> {
  if (!name.trim() || !code.trim()) return failure('กรอกชื่อและรหัสแผนกก่อนบันทึก');
  const normalized = name.trim().toLocaleLowerCase('th');
  if (departments.some((item) => item.id !== editingId && item.name.trim().toLocaleLowerCase('th') === normalized)) {
    return failure('ชื่อแผนกนี้มีอยู่แล้ว', 'name');
  }
  return success(true);
}

export function countAffectedSlots(
  slots: ScheduleSlot[],
  doctorId: string,
  startDate: string,
  endDate: string,
): number {
  if (!doctorId || !startDate || !endDate || startDate > endDate) return 0;
  return slots.filter(
    (slot) =>
      slot.doctorId === doctorId &&
      slot.slotDate >= startDate &&
      slot.slotDate <= endDate &&
      slot.status !== 'closed',
  ).length;
}
