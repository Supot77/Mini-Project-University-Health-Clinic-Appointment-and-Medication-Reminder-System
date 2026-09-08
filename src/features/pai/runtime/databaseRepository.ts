import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { recordInputSchema, roleSchema, snapshotSchema, type PaiAction, type PaiRepository, type PaiRole, type RecordInput } from './contract';

/** Uses the logged-in user's client. All writes are atomic and checked again by RPC. */
export function createPaiDatabaseRepository(client: SupabaseClient, expectedRole: PaiRole): PaiRepository {
  async function actor(allowed: PaiRole[]) {
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
      return parsed.data;
    },
    async book(slotId, reason) {
      z.string().uuid().parse(slotId);
      const text = z.string().trim().min(1, 'กรุณากรอกอาการหรือเหตุผล').max(2000).parse(reason);
      await actor(['patient']);
      await rpc('pai_book_appointment', { p_slot_id: slotId, p_reason: text });
    },
    async transition(appointmentId: string, action: PaiAction, reason?: string) {
      z.string().uuid().parse(appointmentId);
      z.enum(['confirmed', 'rejected', 'in_progress', 'completed', 'cancelled', 'request_cancel']).parse(action);
      const parsedReason = action === 'rejected' ? z.string().trim().min(1, 'กรุณาระบุเหตุผลการปฏิเสธ').max(2000).parse(reason) : null;
      const roles: PaiRole[] = action === 'request_cancel' ? ['patient'] : ['in_progress', 'completed'].includes(action) ? ['medical', 'staff_admin'] : ['staff_admin'];
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
