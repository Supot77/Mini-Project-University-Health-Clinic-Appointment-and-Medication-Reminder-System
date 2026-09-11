'use client';

import { Bell, BellRing, CalendarDays, CheckCheck, Filter, Inbox, Megaphone, Pill, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteNotification as deleteNotificationFromDatabase,
  getNotifications,
  markAllAsRead,
  markAsRead,
} from '@/services/dashboardService';
import type { Notification, NotificationType } from '@/types/database';

type InboxFilter = 'all' | 'unread' | NotificationType;

const filters: Array<{ value: InboxFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' }, { value: 'unread', label: 'ยังไม่อ่าน' },
  { value: 'appointment', label: 'นัดหมาย' }, { value: 'reminder', label: 'เตือนยา' },
  { value: 'broadcast', label: 'ประกาศ' },
];

const typeMeta: Record<NotificationType, { label: string; icon: typeof Bell; className: string }> = {
  appointment: { label: 'นัดหมาย', icon: CalendarDays, className: 'bg-status-info-bg text-status-info' },
  reminder: { label: 'เตือนยา', icon: Pill, className: 'bg-status-warning-bg text-status-warning' },
  broadcast: { label: 'ประกาศ', icon: Megaphone, className: 'bg-status-warning-bg text-status-warning' },
  system: { label: 'ระบบ', icon: BellRing, className: 'bg-status-neutral-bg text-status-neutral' },
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const auth = useAuth();
  const inboxUserId = auth.user?.id ?? null;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    if (!inboxUserId) return [];
    return getNotifications(inboxUserId, 100);
  }, [inboxUserId]);

  useEffect(() => {
    let cancelled = false;
    void loadInbox()
      .then((data) => {
        if (!cancelled) {
          setNotifications(data);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'โหลดการแจ้งเตือนไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadInbox]);

  const reloadInbox = async () => {
    setLoading(true);
    try {
      setNotifications(await loadInbox());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดการแจ้งเตือนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const visibleNotifications = useMemo(() => notifications.filter((notification) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.is_read;
    return notification.type === filter;
  }), [filter, notifications]);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const broadcastCount = notifications.filter((item) => item.type === 'broadcast').length;

  const markRead = async (notification: Notification) => {
    if (notification.is_read || workingId) return;
    setWorkingId(notification.id);
    try {
      const updated = await markAsRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? updated : item));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications-updated'));
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'บันทึกสถานะอ่านไม่สำเร็จ');
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = async () => {
    if (workingId || !inboxUserId) return;
    setWorkingId('all');
    try {
      await markAllAsRead(inboxUserId);
      await reloadInbox();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications-updated'));
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'บันทึกสถานะอ่านทั้งหมดไม่สำเร็จ');
    } finally {
      setWorkingId(null);
    }
  };

  const deleteNotification = async (notification: Notification) => {
    if (workingId) return;
    setWorkingId(notification.id);
    try {
      await deleteNotificationFromDatabase(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications-updated'));
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ลบการแจ้งเตือนไม่สำเร็จ');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="dashboard-shell mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="absolute inset-y-0 left-0 w-2 bg-sky-500" aria-hidden="true" />
        <div className="relative px-6 py-5 sm:px-8 sm:py-6">
          <div className="absolute right-4 top-4 flex gap-2 sm:right-8 sm:top-6">
            <button onClick={() => void reloadInbox()} disabled={loading || auth.isLoading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> รีเฟรช
            </button>
          </div>
          <div className="pr-24 sm:pr-32">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-teal-700">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1">NOTIFICATION CENTER</span>
              <span className="text-slate-500">กล่องข้อความส่วนตัว · ASIA/BANGKOK</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-3xl">ศูนย์แจ้งเตือน</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">นัดหมาย เตือนยา และประกาศที่ส่งถึงบัญชีนี้</p>
            {!auth.isLoading && !auth.isAuthenticated && <p className="mt-2 text-xs font-semibold text-amber-700">กรุณาเข้าสู่ระบบเพื่อดูการแจ้งเตือน</p>}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="สรุปการแจ้งเตือน">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4"><p className="text-sm font-medium text-slate-600">ข้อความทั้งหมด</p><span className="rounded-xl bg-sky-50 p-3 text-sky-600 ring-1 ring-sky-100"><Inbox className="size-5" aria-hidden="true" /></span></div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{notifications.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4"><p className="text-sm font-medium text-slate-600">ยังไม่อ่าน</p><span className="rounded-xl bg-sky-50 p-3 text-sky-600 ring-1 ring-sky-100"><Bell className="size-5" aria-hidden="true" /></span></div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{unreadCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4"><p className="text-sm font-medium text-slate-600">ประกาศ</p><span className="rounded-xl bg-amber-50 p-3 text-amber-600 ring-1 ring-amber-100"><Megaphone className="size-5" aria-hidden="true" /></span></div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{broadcastCount}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs" aria-label="ตัวกรองข้อความ">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex shrink-0 items-center gap-2 px-1 text-sm font-semibold text-slate-700"><Filter className="size-4 text-teal-700" aria-hidden="true" />หมวดข้อความ</div>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:flex-initial" role="group" aria-label="เลือกหมวดข้อความ">
            {filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`min-h-11 min-w-[104px] shrink-0 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${filter === item.value ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}>{item.label}</button>)}
          </div>
          {auth.role !== 'staff_admin' && <button onClick={() => void markAllRead()} disabled={unreadCount === 0 || Boolean(workingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50"><CheckCheck className="size-4" aria-hidden="true" /> อ่านทั้งหมด</button>}
        </div>
      </section>

      {error && <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert"><span>{error}</span><button onClick={() => void reloadInbox()} className="inline-flex shrink-0 items-center gap-1 font-semibold"><RefreshCw className="size-4" /> ลองใหม่</button></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs" aria-live="polite">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h2 className="font-semibold text-slate-950">รายการแจ้งเตือน</h2><p className="mt-1 text-xs leading-5 text-slate-500">แสดง {visibleNotifications.length} จาก {notifications.length} ข้อความ</p></div>
        </div>
        {loading || auth.isLoading ? <div className="space-y-3 p-5" aria-label="กำลังโหลดข้อความ">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div> : visibleNotifications.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><span className="rounded-2xl bg-slate-100 p-4 text-slate-400"><Inbox className="size-8" /></span><h2 className="mt-4 font-semibold text-slate-800">ไม่มีข้อความในรายการนี้</h2><p className="mt-1 text-sm text-slate-500">เมื่อมีข้อความใหม่ ระบบจะแสดงที่นี่</p></div> : <div className="divide-y divide-slate-100">{visibleNotifications.map((notification) => {
          const meta = typeMeta[notification.type]; const Icon = meta.icon; const busy = workingId === notification.id;
          return <article key={notification.id} className={`group flex gap-3 px-5 py-4 transition sm:gap-4 sm:px-6 ${notification.is_read ? 'bg-white' : 'bg-sky-50/30'}`}><button onClick={() => void markRead(notification)} disabled={notification.is_read || busy} aria-label={notification.is_read ? `${notification.title} อ่านแล้ว` : `ทำเครื่องหมาย ${notification.title} ว่าอ่านแล้ว`} className={`mt-0.5 shrink-0 self-start rounded-xl p-2.5 ring-1 ring-inset ${meta.className} disabled:cursor-default`}><Icon className="size-5" /></button><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><h2 className={`truncate text-sm sm:text-base ${notification.is_read ? 'font-medium text-slate-700' : 'font-semibold text-slate-950'}`}>{notification.title}</h2>{!notification.is_read && <span className="size-2 shrink-0 rounded-full bg-sky-500" aria-label="ยังไม่อ่าน" />}</div><time className="shrink-0 text-xs text-slate-400">{formatDateTime(notification.created_at)}</time></div><p className="mt-1.5 text-sm leading-6 text-slate-600">{notification.message}</p><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{meta.label}</span></div><button onClick={() => void deleteNotification(notification)} disabled={busy} aria-label={`ลบ ${notification.title} ออกจากกล่องข้อความ`} className="shrink-0 self-start rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Trash2 className="size-4" /></button></article>;
        })}</div>}
      </section>

      <p className="text-center text-xs leading-5 text-slate-400">การอ่านหรือลบมีผลกับกล่องข้อความของบัญชีนี้ · สถานะการอ่าน Broadcast จะสรุปให้ staff_admin เห็นแยกตาม role</p>
    </main>
  );
}
