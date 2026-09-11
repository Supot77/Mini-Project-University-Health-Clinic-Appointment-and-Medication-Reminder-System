'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import ScheduleSkeleton from './ScheduleSkeleton';
import { useShop } from '@/features/shop/context/ShopProvider';
import type { ScheduleSlot, ScheduleSlotStatus } from '@/types/schedule';
import type { UserRole } from '@/types/database';

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-sky-500 focus:ring-4 focus:ring-sky-100';

const filterClass = 'h-11 w-full rounded-lg border border-brand-border-strong bg-transparent px-3 text-sm text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong';
const textButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong';
const slotStyles: Record<ScheduleSlotStatus, { label: string; marker: string; text: string }> = {
  available: { label: 'เปิดรับ', marker: 'border-status-success', text: 'text-status-success' },
  full: { label: 'เต็ม', marker: 'border-status-warning', text: 'text-status-warning' },
  closed: { label: 'ปิดรอบ', marker: 'border-status-neutral', text: 'text-status-neutral' },
};

const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

import {
  deriveSlotStatus,
  getBangkokCurrentTime,
  getBangkokToday,
  isSlotExpired,
} from '@/features/shop/domain/rules';

function getTodayDate(): string {
  return getBangkokToday();
}

function getCurrentWeekMonday(refDateStr?: string): string {
  const dateStr = refDateStr ?? getTodayDate();
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
  serviceId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
}

const emptySlotDraft: SlotDraft = {
  doctorId: '',
  serviceId: '',
  get slotDate() {
    return getTodayDate();
  },
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

export function getNextAvailableTimeSlot(
  slots: ScheduleSlot[],
  doctorId: string,
  slotDate: string,
): { startTime: string; endTime: string } {
  if (!doctorId || !slotDate) {
    return { startTime: '08:30', endTime: '09:00' };
  }
  const doctorDaySlots = slots.filter(
    (s) => s.doctorId === doctorId && s.slotDate === slotDate,
  );
  if (doctorDaySlots.length === 0) {
    return { startTime: '08:30', endTime: '09:00' };
  }
  const latestEndTime = doctorDaySlots.reduce((max, s) => (s.endTime > max ? s.endTime : max), '08:30');

  // Skip lunch break 12:00–13:00
  if (latestEndTime >= '12:00' && latestEndTime < '13:00') {
    return { startTime: '13:00', endTime: '13:30' };
  }
  // If latestEndTime is already at or past closing time 16:30
  if (latestEndTime >= '16:30') {
    return { startTime: '16:00', endTime: '16:30' };
  }
  const nextEndTime = addMinutesToTime(latestEndTime, 30);
  return {
    startTime: latestEndTime,
    endTime: nextEndTime > '16:30' ? '16:30' : nextEndTime,
  };
}

export default function ScheduleWorkspace({ role, actorId }: { role: UserRole; actorId: string }) {
  const {
    departments,
    doctors,
    services = [],
    slots,
    saveService: persistService,
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
  const [serviceFilter, setServiceFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState<string>(() => {
    if (role === 'medical') {
      const match = doctors.find((d) => d.profileId === actorId || d.id === actorId);
      return match ? match.id : 'all';
    }
    return 'all';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleSlotStatus>('available');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SlotDraft>(emptySlotDraft);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceDraft, setServiceDraft] = useState({ code: '', name: '', description: '' });
  const [serviceFormError, setServiceFormError] = useState('');

  const [bangkokNow, setBangkokNow] = useState(() => ({
    date: getBangkokToday(),
    time: getBangkokCurrentTime(),
  }));

  useEffect(() => {
    const updateTime = () => {
      setBangkokNow({
        date: getBangkokToday(),
        time: getBangkokCurrentTime(),
      });
    };
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const resolvedSlots = useMemo(() => {
    return slots.map((slot) => {
      const status = deriveSlotStatus(slot.bookedCount, slot.maxCapacity, slot.status, {
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        currentDate: bangkokNow.date,
        currentTime: bangkokNow.time,
      });
      return status !== slot.status ? { ...slot, status } : slot;
    });
  }, [slots, bangkokNow]);

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

  const activeServices = useMemo(() => services.filter((service) => service.isActive), [services]);
  const openServices = useMemo(
    () => activeServices.filter((service) => slots.some((slot) => slot.serviceId === service.id && slot.status !== 'closed')),
    [activeServices, slots],
  );

  const effectiveServiceFilter = useMemo(() => {
    if (serviceFilter === 'all') return 'all';
    return openServices.some((service) => service.id === serviceFilter) ? serviceFilter : 'all';
  }, [openServices, serviceFilter]);

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
        (doctor) =>
          (effectiveDepartmentFilter === 'all' || doctor.departmentId === effectiveDepartmentFilter) &&
          (effectiveServiceFilter === 'all' || resolvedSlots.some((slot) => slot.doctorId === doctor.id && slot.serviceId === effectiveServiceFilter)),
      ),
    [doctors, effectiveDepartmentFilter, effectiveServiceFilter, resolvedSlots],
  );

  const visibleSlots = useMemo(
    () =>
      resolvedSlots
        .filter((slot) => displayDays.includes(slot.slotDate))
        .filter((slot) => {
          const doctor = doctors.find((item) => item.id === slot.doctorId);
          const matchesDepartment = effectiveDepartmentFilter === 'all' || doctor?.departmentId === effectiveDepartmentFilter;
          const matchesService = effectiveServiceFilter === 'all' || slot.serviceId === effectiveServiceFilter;
          const matchesDoctor = doctorFilter === 'all' || slot.doctorId === doctorFilter;
          const matchesStatus = statusFilter === 'all' || slot.status === statusFilter;
          return matchesDepartment && matchesService && matchesDoctor && matchesStatus;
        })
        .sort((a, b) => `${a.slotDate}${a.startTime}`.localeCompare(`${b.slotDate}${b.startTime}`)),
    [effectiveDepartmentFilter, effectiveServiceFilter, doctorFilter, displayDays, doctors, resolvedSlots, statusFilter],
  );

  const openSlotForm = (slot?: ScheduleSlot, suggestedDate?: string) => {
    if (role === 'patient') return;
    if (slot && !canModifySlot(slot)) {
      setFormError('คุณไม่มีสิทธิ์แก้ไขรอบตรวจของแพทย์ท่านอื่น');
      return;
    }
    if (slot && isSlotExpired(slot.slotDate, slot.startTime, bangkokNow.date, bangkokNow.time)) {
      setNotice('');
      setFormError('ไม่สามารถแก้ไขรอบตรวจที่เลยเวลาเริ่มแล้ว');
      return;
    }
    if (!slot && suggestedDate && suggestedDate < getTodayDate()) {
      setNotice('');
      setFormError('ไม่สามารถเพิ่มรอบตรวจของวันในอดีตได้');
      return;
    }
    setFormError('');
    setNotice('');
    setEditingSlotId(slot?.id ?? null);
    const defaultDoctorId = role === 'medical' && currentDoctor ? currentDoctor.id : (doctorFilter !== 'all' ? doctorFilter : '');
    const today = getTodayDate();
    const initialDate = suggestedDate && suggestedDate >= today ? suggestedDate : (weekDays[0] >= today ? weekDays[0] : today);
    const initialTimes = !slot && defaultDoctorId && initialDate
      ? getNextAvailableTimeSlot(slots, defaultDoctorId, initialDate)
      : { startTime: '08:30', endTime: '09:00' };
    setDraft(
      slot
        ? {
            doctorId: slot.doctorId,
            serviceId: slot.serviceId,
            slotDate: slot.slotDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxCapacity: slot.maxCapacity,
          }
        : {
            ...emptySlotDraft,
            doctorId: defaultDoctorId,
            serviceId: activeServices[0]?.id ?? '',
            slotDate: initialDate,
            startTime: initialTimes.startTime,
            endTime: initialTimes.endTime,
          },
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
    if (!editingSlotId && draft.slotDate < getTodayDate()) {
      setFormError('ไม่สามารถเพิ่มรอบตรวจของวันในอดีตได้');
      return;
    }
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

  const openServiceForm = (service?: import('@/types/schedule').ScheduleService) => {
    setServiceFormError('');
    setEditingServiceId(service?.id ?? null);
    setServiceDraft(service ? { code: service.code, name: service.name, description: service.description } : { code: '', name: '', description: '' });
    setServiceFormOpen(true);
  };

  const saveService = async () => {
    setServiceFormError('');
    const result = await persistService({ ...serviceDraft }, editingServiceId ?? undefined);
    if (!result.ok) {
      setServiceFormError(result.error);
      return;
    }
    setServiceFormOpen(false);
    setEditingServiceId(null);
    setServiceDraft({ code: '', name: '', description: '' });
    setNotice(editingServiceId ? 'อัปเดตบริการแล้ว' : 'เพิ่มบริการแล้ว');
  };

  const toggleClosed = async (slot: ScheduleSlot) => {
    if (role === 'patient' || !canModifySlot(slot)) {
      setFormError('คุณไม่มีสิทธิ์แก้ไขหรือปิดรอบตรวจ');
      return;
    }
    if (slot.status === 'closed') {
      if (isSlotExpired(slot.slotDate, slot.startTime, bangkokNow.date, bangkokNow.time)) {
        setFormError('ไม่สามารถเปิดรอบตรวจที่เลยเวลาเริ่มแล้ว');
        return;
      }
      if (slot.bookedCount >= slot.maxCapacity) {
        setFormError('ไม่สามารถเปิดรอบตรวจที่คนเต็มแล้ว');
        return;
      }
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
    <div className="schedule-shell flex min-w-0 flex-col gap-6 sm:gap-8">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <h1 className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">ตารางแพทย์</h1>
        {role !== 'patient' && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={isLoading} onClick={() => openSlotForm()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50">
              <Plus className="h-4 w-4" aria-hidden="true" />เพิ่มรอบตรวจ
            </button>
            <button type="button" disabled={isLoading} onClick={() => openServiceForm()} className={`${textButtonClass} disabled:opacity-50`}>
              <Plus className="h-4 w-4" aria-hidden="true" />เพิ่มบริการ
            </button>
          </div>
        )}
      </header>

      {role === 'medical' && (
        <div className="flex gap-6 border-b border-brand-border-soft" role="group" aria-label="ขอบเขตตารางแพทย์">
          {([['my', 'ตารางของฉัน'], ['all', 'ภาพรวมคลินิก']] as const).map(([scope, label]) => (
            <button key={scope} type="button" aria-pressed={medicalScope === scope} onClick={() => handleScopeChange(scope)} className={`min-h-11 border-b-2 px-1 pb-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${medicalScope === scope ? 'border-brand-strong text-brand-strong' : 'border-transparent text-brand-body hover:text-brand-strong'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 empty:hidden" aria-live="polite">
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
                    onChange={(event) => {
                      const newDoctorId = event.target.value;
                      setDraft((current) => {
                        const nextTimes = !editingSlotId && newDoctorId && current.slotDate
                          ? getNextAvailableTimeSlot(slots, newDoctorId, current.slotDate)
                          : { startTime: current.startTime, endTime: current.endTime };
                        return {
                          ...current,
                          doctorId: newDoctorId,
                          startTime: nextTimes.startTime,
                          endTime: nextTimes.endTime,
                        };
                      });
                    }}
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
                <span className="text-sm font-medium text-slate-700">บริการที่เปิดจอง</span>
                <select
                  value={draft.serviceId}
                  onChange={(event) => setDraft((current) => ({ ...current, serviceId: event.target.value }))}
                  className={inputClass}
                >
                  <option value="">เลือกบริการ</option>
                  {activeServices.map((service) => (
                    <option key={service.id} value={service.id}>{service.code} · {service.name}</option>
                  ))}
                </select>
                {!activeServices.length && <span className="text-xs text-rose-600">ยังไม่มีบริการที่เปิดใช้งาน กด “เพิ่มบริการ” ก่อนสร้างรอบ</span>}
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">วันที่</span>
                <input
                  type="date"
                  min={editingSlotId ? undefined : getTodayDate()}
                  value={draft.slotDate}
                  onChange={(event) => {
                    const newDate = event.target.value;
                    setDraft((current) => {
                      const nextTimes = !editingSlotId && current.doctorId && newDate
                        ? getNextAvailableTimeSlot(slots, current.doctorId, newDate)
                        : { startTime: current.startTime, endTime: current.endTime };
                      return {
                        ...current,
                        slotDate: newDate,
                        startTime: nextTimes.startTime,
                        endTime: nextTimes.endTime,
                      };
                    });
                  }}
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
                className="min-h-11 rounded-xl bg-brand-ink px-5 text-sm font-semibold text-white hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50 shadow-xs inline-flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden="true" />}
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกรอบตรวจ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {serviceFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-form-title"
          onClick={(event) => { if (event.target === event.currentTarget) setServiceFormOpen(false); }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/80">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">Service catalog</p>
                <h2 id="service-form-title" className="mt-1 text-xl font-bold text-slate-950">{editingServiceId ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'}</h2>
                <p className="mt-1 text-xs text-slate-500">บริการนี้จะถูกเลือกไปเปิดรับจองในวันและรอบของหมอ</p>
              </div>
              <button type="button" onClick={() => setServiceFormOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100" aria-label="ปิดแบบฟอร์มบริการ"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <div className="space-y-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">รหัสบริการ<input className={inputClass} value={serviceDraft.code} onChange={(event) => setServiceDraft((current) => ({ ...current, code: event.target.value }))} placeholder="เช่น GEN-CONSULT" /></label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">ชื่อบริการ<input className={inputClass} value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="เช่น ตรวจโรคทั่วไป" /></label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">คำอธิบาย<textarea rows={3} className={`${inputClass} h-auto py-3`} value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} /></label>
              {serviceFormError && <p className="text-sm font-medium text-rose-700" role="alert">{serviceFormError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setServiceFormOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">ยกเลิก</button>
              <button type="button" onClick={saveService} className="min-h-11 rounded-xl bg-brand-ink px-5 text-sm font-semibold text-white hover:bg-brand-hover">บันทึกบริการ</button>
            </div>
          </div>
        </div>
      )}


      <section className="min-w-0" aria-label="ปฏิทินตารางตรวจ" aria-busy={isLoading}>
        {isLoading ? (
          <ScheduleSkeleton />
        ) : (
          <>
            <div className="mb-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
                  <button type="button" onClick={() => setWeekStart((current) => shiftClinicDate(current, calendarView === 'day' ? -1 : calendarView === 'month' ? -28 : -7))} className={textButtonClass} aria-label="ช่วงก่อนหน้า">
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="text-sm font-semibold tabular-nums text-brand-ink sm:text-lg" aria-live="polite">
                    {calendarView === 'day' ? formatShortDate(weekStart) : calendarView === 'month' ? `${monthNames[parseClinicDate(weekStart).getUTCMonth()]} ${parseClinicDate(weekStart).getUTCFullYear() + 543}` : formatWeekRange(weekStart)}
                  </span>
                  <button type="button" onClick={() => setWeekStart((current) => shiftClinicDate(current, calendarView === 'day' ? 1 : calendarView === 'month' ? 28 : 7))} className={textButtonClass} aria-label="ช่วงถัดไป">
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={jumpToToday} className={textButtonClass}>วันนี้</button>
                </div>
                <label className="flex items-center gap-3 text-sm text-brand-body">
                  <span>มุมมอง</span>
                  <select aria-label="มุมมองปฏิทิน" value={calendarView} onChange={(event) => setCalendarView(event.target.value as CalendarView)} className={filterClass}>
                    <option value="day">วัน</option>
                    <option value="week">สัปดาห์</option>
                    <option value="month">เดือน</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-5">
                <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
                  <label className="col-span-2 grid gap-2 text-sm text-brand-body sm:col-span-1">
                    <span>แผนก</span>
                    <select aria-label="กรองแผนก" value={effectiveDepartmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setDoctorFilter('all'); }} className={filterClass}>
                      <option value="all">ทุกแผนก</option>
                      {openDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 grid gap-2 text-sm text-brand-body sm:col-span-1">
                    <span>บริการ</span>
                    <select aria-label="กรองบริการ" value={effectiveServiceFilter} onChange={(event) => { setServiceFilter(event.target.value); setDoctorFilter('all'); }} className={filterClass}>
                      <option value="all">ทุกบริการ</option>
                      {openServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm text-brand-body">
                    <span>แพทย์</span>
                    <select aria-label="กรองแพทย์" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className={filterClass}>
                      <option value="all">แพทย์ทุกคน</option>
                      {filteredDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm text-brand-body">
                    <span>สถานะ</span>
                    <select aria-label="กรองสถานะ" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ScheduleSlotStatus)} className={filterClass}>
                      <option value="all">ทุกสถานะ</option>
                      <option value="available">เปิดรับ</option>
                      <option value="full">เต็ม</option>
                      <option value="closed">ปิดรอบ</option>
                    </select>
                  </label>
                </div>
                <p className="pb-3 text-sm tabular-nums text-brand-body">{visibleSlots.length} รอบตามตัวกรอง</p>
              </div>
            </div>
        {calendarView !== 'week' ? (
          <CalendarBoard
            view={calendarView}
            days={displayDays}
            slots={visibleSlots}
            doctors={doctors}
            departments={departments}
            services={services}
            canModifySlot={canModifySlot}
            canCreate={role !== 'patient'}
            canBook={role === 'patient'}
            onCreate={openSlotForm}
            onEdit={openSlotForm}
            onToggle={toggleClosed}
            onSelectDay={handleDrillDownDay}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-7 border-y border-brand-border-soft">
                {weekDays.map((date) => {
                  const parsed = parseClinicDate(date);
                  const isToday = date === getTodayDate();
                  return (
                    <button
                      type="button"
                      key={date}
                      onClick={() => handleDrillDownDay(date)}
                      onDoubleClick={() => handleDrillDownDay(date)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleDrillDownDay(date);
                        }
                      }}
                      aria-label={`เปิดตารางตรวจวันที่ ${formatShortDate(date)}`}
                      className="cursor-pointer px-3 py-4 text-center hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
                      title={`ดับเบิ้ลคลิกเพื่อดูตารางตรวจวันที่ ${formatShortDate(date)}`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? 'text-sky-700' : 'text-slate-500'}`}>{dayNames[parsed.getUTCDay()]}</div>
                      <div className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-full text-base font-bold tabular-nums ${isToday ? 'bg-sky-600 text-white' : 'text-slate-950'}`}>{parsed.getUTCDate()}</div>
                    </button>
                  );
                })}
              </div>
              <div className="grid min-h-[460px] grid-cols-7 divide-x divide-brand-border-soft border-b border-brand-border-soft">
                {weekDays.map((date) => {
                  const daySlots = visibleSlots.filter((slot) => slot.slotDate === date);
                  return (
                    <div
                      key={date}
                      onDoubleClick={() => handleDrillDownDay(date)}
                      className="flex min-w-0 flex-col gap-7 px-3 py-6"
                      title={`ดับเบิ้ลคลิกเพื่อดูตารางตรวจวันที่ ${formatShortDate(date)}`}
                    >
                      {daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          doctors={doctors}
                          departments={departments}
                          services={services}
                          canModify={canModifySlot(slot)}
                          onEdit={() => openSlotForm(slot)}
                          onToggleClosed={() => toggleClosed(slot)}
                        />
                      ))}
                      {daySlots.length === 0 && (
                        role === 'patient' || date < getTodayDate() ? (
                          <div className="py-8 text-center text-sm text-brand-body">
                            ไม่พบรอบตรวจ
                          </div>
                        ) : (
                          <button type="button" onClick={() => openSlotForm(undefined, date)} className={textButtonClass}>
                            <Plus className="mb-2 h-4 w-4" aria-hidden="true" />เพิ่มรอบ
                          </button>
                        )
                      )}
                      <button type="button" onClick={() => handleDrillDownDay(date)} aria-label={`ดูรายวัน ${formatShortDate(date)}`} className={`${textButtonClass} mt-auto text-xs`}>
                        ดูรายวัน <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-brand-border-soft border-y border-brand-border-soft lg:hidden">
              {weekDays.map((date) => {
                const parsed = parseClinicDate(date);
                const daySlots = visibleSlots.filter((slot) => slot.slotDate === date);
                return (
                  <article
                    key={date}
                    onDoubleClick={() => handleDrillDownDay(date)}
                    className="py-6"
                    title={`ดับเบิ้ลคลิกเพื่อดูตารางตรวจวันที่ ${formatShortDate(date)}`}
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-sky-700">{dayNames[parsed.getUTCDay()]}</div>
                        <h2 className="font-bold text-slate-950">{formatShortDate(date)}</h2>
                      </div>
                      <button type="button" onClick={() => handleDrillDownDay(date)} aria-label={`ดูรายวัน ${formatShortDate(date)}`} className={textButtonClass}>
                        ดูรายวัน <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {role !== 'patient' && date >= getTodayDate() && (
                        <button type="button" onClick={() => openSlotForm(undefined, date)} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                          <Plus className="h-4 w-4" aria-hidden="true" />เพิ่มรอบ
                        </button>
                      )}
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      {daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          doctors={doctors}
                          departments={departments}
                          services={services}
                          canModify={canModifySlot(slot)}
                          onEdit={() => openSlotForm(slot)}
                          onToggleClosed={() => toggleClosed(slot)}
                        />
                      ))}
                      {daySlots.length === 0 && (
                        <p className="py-3 text-sm text-brand-body sm:col-span-2">ไม่พบรอบตรวจตามตัวกรอง</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
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
  services,
  canModify = true,
  onEdit,
  onToggleClosed,
}: {
  slot: ScheduleSlot;
  doctors: import('@/types/schedule').ScheduleDoctor[];
  departments: import('@/types/schedule').ScheduleDepartment[];
  services: import('@/types/schedule').ScheduleService[];
  canModify?: boolean;
  onEdit: () => void;
  onToggleClosed: () => void;
}) {
  const doctor = doctors.find((item) => item.id === slot.doctorId);
  const department = departments.find((item) => item.id === doctor?.departmentId);
  const service = services.find((item) => item.id === slot.serviceId);
  const config = slotStyles[slot.status];

  return (
    <article className={`min-w-0 border-l-2 pl-3 ${config.marker}`}>
      <div className="text-sm font-bold tabular-nums text-brand-ink">{slot.startTime}–{slot.endTime}</div>
      <h3 className="mt-2 break-words text-sm font-semibold leading-6 text-brand-ink">{service?.name ?? 'ไม่พบบริการ'}</h3>
      <p className="mt-1 break-words text-sm leading-6 text-brand-body">{doctor?.fullName ?? 'ไม่พบแพทย์'}</p>
      {department && <p className="text-xs leading-5 text-brand-body">{department.name}</p>}
      <p className={`mt-2 text-sm font-semibold ${config.text}`}>
        {config.label}{slot.status === 'available' && ` · ว่าง ${Math.max(0, slot.maxCapacity - slot.bookedCount)} ที่`}
      </p>
      <p className="mt-1 text-xs tabular-nums text-brand-body">จองแล้ว {slot.bookedCount}/{slot.maxCapacity}</p>
      {canModify && (
        <div className="mt-2 flex flex-wrap gap-x-3">
          <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-brand-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong" aria-label={`แก้ไขรอบ ${slot.startTime}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />แก้ไข
          </button>
          <button type="button" onClick={onToggleClosed} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-brand-body hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong" aria-label={slot.status === 'closed' ? 'เปิดรอบตรวจ' : 'ปิดรอบตรวจ'}>
            {slot.status === 'closed' ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
            {slot.status === 'closed' ? 'เปิดรอบ' : 'ปิดรอบ'}
          </button>
        </div>
      )}
    </article>
  );
}
function CalendarBoard({
  view,
  days,
  slots,
  doctors,
  departments,
  services,
  canModifySlot,
  canCreate = true,
  canBook = false,
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
  services: import('@/types/schedule').ScheduleService[];
  canModifySlot: (slot: ScheduleSlot) => boolean;
  canCreate?: boolean;
  canBook?: boolean;
  onCreate: (slot?: ScheduleSlot, suggestedDate?: string) => void;
  onEdit: (slot?: ScheduleSlot, suggestedDate?: string) => void;
  onToggle: (slot: ScheduleSlot) => void;
  onSelectDay?: (date: string) => void;
}) {
  if (view === 'day') {
    const date = days[0];
    return (
      <div aria-label="ปฏิทินรายวัน">
        <div className="border-y border-brand-border-soft py-5">
          <div className="text-xs font-semibold text-sky-700">{dayNames[parseClinicDate(date).getUTCDay()]}</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{formatShortDate(date)}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {slots.filter((slot) => slot.slotDate === date).map((slot) => (
            <div key={slot.id} className="flex flex-wrap items-center gap-4 py-6">
              <div className="min-w-0 flex-1">
                <SlotCard
                  slot={slot}
                  doctors={doctors}
                  departments={departments}
                  services={services}
                  canModify={canModifySlot(slot)}
                  onEdit={() => onEdit(slot)}
                  onToggleClosed={() => onToggle(slot)}
                />
              </div>
              {canBook && slot.status === 'available' && slot.bookedCount < slot.maxCapacity && slot.slotDate > getTodayDate() && (
                <Link
                  href={{ pathname: '/appointments', query: { slotId: slot.id } }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-ink px-4 text-sm font-semibold text-white shadow-xs hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-sky-600"
                >
                  จอง
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          ))}
          {slots.filter((slot) => slot.slotDate === date).length === 0 && (
            canCreate && date >= getTodayDate() ? (
              <button type="button" onClick={() => onCreate(undefined, date)} className={`${textButtonClass} my-8`}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />เพิ่มรอบตรวจวันนี้
              </button>
            ) : (
              <div className="py-10 text-sm text-brand-body">
                ไม่พบรอบตรวจตามตัวกรอง ลองเปลี่ยนวันหรือสถานะ
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
        <div className="grid grid-cols-7 border-y border-brand-border-soft">
          {days.slice(0, 7).map((date) => {
            const parsed = parseClinicDate(date);
            return (
              <div key={date} className="px-2 py-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500">{dayNames[parsed.getUTCDay()]}</div>
                <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${date === getTodayDate() ? 'bg-sky-600 text-white' : 'text-slate-950'}`}>{parsed.getUTCDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
          {days.map((date) => {
            const daySlots = slots.filter((slot) => slot.slotDate === date);
            const isToday = date === getTodayDate();
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay?.(date);
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold focus-visible:outline-2 focus-visible:outline-brand-strong ${
                      isToday
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-sky-100 hover:text-sky-800'
                    }`}
                    title={`ดูตารางตรวจวันที่ ${formatShortDate(date)}`}
                    aria-label={`ดูรายวัน ${formatShortDate(date)}`}
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
                        services={services}
                        canModify={canModifySlot(slot)}
                        onEdit={() => onEdit(slot)}
                      />
                    </div>
                  ))}
                </div>
                {canCreate && date >= getTodayDate() && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreate(undefined, date);
                    }}
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 text-xs text-brand-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-strong"
                    title="เพิ่มรอบตรวจ"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />เพิ่มรอบ
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
  services,
  canModify = true,
  onEdit,
}: {
  slot: ScheduleSlot;
  doctors: import('@/types/schedule').ScheduleDoctor[];
  services: import('@/types/schedule').ScheduleService[];
  canModify?: boolean;
  onEdit: () => void;
}) {
  const doctor = doctors.find((item) => item.id === slot.doctorId);
  const service = services.find((item) => item.id === slot.serviceId);
  const config = slotStyles[slot.status];
  const colors = `${config.marker} ${config.text}`;
  if (!canModify) {
    return (
      <div
        className={`mb-3 block w-full border-l-2 px-2 py-1 text-left text-xs leading-5 ${colors}`}
        title={`${slot.startTime} ${service?.name ?? ''} ${doctor?.fullName ?? ''} (ดูเท่านั้น)`}
      >
        <span className="block font-semibold tabular-nums">{slot.startTime} · {config.label}</span>
        <span className="block break-words text-brand-ink">{service?.name ?? 'ไม่พบบริการ'}</span>
        <span className="block break-words text-brand-body">{doctor?.fullName ?? 'ไม่พบแพทย์'}</span>
        <span className="block tabular-nums text-brand-body">จองแล้ว {slot.bookedCount}/{slot.maxCapacity}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`mb-3 block min-h-11 w-full border-l-2 px-2 py-1 text-left text-xs leading-5 hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand-strong ${colors}`}
      aria-label={`แก้ไขรอบ ${slot.startTime} ${service?.name ?? ''} ${doctor?.fullName ?? ''}`}
      title={`${slot.startTime} ${service?.name ?? ''} ${doctor?.fullName ?? ''}`}
    >
      <span className="block font-semibold tabular-nums">{slot.startTime} · {config.label}</span>
      <span className="block break-words text-brand-ink">{service?.name ?? 'ไม่พบบริการ'}</span>
      <span className="block break-words text-brand-body">{doctor?.fullName ?? 'ไม่พบแพทย์'}</span>
      <span className="block tabular-nums text-brand-body">จองแล้ว {slot.bookedCount}/{slot.maxCapacity}</span>
      <span className="block text-brand-strong">แก้ไข</span>
    </button>
  );
}
