import type { AppointmentStatus, Notification, NotificationType, UserRole } from '@/types/database';

export type DashboardRange = 'today' | '7d' | '30d';

export interface DashboardMetric {
  id: string;
  label: string;
  value: number | string;
  description: string;
  href: string;
  tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
}

export interface DashboardView {
  role: UserRole;
  actor: { id: string; fullName: string } | null;
  date: string;
  startDate: string;
  range: DashboardRange;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  appointmentStatuses: Array<{ status: AppointmentStatus; label: string; count: number }>;
  appointmentQueue: Array<{
    id: string;
    queueNumber: number | null;
    date: string;
    startTime: string;
    status: AppointmentStatus;
    patientName: string;
    doctorName: string;
    departmentName: string;
  }>;
  departmentLoads: Array<{ departmentId: string; departmentName: string; appointmentCount: number; capacity: number }>;
  medicationAlerts: Array<{ id: string; name: string; stock: number; minimumStock: number; expiryDate: string | null; lowStock: boolean; expired: boolean }>;
  recentNotifications: Notification[];
  roleCounts: Array<{ role: UserRole; count: number }>;
}

export interface BroadcastAudience {
  all: boolean;
  roles: UserRole[];
}

export interface SendBroadcastInput {
  actorId: string;
  actorRole: UserRole;
  notificationType: NotificationType;
  title: string;
  message: string;
  audience: BroadcastAudience;
  requestKey: string;
}

export const roleLabels: Record<UserRole, string> = {
  patient: 'ผู้ป่วย',
  staff: 'เจ้าหน้าที่',
  doctor: 'แพทย์',
  pharmacist: 'เภสัชกร',
  admin: 'ผู้ดูแลระบบ',
};

export const dashboardRangeLabels: Record<DashboardRange, string> = {
  today: 'วันนี้',
  '7d': '7 วันที่ผ่านมา',
  '30d': '30 วันที่ผ่านมา',
};

export const broadcastTypeLabels: Record<NotificationType, string> = {
  broadcast: 'ประกาศทั่วไป',
  system: 'ระบบและการให้บริการ',
  appointment: 'เรื่องนัดหมาย',
  reminder: 'เรื่องการเตือนยา',
};
