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
});
