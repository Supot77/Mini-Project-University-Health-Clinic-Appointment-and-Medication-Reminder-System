'use client';

import { Bell, BellRing, CalendarDays, CheckCheck, Inbox, Megaphone, Pill, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClinicMockDatabase } from '@/features/mock-database/ClinicMockProvider';
import { useAuth } from '@/hooks/useAuth';
import type { Notification, NotificationType } from '@/types/database';

type InboxFilter = 'all' | 'unread' | NotificationType;

const filters: Array<{ value: InboxFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' }, { value: 'unread', label: 'ยังไม่อ่าน' },
  { value: 'appointment', label: 'นัดหมาย' }, { value: 'reminder', label: 'เตือนยา' },
  { value: 'broadcast', label: 'ประกาศ' }, { value: 'system', label: 'ระบบ' },
];

const typeMeta: Record<NotificationType, { label: string; icon: typeof Bell; className: string }> = {
  appointment: { label: 'นัดหมาย', icon: CalendarDays, className: 'bg-sky-50 text-sky-700' },
  reminder: { label: 'เตือนยา', icon: Pill, className: 'bg-violet-50 text-violet-700' },
  broadcast: { label: 'ประกาศ', icon: Megaphone, className: 'bg-amber-50 text-amber-700' },
  system: { label: 'ระบบ', icon: BellRing, className: 'bg-slate-100 text-slate-700' },
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const { repositories } = useClinicMockDatabase();
  const auth = useAuth();
  const inboxUserId = auth.user?.id ?? 'profile-peter-parker';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(() => repositories.notifications.listInbox(inboxUserId), [inboxUserId, repositories]);
  const applyInboxResult = useCallback((result: Awaited<ReturnType<typeof loadInbox>>) => {
    if (result.error) setError(result.error.message);
    else { setNotifications(result.data); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadInbox().then((result) => { if (!cancelled) applyInboxResult(result); });
    return () => { cancelled = true; };
  }, [applyInboxResult, loadInbox]);

  const reloadInbox = async () => {
    setLoading(true);
    applyInboxResult(await loadInbox());
  };

  const visibleNotifications = useMemo(() => notifications.filter((notification) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.is_read;
    return notification.type === filter;
  }), [filter, notifications]);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const markRead = async (notification: Notification) => {
    if (notification.is_read || workingId) return;
    setWorkingId(notification.id);
    const result = await repositories.notifications.markReadForUser(notification.id, inboxUserId);
    setWorkingId(null);
    if (result.error) { setError(result.error.message); return; }
    setNotifications((current) => current.map((item) => item.id === notification.id ? result.data : item));
  };

  const markAllRead = async () => {
    if (workingId) return;
    setWorkingId('all');
    for (const notification of notifications.filter((item) => !item.is_read)) {
      const result = await repositories.notifications.markReadForUser(notification.id, inboxUserId);
      if (result.error) { setError(result.error.message); break; }
    }
    setWorkingId(null);
    await reloadInbox();
  };

  const deleteNotification = async (notification: Notification) => {
    if (workingId) return;
    setWorkingId(notification.id);
    const result = await repositories.notifications.deleteForUser(notification.id, inboxUserId);
    setWorkingId(null);
    if (result.error) { setError(result.error.message); return; }
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-700"><BellRing className="size-4" /> กล่องข้อความส่วนตัว</div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">ศูนย์แจ้งเตือน</h1><p className="mt-2 text-sm text-slate-500">นัดหมาย เตือนยา และประกาศที่ส่งถึงบัญชีนี้ · เวลา Asia/Bangkok</p>{!auth.isAuthenticated && <p className="mt-1 text-xs text-amber-700">กำลังแสดงบัญชีสาธิต Peter Parker</p>}</div>
        <button onClick={() => void markAllRead()} disabled={unreadCount === 0 || Boolean(workingId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckCheck className="size-4" /> อ่านทั้งหมด</button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">ข้อความทั้งหมด</p><p className="mt-2 text-2xl font-bold text-slate-950">{notifications.length}</p></div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4"><p className="text-xs font-medium text-sky-700">ยังไม่อ่าน</p><p className="mt-2 text-2xl font-bold text-sky-950">{unreadCount}</p></div>
        <div className="col-span-2 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:col-span-1"><p className="text-xs font-medium text-amber-700">ประกาศ</p><p className="mt-2 text-2xl font-bold text-amber-950">{notifications.filter((item) => item.type === 'broadcast').length}</p></div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="ตัวกรองข้อความ">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${filter === item.value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{item.label}</button>)}</div>

      {error && <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert"><span>{error}</span><button onClick={() => void reloadInbox()} className="inline-flex shrink-0 items-center gap-1 font-semibold"><RefreshCw className="size-4" /> ลองใหม่</button></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-live="polite">
        {loading || auth.isLoading ? <div className="space-y-3 p-5" aria-label="กำลังโหลดข้อความ">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div> : visibleNotifications.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><span className="rounded-2xl bg-slate-100 p-4 text-slate-400"><Inbox className="size-8" /></span><h2 className="mt-4 font-semibold text-slate-800">ไม่มีข้อความในรายการนี้</h2><p className="mt-1 text-sm text-slate-500">เมื่อมีข้อความใหม่ ระบบจะแสดงที่นี่</p></div> : <div className="divide-y divide-slate-100">{visibleNotifications.map((notification) => {
          const meta = typeMeta[notification.type]; const Icon = meta.icon; const busy = workingId === notification.id;
          return <article key={notification.id} className={`group flex gap-3 p-4 transition sm:gap-4 sm:p-5 ${notification.is_read ? 'bg-white' : 'bg-sky-50/40'}`}><button onClick={() => void markRead(notification)} disabled={notification.is_read || busy} aria-label={notification.is_read ? `${notification.title} อ่านแล้ว` : `ทำเครื่องหมาย ${notification.title} ว่าอ่านแล้ว`} className={`mt-0.5 shrink-0 self-start rounded-xl p-2.5 ${meta.className} disabled:cursor-default`}><Icon className="size-5" /></button><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><h2 className={`truncate text-sm sm:text-base ${notification.is_read ? 'font-medium text-slate-700' : 'font-semibold text-slate-950'}`}>{notification.title}</h2>{!notification.is_read && <span className="size-2 shrink-0 rounded-full bg-sky-500" aria-label="ยังไม่อ่าน" />}</div><time className="shrink-0 text-xs text-slate-400">{formatDateTime(notification.created_at)}</time></div><p className="mt-1.5 text-sm leading-6 text-slate-600">{notification.message}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{meta.label}</span></div><button onClick={() => void deleteNotification(notification)} disabled={busy} aria-label={`ลบ ${notification.title} ออกจากกล่องข้อความ`} className="shrink-0 self-start rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Trash2 className="size-4" /></button></article>;
        })}</div>}
      </section>

      <p className="text-center text-xs leading-5 text-slate-400">การอ่านหรือลบมีผลเฉพาะกล่องข้อความของผู้รับรายนี้ ประวัติ Broadcast ส่วนกลางและกล่องของผู้อื่นไม่เปลี่ยนแปลง</p>
    </main>
  );
}
