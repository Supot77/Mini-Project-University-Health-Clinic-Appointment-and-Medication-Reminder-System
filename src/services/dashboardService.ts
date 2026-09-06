// 👤 รับผิดชอบโดย: เฮิร์บ
// ระบบศูนย์แจ้งเตือนและแดชบอร์ด

import { supabase } from '@/lib/supabase';
import type {
  Notification,
  NotificationType,
} from '@/types/database';

export interface MedicationAlertItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  expiryDate: string | null;
  isLowStock: boolean;
  isExpired: boolean;
}

export interface MedicationDashboardData {
  lowStockCount: number;
  expiredCount: number;
  alerts: MedicationAlertItem[];
}

// --- Notifications ---
export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function getBangkokDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export async function getMedicationDashboardData(): Promise<MedicationDashboardData> {
  const { data, error } = await supabase
    .from('medications')
    .select('id, name, stock, min_stock, expiry_date')
    .eq('is_active', true)
    .order('stock', { ascending: true });

  if (error) throw new Error(error.message);

  const today = getBangkokDate();
  const alerts = (data ?? [])
    .map((medication): MedicationAlertItem => ({
      id: medication.id,
      name: medication.name,
      stock: medication.stock,
      minStock: medication.min_stock,
      expiryDate: medication.expiry_date,
      isLowStock: medication.stock <= medication.min_stock,
      isExpired: Boolean(medication.expiry_date && medication.expiry_date < today),
    }))
    .filter(({ isLowStock, isExpired }) => isLowStock || isExpired)
    .sort((a, b) => Number(b.isExpired) - Number(a.isExpired) || a.stock - b.stock);

  return {
    lowStockCount: alerts.filter(({ isLowStock }) => isLowStock).length,
    expiredCount: alerts.filter(({ isExpired }) => isExpired).length,
    alerts,
  };
}

// --- Dashboard Stats ---
export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];

  // Today's appointments count
  const { count: todayAppointments } = await supabase
    .from('appointments')
    .select('*, slot:appointment_slots!inner(*)', { count: 'exact', head: true })
    .eq('slot.slot_date', today);

  // Total patients count
  const { count: totalPatients } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'patient');

  // Low stock medications count
  const { data: lowStockMeds } = await supabase
    .from('medications')
    .select('id')
    .eq('is_active', true);
  // Note: comparing stock <= min_stock needs RPC or client-side filter

  return {
    todayAppointments: todayAppointments ?? 0,
    totalPatients: totalPatients ?? 0,
    lowStockMedications: lowStockMeds?.length ?? 0,
  };
}
