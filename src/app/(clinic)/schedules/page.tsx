import ScheduleWorkspace from '@/components/schedules/ScheduleWorkspace';
import { requireRole } from '@/lib/requireRole';

export default async function SchedulesPage() {
  const { role, user } = await requireRole(['patient', 'medical', 'staff_admin']);
  return <ScheduleWorkspace role={role} actorId={user.id} />;
}
