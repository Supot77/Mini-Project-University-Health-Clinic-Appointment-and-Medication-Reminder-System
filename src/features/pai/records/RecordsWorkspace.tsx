'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, CheckCheck, ChevronRight, ClipboardList, FileHeart, History, LockKeyhole, Pencil, Pill, Plus, Search, Stethoscope, Trash2 } from 'lucide-react';
import PaiPageHeader, { inputClass, primaryButtonClass, secondaryButtonClass } from '../components/PaiPageHeader';
import { PREVIEW_DOCTOR_ID, type DemoPrescriptionItem, type DemoRecord, type RecordDraft, type RecordPreview, type RecordResult, type RecordsDemoRepository } from './contract';
import { createRecordsDemoRepository, recordsFromSharedMock } from './mockRepository';
import { useOptionalClinicMockDatabase } from '@/features/mock-database/ClinicMockProvider';

const cardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const labelClass = 'mb-2 block text-sm font-medium text-slate-700';
const textareaClass = `${inputClass} min-h-24 resize-y`;

function RecordStatus({ status }: { status: DemoRecord['status'] }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{status === 'completed' ? <Check className="h-3 w-3" aria-hidden="true" /> : <Pencil className="h-3 w-3" aria-hidden="true" />}{status === 'completed' ? 'ปิดตรวจแล้ว' : 'แบบร่าง'}</span>;
}

export default function RecordsWorkspace({ repository }: { repository?: RecordsDemoRepository }) {
  const sharedMock = useOptionalClinicMockDatabase();
  const [service] = useState(() => repository ?? createRecordsDemoRepository(sharedMock ? recordsFromSharedMock(sharedMock.database.snapshot()) : undefined));
  const [view, setView] = useState<RecordPreview>('patient');
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice, records]);

  useEffect(() => {
    let active = true;
    service.list(view).then(data => {
      if (!active) return;
      setRecords(data);
      setSelectedId(data[0]?.id ?? '');
      setLoading(false);
      setLoadError(false);
    }).catch(() => {
      if (!active) return;
      setLoading(false);
      setLoadError(true);
    });
    return () => { active = false; };
  }, [service, view, attempt]);

  function changeView(next: RecordPreview) {
    if (next === view) return;
    setLoading(true);
    setLoadError(false);
    setQuery('');
    setFilter('all');
    setNotice('');
    setView(next);
  }

  function updated(record: DemoRecord, message: string) {
    setRecords(current => current.map(item => item.id === record.id ? record : item));
    setNotice(message);
  }

  const visible = records.filter(record => (filter === 'all' || record.status === filter) && `${record.patientName} ${record.patientCode} ${record.id} ${record.doctorName} ${record.diagnosis}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = visible.find(record => record.id === selectedId) ?? visible[0];
  const completed = records.filter(record => record.status === 'completed').length;

  return (
    <div className="text-slate-900">
      <PaiPageHeader title="ผลตรวจและใบสั่งยา" description="ดูแลทุกครั้งที่เข้ารับบริการ พร้อมประวัติการรักษาในที่เดียว" active="records">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="มุมมองตัวอย่างผลตรวจ">
          {([{ key: 'patient', label: 'ผู้ป่วย' }, { key: 'doctor', label: 'แพทย์' }] as const).map(item => <button key={item.key} type="button" aria-pressed={view === item.key} onClick={() => changeView(item.key)} className={`min-h-10 rounded-lg px-4 text-sm font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-600 ${view === item.key ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{item.label}</button>)}
        </div>
      </PaiPageHeader>

      <div className="mb-5 flex items-center gap-3 text-sm text-slate-600"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">{view === 'patient' ? <FileHeart className="h-5 w-5" aria-hidden="true" /> : <Stethoscope className="h-5 w-5" aria-hidden="true" />}</span><p><strong className="block font-semibold text-slate-800">{view === 'patient' ? 'ประวัติของนักศึกษาตัวอย่าง ก' : 'พื้นที่ทำงานของ พญ. แพทย์ตัวอย่าง ก'}</strong><span className="mt-0.5 block text-xs leading-5">{view === 'patient' ? 'แสดงเฉพาะผลตรวจของตนเองที่ปิดตรวจแล้ว' : 'บันทึกนัดของตนเอง และอ่านประวัติผู้ป่วยที่รับผิดชอบ'}</span></p></div>

      {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-600">{notice}</p>}

      {loading ? <div role="status" aria-label="กำลังโหลดผลตรวจ" className="space-y-4"><p className="text-sm text-slate-500">กำลังโหลดข้อมูลตัวอย่าง…</p><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none" />)}</div><div className="h-80 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" /></div> : loadError ? <div role="alert" className={`${cardClass} p-8 text-center`}><h2 className="font-semibold">โหลดผลตรวจไม่สำเร็จ</h2><p className="mb-4 mt-2 text-sm text-slate-500">ลองเปิดข้อมูลตัวอย่างอีกครั้ง</p><button type="button" className={secondaryButtonClass} onClick={() => { setLoading(true); setAttempt(current => current + 1); }}>ลองอีกครั้ง</button></div> : <>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[{ label: 'ประวัติทั้งหมด', value: records.length, suffix: 'รายการ', icon: ClipboardList, tone: 'bg-sky-50 text-sky-600' }, { label: 'ปิดตรวจแล้ว', value: completed, suffix: 'รายการ', icon: CheckCheck, tone: 'bg-emerald-50 text-emerald-600' }, { label: view === 'doctor' ? 'รอบันทึกผลตรวจ' : 'ใบสั่งยาที่มีส่วนค้าง', value: view === 'doctor' ? records.length - completed : records.filter(record => record.prescriptions.some(item => item.ordered > item.dispensed)).length, suffix: 'รายการ', icon: view === 'doctor' ? Pencil : Pill, tone: 'bg-amber-50 text-amber-600' }].map(({ label, value, suffix, icon: Icon, tone }) => <div key={label} className={`${cardClass} flex items-center justify-between gap-3 p-5`}><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}<span className="ml-2 text-xs font-normal text-slate-400">{suffix}</span></p></div><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span></div>)}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
          <section className={`${cardClass} min-w-0 overflow-hidden`} aria-label="รายการผลตรวจ">
            <div className="border-b border-slate-100 p-4"><h2 className="mb-4 font-semibold">{view === 'patient' ? 'ประวัติการรักษา' : 'รายการตรวจและประวัติ'}</h2><label htmlFor="record-search" className="sr-only">ค้นหาผลตรวจ</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" /><input id="record-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={view === 'patient' ? 'ค้นหาแพทย์ หรือผลตรวจ' : 'ค้นหาชื่อ หรือรหัสผู้ป่วย'} className={`${inputClass} pl-9`} /></div>{view === 'doctor' && <><label htmlFor="record-filter" className="sr-only">สถานะผลตรวจ</label><select id="record-filter" value={filter} onChange={event => setFilter(event.target.value)} className={`${inputClass} mt-3`}><option value="all">ทุกสถานะ</option><option value="draft">แบบร่าง</option><option value="completed">ปิดตรวจแล้ว</option></select></>}<p className="mt-3 text-xs text-slate-400">{visible.length} รายการ</p></div>
            {visible.length ? <ul className="divide-y divide-slate-100">{visible.map(record => <li key={record.id}><button type="button" aria-label={`เปิดผลตรวจ ${record.id} ${record.patientName}`} aria-pressed={selected?.id === record.id} onClick={() => { setSelectedId(record.id); setNotice(''); }} className={`w-full border-l-4 p-4 text-left outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-sky-600 ${selected?.id === record.id ? 'border-sky-500 bg-sky-50/70' : 'border-transparent hover:bg-slate-50'}`}><span className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500">{record.id}</span><RecordStatus status={record.status} /></span><span className="block text-sm font-semibold">{view === 'patient' ? record.department : record.patientName}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{record.dateLabel}</span><span className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500"><span>{record.doctorName}</span><ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" /></span>{view === 'doctor' && record.doctorId !== PREVIEW_DOCTOR_ID && <span className="mt-2 flex items-center gap-1 text-xs text-slate-400"><LockKeyhole className="h-3 w-3" aria-hidden="true" />ประวัติจากแพทย์อื่น</span>}</button></li>)}</ul> : <div className="p-6 text-center"><Search className="mx-auto mb-3 h-6 w-6 text-slate-300" aria-hidden="true" /><p className="text-sm font-medium">ไม่พบผลตรวจ</p><p className="mt-1 text-xs leading-5 text-slate-500">ลองเปลี่ยนคำค้นหาหรือสถานะ</p><button type="button" className={`${secondaryButtonClass} mt-4`} onClick={() => { setQuery(''); setFilter('all'); }}>ล้างตัวกรอง</button></div>}
          </section>

          {selected ? <RecordDetail key={`${view}-${selected.id}-${selected.version}`} record={selected} view={view} service={service} onUpdate={updated} /> : <div className={`${cardClass} flex min-h-72 flex-col items-center justify-center p-8 text-center`}><FileHeart className="mb-4 h-10 w-10 text-slate-300" aria-hidden="true" /><h2 className="font-semibold">ยังไม่มีรายการที่แสดงได้</h2><p className="mt-2 text-sm leading-6 text-slate-500">ผลตรวจที่ตรงกับการค้นหาจะแสดงที่นี่</p></div>}
        </div>
      </>}
    </div>
  );
}

function RecordDetail({ record, view, service, onUpdate }: { record: DemoRecord; view: RecordPreview; service: RecordsDemoRepository; onUpdate: (record: DemoRecord, message: string) => void }) {
  const own = view === 'doctor' && record.doctorId === PREVIEW_DOCTOR_ID;
  return <article className={`${cardClass} min-w-0 overflow-hidden`} aria-label={`รายละเอียดผลตรวจ ${record.id}`}>
    <div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium tracking-wide text-sky-600">{record.id} · เวอร์ชัน {record.version}</p><RecordStatus status={record.status} /></div><h2 className="mt-4 text-xl font-bold">{record.patientName}</h2><p className="mt-1 text-xs text-slate-500">{record.patientCode} · ข้อมูลผู้ป่วยสมมติ</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500"><span>{record.department}</span><span>{record.dateLabel}</span></div><p className="mt-2 text-sm text-slate-500">{record.doctorName}</p></div>
    <div className="space-y-6 p-5 sm:p-6">
      {view === 'doctor' && <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><strong>ประวัติแพ้ยา: </strong>{record.allergy}<p className="text-xs text-amber-800">ข้อมูลตัวอย่าง ไม่ใช่ระบบตรวจสอบการแพ้ยา</p></div>}
      {view === 'doctor' && !own && <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-600"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />ประวัติจากแพทย์อื่น · เปิดอ่านได้อย่างเดียว</p>}
      <section><h3 className="mb-2 text-sm font-semibold">อาการสำคัญ</h3><p className="text-sm leading-6 text-slate-500">{record.symptoms}</p></section>
      {own && record.status === 'draft' ? <DraftEditor record={record} service={service} onUpdate={onUpdate} /> : <>
        <section><h3 className="mb-2 text-sm font-semibold">ผลวินิจฉัย</h3><p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{record.diagnosis || 'ยังไม่มีผลวินิจฉัย'}</p></section>
        <section><h3 className="mb-2 text-sm font-semibold">คำแนะนำหลังตรวจ</h3><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-500">{record.advice || 'ไม่ได้ระบุคำแนะนำเพิ่มเติม'}</p></section>
        <section><div className="mb-3 flex items-center gap-2"><Pill className="h-4 w-4 text-sky-600" aria-hidden="true" /><h3 className="text-sm font-semibold">ใบสั่งยา</h3><span className="text-xs text-slate-400">{record.prescriptions.length} รายการ</span></div><p className="mb-3 text-xs leading-5 text-slate-500">ชื่อยาและคำสั่งใช้ด้านล่างเป็นข้อมูลสมมติสำหรับสาธิตหน้าจอ</p>{record.prescriptions.length ? <div className="space-y-3">{record.prescriptions.map(item => <Prescription key={item.id} item={item} record={record} canEdit={own} service={service} onUpdate={onUpdate} />)}</div> : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">ไม่มีรายการยาในการตรวจครั้งนี้</p>}</section>
      </>}
      {view === 'doctor' && <details className="rounded-xl border border-slate-200"><summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-sky-600"><History className="mr-2 inline h-4 w-4" aria-hidden="true" />ประวัติการเปลี่ยนแปลง ({record.history.length})</summary><div className="space-y-3 border-t border-slate-100 p-4">{record.history.length ? record.history.map(event => <div key={event.version} className="border-l-2 border-sky-200 pl-3"><p className="text-xs font-semibold text-sky-700">เวอร์ชัน {event.version} · แพทย์ตัวอย่าง ก</p><p className="mt-1 break-words text-sm leading-6 text-slate-600">{event.description}</p>{event.reason && <p className="mt-1 break-words text-xs leading-5 text-slate-500">เหตุผล: {event.reason}</p>}</div>) : <p className="text-sm text-slate-400">ยังไม่มีการแก้ไขในรอบทดลองนี้</p>}</div></details>}
      <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">บันทึกเฉพาะหน้าตัวอย่างนี้ · การส่งต่อห้องยาและการยืนยันโดยเภสัชกรยังไม่เชื่อมต่อ</p>
    </div>
  </article>;
}

function DraftEditor({ record, service, onUpdate }: { record: DemoRecord; service: RecordsDemoRepository; onUpdate: (record: DemoRecord, message: string) => void }) {
  const original: RecordDraft = { diagnosis: record.diagnosis, advice: record.advice, prescriptions: record.prescriptions.map(item => ({ name: item.name, quantity: item.ordered, unit: item.unit, instructions: item.instructions })) };
  const [draft, setDraft] = useState(original);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const lastMedicineRef = useRef<HTMLInputElement>(null);
  const previousItemCount = useRef(draft.prescriptions.length);

  useEffect(() => {
    if (draft.prescriptions.length > previousItemCount.current) lastMedicineRef.current?.focus();
    previousItemCount.current = draft.prescriptions.length;
  }, [draft.prescriptions.length]);

  function handleResult(result: RecordResult, message: string) {
    if (!result.ok) { setError(result.error); return; }
    onUpdate(result.record, message);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    handleResult(service.saveDraft(record.id, draft, record.version), 'บันทึกแบบร่างในหน้าตัวอย่างแล้ว');
  }

  function changeItem(index: number, values: Partial<RecordDraft['prescriptions'][number]>) {
    setDraft(current => ({ ...current, prescriptions: current.prescriptions.map((item, at) => at === index ? { ...item, ...values } : item) }));
  }

  return <form onSubmit={save} noValidate className="space-y-5" aria-label="บันทึกผลตรวจตัวอย่าง">
    <div><label htmlFor="record-diagnosis" className={labelClass}>ผลวินิจฉัย <span className="font-normal text-slate-400">(ต้องมี ก่อนปิดตรวจ)</span></label><textarea id="record-diagnosis" value={draft.diagnosis} onChange={event => setDraft({ ...draft, diagnosis: event.target.value })} className={textareaClass} placeholder="บันทึกผลวินิจฉัยตัวอย่าง" /></div>
    <div><label htmlFor="record-advice" className={labelClass}>คำแนะนำหลังตรวจ</label><textarea id="record-advice" value={draft.advice} onChange={event => setDraft({ ...draft, advice: event.target.value })} className={textareaClass} placeholder="บันทึกคำแนะนำตัวอย่าง" /></div>
    <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">รายการยาตัวอย่าง</h3><button type="button" className={secondaryButtonClass} onClick={() => setDraft({ ...draft, prescriptions: [...draft.prescriptions, { name: '', quantity: 1, unit: 'เม็ด', instructions: '' }] })}><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มรายการยา</button></div>{draft.prescriptions.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm leading-6 text-slate-400">ยังไม่มีรายการยา<br />ปิดตรวจโดยไม่สั่งยาได้</p>}<div className="space-y-3">{draft.prescriptions.map((item, index) => <fieldset key={index} className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-xs text-slate-500">รายการที่ {index + 1}</legend><div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label htmlFor={`rx-name-${index}`} className={labelClass}>ชื่อยาตัวอย่าง</label><input id={`rx-name-${index}`} ref={index === draft.prescriptions.length - 1 ? lastMedicineRef : undefined} value={item.name} onChange={event => changeItem(index, { name: event.target.value })} className={inputClass} placeholder="เช่น ยาตัวอย่าง A" /></div><div><label htmlFor={`rx-quantity-${index}`} className={labelClass}>จำนวน</label><input id={`rx-quantity-${index}`} type="number" min="1" max="999" step="1" value={Number.isNaN(item.quantity) ? '' : item.quantity} onChange={event => changeItem(index, { quantity: event.target.value === '' ? Number.NaN : Number(event.target.value) })} className={inputClass} /></div><div><label htmlFor={`rx-unit-${index}`} className={labelClass}>หน่วย</label><input id={`rx-unit-${index}`} value={item.unit} onChange={event => changeItem(index, { unit: event.target.value })} className={inputClass} /></div><div className="sm:col-span-2"><label htmlFor={`rx-instructions-${index}`} className={labelClass}>คำสั่งใช้ตัวอย่าง</label><input id={`rx-instructions-${index}`} value={item.instructions} onChange={event => changeItem(index, { instructions: event.target.value })} className={inputClass} placeholder="ข้อมูลสมมติสำหรับสาธิต" /></div></div><button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-500" aria-label={`ลบรายการยาที่ ${index + 1}`} onClick={() => setDraft({ ...draft, prescriptions: draft.prescriptions.filter((_, at) => at !== index) })}><Trash2 className="h-4 w-4" aria-hidden="true" />ลบรายการ</button></fieldset>)}</div></section>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</p>}
    <div className="border-t border-slate-100 pt-4"><p className="mb-3 text-xs leading-5 text-slate-500">บันทึกแบบร่างก่อนปิดตรวจ ผู้ป่วยจะเห็นผลหลังปิดตรวจในตัวอย่างนี้</p><div className="flex flex-wrap gap-3"><button type="submit" className={secondaryButtonClass}><Pencil className="h-4 w-4" aria-hidden="true" />บันทึกแบบร่าง</button><button type="button" disabled={dirty} onClick={() => handleResult(service.complete(record.id, record.version), 'ปิดตรวจในหน้าตัวอย่างแล้ว · ผู้ป่วยเจ้าของผลตรวจจะเห็นรายการนี้')} className={primaryButtonClass}><CheckCheck className="h-4 w-4" aria-hidden="true" />ปิดตรวจ</button></div>{dirty && <p className="mt-3 text-xs text-amber-700">มีข้อมูลที่ยังไม่บันทึก</p>}</div>
  </form>;
}

function Prescription({ item, record, canEdit, service, onUpdate }: { item: DemoPrescriptionItem; record: DemoRecord; canEdit: boolean; service: RecordsDemoRepository; onUpdate: (record: DemoRecord, message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(item.ordered - item.dispensed));
  const [instructions, setInstructions] = useState(item.instructions);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const pending = item.ordered - item.dispensed;
  const quantityRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) quantityRef.current?.focus();
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function save(event: FormEvent) {
    event.preventDefault();
    const result = service.amendPending(record.id, item.id, { quantity: quantity.trim() ? Number(quantity) : Number.NaN, instructions, reason }, record.version);
    if (!result.ok) { setError(result.error); return; }
    onUpdate(result.record, 'บันทึกการแก้ส่วนค้างในหน้าตัวอย่างแล้ว · ยังไม่ได้ส่งต่อให้เภสัชกร');
  }

  return <div className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-words text-sm font-semibold">{item.name}</h4><span className={`rounded-full px-2 py-1 text-xs ${pending ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{pending ? 'มีส่วนค้าง' : 'จ่ายครบแล้ว'}</span></div>
    <dl className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><div><dt className="text-xs text-slate-400">สั่งทั้งหมด</dt><dd className="mt-1 text-lg font-semibold">{item.ordered}</dd></div><div><dt className="text-xs text-slate-400">จ่ายแล้ว</dt><dd className="mt-1 text-lg font-semibold text-emerald-600">{item.dispensed}</dd></div><div><dt className="text-xs text-slate-400">ค้างจ่าย</dt><dd className="mt-1 text-lg font-semibold text-amber-600">{pending}</dd></div></dl><p className="text-xs text-slate-400">หน่วย: {item.unit}</p>
    {item.dispensed > 0 && <div className="mt-3 flex items-start gap-2 text-xs leading-6 text-slate-500"><LockKeyhole className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><p>ส่วนที่จ่ายแล้วล็อกไว้: {item.dispensed} {item.unit}<br />{item.dispensedInstructions}</p></div>}
    {pending > 0 && <p className="mt-3 break-words text-sm leading-6 text-slate-500">คำสั่งใช้ส่วนค้าง: {item.instructions}</p>}
    {canEdit && pending > 0 && !editing && <button type="button" ref={editButtonRef} className={`${secondaryButtonClass} mt-4`} onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden="true" />แก้ไขส่วนค้าง</button>}
    {editing && <form noValidate onSubmit={save} className="mt-4 space-y-4 border-t border-slate-100 pt-4" aria-label={`แก้ไขส่วนค้าง ${item.name}`}><div><label htmlFor={`pending-${item.id}`} className={labelClass}>จำนวนค้างใหม่ ({item.unit})</label><input id={`pending-${item.id}`} ref={quantityRef} type="number" min="0" max="999" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} className={inputClass} /></div><div><label htmlFor={`instructions-${item.id}`} className={labelClass}>คำสั่งใช้สำหรับส่วนค้าง</label><textarea id={`instructions-${item.id}`} value={instructions} onChange={event => setInstructions(event.target.value)} className={textareaClass} /></div><div><label htmlFor={`reason-${item.id}`} className={labelClass}>เหตุผลการแก้ไข <span className="text-rose-500">*</span></label><textarea id={`reason-${item.id}`} required value={reason} onChange={event => setReason(event.target.value)} className={textareaClass} placeholder="ระบุเหตุผลเพื่อเก็บในประวัติ" /></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="flex flex-wrap gap-2"><button type="submit" className={primaryButtonClass}>บันทึกการแก้ไข</button><button type="button" className={secondaryButtonClass} onClick={() => { setEditing(false); setError(''); setQuantity(String(pending)); setInstructions(item.instructions); setReason(''); }}>ยกเลิก</button></div></form>}
  </div>;
}
