import {
  MOCK_DEPARTMENTS,
  MOCK_DOCTOR_ACCOUNT_OPTIONS,
  MOCK_DOCTORS,
  MOCK_LEAVE_REQUESTS,
  MOCK_SLOTS,
  MOCK_WEEKLY_SCHEDULES,
} from '@/mocks/scheduleData';
import type {
  DoctorLeaveRequest,
  DoctorWeeklySchedule,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleSlot,
} from '@/types/schedule';
import {
  deriveSlotStatus,
  validateDepartmentName,
  validateSlot,
  type ShopResult,
  type SlotInput,
} from '../domain/rules';
import type { ShopRepository, ShopSnapshot } from '../domain/repository';

export class MockShopRepository implements ShopRepository {
  private state: ShopSnapshot = {
    departments: structuredClone(MOCK_DEPARTMENTS),
    doctors: structuredClone(MOCK_DOCTORS),
    slots: structuredClone(MOCK_SLOTS),
    doctorAccounts: structuredClone(MOCK_DOCTOR_ACCOUNT_OPTIONS),
    weeklySchedules: structuredClone(MOCK_WEEKLY_SCHEDULES),
    leaveRequests: structuredClone(MOCK_LEAVE_REQUESTS),
  };

  snapshot(): ShopSnapshot {
    return structuredClone(this.state);
  }

  saveDepartment(input: Omit<ScheduleDepartment, 'id' | 'isActive'>, id?: string): ShopResult<ScheduleDepartment> {
    const valid = validateDepartmentName(input.name, input.code, this.state.departments, id);
    if (!valid.ok) return valid;
    const existing = id ? this.state.departments.find((item) => item.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบแผนกที่ต้องการแก้ไข' };
    const department: ScheduleDepartment = existing
      ? { ...existing, ...input, code: input.code.toUpperCase() }
      : { ...input, id: crypto.randomUUID(), code: input.code.toUpperCase(), isActive: true, hasHistory: false };
    this.state.departments = existing
      ? this.state.departments.map((item) => (item.id === id ? department : item))
      : [...this.state.departments, department];
    return { ok: true, value: department };
  }

  toggleDepartment(id: string): ShopResult<'deleted' | 'disabled' | 'enabled'> {
    const department = this.state.departments.find((item) => item.id === id);
    if (!department) return { ok: false, error: 'ไม่พบแผนก' };
    const referenced = department.hasHistory || this.state.doctors.some((item) => item.departmentId === id);
    if (department.isActive && !referenced) {
      this.state.departments = this.state.departments.filter((item) => item.id !== id);
      return { ok: true, value: 'deleted' };
    }
    this.state.departments = this.state.departments.map((item) => item.id === id ? { ...item, isActive: !item.isActive } : item);
    return { ok: true, value: department.isActive ? 'disabled' : 'enabled' };
  }

  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): ShopResult<ScheduleDoctor> {
    if (!input.profileId || !input.departmentId || !input.specialty.trim()) {
      return { ok: false, error: 'เลือกบัญชีแพทย์ แผนก และกรอกความเชี่ยวชาญก่อนบันทึก' };
    }
    if (!this.state.departments.some((item) => item.id === input.departmentId && item.isActive)) {
      return { ok: false, error: 'เลือกแผนกที่เปิดใช้งาน' };
    }
    const existing = id ? this.state.doctors.find((item) => item.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบแพทย์ที่ต้องการแก้ไข' };
    if (this.state.doctors.some((item) => item.id !== id && item.profileId === input.profileId)) {
      return { ok: false, error: 'บัญชีแพทย์นี้ถูกผูกกับทะเบียนแล้ว', field: 'profileId' };
    }
    const doctor: ScheduleDoctor = existing
      ? { ...existing, ...input }
      : { ...input, id: crypto.randomUUID(), hasHistory: false };
    this.state.doctors = existing
      ? this.state.doctors.map((item) => (item.id === id ? doctor : item))
      : [...this.state.doctors, doctor];
    return { ok: true, value: doctor };
  }

  toggleDoctor(id: string): ShopResult<ScheduleDoctor | 'deleted'> {
    const doctor = this.state.doctors.find((item) => item.id === id);
    if (!doctor) return { ok: false, error: 'ไม่พบแพทย์' };
    const referenced = doctor.hasHistory || this.state.slots.some((slot) => slot.doctorId === id);
    if (doctor.availability !== 'inactive' && !referenced) {
      this.state.doctors = this.state.doctors.filter((item) => item.id !== id);
      return { ok: true, value: 'deleted' };
    }
    const next = { ...doctor, availability: doctor.availability === 'inactive' ? 'active' as const : 'inactive' as const };
    this.state.doctors = this.state.doctors.map((item) => item.id === id ? next : item);
    return { ok: true, value: next };
  }

  saveSlot(input: SlotInput, id?: string): ShopResult<ScheduleSlot> {
    const existing = id ? this.state.slots.find((item) => item.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบรอบตรวจที่ต้องการแก้ไข' };
    const bookedCount = existing?.bookedCount ?? 0;
    const valid = validateSlot(input, this.state.slots, this.state.doctors, this.state.departments, id, bookedCount);
    if (!valid.ok) return valid;
    const slot: ScheduleSlot = existing
      ? { ...existing, ...input, status: deriveSlotStatus(bookedCount, input.maxCapacity, existing.status) }
      : { ...input, id: crypto.randomUUID(), bookedCount: 0, status: 'available', hasHistory: false };
    this.state.slots = existing
      ? this.state.slots.map((item) => item.id === id ? slot : item)
      : [...this.state.slots, slot];
    return { ok: true, value: slot };
  }

  toggleSlot(id: string): ShopResult<ScheduleSlot> {
    const slot = this.state.slots.find((item) => item.id === id);
    if (!slot) return { ok: false, error: 'ไม่พบรอบตรวจ' };
    if (slot.status === 'closed' && slot.closedReason === 'doctor_leave') return { ok: false, error: 'รอบนี้ปิดอัตโนมัติจากวันลา ต้องจัดการที่คำขอวันลา' };
    const next = slot.status === 'closed'
      ? { ...slot, status: deriveSlotStatus(slot.bookedCount, slot.maxCapacity), closedReason: undefined }
      : { ...slot, status: 'closed' as const, closedReason: 'manual' as const };
    this.state.slots = this.state.slots.map((item) => item.id === id ? next : item);
    return { ok: true, value: next };
  }

  saveWeeklySchedule(input: Omit<DoctorWeeklySchedule, 'id'>, id?: string): ShopResult<DoctorWeeklySchedule> {
    const doctor = this.state.doctors.find((item) => item.id === input.doctorId);
    if (!doctor) return { ok: false, error: 'ไม่พบแพทย์' };
    if (doctor.availability !== 'active') return { ok: false, error: 'แพทย์ต้องเปิดใช้งานก่อนตั้งตาราง', field: 'doctorId' };
    if (!this.state.departments.some((department) => department.id === doctor.departmentId && department.isActive)) return { ok: false, error: 'ระบุแผนกที่เปิดใช้งานก่อนตั้งตาราง', field: 'doctorId' };
    if (!this.state.doctors.some((doctor) => doctor.id === input.doctorId)) return { ok: false, error: 'ไม่พบแพทย์' };
    if (![1, 2, 3, 4, 5].includes(input.weekday)) return { ok: false, error: 'ตารางประจำใช้ได้เฉพาะวันจันทร์ถึงศุกร์', field: 'weekday' };
    if (!Number.isInteger(input.defaultCapacity) || input.defaultCapacity < 1) return { ok: false, error: 'ความจุต้องเป็นจำนวนเต็มมากกว่า 0', field: 'defaultCapacity' };
    if (![30, 60].includes(input.slotDurationMinutes)) return { ok: false, error: 'รองรับความยาว slot 30 หรือ 60 นาที', field: 'slotDurationMinutes' };
    const existing = id ? this.state.weeklySchedules.find((schedule) => schedule.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบตารางประจำที่ต้องการแก้ไข' };
    if (input.startTime >= input.endTime) return { ok: false, error: 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด', field: 'startTime' };
    if (input.startTime < '08:30' || input.endTime > '16:30' || (input.startTime < '13:00' && input.endTime > '12:00')) return { ok: false, error: 'ตารางต้องอยู่ในเวลาคลินิกและไม่ทับช่วงพัก', field: 'startTime' };
    if ((toMinutes(input.endTime) - toMinutes(input.startTime)) % input.slotDurationMinutes !== 0) return { ok: false, error: 'ช่วงเวลาต้องแบ่งลงตัวตามความยาว slot', field: 'endTime' };
    const conflict = this.state.weeklySchedules.some((schedule) => schedule.id !== id && schedule.isActive && input.isActive && schedule.doctorId === input.doctorId && schedule.weekday === input.weekday && input.startTime < schedule.endTime && input.endTime > schedule.startTime);
    if (conflict) return { ok: false, error: 'ตารางประจำมีเวลาทับซ้อนกัน', field: 'startTime' };
    const schedule = existing ? { ...existing, ...input } : { ...input, id: crypto.randomUUID() };
    this.state.weeklySchedules = existing ? this.state.weeklySchedules.map((item) => item.id === id ? schedule : item) : [...this.state.weeklySchedules, schedule];
    return { ok: true, value: schedule };
  }

  submitLeave(input: Omit<DoctorLeaveRequest, 'id' | 'status'>): ShopResult<DoctorLeaveRequest> {
    if (!this.state.doctors.some((doctor) => doctor.id === input.doctorId)) return { ok: false, error: 'ไม่พบแพทย์', field: 'doctorId' };
    if (!input.startDate || !input.endDate || input.startDate > input.endDate) return { ok: false, error: 'ช่วงวันลาไม่ถูกต้อง', field: 'startDate' };
    if (!input.reason.trim()) return { ok: false, error: 'กรอกเหตุผลวันลา', field: 'reason' };
    const conflict = this.state.leaveRequests.some((leave) => leave.doctorId === input.doctorId && leave.status !== 'rejected' && input.startDate <= leave.endDate && input.endDate >= leave.startDate);
    if (conflict) return { ok: false, error: 'ช่วงวันลาทับกับคำขอเดิม', field: 'startDate' };
    const request: DoctorLeaveRequest = {
      ...input,
      leaveType: input.leaveType ?? 'personal',
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.state.leaveRequests = [...this.state.leaveRequests, request];
    return { ok: true, value: request };
  }

  decideLeave(
    id: string,
    status: 'approved' | 'rejected',
    decidedBy: string,
    today: string,
    decisionNote?: string,
  ): ShopResult<DoctorLeaveRequest> {
    const leave = this.state.leaveRequests.find((item) => item.id === id);
    if (!leave) return { ok: false, error: 'ไม่พบคำขอวันลา' };
    if (leave.status !== 'pending') return { ok: false, error: 'คำขอวันลานี้ถูกตัดสินแล้ว' };
    const next: DoctorLeaveRequest = {
      ...leave,
      status,
      decidedBy,
      decidedAt: new Date().toISOString(),
      decisionNote: decisionNote?.trim() || undefined,
    };
    this.state.leaveRequests = this.state.leaveRequests.map((item) => item.id === id ? next : item);
    if (status === 'approved') this.reconcileDoctorLeave(today);
    return { ok: true, value: next };
  }

  cancelLeave(id: string, requestedBy?: string): ShopResult<DoctorLeaveRequest> {
    const leave = this.state.leaveRequests.find((item) => item.id === id);
    if (!leave) return { ok: false, error: 'ไม่พบคำขอวันลา' };
    if (leave.status !== 'pending') return { ok: false, error: 'ยกเลิกได้เฉพาะคำขอที่รออนุมัติเท่านั้น' };
    if (requestedBy && leave.requestedBy && leave.requestedBy !== requestedBy) {
      return { ok: false, error: 'ไม่มีสิทธิ์ยกเลิกคำขอนี้' };
    }
    this.state.leaveRequests = this.state.leaveRequests.filter((item) => item.id !== id);
    return { ok: true, value: leave };
  }

  generateSlotsForRange(startDate: string, endDate: string, today: string): ShopResult<number> {
    if (!startDate || !endDate || startDate > endDate) return { ok: false, error: 'ช่วงวันที่สร้างรอบไม่ถูกต้อง' };
    let created = 0;
    for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) {
      const weekday = clinicWeekday(date);
      if (weekday < 1 || weekday > 5) continue;
      for (const schedule of this.state.weeklySchedules.filter((item) => item.isActive && item.weekday === weekday)) {
        for (let minutes = toMinutes(schedule.startTime); minutes + schedule.slotDurationMinutes <= toMinutes(schedule.endTime); minutes += schedule.slotDurationMinutes) {
          const startTime = fromMinutes(minutes); const endTime = fromMinutes(minutes + schedule.slotDurationMinutes);
          const exists = this.state.slots.some((slot) => slot.doctorId === schedule.doctorId && slot.slotDate === date && slot.startTime === startTime && slot.endTime === endTime);
          const overlaps = this.state.slots.some((slot) => slot.doctorId === schedule.doctorId && slot.slotDate === date && startTime < slot.endTime && endTime > slot.startTime);
          if (!exists && !overlaps && date >= today) { this.state.slots.push({ id: crypto.randomUUID(), doctorId: schedule.doctorId, slotDate: date, startTime, endTime, maxCapacity: schedule.defaultCapacity, bookedCount: 0, status: 'available', hasHistory: false }); created += 1; }
        }
      }
    }
    this.reconcileDoctorLeave(today);
    return { ok: true, value: created };
  }

  reconcileDoctorLeave(today: string): ShopResult<number> {
    let changed = 0;
    const approved = this.state.leaveRequests.filter((leave) => leave.status === 'approved');
    this.state.slots = this.state.slots.map((slot) => {
      const inLeave = slot.slotDate >= today && approved.some((leave) => leave.doctorId === slot.doctorId && slot.slotDate >= leave.startDate && slot.slotDate <= leave.endDate);
      if (inLeave && slot.status !== 'closed' && slot.closedReason !== 'manual') { changed += 1; return { ...slot, status: 'closed' as const, closedReason: 'doctor_leave' as const }; }
      if (!inLeave && slot.closedReason === 'doctor_leave') { changed += 1; return { ...slot, status: deriveSlotStatus(slot.bookedCount, slot.maxCapacity), closedReason: undefined }; }
      return slot;
    });
    return { ok: true, value: changed };
  }
}

function toMinutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function fromMinutes(value: number) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function clinicWeekday(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); }
function shiftDate(value: string, days: number) { const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day + days)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; }
