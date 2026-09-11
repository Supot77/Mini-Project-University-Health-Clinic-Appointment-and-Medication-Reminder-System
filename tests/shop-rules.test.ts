import { describe, expect, it } from 'vitest';
import { MOCK_DEPARTMENTS, MOCK_DOCTORS, MOCK_SERVICES, MOCK_SLOTS } from '@/mocks/scheduleData';
import { deriveSlotStatus, isSlotExpired, validateDepartmentName, validateSlot } from '@/features/shop/domain/rules';

const validSlot = {
  doctorId: 'profile-stephen-strange',
  serviceId: MOCK_SERVICES[0].id,
  slotDate: '2026-09-07',
  startTime: '09:30',
  endTime: '10:00',
  maxCapacity: 1,
};

const TEST_TODAY = '2026-09-07';

describe('shop schedule domain rules', () => {
  it('accepts adjacent slots but rejects overlapping slots', () => {
    const adjacent = validateSlot(
      { ...validSlot, slotDate: '2026-09-07', startTime: '09:30', endTime: '10:00' },
      MOCK_SLOTS,
      MOCK_DOCTORS,
      MOCK_SERVICES,
      undefined,
      0,
      TEST_TODAY,
    );
    const overlapping = validateSlot(
      { ...validSlot, slotDate: '2026-09-07', startTime: '09:15', endTime: '09:45' },
      MOCK_SLOTS,
      MOCK_DOCTORS,
      MOCK_SERVICES,
      undefined,
      0,
      TEST_TODAY,
    );
    expect(adjacent.ok).toBe(true);
    expect(overlapping).toMatchObject({ ok: false, error: expect.stringContaining('ทับซ้อน') });
  });

  it('rejects adding a slot for a past date', () => {
    const pastSlot = { ...validSlot, slotDate: '2026-09-04' };
    const result = validateSlot(pastSlot, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, 0, TEST_TODAY);
    expect(result).toMatchObject({
      ok: false,
      error: 'ไม่สามารถเพิ่มรอบตรวจของวันในอดีตได้',
      field: 'slotDate',
    });
  });

  it('allows adding a slot for today or future date', () => {
    const todayResult = validateSlot(validSlot, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, 0, TEST_TODAY);
    expect(todayResult.ok).toBe(true);

    const futureResult = validateSlot(
      { ...validSlot, slotDate: '2026-09-08' },
      [],
      MOCK_DOCTORS,
      MOCK_SERVICES,
      undefined,
      0,
      TEST_TODAY,
    );
    expect(futureResult.ok).toBe(true);
  });

  it('rejects moving an existing slot to a past date', () => {
    const existingSlot = {
      ...validSlot,
      id: 'slot-future',
      slotDate: '2026-09-08',
      serviceOfferingId: 'offering-1',
      bookedCount: 0,
      status: 'available' as const,
      hasHistory: false,
    };
    const result = validateSlot(
      { ...validSlot, slotDate: '2026-09-04' },
      [existingSlot],
      MOCK_DOCTORS,
      MOCK_SERVICES,
      'slot-future',
      0,
      TEST_TODAY,
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'ไม่สามารถเพิ่มรอบตรวจของวันในอดีตได้',
      field: 'slotDate',
    });
  });

  it('allows updating an existing past slot if slotDate is unchanged', () => {
    const pastSlot = {
      ...validSlot,
      id: 'slot-past',
      slotDate: '2026-09-04',
      serviceOfferingId: 'offering-1',
      bookedCount: 0,
      status: 'available' as const,
      hasHistory: false,
    };
    const result = validateSlot(
      { ...validSlot, slotDate: '2026-09-04', maxCapacity: 2 },
      [pastSlot],
      MOCK_DOCTORS,
      MOCK_SERVICES,
      'slot-past',
      0,
      TEST_TODAY,
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    [{ ...validSlot, slotDate: '2026-09-06' }, 'จันทร์ถึงศุกร์'],
    [{ ...validSlot, startTime: '08:00' }, '08:30'],
    [{ ...validSlot, startTime: '11:30', endTime: '12:30' }, 'ช่วงพัก'],
    [{ ...validSlot, maxCapacity: 0 }, 'จำนวนเต็ม'],
  ])('rejects an invalid clinic slot', (input, message) => {
    const result = validateSlot(input, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, 0, TEST_TODAY);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(message) });
  });

  it('does not allow capacity below existing bookings', () => {
    const result = validateSlot({ ...validSlot, maxCapacity: 2 }, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, 3, TEST_TODAY);
    expect(result).toMatchObject({ ok: false, field: 'maxCapacity' });
  });

  it.each([
    [{ ...validSlot, slotDate: '2026-02-30' }, 'YYYY-MM-DD'],
    [{ ...validSlot, startTime: '9:30' }, 'HH:mm'],
    [{ ...validSlot, endTime: '25:00' }, 'HH:mm'],
  ])('rejects malformed clinic date/time', (input, message) => {
    const result = validateSlot(input, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, 0, TEST_TODAY);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(message) });
  });

  it('rejects invalid booked counts before changing capacity', () => {
    expect(validateSlot(validSlot, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, -1, TEST_TODAY)).toMatchObject({ ok: false });
    expect(validateSlot(validSlot, [], MOCK_DOCTORS, MOCK_SERVICES, undefined, 2, TEST_TODAY)).toMatchObject({ ok: false, field: 'maxCapacity' });
  });

  it('requires active doctor and service references', () => {
    const inactiveDoctor = MOCK_DOCTORS.map((doctor) => doctor.id === validSlot.doctorId ? { ...doctor, availability: 'inactive' as const } : doctor);
    expect(validateSlot(validSlot, [], inactiveDoctor, MOCK_SERVICES, undefined, 0, TEST_TODAY)).toMatchObject({ ok: false, field: 'doctorId' });

    const inactiveService = MOCK_SERVICES.map((service) => service.id === validSlot.serviceId ? { ...service, isActive: false } : service);
    expect(validateSlot(validSlot, [], MOCK_DOCTORS, inactiveService, undefined, 0, TEST_TODAY)).toMatchObject({ ok: false, field: 'serviceId' });
  });

  it('closes slot immediately when capacity is full, while preserving closed status', () => {
    expect(deriveSlotStatus(4, 4)).toBe('closed');
    expect(deriveSlotStatus(5, 4)).toBe('closed');
    expect(deriveSlotStatus(0, 4)).toBe('available');
    expect(deriveSlotStatus(0, 4, 'closed')).toBe('closed');
  });

  it('closes slot immediately when past start time or past date', () => {
    const nowCtx = { currentDate: '2026-09-07', currentTime: '10:00' };

    // Same day, startTime <= currentTime -> closed
    expect(deriveSlotStatus(0, 4, undefined, { slotDate: '2026-09-07', startTime: '10:00', ...nowCtx })).toBe('closed');
    expect(deriveSlotStatus(0, 4, undefined, { slotDate: '2026-09-07', startTime: '09:30', ...nowCtx })).toBe('closed');

    // Same day, startTime > currentTime -> available
    expect(deriveSlotStatus(0, 4, undefined, { slotDate: '2026-09-07', startTime: '10:30', ...nowCtx })).toBe('available');

    // Past date -> closed
    expect(deriveSlotStatus(0, 4, undefined, { slotDate: '2026-09-06', startTime: '14:00', ...nowCtx })).toBe('closed');

    // Future date -> available
    expect(deriveSlotStatus(0, 4, undefined, { slotDate: '2026-09-08', startTime: '08:30', ...nowCtx })).toBe('available');
  });

  it('correctly determines if a slot is expired', () => {
    expect(isSlotExpired('2026-09-06', '09:00', '2026-09-07', '08:00')).toBe(true);
    expect(isSlotExpired('2026-09-07', '09:00', '2026-09-07', '09:00')).toBe(true);
    expect(isSlotExpired('2026-09-07', '09:00', '2026-09-07', '09:01')).toBe(true);
    expect(isSlotExpired('2026-09-07', '09:30', '2026-09-07', '09:15')).toBe(false);
    expect(isSlotExpired('2026-09-08', '08:30', '2026-09-07', '18:00')).toBe(false);
  });

  it('rejects duplicate department names regardless of case', () => {
    const result = validateDepartmentName('เวชปฏิบัติทั่วไป', 'NEW', MOCK_DEPARTMENTS);
    expect(result).toMatchObject({ ok: false, field: 'name' });
  });
});
