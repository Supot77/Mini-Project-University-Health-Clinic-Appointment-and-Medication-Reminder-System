export interface ScheduleItem {
  id: number | string;
  doctor: string;
  specialty: string;
  dept: string;
  days: string[];
  hours: string;
  room: string;
  status: string;
}


/**
 * View models for Shop's mock-first UI.
 *
 * INTEGRATION: Keep presentation-only fields (code, room, tone, initials)
 * outside the shared database interfaces. When Supabase is connected,
 * scheduleService should map Department/Doctor/AppointmentSlot rows into
 * these shapes so the UI components do not need to know where data came from.
 */

export type DepartmentTone = 'sky' | 'teal' | 'amber' | 'violet';

export interface ScheduleDepartment {
  id: string;
  code: string;
  name: string;
  description: string;
  room: string;
  isActive: boolean;
  hasHistory?: boolean;
  tone: DepartmentTone;
}

export type DoctorAvailability = 'active' | 'on_leave' | 'inactive';

export interface ScheduleDoctor {
  id: string;
  profileId: string;
  fullName: string;
  initials: string;
  email: string;
  specialty: string;
  departmentId: string;
  availability: DoctorAvailability;
  hasHistory?: boolean;
}

export type ScheduleSlotStatus = 'available' | 'full' | 'closed';
export type ScheduleSlotClosedReason = 'manual' | 'doctor_leave';

export interface ScheduleSlot {
  id: string;
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  status: ScheduleSlotStatus;
  closedReason?: ScheduleSlotClosedReason;
  hasHistory?: boolean;
}

export interface DoctorWeeklySchedule {
  id: string;
  doctorId: string;
  weekday: 1 | 2 | 3 | 4 | 5;
  startTime: string;
  endTime: string;
  slotDurationMinutes: 30 | 60;
  defaultCapacity: number;
  isActive: boolean;
}

export interface DoctorAvailabilityTemplate {
  id: string;
  doctorId: string;
  label?: string;
  startTime: string;
  endTime: string;
  defaultCapacity: number;
  usageCount: number;
  lastUsedAt: string;
}


export interface DoctorAccountOption {
  profileId: string;
  fullName: string;
  email: string;
  initials: string;
}
