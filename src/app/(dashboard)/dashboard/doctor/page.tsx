import DashboardScreen from '@/components/dashboard/DashboardScreen';
import { requireRole } from '@/lib/requireRole';

export default async function DoctorDashboardPage() {
  const { user } = await requireRole(['medical']);
  return <DashboardScreen role="medical" actorId={user.id} />;
}
