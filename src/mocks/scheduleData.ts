import { clinicMockTables } from './clinicDatabase';
import type {
  DailyServiceOffering,
  DepartmentTone,
  DoctorAccountOption,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleService,
  ScheduleSlot,
  DoctorWeeklySchedule,
} from '@/types/schedule';

export const MOCK_WEEK_START = '2026-09-07';

const departmentPresentation: Record<string, { code: string; room: string; tone: DepartmentTone }> = {
  'dept-general': { code: 'GEN', room: 'อาคารสุขภาพ · ห้อง 101', tone: 'sky' },
  'dept-mental': { code: 'MHC', room: 'อาคารสุขภาพ · ห้อง 204', tone: 'violet' },
  'dept-internal': { code: 'MED', room: 'อาคารสุขภาพ · ห้อง 112', tone: 'amber' },
  'dept-physio': { code: 'PT', room: 'อาคารกีฬา · ห้อง PT-2', tone: 'teal' },
};

export const MOCK_DEPARTMENTS: ScheduleDepartment[] = clinicMockTables.departments.map((department) => ({
  id: department.id,
  name: department.name,
  description: department.description ?? '',
  isActive: true,
  hasHistory: true,
  ...(departmentPresentation[department.id] ?? { code: 'DEP', room: 'ยังไม่กำหนด', tone: 'sky' as const }),
}));

export const MOCK_SERVICES: ScheduleService[] = MOCK_DEPARTMENTS.map((department) => ({
  id: `service-${department.id}`,
  code: department.code ?? department.id.replace(/^dept-/, '').toUpperCase(),
  name: department.name,
  description: department.description,
  isActive: true,
  hasHistory: true,
}));

const serviceForDoctor = new Map(
  clinicMockTables.doctors.map((doctor) => [doctor.id, `service-${doctor.department_id ?? 'general'}`]),
);

const serviceForSlot = (doctorId: string) => serviceForDoctor.get(doctorId) ?? MOCK_SERVICES[0]?.id ?? '';

const offeringKey = (doctorId: string, serviceId: string, offeringDate: string) =>
  `offering-${doctorId}-${serviceId}-${offeringDate}`;

const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export const MOCK_DOCTORS: ScheduleDoctor[] = clinicMockTables.doctors.map((doctor) => {
  const doctorProfile = clinicMockTables.profiles.find((item) => item.id === doctor.id)!;
  return {
    id: doctor.id,
    profileId: doctor.id,
    fullName: `นพ. ${doctorProfile.full_name}`,
    initials: initials(doctorProfile.full_name),
    email: `${doctorProfile.full_name.toLowerCase().replaceAll(' ', '.')}.doctor@clinic-demo.test`,
    specialty: doctor.specialty ?? 'ยังไม่ระบุ',
    departmentId: doctor.department_id ?? '',
    availability: doctor.id === 'profile-shuri-udaku' ? 'on_leave' : 'active',
    hasHistory: true,
  };
});

export const MOCK_DOCTOR_ACCOUNT_OPTIONS: DoctorAccountOption[] = [
  { profileId: 'profile-gregory-house', fullName: 'นพ. Gregory House', email: 'gregory.house.doctor@clinic-demo.test', initials: 'GH' },
  { profileId: 'profile-akiko-yamada', fullName: 'พญ. Akiko Yamada', email: 'akiko.yamada.doctor@clinic-demo.test', initials: 'AY' },
];

export const MOCK_SLOTS: ScheduleSlot[] = clinicMockTables.appointment_slots.map((slot) => ({
  id: slot.id,
  doctorId: slot.doctor_id,
  serviceOfferingId: offeringKey(slot.doctor_id, serviceForSlot(slot.doctor_id), slot.slot_date),
  serviceId: serviceForSlot(slot.doctor_id),
  slotDate: slot.slot_date,
  startTime: slot.start_time,
  endTime: slot.end_time,
  maxCapacity: slot.max_capacity,
  bookedCount: slot.booked_count,
  status: slot.status,
  hasHistory: slot.booked_count > 0,
}));

export const MOCK_DAILY_SERVICE_OFFERINGS: DailyServiceOffering[] = Array.from(
  new Map(
    MOCK_SLOTS.map((slot) => [
      slot.serviceOfferingId,
      {
        id: slot.serviceOfferingId,
        serviceId: slot.serviceId,
        doctorId: slot.doctorId,
        offeringDate: slot.slotDate,
        isActive: true,
        createdBy: 'seed',
      },
    ]),
  ).values(),
);

const weekdays = [1, 2, 3, 4, 5] as const;
export const MOCK_WEEKLY_SCHEDULES: DoctorWeeklySchedule[] = MOCK_DOCTORS.flatMap((doctor) =>
  weekdays.flatMap((weekday) => [
    {
      id: `weekly-${doctor.id}-${weekday}-am`,
      doctorId: doctor.id,
      weekday,
      startTime: '08:30',
      endTime: '12:00',
      slotDurationMinutes: 30,
      defaultCapacity: 1,
      isActive: true,
    },
    {
      id: `weekly-${doctor.id}-${weekday}-pm`,
      doctorId: doctor.id,
      weekday,
      startTime: '13:00',
      endTime: '16:30',
      slotDurationMinutes: 30,
      defaultCapacity: 1,
      isActive: true,
    },
  ]),
);
