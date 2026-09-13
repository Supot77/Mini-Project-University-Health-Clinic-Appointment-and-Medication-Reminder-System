import StaffProfileDirectory from '@/components/staff/StaffProfileDirectory';
import { requireRole } from '@/lib/requireRole';

export default async function StaffAccountsPage() {
  await requireRole(['staff_admin']);
  return <StaffProfileDirectory />;
}
