import LeaveWorkspace from '@/components/leaves/LeaveWorkspace';
import { requireRole } from '@/lib/requireRole';
import { redirect } from 'next/navigation';

export default async function LeavesPage() {
  const { role, user } = await requireRole(['medical', 'staff_admin']);
  if (role === 'patient') redirect('/dashboard');
  return <LeaveWorkspace role={role} actorId={user.id} />;
}

