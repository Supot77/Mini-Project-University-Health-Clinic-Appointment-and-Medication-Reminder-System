import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/app/(dashboard)/dashboard/page';
import { ClinicMockProvider } from '@/features/mock-database/ClinicMockProvider';

const replace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'profile-peter-parker', role: 'patient', full_name: 'Peter Parker' },
    role: 'patient', isLoading: false, isAuthenticated: true, signOut: vi.fn(),
  }),
}));

describe('Dashboard patient access', () => {
  it('redirects an authenticated patient without loading dashboard content', async () => {
    render(<ClinicMockProvider><DashboardPage /></ClinicMockProvider>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/appointments'));
  });
});
