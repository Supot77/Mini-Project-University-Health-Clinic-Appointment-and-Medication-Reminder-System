'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Search, Stethoscope, TicketCheck, UsersRound } from 'lucide-react';
import { actionLabels, allowedActions, bangkokDate, bangkokTime, isSlotArrived, type PaiRepository, type PaiRole, type PaiSnapshot } from './contract';
import { statusLabels, formatAppointmentDate } from '../appointments/repository';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/PaiPageHeader';
import PaiPageLoading from '../components/PaiPageLoading';
import PaiDatePicker from '../components/PaiDatePicker';
import WorkspaceShell, { type WorkspaceHeaderStat } from './WorkspaceShell';
import { usePaiWorkspace } from './usePaiWorkspace';

const statusStyles: Record<string, string> = {
  pending: 'bg-status-warning-bg text-status-warning ring-amber-200', confirmed: 'bg-status-info-bg text-status-info ring-brand-border',
  in_progress: 'bg-status-info-bg text-status-info ring-brand-border', completed: 'bg-status-success-bg text-status-success ring-emerald-200',
  cancelled: 'bg-status-neutral-bg text-status-neutral ring-brand-border-soft', rejected: 'bg-status-critical-bg text-status-critical ring-red-200', no_show: 'bg-status-critical-bg text-status-critical ring-red-200',
};

const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thaiWeekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function toCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatThaiDate(value: string) {
  const date = toCalendarDate(value);
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function formatThaiMonth(value: Date) {
  return `${thaiMonths[value.getMonth()]} ${value.getFullYear() + 543}`;
}

function getCalendarDays(value: Date) {
  const firstDay = new Date(value.getFullYear(), value.getMonth(), 1).getDay();
  const daysInMonth = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  return [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => toIsoDate(new Date(value.getFullYear(), value.getMonth(), index + 1, 12)))];
}

function AppointmentDatePicker({ value, minDate, onChange }: { value: string; minDate: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(toCalendarDate(value).getFullYear(), toCalendarDate(value).getMonth(), 1));
  const calendarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const minMonth = new Date(toCalendarDate(minDate).getFullYear(), toCalendarDate(minDate).getMonth(), 1);
  const days = getCalendarDays(month);
  const previousDisabled = month.getFullYear() === minMonth.getFullYear() && month.getMonth() === minMonth.getMonth();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!calendarRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return <div ref={calendarRef} className="relative">
    <button
      ref={triggerRef}
      type="button"
      id="appointment-date-picker"
      aria-label={`เปิดปฏิทินเลือกวันที่ตรวจ ${formatThaiDate(value)}`}
      aria-expanded={open}
      aria-controls="appointment-date-calendar"
      onClick={() => {
        const selected = toCalendarDate(value);
        setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
        setOpen((current) => !current);
      }}
      className={`${inputClass} flex items-center justify-between gap-3 text-left transition hover:border-sky-400 focus:border-sky-500`}
    >
      <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" /><span className="truncate">{formatThaiDate(value)}</span></span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    <input id="appointment-date" type="date" name="appointment_date" required min={minDate} value={value} onChange={(event) => onChange(event.target.value)} tabIndex={-1} aria-hidden="true" className="sr-only" />
    {open && <div id="appointment-date-calendar" role="dialog" aria-label="เลือกวันที่ตรวจ" className="absolute left-0 z-20 mt-2 w-[min(21rem,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-950/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="เดือนก่อนหน้า" disabled={previousDisabled} onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <h3 className="text-sm font-bold text-slate-900">{formatThaiMonth(month)}</h3>
        <button type="button" aria-label="เดือนถัดไป" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">{thaiWeekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} className="h-9" aria-hidden="true" />;
          const disabled = day < minDate;
          const selected = day === value;
          return <button key={day} type="button" disabled={disabled} aria-label={`เลือกวันที่ ${formatThaiDate(day)}`} aria-current={selected ? 'date' : undefined} onClick={() => { onChange(day); setOpen(false); }} className={`h-9 rounded-xl text-sm transition ${selected ? 'bg-sky-600 font-bold text-white shadow-sm' : 'text-slate-700 hover:bg-sky-50 hover:text-sky-700'} disabled:cursor-not-allowed disabled:text-slate-300`}>{Number(day.slice(-2))}</button>;
        })}
      </div>
    </div>}
  </div>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof CalendarDays; label: string; value: number | string; tone: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xl font-bold tracking-tight text-slate-950">{value}</p><p className="truncate text-xs text-slate-500">{label}</p></div></div>;
}

function BookingForm({ data, busy, book, initialSlotId }: { data: PaiSnapshot; busy: boolean; book: (id: string, reason: string) => Promise<boolean>; initialSlotId?: string }) {
  const initialSlot = initialSlotId ? data.slots.find((slot) => slot.id === initialSlotId && slot.bookable && slot.status === 'available' && slot.booked_count < slot.max_capacity) : undefined;
  const [date, setDate] = useState(initialSlot?.slot_date ?? bangkokDate);
  const [department, setDepartment] = useState(initialSlot?.department ?? '');
  const [slotId, setSlotId] = useState(initialSlot?.id ?? '');
  const [reason, setReason] = useState('');
  const slots = data.slots.filter((s) => s.slot_date === date && (!department || s.department === department) && s.bookable && s.booked_count < s.max_capacity);
  const selected = slots.find((s) => s.id === slotId);
  return <form className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" onSubmit={async (e) => {
    e.preventDefault();
    if (selected && await book(selected.id, reason)) { setSlotId(''); setReason(''); }
  }}>
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-semibold text-slate-950">จองนัดใหม่</h2><p className="mt-1 text-xs text-slate-500">เลือกรอบบริการที่สะดวก แล้วส่งคำขอให้เจ้าหน้าที่อนุมัติ</p></div></div>
    <fieldset disabled={busy} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <div className="space-y-1.5 text-sm font-medium text-slate-700"><label htmlFor="appointment-date">วันที่ตรวจ</label><AppointmentDatePicker value={date} minDate={bangkokDate()} onChange={(value) => { setDate(value); setSlotId(''); }} /></div>
      <label className="space-y-1.5 text-sm font-medium text-slate-700">บริการ<select value={department} onChange={(e) => { setDepartment(e.target.value); setSlotId(''); }} className={inputClass}><option value="">ทุกบริการ</option>{[...new Set(data.slots.map((s) => s.department))].sort().map((d) => <option key={d}>{d}</option>)}</select></label>
      <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">รอบตรวจ<select required value={selected?.id ?? ''} onChange={(e) => setSlotId(e.target.value)} className={inputClass}>
        <option value="">เลือกรอบตรวจ</option>{slots.map((s) => <option key={s.id} value={s.id}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} · {s.doctor} · ว่าง {s.max_capacity - s.booked_count} ที่</option>)}
      </select></label>
      {slots.length === 0 && <p className="text-sm text-slate-500 sm:col-span-2">ไม่มีรอบว่างในวันที่และบริการนี้ ลองเลือกวันอื่น</p>}
      <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">อาการหรือเหตุผลที่มาพบแพทย์<textarea required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} rows={3} placeholder="เช่น ปวดศีรษะ มีไข้ หรือมาติดตามผล" /></label>
      <div className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-2"><Clock3 className="h-4 w-4 text-sky-500" aria-hidden="true" />คำขอจะอยู่ในสถานะรออนุมัติจนกว่าเจ้าหน้าที่จะตรวจสอบ</div>
      <button className={`${primaryButtonClass} sm:w-fit`} disabled={!selected || !reason.trim()}><TicketCheck className="h-4 w-4" aria-hidden="true" />{busy ? 'กำลังบันทึก…' : 'ยืนยันจองนัด'}</button>
    </fieldset>
  </form>;
}

export default function AppointmentPage({ role, repository, initialSlotId }: { role: PaiRole; repository?: PaiRepository; initialSlotId?: string }) {
  const state = usePaiWorkspace(role, repository);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<string>(() => {
    if (role === 'staff_admin') return 'pending';
    if (role === 'medical') return 'pending_confirmed';
    return '';
  });
  const [bangkokNow, setBangkokNow] = useState(() => ({
    date: bangkokDate(),
    time: bangkokTime(),
  }));

  useEffect(() => {
    const timer = setInterval(() => {
      setBangkokNow({
        date: bangkokDate(),
        time: bangkokTime(),
      });
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const data = state.data;
  const rows = data?.appointments.filter((a) => {
    const slot = data.slots.find((s) => s.id === a.slot_id);
    const matchesStatus =
      !status
        ? true
        : status === 'pending_confirmed'
          ? ['pending', 'confirmed'].includes(a.status)
          : a.status === status;
    return (!date || slot?.slot_date === date) && matchesStatus &&
      `${a.patient} ${slot?.doctor ?? ''} ${slot?.department ?? ''} ${a.queue_number ?? ''}`.toLowerCase().includes(query.toLowerCase());
  }) ?? [];
  const stats = data ? {
    total: data.appointments.length,
    pending: data.appointments.filter((a) => a.status === 'pending').length,
    confirmed: data.appointments.filter((a) => a.status === 'confirmed').length,
    completed: data.appointments.filter((a) => a.status === 'completed').length,
  } : null;
  const headerStats: WorkspaceHeaderStat[] = stats ? [
    { label: role === 'patient' ? 'นัดหมายของฉัน' : 'นัดหมายทั้งหมด', value: stats.total, tone: 'default' },
    { label: 'รออนุมัติ', value: stats.pending, tone: 'warning' },
    { label: 'ยืนยันแล้ว', value: stats.confirmed, tone: 'info' },
    { label: 'จบตรวจแล้ว', value: stats.completed, tone: 'success' },
  ] : [];
  return <WorkspaceShell {...state} role={role} section="appointments" stats={headerStats}>
    {state.loading ? <PaiPageLoading /> : data && <>
      {stats && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon={CalendarDays} label={role === 'patient' ? 'นัดหมายของฉัน' : 'นัดหมายทั้งหมด'} value={stats.total} tone="bg-sky-50 text-sky-600" /><MetricCard icon={Clock3} label="รออนุมัติ" value={stats.pending} tone="bg-amber-50 text-amber-600" /><MetricCard icon={UsersRound} label="ยืนยันแล้ว" value={stats.confirmed} tone="bg-violet-50 text-violet-600" /><MetricCard icon={CheckCircle2} label="ตรวจเสร็จแล้ว" value={stats.completed} tone="bg-emerald-50 text-emerald-600" /></div>}
      {role === 'patient' && <BookingForm data={data} busy={state.busy} initialSlotId={initialSlotId} book={(id, reason) => state.run((r) => r.book(id, reason), 'จองนัดสำเร็จ รอเจ้าหน้าที่อนุมัติ')} />}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{role === 'medical' ? 'คิวที่รับผิดชอบ' : role === 'staff_admin' ? 'รายการนัดทั้งหมด' : 'นัดหมายของฉัน'}</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลล่าสุดจากระบบ · ใช้ตัวกรองเพื่อค้นหารายการ</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{rows.length} รายการ</span></div></div>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3 sm:p-5">
          <label className="relative text-sm"><span className="sr-only">ค้นหาชื่อ แพทย์ หรือคิว</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" /><input placeholder="ค้นหาชื่อ แพทย์ หรือคิว" className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <PaiDatePicker label="กรองวันที่" value={date} onChange={setDate} markedDates={data.appointments.flatMap((a) => data.slots.filter((s) => s.id === a.slot_id).map((s) => s.slot_date))} />
          <label className="text-sm"><span className="sr-only">สถานะ</span><select aria-label="สถานะ" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{role === 'medical' && <option value="pending_confirmed">รออนุมัติและรอตรวจ</option>}{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        {rows.length === 0 && <p className="rounded-xl bg-white p-6 text-slate-500">ไม่พบนัดหมายตามเงื่อนไขนี้</p>}
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">{rows.map((a) => {
          const slot = data.slots.find((s) => s.id === a.slot_id);
          return <article key={a.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Stethoscope className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="truncate font-semibold text-slate-950">คิว {a.queue_number ?? '—'} · {a.patient}</h3><p className="mt-1 truncate text-xs text-slate-500">{slot?.doctor} · {slot?.department}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[a.status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{statusLabels[a.status]}</span></div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"><CalendarDays className="h-4 w-4 text-sky-600" aria-hidden="true" />{slot ? `${formatAppointmentDate(slot.slot_date)} · ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}` : 'ไม่พบรอบตรวจ'}</div>
            <p className="break-words text-sm">อาการ: {a.reason || 'ไม่ได้ระบุ'}</p>
            {role !== 'patient' && <p className="break-words text-sm">เบอร์โทรผู้ป่วย: {a.patient_phone?.trim() || 'ไม่ได้ระบุ'}</p>}
            {a.cancel_requested_at && ['pending','confirmed'].includes(a.status) && <p className="text-sm font-medium text-amber-800">ผู้ป่วยขอยกเลิก · รอเจ้าหน้าที่ดำเนินการ</p>}
            {a.rejection_reason && <p className="break-words rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800"><strong>เหตุผลการปฏิเสธ:</strong> {a.rejection_reason}</p>}
            <div className="flex flex-wrap items-start gap-2">{allowedActions(role, a, slot, bangkokNow.date, bangkokNow.time).map((action) => action === 'rejected' ? <details key={action} className="group/reject relative w-auto open:mb-56 sm:open:mb-64">
              <summary className={`${secondaryButtonClass} flex w-auto list-none cursor-pointer justify-center text-rose-700 marker:hidden`}>{actionLabels[action]}</summary>
              <form className="absolute left-0 top-full z-10 mt-3 w-[min(22rem,calc(100vw-3rem))] min-w-0 space-y-3 rounded-xl border border-rose-100 bg-rose-50/70 p-3 shadow-lg" onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const value = new FormData(form).get('rejection_reason');
                const ok = await state.run((r) => r.transition(a.id, action, typeof value === 'string' ? value : ''), 'ปฏิเสธนัดแล้วและบันทึกเหตุผล');
                if (ok) form.reset();
              }}><label className="block text-sm font-medium text-rose-900">เหตุผลการปฏิเสธ<textarea name="rejection_reason" required maxLength={2000} rows={3} className={inputClass} placeholder="เช่น รอบตรวจถูกยกเลิก หรือข้อมูลการจองไม่ครบ" /></label><button type="submit" disabled={state.busy} className={`${secondaryButtonClass} border-rose-200 text-rose-700`}>{state.busy ? 'กำลังบันทึก…' : 'ยืนยันปฏิเสธนัด'}</button></form>
            </details> : <button key={action} disabled={state.busy} className={secondaryButtonClass} onClick={() => void state.run((r) => r.transition(a.id, action), action === 'request_cancel' ? 'ส่งคำขอยกเลิกแล้ว รอเจ้าหน้าที่ดำเนินการ' : 'บันทึกสถานะนัดแล้ว')}>{actionLabels[action]}</button>)}
              {role === 'medical' && a.status === 'confirmed' && slot && !isSlotArrived(slot.slot_date, slot.start_time, bangkokNow.date, bangkokNow.time) && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ยังไม่ถึงเวลารอบตรวจ
                </span>
              )}
              {role === 'medical' && a.status === 'in_progress' && <Link href={`/records?appointment=${a.id}`} className={primaryButtonClass}>เปิดผลตรวจ</Link>}
              {role === 'patient' && a.status === 'completed' && <Link href={`/records?appointment=${a.id}`} className={secondaryButtonClass}>ดูผลตรวจและยา</Link>}
            </div>
          </article>;
        })}</div>
      </section>
    </>}
  </WorkspaceShell>;
}
