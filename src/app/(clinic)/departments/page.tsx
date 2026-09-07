import DepartmentWorkspace from '@/components/schedules/DepartmentWorkspace';
import { requireRole } from '@/lib/requireRole';
import { redirect } from 'next/navigation';

export default async function DepartmentsPage() {
  const { role } = await requireRole(['staff_admin']);
  if (role !== 'staff_admin') redirect('/dashboard');
  return <DepartmentWorkspace />;
}
