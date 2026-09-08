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

export interface SearchPatientsResult {
  patients: Profile[];
  hasMore: boolean;
  totalCount: number;
}

export async function searchPatients(
  query: string = '',
  page: number = 0,
  pageSize: number = 10
): Promise<SearchPatientsResult> {
  const trimmed = query.trim();
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let req = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'patient')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (trimmed) {
    req = req.or(`full_name.ilike.%${trimmed}%,student_id.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`);
  }

  const { data, count, error } = await req;
  if (error) throw error;

  const total = count ?? 0;
  const patients = data ?? [];
  const hasMore = from + patients.length < total;

  return {
    patients,
    hasMore,
    totalCount: total,
  };
}

export async function getPatients(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'patient')
    .order('full_name', { ascending: true });

  if (error) {
    console.warn('Error fetching patients from Supabase profiles:', error);
    return [];
  }
  return data ?? [];
}