import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseShopRepository } from '@/features/shop/data/databaseRepository';

describe('DatabaseShopRepository', () => {
  it('maps database department rows to ScheduleDepartment domain models', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'dept-1',
              name: 'แผนกอายุรกรรม',
              description: 'ตรวจรักษาโรคทั่วไป',
              is_active: true,
              created_at: '2026-09-08T00:00:00Z',
              updated_at: '2026-09-08T00:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);
    const departments = await repo.fetchDepartments();

    expect(departments.length).toBe(1);
    expect(departments[0]).toMatchObject({
      id: 'dept-1',
      name: 'แผนกอายุรกรรม',
      description: 'ตรวจรักษาโรคทั่วไป',
      isActive: true,
    });
  });

  it('maps database doctor rows with joined profile to ScheduleDoctor domain models', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'doc-1',
              specialty: 'อายุรศาสตร์',
              department_id: 'dept-1',
              profile: {
                id: 'doc-1',
                full_name: 'นพ. สมชาย ใจดี',
                role: 'medical',
                is_active: true,
              },
            },
          ],
          error: null,
        }),
      }),
    });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);
    const doctors = await repo.fetchDoctors();

    expect(doctors.length).toBe(1);
    expect(doctors[0]).toMatchObject({
      id: 'doc-1',
      fullName: 'นพ. สมชาย ใจดี',
      specialty: 'อายุรศาสตร์',
      departmentId: 'dept-1',
      availability: 'active',
    });
  });

  it('handles doctor rows with null profile gracefully without fallback initials becoming "ไ"', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'doc-2',
              specialty: 'เวชปฏิบัติทั่วไป',
              department_id: 'dept-2',
              profile: null,
            },
          ],
          error: null,
        }),
      }),
    });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);
    const doctors = await repo.fetchDoctors();

    expect(doctors.length).toBe(1);
    expect(doctors[0]).toMatchObject({
      id: 'doc-2',
      fullName: 'ไม่ระบุชื่อ',
      initials: 'DR',
      specialty: 'เวชปฏิบัติทั่วไป',
      departmentId: 'dept-2',
      availability: 'active',
    });
  });

  it('validates department input before querying database', async () => {
    const mockClient = { from: vi.fn() } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    // ชื่อว่างเปล่า ต้องคืน error ทันทีโดยไม่ยิง Supabase
    const emptyResult = await repo.saveDepartment({ name: '', description: '' }, []);
    expect(emptyResult.ok).toBe(false);
    expect(emptyResult).toMatchObject({ ok: false, field: 'name' });
    expect(mockClient.from).not.toHaveBeenCalled();

    // ชื่อซ้ำ
    const dupResult = await repo.saveDepartment(
      { name: 'อายุรกรรม', description: '' },
      [{ id: 'd1', name: 'อายุรกรรม', description: '', isActive: true }]
    );
    expect(dupResult.ok).toBe(false);
    expect(dupResult).toMatchObject({ ok: false, field: 'name' });
  });

  it('validates doctor input before inserting into doctors table', async () => {
    const mockClient = { from: vi.fn() } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    const invalidResult = await repo.saveDoctor(
      {
        profileId: '',
        fullName: 'หมอทดสอบ',
        email: '',
        initials: 'MD',
        specialty: '',
        departmentId: '',
        availability: 'active',
      },
      []
    );

    expect(invalidResult.ok).toBe(false);
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('toggles department is_active status correctly', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'dept-1', is_active: false }],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    // ปิดใช้งานแผนกเดิมที่เปิดอยู่ (currentActive: true -> nextState: false)
    const result = await repo.toggleDepartment('dept-1', true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe('disabled');
    expect(mockFrom).toHaveBeenCalledWith('departments');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'dept-1');

    // กรณีไม่มีแถวถูกอัปเดต (เช่น RLS บล็อก หรือไม่พบ id)
    mockSelect.mockResolvedValueOnce({ data: [], error: null });
    const failResult = await repo.toggleDepartment('dept-nonexistent', true);
    expect(failResult.ok).toBe(false);
    expect(failResult.error).toContain('ไม่พบข้อมูลแผนก');
  });

  it('toggles doctor availability via profiles table', async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'doc-1', is_active: false }],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    // ปิดใช้งานแพทย์ (active -> nextIsActive: false)
    const result = await repo.toggleDoctor('doc-1', 'active');
    expect(result.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'doc-1');
  });

  it('maps database appointment_slots rows to ScheduleSlot domain models', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'slot-1',
                doctor_id: 'doc-1',
                daily_service_offering_id: 'offering-1',
                daily_service_offering: { service_id: 'service-1' },
                slot_date: '2026-09-08',
                start_time: '09:00:00',
                end_time: '12:00:00',
                max_capacity: 10,
                booked_count: 3,
                status: 'available',
                created_at: '2026-09-08T00:00:00Z',
                updated_at: '2026-09-08T00:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);
    const slots = await repo.fetchSlots();

    expect(slots.length).toBe(1);
    expect(slots[0]).toMatchObject({
      id: 'slot-1',
      doctorId: 'doc-1',
      serviceOfferingId: 'offering-1',
      serviceId: 'service-1',
      slotDate: '2026-09-08',
      startTime: '09:00',
      endTime: '12:00',
      maxCapacity: 10,
      bookedCount: 3,
      status: 'available',
      hasHistory: true,
    });
  });

  it('validates slot before inserting into database', async () => {
    const mockClient = { from: vi.fn() } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    const validDoctorId = 'a0000000-0000-0000-0000-000000000001';

    // Rejects non-UUID doctor ID
    const mockDocResult = await repo.saveSlot(
      {
        doctorId: 'profile-stephen-strange',
        serviceId: 'service-1',
        slotDate: '2026-09-08',
        startTime: '09:00',
        endTime: '09:30',
        maxCapacity: 5,
      },
      [],
      [],
      [],
    );
    expect(mockDocResult.ok).toBe(false);
    expect(mockDocResult.error).toContain('ไอดีแพทย์ไม่ถูกต้อง');

    // Invalid time: end before start
    const result = await repo.saveSlot(
      {
        doctorId: validDoctorId,
        serviceId: 'service-1',
        slotDate: '2026-09-08',
        startTime: '12:00',
        endTime: '09:00',
        maxCapacity: 5,
      },
      [],
      [{ id: validDoctorId, profileId: validDoctorId, fullName: 'หมอสมชาย', email: '', initials: 'SC', specialty: 'ทั่วไป', departmentId: 'dept-1', availability: 'active' }],
      [{ id: 'service-1', code: 'GEN', name: 'ตรวจโรคทั่วไป', description: '', isActive: true }],
    );

    expect(result.ok).toBe(false);
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('inserts valid slot into appointment_slots table', async () => {
    const validDoctorId = 'a0000000-0000-0000-0000-000000000001';
    const mockSlotSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'new-slot-1',
        doctor_id: validDoctorId,
        daily_service_offering_id: 'offering-1',
        slot_date: '2026-09-08',
        start_time: '09:00:00',
        end_time: '12:00:00',
        max_capacity: 5,
        booked_count: 0,
        status: 'available',
      },
      error: null,
    });
    const mockSlotSelect = vi.fn().mockReturnValue({ single: mockSlotSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSlotSelect });
    const mockOfferingSingle = vi.fn().mockResolvedValue({
      data: { id: 'offering-1', service_id: 'service-1', doctor_id: validDoctorId, offering_date: '2026-09-08', is_active: true, created_by: null },
      error: null,
    });
    const mockOfferingSelect = vi.fn().mockReturnValue({ single: mockOfferingSingle });
    const mockOfferingUpsert = vi.fn().mockReturnValue({ select: mockOfferingSelect });
    const mockFrom = vi.fn((table: string) => table === 'daily_service_offerings'
      ? { upsert: mockOfferingUpsert }
      : { insert: mockInsert });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    const result = await repo.saveSlot(
      {
        doctorId: validDoctorId,
        serviceId: 'service-1',
        slotDate: '2026-09-08',
        startTime: '09:00',
        endTime: '12:00',
        maxCapacity: 5,
      },
      [],
      [{ id: validDoctorId, profileId: validDoctorId, fullName: 'หมอสมชาย', email: '', initials: 'SC', specialty: 'ทั่วไป', departmentId: 'dept-1', availability: 'active' }],
      [{ id: 'service-1', code: 'GEN', name: 'ตรวจโรคทั่วไป', description: '', isActive: true }],
      undefined,
      '2026-09-07',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('new-slot-1');
      expect(result.value.startTime).toBe('09:00');
    }
    expect(mockFrom).toHaveBeenCalledWith('appointment_slots');
  });

  it('rejects saving a slot for a past date', async () => {
    const mockClient = {} as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);
    const validDoctorId = 'a0000000-0000-0000-0000-000000000001';
    const result = await repo.saveSlot(
      {
        doctorId: validDoctorId,
        serviceId: 'service-1',
        slotDate: '2026-09-04',
        startTime: '09:00',
        endTime: '09:30',
        maxCapacity: 1,
      },
      [],
      [{ id: validDoctorId, profileId: validDoctorId, fullName: 'หมอสมชาย', email: '', initials: 'SC', specialty: 'ทั่วไป', departmentId: 'dept-1', availability: 'active' }],
      [{ id: 'service-1', code: 'GEN', name: 'ตรวจโรคทั่วไป', description: '', isActive: true }],
      undefined,
      '2026-09-07',
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'ไม่สามารถเพิ่มรอบตรวจของวันในอดีตได้',
      field: 'slotDate',
    });
  });

  it('toggles slot status to closed in appointment_slots', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'slot-1',
        doctor_id: 'doc-1',
        slot_date: '2026-09-08',
        start_time: '09:00:00',
        end_time: '12:00:00',
        max_capacity: 5,
        booked_count: 0,
        status: 'closed',
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    const mockClient = { from: mockFrom } as unknown as SupabaseClient;
    const repo = new DatabaseShopRepository(mockClient);

    const currentSlot = {
      id: 'slot-1',
      doctorId: 'doc-1',
      slotDate: '2026-09-08',
      startTime: '09:00',
      endTime: '12:00',
      maxCapacity: 5,
      bookedCount: 0,
      status: 'available' as const,
      hasHistory: false,
    };

    const result = await repo.toggleSlot('slot-1', currentSlot, 'admin-1', 'staff_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('closed');
    }
    expect(mockFrom).toHaveBeenCalledWith('appointment_slots');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed' }),
    );
  });
});
