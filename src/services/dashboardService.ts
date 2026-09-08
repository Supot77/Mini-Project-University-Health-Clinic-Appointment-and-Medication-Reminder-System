// 👤 รับผิดชอบโดย: เฮิร์บ
// ระบบศูนย์แจ้งเตือนและแดชบอร์ด

import { createClient } from '@/utils/supabase/client';
import type {
  Notification,
  NotificationType,
} from '@/types/database';
import type { BroadcastHistoryItem } from '@/features/dashboard/types';

const supabase = createClient();

interface SendBroadcastResult {
  recipientCount: number;
  created: boolean;
}

interface BroadcastRpcRow {
  recipient_count: number;
  created: boolean;
}

interface BroadcastHistoryRpcRow {
  id: string;
  title: string;
  message: string;
  sent_at: string;
  recipient_count: number;
  read_count?: number;
  role_read_counts?: Partial<Record<'patient' | 'medical' | 'staff_admin', { read: number; total: number }>>;
}

type NotificationRow = Omit<Notification, 'is_read'>;

function toNotification(row: NotificationRow): Notification {
  return { ...row, is_read: Boolean(row.read_at) };
}

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
    .select('id, user_id, type, title, message, event_key, broadcast_id, read_at, deleted_at, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(toNotification);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .select('id, user_id, type, title, message, event_key, broadcast_id, read_at, deleted_at, created_at')
    .single();
  if (error) throw error;
  return toNotification(data as NotificationRow);
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteNotification(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function sendBroadcast(
  title: string,
  message: string,
  requestKey: string,
): Promise<SendBroadcastResult> {
  const { data, error } = await supabase.rpc('send_broadcast', {
    p_title: title,
    p_message: message,
    p_request_key: requestKey,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as BroadcastRpcRow | null;
  if (!row) throw new Error('ฐานข้อมูลไม่ส่งผลลัพธ์การ Broadcast กลับมา');

  return { recipientCount: row.recipient_count, created: row.created };
}

export async function getBroadcastHistory(limit = 20): Promise<BroadcastHistoryItem[]> {
  const { data, error } = await supabase.rpc('get_broadcast_history', { p_limit: limit });
  if (error) throw error;

  return ((data ?? []) as BroadcastHistoryRpcRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    sentAt: row.sent_at,
    recipientCount: row.recipient_count,
    readCount: row.read_count ?? 0,
    roleReadCounts: row.role_read_counts ?? {},
  }));
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
