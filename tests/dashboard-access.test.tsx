import { describe, expect, it } from 'vitest';
import { dashboardPathForRole, normalizeDashboardRole } from '@/features/dashboard/roles';

describe('Dashboard role routing', () => {
  it('routes each active role to its own dashboard', () => {
    expect(dashboardPathForRole('patient')).toBe('/dashboard/patient');
    expect(dashboardPathForRole('medical')).toBe('/dashboard/medical');
    expect(dashboardPathForRole('staff_admin')).toBe('/dashboard/staff_admin');
  });

  it('keeps the three supported roles unchanged', () => {
    expect(normalizeDashboardRole('patient')).toBe('patient');
    expect(normalizeDashboardRole('medical')).toBe('medical');
    expect(normalizeDashboardRole('staff_admin')).toBe('staff_admin');
  });
});
