'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  X,
} from 'lucide-react';
import { useShop } from '@/features/shop/context/ShopProvider';
import type {
  DoctorAvailability,
  ScheduleDepartment,
  ScheduleDoctor,
} from '@/types/schedule';

const inputClass =
  'h-11 w-full min-w-0 rounded-lg border border-brand-border-strong bg-transparent px-3.5 text-sm text-brand-ink placeholder:text-brand-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong';
const textActionClass = 'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50';

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!departmentDrawerOpen && !doctorDrawerOpen) return;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea')?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (departmentDrawerOpen) setDepartmentDrawerOpen(false);
        if (doctorDrawerOpen) setDoctorDrawerOpen(false);
      }
      if (e.key === 'Tab' && drawer) {
        const controls = drawer.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      drawerTriggerRef.current?.focus();
    };
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
    drawerTriggerRef.current = document.activeElement as HTMLElement;
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
    drawerTriggerRef.current = document.activeElement as HTMLElement;
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

  const changeTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setSearch('');
  };

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <h1 className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">แผนกและแพทย์</h1>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => (activeTab === 'departments' ? openDepartmentForm() : openDoctorForm())}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {activeTab === 'departments' ? 'เพิ่มแผนก' : 'เพิ่มแพทย์'}
        </button>
      </header>

      <div className="flex gap-6 border-b border-brand-border-soft" role="tablist" aria-label="เลือกมุมมองการจัดการ">
        {([
          ['departments', 'แผนก', departments.length],
          ['doctors', 'แพทย์', doctors.length],
        ] as const).map(([tab, label, count]) => (
          <button
            key={tab}
            id={`${tab}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => changeTab(tab)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const nextTab = event.key === 'Home' ? 'departments' : event.key === 'End' ? 'doctors' : tab === 'departments' ? 'doctors' : 'departments';
              changeTab(nextTab);
              document.getElementById(`${nextTab}-tab`)?.focus();
            }}
            className={`flex min-h-11 items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${activeTab === tab ? 'border-brand-strong text-brand-strong' : 'border-transparent text-brand-body hover:text-brand-strong'}`}
          >
            {label}<span className="text-xs font-normal tabular-nums">{count}</span>
          </button>
        ))}
      </div>

      <section aria-label="ค้นหาและกรองรายการ" className="flex flex-wrap items-end gap-4">
        <label className="grid w-full gap-2 text-sm text-brand-body sm:w-80">
          <span>{activeTab === 'departments' ? 'ค้นหาแผนก' : 'ค้นหาแพทย์'}</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-brand-body" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={activeTab === 'departments' ? 'ชื่อแผนกหรือรายละเอียด' : 'ชื่อ ความเชี่ยวชาญ หรืออีเมล'}
              className={`${inputClass} pl-9`}
            />
          </span>
        </label>
        {activeTab === 'doctors' && (
          <label className="grid w-full gap-2 text-sm text-brand-body sm:w-60">
            <span>แผนก</span>
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={inputClass}>
              <option value="all">ทุกแผนก</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
        )}
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-brand-body">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 accent-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong" />
          แสดงที่ปิดใช้
        </label>
      </section>
      {/* Notifications Banner */}
      <div aria-live="polite" className="space-y-3 empty:hidden">
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

      </div>

      {activeTab === 'departments' && (
        <section id="departments-panel" role="tabpanel" aria-labelledby="departments-tab" aria-busy={isLoading}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-ink">รายชื่อแผนก</h2>
            <span className="text-sm tabular-nums text-brand-body">{visibleDepartments.length} รายการ</span>
          </div>
          {isLoading ? (
            <ListLoading label="กำลังโหลดรายการแผนก" />
          ) : visibleDepartments.length === 0 ? (
            <EmptyPanel title="ไม่พบแผนก" detail="ลองเปลี่ยนคำค้นหา หรือเลือก “แสดงที่ปิดใช้”" />
          ) : (
            <div className="divide-y divide-brand-border-soft border-y border-brand-border-soft">
              {visibleDepartments.map((department) => {
                const affiliatedDoctors = doctors.filter((doctor) => doctor.departmentId === department.id);
                return (
                  <article key={department.id} className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-8">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-semibold text-brand-ink">{department.name}</h3>
                      {department.description && <p className="mt-2 text-sm leading-6 text-brand-body">{department.description}</p>}
                      <p className={`mt-3 flex items-center gap-2 text-sm ${department.isActive ? 'text-status-success' : 'text-status-neutral'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${department.isActive ? 'bg-status-success' : 'bg-status-neutral'}`} aria-hidden="true" />
                        {department.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-2 text-sm font-medium text-brand-body">แพทย์ประจำแผนก <span className="tabular-nums">({affiliatedDoctors.length})</span></p>
                      {affiliatedDoctors.length === 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3">
                          <span className="text-sm text-brand-body">ยังไม่มีแพทย์</span>
                          <button type="button" onClick={() => { openDoctorForm(); setDoctorDraft((current) => ({ ...current, departmentId: department.id })); }} className={`${textActionClass} text-brand-strong`}>
                            <Plus className="h-4 w-4" aria-hidden="true" />เพิ่มแพทย์ในแผนก
                          </button>
                        </div>
                      ) : (
                        <ul className="space-y-2 text-sm leading-6 text-brand-ink">
                          {affiliatedDoctors.map((doctor) => (
                            <li key={doctor.id} className="break-words">
                              {doctor.fullName}
                              {doctor.availability !== 'active' && <span className={`ml-2 text-xs ${doctor.availability === 'on_leave' ? 'text-status-warning' : 'text-status-neutral'}`}>{doctor.availability === 'on_leave' ? 'ลาตรวจ' : 'ปิดใช้งาน'}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-x-4 lg:justify-end">
                      <button type="button" onClick={() => openDepartmentForm(department)} className={`${textActionClass} text-brand-strong`} aria-label={`แก้ไข ${department.name}`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />แก้ไข
                      </button>
                      <button type="button" disabled={isSaving} onClick={() => toggleDepartment(department)} className={`${textActionClass} ${department.isActive ? 'text-status-critical' : 'text-status-success'}`} aria-label={`${department.isActive ? 'ปิดใช้' : 'เปิดใช้'} ${department.name}`}>
                        <Power className="h-4 w-4" aria-hidden="true" />{department.isActive ? 'ปิดใช้' : 'เปิดใช้'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'doctors' && (
        <section id="doctors-panel" role="tabpanel" aria-labelledby="doctors-tab" aria-busy={isLoading}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-ink">รายชื่อแพทย์</h2>
            <span className="text-sm tabular-nums text-brand-body">{visibleDoctors.length} คน</span>
          </div>
          {isLoading ? (
            <ListLoading label="กำลังโหลดรายชื่อแพทย์" />
          ) : visibleDoctors.length === 0 ? (
            <EmptyPanel title="ไม่พบแพทย์" detail="ลองเปลี่ยนคำค้นหา แผนก หรือเลือก “แสดงที่ปิดใช้”" />
          ) : (
            <div className="border-y border-brand-border-soft">
              <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_140px_140px] gap-6 border-b border-brand-border-soft py-4 text-sm text-brand-body lg:grid">
                <span>แพทย์ / บัญชี</span><span>แผนก / ความเชี่ยวชาญ</span><span>สถานะ</span><span className="text-right">จัดการ</span>
              </div>
              <div className="divide-y divide-brand-border-soft">
                {visibleDoctors.map((doctor) => {
                  const department = departments.find((item) => item.id === doctor.departmentId);
                  const statusConfig: Record<DoctorAvailability, { label: string; text: string; dot: string }> = {
                    active: { label: 'พร้อมออกตรวจ', text: 'text-status-success', dot: 'bg-status-success' },
                    on_leave: { label: 'ลาตรวจ', text: 'text-status-warning', dot: 'bg-status-warning' },
                    inactive: { label: 'ปิดใช้งาน', text: 'text-status-neutral', dot: 'bg-status-neutral' },
                  };
                  const currentStatus = statusConfig[doctor.availability] ?? statusConfig.active;
                  const toggleLabel = doctor.availability === 'inactive' ? 'เปิดใช้' : doctor.hasHistory || slots.some((slot) => slot.doctorId === doctor.id) ? 'ปิดใช้' : 'ลบ';
                  return (
                    <article key={doctor.id} className="grid gap-4 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_140px_140px] lg:items-center lg:gap-6">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-semibold text-brand-ink">{doctor.fullName}</h3>
                        {doctor.email && <p className="mt-1 break-all text-sm text-brand-body">{doctor.email}</p>}
                      </div>
                      <div className="min-w-0 text-sm leading-6">
                        <p className="text-brand-ink"><span className="text-brand-body lg:hidden">แผนก: </span>{department?.name ?? 'ยังไม่สังกัดแผนก'}</p>
                        {doctor.specialty && <p className="text-brand-body"><span className="lg:hidden">ความเชี่ยวชาญ: </span>{doctor.specialty}</p>}
                      </div>
                      <p className={`flex items-center gap-2 text-sm ${currentStatus.text}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${currentStatus.dot}`} aria-hidden="true" />{currentStatus.label}
                      </p>
                      <div className="flex items-center gap-4 lg:justify-end">
                        <button type="button" onClick={() => openDoctorForm(doctor)} className={`${textActionClass} text-brand-strong`} aria-label={`แก้ไข ${doctor.fullName}`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />แก้ไข
                        </button>
                        <button type="button" disabled={isSaving} onClick={() => toggleDoctor(doctor)} className={`${textActionClass} ${doctor.availability === 'inactive' ? 'text-status-success' : 'text-status-critical'}`} aria-label={`${toggleLabel} ${doctor.fullName}`}>
                          {toggleLabel}
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
        <div ref={drawerRef} className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="department-drawer-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeDepartmentDrawer}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 flex w-full max-w-md sm:pl-6">
            <div className="flex h-full min-h-0 w-full flex-col justify-between bg-white shadow-xl">
              {/* Drawer Header */}
              <div className="border-b border-slate-200 px-6 py-5 flex items-start justify-between">
                <div>
                  <h2 id="department-drawer-title" className="text-xl font-bold text-slate-900 mt-1">
                    {editingDepartmentId ? 'แก้ไขแผนก' : 'เพิ่มแผนกใหม่'}
                  </h2>
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
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="dept-desc" className="text-sm font-semibold text-slate-800">
                    รายละเอียดแผนก
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
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-brand-border-soft px-6 py-4">
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
        <div ref={drawerRef} className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="doctor-drawer-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeDoctorDrawer}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 right-0 flex w-full max-w-md sm:pl-6">
            <div className="flex h-full min-h-0 w-full flex-col justify-between bg-white shadow-xl">
              {/* Drawer Header */}
              <div className="border-b border-slate-200 px-6 py-5 flex items-start justify-between">
                <div>
                  <h2 id="doctor-drawer-title" className="text-xl font-bold text-slate-900 mt-1">
                    {editingDoctorId ? 'แก้ไขข้อมูลแพทย์' : 'เพิ่มแพทย์ในแผนก'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    เลือกบัญชีแพทย์ที่มีอยู่ แล้วระบุแผนกสังกัด
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
                    <option value="">เลือกบัญชีแพทย์</option>
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
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-brand-border-soft px-6 py-4">
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
    <div className="border-t border-brand-border-soft py-12">
      <h3 className="text-base font-semibold text-brand-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-brand-body">{detail}</p>
    </div>
  );
}

function ListLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-brand-border-soft border-y border-brand-border-soft">
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden="true" className="grid gap-5 py-6 motion-safe:animate-pulse sm:grid-cols-2">
          <div className="space-y-3">
            <div className="h-5 w-36 rounded bg-brand-border-soft" />
            <div className="h-3 w-52 rounded bg-brand-border-soft" />
          </div>
          <div className="h-3 w-28 rounded bg-brand-border-soft" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
