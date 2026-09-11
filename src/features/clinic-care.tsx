'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileHeart, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export const inputClass = 'min-h-11 w-full rounded-xl border border-brand-border-soft bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-strong focus:ring-4 focus:ring-brand-soft disabled:bg-brand-surface';
export const primaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-strong px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-40';
export const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border-soft bg-white px-4 py-2 text-sm font-medium text-brand-hover transition hover:bg-brand-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-40';

export const roleSchema = z.enum(['patient', 'medical', 'staff_admin']);
export type ClinicRole = z.infer<typeof roleSchema>;
export const appointmentStateSchema = z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected', 'no_show']);
export const prescriptionSchema = z.object({
  medication_id: z.string().uuid(), name: z.string().trim().min(1),
  dosage: z.string().trim().min(1).max(500), frequency: z.string().trim().min(1).max(500),
  duration_days: z.number().int().min(1).max(365), quantity: z.number().int().min(1).max(100000),
});
export const recordInputSchema = z.object({
  appointmentId: z.string().uuid(), diagnosis: z.string().trim().min(1, 'กรุณากรอกผลวินิจฉัย').max(5000),
  advice: z.string().trim().max(5000), prescriptions: z.array(prescriptionSchema).max(50), complete: z.boolean(),
}).refine((value) => new Set(value.prescriptions.map((prescription) => prescription.medication_id)).size === value.prescriptions.length, 'รายการยาซ้ำ');
export type RecordInput = z.infer<typeof recordInputSchema>;
export const snapshotSchema = z.object({
  actor: z.object({ id: z.string().uuid(), role: roleSchema }),
  departments: z.array(z.string()).optional(),
  slots: z.array(z.object({
    id: z.string().uuid(), doctor_id: z.string().uuid(), doctor: z.string(), department: z.string(),
    slot_date: z.string(), start_time: z.string(), end_time: z.string(), max_capacity: z.number(),
    booked_count: z.number(), status: z.string(), bookable: z.boolean(),
  })),
  appointments: z.array(z.object({
    id: z.string().uuid(), user_id: z.string().uuid(), patient: z.string(), slot_id: z.string().uuid(),
    patient_phone: z.string().nullable().optional(),
    queue_number: z.number().nullable(), reason: z.string().nullable(), status: appointmentStateSchema,
    cancel_requested_at: z.string().nullable(), rejection_reason: z.string().nullable(), has_record: z.boolean(),
  })),
  records: z.array(z.object({
    id: z.string().uuid(), appointment_id: z.string().uuid(), patient_id: z.string().uuid(), doctor_id: z.string().uuid(),
    patient: z.string(), doctor: z.string(), diagnosis: z.string().nullable(), treatment_notes: z.string().nullable(),
    prescribed_medications: z.array(prescriptionSchema).nullable(), created_at: z.string(), completed: z.boolean(),
  })),
  medications: z.array(z.object({ id: z.string().uuid(), name: z.string(), type: z.string() })),
});
export type ClinicSnapshot = z.infer<typeof snapshotSchema>;
export type ClinicAppointment = ClinicSnapshot['appointments'][number];
export type ClinicAction = 'confirmed' | 'rejected' | 'in_progress' | 'completed' | 'cancelled' | 'request_cancel';
export interface ClinicRepository {
  load(): Promise<ClinicSnapshot>;
  book(slotId: string, reason: string): Promise<void>;
  transition(appointmentId: string, action: ClinicAction, reason?: string): Promise<void>;
  saveRecord(input: RecordInput): Promise<void>;
}

export function allowedActions(
  role: ClinicRole,
  appointment: ClinicAppointment,
  slot?: { slot_date: string; start_time: string },
  currentDate?: string,
  currentTime?: string,
): ClinicAction[] {
  if (role === 'patient') return ['pending', 'confirmed'].includes(appointment.status) && !appointment.cancel_requested_at ? ['request_cancel'] : [];
  if (role === 'medical') {
    if (appointment.status === 'confirmed') {
      if (slot && !isSlotArrived(slot.slot_date, slot.start_time, currentDate, currentTime)) return [];
      return ['in_progress'];
    }
    return appointment.status === 'in_progress' && appointment.has_record ? ['completed'] : [];
  }
  if (appointment.status === 'pending') return ['confirmed', 'rejected', 'cancelled'];
  if (appointment.status === 'confirmed') {
    if (slot && !isSlotArrived(slot.slot_date, slot.start_time, currentDate, currentTime)) return ['cancelled'];
    return ['in_progress', 'cancelled'];
  }
  if (appointment.status === 'in_progress' && appointment.has_record) return ['completed'];
  return [];
}

export const actionLabels: Record<ClinicAction, string> = {
  confirmed: 'อนุมัตินัด', rejected: 'ปฏิเสธนัด', in_progress: 'เริ่มตรวจ', completed: 'จบตรวจ',
  cancelled: 'ยกเลิกนัด', request_cancel: 'ขอยกเลิกนัด',
};
export function bangkokDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function bangkokTime(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}
export function isSlotArrived(slotDate: string, startTime: string, currentDate?: string, currentTime?: string): boolean {
  const effectiveDate = currentDate ?? bangkokDate();
  if (slotDate < effectiveDate) return true;
  if (slotDate > effectiveDate) return false;
  const effectiveTime = currentTime ?? bangkokTime();
  return effectiveTime >= startTime.slice(0, 5);
}

/** Database adapter for the logged-in user's session. RPCs keep their existing database names for compatibility. */
export function createClinicDatabaseRepository(client: SupabaseClient, expectedRole: ClinicRole): ClinicRepository {
  async function actor(allowed: ClinicRole[]) {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
    const profile = await client.from('profiles').select('role, is_active').eq('id', data.user.id).single();
    const role = roleSchema.safeParse(profile.data?.role);
    if (profile.error || !role.success || profile.data?.is_active !== true || role.data !== expectedRole || !allowed.includes(role.data)) {
      throw new Error('ไม่มีสิทธิ์ทำรายการนี้ กรุณาเข้าสู่ระบบด้วยบัญชีที่ถูกต้อง');
    }
    return { id: data.user.id, role: role.data };
  }
  async function rpc(name: string, args?: Record<string, unknown>) {
    const result = await client.rpc(name, args);
    if (result.error) {
      if (result.error.code === 'P0001') throw new Error(result.error.message);
      if (result.error.code === 'PGRST202' || result.error.code === '42883') throw new Error('ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลเพื่อติดตั้งส่วนบริการนัดหมาย');
      throw new Error('ไม่สามารถทำรายการได้ กรุณาโหลดข้อมูลใหม่ก่อนลองอีกครั้ง');
    }
    return result.data;
  }
  return {
    async load() {
      const current = await actor(['patient', 'medical', 'staff_admin']);
      const parsed = snapshotSchema.safeParse(await rpc('pai_workspace'));
      if (!parsed.success || parsed.data.actor.id !== current.id || parsed.data.actor.role !== current.role) throw new Error('ข้อมูลไม่ตรงกับบัญชีปัจจุบัน กรุณาโหลดใหม่');
      const departments = await client.from('departments').select('name').eq('is_active', true).order('name');
      if (departments.error) throw new Error('ไม่สามารถโหลดรายการบริการได้ กรุณาลองใหม่อีกครั้ง');
      parsed.data.departments = z.array(z.object({ name: z.string().trim().min(1) })).parse(departments.data).map((item) => item.name);
      if (current.role !== 'patient' && parsed.data.appointments.length) {
        const patientIds = [...new Set(parsed.data.appointments.map((appointment) => appointment.user_id))];
        const profiles = await client.from('profiles').select('id, phone').in('id', patientIds);
        if (profiles.error) throw new Error('ไม่สามารถโหลดเบอร์โทรผู้ป่วยได้ กรุณาโหลดข้อมูลใหม่');
        const phones = z.array(z.object({ id: z.string().uuid(), phone: z.string().nullable() })).parse(profiles.data);
        const byId = new Map(phones.map((phone) => [phone.id, phone.phone]));
        parsed.data.appointments = parsed.data.appointments.map((appointment) => ({ ...appointment, patient_phone: byId.get(appointment.user_id) ?? null }));
      }
      return parsed.data;
    },
    async book(slotId, reason) {
      z.string().uuid().parse(slotId);
      const text = z.string().trim().min(1, 'กรุณากรอกอาการหรือเหตุผล').max(2000).parse(reason);
      await actor(['patient']);
      await rpc('pai_book_appointment', { p_slot_id: slotId, p_reason: text });
    },
    async transition(appointmentId: string, action: ClinicAction, reason?: string) {
      z.string().uuid().parse(appointmentId);
      z.enum(['confirmed', 'rejected', 'in_progress', 'completed', 'cancelled', 'request_cancel']).parse(action);
      const parsedReason = action === 'rejected' ? z.string().trim().min(1, 'กรุณาระบุเหตุผลการปฏิเสธ').max(2000).parse(reason) : null;
      const roles: ClinicRole[] = action === 'request_cancel' ? ['patient'] : ['in_progress', 'completed'].includes(action) ? ['medical', 'staff_admin'] : ['staff_admin'];
      await actor(roles);
      await rpc('pai_transition_appointment', { p_appointment_id: appointmentId, p_action: action, p_reason: parsedReason });
    },
    async saveRecord(input: RecordInput) {
      const parsed = recordInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      await actor(['medical']);
      await rpc('pai_save_record', { p_appointment_id: parsed.data.appointmentId, p_diagnosis: parsed.data.diagnosis, p_advice: parsed.data.advice, p_prescriptions: parsed.data.prescriptions, p_complete: parsed.data.complete });
    },
  };
}

/** Explicit test/offline adapter; production composition uses the database adapter above. */
export function createClinicMockRepository(seed: ClinicSnapshot, now = new Date('2026-09-08T08:00:00+07:00')): ClinicRepository {
  const state = structuredClone(seed);
  let sequence = 100;
  const id = () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;
  const ownAppointment = (appointment: ClinicSnapshot['appointments'][number]) => state.actor.role === 'staff_admin' ||
    (state.actor.role === 'patient' ? appointment.user_id === state.actor.id : state.slots.some((slot) => slot.id === appointment.slot_id && slot.doctor_id === state.actor.id));
  function requireRole(role: ClinicRole) { if (state.actor.role !== role) throw new Error('ไม่มีสิทธิ์ทำรายการนี้'); }
  return {
    async load() {
      const result = structuredClone(state);
      result.appointments = result.appointments.filter(ownAppointment);
      result.records = result.records.filter((record) => state.actor.role === 'patient' ? record.patient_id === state.actor.id && record.completed :
        state.actor.role === 'medical' && (record.doctor_id === state.actor.id || (record.completed && result.appointments.some((appointment) => appointment.user_id === record.patient_id && ['confirmed', 'in_progress', 'completed'].includes(appointment.status)))));
      if (state.actor.role !== 'medical') result.medications = [];
      return result;
    },
    async book(slotId, reason) {
      requireRole('patient');
      if (!reason.trim() || reason.trim().length > 2000) throw new Error('กรุณากรอกอาการหรือเหตุผลไม่เกิน 2000 ตัวอักษร');
      const slot = state.slots.find((item) => item.id === slotId);
      if (!slot || !slot.bookable || slot.status !== 'available' || new Date(`${slot.slot_date}T${slot.start_time}+07:00`) <= now) throw new Error('รอบตรวจนี้ไม่เปิดรับจอง');
      const active = state.appointments.filter((appointment) => appointment.slot_id === slotId && !['cancelled', 'rejected', 'no_show'].includes(appointment.status));
      if (active.some((appointment) => appointment.user_id === state.actor.id)) throw new Error('มีนัดในรอบนี้แล้ว');
      const occupied = Math.max(slot.booked_count, active.length);
      if (occupied >= slot.max_capacity) throw new Error('รอบตรวจเต็มแล้ว');
      const queue = Math.max(0, ...state.appointments.filter((appointment) => appointment.slot_id === slotId).map((appointment) => appointment.queue_number ?? 0)) + 1;
      state.appointments.push({ id: id(), user_id: state.actor.id, patient: 'ผู้ป่วยทดสอบ', slot_id: slotId, queue_number: queue, reason: reason.trim(), status: 'pending', cancel_requested_at: null, rejection_reason: null, has_record: false });
      slot.booked_count = occupied + 1;
    },
    async transition(appointmentId, action, reason) {
      const appointment = state.appointments.find((item) => item.id === appointmentId);
      const slot = appointment ? state.slots.find((item) => item.id === appointment.slot_id) : undefined;
      if (action === 'in_progress' && slot && !isSlotArrived(slot.slot_date, slot.start_time, bangkokDate(now), bangkokTime(now))) throw new Error('ยังไม่ถึงเวลารอบตรวจ');
      if (!appointment || !ownAppointment(appointment) || !allowedActions(state.actor.role, appointment, slot, bangkokDate(now), bangkokTime(now)).includes(action)) throw new Error('ไม่มีสิทธิ์หรือสถานะไม่อนุญาต');
      if (action === 'rejected' && !reason?.trim()) throw new Error('กรุณาระบุเหตุผลการปฏิเสธ');
      if (action === 'request_cancel') appointment.cancel_requested_at = now.toISOString();
      else {
        appointment.status = action;
        if (action === 'rejected') appointment.rejection_reason = reason!.trim();
        if (action === 'cancelled' || action === 'rejected') {
          const appointmentSlot = state.slots.find((item) => item.id === appointment.slot_id)!;
          appointmentSlot.booked_count = Math.max(0, appointmentSlot.booked_count - 1);
        }
        if (action === 'completed') state.records.filter((record) => record.appointment_id === appointment.id).forEach((record) => { record.completed = true; });
      }
    },
    async saveRecord(input) {
      requireRole('medical');
      const parsed = recordInputSchema.parse(input);
      const appointment = state.appointments.find((item) => item.id === parsed.appointmentId);
      if (!appointment || !ownAppointment(appointment) || appointment.status !== 'in_progress' || appointment.has_record) throw new Error('ต้องเป็นนัดของตนที่กำลังตรวจและยังไม่มีผลตรวจ');
      const items = parsed.prescriptions.map((prescription) => {
        const medication = state.medications.find((item) => item.id === prescription.medication_id);
        if (!medication) throw new Error('ไม่พบยาหรือยาถูกปิดใช้งาน');
        return { ...prescription, name: medication.name };
      });
      state.records.push({ id: id(), appointment_id: appointment.id, patient_id: appointment.user_id, doctor_id: state.actor.id,
        patient: appointment.patient, doctor: 'แพทย์ทดสอบ', diagnosis: parsed.diagnosis, treatment_notes: parsed.advice,
        prescribed_medications: items, created_at: now.toISOString(), completed: parsed.complete });
      appointment.has_record = true;
      if (parsed.complete) appointment.status = 'completed';
    },
  };
}

export function useClinicWorkspace(role: ClinicRole, injected?: ClinicRepository) {
  const [data, setData] = useState<ClinicSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const repo = useRef<ClinicRepository | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const repository = useCallback(() => {
    if (injected) return injected;
    if (!repo.current) repo.current = createClinicDatabaseRepository(createClient(), role);
    return repo.current;
  }, [role, injected]);
  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const next = await repository().load();
      if (next.actor.role !== role) throw new Error('บัญชีปัจจุบันไม่มีสิทธิ์เปิดหน้านี้');
      if (ticket === generation.current) setData(next);
    } catch (errorValue) {
      if (ticket === generation.current) setError(errorValue instanceof Error ? errorValue.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally { if (ticket === generation.current) setLoading(false); }
  }, [repository, role]);
  useEffect(() => {
    let active = true;
    const ticket = ++generation.current;
    async function initialize() {
      try {
        const next = await repository().load();
        if (next.actor.role !== role) throw new Error('บัญชีปัจจุบันไม่มีสิทธิ์เปิดหน้านี้');
        if (active && ticket === generation.current) setData(next);
      } catch (errorValue) {
        if (active && ticket === generation.current) setError(errorValue instanceof Error ? errorValue.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally { if (active && ticket === generation.current) setLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [repository, role]);
  async function run(command: (repository: ClinicRepository) => Promise<void>, success: string) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await command(repository());
      setMessage(success);
      await reload();
      return true;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'ทำรายการไม่สำเร็จ กรุณาโหลดใหม่ก่อนลองอีกครั้ง');
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  return { data, loading, busy, error, message, reload, run };
}

export interface WorkspaceHeaderStat {
  label: string;
  value: number | string;
  tone: 'default' | 'success' | 'info' | 'warning' | 'danger';
}

export function ClinicWorkspaceShell({ role, section, error, message, busy, reload, children, stats }: {
  role: ClinicRole; section: 'appointments' | 'records'; error: string; message: string; busy: boolean;
  reload: () => Promise<void>; children: ReactNode; stats?: WorkspaceHeaderStat[];
}) {
  const roleLabel = role === 'patient' ? 'ผู้ป่วย' : role === 'medical' ? 'แพทย์/เภสัชกร' : 'เจ้าหน้าที่/แอดมิน';
  const title = section === 'appointments' ? 'นัดหมายและคิวตรวจ' : 'ผลตรวจและรายการยา';
  return <section className="mx-auto max-w-6xl space-y-5 text-slate-800">
    <header className="relative overflow-hidden rounded-3xl border border-brand-border-soft bg-white shadow-sm">
      <div className="absolute inset-y-3 left-0 w-2 rounded-r-full bg-brand" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl"><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-status-success-bg px-3 py-1.5 text-xs font-semibold text-status-success"><span className="h-2 w-2 rounded-full bg-status-success" aria-hidden="true" />LIVE DATABASE</span><span className="text-xs font-semibold tracking-wide text-brand-muted">ASIA/BANGKOK</span></div>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brand-strong"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> WU CLINIC · {roleLabel}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brand-muted">{role === 'patient' ? 'จัดการนัดหมายและติดตามข้อมูลการรักษาของคุณได้ในที่เดียว' : role === 'medical' ? 'ดูคิวที่รับผิดชอบและบันทึกผลตรวจอย่างปลอดภัย' : 'จัดการคำขอนัดและติดตามคิวของผู้รับบริการทีละรายการ'} · ข้อมูลจากระบบปัจจุบัน</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border-soft bg-white px-4 py-2 text-sm font-semibold text-brand-hover transition hover:border-brand-border hover:bg-brand-surface hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} onClick={() => void reload()}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />โหลดข้อมูลใหม่</button>
          {stats && stats.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="min-w-[82px] rounded-2xl border border-brand-border-soft bg-brand-surface/70 px-3 py-3 text-center"><p className={`text-xl font-bold ${stat.tone === 'success' ? 'text-status-success' : stat.tone === 'info' ? 'text-status-info' : stat.tone === 'warning' ? 'text-status-warning' : stat.tone === 'danger' ? 'text-status-critical' : 'text-brand-ink'}`}>{stat.value}</p><p className="mt-1 text-[11px] leading-4 text-brand-muted">{stat.label}</p></div>)}</div>}
        </div>
      </div>
    </header>
    <nav aria-label="นัดหมายและผลตรวจ" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <Link href="/appointments" aria-current={section === 'appointments' ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${section === 'appointments' ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><CalendarDays className="h-4 w-4" aria-hidden="true" />นัดหมายและคิว</Link>
      {role !== 'staff_admin' && <Link href="/records" aria-current={section === 'records' ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${section === 'records' ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><FileHeart className="h-4 w-4" aria-hidden="true" />ผลตรวจและรายการยา</Link>}
    </nav>
    {error && <p role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />{error}</p>}
    {message && <p role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />{message}</p>}
    {children}
  </section>;
}

const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asDate = (value: string) => new Date(`${value}T12:00:00`);
const fullDate = (value: string) => new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(asDate(value));
const pickerButtonStyle = 'flex min-h-11 items-center justify-center rounded-xl transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-40';

export function ClinicDatePicker({ label, value, onChange, min, markedDates = [], disabled = false }: {
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
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + index, 12);
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
        <div className="mb-5 flex items-center justify-between gap-3"><div><p className="mb-1 text-xs font-medium text-brand-body">ปฏิทินนัดหมาย</p><h2 id={`${id}-title`} className="text-lg font-semibold">{label}</h2></div><button type="button" aria-label="ปิดปฏิทิน" onClick={close} className={`${pickerButtonStyle} w-11`}><X className="h-5 w-5" /></button></div>
        <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-brand-surface p-2">
          <button type="button" aria-label="เดือนก่อนหน้า" disabled={Boolean(min && month <= min.slice(0, 7))} onClick={() => moveMonth(-1)} className={`${pickerButtonStyle} w-11`}><ChevronLeft className="h-5 w-5" /></button>
          <p aria-live="polite" className="font-semibold">{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(first)}</p>
          <button type="button" aria-label="เดือนถัดไป" onClick={() => moveMonth(1)} className={`${pickerButtonStyle} w-11`}><ChevronRight className="h-5 w-5" /></button>
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
          <button type="button" className={`${pickerButtonStyle} px-3 text-sm text-brand-body`} onClick={() => choose('')}>ล้างวันที่</button>
          <button type="button" disabled={Boolean(min && today < min)} className={`${pickerButtonStyle} px-4 text-sm font-semibold text-brand-strong`} onClick={() => choose(today)}>วันนี้</button>
        </div>
      </div>
    </dialog>
  </>;
}

export type ClinicSelectOption = { value: string; label: string; disabled?: boolean };
export function ClinicSelect({ value, onChange, options, placeholder, ariaLabel, disabled = false, className = '' }: {
  value: string; onChange: (value: string) => void; options: ClinicSelectOption[]; placeholder: string; ariaLabel: string; disabled?: boolean; className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder;
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  function choose(option: ClinicSelectOption) {
    if (option.disabled) return;
    onChange(option.value); setOpen(false); trigger.current?.focus();
  }
  function moveActive(direction: 1 | -1) {
    if (!options.length) return;
    let next = activeIndex;
    do { next = (next + direction + options.length) % options.length; } while (options[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) setOpen(true); moveActive(event.key === 'ArrowDown' ? 1 : -1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!open) setOpen(true); else if (options[activeIndex]) choose(options[activeIndex]); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setActiveIndex(event.key === 'Home' ? 0 : Math.max(0, options.length - 1)); }
  }
  return <div className="relative min-w-0">
    <button ref={trigger} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
      onClick={() => { setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOpen((current) => !current); }}
      onKeyDown={handleKeyDown} className={`${inputClass} flex items-center justify-between gap-3 text-left transition hover:border-brand-strong focus-visible:ring-4 focus-visible:ring-brand-soft ${className}`}>
      <span className={`min-w-0 truncate ${selected ? 'text-brand-ink' : 'text-brand-muted'}`}>{label}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-brand-muted transition ${open ? 'rotate-180 text-brand-strong' : ''}`} aria-hidden="true" />
    </button>
    {open && <div ref={menu} id={id} role="listbox" aria-label={ariaLabel} className="absolute left-0 top-full z-30 mt-2 max-h-64 w-full min-w-[14rem] overflow-y-auto rounded-2xl border border-brand-border bg-white p-1.5 shadow-xl ring-1 ring-slate-950/5">
      {options.length ? options.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={value === option.value} disabled={option.disabled} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}
        className={`flex min-h-10 w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${value === option.value ? 'bg-brand-soft font-semibold text-brand-strong' : index === activeIndex ? 'bg-brand-surface text-brand-ink' : 'text-brand-ink hover:bg-brand-surface'} disabled:cursor-not-allowed disabled:text-brand-muted/50`}>{option.label}</button>) : <p className="px-3 py-2 text-sm text-brand-muted">ไม่มีตัวเลือก</p>}
    </div>}
  </div>;
}

export function ClinicPageLoading() {
  return <div role="status" aria-label="กำลังโหลดหน้าบริการ" className="space-y-6">
    <p className="text-sm text-slate-500">กำลังโหลดหน้าบริการ…</p>
    <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
      <div className="h-12 rounded-xl bg-slate-100" />
      <div className="h-10 w-2/3 rounded-xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-2xl bg-slate-100" />)}</div>
      <div className="h-80 rounded-2xl border border-slate-100 bg-white" />
    </div>
  </div>;
}
