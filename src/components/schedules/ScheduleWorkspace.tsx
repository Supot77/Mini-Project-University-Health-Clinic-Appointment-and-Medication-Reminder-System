'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Umbrella,
  Users,
  X,
} from 'lucide-react';
import { MOCK_WEEK_START } from '@/mocks/scheduleData';
import { useShop } from '@/features/shop/context/ShopProvider';
import type { DoctorLeaveRequest, DoctorWeeklySchedule, ScheduleSlot, ScheduleSlotStatus } from '@/types/schedule';
import type { UserRole } from '@/types/database';

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] focus:border-sky-500 focus:ring-4 focus:ring-sky-100';

const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DEMO_TODAY = '2026-09-07';

type CalendarView = 'day' | 'week' | 'month';
type ManagementPanel = 'schedule' | null;

interface SlotDraft {
  doctorId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
}

const emptySlotDraft: SlotDraft = {
  doctorId: '',
  slotDate: DEMO_TODAY,
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

export default function ScheduleWorkspace({ role, actorId }: { role: UserRole; actorId: string }) {
  const { departments, doctors, slots, weeklySchedules, leaveRequests, saveSlot: persistSlot, toggleSlot: persistSlotToggle, saveWeeklySchedule } = useShop();
  const visibleLeaveRequests = role === 'staff_admin'
    ? leaveRequests
    : leaveRequests.filter((leave) => doctors.find((doctor) => doctor.id === leave.doctorId)?.profileId === actorId);
  const [weekStart, setWeekStart] = useState(MOCK_WEEK_START);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleSlotStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SlotDraft>(emptySlotDraft);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [managementPanel, setManagementPanel] = useState<ManagementPanel>(null);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<Omit<DoctorWeeklySchedule, 'id'>>({ doctorId: '', weekday: 1, startTime: '08:30', endTime: '12:00', slotDurationMinutes: 30, defaultCapacity: 1, isActive: true });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftClinicDate(weekStart, index)),
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
        (doctor) => departmentFilter === 'all' || doctor.departmentId === departmentFilter,
      ),
    [departmentFilter, doctors],
  );

  const visibleSlots = useMemo(
    () =>
      slots
        .filter((slot) => displayDays.includes(slot.slotDate))
        .filter((slot) => {
          const doctor = doctors.find((item) => item.id === slot.doctorId);
          const matchesDepartment = departmentFilter === 'all' || doctor?.departmentId === departmentFilter;
          const matchesDoctor = doctorFilter === 'all' || slot.doctorId === doctorFilter;
          const matchesStatus = statusFilter === 'all' || slot.status === statusFilter;
          return matchesDepartment && matchesDoctor && matchesStatus;
        })
        .sort((a, b) => `${a.slotDate}${a.startTime}`.localeCompare(`${b.slotDate}${b.startTime}`)),
    [departmentFilter, doctorFilter, displayDays, doctors, slots, statusFilter],
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
    setFormError('');
    setNotice('');
    setEditingSlotId(slot?.id ?? null);
    setDraft(
      slot
        ? {
            doctorId: slot.doctorId,
            slotDate: slot.slotDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxCapacity: slot.maxCapacity,
          }
        : { ...emptySlotDraft, slotDate: suggestedDate ?? weekDays[0] },
    );
    setFormOpen(true);
  };

  const saveSlot = () => {
    const currentSlot = slots.find((slot) => slot.id === editingSlotId);
    const result = persistSlot(draft, editingSlotId ?? undefined);
    if (!result.ok) { setFormError(result.error); return; }
    setNotice(currentSlot ? 'อัปเดตรอบตรวจใน mock UI แล้ว' : 'เพิ่มรอบตรวจใน mock UI แล้ว');

    setFormOpen(false);
    setEditingSlotId(null);
    setDraft(emptySlotDraft);
  };

  const toggleClosed = (slot: ScheduleSlot) => {
    if (!window.confirm(slot.status === 'closed' ? 'เปิดรอบตรวจนี้อีกครั้ง?' : `ปิดรอบตรวจนี้? นัดเดิม ${slot.bookedCount} รายการจะยังคงอยู่`)) return;
    const result = persistSlotToggle(slot.id);
    if (!result.ok) { setFormError(result.error); return; }
    setNotice(slot.status === 'closed' ? 'เปิดรอบตรวจอีกครั้งใน mock UI แล้ว' : 'ปิดรอบตรวจแล้ว นัดเดิมยังคงอยู่');
  };

  const jumpToDemoWeek = () => {
    setWeekStart(MOCK_WEEK_START);
    setNotice('กลับสู่สัปดาห์ข้อมูลจำลองแล้ว');
  };

  const openScheduleForm = (schedule?: DoctorWeeklySchedule) => {
    setManagementPanel('schedule');
    setEditingScheduleId(schedule?.id ?? null);
    setScheduleDraft(schedule ? { doctorId: schedule.doctorId, weekday: schedule.weekday, startTime: schedule.startTime, endTime: schedule.endTime, slotDurationMinutes: schedule.slotDurationMinutes, defaultCapacity: schedule.defaultCapacity, isActive: schedule.isActive } : { doctorId: doctors[0]?.id ?? '', weekday: 1, startTime: '08:30', endTime: '12:00', slotDurationMinutes: 30, defaultCapacity: 1, isActive: true });
    setScheduleFormOpen(true);
  };

  return (
    <div className="schedule-shell flex flex-col gap-6">
      <header className="order-1 overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
        <div className="relative grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="absolute inset-y-0 left-0 w-2 bg-sky-500" aria-hidden="true" />
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-sky-700">
              <span className="rounded-full bg-sky-50 px-3 py-1 ring-1 ring-sky-100">WEEKLY OPERATIONS BOARD</span>
              <span className="text-slate-400">MOCK DATA · ASIA/BANGKOK</span>
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

      <section className="order-2 rounded-2xl bg-[#0a2540] p-4 text-white shadow-[0_10px_34px_rgba(10,37,64,0.14)]" aria-label="ตัวกรองตารางตรวจ">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={jumpToDemoWeek} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/8 px-3 text-xs font-semibold text-slate-200 hover:bg-white/15 sm:flex"><CalendarDays className="h-4 w-4" aria-hidden="true" />วันนี้</button>
            <button type="button" onClick={() => setWeekStart((current) => shiftClinicDate(current, calendarView === 'day' ? -1 : calendarView === 'month' ? -28 : -7))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/8 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300" aria-label="ช่วงก่อนหน้า"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
            <div className="min-w-52 text-center"><div className="text-xs text-slate-400">ช่วงเวลาที่แสดง</div><div className="mt-0.5 font-bold tabular-nums">{calendarView === 'day' ? formatShortDate(weekStart) : calendarView === 'month' ? `${monthNames[parseClinicDate(weekStart).getUTCMonth()]} ${parseClinicDate(weekStart).getUTCFullYear() + 543}` : formatWeekRange(weekStart)}</div></div>
            <button type="button" onClick={() => setWeekStart((current) => shiftClinicDate(current, calendarView === 'day' ? 1 : calendarView === 'month' ? 28 : 7))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/8 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300" aria-label="ช่วงถัดไป"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
            <button type="button" onClick={jumpToDemoWeek} className="hidden min-h-11 items-center gap-2 rounded-xl bg-white/8 px-3 text-xs font-semibold text-slate-200 hover:bg-white/15 sm:flex"><RefreshCw className="h-4 w-4" aria-hidden="true" />รีเซ็ตเดโม</button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {role === 'staff_admin' && <button type="button" onClick={() => setManagementPanel((current) => current === 'schedule' ? null : 'schedule')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${managementPanel === 'schedule' ? 'bg-white text-[#0a2540]' : 'border border-white/15 bg-white/8 text-white hover:bg-white/15'}`} aria-expanded={managementPanel === 'schedule'}><Clock3 className="h-4 w-4" aria-hidden="true" />จัดการตาราง</button>}
              <Link href="/leaves" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 text-sm font-semibold text-white transition hover:bg-white/15"><Umbrella className="h-4 w-4" aria-hidden="true" />การลาแพทย์{leaveRequests.filter((leave) => leave.status === 'pending').length > 0 && <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{leaveRequests.filter((leave) => leave.status === 'pending').length}</span>}</Link>
              {role === 'staff_admin' && <button type="button" onClick={() => openSlotForm()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 text-sm font-bold text-[#0a2540] shadow-sm hover:bg-sky-300 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มรอบตรวจ</button>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><span className="sr-only">กรองแผนก</span><Filter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" /><select value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setDoctorFilter('all'); }} className="h-11 min-w-52 rounded-xl border border-white/15 bg-white/8 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-400/15"><option className="text-slate-950" value="all">ทุกแผนก</option>{departments.map((department) => <option className="text-slate-950" key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label><span className="sr-only">กรองแพทย์</span><select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="h-11 min-w-52 rounded-xl border border-white/15 bg-white/8 px-3 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-400/15"><option className="text-slate-950" value="all">แพทย์ทุกคน</option>{filteredDoctors.map((doctor) => <option className="text-slate-950" key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}</select></label>
            <label><span className="sr-only">กรองสถานะ</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ScheduleSlotStatus)} className="h-11 min-w-40 rounded-xl border border-white/15 bg-white/8 px-3 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-400/15"><option className="text-slate-950" value="all">ทุกสถานะ</option><option className="text-slate-950" value="available">เปิดรับ</option><option className="text-slate-950" value="full">เต็ม</option><option className="text-slate-950" value="closed">ปิดรอบ</option></select></label>
            <label><span className="sr-only">มุมมองปฏิทิน</span><select value={calendarView} onChange={(event) => setCalendarView(event.target.value as CalendarView)} className="h-11 min-w-32 rounded-xl border border-white/15 bg-white/8 px-3 text-sm text-white outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-400/15"><option className="text-slate-950" value="day">วัน</option><option className="text-slate-950" value="week">สัปดาห์</option><option className="text-slate-950" value="month">เดือน</option></select></label>
          </div>
        </div>
      </section>

      <div className="order-3" aria-live="polite">
        {notice && <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"><span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden="true" />{notice}</span><button type="button" onClick={() => setNotice('')} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-emerald-100" aria-label="ปิดข้อความ"><X className="h-4 w-4" aria-hidden="true" /></button></div>}
      </div>

      {formOpen && (
        <section className="order-4 rounded-2xl bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.1)] ring-1 ring-sky-200" aria-labelledby="slot-form-title">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Mock slot editor</p><h2 id="slot-form-title" className="mt-1 text-xl font-bold text-slate-950">{editingSlotId ? 'แก้ไขรอบตรวจ' : 'สร้างรอบตรวจใหม่'}</h2><p className="mt-1 text-sm text-slate-500">Validation ในหน้านี้ช่วยผู้ใช้เท่านั้น ฐานข้อมูลต้องตรวจซ้ำทุกกฎ</p></div><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="ปิดแบบฟอร์ม"><X className="h-5 w-5" aria-hidden="true" /></button></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-1.5 sm:col-span-2"><span className="text-sm font-medium text-slate-700">แพทย์</span><select value={draft.doctorId} onChange={(event) => setDraft((current) => ({ ...current, doctorId: event.target.value }))} className={inputClass}><option value="">เลือกแพทย์</option>{doctors.filter((doctor) => doctor.availability === 'active' && departments.some((department) => department.id === doctor.departmentId && department.isActive)).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName} · {departments.find((department) => department.id === doctor.departmentId)?.name}</option>)}</select></label>
            <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">วันที่</span><input type="date" value={draft.slotDate} onChange={(event) => setDraft((current) => ({ ...current, slotDate: event.target.value }))} className={inputClass} /></label>
            <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">เริ่ม</span><input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} className={inputClass} /></label>
            <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">สิ้นสุด</span><input type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} className={inputClass} /></label>
            <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">ความจุ</span><input type="number" min={1} step={1} value={draft.maxCapacity} onChange={(event) => setDraft((current) => ({ ...current, maxCapacity: Number(event.target.value) }))} className={inputClass} /></label>
          </div>
          {editingSlotId && <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"><Users className="h-4 w-4" aria-hidden="true" />จำนวนจองเป็น read-only และเปลี่ยนผ่าน booking/cancellation RPC ของปายเท่านั้น</div>}
          {formError && <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{formError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100">ยกเลิก</button><button type="button" onClick={saveSlot} className="min-h-11 rounded-xl bg-[#0a2540] px-5 text-sm font-semibold text-white hover:bg-[#123e67] active:scale-[0.98]">บันทึกรอบตรวจ</button></div>
        </section>
      )}

      {managementPanel === 'schedule' && (
      <section className="order-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80" aria-labelledby="recurring-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Doctor availability</p><h2 id="recurring-title" className="mt-1 text-xl font-bold text-slate-950">เวลาประจำแพทย์</h2><p className="mt-1 text-sm text-slate-500">เก็บเป็นข้อมูลอ้างอิงเท่านั้น — เจ้าหน้าที่เพิ่มรอบจองเอง</p></div><button type="button" onClick={() => openScheduleForm()} className="flex min-h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700"><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มช่วงเวลา</button></div>
        {scheduleFormOpen && <div className="mt-4 grid gap-3 rounded-xl bg-sky-50 p-4 ring-1 ring-sky-100 sm:grid-cols-2 lg:grid-cols-6">
          <label className="space-y-1.5 lg:col-span-2"><span className="text-sm font-medium text-slate-700">แพทย์</span><select value={scheduleDraft.doctorId} onChange={(event) => setScheduleDraft((current) => ({ ...current, doctorId: event.target.value }))} className={inputClass}><option value="">เลือกแพทย์</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}</select></label>
          <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">วัน</span><select value={scheduleDraft.weekday} onChange={(event) => setScheduleDraft((current) => ({ ...current, weekday: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 }))} className={inputClass}>{[['1','จันทร์'],['2','อังคาร'],['3','พุธ'],['4','พฤหัสบดี'],['5','ศุกร์']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">เริ่ม</span><input type="time" value={scheduleDraft.startTime} onChange={(event) => setScheduleDraft((current) => ({ ...current, startTime: event.target.value }))} className={inputClass} /></label>
          <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">สิ้นสุด</span><input type="time" value={scheduleDraft.endTime} onChange={(event) => setScheduleDraft((current) => ({ ...current, endTime: event.target.value }))} className={inputClass} /></label>
          <label className="space-y-1.5"><span className="text-sm font-medium text-slate-700">ความจุ</span><input type="number" min={1} step={1} value={scheduleDraft.defaultCapacity} onChange={(event) => setScheduleDraft((current) => ({ ...current, defaultCapacity: Number(event.target.value) }))} className={inputClass} /></label>
          <div className="flex items-end gap-2 lg:col-span-6"><button type="button" onClick={() => { const result = saveWeeklySchedule(scheduleDraft, editingScheduleId ?? undefined); if (!result.ok) { setFormError(result.error); return; } setNotice('บันทึกเวลาประจำแล้ว ใช้อ้างอิงเท่านั้น ยังไม่สร้างรอบอัตโนมัติ'); setScheduleFormOpen(false); }} className="min-h-11 rounded-xl bg-[#0a2540] px-5 text-sm font-semibold text-white hover:bg-[#123e67]">บันทึกเวลา</button><button type="button" onClick={() => setScheduleFormOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-white">ยกเลิก</button></div>
        </div>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{weeklySchedules.slice(0, 12).map((schedule) => <button key={schedule.id} type="button" onClick={() => openScheduleForm(schedule)} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:border-sky-300 hover:bg-sky-50"><strong>{doctors.find((doctor) => doctor.id === schedule.doctorId)?.fullName ?? 'ไม่พบแพทย์'}</strong><span className="ml-2 text-slate-500">{['','จ.','อ.','พ.','พฤ.','ศ.'][schedule.weekday]} {schedule.startTime}–{schedule.endTime} · {schedule.defaultCapacity} คน</span></button>)}</div>
      </section>
      )}


      {calendarView !== 'week' && <div className="order-5"><CalendarBoard view={calendarView} days={displayDays} slots={visibleSlots} leaves={visibleLeaveRequests} doctors={doctors} departments={departments} onCreate={openSlotForm} onEdit={openSlotForm} onToggle={toggleClosed} /></div>}

      <section className={`order-5 hidden overflow-hidden rounded-2xl bg-white shadow-[0_5px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 lg:block ${calendarView === 'week' ? '' : '!hidden'}`} aria-label="ปฏิทินตารางตรวจรายสัปดาห์">
        <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
          {weekDays.map((date) => {
            const parsed = parseClinicDate(date);
            const isToday = date === DEMO_TODAY;
            return <div key={date} className={`px-3 py-4 text-center ${isToday ? 'bg-sky-50' : ''}`}><div className={`text-xs font-semibold ${isToday ? 'text-sky-700' : 'text-slate-500'}`}>{dayNames[parsed.getUTCDay()]}</div><div className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-full text-base font-bold tabular-nums ${isToday ? 'bg-sky-600 text-white' : 'text-slate-950'}`}>{parsed.getUTCDate()}</div></div>;
          })}
        </div>
        <div className="grid min-h-[460px] grid-cols-7 divide-x divide-slate-200">
          {weekDays.map((date) => {
            const daySlots = visibleSlots.filter((slot) => slot.slotDate === date);
            return <div key={date} className={`min-w-0 space-y-3 p-3 ${date === DEMO_TODAY ? 'bg-sky-50/30' : ''}`}>{daySlots.map((slot) => <SlotCard key={slot.id} slot={slot} doctors={doctors} departments={departments} onEdit={() => openSlotForm(slot)} onToggleClosed={() => toggleClosed(slot)} />)}{daySlots.length === 0 && <button type="button" onClick={() => openSlotForm(undefined, date)} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"><Plus className="mb-2 h-4 w-4" aria-hidden="true" />เพิ่มรอบ</button>}</div>;
          })}
        </div>
      </section>

      <section className={`order-5 space-y-4 lg:hidden ${calendarView === 'week' ? '' : 'hidden'}`} aria-label="รายการตารางตรวจบนมือถือ">
        {weekDays.map((date) => {
          const parsed = parseClinicDate(date);
          const daySlots = visibleSlots.filter((slot) => slot.slotDate === date);
          return <article key={date} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold text-sky-700">{dayNames[parsed.getUTCDay()]}</div><h2 className="font-bold text-slate-950">{formatShortDate(date)}</h2></div><button type="button" onClick={() => openSlotForm(undefined, date)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50"><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มรอบ</button></div><div className="grid gap-3 sm:grid-cols-2">{daySlots.map((slot) => <SlotCard key={slot.id} slot={slot} doctors={doctors} departments={departments} onEdit={() => openSlotForm(slot)} onToggleClosed={() => toggleClosed(slot)} />)}{daySlots.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-400 sm:col-span-2">ยังไม่มีรอบตรวจ</p>}</div></article>;
        })}
      </section>

      <aside className="order-9 grid gap-4 rounded-2xl bg-slate-900 p-5 text-white lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3"><div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><Database className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="font-bold">จุดเชื่อมต่อหลังบ้าน</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">ช้อปดูแลโครงสร้างรอบและการเปิด–ปิด ปายดูแล booking/cancel และ `booked_count` เฮิร์บอ่านข้อมูลไปคำนวณ Dashboard ทุกคำสั่งจริงต้องตรวจ RLS และ constraint ในฐานข้อมูลอีกครั้ง</p></div></div>
        {role === 'staff_admin' && (
          <Link href="/departments" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/8 px-4 text-sm font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">จัดการแผนกและแพทย์<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        )}
      </aside>
    </div>
  );
}

function CalendarBoard({ view, days, slots, leaves, doctors, departments, onCreate, onEdit, onToggle }: {
  view: CalendarView;
  days: string[];
  slots: ScheduleSlot[];
  leaves: DoctorLeaveRequest[];
  doctors: import('@/types/schedule').ScheduleDoctor[];
  departments: import('@/types/schedule').ScheduleDepartment[];
  onCreate: (slot?: ScheduleSlot, suggestedDate?: string) => void;
  onEdit: (slot?: ScheduleSlot, suggestedDate?: string) => void;
  onToggle: (slot: ScheduleSlot) => void;
}) {
  if (view === 'day') {
    const date = days[0];
    return <section className="overflow-hidden rounded-2xl bg-white shadow-[0_5px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80" aria-label="ปฏิทินรายวัน"><div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><div className="text-xs font-semibold text-sky-700">{dayNames[parseClinicDate(date).getUTCDay()]}</div><h2 className="mt-1 text-lg font-bold text-slate-950">{formatShortDate(date)}</h2></div><div className="divide-y divide-slate-100">{slots.filter((slot) => slot.slotDate === date).map((slot) => <div key={slot.id} className="flex flex-wrap items-center gap-4 px-5 py-4"><div className="w-24 text-sm font-bold tabular-nums text-slate-700">{slot.startTime}–{slot.endTime}</div><div className="min-w-0 flex-1"><SlotCard slot={slot} doctors={doctors} departments={departments} onEdit={() => onEdit(slot)} onToggleClosed={() => onToggle(slot)} /></div></div>)}{slots.filter((slot) => slot.slotDate === date).length === 0 && <button type="button" onClick={() => onCreate(undefined, date)} className="m-5 flex min-h-28 w-[calc(100%-2.5rem)] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"><Plus className="mr-2 h-4 w-4" aria-hidden="true" />เพิ่มรอบตรวจวันนี้</button>}</div><LeaveStrip date={date} leaves={leaves} doctors={doctors} /></section>;
  }
  return <section className="overflow-x-auto rounded-2xl bg-white shadow-[0_5px_26px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80" aria-label={view === 'month' ? 'ปฏิทินรายเดือน' : 'ปฏิทินรายสัปดาห์'}><div className="min-w-[720px]"><div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">{days.slice(0, 7).map((date) => { const parsed = parseClinicDate(date); return <div key={date} className="px-2 py-3 text-center"><div className="text-[11px] font-semibold text-slate-500">{dayNames[parsed.getUTCDay()]}</div><div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${date === DEMO_TODAY ? 'bg-sky-600 text-white' : 'text-slate-950'}`}>{parsed.getUTCDate()}</div></div>; })}</div><div className="grid grid-cols-7 divide-x divide-y divide-slate-200">{days.map((date) => { const daySlots = slots.filter((slot) => slot.slotDate === date); const dayLeaves = leaves.filter((leave) => leave.startDate <= date && leave.endDate >= date && leave.status !== 'rejected'); return <div key={date} className={`min-h-36 min-w-0 p-2 ${date === DEMO_TODAY ? 'bg-sky-50/30' : ''}`}><div className="mb-1 text-right text-xs font-semibold text-slate-500">{parseClinicDate(date).getUTCDate()}</div>{dayLeaves.map((leave) => <div key={leave.id} className="mb-1 truncate rounded border-l-2 border-violet-500 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-800">ลา · {leave.status === 'pending' ? 'รออนุมัติ' : 'อนุมัติแล้ว'}</div>)}{daySlots.map((slot) => <MiniSlot slot={slot} key={slot.id} doctors={doctors} onEdit={() => onEdit(slot)} />)}<button type="button" onClick={() => onCreate(undefined, date)} className="mt-1 flex min-h-8 w-full items-center justify-center rounded border border-dashed border-transparent text-[10px] text-slate-300 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"><Plus className="h-3 w-3" aria-hidden="true" /></button></div>; })}</div></div></section>;
}

function MiniSlot({ slot, doctors, onEdit }: { slot: ScheduleSlot; doctors: import('@/types/schedule').ScheduleDoctor[]; onEdit: () => void }) {
  const doctor = doctors.find((item) => item.id === slot.doctorId);
  const colors = slot.status === 'closed' ? 'border-rose-500 bg-rose-50 text-rose-800' : slot.status === 'full' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-sky-500 bg-sky-50 text-sky-800';
  return <button type="button" onClick={onEdit} className={`mb-1 block w-full truncate rounded border-l-2 px-2 py-1 text-left text-[10px] font-semibold ${colors}`} title={`${slot.startTime} ${doctor?.fullName ?? ''}`}><span className="tabular-nums">{slot.startTime}</span> · {doctor?.fullName?.replace('นพ. ', '').replace('พญ. ', '') ?? 'ไม่พบแพทย์'} · {slot.bookedCount}/{slot.maxCapacity}</button>;
}

function LeaveStrip({ date, leaves, doctors }: { date: string; leaves: DoctorLeaveRequest[]; doctors: import('@/types/schedule').ScheduleDoctor[] }) {
  const matching = leaves.filter((leave) => leave.startDate <= date && leave.endDate >= date && leave.status !== 'rejected');
  if (!matching.length) return null;
  return <div className="border-t border-violet-100 bg-violet-50 px-5 py-3 text-sm text-violet-900">{matching.map((leave) => <div key={leave.id}><strong>วันลา</strong> · {doctors.find((doctor) => doctor.id === leave.doctorId)?.fullName ?? 'ไม่พบแพทย์'} · {leave.status === 'pending' ? 'รออนุมัติ' : 'อนุมัติแล้ว'}</div>)}</div>;
}

function SlotCard({ slot, doctors, departments, onEdit, onToggleClosed }: { slot: ScheduleSlot; doctors: import('@/types/schedule').ScheduleDoctor[]; departments: import('@/types/schedule').ScheduleDepartment[]; onEdit: () => void; onToggleClosed: () => void }) {
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
      <div className="flex items-start justify-between gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${config.pill}`}><StatusIcon className="h-3 w-3" aria-hidden="true" />{config.label}</span><div className="flex"><button type="button" onClick={onEdit} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70" aria-label={`แก้ไขรอบ ${slot.startTime}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button><button type="button" onClick={onToggleClosed} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70" aria-label={slot.status === 'closed' ? 'เปิดรอบตรวจ' : 'ปิดรอบตรวจ'}>{slot.status === 'closed' ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}</button></div></div>
      <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-950"><Clock3 className="h-4 w-4 text-slate-500" aria-hidden="true" /><span className="tabular-nums">{slot.startTime}–{slot.endTime}</span></div>
      <div className="mt-3 flex items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0a2540] text-[10px] font-bold text-white">{doctor?.initials ?? '?'}</div><div className="min-w-0"><div className="truncate text-xs font-bold text-slate-900">{doctor?.fullName ?? 'ไม่พบแพทย์'}</div><div className="truncate text-[10px] text-slate-500">{department?.name ?? 'ไม่พบแผนก'}</div></div></div>
      <div className="mt-3"><div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500"><span>จองแล้ว</span><strong className="text-slate-700 tabular-nums">{slot.bookedCount}/{slot.maxCapacity}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full ${slot.status === 'closed' ? 'bg-rose-400' : slot.status === 'full' ? 'bg-sky-500' : 'bg-emerald-500'}`} style={{ width: `${occupancy}%` }} /></div></div>
    </article>
  );
}
