import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import type { UserRole } from '@/types/database';

function canonicalRole(role: string): UserRole {
  if (role === 'doctor' || role === 'pharmacist' || role === 'medical') return 'medical';
  if (role === 'staff' || role === 'admin' || role === 'staff_admin') return 'staff_admin';
  return 'patient';
}

export async function requireRole(allowedRoles: UserRole[]) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    redirect('/login');
  }

  if (profile.is_active === false) {
    redirect('/login');
  }

  const role = canonicalRole(profile.role);
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  return { user, role };
}