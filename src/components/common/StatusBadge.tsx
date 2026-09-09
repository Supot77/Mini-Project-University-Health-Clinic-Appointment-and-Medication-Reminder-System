import type { AppointmentStatus } from '@/types/database';

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: 'รอยืนยัน', className: 'bg-status-warning-bg text-status-warning' },
  confirmed: { label: 'ยืนยันแล้ว', className: 'bg-status-info-bg text-status-info' },
  in_progress: { label: 'กำลังตรวจ', className: 'bg-status-info-bg text-status-info' },
  completed: { label: 'ตรวจเสร็จ', className: 'bg-status-success-bg text-status-success' },
  cancelled: { label: 'ยกเลิก', className: 'bg-status-neutral-bg text-status-neutral' },
  no_show: { label: 'ไม่มาตามนัด', className: 'bg-status-critical-bg text-status-critical' },
  rejected: { label: 'ปฏิเสธ', className: 'bg-status-critical-bg text-status-critical' },
};

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
