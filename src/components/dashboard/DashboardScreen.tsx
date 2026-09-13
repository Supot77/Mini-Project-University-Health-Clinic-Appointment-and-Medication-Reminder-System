'use client';

import Link from 'next/link';
import {
  Activity, Bell, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Clock3, Menu, X,
  Filter, PackageCheck, PackageX, Pill, RefreshCw, Send, ShieldCheck, UserRound, Users,
  type LucideIcon,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  dashboardRangeLabels,
  roleLabels,
  type BroadcastHistoryItem,
  type DashboardRange,
  type DashboardView,
} from '@/features/dashboard/types';
import { getBroadcastHistory, getDashboardView, sendBroadcast } from '@/services/dashboardService';
import type { AppointmentStatus } from '@/types/database';
import Toast from '@/components/common/Toast';
const metricIcons: Record<string, LucideIcon> = {
  'appointments-in-range': CalendarDays, 'remaining-queue': Clock3, 'department-workload': Activity,
  'unread-notifications': Bell, 'own-appointments': CalendarDays, 'own-queue': ClipboardList,
  'completed-in-range': CheckCircle2, 'pending-dispensing': Pill, backorders: PackageX,
  'low-stock': PackageX, expired: PackageX, accounts: Users, permissions: ShieldCheck,
  'system-status': Activity, 'aggregate-appointments': CalendarDays, 'my-appointments': CalendarDays,
  'my-medications': Pill, 'my-reminders': Bell,
};

const toneClasses = {
  blue: 'bg-status-info-bg text-status-info ring-brand-border', emerald: 'bg-status-success-bg text-status-success ring-emerald-200',
  amber: 'bg-status-warning-bg text-status-warning ring-amber-200', violet: 'bg-status-info-bg text-status-info ring-brand-border',
  rose: 'bg-status-critical-bg text-status-critical ring-red-200',
};

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', in_progress: 'กำลังตรวจ', completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก', no_show: 'ไม่มาตามนัด', rejected: 'ปฏิเสธ',
};

const appointmentStatusClasses: Record<AppointmentStatus, string> = {
  pending: 'bg-status-warning-bg text-status-warning', confirmed: 'bg-status-info-bg text-status-info',
  in_progress: 'bg-status-info-bg text-status-info', completed: 'bg-status-success-bg text-status-success',
  cancelled: 'bg-status-neutral-bg text-status-neutral', no_show: 'bg-status-critical-bg text-status-critical', rejected: 'bg-status-critical-bg text-status-critical',
};

const broadcastRoleOrder = ['patient', 'medical', 'staff_admin'] as const;

function bangkokDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function bangkokDateFromTimestamp(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok',
  }).formatToParts(new Date(value));
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function rangeStartDate(today: string, range: DashboardRange): string {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

function formatThaiDate(date: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`));
}

function formatThaiDateTime(dateTime: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(new Date(dateTime));
}

function formatThaiRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatThaiDate(endDate);
  const formatter = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
  });
  return `${formatter.format(new Date(`${startDate}T12:00:00+07:00`))} – ${formatter.format(new Date(`${endDate}T12:00:00+07:00`))}`;
}

function rangeHeading(prefix: string, range: DashboardRange): string {
  return `${prefix}${range === 'today' ? dashboardRangeLabels[range] : ` ${dashboardRangeLabels[range]}`}`;
}

function Section({ title, description, action, children, className = '' }: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div><h2 className="font-semibold text-slate-950">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center"><PackageCheck className="mb-3 size-8 text-slate-300" aria-hidden="true" /><p className="text-sm font-medium text-slate-600">{message}</p></div>;
}

function BroadcastPanel({ range }: { range: DashboardRange }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const requestKey = useRef(crypto.randomUUID());

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getBroadcastHistory(100));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดประวัติ Broadcast ไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadHistory(); }, 0);
    const poller = window.setInterval(() => { void loadHistory(); }, 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
    };
  }, [loadHistory]);

  const filteredHistory = history.filter((item) => {
    const sentDate = bangkokDateFromTimestamp(item.sentAt);
    return sentDate >= rangeStartDate(bangkokDate(), range) && sentDate <= bangkokDate();
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await sendBroadcast(title, message, requestKey.current);
      setSuccess(`${result.created ? 'ส่ง Broadcast สำเร็จ' : 'คำขอนี้ถูกส่งแล้ว'} · ผู้รับ ${result.recipientCount} คน`);
      if (result.created) {
        setTitle('');
        setMessage('');
        requestKey.current = crypto.randomUUID();
        await loadHistory();
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'ส่ง Broadcast ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="ส่งประกาศ Broadcast" description="ส่งประกาศเดียวถึงบัญชีที่ใช้งานอยู่ทุกบทบาท และบันทึกลงกล่องแจ้งเตือน">
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
        <label className="block text-sm font-medium text-slate-700">Topic<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="เช่น แจ้งเปลี่ยนเวลาทำการ" /></label>
        <label className="block text-sm font-medium text-slate-700">ข้อความ<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} required rows={4} className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="รายละเอียดประกาศ" /></label>
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><div aria-live="polite" className="text-sm text-rose-700">{error}</div><button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}{busy ? 'กำลังส่ง…' : 'ยืนยันการส่ง'}</button></div>
      </form>
      <div className="border-t border-slate-200 px-5 py-5 sm:px-6"><h3 className="font-semibold text-slate-900">ประวัติ Broadcast ที่ส่งสำเร็จ</h3>{filteredHistory.length === 0 ? <p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติการส่งในช่วง{range === 'today' ? 'วันนี้' : range === '7d' ? ' 7 วันที่ผ่านมา' : ' 30 วันที่ผ่านมา'}</p> : <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">{filteredHistory.map((item) => <article key={item.id} className="p-4"><div className="flex flex-col justify-between gap-1 sm:flex-row"><h4 className="font-medium text-slate-900">{item.title}</h4><time className="text-xs text-slate-400">{formatThaiDate(bangkokDateFromTimestamp(item.sentAt))}</time></div><p className="mt-2 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs text-emerald-700">ส่งสำเร็จ · ผู้รับ {item.recipientCount} คน · อ่านแล้ว {item.readCount ?? 0} คน</p><div className="mt-3 flex flex-wrap gap-2">{broadcastRoleOrder.map((role) => { const summary = item.roleReadCounts?.[role] ?? { read: 0, total: 0 }; return <span key={role} className={`rounded-full px-2.5 py-1 text-xs font-medium ${summary.total > 0 && summary.read === summary.total ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{roleLabels[role]} อ่านแล้ว {summary.read}/{summary.total}</span>; })}</div></article>)}</div>}</div>
      <Toast message={success} onDismiss={() => setSuccess(null)} />
    </Section>
  );
}

export default function DashboardScreen({
  role,
  actorId,
}: {
  role: 'staff_admin' | 'medical' | 'patient';
  actorId: string;
}) {
  const [range, setRange] = useState<DashboardRange>('today');
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  const refreshDashboard = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setLoading(true);
    setRefreshToken((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getDashboardView(role, actorId, bangkokDate(), range)
        .then((viewResult) => {
          if (!cancelled) {
            setView(viewResult);
            setError(null);
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setView(null);
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูล Dashboard ไม่สำเร็จ');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            setIsRefreshing(false);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [actorId, range, refreshToken, role]);

  if (loading) {
    return <div className="mx-auto max-w-7xl animate-pulse space-y-6" aria-busy="true" aria-label="กำลังโหลดแดชบอร์ด"><div className="h-24 rounded-2xl bg-slate-200" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200" />)}</div><div className="h-64 rounded-2xl bg-slate-200" /></div>;
  }

  if (error || !view) {
    return <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" role="alert"><PackageX className="size-10 text-rose-500" /><h1 className="mt-4 text-xl font-bold text-rose-950">โหลดข้อมูล Dashboard ไม่สำเร็จ</h1><p className="mt-2 text-sm text-rose-700">{error ?? 'ไม่พบข้อมูลสำหรับบทบาทนี้'}</p><button onClick={() => { setLoading(true); setRefreshToken((value) => value + 1); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="size-4" /> ลองอีกครั้ง</button></div>;
  }

  return (
    <main className="dashboard-shell mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <button type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-expanded={isMenuOpen} aria-controls="dashboard-function-menu" className="absolute right-5 top-5 z-10 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:border-teal-300 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600"><span className="flex size-6 items-center justify-center">{isMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}</span><span className="hidden sm:inline">{isMenuOpen ? 'ซ่อนเมนู' : 'เมนูฟังก์ชัน'}</span></button>
        <div className="relative grid gap-6 px-6 py-7 pr-24 sm:px-8 sm:pr-28">
          <div className="absolute inset-y-0 left-0 w-2 bg-sky-500" aria-hidden="true" />
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-teal-700">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1">OPERATIONS DASHBOARD</span>
              <span className="text-slate-500">{roleLabels[role]} · ASIA/BANGKOK</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-3xl">{view.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{view.description}</p>
          </div>
        </div>
      </header>

      <div className={`grid items-start gap-6 ${isMenuOpen ? 'lg:grid-cols-[290px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
        {isMenuOpen && <button type="button" onClick={() => setIsMenuOpen(false)} aria-label="ปิดเมนูฟังก์ชัน" className="fixed inset-0 z-40 bg-slate-950/20 lg:hidden" />}
        {isMenuOpen && <aside id="dashboard-function-menu" className="fixed inset-y-0 left-0 z-50 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto bg-slate-50 p-4 shadow-2xl lg:sticky lg:top-6 lg:z-auto lg:w-auto lg:overflow-visible lg:bg-transparent lg:p-0 lg:shadow-none" aria-label="เมนูฟังก์ชัน Dashboard">
          <nav className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between px-3"><p className="text-base font-semibold text-slate-800">ฟังก์ชันหลัก</p><span className="text-sm text-slate-400">กดเพื่อเปิด</span></div>
            <div className="flex flex-col gap-1">
              {view.metrics.map((item) => { const Icon = metricIcons[item.id] ?? Activity; return <Link key={item.id} href={item.href} onClick={() => setIsMenuOpen(false)} className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-teal-200 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-600"><span className={`shrink-0 rounded-lg p-2 ring-1 ${toneClasses[item.tone]}`}><Icon className="size-5" aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-800">{item.label}</span><ChevronRight className="size-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>; })}
            </div>
          </nav>
        </aside>}

        <div className="min-w-0 space-y-5">
          <section aria-label="ข้อมูลสรุป" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {view.metrics.map((item) => { const Icon = metricIcons[item.id] ?? Activity; return <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-600">{item.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{item.value}</p></div><span className={`rounded-xl p-3 ring-1 ${toneClasses[item.tone]}`}><Icon className="size-6" aria-hidden="true" /></span></div><p className="mt-4 text-sm leading-6 text-slate-500">{item.description}</p></div>; })}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs" aria-label="ตัวกรองแดชบอร์ด">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-2 px-1 text-sm font-semibold text-slate-700"><Filter className="size-4 text-teal-700" aria-hidden="true" />ช่วงข้อมูล</div>
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:flex-initial" role="group" aria-label="เลือกช่วงข้อมูลย้อนหลัง">
                {(Object.entries(dashboardRangeLabels) as Array<[DashboardRange, string]>).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={range === value} onClick={() => { if (value !== range) { setLoading(true); setRange(value); } }} className={`min-h-11 min-w-[108px] shrink-0 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${range === value ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}>{label}</button>
                ))}
              </div>
              <div className="text-center text-sm font-semibold tabular-nums text-slate-600 lg:ml-2">{formatThaiRange(view.startDate, view.date)}</div>
              <div className="flex flex-wrap gap-2 lg:ml-auto">
                <button type="button" onClick={() => void refreshDashboard()} disabled={isRefreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />{isRefreshing ? 'กำลังโหลด…' : 'รีเฟรช'}</button>
              </div>
            </div>
          </section>

          <div className={`grid gap-6 ${role === 'staff_admin' ? 'lg:grid-cols-1' : 'lg:grid-cols-[1.4fr_1fr]'}`}><Section title={rangeHeading('สถานะนัดหมาย', view.range)} description={role === 'medical' ? 'แสดงเฉพาะนัดในตารางของแพทย์คนนี้' : role === 'patient' ? 'แสดงเฉพาะนัดหมายของบัญชีนี้' : 'ไม่รวมรายการยกเลิกและปฏิเสธ'}><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">{view.appointmentStatuses.map((item) => <div key={item.status} className="p-5"><p className="text-2xl font-bold text-slate-950">{item.count}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></div>)}</div></Section>{role !== 'staff_admin' && <Section title={rangeHeading('การแจ้งเตือน', view.range)} action={<Link href="/notifications" className="text-sm font-medium text-sky-700">ดูทั้งหมด</Link>}>{view.recentNotifications.length === 0 ? <EmptyState message="ยังไม่มีการแจ้งเตือนในช่วงนี้" /> : <div className="divide-y divide-slate-100">{view.recentNotifications.map((notification) => <div key={notification.id} className="flex gap-3 px-5 py-4"><span className={`mt-1 size-2 shrink-0 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-sky-500'}`} /><div className="min-w-0"><p className="text-sm font-medium text-slate-800">{notification.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{notification.message}</p><time dateTime={notification.created_at} className="mt-2 block text-[11px] text-slate-400">ส่งเมื่อ {formatThaiDateTime(notification.created_at)} น.</time></div></div>)}</div>}</Section>}</div>

      <Section title={role === 'patient' ? 'นัดหมายของฉัน' : role === 'medical' ? 'คิวและนัดหมายของฉัน' : 'คิวและนัดหมายล่าสุด'} description={`แสดงข้อมูลจำเป็นต่อการทำงานในช่วง ${dashboardRangeLabels[view.range]} โดยไม่เปิดเผยผลตรวจ`} action={<Link href="/appointments" className="text-sm font-semibold text-sky-700">จัดการนัดหมาย</Link>}>{view.appointmentQueue.length === 0 ? <EmptyState message="ไม่มีนัดหมายในช่วงที่เลือก" /> : <div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[80px_120px_1.2fr_1fr_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500"><span>คิว</span><span>วันเวลา</span><span>ผู้ป่วย</span><span>{role === 'medical' ? 'แผนก' : 'แพทย์ / แผนก'}</span><span>สถานะ</span></div><div className="divide-y divide-slate-100">{view.appointmentQueue.map((item) => <div key={item.id} className="grid grid-cols-[80px_120px_1.2fr_1fr_130px] items-center gap-4 px-5 py-4 text-sm"><span className="font-bold tabular-nums text-slate-950">{item.queueNumber ? `#${item.queueNumber}` : '—'}</span><span className="text-slate-600"><span className="block">{new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(`${item.date}T12:00:00+07:00`))}</span><span className="text-xs text-slate-400">{item.startTime} น.</span></span><span className="font-semibold text-slate-800">{item.patientName}</span><span className="text-slate-600">{role === 'medical' ? item.departmentName : <>{item.doctorName}<span className="block text-xs text-slate-400">{item.departmentName}</span></>}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${appointmentStatusClasses[item.status]}`}>{appointmentStatusLabels[item.status]}</span></div>)}</div></div></div>}</Section>

      {role === 'staff_admin' && <Section title="ภาระงานแยกตามแผนก" description={`จำนวนผู้รับบริการเทียบกับความจุในช่วง ${dashboardRangeLabels[view.range]}`} action={<Link href="/departments" className="text-sm font-medium text-sky-700">จัดการแผนก</Link>}><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">{view.departmentLoads.map((department) => { const ratio = department.capacity === 0 ? 0 : Math.min(100, Math.round((department.appointmentCount / department.capacity) * 100)); return <div key={department.departmentId} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-4"><p className="text-sm font-medium text-slate-800">{department.departmentName}</p><span className="text-xs text-slate-500">{department.appointmentCount}/{department.capacity}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${ratio}%` }} /></div></div>; })}</div></Section>}

      {role === 'staff_admin' && <Section title="รายการยาที่ต้องตรวจสอบ" description="ยาหมดอายุถูกแยกออกจากยาใกล้หมดตามกฎระบบ" action={<Link href="/pharmacy" className="text-sm font-medium text-sky-700">ดูคลังยา</Link>}>{view.medicationAlerts.length === 0 ? <EmptyState message="ไม่มีรายการยาที่ต้องตรวจสอบ" /> : <div className="divide-y divide-slate-100">{view.medicationAlerts.map((medication) => <div key={medication.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"><div><p className="font-medium text-slate-800">{medication.name}</p><p className="mt-1 text-xs text-slate-500">คงเหลือ {medication.stock} · จุดสั่งซื้อ {medication.minimumStock}</p></div><div className="flex flex-wrap gap-2">{medication.lowStock && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">ใกล้หมด</span>}{medication.expired && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">หมดอายุ</span>}</div></div>)}</div>}<div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-800">หมายเหตุ: สูตร Available/Reserved และงานแบ่งจ่ายยังรอข้อสรุปจากทีม จึงแสดงเฉพาะข้อมูลที่ยืนยันแล้วใน mock ปัจจุบัน</div></Section>}

      {role === 'staff_admin' && <><Section title="จำนวนบัญชีแยกตามบทบาท" description="แสดงเฉพาะข้อมูลรวม ไม่แสดงรายละเอียดหรือผลตรวจของผู้ป่วย" action={<Link href="/staff/accounts" className="text-sm font-medium text-sky-700">ดูรายชื่อบัญชีทั้งหมด</Link>}><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0">{view.roleCounts.map((item) => <div key={item.role} className="p-5"><p className="text-2xl font-bold text-slate-950">{item.count}</p><p className="mt-1 text-xs text-slate-500">{roleLabels[item.role]}</p></div>)}</div></Section>{view.actor && <BroadcastPanel range={range} />}</>}

        </div>
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-400"><UserRound className="size-3.5" /> ข้อมูล Dashboard จาก Supabase · {view.actor?.fullName ?? 'ไม่พบบัญชีสำหรับบทบาทนี้'}</p>
    </main>
  );
}
