'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Filter,
  Link2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import { useShop } from '@/features/shop/context/ShopProvider';
import type {
  DoctorAvailability,
  ScheduleDepartment,
  ScheduleDoctor,
} from '@/types/schedule';

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100';

type WorkspaceTab = 'departments' | 'doctors';

interface DepartmentDraft {
  name: string;
  description: string;
}

interface DoctorDraft {
  profileId: string;
  fullName: string;
  email: string;
  initials: string;
  specialty: string;
  departmentId: string;
  availability: DoctorAvailability;
}

const emptyDepartmentDraft: DepartmentDraft = {
  name: '',
  description: '',
};

const emptyDoctorDraft: DoctorDraft = {
  profileId: '',
  fullName: '',
  email: '',
  initials: '',
  specialty: '',
  departmentId: '',
  availability: 'active',
};

export default function DepartmentWorkspace() {
  const {
    departments,
    doctors,
    slots,
    doctorAccounts,
    isLoading,
    saveDepartment: persistDepartment,
    toggleDepartment: persistDepartmentToggle,
    saveDoctor: persistDoctor,
    toggleDoctor: persistDoctorToggle,
  } = useShop();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('departments');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [departmentFormOpen, setDepartmentFormOpen] = useState(false);
  const [doctorFormOpen, setDoctorFormOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentDraft>(emptyDepartmentDraft);
  const [doctorDraft, setDoctorDraft] = useState<DoctorDraft>(emptyDoctorDraft);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const normalizedSearch = search.trim().toLocaleLowerCase('th');

  const visibleDepartments = useMemo(
    () =>
      departments.filter((department) => {
        const matchesSearch = `${department.name} ${department.description}`
          .toLocaleLowerCase('th')
          .includes(normalizedSearch);
        return matchesSearch && (showInactive || department.isActive);
      }),
    [departments, normalizedSearch, showInactive],
  );

  const visibleDoctors = useMemo(
    () =>
      doctors.filter((doctor) => {
        const matchesSearch = `${doctor.fullName} ${doctor.specialty} ${doctor.email}`
          .toLocaleLowerCase('th')
          .includes(normalizedSearch);
        const matchesDepartment = departmentFilter === 'all' || doctor.departmentId === departmentFilter;
        const matchesStatus = showInactive || doctor.availability !== 'inactive';
        return matchesSearch && matchesDepartment && matchesStatus;
      }),
    [departmentFilter, doctors, normalizedSearch, showInactive],
  );

  const openDepartmentForm = (department?: ScheduleDepartment) => {
    setFormError('');
    setNotice('');
    setEditingDepartmentId(department?.id ?? null);
    setDepartmentDraft(
      department
        ? {
            name: department.name,
            description: department.description,
          }
        : emptyDepartmentDraft,
    );
    setDepartmentFormOpen(true);
  };

  const saveDepartment = async () => {
    setFormError('');
    setIsSaving(true);
    const result = await persistDepartment(departmentDraft, editingDepartmentId ?? undefined);
    setIsSaving(false);
    if (!result.ok) { setFormError(result.error); return; }
    setNotice(editingDepartmentId ? 'อัปเดตข้อมูลแผนกในฐานข้อมูลสำเร็จ' : 'เพิ่มแผนกใหม่ในฐานข้อมูลสำเร็จ');

    setDepartmentFormOpen(false);
    setEditingDepartmentId(null);
    setDepartmentDraft(emptyDepartmentDraft);
  };

  const toggleDepartment = async (department: ScheduleDepartment) => {
    const impact = doctors.some((doctor) => doctor.departmentId === department.id)
      ? ' แพทย์และประวัติเดิมจะยังคงเชื่อมกับแผนกนี้'
      : '';
    if (!window.confirm(department.isActive ? `ยืนยันการ${impact ? 'ปิดใช้งาน' : 'ลบ'} “${department.name}”?${impact}` : `เปิดใช้งาน “${department.name}” อีกครั้ง?`)) return;
    setIsSaving(true);
    const result = await persistDepartmentToggle(department.id);
    setIsSaving(false);
    if (!result.ok) { setFormError(result.error); return; }
    setNotice(result.value === 'deleted' ? 'ลบแผนกแล้ว' : result.value === 'disabled' ? 'ปิดใช้งานแผนกแล้ว' : 'เปิดใช้งานแผนกแล้ว');
  };

  const selectDoctorAccount = (profileId: string) => {
    const account = doctorAccounts.find((item) => item.profileId === profileId);
    setDoctorDraft((current) => ({
      ...current,
      profileId,
      fullName: account?.fullName ?? current.fullName,
      email: account?.email ?? current.email,
      initials: account?.initials ?? current.initials,
    }));
  };

  const openDoctorForm = (doctor?: ScheduleDoctor) => {
    setFormError('');
    setNotice('');
    setEditingDoctorId(doctor?.id ?? null);
    setDoctorDraft(
      doctor
        ? {
            profileId: doctor.profileId,
            fullName: doctor.fullName,
            email: doctor.email,
            initials: doctor.initials,
            specialty: doctor.specialty,
            departmentId: doctor.departmentId,
            availability: doctor.availability,
          }
        : emptyDoctorDraft,
    );
    setDoctorFormOpen(true);
  };

  const saveDoctor = async () => {
    setFormError('');
    setIsSaving(true);
    const result = await persistDoctor(doctorDraft, editingDoctorId ?? undefined);
    setIsSaving(false);
    if (!result.ok) { setFormError(result.error); return; }
    setNotice(editingDoctorId ? 'อัปเดตข้อมูลแพทย์ในฐานข้อมูลสำเร็จ' : 'เพิ่มแพทย์ผูกกับแผนกสำเร็จ');

    setDoctorFormOpen(false);
    setEditingDoctorId(null);
    setDoctorDraft(emptyDoctorDraft);
  };

  const toggleDoctor = async (doctor: ScheduleDoctor) => {
    const hasReferences = Boolean(doctor.hasHistory || slots.some((slot) => slot.doctorId === doctor.id));
    const action = doctor.availability === 'inactive' ? 'เปิดใช้งาน' : hasReferences ? 'ปิดใช้งาน' : 'ลบ';
    const impact = hasReferences ? ' รอบและประวัติเดิมจะยังคงอยู่' : '';
    if (!window.confirm(`${action} ${doctor.fullName}?${impact}`)) return;
    setIsSaving(true);
    const result = await persistDoctorToggle(doctor.id);
    setIsSaving(false);
    if (!result.ok) { setFormError(result.error); return; }
    setNotice(result.value === 'deleted' ? 'ลบแพทย์แล้ว' : doctor.availability === 'inactive' ? 'เปิดใช้งานแพทย์แล้ว' : 'ปิดใช้งานแพทย์แล้ว');
  };

  const activeDoctors = doctors.filter((doctor) => doctor.availability === 'active').length;
  const activeDepartments = departments.filter((department) => department.isActive).length;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[28px] bg-[#0a2540] text-white shadow-[0_18px_50px_rgba(10,37,64,0.16)]">
        <div className="grid gap-8 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-sky-200">
              <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1">SHOP · DATABASE CONNECTED</span>
              <span>เชื่อมต่อฐานข้อมูล Supabase เรียบร้อย</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-[-0.03em] text-balance sm:text-4xl">
              โครงสร้างบริการและทีมแพทย์
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              จัดการแผนก จับคู่บัญชีแพทย์ และเตรียมข้อมูลต้นทางให้ตารางตรวจ ระบบนัดหมาย และแดชบอร์ด
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/7 p-2 ring-1 ring-white/10">
            {[
              ['แผนกเปิด', activeDepartments],
              ['แพทย์ทั้งหมด', doctors.length],
              ['พร้อมออกตรวจ', activeDoctors],
            ].map(([label, value]) => (
              <div key={label} className="min-w-20 rounded-xl bg-white/8 px-3 py-3 text-center">
                <div className="text-xl font-bold tabular-nums">{value}</div>
                <div className="mt-1 text-[11px] text-slate-300">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          {[
            [Database, 'Database', 'Supabase PostgreSQL RLS'],
            [UserRoundCheck, 'Auth · ฟีม', 'รับบัญชี role medical'],
            [Link2, 'Booking · ปาย', 'ส่งต่อ medical/slot IDs'],
          ].map(([Icon, label, detail]) => {
            const ItemIcon = Icon as typeof Database;
            return (
              <div key={String(label)} className="flex items-center gap-3 bg-[#0d3152] px-6 py-3.5">
                <ItemIcon className="h-4 w-4 text-sky-300" aria-hidden="true" />
                <div>
                  <div className="text-xs font-semibold text-white">{String(label)}</div>
                  <div className="text-[11px] text-slate-400">{String(detail)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <section className="rounded-2xl bg-white p-3 shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="เลือกข้อมูลที่ต้องการจัดการ">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'departments'}
              onClick={() => {
                setActiveTab('departments');
                setSearch('');
              }}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:flex-none ${
                activeTab === 'departments' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="h-4 w-4" aria-hidden="true" />
              แผนก
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'doctors'}
              onClick={() => {
                setActiveTab('doctors');
                setSearch('');
              }}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:flex-none ${
                activeTab === 'doctors' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
              แพทย์
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-64 flex-1">
              <span className="sr-only">ค้นหา</span>
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={activeTab === 'departments' ? 'ค้นหาชื่อแผนกหรือรายละเอียด' : 'ค้นหาชื่อหรือความเชี่ยวชาญ'}
                className={`${inputClass} pl-9`}
              />
            </label>
            {activeTab === 'doctors' && (
              <label className="relative">
                <span className="sr-only">กรองตามแผนก</span>
                <Filter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className={`${inputClass} min-w-52 pl-9`}
                >
                  <option value="all">ทุกแผนก</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              แสดงที่ปิดใช้
            </label>
            <button
              type="button"
              onClick={() => (activeTab === 'departments' ? openDepartmentForm() : openDoctorForm())}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition-[background-color,transform] hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {activeTab === 'departments' ? 'เพิ่มแผนก' : 'เพิ่มแพทย์'}
            </button>
          </div>
        </div>
      </section>

      <div aria-live="polite">
        {notice && (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />{notice}</span>
            <button type="button" onClick={() => setNotice('')} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-emerald-100" aria-label="ปิดข้อความ">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-6 text-center text-sm font-medium text-sky-800">
          กำลังโหลดข้อมูลจากฐานข้อมูล...
        </div>
      )}

      {activeTab === 'departments' && departmentFormOpen && (
        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] ring-1 ring-sky-200" aria-labelledby="department-form-title">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Database Form</p>
              <h2 id="department-form-title" className="mt-1 text-xl font-bold text-slate-950">{editingDepartmentId ? 'แก้ไขแผนก' : 'เพิ่มแผนกใหม่'}</h2>
              <p className="mt-1 text-xs text-slate-500">บันทึกลงตาราง departments ใน Supabase โดยตรง</p>
            </div>
            <button type="button" onClick={() => setDepartmentFormOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="ปิดแบบฟอร์ม">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">ชื่อแผนก</span>
              <input
                value={departmentDraft.name}
                onChange={(event) => setDepartmentDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="เช่น แผนกอายุรกรรม, แผนกทันตกรรม"
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">รายละเอียดบริการ</span>
              <textarea
                rows={3}
                value={departmentDraft.description}
                onChange={(event) => setDepartmentDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="ระบุขอบเขตการตรวจรักษา หรือคำอธิบายสำหรับผู้ป่วย"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{formError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setDepartmentFormOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">ยกเลิก</button>
            <button type="button" disabled={isSaving} onClick={saveDepartment} className="min-h-11 rounded-xl bg-[#0a2540] px-5 text-sm font-semibold text-white hover:bg-[#123e67] active:scale-[0.98] disabled:opacity-50">
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกแผนก'}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'doctors' && doctorFormOpen && (
        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] ring-1 ring-sky-200" aria-labelledby="doctor-form-title">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Database Form</p>
              <h2 id="doctor-form-title" className="mt-1 text-xl font-bold text-slate-950">{editingDoctorId ? 'แก้ไขข้อมูลแพทย์' : 'ผูกบัญชีแพทย์กับคลินิก'}</h2>
              <p className="mt-1 text-sm text-slate-500">เลือกบัญชีผู้ใช้ที่มี role medical แล้วผูกเข้ากับแผนกในตาราง doctors</p>
            </div>
            <button type="button" onClick={() => setDoctorFormOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="ปิดแบบฟอร์ม"><X className="h-5 w-5" aria-hidden="true" /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium text-slate-700">บัญชีที่มี role medical</span><select value={doctorDraft.profileId} disabled={Boolean(editingDoctorId)} onChange={(event) => selectDoctorAccount(event.target.value)} className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}><option value="">เลือกบัญชีแพทย์</option>{editingDoctorId && <option value={doctorDraft.profileId}>{doctorDraft.fullName} · {doctorDraft.email}</option>}{!editingDoctorId && doctorAccounts.filter((account) => !doctors.some((doctor) => doctor.profileId === account.profileId)).map((account) => <option key={account.profileId} value={account.profileId}>{account.fullName}</option>)}</select></label>
            <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">แผนก</span><select value={doctorDraft.departmentId} onChange={(event) => setDoctorDraft((current) => ({ ...current, departmentId: event.target.value }))} className={inputClass}><option value="">เลือกแผนก</option>{departments.filter((department) => department.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">สถานะ</span><select value={doctorDraft.availability} onChange={(event) => setDoctorDraft((current) => ({ ...current, availability: event.target.value as DoctorAvailability }))} className={inputClass}><option value="active">พร้อมออกตรวจ</option><option value="on_leave">ลา</option><option value="inactive">ปิดใช้งาน</option></select></label>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-4"><span className="text-sm font-medium text-slate-700">ความเชี่ยวชาญ</span><input value={doctorDraft.specialty} onChange={(event) => setDoctorDraft((current) => ({ ...current, specialty: event.target.value }))} placeholder="เช่น เวชศาสตร์ครอบครัว, อายุรกรรมทั่วไป" className={inputClass} /></label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{formError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDoctorFormOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">ยกเลิก</button><button type="button" disabled={isSaving} onClick={saveDoctor} className="min-h-11 rounded-xl bg-[#0a2540] px-5 text-sm font-semibold text-white hover:bg-[#123e67] active:scale-[0.98] disabled:opacity-50">{isSaving ? 'กำลังบันทึก...' : 'บันทึกแพทย์'}</button></div>
        </section>
      )}

      {activeTab === 'departments' ? (
        <section aria-labelledby="departments-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="departments-title" className="text-lg font-bold text-slate-950">แผนกทั้งหมด</h2>
            <span className="text-sm text-slate-500">{visibleDepartments.length} รายการ</span>
          </div>
          {visibleDepartments.length === 0 ? (
            <EmptyPanel title="ไม่พบแผนก" detail="ลองเปลี่ยนคำค้นหรือเปิดตัวกรองรายการที่ปิดใช้งาน" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleDepartments.map((department) => {
                const doctorCount = doctors.filter((doctor) => doctor.departmentId === department.id).length;
                return (
                  <article key={department.id} className={`group relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_4px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 ${!department.isActive ? 'opacity-70' : ''}`}>
                    <div className={`absolute inset-y-0 left-0 w-1.5 ${department.isActive ? 'bg-sky-500' : 'bg-slate-300'}`} aria-hidden="true" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${department.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                            {department.isActive ? 'เปิดให้บริการ' : 'ปิดใช้งาน'}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-slate-950">{department.name}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{department.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openDepartmentForm(department)} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`แก้ไข ${department.name}`}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" disabled={isSaving} onClick={() => toggleDepartment(department)} className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${department.isActive ? 'text-rose-700 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>{department.isActive ? 'ปิดใช้' : 'เปิดใช้'}</button>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2 text-sm text-slate-700"><Users className="h-4 w-4 text-sky-600" aria-hidden="true" /><span><strong className="tabular-nums">{doctorCount}</strong> แพทย์สังกัด</span></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section aria-labelledby="doctors-title">
          <div className="mb-3 flex items-center justify-between"><h2 id="doctors-title" className="text-lg font-bold text-slate-950">ทะเบียนแพทย์</h2><span className="text-sm text-slate-500">{visibleDoctors.length} คน</span></div>
          {visibleDoctors.length === 0 ? (
            <EmptyPanel title="ไม่พบแพทย์" detail="ลองเปลี่ยนคำค้น แผนก หรือเปิดรายการที่ปิดใช้งาน" />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="hidden grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_110px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid"><span>แพทย์</span><span>แผนก</span><span>ความเชี่ยวชาญ</span><span>สถานะ</span><span className="text-right">จัดการ</span></div>
              <div className="divide-y divide-slate-100">
                {visibleDoctors.map((doctor) => {
                  const department = departments.find((item) => item.id === doctor.departmentId);
                  const status = doctor.availability === 'active' ? ['พร้อมออกตรวจ', 'bg-emerald-50 text-emerald-700'] : doctor.availability === 'on_leave' ? ['ลา', 'bg-amber-50 text-amber-800'] : ['ปิดใช้งาน', 'bg-slate-100 text-slate-600'];
                  return (
                    <article key={doctor.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(240px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_110px_120px] lg:items-center">
                      <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0a2540] text-sm font-bold text-white">{doctor.initials}</div><div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-950">{doctor.fullName}</h3><p className="truncate text-xs text-slate-500">{doctor.email}</p></div></div>
                      <div className="text-sm text-slate-700"><span className="mr-2 text-xs font-semibold text-slate-400 lg:hidden">แผนก</span>{department?.name ?? 'ยังไม่กำหนด'}</div>
                      <div className="text-sm text-slate-600"><span className="mr-2 text-xs font-semibold text-slate-400 lg:hidden">เชี่ยวชาญ</span>{doctor.specialty}</div>
                      <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status[1]}`}>{status[0]}</span></div>
                      <div className="flex justify-end gap-1"><button type="button" onClick={() => openDoctorForm(doctor)} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label={`แก้ไข ${doctor.fullName}`}><Pencil className="h-4 w-4" aria-hidden="true" /></button><button type="button" onClick={() => toggleDoctor(doctor)} className={`min-h-11 rounded-xl px-3 text-xs font-semibold ${doctor.availability === 'inactive' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-rose-700 hover:bg-rose-50'}`}>{doctor.availability === 'inactive' ? 'เปิดใช้' : doctor.hasHistory || slots.some((slot) => slot.doctorId === doctor.id) ? 'ปิดใช้' : 'ลบ'}</button></div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <aside className="grid gap-3 rounded-2xl bg-slate-900 p-5 text-white md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></div>
        <div><h2 className="font-bold">เชื่อมต่อฐานข้อมูล Supabase เรียบร้อย</h2><p className="mt-1 text-sm leading-6 text-slate-300">การสร้าง แก้ไข และเปิด/ปิดสถานะแผนกและแพทย์จะบันทึกตรงไปยังตาราง departments, doctors และ profiles ภายใต้ RLS ของ staff_admin</p></div>
      </aside>
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-200">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Search className="h-5 w-5" aria-hidden="true" /></div>
      <h3 className="mt-4 font-bold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
