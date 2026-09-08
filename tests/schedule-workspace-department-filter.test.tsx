import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleWorkspace from '@/components/schedules/ScheduleWorkspace';
import type { ScheduleDepartment, ScheduleDoctor, ScheduleService, ScheduleSlot } from '@/types/schedule';

const mockDepartments: ScheduleDepartment[] = [
  { id: 'dept-general', name: 'เวชปฏิบัติทั่วไป', description: 'ตรวจโรคทั่วไป', isActive: true },
  { id: 'dept-dental', name: 'ทันตกรรม', description: 'แผนกทันตกรรม', isActive: false },
  { id: 'dept-psychiatry', name: 'จิตเวช', description: 'แผนกจิตเวช', isActive: true },
  { id: 'dept-pharmacy', name: 'เภสัชกรรม', description: 'แผนกเภสัชกรรม', isActive: true },
];

const mockServices: ScheduleService[] = [
  { id: 'service-general', code: 'GEN', name: 'ตรวจโรคทั่วไป', description: 'บริการตรวจโรคทั่วไป', isActive: true },
  { id: 'service-dental', code: 'DEN', name: 'ตรวจสุขภาพช่องปาก', description: 'บริการทันตกรรม', isActive: false },
  { id: 'service-psychiatry', code: 'PSY', name: 'ประเมินสุขภาพจิต', description: 'บริการจิตเวช', isActive: true },
  { id: 'service-pharmacy', code: 'PHA', name: 'ให้คำปรึกษาการใช้ยา', description: 'บริการเภสัชกรรม', isActive: true },
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
    serviceOfferingId: 'offering-1',
    serviceId: 'service-general',
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
    serviceOfferingId: 'offering-2',
    serviceId: 'service-dental',
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
    serviceOfferingId: 'offering-3',
    serviceId: 'service-psychiatry',
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
  services: [] as ScheduleService[],
  dailyServiceOfferings: [],
  doctors: [] as ScheduleDoctor[],
  slots: [] as ScheduleSlot[],
  isLoading: false,
  saveSlot: vi.fn(),
  toggleSlot: vi.fn(),
  saveService: vi.fn(),
  toggleService: vi.fn(),
}));

vi.mock('@/features/shop/context/ShopProvider', () => ({
  useShop: () => shopState,
}));

describe('ScheduleWorkspace Service Filter', () => {
  beforeEach(() => {
    shopState.departments = [...mockDepartments];
    shopState.services = [...mockServices];
    shopState.doctors = [...mockDoctors];
    shopState.slots = [...mockSlots];
    shopState.isLoading = false;
  });

  it('only shows service options for active services that have open slots', () => {
    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    const serviceSelect = screen.getByRole('combobox', { name: 'กรองบริการ' });
    expect(serviceSelect).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'ทุกบริการ' })).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'ตรวจโรคทั่วไป' })).toBeInTheDocument();

    expect(screen.queryByRole('option', { name: 'ตรวจสุขภาพช่องปาก' })).not.toBeInTheDocument();

    expect(screen.queryByRole('option', { name: 'ประเมินสุขภาพจิต' })).not.toBeInTheDocument();

    expect(screen.queryByRole('option', { name: 'ให้คำปรึกษาการใช้ยา' })).not.toBeInTheDocument();
  });

  it('filters doctor select options when a service is selected', () => {
    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    const serviceSelect = screen.getByRole('combobox', { name: 'กรองบริการ' });
    fireEvent.change(serviceSelect, { target: { value: 'service-general' } });

    // After filtering by "เวชปฏิบัติทั่วไป", only doc-1 is available under doctor options
    expect(screen.getByRole('option', { name: 'นพ. สมชาย ใจดี' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'พญ. สมใจ สายชิล' })).not.toBeInTheDocument();
  });

  it('only displays "ทุกบริการ" when no service has open slots', () => {
    // Set all slots to closed
    shopState.slots = mockSlots.map((s) => ({ ...s, status: 'closed' as const }));

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    const serviceSelect = screen.getByRole('combobox', { name: 'กรองบริการ' });
    expect(serviceSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ทุกบริการ' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'ตรวจโรคทั่วไป' })).not.toBeInTheDocument();
  });

  it('displays ScheduleSkeleton when shop data is loading', () => {
    shopState.isLoading = true;

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    expect(screen.getByLabelText('กำลังโหลดตารางตรวจแพทย์')).toBeInTheDocument();
  });

  it('prevents adding slots for past dates in the schedule workspace', () => {
    shopState.isLoading = false;
    shopState.slots = [];

    render(<ScheduleWorkspace role="staff_admin" actorId="admin-1" />);

    // Click global "เพิ่มรอบตรวจ" button
    const addSlotButton = screen.getByRole('button', { name: 'เพิ่มรอบตรวจ' });
    fireEvent.click(addSlotButton);

    // Date input should have min attribute set to today
    const dateInput = screen.getByLabelText('วันที่');
    expect(dateInput).toHaveAttribute('min');
    expect(dateInput.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
