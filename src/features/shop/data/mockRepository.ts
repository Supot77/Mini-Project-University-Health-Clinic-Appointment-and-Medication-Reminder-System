import {
  MOCK_DEPARTMENTS,
  MOCK_DOCTOR_ACCOUNT_OPTIONS,
  MOCK_DOCTORS,
  MOCK_DAILY_SERVICE_OFFERINGS,
  MOCK_SERVICES,
  MOCK_SLOTS,
  MOCK_WEEKLY_SCHEDULES,
} from '@/mocks/scheduleData';
import type {
  DoctorWeeklySchedule,
  DoctorAvailabilityTemplate,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleService,
  ScheduleSlot,
} from '@/types/schedule';
import type { UserRole } from '@/types/database';
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
    services: structuredClone(MOCK_SERVICES),
    dailyServiceOfferings: structuredClone(MOCK_DAILY_SERVICE_OFFERINGS),
    slots: structuredClone(MOCK_SLOTS),
    doctorAccounts: structuredClone(MOCK_DOCTOR_ACCOUNT_OPTIONS),
    weeklySchedules: structuredClone(MOCK_WEEKLY_SCHEDULES),
    availabilityTemplates: [],
  };

  snapshot(): ShopSnapshot {
    return structuredClone(this.state);
  }

  saveDepartment(input: Omit<ScheduleDepartment, 'id' | 'isActive'>, id?: string): ShopResult<ScheduleDepartment> {
    const valid = validateDepartmentName(input.name, input.code, this.state.departments, id);
    if (!valid.ok) return valid;
    const existing = id ? this.state.departments.find((item) => item.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบแผนกที่ต้องการแก้ไข' };
    const code = input.code?.trim() ? input.code.trim().toUpperCase() : existing?.code ?? 'DEPT';
    const department: ScheduleDepartment = existing
      ? { ...existing, ...input, code }
      : { ...input, id: crypto.randomUUID(), code, isActive: true, hasHistory: false };
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

  saveService(input: Omit<ScheduleService, 'id' | 'isActive'>, id?: string): ShopResult<ScheduleService> {
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();
    if (!name || !code) return { ok: false, error: 'กรอกรหัสและชื่อบริการก่อนบันทึก' };
    const duplicate = this.state.services.some(
      (service) => service.id !== id && (service.code.toLowerCase() === code.toLowerCase() || service.name.trim().toLowerCase() === name.toLowerCase()),
    );
    if (duplicate) return { ok: false, error: 'รหัสหรือชื่อบริการนี้มีอยู่แล้ว' };
    const existing = id ? this.state.services.find((service) => service.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบบริการที่ต้องการแก้ไข' };
    const service: ScheduleService = existing
      ? { ...existing, ...input, code, name, description: input.description.trim() }
      : { ...input, id: crypto.randomUUID(), code, name, description: input.description.trim(), isActive: true, hasHistory: false };
    this.state.services = existing
      ? this.state.services.map((item) => (item.id === id ? service : item))
      : [...this.state.services, service];
    return { ok: true, value: service };
  }

  toggleService(id: string): ShopResult<'deleted' | 'disabled' | 'enabled'> {
    const service = this.state.services.find((item) => item.id === id);
    if (!service) return { ok: false, error: 'ไม่พบบริการ' };
    const referenced = service.hasHistory || this.state.dailyServiceOfferings.some((offering) => offering.serviceId === id);
    if (service.isActive && !referenced) {
      this.state.services = this.state.services.filter((item) => item.id !== id);
      return { ok: true, value: 'deleted' };
    }
    this.state.services = this.state.services.map((item) => item.id === id ? { ...item, isActive: !item.isActive } : item);
    return { ok: true, value: service.isActive ? 'disabled' : 'enabled' };
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

  saveSlot(input: SlotInput, id?: string, todayDate?: string): ShopResult<ScheduleSlot> {
    const existing = id ? this.state.slots.find((item) => item.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบรอบตรวจที่ต้องการแก้ไข' };
    const bookedCount = existing?.bookedCount ?? 0;
    const valid = validateSlot(input, this.state.slots, this.state.doctors, this.state.services, id, bookedCount, todayDate);
    if (!valid.ok) return valid;
    const existingOffering = this.state.dailyServiceOfferings.find(
      (offering) => offering.serviceId === input.serviceId && offering.doctorId === input.doctorId && offering.offeringDate === input.slotDate,
    );
    const offering = existingOffering ?? {
      id: crypto.randomUUID(),
      serviceId: input.serviceId,
      doctorId: input.doctorId,
      offeringDate: input.slotDate,
      isActive: true,
      createdBy: 'mock',
    };
    if (!existingOffering) this.state.dailyServiceOfferings = [...this.state.dailyServiceOfferings, offering];
    const slot: ScheduleSlot = existing
      ? { ...existing, ...input, serviceOfferingId: offering.id, status: deriveSlotStatus(bookedCount, input.maxCapacity, existing.status) }
      : { ...input, id: crypto.randomUUID(), serviceOfferingId: offering.id, bookedCount: 0, status: 'available', hasHistory: false };
    this.state.slots = existing
      ? this.state.slots.map((item) => item.id === id ? slot : item)
      : [...this.state.slots, slot];
    return { ok: true, value: slot };
  }

  toggleSlot(id: string, actorId?: string, role?: UserRole): ShopResult<ScheduleSlot> {
    const slot = this.state.slots.find((item) => item.id === id);
    if (!slot) return { ok: false, error: 'ไม่พบรอบตรวจ' };

    if (role === 'medical' && actorId) {
      const doctor = this.state.doctors.find((d) => d.profileId === actorId || d.id === actorId);
      if (!doctor || slot.doctorId !== doctor.id) {
        return { ok: false, error: 'ไม่มีสิทธิ์จัดการรอบตรวจของแพทย์ท่านอื่น' };
      }
    }

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

  generateSlotsForRange(startDate: string, endDate: string, today: string, requestedServiceId?: string): ShopResult<number> {
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
          if (!exists && !overlaps && date >= today) {
            const serviceId = requestedServiceId ?? this.state.services.find((service) => service.id === `service-${this.state.doctors.find((doctor) => doctor.id === schedule.doctorId)?.departmentId}`)?.id ?? this.state.services.find((service) => service.isActive)?.id;
            if (!serviceId) continue;
            const offering = this.state.dailyServiceOfferings.find((item) => item.serviceId === serviceId && item.doctorId === schedule.doctorId && item.offeringDate === date) ?? {
              id: crypto.randomUUID(), serviceId, doctorId: schedule.doctorId, offeringDate: date, isActive: true, createdBy: 'mock',
            };
            if (!this.state.dailyServiceOfferings.some((item) => item.id === offering.id)) this.state.dailyServiceOfferings.push(offering);
            this.state.slots.push({ id: crypto.randomUUID(), doctorId: schedule.doctorId, serviceOfferingId: offering.id, serviceId, slotDate: date, startTime, endTime, maxCapacity: schedule.defaultCapacity, bookedCount: 0, status: 'available', hasHistory: false });
            created += 1;
          }
        }
      }
    }
    return { ok: true, value: created };
  }

  getDoctorTemplates(doctorId: string): DoctorAvailabilityTemplate[] {
    const templates = this.state.availabilityTemplates?.filter((t) => t.doctorId === doctorId) ?? [];
    return [...templates].sort((a, b) => b.usageCount - a.usageCount || b.lastUsedAt.localeCompare(a.lastUsedAt));
  }

  saveDoctorTemplate(input: Omit<DoctorAvailabilityTemplate, 'id' | 'usageCount' | 'lastUsedAt'>): ShopResult<DoctorAvailabilityTemplate> {
    if (!this.state.availabilityTemplates) {
      this.state.availabilityTemplates = [];
    }
    const now = new Date().toISOString();
    const existing = this.state.availabilityTemplates.find(
      (t) => t.doctorId === input.doctorId && t.startTime === input.startTime && t.endTime === input.endTime && t.defaultCapacity === input.defaultCapacity
    );
    if (existing) {
      existing.usageCount += 1;
      existing.lastUsedAt = now;
      if (input.label) existing.label = input.label;
      return { ok: true, value: structuredClone(existing) };
    }
    const newTemplate: DoctorAvailabilityTemplate = {
      ...input,
      id: crypto.randomUUID(),
      usageCount: 1,
      lastUsedAt: now,
      label: input.label || `${input.startTime}–${input.endTime} (${input.defaultCapacity} คน)`,
    };
    this.state.availabilityTemplates.push(newTemplate);
    return { ok: true, value: structuredClone(newTemplate) };
  }
}

function toMinutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
function fromMinutes(value: number) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function clinicWeekday(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); }
function shiftDate(value: string, days: number) { const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day + days)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; }
