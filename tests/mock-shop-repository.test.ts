import { describe, expect, it } from 'vitest';
import { MockShopRepository } from '@/features/shop/data/mockRepository';

describe('MockShopRepository', () => {
  it('soft deletes referenced departments and hard deletes new ones', () => {
    const repository = new MockShopRepository();
    const referenced = repository.toggleDepartment('dept-general');
    expect(referenced).toEqual({ ok: true, value: 'disabled' });
    expect(repository.snapshot().departments.find((item) => item.id === 'dept-general')?.isActive).toBe(false);

    const created = repository.saveDepartment({
      name: 'คลินิกทดสอบ',
      code: 'TST',
      description: 'ข้อมูลจำลอง',
      room: 'ห้อง 1',
      tone: 'sky',
      hasHistory: false,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(repository.toggleDepartment(created.value.id)).toEqual({ ok: true, value: 'deleted' });
    expect(repository.snapshot().departments.some((item) => item.id === created.value.id)).toBe(false);
  });

  it('does not mutate state when slot validation fails', () => {
    const repository = new MockShopRepository();
    const before = repository.snapshot();
    const result = repository.saveSlot({
      doctorId: 'profile-stephen-strange',
      slotDate: '2026-09-07',
      startTime: '09:15',
      endTime: '09:45',
      maxCapacity: 1,
    });
    expect(result.ok).toBe(false);
    expect(repository.snapshot()).toEqual(before);
  });

  it('exposes the shared mock account catalog and rejects duplicate doctor bindings', () => {
    const repository = new MockShopRepository();
    expect(repository.snapshot().doctorAccounts.length).toBeGreaterThan(0);
    const before = repository.snapshot();
    const result = repository.saveDoctor({
      profileId: before.doctors[0].profileId,
      fullName: 'แพทย์ซ้ำ',
      initials: 'ซ้ำ',
      email: 'duplicate@clinic-demo.test',
      specialty: 'ทดสอบ',
      departmentId: before.doctors[0].departmentId,
      availability: 'active',
    });
    expect(result).toMatchObject({ ok: false, field: 'profileId' });
    expect(repository.snapshot()).toEqual(before);
  });

  it('rejects edits for unknown IDs without creating records', () => {
    const repository = new MockShopRepository();
    const before = repository.snapshot();
    expect(repository.saveDepartment({ name: 'ใหม่', code: 'NEW', description: '', room: '', tone: 'sky' }, 'missing')).toMatchObject({ ok: false });
    expect(repository.saveDoctor({
      profileId: 'profile-gregory-house', fullName: 'Gregory House', initials: 'GH', email: 'gh@test', specialty: 'ทดสอบ', departmentId: 'dept-general', availability: 'active',
    }, 'missing')).toMatchObject({ ok: false });
    expect(repository.saveSlot({ doctorId: 'profile-stephen-strange', slotDate: '2026-09-07', startTime: '09:30', endTime: '10:00', maxCapacity: 1 }, 'missing')).toMatchObject({ ok: false });
    expect(repository.snapshot()).toEqual(before);
  });

  it('closes a slot without changing its booked count', () => {
    const repository = new MockShopRepository();
    const slot = repository.snapshot().slots.find((item) => item.bookedCount > 0);
    expect(slot).toBeDefined();
    if (!slot) return;
    expect(repository.toggleSlot(slot.id)).toMatchObject({ ok: true, value: { status: 'closed', bookedCount: slot.bookedCount } });
  });

  it('hard deletes a new doctor until a slot references it', () => {
    const repository = new MockShopRepository();
    const result = repository.saveDoctor({
      profileId: 'profile-gregory-house', fullName: 'Gregory House', initials: 'GH', email: 'gh@test', specialty: 'วินิจฉัย', departmentId: 'dept-general', availability: 'active',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(repository.toggleDoctor(result.value.id)).toEqual({ ok: true, value: 'deleted' });
    expect(repository.snapshot().doctors.some((doctor) => doctor.id === result.value.id)).toBe(false);
  });

  it('generates recurring slots for date range', () => {
    const repository = new MockShopRepository();
    const generated = repository.generateSlotsForRange('2026-09-07', '2026-09-07', '2026-09-07');
    expect(generated).toMatchObject({ ok: true });
    const slots = repository.snapshot().slots.filter((slot) => slot.slotDate === '2026-09-07');
    expect(slots.length).toBeGreaterThan(0);
  });

  it('does not allow overlapping weekly schedules', () => {
    const repository = new MockShopRepository();
    const schedule = repository.snapshot().weeklySchedules.find((item) => item.doctorId === 'profile-stephen-strange' && item.weekday === 1);
    expect(schedule).toBeDefined();
    if (!schedule) return;
    const scheduleInput = { doctorId: schedule.doctorId, weekday: schedule.weekday, slotDurationMinutes: schedule.slotDurationMinutes, defaultCapacity: schedule.defaultCapacity, isActive: schedule.isActive, startTime: schedule.startTime, endTime: schedule.endTime };
    expect(repository.saveWeeklySchedule({ ...scheduleInput, startTime: '09:00', endTime: '10:00' })).toMatchObject({ ok: false });
  });
  it('requires an active doctor and department before saving recurring schedule', () => {
    const repository = new MockShopRepository();
    const doctor = repository.snapshot().doctors[0];
    expect(doctor).toBeDefined();
    if (!doctor) return;
    expect(repository.toggleDoctor(doctor.id)).toMatchObject({ ok: true });
    expect(repository.saveWeeklySchedule({ doctorId: doctor.id, weekday: 1, startTime: '08:30', endTime: '09:00', slotDurationMinutes: 30, defaultCapacity: 1, isActive: true })).toMatchObject({ ok: false, field: 'doctorId' });
  });
});
