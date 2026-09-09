import { beforeEach, describe, expect, it, vi } from 'vitest';

const { database, supabaseMock } = vi.hoisted(() => {
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return query; }),
      in: vi.fn((column: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[column])); return query; }),
      is: vi.fn((column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value || (value === null && row[column] == null)); return query; }),
      gte: vi.fn((column: string, value: unknown) => { rows = rows.filter((row) => String(row[column]) >= String(value)); return query; }),
      lte: vi.fn((column: string, value: unknown) => { rows = rows.filter((row) => String(row[column]) <= String(value)); return query; }),
      order: vi.fn((column: string, options?: { ascending?: boolean }) => {
        rows.sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (options?.ascending === false ? -1 : 1));
        return query;
      }),
      limit: vi.fn((limit: number) => { rows = rows.slice(0, limit); return query; }),
      then: (resolve: (value: { data: typeof rows; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  });
  return { database: tables, supabaseMock: { rpc: vi.fn(), from } };
});

vi.mock('@/utils/supabase/client', () => ({ createClient: () => supabaseMock }));

import {
  getBroadcastHistory,
  getDashboardView,
  getStaffProfileDirectory,
  sendBroadcast,
} from '@/services/dashboardService';

describe('Supabase Broadcast service', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockClear();
    for (const table of Object.keys(database)) delete database[table];
  });

  it('sends a clinic-wide Broadcast through the database RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ recipient_count: 17, created: true }],
      error: null,
    });

    await expect(sendBroadcast('แจ้งปิดคลินิก', 'คลินิกปิดเวลา 16:00 น.', 'request-1')).resolves.toEqual({
      recipientCount: 17,
      created: true,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith('send_broadcast', {
      p_title: 'แจ้งปิดคลินิก',
      p_message: 'คลินิกปิดเวลา 16:00 น.',
      p_request_key: 'request-1',
    });
  });

  it('maps database Broadcast history for the staff dashboard', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{
        id: 'broadcast-1',
        title: 'ประกาศ',
        message: 'ข้อความ',
        sent_at: '2026-09-08T03:00:00.000Z',
        recipient_count: 17,
        read_count: 6,
        role_read_counts: {
          patient: { read: 3, total: 10 },
          medical: { read: 2, total: 4 },
          staff_admin: { read: 1, total: 3 },
        },
      }],
      error: null,
    });

    await expect(getBroadcastHistory()).resolves.toEqual([{
      id: 'broadcast-1',
      title: 'ประกาศ',
      message: 'ข้อความ',
      sentAt: '2026-09-08T03:00:00.000Z',
      recipientCount: 17,
      readCount: 6,
      roleReadCounts: {
        patient: { read: 3, total: 10 },
        medical: { read: 2, total: 4 },
        staff_admin: { read: 1, total: 3 },
      },
    }]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_broadcast_history', { p_limit: 20 });
  });

  it('surfaces an RPC error without reporting a false success', async () => {
    const error = new Error('permission denied');
    supabaseMock.rpc.mockResolvedValue({ data: null, error });

    await expect(sendBroadcast('ประกาศ', 'ข้อความ', 'request-2')).rejects.toBe(error);
  });

  it('maps the staff-only profile directory returned by the database RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{
        id: 'patient-1',
        full_name: 'ผู้ป่วยหนึ่ง',
        email: 'patient@example.com',
        phone: '0812345678',
        role: 'patient',
        is_active: true,
      }],
      error: null,
    });

    await expect(getStaffProfileDirectory()).resolves.toEqual([{
      id: 'patient-1',
      fullName: 'ผู้ป่วยหนึ่ง',
      email: 'patient@example.com',
      phone: '0812345678',
      role: 'patient',
      isActive: true,
    }]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_staff_profile_directory');
  });
});

describe('Supabase dashboard service', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockClear();
    for (const table of Object.keys(database)) delete database[table];

    database.profiles = [
      { id: 'patient-1', full_name: 'ผู้ป่วยหนึ่ง', role: 'patient', is_active: true },
      { id: 'medical-1', full_name: 'แพทย์หนึ่ง', role: 'medical', is_active: true },
      { id: 'staff-1', full_name: 'เจ้าหน้าที่หนึ่ง', role: 'staff_admin', is_active: true },
    ];
    database.departments = [{ id: 'department-1', name: 'เวชทั่วไป', is_active: true }];
    database.doctors = [{ id: 'medical-1', department_id: 'department-1' }];
    database.appointment_slots = [{
      id: 'slot-1', doctor_id: 'medical-1', slot_date: '2026-09-08', start_time: '09:00:00',
      max_capacity: 10, status: 'available',
    }];
    database.appointments = [{
      id: 'appointment-1', user_id: 'patient-1', slot_id: 'slot-1', queue_number: 1, status: 'confirmed',
    }];
    database.notifications = [
      { id: 'notification-patient', user_id: 'patient-1', type: 'broadcast', title: 'ประกาศ', message: 'ข้อความ', read_at: null, deleted_at: null, created_at: '2026-09-08T03:00:00.000Z' },
      { id: 'notification-medical', user_id: 'medical-1', type: 'broadcast', title: 'ประกาศ', message: 'ข้อความ', read_at: null, deleted_at: null, created_at: '2026-09-08T03:00:00.000Z' },
    ];
    database.medication_reminders = [{ id: 'reminder-1', user_id: 'patient-1', medication_id: 'medicine-1', status: 'active' }];
    database.medications = [{ id: 'medicine-1', name: 'ยา A', stock: 2, min_stock: 5, expiry_date: null, is_active: true }];
    database.medical_records = [];
  });

  it('scopes a patient dashboard to the signed-in patient data', async () => {
    const view = await getDashboardView('patient', 'patient-1', '2026-09-08', 'today');

    expect(view.actor).toEqual({ id: 'patient-1', fullName: 'ผู้ป่วยหนึ่ง' });
    expect(view.metrics.map((metric) => metric.value)).toEqual([1, 1, 1, 1]);
    expect(view.appointmentQueue).toHaveLength(1);
    expect(view.appointmentQueue[0].patientName).toBe('ผู้ป่วยหนึ่ง');
    expect(view.recentNotifications).toHaveLength(1);
  });

  it('scopes a doctor dashboard to that doctor slots', async () => {
    const view = await getDashboardView('medical', 'medical-1', '2026-09-08', 'today');

    expect(view.metrics.map((metric) => metric.value)).toEqual([1, 1, 0, 1]);
    expect(view.appointmentQueue).toHaveLength(1);
    expect(view.appointmentQueue[0].doctorName).toBe('แพทย์หนึ่ง');
    expect(view.departmentLoads).toEqual([]);
  });

  it('returns aggregate clinic data for staff_admin without diagnosis fields', async () => {
    const view = await getDashboardView('staff_admin', 'staff-1', '2026-09-08', 'today');

    expect(view.metrics.map((metric) => metric.value)).toEqual([1, 1, 1, 3]);
    expect(view.departmentLoads).toEqual([{
      departmentId: 'department-1', departmentName: 'เวชทั่วไป', appointmentCount: 1, capacity: 10,
    }]);
    expect(view.roleCounts).toEqual([
      { role: 'patient', count: 1 }, { role: 'medical', count: 1 }, { role: 'staff_admin', count: 1 },
    ]);
    expect(JSON.stringify(view)).not.toContain('diagnosis');
  });

  it('rejects a dashboard role that does not match the signed-in profile', async () => {
    await expect(getDashboardView('staff_admin', 'patient-1', '2026-09-08', 'today'))
      .rejects.toThrow('ไม่มีสิทธิ์เปิด Dashboard');
  });
});
