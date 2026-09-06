'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, Bell, CalendarDays, CheckCircle2, ClipboardList, Clock3,
  Filter, PackageCheck, PackageX, Pill, RefreshCw, Send, ShieldCheck, UserRound, Users,
  type LucideIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  broadcastTypeLabels,
  dashboardRangeLabels,
  roleLabels,
  type DashboardRange,
  type DashboardView,
} from '@/features/dashboard/types';
import { useClinicMockDatabase } from '@/features/mock-database/ClinicMockProvider';
import { useAuth } from '@/hooks/useAuth';
import type { AppointmentStatus, NotificationType, UserRole } from '@/types/database';

const dashboardRoles: UserRole[] = ['staff', 'doctor', 'pharmacist', 'admin'];
const audienceRoles: UserRole[] = ['patient', 'staff', 'doctor', 'pharmacist', 'admin'];
const metricIcons: Record<string, LucideIcon> = {
  'appointments-in-range': CalendarDays, 'remaining-queue': Clock3, 'department-workload': Activity,
  'unread-notifications': Bell, 'own-appointments': CalendarDays, 'own-queue': ClipboardList,
  'completed-in-range': CheckCircle2, 'pending-dispensing': Pill, backorders: PackageX,
  'low-stock': PackageX, expired: PackageX, accounts: Users, permissions: ShieldCheck,
  'system-status': Activity, 'aggregate-appointments': CalendarDays, 'my-appointments': CalendarDays,
  'my-medications': Pill, 'my-reminders': Bell,
};

const toneClasses = {
  blue: 'bg-sky-50 text-sky-700 ring-sky-100', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100', violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
};

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', in_progress: 'กำลังตรวจ', completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก', no_show: 'ไม่มาตามนัด', rejected: 'ปฏิเสธ',
};

const appointmentStatusClasses: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-50 text-amber-800', confirmed: 'bg-sky-50 text-sky-700',
  in_progress: 'bg-violet-50 text-violet-700', completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600', no_show: 'bg-rose-50 text-rose-700', rejected: 'bg-rose-50 text-rose-700',
};

function bangkokDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatThaiDate(date: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`));
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
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
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

function BroadcastPanel({ actorId, onSent }: { actorId: string; onSent: () => void }) {
  const { repositories } = useClinicMockDatabase();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('broadcast');
  const [sendAll, setSendAll] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const requestKey = useRef(crypto.randomUUID());
  const toggleRole = (role: UserRole) => setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    const result = await repositories.notifications.sendBroadcast({
      actorId, actorRole: 'admin', notificationType, title, message,
      audience: { all: sendAll, roles: selectedRoles }, requestKey: requestKey.current,
    });
    setBusy(false);
    if (result.error) { setFeedback({ ok: false, text: result.error.message }); return; }
    setFeedback({ ok: true, text: `${result.data.created ? 'ส่งสำเร็จ' : 'คำขอนี้ถูกส่งแล้ว'} · ผู้รับ ${result.data.recipientCount} คน` });
    if (result.data.created) {
      setTitle(''); setMessage(''); requestKey.current = crypto.randomUUID(); onSent();
    }
  };

  return (
    <Section title="ส่งประกาศ Broadcast" description="เฉพาะ Admin · ระบบตรึงรายชื่อผู้รับ ณ เวลาส่งและตัดผู้รับซ้ำให้อัตโนมัติ">
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">หัวข้อ<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="เช่น แจ้งเปลี่ยนเวลาทำการ" /></label>
          <label className="text-sm font-medium text-slate-700">ประเภทเรื่อง<select value={notificationType} onChange={(event) => setNotificationType(event.target.value as NotificationType)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">{(Object.entries(broadcastTypeLabels) as Array<[NotificationType, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">กลุ่มผู้รับ<select value={sendAll ? 'all' : 'roles'} onChange={(event) => setSendAll(event.target.value === 'all')} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="all">ผู้ใช้ทุกคน</option><option value="roles">เลือกตามบทบาท</option></select></label>
        </div>
        {!sendAll && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <fieldset><legend className="text-sm font-medium text-slate-700">เลือกบทบาทผู้รับอย่างน้อย 1 กลุ่ม</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{audienceRoles.map((role) => <label key={role} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200"><input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} className="size-4 accent-sky-600" />{roleLabels[role]}</label>)}</div></fieldset>
          </div>
        )}
        <label className="block text-sm font-medium text-slate-700">ข้อความ<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} required rows={4} className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="รายละเอียดประกาศ" /></label>
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><div aria-live="polite" className={`text-sm ${feedback?.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{feedback?.text}</div><button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}{busy ? 'กำลังส่ง…' : 'ส่งประกาศ'}</button></div>
      </form>
    </Section>
  );
}

export default function DashboardPage() {
  const { repositories } = useClinicMockDatabase();
  const auth = useAuth();
  const router = useRouter();
  const authenticatedRole = dashboardRoles.find((role) => role === auth.user?.role);
  const [previewRole, setPreviewRole] = useState<UserRole>('staff');
  const [range, setRange] = useState<DashboardRange>('today');
  const role = authenticatedRole ?? previewRole;
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!auth.isLoading && auth.user?.role === 'patient') router.replace('/appointments');
  }, [auth.isLoading, auth.user?.role, router]);

  useEffect(() => {
    if (auth.isLoading || auth.user?.role === 'patient') return;
    let cancelled = false;
    void repositories.dashboard.getView(role, auth.user?.id, bangkokDate(), range).then((viewResult) => {
      if (cancelled) return;
      if (viewResult.error) { setView(null); setError(viewResult.error.message); } else { setView(viewResult.data); setError(null); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [auth.isLoading, auth.user?.id, auth.user?.role, range, refreshToken, repositories, role]);

  if (loading || auth.isLoading) {
    return <div className="mx-auto max-w-7xl animate-pulse space-y-6" aria-busy="true" aria-label="กำลังโหลดแดชบอร์ด"><div className="h-24 rounded-2xl bg-slate-200" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200" />)}</div><div className="h-64 rounded-2xl bg-slate-200" /></div>;
  }

  if (error || !view) {
    return <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" role="alert"><PackageX className="size-10 text-rose-500" /><h1 className="mt-4 text-xl font-bold text-rose-950">โหลดข้อมูล Dashboard ไม่สำเร็จ</h1><p className="mt-2 text-sm text-rose-700">{error ?? 'ไม่พบข้อมูลสำหรับบทบาทนี้'}</p><button onClick={() => { setLoading(true); setRefreshToken((value) => value + 1); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white"><RefreshCw className="size-4" /> ลองอีกครั้ง</button></div>;
  }

  return (
    <main className="dashboard-shell mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
        <div className="relative grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="absolute inset-y-0 left-0 w-2 bg-sky-500" aria-hidden="true" />
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-sky-700">
              <span className="rounded-full bg-sky-50 px-3 py-1 ring-1 ring-sky-100">OPERATIONS DASHBOARD</span>
              <span className="text-slate-400">{roleLabels[role]} · ASIA/BANGKOK</span>
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] text-slate-950 text-balance sm:text-4xl">{view.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{view.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {view.metrics.slice(0, 4).map((item) => (
              <div key={item.id} className="min-w-24 rounded-2xl bg-slate-50 px-3 py-3 text-center ring-1 ring-slate-200/70">
                <div className="text-xl font-bold tabular-nums text-slate-950">{item.value}</div>
                <div className="mt-1 line-clamp-1 text-[11px] text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="rounded-2xl bg-[#0a2540] p-4 text-white shadow-[0_10px_34px_rgba(10,37,64,0.14)]" aria-label="ตัวกรองแดชบอร์ด">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Filter className="size-4" aria-hidden="true" />ช่วงข้อมูล</div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="เลือกช่วงข้อมูลย้อนหลัง">
            {(Object.entries(dashboardRangeLabels) as Array<[DashboardRange, string]>).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={range === value} onClick={() => { if (value !== range) { setLoading(true); setRange(value); } }} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${range === value ? 'bg-white text-[#0a2540]' : 'bg-white/8 text-slate-200 hover:bg-white/15'}`}>{label}</button>
            ))}
          </div>
          <div className="text-center text-sm font-semibold tabular-nums text-white lg:ml-2">{formatThaiRange(view.startDate, view.date)}</div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {!authenticatedRole && <label><span className="sr-only">มุมมองสาธิต</span><select value={previewRole} onChange={(event) => { setLoading(true); setPreviewRole(event.target.value as UserRole); }} className="h-11 min-w-44 rounded-xl border border-white/15 bg-white/8 px-3 text-sm text-white outline-none focus:border-sky-300 [&>option]:text-slate-950">{dashboardRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>}
            <button type="button" onClick={() => { setLoading(true); setRefreshToken((value) => value + 1); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 text-sm font-bold text-[#0a2540] hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"><RefreshCw className="size-4" aria-hidden="true" />รีเฟรช</button>
          </div>
        </div>
      </section>

      <section aria-label="ข้อมูลสรุป" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.metrics.map((item) => { const Icon = metricIcons[item.id] ?? Activity; return <Link key={item.id} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-600">{item.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{item.value}</p></div><span className={`rounded-xl p-2.5 ring-1 ${toneClasses[item.tone]}`}><Icon className="size-5" aria-hidden="true" /></span></div><p className="mt-3 text-xs leading-5 text-slate-500">{item.description}</p></Link>; })}
      </section>

      {(role === 'staff' || role === 'doctor') && <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><Section title={rangeHeading('สถานะนัดหมาย', view.range)} description={role === 'doctor' ? 'แสดงเฉพาะนัดในตารางของแพทย์คนนี้' : 'ไม่รวมรายการยกเลิกและปฏิเสธ'}><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">{view.appointmentStatuses.map((item) => <div key={item.status} className="p-5"><p className="text-2xl font-bold text-slate-950">{item.count}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></div>)}</div></Section><Section title={rangeHeading('การแจ้งเตือน', view.range)} action={<Link href="/notifications" className="text-sm font-medium text-sky-700">ดูทั้งหมด</Link>}>{view.recentNotifications.length === 0 ? <EmptyState message="ยังไม่มีการแจ้งเตือนในช่วงนี้" /> : <div className="divide-y divide-slate-100">{view.recentNotifications.map((notification) => <div key={notification.id} className="flex gap-3 px-5 py-4"><span className={`mt-1 size-2 shrink-0 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-sky-500'}`} /><div><p className="text-sm font-medium text-slate-800">{notification.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{notification.message}</p></div></div>)}</div>}</Section></div>}

      {(role === 'staff' || role === 'doctor') && <Section title={role === 'doctor' ? 'คิวและนัดหมายของฉัน' : 'คิวและนัดหมายล่าสุด'} description={`แสดงข้อมูลจำเป็นต่อการทำงานในช่วง ${dashboardRangeLabels[view.range]} โดยไม่เปิดเผยผลตรวจ`} action={<Link href="/appointments" className="text-sm font-semibold text-sky-700">จัดการนัดหมาย</Link>}>{view.appointmentQueue.length === 0 ? <EmptyState message="ไม่มีนัดหมายในช่วงที่เลือก" /> : <div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[80px_120px_1.2fr_1fr_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500"><span>คิว</span><span>วันเวลา</span><span>ผู้ป่วย</span><span>{role === 'doctor' ? 'แผนก' : 'แพทย์ / แผนก'}</span><span>สถานะ</span></div><div className="divide-y divide-slate-100">{view.appointmentQueue.map((item) => <div key={item.id} className="grid grid-cols-[80px_120px_1.2fr_1fr_130px] items-center gap-4 px-5 py-4 text-sm"><span className="font-bold tabular-nums text-slate-950">{item.queueNumber ? `#${item.queueNumber}` : '—'}</span><span className="text-slate-600"><span className="block">{new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(`${item.date}T12:00:00+07:00`))}</span><span className="text-xs text-slate-400">{item.startTime} น.</span></span><span className="font-semibold text-slate-800">{item.patientName}</span><span className="text-slate-600">{role === 'doctor' ? item.departmentName : <>{item.doctorName}<span className="block text-xs text-slate-400">{item.departmentName}</span></>}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${appointmentStatusClasses[item.status]}`}>{appointmentStatusLabels[item.status]}</span></div>)}</div></div></div>}</Section>}

      {role === 'staff' && <Section title="ภาระงานแยกตามแผนก" description={`จำนวนผู้รับบริการเทียบกับความจุในช่วง ${dashboardRangeLabels[view.range]}`}><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">{view.departmentLoads.map((department) => { const ratio = department.capacity === 0 ? 0 : Math.min(100, Math.round((department.appointmentCount / department.capacity) * 100)); return <div key={department.departmentId} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-4"><p className="text-sm font-medium text-slate-800">{department.departmentName}</p><span className="text-xs text-slate-500">{department.appointmentCount}/{department.capacity}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${ratio}%` }} /></div></div>; })}</div></Section>}

      {role === 'pharmacist' && <Section title="รายการยาที่ต้องตรวจสอบ" description="ยาหมดอายุถูกแยกออกจากยาใกล้หมดตามกฎระบบ" action={<Link href="/pharmacy" className="text-sm font-medium text-sky-700">ดูคลังยา</Link>}>{view.medicationAlerts.length === 0 ? <EmptyState message="ไม่มีรายการยาที่ต้องตรวจสอบ" /> : <div className="divide-y divide-slate-100">{view.medicationAlerts.map((medication) => <div key={medication.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"><div><p className="font-medium text-slate-800">{medication.name}</p><p className="mt-1 text-xs text-slate-500">คงเหลือ {medication.stock} · จุดสั่งซื้อ {medication.minimumStock}</p></div><div className="flex flex-wrap gap-2">{medication.lowStock && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">ใกล้หมด</span>}{medication.expired && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">หมดอายุ</span>}</div></div>)}</div>}<div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-800">หมายเหตุ: สูตร Available/Reserved และงานแบ่งจ่ายยังรอข้อสรุปจากทีม จึงแสดงเฉพาะข้อมูลที่ยืนยันแล้วใน mock ปัจจุบัน</div></Section>}

      {role === 'admin' && <><Section title="จำนวนบัญชีแยกตามบทบาท" description="แสดงเฉพาะข้อมูลรวม ไม่แสดงรายละเอียดหรือผลตรวจของผู้ป่วย"><div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-5 sm:divide-y-0">{view.roleCounts.map((item) => <div key={item.role} className="p-5"><p className="text-2xl font-bold text-slate-950">{item.count}</p><p className="mt-1 text-xs text-slate-500">{roleLabels[item.role]}</p></div>)}</div></Section>{view.actor && <BroadcastPanel actorId={view.actor.id} onSent={() => setRefreshToken((value) => value + 1)} />}</>}

      <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-400"><UserRound className="size-3.5" /> ข้อมูลสาธิตจาก Mock Repository · {view.actor?.fullName ?? 'ไม่พบบัญชีสำหรับบทบาทนี้'}</p>
    </main>
  );
}
