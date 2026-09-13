import { describe, expect, it, vi, beforeEach } from 'vitest';
import PharmacyPage from '@/app/(clinic)/pharmacy/page';
import * as requireRoleModule from '@/lib/requireRole';
import type { User } from '@supabase/supabase-js';

vi.mock('@/components/pharmacy/PharmacyContent', () => ({
  default: ({ currentRole, userEmail }: { currentRole: string; userEmail: string }) => (
    <div data-testid="pharmacy-content" data-role={currentRole} data-email={userEmail}>
      Pharmacy Content for {currentRole}
    </div>
  ),
}));

describe('Pharmacy Page Access Control (Role Guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows access for medical role and passes role to PharmacyContent', async () => {
    vi.spyOn(requireRoleModule, 'requireRole').mockResolvedValueOnce({
      user: { id: 'doc-1', email: 'doctor@wu.ac.th', user_metadata: { full_name: 'นพ. วลัย' } } as unknown as User,
      role: 'medical',
      rawRole: 'doctor',
    });

    const pageElement = await PharmacyPage();
    expect(requireRoleModule.requireRole).toHaveBeenCalledWith(['medical', 'staff_admin', 'admin']);
    expect(pageElement.props.currentRole).toBe('doctor');
    expect(pageElement.props.userEmail).toBe('doctor@wu.ac.th');
  });

  it('allows access for staff_admin role', async () => {
    vi.spyOn(requireRoleModule, 'requireRole').mockResolvedValueOnce({
      user: { id: 'staff-1', email: 'staff@wu.ac.th', user_metadata: { full_name: 'เจ้าหน้าที่ สมศรี' } } as unknown as User,
      role: 'staff_admin',
      rawRole: 'staff_admin',
    });

    const pageElement = await PharmacyPage();
    expect(pageElement.props.currentRole).toBe('staff_admin');
  });

  it('allows access for admin role specifically', async () => {
    vi.spyOn(requireRoleModule, 'requireRole').mockResolvedValueOnce({
      user: { id: 'admin-1', email: 'admin@wu.ac.th', user_metadata: { full_name: 'แอดมิน สมชาย' } } as unknown as User,
      role: 'staff_admin',
      rawRole: 'admin',
    });

    const pageElement = await PharmacyPage();
    expect(pageElement.props.currentRole).toBe('admin');
  });

  it('delegates rejection to requireRole when unauthorized (throws redirect)', async () => {
    vi.spyOn(requireRoleModule, 'requireRole').mockImplementationOnce(async () => {
      throw new Error('NEXT_REDIRECT: /dashboard');
    });

    await expect(PharmacyPage()).rejects.toThrow('NEXT_REDIRECT: /dashboard');
  });
});

