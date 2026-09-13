import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bangkokDate, createClinicDatabaseRepository, createClinicMockRepository } from '@/features/clinic-care';
import { appointmentId, fixture, medicationId, patientId, slotId, withAppointment } from './clinic-care-fixtures';

describe('Clinic manual contract', () => {
  it('books once, assigns a queue, and leaves state intact after duplicate failure', async () => {
    const repo = createClinicMockRepository(fixture());
    await repo.book(slotId, 'ทดสอบ');
    const before = await repo.load();
    expect(before.appointments[0]).toMatchObject({ status: 'pending', queue_number: 1 });
    expect(before.slots[0].booked_count).toBe(1);
    await expect(repo.book(slotId, 'ซ้ำ')).rejects.toThrow('มีนัด');
    expect(await repo.load()).toEqual(before);
  });
  it.each(['full', 'closed', 'invalid'] as const)('rejects %s without changing state', async (kind) => {
    const seed = fixture();
    if (kind === 'full') seed.slots[0].booked_count = 1;
    if (kind === 'closed') seed.slots[0].status = 'closed';
    const repo = createClinicMockRepository(seed);
    const before = await repo.load();
    await expect(repo.book(slotId, kind === 'invalid' ? '  ' : 'ทดสอบ')).rejects.toThrow();
    expect(await repo.load()).toEqual(before);
  });
  it('requests cancellation without freeing capacity or changing status', async () => {
    const seed = withAppointment('patient'); seed.appointments[0].status = 'confirmed';
    const repo = createClinicMockRepository(seed);
    await repo.transition(appointmentId, 'request_cancel');
    const data = await repo.load();
    expect(data.appointments[0].status).toBe('confirmed');
    expect(data.appointments[0].cancel_requested_at).toBeTruthy();
    expect(data.slots[0].booked_count).toBe(1);
  });
  it('requires and stores a reason when staff rejects an appointment', async () => {
    const seed = withAppointment('staff_admin'); seed.appointments[0].status = 'pending';
    const repo = createClinicMockRepository(seed);
    await expect(repo.transition(appointmentId, 'rejected')).rejects.toThrow('เหตุผลการปฏิเสธ');
    await repo.transition(appointmentId, 'rejected', 'รอบบริการถูกยกเลิก');
    expect((await repo.load()).appointments[0]).toMatchObject({ status: 'rejected', rejection_reason: 'รอบบริการถูกยกเลิก' });
  });
  it('staff cancels only one selected appointment and preserves closed slot status', async () => {
    const seed = withAppointment('staff_admin'); seed.appointments[0].status = 'confirmed'; seed.slots[0].status = 'closed';
    const repo = createClinicMockRepository(seed);
    await repo.transition(appointmentId, 'cancelled');
    expect((await repo.load()).slots[0]).toMatchObject({ booked_count: 0, status: 'closed' });
  });
  it('cannot complete without a record or modify another doctor appointment', async () => {
    for (const otherDoctor of [false, true]) {
      const seed = withAppointment();
      if (otherDoctor) seed.slots[0].doctor_id = patientId;
      const repo = createClinicMockRepository(seed); const before = await repo.load();
      await expect(repo.transition(appointmentId, 'completed')).rejects.toThrow();
      expect(await repo.load()).toEqual(before);
    }
  });
  it('saves and completes atomically, preserves the pharmacy JSON contract and prevents amendments', async () => {
    const repo = createClinicMockRepository(withAppointment());
    const input = { appointmentId, diagnosis: 'ผลทดสอบ', advice: 'คำแนะนำ', complete: true,
      prescriptions: [{ medication_id: medicationId, name: 'ชื่อปลอม', dosage: 'ทดสอบ', frequency: 'ทดสอบ', duration_days: 1, quantity: 2 }] };
    await repo.saveRecord(input);
    const before = await repo.load();
    expect(before.appointments[0].status).toBe('completed');
    expect(before.records[0].prescribed_medications?.[0]).toMatchObject({ name: 'ยาทดสอบ', quantity: 2 });
    await expect(repo.saveRecord(input)).rejects.toThrow();
    expect(await repo.load()).toEqual(before);
  });
  it('invalid medication does not leave a partial record or completed appointment', async () => {
    const repo = createClinicMockRepository(withAppointment()); const before = await repo.load();
    await expect(repo.saveRecord({ appointmentId, diagnosis: 'ผลทดสอบ', advice: '', complete: true, prescriptions: [
      { medication_id: patientId, name: 'ยา', dosage: 'ทดสอบ', frequency: 'ทดสอบ', duration_days: 1, quantity: 1 },
    ] })).rejects.toThrow();
    expect(await repo.load()).toEqual(before);
  });
  it('uses the Bangkok date across UTC midnight', () => expect(bangkokDate(new Date('2026-09-08T18:00:00Z'))).toBe('2026-09-09'));
});

describe('Clinic database adapter boundary', () => {
  function client(role = 'patient', active = true) {
    const rpc = vi.fn().mockResolvedValue({ data: fixture(), error: null });
    const single = vi.fn().mockResolvedValue({ data: { role, is_active: active }, error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: patientId } }, error: null });
    const fake = { auth: { getUser }, from: vi.fn((table: string) => table === 'departments'
      ? { select: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: [{ name: 'ทั่วไป' }], error: null }) }) }) }
      : { select: () => ({ eq: () => ({ single }) }) }), rpc };
    return { fake: fake as unknown as SupabaseClient, rpc, getUser };
  }
  it('loads a schema-checked snapshot from RPC with verified session', async () => {
    const c = client(); await expect(createClinicDatabaseRepository(c.fake, 'patient').load()).resolves.toEqual(fixture());
    expect(c.getUser).toHaveBeenCalled(); expect(c.rpc).toHaveBeenCalledWith('pai_workspace', undefined);
  });
  it.each(['medical', 'staff_admin'] as const)('loads only appointment patient phones for %s', async (role) => {
    const seed = withAppointment(role);
    const inIds = vi.fn().mockResolvedValue({ data: [{ id: patientId, phone: '0800000000' }], error: null });
    const fake = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: seed.actor.id } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: seed, error: null }),
      from: vi.fn((table: string) => table === 'departments'
        ? { select: () => ({ eq: () => ({ order: vi.fn().mockResolvedValue({ data: [{ name: 'ทั่วไป' }], error: null }) }) }) }
        : { select: () => ({
          eq: () => ({ single: vi.fn().mockResolvedValue({ data: { role, is_active: true }, error: null }) }),
          in: inIds,
        }) }),
    };
    const repo = createClinicDatabaseRepository(fake as unknown as SupabaseClient, role);
    expect((await repo.load()).appointments[0].patient_phone).toBe('0800000000');
    expect(inIds).toHaveBeenCalledWith('id', [patientId]);
    inIds.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await expect(repo.load()).rejects.toThrow('ไม่สามารถโหลดเบอร์โทร');
  });
  it.each([['medical', true], ['patient', false], ['unknown', true]])('rejects mismatched/inactive/unknown role %s %s before RPC', async (role, active) => {
    const c = client(String(role), Boolean(active));
    await expect(createClinicDatabaseRepository(c.fake, 'patient').book(slotId, 'ทดสอบ')).rejects.toThrow('ไม่มีสิทธิ์');
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('does not accept UI role claims or send patient identity as a booking argument', async () => {
    const c = client(); const repo = createClinicDatabaseRepository(c.fake, 'patient');
    await expect(repo.transition(appointmentId, 'confirmed')).rejects.toThrow();
    expect(c.rpc).not.toHaveBeenCalled();
    await repo.book(slotId, ' ทดสอบ ');
    expect(c.rpc).toHaveBeenCalledWith('pai_book_appointment', { p_slot_id: slotId, p_reason: 'ทดสอบ' });
  });
  it('does not fall back to mock when the migration is missing', async () => {
    const c = client(); c.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(createClinicDatabaseRepository(c.fake, 'patient').load()).rejects.toThrow('ติดตั้ง');
  });
});
