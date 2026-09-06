'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, Plus, Search, Stethoscope, Users, X } from 'lucide-react';
import PaiPageHeader, { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/PaiPageHeader';
import { createAppointmentPreviewRepository } from './mockRepository';
import { DEMO_DOCTOR_ID, DEMO_PATIENT_ID, DEMO_TODAY, formatAppointmentDate, remainingSeats, statusLabels, type AppointmentResult, type AppointmentStatus, type BookingSlot, type DemoAppointment, type PreviewRole } from './repository';

const panelClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6';
const statusClasses: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200', confirmed: 'bg-sky-50 text-sky-700 ring-sky-200', in_progress: 'bg-violet-50 text-violet-700 ring-violet-200', completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200', cancelled: 'bg-slate-100 text-slate-600 ring-slate-200', no_show: 'bg-rose-50 text-rose-700 ring-rose-200', rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function Status({ value }: { value: AppointmentStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[value]}`}>{statusLabels[value]}</span>;
}

export default function AppointmentWorkspace() {
  const [repository] = useState(createAppointmentPreviewRepository);
  const [snapshot, setSnapshot] = useState(() => repository.snapshot());
  const [role, setRole] = useState<PreviewRole>('patient');
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [date, setDate] = useState('2026-09-08');
  const [department, setDepartment] = useState('เวชปฏิบัติทั่วไป');
  const [slotId, setSlotId] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [proposedSlotId, setProposedSlotId] = useState('');
  const [proposalReason, setProposalReason] = useState('');
  const bookingField = useRef<HTMLSelectElement>(null);
  const rescheduleField = useRef<HTMLSelectElement>(null);

  useEffect(() => { if (bookingOpen) bookingField.current?.focus(); }, [bookingOpen]);
  useEffect(() => { if (rescheduleId) rescheduleField.current?.focus(); }, [rescheduleId]);

  const slotFor = (item: DemoAppointment) => snapshot.slots.find((slot) => slot.id === item.slotId)!;
  const myAppointments = snapshot.appointments.filter((item) => item.patientId === DEMO_PATIENT_ID);
  const todayQueue = snapshot.appointments.filter((item) => slotFor(item).date === DEMO_TODAY && (role !== 'doctor' || slotFor(item).doctorId === DEMO_DOCTOR_ID));
  const baseList = role === 'patient' ? myAppointments.filter((item) => tab === 'history' ? ['completed', 'cancelled', 'rejected', 'no_show'].includes(item.status) : ['pending', 'confirmed', 'in_progress'].includes(item.status)) : tab === 'queue' || role === 'doctor' ? todayQueue : snapshot.appointments.filter((item) => ['pending', 'confirmed'].includes(item.status));
  const visible = baseList.filter((item) => (statusFilter === 'all' || item.status === statusFilter) && `${item.patient} ${item.id} ${item.queue} ${slotFor(item).doctor} ${slotFor(item).department}`.toLowerCase().includes(search.trim().toLowerCase()));
  const bookingSlots = snapshot.slots.filter((slot) => slot.date === date && slot.department === department);
  const selectedSlot = snapshot.slots.find((slot) => slot.id === slotId);
  const rescheduling = snapshot.appointments.find((item) => item.id === rescheduleId);
  const alternativeSlots = rescheduling ? snapshot.slots.filter((slot) => slot.doctorId === slotFor(rescheduling).doctorId && slot.date > DEMO_TODAY && slot.id !== rescheduling.slotId && !slot.closed && (remainingSeats(slot, snapshot.appointments) > 0 || rescheduling.proposal?.slotId === slot.id)) : [];

  function apply(result: AppointmentResult) {
    if (!result.ok) { setFormError(result.error); setNotice(''); return false; }
    setSnapshot(repository.snapshot()); setNotice(result.message); setFormError(''); return true;
  }

  function changeView(value: PreviewRole) {
    setRole(value); setTab(value === 'patient' ? 'upcoming' : 'queue'); setSearch(''); setStatusFilter('all'); setBookingOpen(false); setCancelId(null); setRescheduleId(null); setNotice(''); setFormError('');
  }

  function openReschedule(item: DemoAppointment) {
    setRescheduleId(item.id); setProposedSlotId(''); setProposalReason(''); setFormError(''); setNotice(''); setBookingOpen(false);
  }

  function book(event: FormEvent) {
    event.preventDefault();
    if (apply(repository.book(slotId, reason))) { setBookingOpen(false); setSlotId(''); setReason(''); setTab('upcoming'); setSearch(''); setStatusFilter('all'); }
  }

  function slotDescription(slot: BookingSlot) {
    return `${formatAppointmentDate(slot.date)} · ${slot.start}–${slot.end} น.`;
  }

  return (
    <div>
      <PaiPageHeader title="นัดหมายและคิวตรวจ" description="วางแผนการพบแพทย์ ติดตามนัดหมาย และจัดการคิวตรวจในที่เดียว" active="appointments">
        {role === 'patient' && <button className={primaryButtonClass} onClick={() => { setBookingOpen(!bookingOpen); setRescheduleId(null); setFormError(''); }} aria-expanded={bookingOpen} aria-controls="booking-form"><Plus className="h-4 w-4" aria-hidden="true" />จองนัดหมายใหม่</button>}
      </PaiPageHeader>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="font-semibold text-slate-800">{role === 'patient' ? 'สวัสดี คุณณัฐชา' : role === 'doctor' ? 'คิวของ นพ.กิตติ สุขใจ' : 'พื้นที่จัดการนัดหมาย'}</p><p className="mt-1 text-xs text-slate-500">{role === 'patient' ? 'นัดหมายของผู้ป่วยตัวอย่าง · ณัฐชา ใจดี' : 'รายชื่อและคิวทั้งหมดในหน้านี้เป็นข้อมูลสมมติ'}</p></div>
        <label className="grid gap-1.5 text-xs font-medium text-slate-500">มุมมองตัวอย่าง<select className={inputClass} value={role} onChange={(event) => changeView(event.target.value as PreviewRole)}><option value="patient">ผู้ป่วย</option><option value="staff">เจ้าหน้าที่</option><option value="doctor">แพทย์</option></select></label>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: role === 'patient' ? 'นัดที่กำลังจะมาถึง' : 'นัดวันนี้', value: role === 'patient' ? myAppointments.filter((item) => ['pending', 'confirmed'].includes(item.status)).length : todayQueue.filter((item) => !['cancelled', 'rejected'].includes(item.status)).length, icon: CalendarDays, color: 'bg-sky-50 text-sky-600' },
          { label: 'รออนุมัติ', value: (role === 'patient' ? myAppointments : role === 'doctor' ? todayQueue : snapshot.appointments).filter((item) => item.status === 'pending').length, icon: Clock3, color: 'bg-amber-50 text-amber-600' },
          { label: role === 'patient' ? 'ข้อเสนอเลื่อนนัด' : 'กำลังตรวจ', value: role === 'patient' ? myAppointments.filter((item) => item.proposal).length : todayQueue.filter((item) => item.status === 'in_progress').length, icon: role === 'patient' ? CalendarDays : Stethoscope, color: 'bg-violet-50 text-violet-600' },
        ].map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"><span className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}<span className="ml-2 text-xs font-normal text-slate-400">รายการ</span></p></div></div>)}
      </div>

      {notice && <p role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check className="h-5 w-5 shrink-0" aria-hidden="true" />{notice}</p>}
      {formError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{formError}</p>}

      {bookingOpen && <section id="booking-form" aria-labelledby="booking-heading" className={`${panelClass} mb-6 border-sky-200`}>
        <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="booking-heading" className="text-lg font-semibold text-slate-900">จองนัดหมายใหม่</h2><p className="mt-1 text-sm text-slate-500">เลือกวันล่วงหน้า 1–14 วัน · 8–21 ก.ย. 2569</p></div><button className={secondaryButtonClass} aria-label="ปิดฟอร์มจองนัด" onClick={() => { setBookingOpen(false); setFormError(''); }}><X className="h-4 w-4" /></button></div>
        <form onSubmit={book} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">แผนก<select ref={bookingField} className={`${inputClass} scroll-mt-24`} value={department} onChange={(event) => { setDepartment(event.target.value); setSlotId(''); }}>{Array.from(new Set(snapshot.slots.map((slot) => slot.department))).map((name) => <option key={name}>{name}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">วันที่ต้องการนัด<input required type="date" min="2026-09-08" max="2026-09-21" className={inputClass} value={date} onChange={(event) => { setDate(event.target.value); setSlotId(''); }} /></label></div>
            <fieldset><legend className="mb-3 text-sm font-medium">เลือกรอบตรวจ{bookingSlots[0] && <span className="mt-1 block text-xs font-normal text-slate-500">{bookingSlots[0].doctor}</span>}</legend><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{bookingSlots.map((slot) => {
              const seats = remainingSeats(slot, snapshot.appointments);
              const unavailable = slot.closed || seats === 0;
              return <button key={slot.id} type="button" disabled={unavailable} aria-pressed={slotId === slot.id} onClick={() => setSlotId(slot.id)} className={`min-h-20 rounded-xl border p-3 text-left text-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50 ${slotId === slot.id ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500' : 'border-slate-200 hover:border-sky-300 disabled:bg-slate-50'}`}><span className="block font-semibold">{slot.start}–{slot.end}</span><span className={`mt-2 block text-xs ${unavailable ? 'text-slate-500' : 'text-emerald-700'}`}>{slot.closed ? 'ปิดรับจอง' : seats === 0 ? 'เต็มแล้ว' : `ว่าง ${seats} ที่`}</span></button>;
            })}</div>{!bookingSlots.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">ไม่มีรอบตรวจในวันนี้ ลองเลือกวันอื่น</p>}</fieldset>
            <label className="grid gap-2 text-sm font-medium">อาการเบื้องต้น / เหตุผลที่นัด<textarea required maxLength={500} rows={3} className={inputClass} placeholder="เช่น ต้องการปรึกษาอาการทั่วไป" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          </div>
          <aside className="flex flex-col rounded-xl bg-slate-50 p-5"><h3 className="font-semibold text-slate-900">ตรวจสอบก่อนส่งคำขอ</h3><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-slate-500">ผู้ป่วย</dt><dd className="mt-1 font-medium">ณัฐชา ใจดี</dd></div><div><dt className="text-xs text-slate-500">แผนก / แพทย์</dt><dd className="mt-1">{department}<br />{selectedSlot?.doctor ?? 'เลือกรอบตรวจที่ต้องการ'}</dd></div><div><dt className="text-xs text-slate-500">วันและเวลา</dt><dd className="mt-1 font-medium">{selectedSlot ? slotDescription(selectedSlot) : 'ยังไม่ได้เลือกรอบตรวจ'}</dd></div></dl><p className="mb-5 mt-6 text-xs leading-6 text-slate-500">นัดใหม่จะอยู่ในสถานะรออนุมัติ<br />ยกเลิกเองได้ก่อนเริ่มนัดอย่างน้อย 2 ชั่วโมง</p><button className={`${primaryButtonClass} mt-auto w-full`} disabled={!slotId} type="submit">ยืนยันส่งคำขอนัด<ArrowRight className="h-4 w-4" aria-hidden="true" /></button></aside>
        </form>
      </section>}

      {rescheduling && <section className={`${panelClass} mb-6 border-amber-200`} aria-labelledby="reschedule-heading">
        <div className="mb-4 flex justify-between gap-3"><div><h2 id="reschedule-heading" className="text-lg font-semibold">{role === 'patient' ? 'เลือกวันนัดอื่น' : 'เสนอเลื่อนนัด'} · {rescheduling.id}</h2><p className="mt-1 text-sm text-slate-500">นัดเดิม: {slotDescription(slotFor(rescheduling))}</p></div><button className={secondaryButtonClass} onClick={() => { setRescheduleId(null); setFormError(''); }} aria-label="ปิดฟอร์มเลื่อนนัด"><X className="h-4 w-4" /></button></div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (apply(role === 'patient' ? repository.acceptProposal(rescheduling.id, proposedSlotId) : repository.propose(rescheduling.id, proposedSlotId, proposalReason))) setRescheduleId(null); }}>
          <label className="grid min-w-0 gap-2 text-sm font-medium">รอบใหม่ของแพทย์เดิม<select ref={rescheduleField} required className={`${inputClass} min-w-0 scroll-mt-24`} value={proposedSlotId} onChange={(event) => setProposedSlotId(event.target.value)}><option value="">เลือกรอบที่ว่าง</option>{alternativeSlots.map((slot) => <option key={slot.id} value={slot.id}>{slotDescription(slot)}</option>)}</select></label>
          {role === 'staff' && <label className="grid gap-2 text-sm font-medium">เหตุผลในการเลื่อน<input required maxLength={300} className={inputClass} value={proposalReason} onChange={(event) => setProposalReason(event.target.value)} placeholder="เช่น แพทย์งดตรวจในวันเดิม" /></label>}
          <div className="flex flex-col items-start justify-between gap-3 sm:col-span-2 sm:flex-row sm:items-center"><p className="text-xs leading-6 text-slate-500">ผู้ป่วยมีเวลาตอบรับ 24 ชั่วโมง · ข้อเสนอยังไม่ใช่นัดใหม่ที่ยืนยันแล้ว</p><button className={primaryButtonClass} type="submit">{role === 'patient' ? 'ยืนยันรอบที่เลือก' : 'ส่งข้อเสนอเลื่อนนัด'}</button></div>
        </form>
      </section>}

      {role === 'patient' && myAppointments.filter((item) => item.proposal).map((item) => <section key={item.id} aria-label="ข้อเสนอเลื่อนนัด" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><span className="text-xs font-semibold text-amber-800">รอคุณตอบรับ · {item.id}</span><h2 className="mt-1 text-lg font-semibold text-slate-900">มีข้อเสนอเปลี่ยนวันนัดของคุณ</h2><p className="mt-2 text-sm text-slate-600">{item.proposal!.reason}</p><p className="mt-3 text-sm">เดิม {slotDescription(slotFor(item))}</p><p className="mt-1 text-sm font-semibold text-amber-900">ใหม่ {slotDescription(snapshot.slots.find((slot) => slot.id === item.proposal!.slotId)!)}</p><p className="mt-3 text-xs leading-5 text-amber-800">ตอบรับภายใน {item.proposal!.deadline}</p></div><div className="flex flex-wrap gap-2"><button className={secondaryButtonClass} onClick={() => openReschedule(item)}>เลือกวันอื่น</button><button className={primaryButtonClass} onClick={() => { if (apply(repository.acceptProposal(item.id))) setRescheduleId(null); }}>ยืนยันวันนัดใหม่</button></div></div></section>)}

      <section className={panelClass} aria-labelledby="appointment-list-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 id="appointment-list-heading" className="text-lg font-semibold text-slate-900">{role === 'patient' ? 'รายการนัดหมายของฉัน' : role === 'doctor' ? 'ผู้ป่วยในความรับผิดชอบวันนี้' : 'รายการนัดหมายและคิว'}</h2><p className="mt-1 text-xs text-slate-500">{role === 'patient' ? 'ติดตามสถานะและรายละเอียดการนัดหมาย' : '7 กันยายน 2569 · รายการคิวตัวอย่าง'}</p></div><span className="text-sm text-slate-500">{visible.length} รายการ</span></div>
        {role !== 'doctor' && <div className="my-5 flex flex-wrap gap-2" role="group" aria-label="ประเภทนัดหมาย">{(role === 'patient' ? [{ id: 'upcoming', label: 'นัดที่กำลังจะมาถึง' }, { id: 'history', label: 'ประวัตินัดหมาย' }] : [{ id: 'queue', label: 'คิวตรวจวันนี้' }, { id: 'requests', label: 'คำขอและนัดล่วงหน้า' }]).map(({ id, label }) => <button key={id} className={`min-h-11 rounded-xl px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-sky-600 ${tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} aria-pressed={tab === id} onClick={() => { setTab(id); setStatusFilter('all'); }}>{label}</button>)}</div>}
        <div className="mb-5 mt-5 grid gap-3 sm:grid-cols-[1fr_180px]"><label className="relative"><span className="sr-only">ค้นหานัดหมาย</span><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" /><input className={`${inputClass} pl-10`} placeholder={role === 'patient' ? 'ค้นหาเลขนัด แพทย์ หรือแผนก' : 'ค้นหาชื่อผู้ป่วย เลขนัด หรือเลขคิว'} value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span className="sr-only">กรองสถานะนัด</span><select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">ทุกสถานะ</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>

        <div className="space-y-3">{visible.map((item) => {
          const slot = slotFor(item);
          return <article key={item.id} aria-label={`นัดหมาย ${item.id}`} className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-4"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-700"><span className="text-xl font-bold">{slot.date.slice(-2)}</span><span className="text-[10px]">ก.ย. 69</span></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{role === 'patient' ? slot.department : item.patient}</h3><Status value={item.status} /></div><p className="mt-1 text-sm text-slate-600">{slot.doctor}{role !== 'patient' && ` · ${slot.department}`}</p><p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{slot.start}–{slot.end} น.</span><span>{item.id}</span><span>คิว {item.queue}</span></p>{item.proposal && <p className="mt-2 text-xs text-amber-700">มีข้อเสนอเลื่อนนัด · รอผู้ป่วยตอบรับ</p>}</div></div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {role === 'patient' && ['pending', 'confirmed'].includes(item.status) && <button className={secondaryButtonClass} onClick={() => { setCancelId(item.id); setFormError(''); }}>ยกเลิกนัด</button>}
              {role === 'patient' && item.status === 'completed' && <Link href="/records" className={secondaryButtonClass}>ดูผลตรวจ<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
              {role === 'staff' && item.status === 'pending' && <><button className={secondaryButtonClass} onClick={() => apply(repository.changeStatus(item.id, 'rejected', role))}>ไม่อนุมัติ</button><button className={primaryButtonClass} onClick={() => apply(repository.changeStatus(item.id, 'confirmed', role))}>อนุมัตินัด</button></>}
              {role === 'staff' && ['pending', 'confirmed'].includes(item.status) && !item.proposal && <button className={secondaryButtonClass} onClick={() => openReschedule(item)}>เสนอเลื่อนนัด</button>}
              {role !== 'patient' && item.status === 'confirmed' && slot.date === DEMO_TODAY && <button className={primaryButtonClass} onClick={() => apply(repository.changeStatus(item.id, 'in_progress', role))}>เริ่มตรวจ</button>}
              {role === 'doctor' && item.status === 'in_progress' && <Link href="/records" className={primaryButtonClass}>ไปหน้าบันทึกผลตรวจ<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
            </div></div>
            {cancelId === item.id && <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4"><p className="text-sm font-medium text-rose-900">ต้องการยกเลิกนัด {item.id} ใช่หรือไม่?</p><p className="mt-1 text-xs text-rose-700">ยกเลิกได้ก่อนเริ่มนัดอย่างน้อย 2 ชั่วโมง</p><div className="mt-3 flex flex-wrap gap-2"><button className={secondaryButtonClass} onClick={() => setCancelId(null)}>เก็บนัดไว้</button><button className={`${primaryButtonClass} bg-rose-600 hover:bg-rose-700`} onClick={() => { if (apply(repository.cancel(item.id))) setCancelId(null); }}>ยืนยันยกเลิกนัด</button></div></div>}
          </article>;
        })}</div>
        {!visible.length && <div className="flex flex-col items-center rounded-xl bg-slate-50 px-4 py-12 text-center"><Users className="mb-3 h-9 w-9 text-slate-300" aria-hidden="true" /><h3 className="font-semibold text-slate-700">ไม่พบนัดหมาย</h3><p className="mt-2 text-sm text-slate-500">{search || statusFilter !== 'all' ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'เมื่อมีรายการนัดหมาย จะแสดงในส่วนนี้'}</p>{(search || statusFilter !== 'all') && <button className={`${secondaryButtonClass} mt-4`} onClick={() => { setSearch(''); setStatusFilter('all'); }}>ล้างตัวกรอง</button>}</div>}
      </section>
      <p className="mt-5 text-xs leading-6 text-slate-400">ตัวอย่างนี้แยกข้อมูลนัดหมายออกจากตารางแพทย์และผลตรวจ การส่งต่อข้อมูลระหว่างหน้า การยืนยันเลื่อนนัดอัตโนมัติ และการแจ้งเตือน จะเพิ่มในขั้นเชื่อมระบบ</p>
    </div>
  );
}
