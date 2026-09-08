import type {
  DoctorAccountOption,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleSlot,
  DoctorWeeklySchedule,
  DoctorAvailabilityTemplate,
} from '@/types/schedule';
import type { UserRole } from '@/types/database';
import type { ShopResult, SlotInput } from './rules';

export interface ShopSnapshot {
  departments: ScheduleDepartment[];
  doctors: ScheduleDoctor[];
  slots: ScheduleSlot[];
  doctorAccounts: DoctorAccountOption[];
  weeklySchedules: DoctorWeeklySchedule[];
  availabilityTemplates?: DoctorAvailabilityTemplate[];
}

/**
 * Boundary consumed by the UI. The active implementation is mock-first;
 * a database implementation can be added later without changing consumers.
 */
export interface ShopRepository {
  snapshot(): ShopSnapshot;
  saveDepartment(
    input: Omit<ScheduleDepartment, 'id' | 'isActive'>,
    id?: string,
  ): ShopResult<ScheduleDepartment>;
  toggleDepartment(id: string): ShopResult<'deleted' | 'disabled' | 'enabled'>;
  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): ShopResult<ScheduleDoctor>;
  toggleDoctor(id: string): ShopResult<ScheduleDoctor | 'deleted'>;
  saveSlot(input: SlotInput, id?: string): ShopResult<ScheduleSlot>;
  toggleSlot(id: string, actorId?: string, role?: UserRole): ShopResult<ScheduleSlot>;
  saveWeeklySchedule(input: Omit<DoctorWeeklySchedule, 'id'>, id?: string): ShopResult<DoctorWeeklySchedule>;
  generateSlotsForRange(startDate: string, endDate: string, today: string): ShopResult<number>;
  getDoctorTemplates(doctorId: string): DoctorAvailabilityTemplate[];
  saveDoctorTemplate(input: Omit<DoctorAvailabilityTemplate, 'id' | 'usageCount' | 'lastUsedAt'>): ShopResult<DoctorAvailabilityTemplate>;
}
