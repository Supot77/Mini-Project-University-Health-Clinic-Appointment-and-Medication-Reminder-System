import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleWorkspace, { getNextAvailableTimeSlot } from '@/components/schedules/ScheduleWorkspace';
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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
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

    // After filtering by "ตรวจโรคทั่วไป", only doc-1 is available under doctor options
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

  it('getNextAvailableTimeSlot calculates adjacent time and skips lunch break', () => {
    // Case 1: no slots
    expect(getNextAvailableTimeSlot([], 'doc-1', '2026-09-08')).toEqual({
      startTime: '08:30',
      endTime: '09:00',
    });

    // Case 2: slot ending at 09:30
    const slotA: ScheduleSlot = {
      id: 'slot-a',
      doctorId: 'doc-1',
      serviceOfferingId: 'offering-1',
      serviceId: 'service-general',
      slotDate: '2026-09-08',
      startTime: '09:00',
      endTime: '09:30',
      maxCapacity: 5,
      bookedCount: 0,
      status: 'available',
    };
    expect(getNextAvailableTimeSlot([slotA], 'doc-1', '2026-09-08')).toEqual({
      startTime: '09:30',
      endTime: '10:00',
    });

    // Case 3: slot ending at 12:00 (lunch break 12:00–13:00) -> jumps to 13:00–13:30
    const slotLunch: ScheduleSlot = {
      id: 'slot-lunch',
      doctorId: 'doc-1',
      serviceOfferingId: 'offering-1',
      serviceId: 'service-general',
      slotDate: '2026-09-08',
      startTime: '11:30',
      endTime: '12:00',
      maxCapacity: 5,
      bookedCount: 0,
      status: 'available',
    };
    expect(getNextAvailableTimeSlot([slotLunch], 'doc-1', '2026-09-08')).toEqual({
      startTime: '13:00',
      endTime: '13:30',
    });
  });

  it('auto-fills next available time when doctor already has slots on the same day', () => {
    shopState.isLoading = false;
    shopState.slots = [
      {
        id: 'slot-existing',
        doctorId: 'doc-1',
        serviceOfferingId: 'offering-1',
        serviceId: 'service-general',
        slotDate: '2026-09-08',
        startTime: '08:30',
        endTime: '09:00',
        maxCapacity: 5,
        bookedCount: 0,
        status: 'available',
      },
    ];

    render(<ScheduleWorkspace role="staff_admin" actorId="admin-1" />);

    // Click global "เพิ่มรอบตรวจ" button
    const addSlotButton = screen.getByRole('button', { name: 'เพิ่มรอบตรวจ' });
    fireEvent.click(addSlotButton);

    // Select doctor doc-1
    const doctorSelect = screen.getByRole('combobox', { name: 'แพทย์' });
    fireEvent.change(doctorSelect, { target: { value: 'doc-1' } });

    // Ensure slotDate is 2026-09-08
    const dateInput = screen.getByLabelText('วันที่');
    fireEvent.change(dateInput, { target: { value: '2026-09-08' } });

    // Time should be auto-filled to 09:00 - 09:30
    const startTimeInput = screen.getByLabelText('เวลาเริ่ม');
    const endTimeInput = screen.getByLabelText('เวลาสิ้นสุด');
    expect(startTimeInput).toHaveValue('09:00');
    expect(endTimeInput).toHaveValue('09:30');
  });

  it('double-clicks a week day into day view and exposes booking for an available future slot', () => {
    shopState.slots = [
      ...mockSlots,
      { ...mockSlots[0], id: 'slot-future', slotDate: '2026-09-10', bookedCount: 0, status: 'available' },
    ];

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    fireEvent.doubleClick(screen.getAllByTitle(/ดับเบิ้ลคลิกเพื่อดูตารางตรวจวันที่.*10 ก\.ย\./)[0]);

    expect(screen.getByLabelText('ปฏิทินรายวัน')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'จอง' })).toHaveAttribute('href', '/appointments?slotId=slot-future');
  });

  it('does not expose booking for a full or closed slot in day view', () => {
    shopState.slots = [
      { ...mockSlots[0], id: 'slot-full', slotDate: '2026-09-10', bookedCount: mockSlots[0].maxCapacity, status: 'full' },
      { ...mockSlots[0], id: 'slot-closed', slotDate: '2026-09-10', bookedCount: 0, status: 'closed' },
    ];

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    fireEvent.doubleClick(screen.getAllByTitle(/ดับเบิ้ลคลิกเพื่อดูตารางตรวจวันที่.*10 ก\.ย\./)[0]);

    expect(screen.getByLabelText('ปฏิทินรายวัน')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'จอง' })).not.toBeInTheDocument();
  });

  it('displays "ปิดรอบ" badge on timetable when slot is full or past start time', () => {
    shopState.slots = [
      { ...mockSlots[0], id: 'slot-past', slotDate: '2026-09-08', startTime: '09:00', bookedCount: 0, status: 'available' },
      { ...mockSlots[0], id: 'slot-full', slotDate: '2026-09-10', startTime: '10:00', bookedCount: 5, maxCapacity: 5, status: 'available' },
    ];

    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    fireEvent.change(screen.getByLabelText('กรองสถานะ'), { target: { value: 'closed' } });
    const entries = screen.getAllByRole('article').filter((entry) => entry.querySelector('h3'));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    entries.forEach((entry) => expect(within(entry).getByText('ปิดรอบ')).toBeInTheDocument());
  });

  it('defaults status filter to available (เปิดรับ)', () => {
    render(<ScheduleWorkspace role="patient" actorId="guest" />);
    const statusSelect = screen.getByLabelText('กรองสถานะ');
    expect(statusSelect).toHaveValue('available');
  });

  it('opens day view from the visible day action and preserves patient booking', () => {
    shopState.slots = [{ ...mockSlots[0], slotDate: '2026-09-10' }];
    render(<ScheduleWorkspace role="patient" actorId="guest" />);

    expect(screen.queryByRole('button', { name: 'เพิ่มรอบตรวจ' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'ดูรายวัน 10 ก.ย.' })[0]);

    expect(screen.getByLabelText('มุมมองปฏิทิน')).toHaveValue('day');
    expect(screen.getByRole('link', { name: 'จอง' })).toHaveAttribute('href', '/appointments?slotId=slot-1');
  });

  it('opens day view using the date header keyboard action', () => {
    render(<ScheduleWorkspace role="patient" actorId="guest" />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'เปิดตารางตรวจวันที่ 10 ก.ย.' }), { key: 'Enter' });
    expect(screen.getByLabelText('ปฏิทินรายวัน')).toBeInTheDocument();
    expect(screen.getByText('ไม่พบรอบตรวจตามตัวกรอง ลองเปลี่ยนวันหรือสถานะ')).toBeInTheDocument();
  });

  it('retains the doctor scope and excludes edit actions for another doctor', () => {
    shopState.slots = [
      { ...mockSlots[0], slotDate: '2026-09-10' },
      { ...mockSlots[0], id: 'other-slot', doctorId: 'doc-3', slotDate: '2026-09-10', startTime: '13:00', endTime: '14:00' },
    ];
    render(<ScheduleWorkspace role="medical" actorId="prof-1" />);
    expect(screen.getByRole('button', { name: 'ตารางของฉัน' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'ภาพรวมคลินิก' }));
    expect(screen.getByRole('button', { name: 'ภาพรวมคลินิก' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: 'แก้ไขรอบ 09:00' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'แก้ไขรอบ 13:00' })).not.toBeInTheDocument();
  });

  it('keeps the creation form and draft visible when saving fails', async () => {
    shopState.slots = [];
    shopState.saveSlot.mockResolvedValueOnce({ ok: false, error: 'เวลารอบตรวจทับกัน' });
    render(<ScheduleWorkspace role="staff_admin" actorId="admin-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรอบตรวจ' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'แพทย์' }), { target: { value: 'doc-1' } });
    fireEvent.change(screen.getByLabelText('วันที่'), { target: { value: '2026-09-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกรอบตรวจ' }));

    expect(await screen.findByText('เวลารอบตรวจทับกัน')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('วันที่')).toHaveValue('2026-09-10');
    expect(shopState.slots).toEqual([]);
  });
});
