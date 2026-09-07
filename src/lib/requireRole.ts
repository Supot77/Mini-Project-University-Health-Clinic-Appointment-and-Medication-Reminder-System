import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import type { UserRole } from '@/types/database';

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

  if (!allowedRoles.includes(profile.role as UserRole)) {
    redirect('/dashboard');
  }

  return { user, role: profile.role as UserRole };
}