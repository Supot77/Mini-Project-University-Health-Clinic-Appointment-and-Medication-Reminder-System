'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { roleLabels } from '@/features/dashboard/types';
import {
  getStaffProfileDirectory,
  updateStaffProfile,
  type StaffProfileDirectoryItem,
} from '@/services/dashboardService';
import type { UserRole } from '@/types/database';

const roleOrder: UserRole[] = ['patient', 'medical', 'staff_admin'];

function rolePillClass(role: UserRole, isActive = true): string {
  if (!isActive) return 'bg-slate-100 text-slate-500 ring-slate-300';
  if (role === 'staff_admin') return 'bg-status-info-bg text-status-info ring-brand-border';
  if (role === 'medical') return 'bg-status-success-bg text-status-success ring-emerald-200';
  return 'bg-brand-page text-brand-strong ring-brand-border';
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
  const [editingProfile, setEditingProfile] = useState<StaffProfileDirectoryItem | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', role: 'patient' as UserRole, isActive: true });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [accountAction, setAccountAction] = useState<{ profile: StaffProfileDirectoryItem; nextActive: boolean } | null>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function openEdit(profile: StaffProfileDirectoryItem) {
    setEditingProfile(profile);
    setEditForm({
      fullName: profile.fullName,
      phone: profile.phone ?? '',
      role: profile.role,
      isActive: profile.isActive,
    });
    setSaveError(null);
  }

  function closeEdit() {
    if (saving) return;
    setEditingProfile(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editingProfile) return;
    if (!editForm.fullName.trim()) {
      setSaveError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateStaffProfile(editingProfile.id, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        isActive: editForm.isActive,
      });
      await loadProfiles(true);
      setEditingProfile(null);
      setToast('บันทึกการเปลี่ยนแปลงแล้ว');
    } catch (saveProfileError) {
      setSaveError(saveProfileError instanceof Error ? saveProfileError.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    const result: Record<UserRole, number> = { patient: 0, medical: 0, staff_admin: 0 };
    profiles.forEach((profile) => { result[profile.role] += 1; });
    return result;
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return profiles
      .filter((profile) => {
        if (roleFilter !== 'all' && profile.role !== roleFilter) return false;
        if (!normalizedQuery) return true;
        return [profile.fullName, profile.email ?? '', profile.phone ?? '']
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [profiles, query, roleFilter]);

  async function confirmAccountAction() {
    if (!accountAction) return;
    const { profile, nextActive } = accountAction;
    setActionSaving(true);
    setError(null);
    try {
      await updateStaffProfile(profile.id, {
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
        isActive: nextActive,
      });
      await loadProfiles(true);
      setAccountAction(null);
      setToast(nextActive ? 'กู้คืนบัญชีเรียบร้อยแล้ว' : 'ระงับบัญชีเรียบร้อยแล้ว');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : nextActive ? 'กู้คืนบัญชีไม่สำเร็จ' : 'ระงับบัญชีไม่สำเร็จ');
      setAccountAction(null);
    } finally {
      setActionSaving(false);
    }
  }

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

        {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" aria-hidden="true" />กำลังโหลดข้อมูลบัญชี…</div> : error ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 text-center"><p className="text-sm text-rose-700">{error}</p><button type="button" onClick={() => void loadProfiles()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700">ลองอีกครั้ง</button></div> : filteredProfiles.length === 0 ? <div className="flex min-h-48 items-center justify-center px-5 text-sm text-slate-500">ไม่พบบัญชีตามเงื่อนไขที่เลือก</div> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3 sm:px-6">ชื่อ</th><th className="px-5 py-3">อีเมล</th><th className="px-5 py-3">เบอร์โทร</th><th className="px-5 py-3">role</th><th className="px-5 py-3 sm:px-6">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredProfiles.map((profile) => <tr key={profile.id} className={`transition-colors ${profile.isActive ? 'text-slate-700' : 'bg-slate-100/80 text-slate-400 grayscale'}`}><td className={`px-5 py-4 font-medium sm:px-6 ${profile.isActive ? 'text-slate-950' : 'text-slate-500 line-through'}`}>{displayValue(profile.fullName)}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-2"><Mail className="size-4 text-slate-400" aria-hidden="true" />{displayValue(profile.email)}</span></td><td className="px-5 py-4"><span className="inline-flex items-center gap-2"><Phone className="size-4 text-slate-400" aria-hidden="true" />{displayValue(profile.phone)}</span></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${rolePillClass(profile.role, profile.isActive)}`}><ShieldCheck className="size-3.5" aria-hidden="true" />{profile.role}</span><span className={`mt-1 block text-xs ${profile.isActive ? 'text-slate-400' : 'font-semibold text-slate-500'}`}>{roleLabels[profile.role]} · {profile.isActive ? 'ใช้งานอยู่' : 'ระงับบัญชี'}</span></td><td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><button type="button" onClick={() => openEdit(profile)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"><Pencil className="size-4" aria-hidden="true" />แก้ไข</button><button type="button" onClick={() => setAccountAction({ profile, nextActive: !profile.isActive })} title={profile.isActive ? 'ลบบัญชี' : 'กู้คืนบัญชี'} className={`inline-flex size-10 items-center justify-center rounded-lg border bg-white transition ${profile.isActive ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>{profile.isActive ? <Trash2 className="size-5" aria-hidden="true" /> : <RotateCcw className="size-5" aria-hidden="true" />}</button></div></td></tr>)}</tbody></table></div>}
      </section>

      {accountAction && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="account-action-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionSaving) setAccountAction(null); }}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className={`mx-auto flex size-14 items-center justify-center rounded-full ${accountAction.nextActive ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{accountAction.nextActive ? <RotateCcw className="size-7" aria-hidden="true" /> : <AlertTriangle className="size-7" aria-hidden="true" />}</div>
            <div className="mt-5 text-center"><h2 id="account-action-title" className="text-xl font-bold text-slate-950">{accountAction.nextActive ? 'กู้คืนบัญชีนี้?' : 'ลบบัญชีนี้?'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">บัญชี “{accountAction.profile.fullName}” {accountAction.nextActive ? 'จะสามารถกลับมาเข้าสู่ระบบได้อีกครั้ง' : 'จะถูกระงับและไม่สามารถเข้าสู่ระบบได้'}</p>{!accountAction.nextActive && <p className="mt-2 text-xs text-slate-400">ข้อมูลจะยังอยู่ในระบบและสามารถกู้คืนได้ภายหลัง</p>}</div>
            <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={actionSaving} onClick={() => setAccountAction(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">ยกเลิก</button><button type="button" disabled={actionSaving} onClick={() => void confirmAccountAction()} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${accountAction.nextActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{actionSaving && <RefreshCw className="size-4 animate-spin" aria-hidden="true" />}{actionSaving ? 'กำลังดำเนินการ…' : accountAction.nextActive ? 'ยืนยันการกู้คืน' : 'ยืนยันการลบ'}</button></div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit(); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="edit-profile-title" className="text-xl font-bold text-slate-950">แก้ไขข้อมูลผู้ใช้งาน</h2><p className="mt-1 text-sm text-slate-500">{editingProfile.email ?? 'ไม่มีอีเมล'}</p></div>
              <button type="button" onClick={closeEdit} disabled={saving} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="ปิด"><X className="size-5" aria-hidden="true" /></button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">ชื่อ-นามสกุล<input value={editForm.fullName} onChange={(event) => setEditForm((form) => ({ ...form, fullName: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">เบอร์โทรศัพท์<input value={editForm.phone} onChange={(event) => setEditForm((form) => ({ ...form, phone: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">Role<select value={editForm.role} onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.value as UserRole }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">{roleOrder.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span><span className="block text-sm font-semibold text-slate-800">สถานะบัญชี</span><span className="mt-0.5 block text-xs text-slate-500">ปิดเพื่อระงับการเข้าสู่ระบบของบัญชีนี้</span></span><input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm((form) => ({ ...form, isActive: event.target.checked }))} className="size-5 accent-sky-600" /></label>
            </div>

            {saveError && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeEdit} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">ยกเลิก</button><button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">{saving ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button></div>
          </div>
        </div>
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-[90] flex min-w-72 items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-2xl"><span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-5" aria-hidden="true" /></span><span className="flex-1">{toast}</span><button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="ปิดการแจ้งเตือน"><X className="size-4" aria-hidden="true" /></button></div>}
    </main>
  );
}
