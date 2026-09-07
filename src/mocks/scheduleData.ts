import { clinicMockTables } from './clinicDatabase';
import type {
  DepartmentTone,
  DoctorAccountOption,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleSlot,
  DoctorWeeklySchedule,
  DoctorLeaveRequest,
} from '@/types/schedule';

export const MOCK_WEEK_START = '2026-09-07';

const departmentPresentation: Record<string, { code: string; room: string; tone: DepartmentTone }> = {
  'dept-general': { code: 'GEN', room: 'อาคารสุขภาพ · ห้อง 101', tone: 'sky' },
  'dept-mental': { code: 'MHC', room: 'อาคารสุขภาพ · ห้อง 204', tone: 'violet' },
  'dept-vaccine': { code: 'VAC', room: 'อาคารสุขภาพ · ห้อง 112', tone: 'amber' },
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
  slotDate: slot.slot_date,
  startTime: slot.start_time,
  endTime: slot.end_time,
  maxCapacity: slot.max_capacity,
  bookedCount: slot.booked_count,
  status: slot.status,
  hasHistory: slot.booked_count > 0,
}));

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

export const MOCK_LEAVE_REQUESTS: DoctorLeaveRequest[] = [
  {
    id: 'leave-1',
    doctorId: 'profile-shuri-udaku',
    startDate: '2026-09-07',
    endDate: '2026-09-09',
    leaveType: 'academic',
    reason: 'เข้าร่วมประชุมสัมมนาเทคโนโลยีการแพทย์ขั้นสูง ณ ศูนย์ประชุมนานาชาติ',
    status: 'approved',
    requestedBy: 'profile-shuri-udaku',
    decidedBy: 'profile-leslie-knope',
    decidedAt: '2026-09-05T09:30:00.000Z',
    decisionNote: 'อนุมัติเรียบร้อย ได้ปิดรอบตรวจที่เกี่ยวข้องแล้ว',
    createdAt: '2026-09-04T10:00:00.000Z',
  },
  {
    id: 'leave-2',
    doctorId: 'profile-stephen-strange',
    startDate: '2026-09-10',
    endDate: '2026-09-11',
    leaveType: 'vacation',
    reason: 'ลาพักผ่อนประจำปี',
    status: 'pending',
    requestedBy: 'profile-stephen-strange',
    createdAt: '2026-09-07T08:15:00.000Z',
  },
  {
    id: 'leave-3',
    doctorId: 'profile-meredith-grey',
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    leaveType: 'sick',
    reason: 'มีอาการไข้หวัด พักฟื้นตามคำแนะนำแพทย์',
    status: 'approved',
    requestedBy: 'profile-meredith-grey',
    decidedBy: 'profile-nick-fury',
    decidedAt: '2026-09-01T07:45:00.000Z',
    decisionNote: 'รับทราบและอนุมัติ',
    createdAt: '2026-09-01T07:00:00.000Z',
  },
];
