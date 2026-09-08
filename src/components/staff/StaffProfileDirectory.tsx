'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { roleLabels } from '@/features/dashboard/types';
import {
  getStaffProfileDirectory,
  type StaffProfileDirectoryItem,
} from '@/services/dashboardService';
import type { UserRole } from '@/types/database';

const roleOrder: UserRole[] = ['patient', 'medical', 'staff_admin'];

function rolePillClass(role: UserRole): string {
  if (role === 'staff_admin') return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (role === 'medical') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  return 'bg-sky-50 text-sky-700 ring-sky-100';
}

function displayValue(value: string | null): string {
  return value?.trim() || 'ไม่ระบุ';
}

export default function StaffProfileDirectory() {
  const [profiles, setProfiles] = useState<StaffProfileDirectoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setProfiles(await getStaffProfileDirectory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลบัญชีไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProfiles(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfiles]);

  const counts = useMemo(() => {
    const result: Record<UserRole, number> = { patient: 0, medical: 0, staff_admin: 0 };
    profiles.forEach((profile) => { result[profile.role] += 1; });
    return result;
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return profiles.filter((profile) => {
      if (roleFilter !== 'all' && profile.role !== roleFilter) return false;
      if (!normalizedQuery) return true;
      return [profile.fullName, profile.email ?? '', profile.phone ?? '']
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [profiles, query, roleFilter]);

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/staff_admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-sky-700">
            <ArrowLeft className="size-4" aria-hidden="true" /> กลับไปหน้า Dashboard
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">บัญชีผู้ใช้งานทั้งหมดตอนนี้</h1>
          <p className="mt-1 text-sm text-slate-500">ข้อมูลติดต่อและ role</p>
        </div>
        <button type="button" onClick={() => void loadProfiles(true)} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> รีเฟรช
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุปจำนวนบัญชี">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between"><p className="text-sm text-slate-500">บัญชีทั้งหมด</p><Users className="size-5 text-sky-600" aria-hidden="true" /></div>
          <p className="mt-3 text-3xl font-bold text-slate-950">{profiles.length}</p>
        </div>
        {roleOrder.map((role) => (
          <div key={role} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{role}</p><p className="mt-0.5 text-xs text-slate-400">{roleLabels[role]}</p></div><UserRound className="size-5 text-slate-400" aria-hidden="true" /></div>
            <p className="mt-3 text-3xl font-bold text-slate-950">{counts[role]}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><h2 className="font-semibold text-slate-950">รายชื่อบัญชี</h2><p className="mt-1 text-xs text-slate-500">แสดง {filteredProfiles.length} จาก {profiles.length} บัญชี</p></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="relative block sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><span className="sr-only">ค้นหาบัญชี</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
            <label className="sr-only" htmlFor="role-filter">กรองตาม role</label><select id="role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"><option value="all">ทุก role</option>{roleOrder.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select>
          </div>
        </div>

        {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" aria-hidden="true" />กำลังโหลดข้อมูลบัญชี…</div> : error ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 text-center"><p className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => void loadProfiles()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700">ลองอีกครั้ง</button></div> : filteredProfiles.length === 0 ? <div className="flex min-h-48 items-center justify-center px-5 text-sm text-slate-500">ไม่พบบัญชีตามเงื่อนไขที่เลือก</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3 sm:px-6">ชื่อ</th><th className="px-5 py-3">อีเมล</th><th className="px-5 py-3">เบอร์โทร</th><th className="px-5 py-3 sm:px-6">role</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredProfiles.map((profile) => <tr key={profile.id} className="text-slate-700"><td className="px-5 py-4 font-medium text-slate-950 sm:px-6">{displayValue(profile.fullName)}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-2"><Mail className="size-4 text-slate-400" aria-hidden="true" />{displayValue(profile.email)}</span></td><td className="px-5 py-4"><span className="inline-flex items-center gap-2"><Phone className="size-4 text-slate-400" aria-hidden="true" />{displayValue(profile.phone)}</span></td><td className="px-5 py-4 sm:px-6"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${rolePillClass(profile.role)}`}><ShieldCheck className="size-3.5" aria-hidden="true" />{profile.role}</span><span className="mt-1 block text-xs text-slate-400">{roleLabels[profile.role]}</span></td></tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
