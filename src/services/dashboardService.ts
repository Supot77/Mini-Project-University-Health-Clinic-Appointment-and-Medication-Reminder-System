// 👤 รับผิดชอบโดย: เฮิร์บ
// ระบบศูนย์แจ้งเตือนและแดชบอร์ด

import { createClient } from '@/utils/supabase/client';
import type {
  Appointment,
  AppointmentSlot,
  AppointmentStatus,
  Department,
  Doctor,
  MedicalRecord,
  Medication,
  MedicationReminder,
  Notification,
  NotificationType,
  Profile,
  UserRole,
} from '@/types/database';
import {
  dashboardRangeLabels,
  type BroadcastHistoryItem,
  type DashboardMetric,
  type DashboardRange,
  type DashboardView,
} from '@/features/dashboard/types';

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

export interface StaffProfileDirectoryItem {
  createdAt: string;
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
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

export async function getStaffProfileDirectory(): Promise<StaffProfileDirectoryItem[]> {
  const { data, error } = await supabase.rpc('get_staff_profile_directory');
  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error('ยังไม่ได้ติดตั้ง RPC get_staff_profile_directory กรุณารัน supabase/migrations/12_staff_profile_directory.sql ใน Supabase SQL Editor');
    }
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    is_active: boolean | null;
    created_at: string;
  }>).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    isActive: profile.is_active !== false,
    createdAt: profile.created_at,
  }));
}

type DashboardProfile = Pick<Profile, 'id' | 'full_name' | 'role' | 'is_active'>;
type DashboardDepartment = Pick<Department, 'id' | 'name' | 'is_active'>;
type DashboardDoctor = Pick<Doctor, 'id' | 'department_id'>;
type DashboardSlot = Pick<AppointmentSlot, 'id' | 'doctor_id' | 'slot_date' | 'start_time' | 'max_capacity' | 'status'>;
type DashboardAppointment = Pick<Appointment, 'id' | 'user_id' | 'slot_id' | 'queue_number' | 'status'>;
type DashboardMedication = Pick<Medication, 'id' | 'name' | 'stock' | 'min_stock' | 'expiry_date' | 'is_active'>;
type DashboardReminder = Pick<MedicationReminder, 'id' | 'user_id' | 'medication_id' | 'status'>;
type DashboardMedicalRecord = Pick<MedicalRecord, 'id' | 'prescribed_medications'>;

const activeAppointmentStatuses: AppointmentStatus[] = ['pending', 'confirmed', 'in_progress', 'completed', 'no_show'];

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function toBangkokDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function throwQueryError(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`);
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
export async function getDashboardView(
  role: UserRole,
  actorId: string,
  today: string,
  range: DashboardRange,
): Promise<DashboardView> {
  const rangeDays: Record<DashboardRange, number> = { today: 1, '7d': 7, '30d': 30 };
  const startDate = subtractDays(today, rangeDays[range] - 1);

  const [profilesResult, departmentsResult, doctorsResult, slotsResult, notifications] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, is_active'),
    supabase.from('departments').select('id, name, is_active'),
    supabase.from('doctors').select('id, department_id'),
    supabase
      .from('appointment_slots')
      .select('id, doctor_id, slot_date, start_time, max_capacity, status')
      .gte('slot_date', startDate)
      .lte('slot_date', today),
    getNotifications(actorId, 100),
  ]);

  throwQueryError('โหลดบัญชีไม่สำเร็จ', profilesResult.error);
  throwQueryError('โหลดแผนกไม่สำเร็จ', departmentsResult.error);
  throwQueryError('โหลดข้อมูลแพทย์ไม่สำเร็จ', doctorsResult.error);
  throwQueryError('โหลดรอบตรวจไม่สำเร็จ', slotsResult.error);

  const profiles = (profilesResult.data ?? []) as DashboardProfile[];
  const departments = (departmentsResult.data ?? []) as DashboardDepartment[];
  const doctors = (doctorsResult.data ?? []) as DashboardDoctor[];
  const allRangeSlots = (slotsResult.data ?? []) as DashboardSlot[];
  const actor = profiles.find((profile) => profile.id === actorId);

  if (!actor || actor.role !== role || actor.is_active === false) {
    throw new Error('บัญชีที่เข้าสู่ระบบไม่มีสิทธิ์เปิด Dashboard ของบทบาทนี้');
  }

  const isDoctorActor = role === 'medical' && doctors.some((doctor) => doctor.id === actorId);
  const scopedSlots = isDoctorActor
    ? allRangeSlots.filter((slot) => slot.doctor_id === actorId)
    : allRangeSlots;
  const scopedSlotIds = scopedSlots.map((slot) => slot.id);

  let appointments: DashboardAppointment[] = [];
  if (scopedSlotIds.length > 0) {
    let appointmentQuery = supabase
      .from('appointments')
      .select('id, user_id, slot_id, queue_number, status')
      .in('slot_id', scopedSlotIds);
    if (role === 'patient') appointmentQuery = appointmentQuery.eq('user_id', actorId);
    const appointmentResult = await appointmentQuery;
    throwQueryError('โหลดนัดหมายไม่สำเร็จ', appointmentResult.error);
    appointments = (appointmentResult.data ?? []) as DashboardAppointment[];
  }

  const medicationPromise = role === 'patient'
    ? Promise.resolve({ data: [] as DashboardMedication[], error: null })
    : supabase.from('medications').select('id, name, stock, min_stock, expiry_date, is_active');
  const reminderPromise = role === 'patient'
    ? supabase.from('medication_reminders').select('id, user_id, medication_id, status').eq('user_id', actorId)
    : Promise.resolve({ data: [] as DashboardReminder[], error: null });
  const medicalRecordPromise = role === 'medical' && !isDoctorActor
    ? supabase.from('medical_records').select('id, prescribed_medications')
    : Promise.resolve({ data: [] as DashboardMedicalRecord[], error: null });

  const [medicationsResult, remindersResult, medicalRecordsResult] = await Promise.all([
    medicationPromise,
    reminderPromise,
    medicalRecordPromise,
  ]);
  throwQueryError('โหลดยาไม่สำเร็จ', medicationsResult.error);
  throwQueryError('โหลดรายการเตือนไม่สำเร็จ', remindersResult.error);
  throwQueryError('โหลดรายการจ่ายยาไม่สำเร็จ', medicalRecordsResult.error);

  const medications = (medicationsResult.data ?? []) as DashboardMedication[];
  const reminders = (remindersResult.data ?? []) as DashboardReminder[];
  const medicalRecords = (medicalRecordsResult.data ?? []) as DashboardMedicalRecord[];
  const activeAppointments = appointments.filter((appointment) => activeAppointmentStatuses.includes(appointment.status));
  const queueRemaining = activeAppointments.filter((appointment) => appointment.status === 'confirmed' || appointment.status === 'in_progress').length;
  const completedInRange = activeAppointments.filter((appointment) => appointment.status === 'completed').length;
  const rangeNotifications = notifications.filter((notification) => {
    const notificationDate = toBangkokDate(notification.created_at);
    return notificationDate >= startDate && notificationDate <= today;
  });
  const unreadNotifications = rangeNotifications.filter((notification) => !notification.is_read).length;
  const activeMedications = medications.filter((medication) => medication.is_active !== false);
  const lowStock = activeMedications.filter((medication) => medication.stock <= medication.min_stock && (!medication.expiry_date || medication.expiry_date >= today));
  const expired = activeMedications.filter((medication) => Boolean(medication.expiry_date && medication.expiry_date < today));
  const activeReminders = reminders.filter((reminder) => reminder.status === 'active');
  const patientMedicationIds = new Set(activeReminders.map((reminder) => reminder.medication_id));
  const pendingDispensing = medicalRecords.filter((record) => (record.prescribed_medications?.length ?? 0) > 0).length;
  const activeProfiles = profiles.filter((profile) => profile.is_active !== false);
  const rangeSuffix = range === 'today' ? dashboardRangeLabels[range] : ` ${dashboardRangeLabels[range]}`;
  const metric = (value: number | string, id: string, label: string, description: string, href: string, tone: DashboardMetric['tone']): DashboardMetric => ({
    id, value, label, description, href, tone,
  });

  const metricsByRole: Record<UserRole, DashboardMetric[]> = {
    staff_admin: [
      metric(activeAppointments.length, 'appointments-in-range', `นัดหมาย${rangeSuffix}`, 'ไม่รวมรายการยกเลิกและปฏิเสธ', '/appointments', 'blue'),
      metric(queueRemaining, 'remaining-queue', range === 'today' ? 'คิวที่เหลือ' : 'คิวในช่วงที่เลือก', 'ยืนยันแล้วและกำลังตรวจ', '/appointments', 'amber'),
      metric(departments.filter((department) => department.is_active !== false).length, 'department-workload', 'แผนกที่ให้บริการ', 'ดูภาระงานแยกตามแผนก', '/departments', 'violet'),
      metric(activeProfiles.length, 'accounts', 'บัญชีทั้งหมด', 'ดูรายชื่อและข้อมูลติดต่อแยกตาม role', '/staff/accounts', 'blue'),
    ],
    medical: isDoctorActor
      ? [
          metric(activeAppointments.length, 'own-appointments', `นัดของฉัน${rangeSuffix}`, 'เฉพาะตารางแพทย์ที่เข้าสู่ระบบ', '/appointments', 'blue'),
          metric(queueRemaining, 'own-queue', range === 'today' ? 'คิวของฉันที่เหลือ' : 'คิวของฉันในช่วงที่เลือก', 'ยืนยันแล้วและกำลังตรวจ', '/appointments', 'amber'),
          metric(completedInRange, 'completed-in-range', `ตรวจเสร็จ${rangeSuffix}`, 'นับสถานะเสร็จสิ้น', '/appointments', 'emerald'),
          metric(unreadNotifications, 'unread-notifications', 'ยังไม่ได้อ่าน', 'ข้อความของบัญชีนี้', '/notifications', 'rose'),
        ]
      : [
          metric(activeAppointments.length, 'appointments-in-range', `นัดหมาย${rangeSuffix}`, 'ข้อมูลนัดที่บันทึกแล้ว', '/appointments', 'blue'),
          metric(pendingDispensing, 'pending-dispensing', 'รอจ่ายยา', 'ใบสั่งยาที่มีรายการยา', '/pharmacy', 'amber'),
          metric(lowStock.length, 'low-stock', 'ยาใกล้หมด', 'สต๊อกต่ำกว่าหรือเท่าจุดสั่งซื้อ', '/pharmacy', 'rose'),
          metric(expired.length, 'expired', 'ยาหมดอายุ', 'แยกออกจากรายการยาใกล้หมด', '/pharmacy', 'violet'),
        ],
    patient: [
      metric(activeAppointments.length, 'my-appointments', `การนัดหมายของฉัน${rangeSuffix}`, 'ไม่รวมรายการยกเลิกและปฏิเสธ', '/appointments', 'blue'),
      metric(patientMedicationIds.size, 'my-medications', 'ยาที่กำลังใช้', 'นับจากรายการเตือนยาที่ใช้งาน', '/reminders', 'violet'),
      metric(activeReminders.length, 'my-reminders', 'การเตือนที่ใช้งาน', 'เวลาทานยาที่ผู้ป่วยยืนยันแล้ว', '/reminders', 'emerald'),
      metric(unreadNotifications, 'unread-notifications', 'ยังไม่ได้อ่าน', 'ข้อความของบัญชีนี้', '/notifications', 'rose'),
    ],
  };

  const slotsById = new Map(scopedSlots.map((slot) => [slot.id, slot]));
  const doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  const departmentsById = new Map(departments.map((department) => [department.id, department]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const appointmentQueue = activeAppointments
    .map((appointment) => {
      const slot = slotsById.get(appointment.slot_id);
      const doctor = slot ? doctorsById.get(slot.doctor_id) : undefined;
      return {
        id: appointment.id,
        queueNumber: appointment.queue_number,
        date: slot?.slot_date ?? '',
        startTime: slot?.start_time?.slice(0, 5) ?? '',
        status: appointment.status,
        patientName: profilesById.get(appointment.user_id)?.full_name ?? 'ไม่พบบัญชีผู้ป่วย',
        doctorName: slot ? profilesById.get(slot.doctor_id)?.full_name ?? 'ไม่พบแพทย์' : 'ไม่พบแพทย์',
        departmentName: doctor?.department_id
          ? departmentsById.get(doctor.department_id)?.name ?? 'ไม่ระบุแผนก'
          : 'ไม่ระบุแผนก',
      };
    })
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
    .slice(0, 8);

  const departmentLoads = role === 'staff_admin'
    ? departments
        .filter((department) => department.is_active !== false)
        .map((department) => {
          const doctorIds = new Set(doctors.filter((doctor) => doctor.department_id === department.id).map((doctor) => doctor.id));
          const departmentSlots = allRangeSlots.filter((slot) => doctorIds.has(slot.doctor_id));
          const departmentSlotIds = new Set(departmentSlots.map((slot) => slot.id));
          return {
            departmentId: department.id,
            departmentName: department.name,
            appointmentCount: activeAppointments.filter((appointment) => departmentSlotIds.has(appointment.slot_id)).length,
            capacity: departmentSlots.reduce((sum, slot) => sum + slot.max_capacity, 0),
          };
        })
    : [];

  const copyByRole: Record<UserRole, { title: string; description: string }> = {
    staff_admin: { title: 'ภาพรวมงานคลินิกของผู้ดูแลระบบ', description: 'ติดตามนัดหมาย คิว แผนก บัญชี และการประกาศของคลินิก' },
    medical: {
      title: 'ภาพรวมงานแพทย์และเภสัชกรรม',
      description: isDoctorActor ? 'แสดงเฉพาะตารางและคิวของแพทย์ที่เข้าสู่ระบบ พร้อมข้อมูลยา' : 'ติดตามงานจ่ายยาและสถานะคลังยา',
    },
    patient: { title: 'ภาพรวมสุขภาพของฉัน', description: 'นัดหมาย ยา การเตือน และข้อความของบัญชีนี้เท่านั้น' },
  };

  return {
    role,
    actor: { id: actor.id, fullName: actor.full_name },
    date: today,
    startDate,
    range,
    ...copyByRole[role],
    metrics: metricsByRole[role],
    appointmentStatuses: (['pending', 'confirmed', 'in_progress', 'completed'] as AppointmentStatus[]).map((status) => ({
      status,
      label: status === 'pending' ? 'รอยืนยัน' : status === 'confirmed' ? 'ยืนยันแล้ว' : status === 'in_progress' ? 'กำลังตรวจ' : 'เสร็จสิ้น',
      count: activeAppointments.filter((appointment) => appointment.status === status).length,
    })),
    appointmentQueue,
    departmentLoads,
    medicationAlerts: activeMedications
      .filter((medication) => medication.stock <= medication.min_stock || Boolean(medication.expiry_date && medication.expiry_date < today))
      .map((medication) => ({
        id: medication.id,
        name: medication.name,
        stock: medication.stock,
        minimumStock: medication.min_stock,
        expiryDate: medication.expiry_date,
        lowStock: medication.stock <= medication.min_stock && (!medication.expiry_date || medication.expiry_date >= today),
        expired: Boolean(medication.expiry_date && medication.expiry_date < today),
      })),
    recentNotifications: rangeNotifications.slice(0, 5),
    roleCounts: role === 'staff_admin'
      ? (['patient', 'medical', 'staff_admin'] as UserRole[]).map((profileRole) => ({
          role: profileRole,
          count: activeProfiles.filter((profile) => profile.role === profileRole).length,
        }))
      : [],
  };
}

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
export interface StaffProfileUpdate {
  fullName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
}

export async function updateStaffProfile(
  profileId: string,
  update: StaffProfileUpdate,
): Promise<void> {
  const { error } = await supabase.rpc('staff_admin_update_profile', {
    p_profile_id: profileId,
    p_full_name: update.fullName,
    p_phone: update.phone,
    p_role: update.role,
    p_is_active: update.isActive,
  });

  if (error) throw new Error(error.message);
}
