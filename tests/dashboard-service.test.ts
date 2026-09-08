import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/utils/supabase/client', () => ({ createClient: () => supabaseMock }));

import { getBroadcastHistory, sendBroadcast } from '@/services/dashboardService';

describe('Supabase Broadcast service', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
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
});
