'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { useShop } from '@/features/shop/context/ShopProvider';
import type { ScheduleSlot, ScheduleSlotStatus } from '@/types/schedule';
import type { UserRole } from '@/types/database';

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-sky-500 focus:ring-4 focus:ring-sky-100';

const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function getBangkokToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TODAY_DATE = getBangkokToday();

function getCurrentWeekMonday(refDateStr?: string): string {
  const dateStr = refDateStr ?? TODAY_DATE;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(y, m - 1, diff));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
}

type CalendarView = 'day' | 'week' | 'month';

interface SlotDraft {
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
}

const emptySlotDraft: SlotDraft = {
  doctorId: '',
  slotDate: TODAY_DATE,
  startTime: '08:30',
  endTime: '09:00',
  maxCapacity: 1,
};

function parseClinicDate(isoDate: string) {
  // Treat YYYY-MM-DD as a Bangkok calendar date, independent of the browser's zone.
  return new Date(`${isoDate}T12:00:00Z`);
}

function toClinicDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftClinicDate(isoDate: string, days: number) {
  const date = parseClinicDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toClinicDate(date);
}

function formatShortDate(isoDate: string) {
  const date = parseClinicDate(isoDate);
  return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}`;
}

function formatWeekRange(start: string) {
  const end = shiftClinicDate(start, 6);
  return `${formatShortDate(start)} – ${formatShortDate(end)} ${parseClinicDate(end).getUTCFullYear() + 543}`;
}

function addMinutesToTime(timeStr: string, minutes = 30): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export default function ScheduleWorkspace({ role, actorId }: { role: UserRole; actorId: string }) {
  const {
    departments,
    doctors,
    slots,
    saveSlot: persistSlot,
    toggleSlot: persistSlotToggle,
    isLoading,
  } = useShop();

  const currentDoctor = useMemo(
    () => doctors.find((d) => d.profileId === actorId || d.id === actorId),
    [doctors, actorId],
  );

  const [medicalScope, setMedicalScope] = useState<'my' | 'all'>(role === 'medical' ? 'my' : 'all');
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekMonday());
  const [isSaving, setIsSaving] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState<string>(() => {
    if (role === 'medical') {
      const match = doctors.find((d) => d.profileId === actorId || d.id === actorId);
      return match ? match.id : 'all';
    }
    return 'all';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleSlotStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SlotDraft>(emptySlotDraft);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const openDepartments = useMemo(() => {
    return departments
      .filter((dept) => dept.isActive)
      .map((dept) => {
        const deptDoctorIds = new Set(
          doctors.filter((d) => d.departmentId === dept.id).map((d) => d.id),
        );
        const openSlotsCount = slots.filter(
          (s) => deptDoctorIds.has(s.doctorId) && s.status !== 'closed',
        ).length;
        return {
          ...dept,
          openSlotsCount,
        };
      })
      .filter((dept) => dept.openSlotsCount > 0);
  }, [departments, doctors, slots]);

  const effectiveDepartmentFilter = useMemo(() => {
    if (departmentFilter === 'all') return 'all';
    return openDepartments.some((d) => d.id === departmentFilter) ? departmentFilter : 'all';
  }, [departmentFilter, openDepartments]);

  const canModifySlot = (slot: ScheduleSlot) => {
    if (role === 'staff_admin') return true;
    if (role === 'medical' && currentDoctor) return slot.doctorId === currentDoctor.id;
    return false;
  };

  const weekDays = useMemo(
    () => {
      const monday = getCurrentWeekMonday(weekStart);
      return Array.from({ length: 7 }, (_, index) => shiftClinicDate(monday, index));
    },
    [weekStart],
  );

  const displayDays = useMemo(() => {
    if (calendarView === 'day') return [weekStart];
    if (calendarView === 'week') return weekDays;
    const first = `${weekStart.slice(0, 7)}-01`;
    const firstDate = parseClinicDate(first);
    const mondayOffset = (firstDate.getUTCDay() + 6) % 7;
    const gridStart = shiftClinicDate(first, -mondayOffset);
    return Array.from({ length: 35 }, (_, index) => shiftClinicDate(gridStart, index));
  }, [calendarView, weekDays, weekStart]);

  const filteredDoctors = useMemo(
    () =>
      doctors.filter(
        (doctor) => effectiveDepartmentFilter === 'all' || doctor.departmentId === effectiveDepartmentFilter,
      ),
    [effectiveDepartmentFilter, doctors],
  );

  const visibleSlots = useMemo(
    () =>
      slots
        .filter((slot) => displayDays.includes(slot.slotDate))
        .filter((slot) => {
          const doctor = doctors.find((item) => item.id === slot.doctorId);
          const matchesDepartment =
            effectiveDepartmentFilter === 'all' || doctor?.departmentId === effectiveDepartmentFilter;
          const matchesDoctor = doctorFilter === 'all' || slot.doctorId === doctorFilter;
          const matchesStatus = statusFilter === 'all' || slot.status === statusFilter;
          return matchesDepartment && matchesDoctor && matchesStatus;
        })
        .sort((a, b) => `${a.slotDate}${a.startTime}`.localeCompare(`${b.slotDate}${b.startTime}`)),
    [effectiveDepartmentFilter, doctorFilter, displayDays, doctors, slots, statusFilter],
  );

  const weekSummary = useMemo(() => {
    const weekSlots = slots.filter((slot) => displayDays.includes(slot.slotDate));
    return {
      total: weekSlots.length,
      available: weekSlots.filter((slot) => slot.status === 'available').length,
      booked: weekSlots.reduce((sum, slot) => sum + slot.bookedCount, 0),
      closed: weekSlots.filter((slot) => slot.status === 'closed').length,
    };
  }, [displayDays, slots]);

  const openSlotForm = (slot?: ScheduleSlot, suggestedDate?: string) => {
    if (role === 'patient') return;
    if (slot && !canModifySlot(slot)) {
      setFormError('คุณไม่มีสิทธิ์แก้ไขรอบตรวจของแพทย์ท่านอื่น');
      return;
    }
    setFormError('');
    setNotice('');
    setEditingSlotId(slot?.id ?? null);
    const defaultDoctorId = role === 'medical' && currentDoctor ? currentDoctor.id : '';
    setDraft(
      slot
        ? {
            doctorId: slot.doctorId,
            slotDate: slot.slotDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxCapacity: slot.maxCapacity,
          }
        : { ...emptySlotDraft, doctorId: defaultDoctorId, slotDate: suggestedDate ?? weekDays[0] },
    );
    setFormOpen(true);
  };

  const handleScopeChange = (scope: 'my' | 'all') => {
    setMedicalScope(scope);
    if (scope === 'my' && currentDoctor) {
      setDoctorFilter(currentDoctor.id);
    } else {
      setDoctorFilter('all');
    }
  };

  const saveSlot = async () => {
    if (role === 'patient') return;
    try {
      setIsSaving(true);
      setFormError('');
      const currentSlot = slots.find((slot) => slot.id === editingSlotId);
      const result = await persistSlot(draft, editingSlotId ?? undefined);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setNotice(currentSlot ? 'อัปเดตรอบตรวจในระบบเรียบร้อยแล้ว' : 'เพิ่มรอบตรวจในระบบเรียบร้อยแล้ว');
      setFormOpen(false);
      setEditingSlotId(null);
      setDraft(emptySlotDraft);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกรอบตรวจ');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleClosed = async (slot: ScheduleSlot) => {
    if (role === 'patient' || !canModifySlot(slot)) {
      setFormError('คุณไม่มีสิทธิ์แก้ไขหรือปิดรอบตรวจ');
      return;
    }
    if (!window.confirm(slot.status === 'closed' ? 'เปิดรอบตรวจนี้อีกครั้ง?' : `ปิดรอบตรวจนี้? นัดเดิม ${slot.bookedCount} รายการจะยังคงอยู่`)) return;
    try {
      setIsSaving(true);
      setFormError('');
      const result = await persistSlotToggle(slot.id, actorId, role);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setNotice(slot.status === 'closed' ? 'เปิดรอบตรวจอีกครั้งเรียบร้อยแล้ว' : 'ปิดรอบตรวจแล้ว นัดเดิมยังคงอยู่');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปรับสถานะรอบตรวจ');
    } finally {
      setIsSaving(false);
    }
  };

  const jumpToToday = () => {
    setWeekStart(getCurrentWeekMonday());
    setNotice('ไปยังสัปดาห์ปัจจุบันแล้ว');
  };

  const handleDrillDownDay = (date: string) => {
    setWeekStart(date);
    setCalendarView('day');
    setNotice(`แสดงรอบตรวจประจำวันที่ ${formatShortDate(date)}`);
  };

  useEffect(() => {
    if (!formOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFormOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formOpen]);

  return (
    <div className="schedule-shell flex flex-col gap-6">
      <header className="order-1 overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
        <div className="relative grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="absolute inset-y-0 left-0 w-2 bg-sky-500" aria-hidden="true" />
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-sky-700">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE DATABASE
              </span>
              <span className="text-slate-400">ASIA/BANGKOK</span>
              {isLoading && <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-700">กำลังโหลด...</span>}
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] text-slate-950 text-balance sm:text-4xl">ตารางออกตรวจประจำสัปดาห์</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">เห็นกำลังให้บริการของแต่ละวัน ปรับรอบตรวจ และปิดรอบโดยไม่แตะจำนวนจองของระบบนัดหมาย</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['รอบทั้งหมด', weekSummary.total, 'text-slate-950'],
              ['เปิดรับ', weekSummary.available, 'text-emerald-700'],
              ['จองแล้ว', weekSummary.booked, 'text-sky-700'],
              ['ปิดรอบ', weekSummary.closed, 'text-rose-700'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="min-w-20 rounded-2xl bg-slate-50 px-3 py-3 text-center ring-1 ring-slate-200/70">
                <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="mt-1 text-[11px] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="order-3 space-y-2" aria-live="polite">
        {notice && (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" aria-hidden="true" />
              {notice}
            </span>
            <button type="button" onClick={() => setNotice('')} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-emerald-100" aria-label="ปิดข้อความ">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {formError && !formOpen && (
          <div className="flex items-center justify-between gap-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
            <span className="flex items-center gap-2">
              <X className="h-4 w-4" aria-hidden="true" />
              {formError}
            </span>
            <button type="button" onClick={() => setFormError('')} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-rose-100" aria-label="ปิดข้อความ">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="slot-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Slot editor</p>
                <h2 id="slot-form-title" className="mt-1 text-xl font-bold text-slate-950">
                  {editingSlotId ? 'แก้ไขรอบตรวจ' : 'สร้างรอบตรวจใหม่'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  กำหนดช่วงเวลาตรวจและความจุผู้ป่วยเพื่อเปิดรับนัดหมาย
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="ปิดแบบฟอร์ม"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">แพทย์</span>
                {role === 'medical' && currentDoctor ? (
                  <input
                    type="text"
                    disabled
                    value={`${currentDoctor.fullName} (คุณ)`}
                    className={`${inputClass} bg-slate-100 text-slate-600 cursor-not-allowed`}
                  />
                ) : (
                  <select
                    value={draft.doctorId}
                    onChange={(event) => setDraft((current) => ({ ...current, doctorId: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="">เลือกแพทย์</option>
                    {doctors
                      .filter(
                        (doctor) =>
                          doctor.availability === 'active' &&
                          departments.some((department) => department.id === doctor.departmentId && department.isActive),
                      )
                      .map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.fullName} · {departments.find((department) => department.id === doctor.departmentId)?.name}
                        </option>
                      ))}
                  </select>
                )}
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">วันที่</span>
                <input
                  type="date"
                  value={draft.slotDate}
                  onChange={(event) => setDraft((current) => ({ ...current, slotDate: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">เวลาเริ่ม</span>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => {
                    const newStartTime = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      startTime: newStartTime,
                      endTime: addMinutesToTime(newStartTime, 30),
                    }));
                  }}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">เวลาสิ้นสุด</span>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">ความจุผู้ป่วย (คน)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft.maxCapacity}
                  onChange={(event) => setDraft((current) => ({ ...current, maxCapacity: Number(event.target.value) }))}
                  className={inputClass}
                />
              </label>
            </div>

            {editingSlotId && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                จำนวนที่จองแล้วจะปรับเปลี่ยนอัตโนมัติตามการจองหรือยกเลิกคิวของผู้ป่วย (ไม่สามารถแก้ไขตัวเลขโดยตรงได้)
              </div>
            )}

            {formError && (
              <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={saveSlot}
                className="min-h-11 rounded-xl bg-[#0a2540] px-5 text-sm font-semibold text-white hover:bg-[#123e67] active:scale-[0.98] disabled:opacity-50 shadow-xs"
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกรอบตรวจ'}
              </button>
            </div>
          </div>
        </div>
      )}


      <section className="order-5 overflow-hidden rounded-2xl bg-white shadow-[0_5px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80" aria-label="ปฏิทินตารางตรวจ">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={jumpToToday}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.98]"
            >
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              วันนี้
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setWeekStart((current) => shiftClinicDate(current, calendarView === 'day' ? -1 : calendarView === 'month' ? -28 : -7))}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-xs"
                aria-label="ช่วงก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-44 px-2 text-center">
                <span className="text-xs font-bold tabular-nums text-slate-800">
                  {calendarView === 'day'
                    ? formatShortDate(weekStart)
                    : calendarView === 'month'
                      ? `${monthNames[parseClinicDate(weekStart).getUTCMonth()]} ${parseClinicDate(weekStart).getUTCFullYear() + 543}`
                      : formatWeekRange(weekStart)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWeekStart((current) => shiftClinicDate(current, calendarView === 'day' ? 1 : calendarView === 'month' ? 28 : 7))}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:shadow-xs"
                aria-label="ช่วงถัดไป"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">กรองแผนก</span>
              <Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
              <select
                value={effectiveDepartmentFilter}
                onChange={(event) => { setDepartmentFilter(event.target.value); setDoctorFilter('all'); }}
                className="h-10 min-w-36 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">ทุกแผนก</option>
                {openDepartments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">กรองแพทย์</span>
              <select
                value={doctorFilter}
                onChange={(event) => setDoctorFilter(event.target.value)}
                className="h-10 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">แพทย์ทุกคน</option>
                {filteredDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">กรองสถานะ</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ScheduleSlotStatus)}
                className="h-10 min-w-28 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="available">เปิดรับ</option>
                <option value="full">เต็ม</option>
                <option value="closed">ปิดรอบ</option>
              </select>
            </label>

            <label>
              <span className="sr-only">มุมมองปฏิทิน</span>
              <select
                value={calendarView}
                onChange={(event) => setCalendarView(event.target.value as CalendarView)}
                className="h-10 min-w-28 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="day">วัน</option>
                <option value="week">สัปดาห์</option>
                <option value="month">เดือน</option>
              </select>
            </label>

            {role === 'medical' && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleScopeChange('my')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    medicalScope === 'my'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ตารางของฉัน
                </button>
                <button
                  type="button"
                  onClick={() => handleScopeChange('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    medicalScope === 'all'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ภาพรวมคลินิก
                </button>
              </div>
            )}

            {(role === 'medical' || role === 'staff_admin') && (
              <button
                type="button"
                onClick={() => openSlotForm()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0a2540] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#123e67] active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                เพิ่มรอบตรวจ
              </button>
            )}
          </div>
        </div>

        {calendarView !== 'week' ? (
          <CalendarBoard
            view={calendarView}
            days={displayDays}
            slots={visibleSlots}
            doctors={doctors}
            departments={departments}
            canModifySlot={canModifySlot}
            canCreate={role !== 'patient'}
            onCreate={openSlotForm}
            onEdit={openSlotForm}
            onToggle={toggleClosed}
            onSelectDay={handleDrillDownDay}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
                {weekDays.map((date) => {
                  const parsed = parseClinicDate(date);
                  const isToday = date === TODAY_DATE;
                  return (
                    <div key={date} className={`px-3 py-4 text-center ${isToday ? 'bg-sky-50' : ''}`}>
                      <div className={`text-xs font-semibold ${isToday ? 'text-sky-700' : 'text-slate-500'}`}>{dayNames[parsed.getUTCDay()]}</div>
                      <div className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-full text-base font-bold tabular-nums ${isToday ? 'bg-sky-600 text-white' : 'text-slate-950'}`}>{parsed.getUTCDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid min-h-[460px] grid-cols-7 divide-x divide-slate-200">
                {weekDays.map((date) => {
                  const daySlots = visibleSlots.filter((slot) => slot.slotDate === date);
                  return (
                    <div key={date} className={`min-w-0 space-y-3 p-3 ${date === TODAY_DATE ? 'bg-sky-50/30' : ''}`}>
                      {daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          doctors={doctors}
                          departments={departments}
                          canModify={canModifySlot(slot)}
                          onEdit={() => openSlotForm(slot)}
                          onToggleClosed={() => toggleClosed(slot)}
                        />
                      ))}
                      {daySlots.length === 0 && (
                        role === 'patient' ? (
                          <div className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                            ไม่มีรอบตรวจ
                          </div>
                        ) : (
                          <button type="button" onClick={() => openSlotForm(undefined, date)} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700">
                            <Plus className="mb-2 h-4 w-4" aria-hidden="true" />เพิ่มรอบ
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 p-4 lg:hidden">
              {weekDays.map((date) => {
                const parsed = parseClinicDate(date);
                const daySlots = visibleSlots.filter((slot) => slot.slotDate === date);
                return (
                  <article key={date} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-sky-700">{dayNames[parsed.getUTCDay()]}</div>
                        <h2 className="font-bold text-slate-950">{formatShortDate(date)}</h2>
                      </div>
                      {role !== 'patient' && (
                        <button type="button" onClick={() => openSlotForm(undefined, date)} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                          <Plus className="h-4 w-4" aria-hidden="true" />เพิ่มรอบ
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          doctors={doctors}
                          departments={departments}
                          canModify={canModifySlot(slot)}
                          onEdit={() => openSlotForm(slot)}
                          onToggleClosed={() => toggleClosed(slot)}
                        />
                      ))}
                      {daySlots.length === 0 && (
                        <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-400 sm:col-span-2">ยังไม่มีรอบตรวจ</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

    </div>
  );
}

function SlotCard({
  slot,
  doctors,
  departments,
  canModify = true,
  onEdit,
  onToggleClosed,
}: {
  slot: ScheduleSlot;
  doctors: import('@/types/schedule').ScheduleDoctor[];
  departments: import('@/types/schedule').ScheduleDepartment[];
  canModify?: boolean;
  onEdit: () => void;
  onToggleClosed: () => void;
}) {
  const doctor = doctors.find((item) => item.id === slot.doctorId);
  const department = departments.find((item) => item.id === doctor?.departmentId);
  const statusConfig: Record<ScheduleSlotStatus, { label: string; card: string; pill: string; icon: typeof CircleDot }> = {
    available: { label: 'เปิดรับ', card: 'border-emerald-200 bg-emerald-50/60', pill: 'bg-emerald-100 text-emerald-800', icon: CircleDot },
    full: { label: 'เต็ม', card: 'border-sky-200 bg-sky-50/70', pill: 'bg-sky-100 text-sky-800', icon: Users },
    closed: { label: 'ปิดรอบ', card: 'border-rose-200 bg-rose-50/60', pill: 'bg-rose-100 text-rose-800', icon: Ban },
  };
  const config = statusConfig[slot.status];
  const StatusIcon = config.icon;
  const occupancy = Math.min(100, Math.round((slot.bookedCount / slot.maxCapacity) * 100));

  return (
    <article className={`rounded-xl border p-3 ${config.card}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${config.pill}`}>
          <StatusIcon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </span>
        {canModify ? (
          <div className="flex">
            <button type="button" onClick={onEdit} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70" aria-label={`แก้ไขรอบ ${slot.startTime}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={onToggleClosed} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70" aria-label={slot.status === 'closed' ? 'เปิดรอบตรวจ' : 'ปิดรอบตรวจ'}>
              {slot.status === 'closed' ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            ดูเท่านั้น
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-950"><Clock3 className="h-4 w-4 text-slate-500" aria-hidden="true" /><span className="tabular-nums">{slot.startTime}–{slot.endTime}</span></div>
      <div className="mt-3 flex items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a2540] text-[10px] font-bold text-white">{doctor?.initials ?? '?'}</div><div className="min-w-0"><div className="truncate text-xs font-bold text-slate-900">{doctor?.fullName ?? 'ไม่พบแพทย์'}</div><div className="truncate text-[10px] text-slate-500">{department?.name ?? 'ไม่พบแผนก'}</div></div></div>
      <div className="mt-3"><div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500"><span>จองแล้ว</span><strong className="text-slate-700 tabular-nums">{slot.bookedCount}/{slot.maxCapacity}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full ${slot.status === 'closed' ? 'bg-rose-400' : slot.status === 'full' ? 'bg-sky-500' : 'bg-emerald-500'}`} style={{ width: `${occupancy}%` }} /></div></div>
    </article>
  );
}

function CalendarBoard({
  view,
  days,
  slots,
  doctors,
  departments,
  canModifySlot,
  canCreate = true,
  onCreate,
  onEdit,
  onToggle,
  onSelectDay,
}: {
  view: CalendarView;
  days: string[];
  slots: ScheduleSlot[];
  doctors: import('@/types/schedule').ScheduleDoctor[];
  departments: import('@/types/schedule').ScheduleDepartment[];
  canModifySlot: (slot: ScheduleSlot) => boolean;
  canCreate?: boolean;
  onCreate: (slot?: ScheduleSlot, suggestedDate?: string) => void;
  onEdit: (slot?: ScheduleSlot, suggestedDate?: string) => void;
  onToggle: (slot: ScheduleSlot) => void;
  onSelectDay?: (date: string) => void;
}) {
  if (view === 'day') {
    const date = days[0];
    return (
      <div aria-label="ปฏิทินรายวัน">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-xs font-semibold text-sky-700">{dayNames[parseClinicDate(date).getUTCDay()]}</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{formatShortDate(date)}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {slots.filter((slot) => slot.slotDate === date).map((slot) => (
            <div key={slot.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="w-24 text-sm font-bold tabular-nums text-slate-700">{slot.startTime}–{slot.endTime}</div>
              <div className="min-w-0 flex-1">
                <SlotCard
                  slot={slot}
                  doctors={doctors}
                  departments={departments}
                  canModify={canModifySlot(slot)}
                  onEdit={() => onEdit(slot)}
                  onToggleClosed={() => onToggle(slot)}
                />
              </div>
            </div>
          ))}
          {slots.filter((slot) => slot.slotDate === date).length === 0 && (
            canCreate ? (
              <button type="button" onClick={() => onCreate(undefined, date)} className="m-5 flex min-h-28 w-[calc(100%-2.5rem)] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />เพิ่มรอบตรวจวันนี้
              </button>
            ) : (
              <div className="m-5 flex min-h-28 w-[calc(100%-2.5rem)] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                ไม่มีรอบตรวจวันนี้
              </div>
            )
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto" aria-label={view === 'month' ? 'ปฏิทินรายเดือน' : 'ปฏิทินรายสัปดาห์'}>
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
          {days.slice(0, 7).map((date) => {
            const parsed = parseClinicDate(date);
            return (
              <div key={date} className="px-2 py-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500">{dayNames[parsed.getUTCDay()]}</div>
                <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${date === TODAY_DATE ? 'bg-sky-600 text-white' : 'text-slate-950'}`}>{parsed.getUTCDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
          {days.map((date) => {
            const daySlots = slots.filter((slot) => slot.slotDate === date);
            const isToday = date === TODAY_DATE;
            return (
              <div
                key={date}
                onDoubleClick={() => onSelectDay?.(date)}
                className={`group min-h-36 min-w-0 p-2 transition-colors cursor-pointer select-none hover:bg-sky-50/40 ${
                  isToday ? 'bg-sky-50/20' : ''
                }`}
                title="ดับเบิ้ลคลิกเพื่อดูตารางตรวจรายวัน"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    ดับเบิ้ลคลิกดูวัน
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay?.(date);
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                      isToday
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-sky-100 hover:text-sky-800'
                    }`}
                    title={`ดูตารางตรวจวันที่ ${formatShortDate(date)}`}
                  >
                    {parseClinicDate(date).getUTCDate()}
                  </button>
                </div>
                <div className="space-y-1">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <MiniSlot
                        slot={slot}
                        doctors={doctors}
                        canModify={canModifySlot(slot)}
                        onEdit={() => onEdit(slot)}
                      />
                    </div>
                  ))}
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreate(undefined, date);
                    }}
                    className="mt-1 flex min-h-7 w-full items-center justify-center rounded border border-dashed border-transparent text-[10px] text-slate-400 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition"
                    title="เพิ่มรอบตรวจ"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniSlot({
  slot,
  doctors,
  canModify = true,
  onEdit,
}: {
  slot: ScheduleSlot;
  doctors: import('@/types/schedule').ScheduleDoctor[];
  canModify?: boolean;
  onEdit: () => void;
}) {
  const doctor = doctors.find((item) => item.id === slot.doctorId);
  const colors = slot.status === 'closed' ? 'border-rose-500 bg-rose-50 text-rose-800' : slot.status === 'full' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-sky-500 bg-sky-50 text-sky-800';
  if (!canModify) {
    return (
      <div
        className={`mb-1 block w-full truncate rounded border-l-2 px-2 py-1 text-left text-[10px] font-semibold opacity-75 cursor-default ${colors}`}
        title={`${slot.startTime} ${doctor?.fullName ?? ''} (ดูเท่านั้น)`}
      >
        <span className="tabular-nums">{slot.startTime}</span> · {doctor?.fullName?.replace('นพ. ', '').replace('พญ. ', '') ?? 'ไม่พบแพทย์'} · {slot.bookedCount}/{slot.maxCapacity}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`mb-1 block w-full truncate rounded border-l-2 px-2 py-1 text-left text-[10px] font-semibold ${colors}`}
      title={`${slot.startTime} ${doctor?.fullName ?? ''}`}
    >
      <span className="tabular-nums">{slot.startTime}</span> · {doctor?.fullName?.replace('นพ. ', '').replace('พญ. ', '') ?? 'ไม่พบแพทย์'} · {slot.bookedCount}/{slot.maxCapacity}
    </button>
  );
}
