import { redirect } from 'next/navigation';
import { dashboardPathForRole } from '@/features/dashboard/roles';
import { requireRole } from '@/lib/requireRole';

export default async function DashboardPage() {
  const { role } = await requireRole(['patient', 'staff_admin', 'medical']);
  redirect(dashboardPathForRole(role));
}
