import { requireRole } from '@/lib/requireRole';
import ProfileContent from '@/components/profile/ProfileContent';

export default async function ProfilePage() {
  await requireRole(['patient', 'staff_admin', 'medical']);
  return <ProfileContent />;
}