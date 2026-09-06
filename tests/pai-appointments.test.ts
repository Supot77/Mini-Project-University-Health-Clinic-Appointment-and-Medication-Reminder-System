import { describe, expect, it } from 'vitest';
import { createAppointmentPreviewRepository } from '@/features/pai/appointments/mockRepository';
import { DEMO_PATIENT_ID, remainingSeats, type AppointmentSnapshot } from '@/features/pai/appointments/repository';

function seats(snapshot: AppointmentSnapshot, slotId: string) {
  const slot = snapshot.slots.find((item) => item.id === slotId);
  if (!slot) throw new Error(`Missing fixture slot ${slotId}`);
  return remainingSeats(slot, snapshot.appointments);
}

describe('appointment preview repository', () => {
  it('books the first and last allowed dates as pending and reserves a seat immediately', () => {
    const repository = createAppointmentPreviewRepository();

    for (const slotId of ['2026-09-08-1-09:00', '2026-09-21-1-09:00']) {
      const before = repository.snapshot();
      expect(repository.book(slotId, '  ปรึกษาอาการทั่วไป  ').ok).toBe(true);
      const after = repository.snapshot();

      expect(after.appointments).toHaveLength(before.appointments.length + 1);
      expect(after.appointments.at(-1)).toMatchObject({
        patientId: DEMO_PATIENT_ID, slotId, reason: 'ปรึกษาอาการทั่วไป', status: 'pending',
      });
      expect(seats(after, slotId)).toBe(seats(before, slotId) - 1);
    }
  });

  it('rejects duplicate bookings and cross-department overlaps with appointments or proposals without mutation', () => {
    const repository = createAppointmentPreviewRepository();
    expect(repository.book('2026-09-08-1-09:00', 'นัดใหม่').ok).toBe(true);

    for (const slotId of ['2026-09-08-1-09:00', '2026-09-08-2-09:00', '2026-09-11-3-09:00']) {
      const before = repository.snapshot();
      expect(repository.book(slotId, 'เวลาทับ')).toMatchObject({ ok: false, error: expect.stringContaining('ช่วงเวลา') });
      expect(repository.snapshot()).toEqual(before);
    }
  });

  it('rejects closed, full, same-day, out-of-range and missing slots without changing appointments or capacity', () => {
    const seed = createAppointmentPreviewRepository().snapshot();
    seed.slots.push({ ...seed.slots[0], id: 'too-late', date: '2026-09-22' });
    const repository = createAppointmentPreviewRepository(seed);

    for (const slotId of ['2026-09-08-2-10:00', '2026-09-08-1-09:30', '2026-09-07-3-10:00', 'too-late', 'missing']) {
      const before = repository.snapshot();
      expect(repository.book(slotId, 'ตรวจตามนัด').ok).toBe(false);
      expect(repository.snapshot()).toEqual(before);
    }
  });

  it('enforces the two-hour cancellation limit and returns capacity only once', () => {
    const repository = createAppointmentPreviewRepository();
    const beforeLateCancellation = repository.snapshot();
    expect(repository.cancel('APT-001')).toMatchObject({ ok: false, error: expect.stringContaining('2 ชั่วโมง') });
    expect(repository.snapshot()).toEqual(beforeLateCancellation);

    const slotId = '2026-09-09-2-09:00';
    expect(repository.cancel('APT-005').ok).toBe(true);
    const cancelled = repository.snapshot();
    expect(cancelled.appointments.find((item) => item.id === 'APT-005')?.status).toBe('cancelled');
    expect(seats(cancelled, slotId)).toBe(seats(beforeLateCancellation, slotId) + 1);
    expect(repository.cancel('APT-005').ok).toBe(false);
    expect(repository.snapshot()).toEqual(cancelled);
  });

  it('keeps an offered move pending with a reserved seat until the patient accepts', () => {
    const repository = createAppointmentPreviewRepository();
    const slotId = '2026-09-14-2-09:00';
    const before = repository.snapshot();
    const original = before.appointments.find((item) => item.id === 'APT-005');

    expect(repository.propose('APT-005', slotId, 'แพทย์งดตรวจ').ok).toBe(true);
    const offered = repository.snapshot();
    expect(offered.appointments.find((item) => item.id === 'APT-005')).toMatchObject({
      slotId: original?.slotId, status: 'pending', proposal: { slotId, reason: 'แพทย์งดตรวจ' },
    });
    expect(seats(offered, slotId)).toBe(seats(before, slotId) - 1);

    expect(repository.acceptProposal('APT-005').ok).toBe(true);
    const accepted = repository.snapshot();
    expect(accepted.appointments.find((item) => item.id === 'APT-005')).toMatchObject({ slotId, status: 'confirmed' });
    expect(accepted.appointments.find((item) => item.id === 'APT-005')).not.toHaveProperty('proposal');
    expect(seats(accepted, slotId)).toBe(seats(offered, slotId));
  });

  it('preserves an offer after an invalid alternate, then transfers its reservation on a valid alternate', () => {
    const repository = createAppointmentPreviewRepository();
    const before = repository.snapshot();

    expect(repository.acceptProposal('APT-006', '2026-09-14-1-09:30').ok).toBe(false);
    expect(repository.snapshot()).toEqual(before);
    expect(repository.acceptProposal('APT-006', '2026-09-14-1-09:00').ok).toBe(true);
    const after = repository.snapshot();
    expect(after.appointments.find((item) => item.id === 'APT-006')).toMatchObject({ slotId: '2026-09-14-1-09:00', status: 'confirmed' });
    expect(after.appointments.find((item) => item.id === 'APT-006')).not.toHaveProperty('proposal');
    expect(seats(after, '2026-09-11-1-09:00')).toBe(seats(before, '2026-09-11-1-09:00') + 1);
    expect(seats(after, '2026-09-14-1-09:00')).toBe(seats(before, '2026-09-14-1-09:00') - 1);
  });

  it('allows staff approval while restricting patients and doctors to permitted transitions and appointments', () => {
    const repository = createAppointmentPreviewRepository();
    const before = repository.snapshot();

    expect(repository.changeStatus('APT-002', 'confirmed', 'doctor').ok).toBe(false);
    expect(repository.changeStatus('APT-002', 'confirmed', 'patient').ok).toBe(false);
    expect(repository.changeStatus('APT-004', 'in_progress', 'doctor').ok).toBe(false);
    expect(repository.changeStatus('APT-002', 'no_show', 'staff').ok).toBe(false);
    expect(repository.snapshot()).toEqual(before);

    expect(repository.changeStatus('APT-002', 'confirmed', 'staff').ok).toBe(true);
    expect(repository.changeStatus('APT-001', 'in_progress', 'doctor').ok).toBe(true);
    expect(repository.snapshot().appointments.find((item) => item.id === 'APT-002')?.status).toBe('confirmed');
    expect(repository.snapshot().appointments.find((item) => item.id === 'APT-001')?.status).toBe('in_progress');
  });
});
