import type {
  DoctorAccountOption,
  DailyServiceOffering,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleService,
  ScheduleSlot,
  DoctorWeeklySchedule,
  DoctorAvailabilityTemplate,
} from '@/types/schedule';
import type { UserRole } from '@/types/database';
import type { ShopResult, SlotInput } from './rules';

export interface ShopSnapshot {
  departments: ScheduleDepartment[];
  doctors: ScheduleDoctor[];
  services: ScheduleService[];
  dailyServiceOfferings: DailyServiceOffering[];
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
  saveService(input: Omit<ScheduleService, 'id' | 'isActive'>, id?: string): ShopResult<ScheduleService>;
  toggleService(id: string): ShopResult<'deleted' | 'disabled' | 'enabled'>;
  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): ShopResult<ScheduleDoctor>;
  toggleDoctor(id: string): ShopResult<ScheduleDoctor | 'deleted'>;
  saveSlot(input: SlotInput, id?: string, todayDate?: string): ShopResult<ScheduleSlot>;
  toggleSlot(id: string, actorId?: string, role?: UserRole): ShopResult<ScheduleSlot>;
  saveWeeklySchedule(input: Omit<DoctorWeeklySchedule, 'id'>, id?: string): ShopResult<DoctorWeeklySchedule>;
  generateSlotsForRange(startDate: string, endDate: string, today: string, serviceId?: string): ShopResult<number>;
  getDoctorTemplates(doctorId: string): DoctorAvailabilityTemplate[];
  saveDoctorTemplate(input: Omit<DoctorAvailabilityTemplate, 'id' | 'usageCount' | 'lastUsedAt'>): ShopResult<DoctorAvailabilityTemplate>;
}
