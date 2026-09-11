'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Stethoscope,
  UserPlus,
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
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50';

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

  // Drawer state
  const [departmentDrawerOpen, setDepartmentDrawerOpen] = useState(false);
  const [doctorDrawerOpen, setDoctorDrawerOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);

  const [departmentDraft, setDepartmentDraft] = useState<DepartmentDraft>(emptyDepartmentDraft);
  const [doctorDraft, setDoctorDraft] = useState<DoctorDraft>(emptyDoctorDraft);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Keyboard escape listener to close drawers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (departmentDrawerOpen) setDepartmentDrawerOpen(false);
        if (doctorDrawerOpen) setDoctorDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [departmentDrawerOpen, doctorDrawerOpen]);

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
    setDepartmentDrawerOpen(true);
  };

  const closeDepartmentDrawer = () => {
    setDepartmentDrawerOpen(false);
    setEditingDepartmentId(null);
    setDepartmentDraft(emptyDepartmentDraft);
    setFormError('');
  };

  const saveDepartment = async () => {
    setFormError('');
    setIsSaving(true);
    const result = await persistDepartment(departmentDraft, editingDepartmentId ?? undefined);
    setIsSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setNotice(editingDepartmentId ? 'อัปเดตข้อมูลแผนกสำเร็จ' : 'เพิ่มแผนกใหม่สำเร็จ');
    closeDepartmentDrawer();
  };

  const toggleDepartment = async (department: ScheduleDepartment) => {
    setFormError('');
    setNotice('');
    const impact = doctors.some((doctor) => doctor.departmentId === department.id)
      ? ' แพทย์และประวัติเดิมจะยังคงเชื่อมกับแผนกนี้'
      : '';
    if (!window.confirm(department.isActive ? `ยืนยันการปิดใช้งานแผนก “${department.name}”?${impact}` : `ยืนยันการเปิดใช้งานแผนก “${department.name}” อีกครั้ง?`)) return;

    setIsSaving(true);
    const result = await persistDepartmentToggle(department.id);
    setIsSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    if (result.value === 'disabled') {
      setShowInactive(true);
    }

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
    setDoctorDrawerOpen(true);
  };

  const closeDoctorDrawer = () => {
    setDoctorDrawerOpen(false);
    setEditingDoctorId(null);
    setDoctorDraft(emptyDoctorDraft);
    setFormError('');
  };

  const saveDoctor = async () => {
    setFormError('');
    setIsSaving(true);
    const result = await persistDoctor(doctorDraft, editingDoctorId ?? undefined);
    setIsSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setNotice(editingDoctorId ? 'อัปเดตข้อมูลแพทย์สำเร็จ' : 'ผูกแพทย์เข้ากับแผนกสำเร็จ');
    closeDoctorDrawer();
  };

  const toggleDoctor = async (doctor: ScheduleDoctor) => {
    setFormError('');
    setNotice('');
    const hasReferences = Boolean(doctor.hasHistory || slots.some((slot) => slot.doctorId === doctor.id));
    const action = doctor.availability === 'inactive' ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
    const impact = hasReferences ? ' รอบและประวัติเดิมจะยังคงอยู่' : '';
    if (!window.confirm(`${action} ${doctor.fullName}?${impact}`)) return;

    setIsSaving(true);
    const result = await persistDoctorToggle(doctor.id);
    setIsSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    if (doctor.availability !== 'inactive') {
      setShowInactive(true);
    }

    setNotice(result.value === 'deleted' ? 'ลบแพทย์แล้ว' : doctor.availability === 'inactive' ? 'เปิดใช้งานแพทย์แล้ว' : 'ปิดใช้งานแพทย์แล้ว');
  };

  const activeDoctors = doctors.filter((doctor) => doctor.availability === 'active').length;
  const activeDepartments = departments.filter((department) => department.isActive).length;

  return (
    <div className="space-y-6">
      {/* Clinical Command Header */}
      <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/70 px-3 py-1 text-xs font-semibold text-teal-800">
              <span className="h-2 w-2 rounded-full bg-teal-600 animate-pulse" aria-hidden="true" />
              <span>ระบบจัดการคลินิก · สถาบันสุขภาพ ม.วลัยลักษณ์</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              โครงสร้างบริการและบุคลากรทางการแพทย์
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              จัดการแผนกตรวจรักษาและจับคู่บัญชีแพทย์ ข้อมูลซิงค์กับฐานข้อมูล Supabase แบบเรียลไทม์
            </p>
          </div>

          {/* Quick Metrics Chips */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-center transition-colors hover:bg-slate-100/70">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{activeDepartments}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">แผนกเปิดบริการ</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-center transition-colors hover:bg-slate-100/70">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{doctors.length}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">แพทย์ทั้งหมด</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-center transition-colors hover:bg-emerald-50">
              <div className="text-2xl font-bold tabular-nums text-emerald-700">{activeDoctors}</div>
              <div className="mt-1 text-xs font-medium text-emerald-800">พร้อมออกตรวจ</div>
            </div>
          </div>
        </div>
      </header>

      {/* Control Bar: Tabs, Search, Filters & Action Button */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Segmented Control */}
          <div className="flex rounded-xl bg-slate-100/90 p-1" role="tablist" aria-label="เลือกมุมมองการจัดการ">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'departments'}
              onClick={() => {
                setActiveTab('departments');
                setSearch('');
              }}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-teal-600 sm:flex-none ${
                activeTab === 'departments'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>แผนกการรักษา</span>
              <span className="ml-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs text-slate-700">
                {departments.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'doctors'}
              onClick={() => {
                setActiveTab('doctors');
                setSearch('');
              }}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-teal-600 sm:flex-none ${
                activeTab === 'doctors'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>แพทย์และผู้ตรวจ</span>
              <span className="ml-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs text-slate-700">
                {doctors.length}
              </span>
            </button>
          </div>

          {/* Search, Filter, and Add Button */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'departments' ? 'ค้นหาชื่อแผนกหรือรายละเอียด...' : 'ค้นหาชื่อแพทย์หรือความเชี่ยวชาญ...'}
                className={`${inputClass} pl-9`}
              />
            </div>

            {activeTab === 'doctors' && (
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className={`${inputClass} min-w-44 pl-9 text-slate-700`}
                >
                  <option value="all">ทุกแผนก</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-medium text-slate-600 cursor-pointer select-none hover:bg-slate-50">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>แสดงที่ปิดใช้</span>
            </label>

            <button
              type="button"
              onClick={() => (activeTab === 'departments' ? openDepartmentForm() : openDoctorForm())}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-xs transition-all hover:bg-teal-800 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              {activeTab === 'departments' ? (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>เพิ่มแผนก</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>เพิ่มแพทย์</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Banner */}
      <div aria-live="polite" className="space-y-3">
        {notice && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
              aria-label="ปิดแจ้งเตือน"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {formError && !departmentDrawerOpen && !doctorDrawerOpen && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              {formError}
            </span>
            <button
              type="button"
              onClick={() => setFormError('')}
              className="rounded-lg p-1 text-rose-700 hover:bg-rose-100"
              aria-label="ปิดข้อความแจ้งเตือน"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-teal-100 bg-teal-50/50 p-4 text-sm font-medium text-teal-800">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" aria-hidden="true" />
            <span>กำลังโหลดข้อมูลจากฐานข้อมูล...</span>
          </div>
        )}
      </div>

      {/* Departments Grid View */}
      {activeTab === 'departments' && (
        <section aria-labelledby="departments-list-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="departments-list-title" className="text-base font-bold text-slate-900">
              แผนกการรักษาทั้งหมด
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {visibleDepartments.length} รายการ
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2" aria-label="กำลังโหลดรายการแผนก">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="h-3.5 w-48 animate-pulse rounded bg-slate-100" />
                  <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
                </div>
              ))}
            </div>
          ) : visibleDepartments.length === 0 ? (
            <EmptyPanel
              title="ไม่พบแผนกที่ค้นหา"
              detail="ลองเปลี่ยนคำค้นหา หรือเลือกตัวเลือก 'แสดงที่ปิดใช้' เพื่อดูแผนกทั้งหมด"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              {visibleDepartments.map((department) => {
                const affiliatedDoctors = doctors.filter((doctor) => doctor.departmentId === department.id);

                return (
                  <article
                    key={department.id}
                    className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-md ${
                      department.isActive
                        ? 'border-slate-200/90 hover:border-teal-300/80'
                        : 'border-slate-200 bg-slate-50/50 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Meta & Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            department.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70'
                              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              department.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                          {department.isActive ? 'เปิดให้บริการ' : 'ปิดใช้งาน'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDepartmentForm(department)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-600"
                            aria-label={`แก้ไข ${department.name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => toggleDepartment(department)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              department.isActive
                                ? 'text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={department.isActive ? 'ปิดการให้บริการ' : 'เปิดการให้บริการ'}
                          >
                            <Power className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{department.isActive ? 'ปิดใช้' : 'เปิดใช้'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
                        {department.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                        {department.description || 'ยังไม่มีคำอธิบายรายละเอียดบริการ'}
                      </p>
                    </div>

                    {/* Signature Element: Department Doctor Roster */}
                    <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <Users className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                          <span>แพทย์ประจำแผนก ({affiliatedDoctors.length})</span>
                        </span>
                      </div>

                      {affiliatedDoctors.length === 0 ? (
                        <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                          <span>ยังไม่มีแพทย์สังกัดแผนกนี้</span>
                          <button
                            type="button"
                            onClick={() => {
                              openDoctorForm();
                              setDoctorDraft((current) => ({ ...current, departmentId: department.id }));
                            }}
                            className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
                          >
                            + ผูกแพทย์
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {affiliatedDoctors.map((doc) => (
                            <span
                              key={doc.id}
                              className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs ${
                                doc.availability === 'active'
                                  ? 'border-slate-200'
                                  : 'border-slate-200/60 opacity-60'
                              }`}
                              title={`${doc.fullName} (${doc.specialty || 'แพทย์'})`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
                              <span className="truncate max-w-44">{doc.fullName}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Doctors Table View */}
      {activeTab === 'doctors' && (
        <section aria-labelledby="doctors-list-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="doctors-list-title" className="text-base font-bold text-slate-900">
              ทะเบียนแพทย์และผู้ตรวจ
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {visibleDoctors.length} คน
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs" aria-label="กำลังโหลดรายชื่อแพทย์">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : visibleDoctors.length === 0 ? (
            <EmptyPanel
              title="ไม่พบแพทย์ที่ค้นหา"
              detail="ลองเปลี่ยนคำค้นหา เลือกแผนกอื่น หรือเปิด 'แสดงที่ปิดใช้'"
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <div className="hidden grid-cols-[minmax(260px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_120px_110px] gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid">
                <span>แพทย์ / บัญชี</span>
                <span>แผนกสังกัด</span>
                <span>ความเชี่ยวชาญ</span>
                <span>สถานะ</span>
                <span className="text-right">จัดการ</span>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleDoctors.map((doctor) => {
                  const department = departments.find((item) => item.id === doctor.departmentId);
                  const statusConfig: Record<DoctorAvailability, { label: string; badge: string; dot: string }> = {
                    active: {
                      label: 'พร้อมออกตรวจ',
                      badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
                      dot: 'bg-emerald-500',
                    },
                    on_leave: {
                      label: 'ลาตรวจ',
                      badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70',
                      dot: 'bg-amber-500',
                    },
                    inactive: {
                      label: 'ปิดใช้งาน',
                      badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
                      dot: 'bg-slate-400',
                    },
                  };

                  const currentStatus = statusConfig[doctor.availability] ?? statusConfig.active;

                  return (
                    <article
                      key={doctor.id}
                      className="grid gap-4 px-6 py-4.5 transition-colors hover:bg-slate-50/60 lg:grid-cols-[minmax(260px,1.5fr)_minmax(180px,1fr)_minmax(180px,1fr)_120px_110px] lg:items-center"
                    >
                      {/* Doctor Name & Avatar */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white shadow-2xs">
                          {doctor.initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-slate-900">
                            {doctor.fullName}
                          </h3>
                          <p className="truncate text-xs text-slate-500">
                            {doctor.email || 'บัญชีแพทย์ในระบบ'}
                          </p>
                        </div>
                      </div>

                      {/* Department */}
                      <div className="text-sm text-slate-700">
                        <span className="mr-2 text-xs font-semibold text-slate-400 lg:hidden">แผนก:</span>
                        {department ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            <Building2 className="h-3 w-3 text-slate-500" aria-hidden="true" />
                            {department.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">ยังไม่สังกัดแผนก</span>
                        )}
                      </div>

                      {/* Specialty */}
                      <div className="text-sm text-slate-600">
                        <span className="mr-2 text-xs font-semibold text-slate-400 lg:hidden">ความเชี่ยวชาญ:</span>
                        {doctor.specialty || '-'}
                      </div>

                      {/* Availability */}
                      <div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${currentStatus.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} aria-hidden="true" />
                          {currentStatus.label}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openDoctorForm(doctor)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-600"
                          aria-label={`แก้ไข ${doctor.fullName}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => toggleDoctor(doctor)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            doctor.availability === 'inactive'
                              ? 'text-emerald-700 hover:bg-emerald-50'
                              : 'text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          {doctor.availability === 'inactive'
                            ? 'เปิดใช้'
                            : doctor.hasHistory || slots.some((slot) => slot.doctorId === doctor.id)
                            ? 'ปิดใช้'
                            : 'ลบ'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Slide-over Drawer: Department */}
      {departmentDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="department-drawer-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeDepartmentDrawer}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="border-b border-slate-200 px-6 py-5 flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Department Management</span>
                  <h2 id="department-drawer-title" className="text-xl font-bold text-slate-900 mt-1">
                    {editingDepartmentId ? 'แก้ไขแผนก' : 'เพิ่มแผนกใหม่'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    บันทึกข้อมูลเข้าตาราง departments ใน Supabase
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDepartmentDrawer}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                  aria-label="ปิดแผงแก้ไข"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {formError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="dept-name" className="text-sm font-semibold text-slate-800">
                    ชื่อแผนก <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="dept-name"
                    value={departmentDraft.name}
                    onChange={(e) => setDepartmentDraft((curr) => ({ ...curr, name: e.target.value }))}
                    placeholder="เช่น เวชปฏิบัติทั่วไป, กุมารเวชกรรม"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="dept-desc" className="text-sm font-semibold text-slate-800">
                    รายละเอียดบริการ
                  </label>
                  <textarea
                    id="dept-desc"
                    rows={4}
                    value={departmentDraft.description}
                    onChange={(e) => setDepartmentDraft((curr) => ({ ...curr, description: e.target.value }))}
                    placeholder="ระบุขอบเขตการรักษา หรือรายละเอียดเพิ่มเติมสำหรับผู้รับบริการ..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50"
                  />
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDepartmentDrawer}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200/70"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={saveDepartment}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกแผนก</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Drawer: Doctor */}
      {doctorDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="doctor-drawer-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeDoctorDrawer}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="border-b border-slate-200 px-6 py-5 flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Doctor Roster</span>
                  <h2 id="doctor-drawer-title" className="text-xl font-bold text-slate-900 mt-1">
                    {editingDoctorId ? 'แก้ไขข้อมูลแพทย์' : 'ผูกแพทย์กับแผนก'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    เลือกบัญชีผู้ใช้ที่มี role medical เพื่อผูกเข้ากับแผนกตรวจ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDoctorDrawer}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                  aria-label="ปิดแผงแก้ไข"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                {formError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="doc-account" className="text-sm font-semibold text-slate-800">
                    เลือกบัญชีแพทย์ <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="doc-account"
                    value={doctorDraft.profileId}
                    disabled={Boolean(editingDoctorId)}
                    onChange={(e) => selectDoctorAccount(e.target.value)}
                    className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}
                  >
                    <option value="">-- เลือกบัญชีที่มี role medical --</option>
                    {editingDoctorId && (
                      <option value={doctorDraft.profileId}>
                        {doctorDraft.fullName} {doctorDraft.email ? `(${doctorDraft.email})` : ''}
                      </option>
                    )}
                    {!editingDoctorId &&
                      doctorAccounts
                        .filter((account) => !doctors.some((doctor) => doctor.profileId === account.profileId))
                        .map((account) => (
                          <option key={account.profileId} value={account.profileId}>
                            {account.fullName} {account.email ? `(${account.email})` : ''}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="doc-dept" className="text-sm font-semibold text-slate-800">
                    แผนกสังกัด <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="doc-dept"
                    value={doctorDraft.departmentId}
                    onChange={(e) => setDoctorDraft((curr) => ({ ...curr, departmentId: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">-- เลือกแผนก --</option>
                    {departments
                      .filter((department) => department.isActive)
                      .map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="doc-spec" className="text-sm font-semibold text-slate-800">
                    ความเชี่ยวชาญเฉพาะทาง
                  </label>
                  <input
                    id="doc-spec"
                    value={doctorDraft.specialty}
                    onChange={(e) => setDoctorDraft((curr) => ({ ...curr, specialty: e.target.value }))}
                    placeholder="เช่น เวชปฏิบัติทั่วไป, ทันตกรรมทั่วไป"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="doc-avail" className="text-sm font-semibold text-slate-800">
                    สถานะการออกตรวจ
                  </label>
                  <select
                    id="doc-avail"
                    value={doctorDraft.availability}
                    onChange={(e) =>
                      setDoctorDraft((curr) => ({
                        ...curr,
                        availability: e.target.value as DoctorAvailability,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="active">พร้อมออกตรวจ</option>
                    <option value="on_leave">ลาตรวจ</option>
                    <option value="inactive">ปิดใช้งาน</option>
                  </select>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDoctorDrawer}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200/70"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={saveDoctor}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกข้อมูลแพทย์</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
        <Search className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{detail}</p>
    </div>
  );
}
