import { describe, expect, it } from 'vitest';
import { ClinicMockDatabase } from '@/features/mock-database/engine';
import { createClinicRepositories } from '@/features/mock-database/repositories';
import type { UserRole } from '@/types/database';

const roles: UserRole[] = ['staff', 'doctor', 'pharmacist', 'admin'];

describe('role-based dashboard requirements', () => {
  it('builds a dedicated view for all four dashboard roles', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const expectedMetric: Record<UserRole, string> = {
      staff: 'appointments-in-range', doctor: 'own-queue', pharmacist: 'pending-dispensing',
      admin: 'accounts', patient: 'my-reminders',
    };

    for (const role of roles) {
      const result = await repositories.dashboard.getView(role, undefined, '2026-09-07');
      expect(result.error).toBeNull();
      expect(result.data?.role).toBe(role);
      expect(result.data?.metrics.map((item) => item.id)).toContain(expectedMetric[role]);
    }
  });

  it('limits a doctor to their own schedule and queue', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const strange = await repositories.dashboard.getView('doctor', 'profile-stephen-strange', '2026-09-07');
    const xavier = await repositories.dashboard.getView('doctor', 'profile-charles-xavier', '2026-09-07');

    expect(strange.data?.metrics.find((item) => item.id === 'own-appointments')?.value).toBe(1);
    expect(strange.data?.metrics.find((item) => item.id === 'own-queue')?.value).toBe(1);
    expect(xavier.data?.metrics.find((item) => item.id === 'completed-in-range')?.value).toBe(1);
    expect(xavier.data?.metrics.find((item) => item.id === 'own-queue')?.value).toBe(0);
  });

  it('keeps the admin dashboard aggregate-only', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const result = await repositories.dashboard.getView('admin', 'profile-nick-fury', '2026-09-07');
    const serialized = JSON.stringify(result.data);

    expect(result.data?.roleCounts).toHaveLength(5);
    expect(serialized).not.toContain('diagnosis');
    expect(serialized).not.toContain('ไข้และปวดศีรษะ');
  });

  it('rejects patient dashboard requests at the repository boundary', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const result = await repositories.dashboard.getView('patient', 'real-auth-user-not-in-mock', '2026-09-07');

    expect(result).toMatchObject({ data: null, error: { code: '42501' } });
  });

  it('separates low-stock and expired medication counts', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const result = await repositories.dashboard.getView('pharmacist', 'profile-severus-snape', '2026-12-01');

    expect(result.data?.metrics.find((item) => item.id === 'low-stock')?.value).toBe(0);
    expect(result.data?.metrics.find((item) => item.id === 'expired')?.value).toBe(1);
    expect(result.data?.medicationAlerts.find((item) => item.id === 'med-cetirizine')).toMatchObject({ lowStock: false, expired: true });
  });

  it('calculates today, trailing 7 days, and trailing 30 days as inclusive Bangkok ranges', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const today = await repositories.dashboard.getView('staff', undefined, '2026-09-06', 'today');
    const sevenDays = await repositories.dashboard.getView('staff', undefined, '2026-09-06', '7d');
    const thirtyDays = await repositories.dashboard.getView('staff', undefined, '2026-09-06', '30d');
    const appointmentCount = (result: typeof today) => result.data?.metrics.find((item) => item.id === 'appointments-in-range')?.value;

    expect(today.data).toMatchObject({ startDate: '2026-09-06', date: '2026-09-06', range: 'today' });
    expect(sevenDays.data).toMatchObject({ startDate: '2026-08-31', date: '2026-09-06', range: '7d' });
    expect(thirtyDays.data).toMatchObject({ startDate: '2026-08-08', date: '2026-09-06', range: '30d' });
    expect([appointmentCount(today), appointmentCount(sevenDays), appointmentCount(thirtyDays)]).toEqual([0, 1, 2]);
  });
});

describe('broadcast and personal inbox rules', () => {
  it('rejects broadcast attempts from non-admin roles without changing data', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    const before = database.snapshot();
    const result = await repositories.notifications.sendBroadcast({
      actorId: 'profile-leslie-knope', actorRole: 'staff', notificationType: 'broadcast', title: 'ทดสอบ', message: 'ข้อความ',
      audience: { all: true, roles: [] }, requestKey: 'staff-request',
    });

    expect(result).toMatchObject({ data: null, error: { code: '42501' } });
    expect(database.snapshot()).toEqual(before);
  });

  it('deduplicates and freezes recipients and makes a request idempotent', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    const input = {
      actorId: 'profile-nick-fury', actorRole: 'admin' as const, notificationType: 'broadcast' as const, title: 'ประกาศ', message: 'ข้อความถึงแพทย์',
      audience: { all: false, roles: ['doctor' as const] }, requestKey: 'broadcast-request-1',
    };
    const first = await repositories.notifications.sendBroadcast(input);
    const afterFirst = database.snapshot();

    expect(first.data).toEqual({ recipientCount: 6, created: true });
    expect(new Set(afterFirst.notifications.filter((item) => item.broadcast_id).map((item) => item.user_id)).size).toBe(6);
    await repositories.profiles.update('profile-stephen-strange', { role: 'patient' });
    const repeated = await repositories.notifications.sendBroadcast(input);

    expect(repeated.data).toEqual({ recipientCount: 6, created: false });
    expect(database.snapshot().notifications.filter((item) => item.broadcast_id)).toHaveLength(6);
    expect(database.snapshot().notifications.filter((item) => item.type === 'broadcast')).toHaveLength(7);
  });

  it('allows the same content as a new broadcast when the request key changes', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    const base = {
      actorId: 'profile-nick-fury', actorRole: 'admin' as const, notificationType: 'system' as const, title: 'ประกาศเดิม', message: 'ส่งซ้ำโดยตั้งใจ',
      audience: { all: false, roles: ['patient' as const] },
    };
    await repositories.notifications.sendBroadcast({ ...base, requestKey: 'request-a' });
    await repositories.notifications.sendBroadcast({ ...base, requestKey: 'request-b' });

    expect(database.snapshot().broadcasts).toHaveLength(2);
    expect(database.snapshot().notifications.filter((item) => item.type === 'system')).toHaveLength(16);
  });

  it('stores and delivers the selected broadcast topic type', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    await repositories.notifications.sendBroadcast({
      actorId: 'profile-nick-fury', actorRole: 'admin', notificationType: 'appointment',
      title: 'แจ้งเรื่องนัด', message: 'กรุณาตรวจสอบเวลานัด',
      audience: { all: false, roles: ['patient'] }, requestKey: 'appointment-topic',
    });

    expect(database.snapshot().broadcasts[0].notification_type).toBe('appointment');
    expect(database.snapshot().notifications.find((item) => item.event_key?.startsWith('broadcast:'))?.type).toBe('appointment');
  });

  it('lets recipients read or delete only their own inbox item', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    await repositories.notifications.sendBroadcast({
      actorId: 'profile-nick-fury', actorRole: 'admin', notificationType: 'broadcast', title: 'ถึงผู้ป่วย', message: 'ข้อความถึงกลุ่มผู้ป่วย',
      audience: { all: false, roles: ['patient'] }, requestKey: 'patient-broadcast',
    });
    const sent = database.snapshot().notifications.find((item) => item.broadcast_id && item.user_id === 'profile-peter-parker')!;
    const denied = await repositories.notifications.markReadForUser(sent.id, 'profile-wednesday');
    expect(denied).toMatchObject({ data: null, error: { code: '42501' } });

    await repositories.notifications.markReadForUser(sent.id, 'profile-peter-parker');
    await repositories.notifications.deleteForUser(sent.id, 'profile-peter-parker');
    const after = database.snapshot();
    expect(after.broadcasts).toHaveLength(1);
    expect(after.notifications.find((item) => item.id === sent.id)?.read_at).not.toBeNull();
    expect(after.notifications.find((item) => item.id === sent.id)?.deleted_at).not.toBeNull();
    expect((await repositories.notifications.listInbox('profile-peter-parker')).data).not.toContainEqual(expect.objectContaining({ id: sent.id }));
  });

  it('rejects an empty role audience without changing data', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    const before = database.snapshot();
    const result = await repositories.notifications.sendBroadcast({
      actorId: 'profile-nick-fury', actorRole: 'admin', notificationType: 'broadcast',
      title: 'ประกาศ', message: 'ข้อความ', audience: { all: false, roles: [] }, requestKey: 'empty-audience',
    });

    expect(result).toMatchObject({ data: null, error: { code: '23514' } });
    expect(database.snapshot()).toEqual(before);
  });
});
