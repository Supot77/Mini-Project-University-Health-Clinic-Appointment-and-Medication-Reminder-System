'use client';

import { useState } from 'react';
import { ClipboardCheck, FileHeart, Pill, Search, Stethoscope } from 'lucide-react';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/PaiPageHeader';
import PaiPageLoading from '../components/PaiPageLoading';
import type { PaiRepository, PaiSnapshot, RecordInput } from './contract';
import { usePaiWorkspace } from './usePaiWorkspace';
import WorkspaceShell from './WorkspaceShell';

type Prescription = RecordInput['prescriptions'][number];
type PrescriptionDraft = Prescription & { meal: string; times: string };
function RecordEditor({ data, busy, selectedId, save }: {
  data: PaiSnapshot; busy: boolean; selectedId?: string; save: (input: RecordInput) => Promise<boolean>;
}) {
  const pending = data.appointments.filter((a) => a.status === 'in_progress' && !a.has_record);
  const [appointmentId, setAppointmentId] = useState(pending.find((a) => a.id === selectedId)?.id ?? pending[0]?.id ?? '');
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [items, setItems] = useState<PrescriptionDraft[]>([]);
  const [complete, setComplete] = useState(true);
  const chosen = pending.find((a) => a.id === appointmentId);
  function update(index: number, patch: Partial<PrescriptionDraft>) {
    setItems((rows) => rows.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, ...patch };
      return { ...next, frequency: `${next.meal} · ${next.times.trim()}` };
    }));
  }
  if (!pending.length) return <p className="rounded-xl bg-sky-50 p-4 text-sm">ไม่มีคิวที่รอบันทึกผลตรวจ เริ่มตรวจจากหน้านัดหมายก่อน</p>;
  return <form className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" onSubmit={async (e) => {
    e.preventDefault();
    if (chosen && await save({ appointmentId: chosen.id, diagnosis, advice, prescriptions: items.map((item) => ({ medication_id: item.medication_id, name: item.name, dosage: item.dosage, frequency: item.frequency, quantity: item.quantity, duration_days: item.duration_days })), complete })) { setDiagnosis(''); setAdvice(''); setItems([]); }
  }}>
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><FileHeart className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-semibold text-slate-950">บันทึกผลตรวจและรายการยา</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลจะส่งต่อให้ผู้ป่วยและจุดจ่ายยาตามสิทธิ์</p></div></div>
    <p className="px-5 pt-5 text-sm text-slate-500 sm:px-6">ตรวจทานก่อนบันทึก ผลตรวจและใบสั่งยาแก้ไขไม่ได้หลังบันทึก ผู้ป่วยเห็นเมื่อจบตรวจ</p>
    <fieldset disabled={busy} className="space-y-4 p-5 sm:p-6">
      <label className="block text-sm font-medium text-slate-700">คิวที่กำลังตรวจ<select required value={chosen?.id ?? ''} onChange={(e) => { setAppointmentId(e.target.value); setDiagnosis(''); setAdvice(''); setItems([]); }} className={inputClass}><option value="">เลือกคิว</option>{pending.map((a) => <option key={a.id} value={a.id}>คิว {a.queue_number ?? '—'} · {a.patient}</option>)}</select></label>
      {chosen && <p className="break-words text-sm">อาการ: {chosen.reason || 'ไม่ได้ระบุ'}</p>}
      <label className="block text-sm font-medium text-slate-700">ผลวินิจฉัย<textarea required maxLength={5000} rows={3} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm font-medium text-slate-700">คำแนะนำการรักษา<textarea maxLength={5000} rows={3} value={advice} onChange={(e) => setAdvice(e.target.value)} className={inputClass} /></label>
      <div className="flex items-center gap-2 border-t border-slate-100 pt-4"><Pill className="h-5 w-5 text-sky-600" aria-hidden="true" /><h3 className="font-semibold">รายการยา</h3></div>
      {items.length === 0 && <p className="text-sm text-slate-500">ไม่มีรายการยา สามารถบันทึกผลตรวจโดยไม่สั่งยาได้</p>}
      {items.map((item, index) => <fieldset key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <legend className="px-2 text-sm font-medium">ยารายการที่ {index + 1}</legend>
        <label className="text-sm sm:col-span-2">ยา<select required className={inputClass} value={item.medication_id} onChange={(e) => { const m = data.medications.find((v) => v.id === e.target.value); update(index, { medication_id: m?.id ?? '', name: m?.name ?? '' }); }}><option value="">เลือกยาจากคลัง</option>{data.medications.map((m) => <option key={m.id} value={m.id} disabled={items.some((v, i) => i !== index && v.medication_id === m.id)}>{m.name} · {m.type}</option>)}</select></label>
        <label className="text-sm">จำนวนที่สั่ง<input type="number" required min={1} max={100000} step={1} className={inputClass} value={item.quantity} onChange={(e) => update(index, { quantity: Number(e.target.value) })} /></label>
        <label className="text-sm">ระยะเวลา (วัน)<input type="number" required min={1} max={365} step={1} className={inputClass} value={item.duration_days} onChange={(e) => update(index, { duration_days: Number(e.target.value) })} /></label>
        <label className="text-sm">ขนาดยาต่อครั้ง (ระบุหน่วย)<input required maxLength={500} placeholder="เช่น 2 เม็ด หรือ 5 มล." className={inputClass} value={item.dosage} onChange={(e) => update(index, { dosage: e.target.value })} /></label>
        <label className="text-sm">การใช้ยากับอาหาร<select required className={inputClass} value={item.meal} onChange={(e) => update(index, { meal: e.target.value })}><option value="">เลือกวิธีใช้</option><option>ก่อนอาหาร</option><option>หลังอาหาร</option><option>พร้อมอาหาร</option><option>ไม่ขึ้นกับมื้ออาหาร</option></select></label>
        <label className="text-sm sm:col-span-2">ช่วงเวลาและความถี่ในการใช้ยา<input required maxLength={400} placeholder="เช่น เช้า เที่ยง เย็น หรือก่อนนอน วันละ 1 ครั้ง" className={inputClass} value={item.times} onChange={(e) => update(index, { times: e.target.value })} /></label>
        <button type="button" className={secondaryButtonClass} onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}>ลบยารายการที่ {index + 1}</button>
      </fieldset>)}
      <button type="button" disabled={!data.medications.length || items.length >= 50} className={secondaryButtonClass} onClick={() => setItems((rows) => [...rows, { medication_id: '', name: '', dosage: '', frequency: '', meal: '', times: '', quantity: 1, duration_days: 1 }])}>เพิ่มรายการยา</button>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />จบตรวจพร้อมบันทึกผล</label>
      <button disabled={!chosen || !diagnosis.trim()} className={primaryButtonClass}>{busy ? 'กำลังบันทึก…' : complete ? 'ยืนยันบันทึกผลและจบตรวจ' : 'ยืนยันบันทึกผลตรวจ'}</button>
    </fieldset>
  </form>;
}

function RecordList({ data, selectedId }: { data: PaiSnapshot; selectedId?: string }) {
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(Boolean(selectedId));
  const records = data.records.filter((r) => (!onlySelected || r.appointment_id === selectedId) && `${r.patient} ${r.doctor} ${r.diagnosis ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-semibold text-slate-950">{data.actor.role === 'patient' ? 'ประวัติผลตรวจของฉัน' : 'ผลตรวจและประวัติผู้ป่วยที่รับผิดชอบ'}</h2><p className="mt-1 text-xs text-slate-500">แสดงเฉพาะรายการที่บัญชีนี้มีสิทธิ์เข้าถึง</p></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{records.length} รายการ</span></div>
    <label className="relative block text-sm"><span className="sr-only">ค้นหาประวัติ</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" /><input placeholder="ค้นหาชื่อ แพทย์ หรือผลวินิจฉัย" className={`${inputClass} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    {selectedId && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />เฉพาะนัดที่เลือก</label>}
    {!records.length && <p className="rounded-xl bg-white p-6 text-slate-500">ยังไม่มีผลตรวจที่เปิดดูได้ตามเงื่อนไขนี้</p>}
    {records.map((r) => <article key={r.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Stethoscope className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-semibold text-slate-950">{r.patient}</h3><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date(r.created_at))}</p></div><span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{r.completed ? 'จบตรวจแล้ว' : 'รอจบตรวจ'}</span></div>
      <p className="text-sm text-slate-500">แพทย์: {r.doctor}</p>
      <p className="whitespace-pre-wrap break-words"><strong>ผลวินิจฉัย:</strong> {r.diagnosis}</p>
      <p className="whitespace-pre-wrap break-words"><strong>คำแนะนำ:</strong> {r.treatment_notes || 'ไม่ได้ระบุ'}</p>
      <h4 className="font-semibold">รายการยาที่สั่ง</h4>
      {!r.prescribed_medications?.length && <p className="text-sm text-slate-500">ไม่มีรายการยา</p>}
      <ul className="space-y-2">{r.prescribed_medications?.map((m) => <li key={m.medication_id} className="rounded-xl bg-slate-50 p-3 text-sm">
        <p className="break-words font-semibold">{m.name} · จำนวนที่สั่ง {m.quantity}</p>
        <dl className="mt-2 space-y-1 break-words">
          <div><dt className="inline font-medium">ขนาดยาต่อครั้ง: </dt><dd className="inline">{m.dosage}</dd></div>
          <div><dt className="inline font-medium">วิธีใช้และช่วงเวลา: </dt><dd className="inline">{m.frequency}</dd></div>
          <div><dt className="inline font-medium">ระยะเวลา: </dt><dd className="inline">{m.duration_days} วัน</dd></div>
        </dl>
      </li>)}</ul>
      <p className="text-xs text-slate-500">รายการสั่งยาไม่ใช่หลักฐานการจ่ายยา ติดต่อจุดจ่ายยาตามขั้นตอนของคลินิก</p>
    </article>)}
  </section>;
}

export function PatientRecordsPage({ repository, selectedId }: { repository?: PaiRepository; selectedId?: string }) {
  const state = usePaiWorkspace('patient', repository);
  return <WorkspaceShell {...state} role="patient" section="records">{state.loading ? <PaiPageLoading /> : state.data && <RecordList data={state.data} selectedId={selectedId} />}</WorkspaceShell>;
}
export function MedicalRecordsPage({ repository, selectedId }: { repository?: PaiRepository; selectedId?: string }) {
  const state = usePaiWorkspace('medical', repository);
  return <WorkspaceShell {...state} role="medical" section="records">{state.loading ? <PaiPageLoading /> : state.data && <>
    <RecordEditor data={state.data} busy={state.busy} selectedId={selectedId} save={(input) => state.run((r) => r.saveRecord(input), input.complete ? 'บันทึกผลและจบตรวจแล้ว ผู้ป่วยเปิดอ่านได้' : 'บันทึกผลตรวจแล้ว กรุณาจบตรวจเพื่อให้ผู้ป่วยเปิดอ่านได้')} />
    <RecordList data={state.data} selectedId={selectedId} />
  </>}</WorkspaceShell>;
}
