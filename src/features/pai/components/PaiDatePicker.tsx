'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { bangkokDate } from '../runtime/contract';

const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asDate = (value: string) => new Date(`${value}T12:00:00`);
const fullDate = (value: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(asDate(value));
const buttonStyle = 'flex min-h-11 items-center justify-center rounded-xl transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-40';

/** Pai-only date UI. The parent still owns ISO date values and booking/filter rules. */
export default function PaiDatePicker({ label, value, onChange, min, markedDates = [], disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; min?: string; markedDates?: string[]; disabled?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const today = bangkokDate();
  const initial = value || (min && today < min ? min : today);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [focused, setFocused] = useState(initial);
  const first = asDate(`${month}-01`);
  const marked = new Set(markedDates);
  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i, 12);
    return { date, iso: dateValue(date) };
  });
  function close() { dialog.current?.close(); trigger.current?.focus(); }
  function choose(next: string) { onChange(next); close(); }
  function open() {
    setMonth(initial.slice(0, 7)); setFocused(initial);
    dialog.current?.showModal();
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${initial}"]`)?.focus());
  }
  function moveMonth(offset: number) {
    const next = dateValue(new Date(first.getFullYear(), first.getMonth() + offset, 1, 12));
    setMonth(next.slice(0, 7)); setFocused(min && next < min && min.startsWith(next.slice(0, 7)) ? min : next);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = asDate(iso); next.setDate(next.getDate() + offsets[event.key]);
    const nextValue = dateValue(next);
    if (min && nextValue < min) return;
    setMonth(nextValue.slice(0, 7)); setFocused(nextValue);
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${nextValue}"]`)?.focus());
  }
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="dialog" onClick={open}
      className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-brand-border-strong bg-white px-3 py-2.5 text-left text-sm text-brand-ink shadow-sm transition hover:border-brand-strong hover:bg-brand-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50">
      <CalendarDays className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden="true" /><span className="truncate">{value ? fullDate(value) : 'เลือกวันที่'}</span>
    </button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-brand-border bg-white p-0 text-brand-ink shadow-2xl backdrop:bg-brand-ink/30 backdrop:backdrop-blur-sm">
      <div className="p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="mb-1 text-xs font-medium text-brand-body">ปฏิทินนัดหมาย</p><h2 id={`${id}-title`} className="text-lg font-semibold">{label}</h2></div><button type="button" aria-label="ปิดปฏิทิน" onClick={close} className={`${buttonStyle} w-11`}><X className="h-5 w-5" /></button></div>
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-brand-surface p-2">
          <button type="button" aria-label="เดือนก่อนหน้า" disabled={Boolean(min && month <= min.slice(0, 7))} onClick={() => moveMonth(-1)} className={`${buttonStyle} w-11`}><ChevronLeft className="h-5 w-5" /></button>
          <p aria-live="polite" className="font-semibold">{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(first)}</p>
          <button type="button" aria-label="เดือนถัดไป" onClick={() => moveMonth(1)} className={`${buttonStyle} w-11`}><ChevronRight className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-brand-body" aria-hidden="true">{['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="วันที่ในปฏิทิน">{days.map(({ date, iso }) => {
          const selected = value === iso;
          return <button key={iso} type="button" data-date={iso} disabled={Boolean(min && iso < min)} tabIndex={focused === iso ? 0 : -1}
            aria-label={`${fullDate(iso)}${marked.has(iso) ? ' มีนัดหมาย' : ''}`} aria-pressed={selected} aria-current={iso === today ? 'date' : undefined}
            onKeyDown={(event) => navigate(event, iso)} onFocus={() => setFocused(iso)} onClick={() => choose(iso)}
            className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl text-sm transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-strong active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${selected ? 'bg-brand-strong font-semibold text-white shadow-md hover:bg-brand-hover' : `${iso.startsWith(month) ? 'text-brand-ink' : 'text-brand-body'} ${marked.has(iso) ? 'bg-brand-soft' : 'bg-white'} hover:bg-brand-soft ${iso === today ? 'ring-1 ring-inset ring-brand-strong' : ''}`}`}>
            {date.getDate()}{marked.has(iso) && <span aria-hidden="true" className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-brand-strong'}`} />}
          </button>;
        })}</div>
        <p className="mt-4 flex items-center gap-2 text-xs text-brand-body"><span className="h-1.5 w-1.5 rounded-full bg-brand-strong" aria-hidden="true" />วันที่มีนัดหมาย</p>
        <div className="mt-4 flex items-center justify-between border-t border-brand-border-soft pt-3">
          <button type="button" className={`${buttonStyle} px-3 text-sm text-brand-body`} onClick={() => choose('')}>ล้างวันที่</button>
          <button type="button" disabled={Boolean(min && today < min)} className={`${buttonStyle} px-4 text-sm font-semibold text-brand-strong`} onClick={() => choose(today)}>วันนี้</button>
        </div>
      </div>
    </dialog>
  </>;
}
