// 👤 รับผิดชอบโดย: ฟีม
// ระบบยืนยันตัวตนและโปรไฟล์

import { createClient } from '@/utils/supabase/client';
import type { Profile, UserRole } from '@/types/database';

const supabase = createClient(); 

export async function signUp(email: string, password: string, fullName: string, studentId?: string, phone?: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      student_id: studentId || null,
      phone: phone || null,
      role: 'patient' as UserRole,
    });
    if (profileError) throw profileError;
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function searchPatients(query: string): Promise<Profile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'patient')
    .or(`student_id.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
    .limit(20);

  if (error) throw error;
  return data ?? [];
}