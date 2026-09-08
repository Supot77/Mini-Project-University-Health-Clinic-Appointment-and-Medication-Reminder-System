import DashboardScreen from '@/components/dashboard/DashboardScreen';
import { requireRole } from '@/lib/requireRole';

export default async function PatientDashboardPage() {
  const { user } = await requireRole(['patient']);
  return <DashboardScreen role="patient" actorId={user.id} />;
}
