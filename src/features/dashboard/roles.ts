import type { UserRole } from '@/types/database';

export type DashboardRole = 'staff_admin' | 'medical' | 'patient';

export function normalizeDashboardRole(role: UserRole): DashboardRole {
  if (role === 'patient' || role === 'medical') return role;
  return 'staff_admin';
}

export function dashboardPathForRole(role: UserRole): string {
  return `/dashboard/${normalizeDashboardRole(role)}`;
}
