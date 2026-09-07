import DashboardScreen from '@/components/dashboard/DashboardScreen';
import { requireRole } from '@/lib/requireRole';

export default async function StaffDashboardPage() {
  const { user } = await requireRole(['staff_admin', 'staff_admin', 'medical']);
  return <DashboardScreen role="staff_admin" actorId={user.id} />;
}
