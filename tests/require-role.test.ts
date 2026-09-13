import { describe, expect, it, vi, beforeEach } from 'vitest';
import { requireRole } from '@/lib/requireRole';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECTED_TO:${url}`);
  }),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('requireRole helper', () => {
  const mockGetUser = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('redirects to /login if user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    await expect(requireRole(['medical', 'staff_admin'])).rejects.toThrow('REDIRECTED_TO:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects to /login if user profile is inactive', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'medical', is_active: false }, error: null }),
        }),
      }),
    });

    await expect(requireRole(['medical', 'staff_admin'])).rejects.toThrow('REDIRECTED_TO:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects patient to /dashboard when accessing restricted route', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'patient-1' } } });
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'patient', is_active: true }, error: null }),
        }),
      }),
    });

    await expect(requireRole(['medical', 'staff_admin', 'admin'])).rejects.toThrow('REDIRECTED_TO:/dashboard');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('allows access for admin role and returns user and rawRole', async () => {
    const user = { id: 'admin-1', email: 'admin@wu.ac.th' };
    mockGetUser.mockResolvedValueOnce({ data: { user } });
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'admin', is_active: true }, error: null }),
        }),
      }),
    });

    const result = await requireRole(['medical', 'staff_admin', 'admin']);
    expect(result.user).toEqual(user);
    expect(result.role).toBe('staff_admin');
    expect(result.rawRole).toBe('admin');
  });

  it('allows access for doctor/medical role', async () => {
    const user = { id: 'doc-1', email: 'doc@wu.ac.th' };
    mockGetUser.mockResolvedValueOnce({ data: { user } });
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'doctor', is_active: true }, error: null }),
        }),
      }),
    });

    const result = await requireRole(['medical', 'staff_admin', 'admin']);
    expect(result.user).toEqual(user);
    expect(result.role).toBe('medical');
    expect(result.rawRole).toBe('doctor');
  });
});

