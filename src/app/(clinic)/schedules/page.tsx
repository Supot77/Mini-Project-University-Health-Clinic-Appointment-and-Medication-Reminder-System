import ScheduleWorkspace from '@/components/schedules/ScheduleWorkspace';
import { createClient } from '@/utils/supabase/server';
import type { UserRole } from '@/types/database';

function canonicalRole(role: string): UserRole {
  if (role === 'doctor' || role === 'pharmacist' || role === 'medical') return 'medical';
  if (role === 'staff' || role === 'admin' || role === 'staff_admin') return 'staff_admin';
  return 'patient';
}

async function getScheduleUser(): Promise<{ role: UserRole; actorId: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { role: 'patient', actorId: 'guest' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ? canonicalRole(profile.role) : 'patient';
    return { role, actorId: user.id };
  } catch {
    return { role: 'patient', actorId: 'guest' };
  }
}

export default async function SchedulesPage() {
  const { role, actorId } = await getScheduleUser();
  return <ScheduleWorkspace role={role} actorId={actorId} />;
}

