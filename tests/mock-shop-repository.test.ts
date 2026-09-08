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
      serviceId: 'service-general',
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
    expect(repository.saveSlot({ doctorId: 'profile-stephen-strange', serviceId: 'service-general', slotDate: '2026-09-07', startTime: '09:30', endTime: '10:00', maxCapacity: 1 }, 'missing')).toMatchObject({ ok: false });
    expect(repository.snapshot()).toEqual(before);
  });

  it('rejects adding a slot for a past date', () => {
    const repository = new MockShopRepository();
    const before = repository.snapshot();
    const serviceId = before.services[0].id;
    const result = repository.saveSlot(
      {
        doctorId: 'profile-stephen-strange',
        serviceId,
        slotDate: '2026-09-04',
        startTime: '09:00',
        endTime: '09:30',
        maxCapacity: 1,
      },
      undefined,
      '2026-09-07',
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'ไม่สามารถเพิ่มรอบตรวจของวันในอดีตได้',
      field: 'slotDate',
    });
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

  it('prevents medical role from closing or modifying slots of another doctor', () => {
    const repository = new MockShopRepository();
    const doctors = repository.snapshot().doctors;
    expect(doctors.length).toBeGreaterThanOrEqual(2);
    const doctor1 = doctors[0];
    const doctor2 = doctors[1];

    // หา slot ของ doctor2
    const slotDoctor2 = repository.snapshot().slots.find((s) => s.doctorId === doctor2.id);
    expect(slotDoctor2).toBeDefined();
    if (!slotDoctor2) return;

    // doctor1 (medical) พยายาม toggle slot ของ doctor2 -> ต้องถูกปฏิเสธ
    const failResult = repository.toggleSlot(slotDoctor2.id, doctor1.profileId, 'medical');
    expect(failResult).toMatchObject({
      ok: false,
      error: 'ไม่มีสิทธิ์จัดการรอบตรวจของแพทย์ท่านอื่น',
    });

    // staff_admin สามารถ toggle slot ของ doctor2 ได้
    const adminResult = repository.toggleSlot(slotDoctor2.id, 'admin-id', 'staff_admin');
    expect(adminResult.ok).toBe(true);
  });

  it('allows medical role to toggle their own slot', () => {
    const repository = new MockShopRepository();
    const doctor = repository.snapshot().doctors[0];
    const ownSlot = repository.snapshot().slots.find((s) => s.doctorId === doctor.id);
    expect(ownSlot).toBeDefined();
    if (!ownSlot) return;

    const result = repository.toggleSlot(ownSlot.id, doctor.profileId, 'medical');
    expect(result.ok).toBe(true);
  });

  it('does not return recommendations when doctor has no prior history', () => {
    const repository = new MockShopRepository();
    const doctor = repository.snapshot().doctors[0];

    // ตอนเริ่มต้นหมอยังไม่มีประวัติ
    const templates = repository.getDoctorTemplates(doctor.id);
    expect(templates).toEqual([]);
  });

  it('records doctor availability templates and increments usage count for repeated patterns', () => {
    const repository = new MockShopRepository();
    const doctor = repository.snapshot().doctors[0];

    // บันทึกครั้งที่ 1
    const res1 = repository.saveDoctorTemplate({
      doctorId: doctor.id,
      startTime: '08:30',
      endTime: '12:00',
      defaultCapacity: 10,
    });
    expect(res1.ok).toBe(true);

    const history1 = repository.getDoctorTemplates(doctor.id);
    expect(history1.length).toBe(1);
    expect(history1[0].usageCount).toBe(1);

    // บันทึกซ้ำ pattern เดิม
    const res2 = repository.saveDoctorTemplate({
      doctorId: doctor.id,
      startTime: '08:30',
      endTime: '12:00',
      defaultCapacity: 10,
    });
    expect(res2.ok).toBe(true);

    const history2 = repository.getDoctorTemplates(doctor.id);
    expect(history2.length).toBe(1);
    expect(history2[0].usageCount).toBe(2);

    // บันทึกอีก pattern หนึ่ง
    repository.saveDoctorTemplate({
      doctorId: doctor.id,
      startTime: '13:00',
      endTime: '16:00',
      defaultCapacity: 8,
    });

    const history3 = repository.getDoctorTemplates(doctor.id);
    expect(history3.length).toBe(2);
    // ตรวจสอบว่า pattern ที่ใช้บ่อยกว่าอยู่ลำดับแรก
    expect(history3[0].usageCount).toBe(2);
    expect(history3[1].usageCount).toBe(1);
  });
});
