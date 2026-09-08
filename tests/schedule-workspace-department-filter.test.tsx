import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleWorkspace from '@/components/schedules/ScheduleWorkspace';
import type { ScheduleDepartment, ScheduleDoctor, ScheduleSlot } from '@/types/schedule';

const mockDepartments: ScheduleDepartment[] = [
  { id: 'dept-general', name: 'เวชปฏิบัติทั่วไป', description: 'ตรวจโรคทั่วไป', isActive: true },
  { id: 'dept-dental', name: 'ทันตกรรม', description: 'แผนกทันตกรรม', isActive: false },
  { id: 'dept-psychiatry', name: 'จิตเวช', description: 'แผนกจิตเวช', isActive: true },
  { id: 'dept-pharmacy', name: 'เภสัชกรรม', description: 'แผนกเภสัชกรรม', isActive: true },
];

const mockDoctors: ScheduleDoctor[] = [
  {
    id: 'doc-1',
    profileId: 'prof-1',
    fullName: 'นพ. สมชาย ใจดี',
    initials: 'SJ',
    email: 'somchai@wu.ac.th',
    specialty: 'เวชปฏิบัติทั่วไป',
    departmentId: 'dept-general',
    availability: 'active',
  },
  {
    id: 'doc-2',
    profileId: 'prof-2',
    fullName: 'ทพ. สมศักดิ์ ฟันสวย',
    initials: 'SF',
    email: 'somsak@wu.ac.th',
    specialty: 'ทันตกรรม',
    departmentId: 'dept-dental',
    availability: 'active',
  },
  {
    id: 'doc-3',
    profileId: 'prof-3',
    fullName: 'พญ. สมใจ สายชิล',
    initials: 'SS',
    email: 'somjai@wu.ac.th',
    specialty: 'จิตเวช',
    departmentId: 'dept-psychiatry',
    availability: 'active',
  },
];

const mockSlots: ScheduleSlot[] = [
  {
    id: 'slot-1',
    doctorId: 'doc-1',
    slotDate: '2026-09-08',
    startTime: '09:00',
    endTime: '12:00',
    maxCapacity: 10,
    bookedCount: 2,
    status: 'available',
  },
  {
    id: 'slot-2',
    doctorId: 'doc-2',
    slotDate: '2026-09-08',
    startTime: '13:00',
    endTime: '16:00',
    maxCapacity: 5,
    bookedCount: 0,
    status: 'available',
  },
  {
    id: 'slot-3',
    doctorId: 'doc-3',
    slotDate: '2026-09-08',
    startTime: '09:00',
    endTime: '12:00',
    maxCapacity: 5,
    bookedCount: 0,
    status: 'closed',
  },
];

const shopState = vi.hoisted(() => ({
  departments: [] as ScheduleDepartment[],
  doctors: [] as ScheduleDoctor[],
  slots: [] as ScheduleSlot[],
  isLoading: false,
  saveSlot: vi.fn(),
  toggleSlot: vi.fn(),
}));

vi.mock('@/features/shop/context/ShopProvider', () => ({
  useShop: () => shopState,
}));

describe('ScheduleWorkspace Department Filter', () => {
  beforeEach(() => {
    shopState.departments = [...mockDepartments];
    shopState.doctors = [...mockDoctors];
    shopState.slots = [...mockSlots];
    shopState.isLoading = false;
  });

  it('only shows department options for active departments that have open slots', () => {
    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    // Department select dropdown must be present
    const deptSelect = screen.getByRole('combobox', { name: 'กรองแผนก' });
    expect(deptSelect).toBeInTheDocument();

    // "ทุกแผนก" option must be visible
    expect(screen.getByRole('option', { name: 'ทุกแผนก' })).toBeInTheDocument();

    // "เวชปฏิบัติทั่วไป" (active + has open slot) MUST be displayed in options
    expect(screen.getByRole('option', { name: 'เวชปฏิบัติทั่วไป' })).toBeInTheDocument();

    // "ทันตกรรม" (isActive is FALSE) MUST NOT be in options even though it has an open slot
    expect(screen.queryByRole('option', { name: 'ทันตกรรม' })).not.toBeInTheDocument();

    // "จิตเวช" (all slots are closed) MUST NOT be in options
    expect(screen.queryByRole('option', { name: 'จิตเวช' })).not.toBeInTheDocument();

    // "เภสัชกรรม" (no doctors / no slots) MUST NOT be in options
    expect(screen.queryByRole('option', { name: 'เภสัชกรรม' })).not.toBeInTheDocument();
  });

  it('filters doctor select options when a department is selected', () => {
    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    // Select "เวชปฏิบัติทั่วไป"
    const deptSelect = screen.getByRole('combobox', { name: 'กรองแผนก' });
    fireEvent.change(deptSelect, { target: { value: 'dept-general' } });

    // After filtering by "เวชปฏิบัติทั่วไป", only doc-1 is available under doctor options
    expect(screen.getByRole('option', { name: 'นพ. สมชาย ใจดี' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'พญ. สมใจ สายชิล' })).not.toBeInTheDocument();
  });

  it('only displays "ทุกแผนก" when no department has open slots', () => {
    // Set all slots to closed
    shopState.slots = mockSlots.map((s) => ({ ...s, status: 'closed' as const }));

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    const deptSelect = screen.getByRole('combobox', { name: 'กรองแผนก' });
    expect(deptSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ทุกแผนก' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'เวชปฏิบัติทั่วไป' })).not.toBeInTheDocument();
  });

  it('displays ScheduleSkeleton when shop data is loading', () => {
    shopState.isLoading = true;

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    expect(screen.getByLabelText('กำลังโหลดตารางตรวจแพทย์')).toBeInTheDocument();
  });
});
