import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DoctorAccountOption,
  DoctorWeeklySchedule,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleSlot,
  ScheduleSlotStatus,
} from '@/types/schedule';
import type { UserRole } from '@/types/database';
import type { ShopResult, SlotInput } from '../domain/rules';
import {
  deriveSlotStatus,
  validateDepartmentName,
  validateSlot,
} from '../domain/rules';

export interface DatabaseShopSnapshot {
  departments: ScheduleDepartment[];
  doctors: ScheduleDoctor[];
  slots: ScheduleSlot[];
  doctorAccounts: DoctorAccountOption[];
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export class DatabaseShopRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchDepartments(): Promise<ScheduleDepartment[]> {
    const { data, error } = await this.client
      .from('departments')
      .select('id, name, description, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (error || !data) {
      console.error('Error fetching departments:', error);
      return [];
    }

    return data.map((row: { id: string; name: string; description: string | null; is_active: boolean }) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      isActive: row.is_active ?? true,
      hasHistory: true,
    }));
  }

  async fetchDoctors(): Promise<ScheduleDoctor[]> {
    const { data, error } = await this.client
      .from('doctors')
      .select(`
        id,
        specialty,
        department_id,
        profile:profiles!doctors_id_fkey (
          id,
          full_name,
          role,
          is_active
        )
      `)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.error('Error fetching doctors:', error);
      return [];
    }

    interface DoctorRow {
      id: string;
      specialty: string | null;
      department_id: string | null;
      profile:
        | {
            id: string;
            full_name: string;
            role: string;
            is_active: boolean;
          }
        | Array<{
            id: string;
            full_name: string;
            role: string;
            is_active: boolean;
          }>
        | null;
    }

    return (data as unknown as DoctorRow[]).map((row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      const rawFullName = profile?.full_name?.trim();
      const fullName = rawFullName || 'ไม่ระบุชื่อ';
      const initials = rawFullName
        ? rawFullName
            .split(' ')
            .map((part: string) => part[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'DR'
        : 'DR';

      return {
        id: row.id,
        profileId: row.id,
        fullName,
        email: '',
        initials,
        specialty: row.specialty ?? '',
        departmentId: row.department_id ?? '',
        availability: profile?.is_active === false ? ('inactive' as const) : ('active' as const),
        hasHistory: true,
      };
    });
  }

  async fetchDoctorAccounts(): Promise<DoctorAccountOption[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('role', 'medical')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error || !data) {
      console.error('Error fetching doctor accounts:', error);
      return [];
    }

    return data.map((row: { id: string; full_name: string }) => {
      const initials = row.full_name
        .split(' ')
        .map((part: string) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'MD';

      return {
        profileId: row.id,
        fullName: row.full_name,
        email: '',
        initials,
      };
    });
  }

  async saveDepartment(
    input: Omit<ScheduleDepartment, 'id' | 'isActive'>,
    existingDepartments: ScheduleDepartment[],
    id?: string,
  ): Promise<ShopResult<ScheduleDepartment>> {
    const validation = validateDepartmentName(input.name, input.code, existingDepartments, id);
    if (!validation.ok) return validation;

    if (id) {
      const { data, error } = await this.client
        .from('departments')
        .update({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, name, description, is_active')
        .single();

      if (error) return { ok: false, error: error.message || 'ไม่สามารถแก้ไขแผนกได้' };
      return {
        ok: true,
        value: {
          id: data.id,
          name: data.name,
          description: data.description ?? '',
          isActive: data.is_active ?? true,
        },
      };
    }

    const { data, error } = await this.client
      .from('departments')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_active: true,
      })
      .select('id, name, description, is_active')
      .single();

    if (error) return { ok: false, error: error.message || 'ไม่สามารถเพิ่มแผนกได้' };
    return {
      ok: true,
      value: {
        id: data.id,
        name: data.name,
        description: data.description ?? '',
        isActive: data.is_active ?? true,
      },
    };
  }

  async toggleDepartment(
    id: string,
    currentActive: boolean,
  ): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>> {
    const nextState = !currentActive;
    const { data, error } = await this.client
      .from('departments')
      .update({
        is_active: nextState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, is_active');

    if (error) return { ok: false, error: error.message || 'ไม่สามารถเปลี่ยนสถานะแผนกได้' };
    if (!data || data.length === 0) {
      return { ok: false, error: 'ไม่พบข้อมูลแผนก หรือไม่มีสิทธิ์แก้ไขสถานะ (ต้องเป็น staff_admin)' };
    }
    return { ok: true, value: nextState ? 'enabled' : 'disabled' };
  }

  async saveDoctor(
    input: Omit<ScheduleDoctor, 'id'>,
    existingDoctors: ScheduleDoctor[],
    id?: string,
  ): Promise<ShopResult<ScheduleDoctor>> {
    if (!input.profileId || !input.departmentId || !input.specialty?.trim()) {
      return { ok: false, error: 'เลือกบัญชีแพทย์ แผนก และกรอกความเชี่ยวชาญก่อนบันทึก' };
    }

    if (id) {
      const { error } = await this.client
        .from('doctors')
        .update({
          specialty: input.specialty.trim(),
          department_id: input.departmentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) return { ok: false, error: error.message || 'ไม่สามารถแก้ไขแพทย์ได้' };
      const current = existingDoctors.find((d) => d.id === id);
      return {
        ok: true,
        value: {
          ...input,
          id,
          fullName: current?.fullName ?? input.fullName,
          initials: current?.initials ?? input.initials,
          availability: current?.availability ?? input.availability,
        },
      };
    }

    // Insert new doctor mapping
    const { error } = await this.client
      .from('doctors')
      .insert({
        id: input.profileId,
        specialty: input.specialty.trim(),
        department_id: input.departmentId,
      });

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'บัญชีแพทย์นี้ถูกผูกกับทะเบียนแล้ว', field: 'profileId' };
      }
      return { ok: false, error: error.message || 'ไม่สามารถเพิ่มแพทย์ได้' };
    }

    return {
      ok: true,
      value: {
        ...input,
        id: input.profileId,
        availability: 'active',
      },
    };
  }

  async toggleDoctor(
    id: string,
    currentAvailability: string,
  ): Promise<ShopResult<ScheduleDoctor | 'deleted'>> {
    const nextIsActive = currentAvailability === 'inactive';
    const { data, error } = await this.client
      .from('profiles')
      .update({
        is_active: nextIsActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, is_active');

    if (error) return { ok: false, error: error.message || 'ไม่สามารถเปลี่ยนสถานะแพทย์ได้' };
    if (!data || data.length === 0) {
      return { ok: false, error: 'ไม่พบบัญชีแพทย์ หรือไม่มีสิทธิ์แก้ไขสถานะแพทย์นี้' };
    }

    return {
      ok: true,
      value: {
        id,
        profileId: id,
        fullName: '',
        email: '',
        initials: '',
        specialty: '',
        departmentId: '',
        availability: nextIsActive ? 'active' : 'inactive',
      },
    };
  }

  async fetchSlots(): Promise<ScheduleSlot[]> {
    const { data, error } = await this.client
      .from('appointment_slots')
      .select('id, doctor_id, slot_date, start_time, end_time, max_capacity, booked_count, status, created_at, updated_at')
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error || !data) {
      console.error('Error fetching appointment_slots:', error);
      return [];
    }

    return data.map((row: {
      id: string;
      doctor_id: string;
      slot_date: string;
      start_time: string;
      end_time: string;
      max_capacity: number;
      booked_count: number;
      status: string;
    }) => ({
      id: row.id,
      doctorId: row.doctor_id,
      slotDate: row.slot_date,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      maxCapacity: row.max_capacity,
      bookedCount: row.booked_count ?? 0,
      status: row.status as ScheduleSlotStatus,
      hasHistory: (row.booked_count ?? 0) > 0,
      closedReason: row.status === 'closed' ? ('manual' as const) : undefined,
    }));
  }

  async saveSlot(
    input: SlotInput,
    existingSlots: ScheduleSlot[],
    doctors: ScheduleDoctor[],
    departments: ScheduleDepartment[],
    id?: string,
  ): Promise<ShopResult<ScheduleSlot>> {
    if (!isValidUUID(input.doctorId)) {
      return {
        ok: false,
        error: 'ไอดีแพทย์ไม่ถูกต้อง (เป็นข้อมูลจำลอง Mock ไม่สามารถบันทึกลงฐานข้อมูลจริงได้ กรุณาเลือกแพทย์จริงในระบบ)',
        field: 'doctorId',
      };
    }

    const existing = id ? existingSlots.find((item) => item.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'ไม่พบรอบตรวจที่ต้องการแก้ไข' };
    const bookedCount = existing?.bookedCount ?? 0;
    const valid = validateSlot(input, existingSlots, doctors, departments, id, bookedCount);
    if (!valid.ok) return valid;

    const nextStatus = deriveSlotStatus(bookedCount, input.maxCapacity, existing?.status);

    if (id) {
      const { data, error } = await this.client
        .from('appointment_slots')
        .update({
          doctor_id: input.doctorId,
          slot_date: input.slotDate,
          start_time: input.startTime,
          end_time: input.endTime,
          max_capacity: input.maxCapacity,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, doctor_id, slot_date, start_time, end_time, max_capacity, booked_count, status')
        .single();

      if (error) return { ok: false, error: error.message || 'ไม่สามารถแก้ไขรอบตรวจได้' };
      return {
        ok: true,
        value: {
          id: data.id,
          doctorId: data.doctor_id,
          slotDate: data.slot_date,
          startTime: data.start_time.slice(0, 5),
          endTime: data.end_time.slice(0, 5),
          maxCapacity: data.max_capacity,
          bookedCount: data.booked_count ?? 0,
          status: data.status as ScheduleSlotStatus,
          hasHistory: (data.booked_count ?? 0) > 0,
        },
      };
    }

    const { data, error } = await this.client
      .from('appointment_slots')
      .insert({
        doctor_id: input.doctorId,
        slot_date: input.slotDate,
        start_time: input.startTime,
        end_time: input.endTime,
        max_capacity: input.maxCapacity,
        booked_count: 0,
        status: 'available',
      })
      .select('id, doctor_id, slot_date, start_time, end_time, max_capacity, booked_count, status')
      .single();

    if (error) return { ok: false, error: error.message || 'ไม่สามารถสร้างรอบตรวจได้' };
    return {
      ok: true,
      value: {
        id: data.id,
        doctorId: data.doctor_id,
        slotDate: data.slot_date,
        startTime: data.start_time.slice(0, 5),
        endTime: data.end_time.slice(0, 5),
        maxCapacity: data.max_capacity,
        bookedCount: data.booked_count ?? 0,
        status: data.status as ScheduleSlotStatus,
        hasHistory: false,
      },
    };
  }

  async toggleSlot(
    id: string,
    currentSlot: ScheduleSlot,
    actorId?: string,
    role?: UserRole,
  ): Promise<ShopResult<ScheduleSlot>> {
    if (role === 'medical' && actorId && currentSlot.doctorId !== actorId) {
      return { ok: false, error: 'ไม่มีสิทธิ์จัดการรอบตรวจของแพทย์ท่านอื่น' };
    }

    if (currentSlot.status === 'closed' && currentSlot.closedReason === 'doctor_leave') {
      return { ok: false, error: 'รอบนี้ปิดอัตโนมัติจากวันลา ต้องจัดการที่คำขอวันลา' };
    }

    const nextStatus: ScheduleSlotStatus =
      currentSlot.status === 'closed'
        ? deriveSlotStatus(currentSlot.bookedCount, currentSlot.maxCapacity)
        : 'closed';

    const { data, error } = await this.client
      .from('appointment_slots')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, doctor_id, slot_date, start_time, end_time, max_capacity, booked_count, status')
      .single();

    if (error) return { ok: false, error: error.message || 'ไม่สามารถเปลี่ยนสถานะรอบตรวจได้' };
    return {
      ok: true,
      value: {
        ...currentSlot,
        status: data.status as ScheduleSlotStatus,
        closedReason: data.status === 'closed' ? ('manual' as const) : undefined,
      },
    };
  }

  async generateSlotsForRange(
    startDate: string,
    endDate: string,
    today: string,
    weeklySchedules: DoctorWeeklySchedule[],
    existingSlots: ScheduleSlot[],
  ): Promise<ShopResult<number>> {
    if (!startDate || !endDate || startDate > endDate) {
      return { ok: false, error: 'ช่วงวันที่สร้างรอบไม่ถูกต้อง' };
    }

    const toMinutes = (val: string) => {
      const [h, m] = val.split(':').map(Number);
      return h * 60 + m;
    };
    const fromMinutes = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const clinicWeekday = (val: string) => {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    };
    const shiftDate = (val: string, days: number) => {
      const [y, m, d] = val.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + days));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    };

    const newRows: Array<{
      doctor_id: string;
      slot_date: string;
      start_time: string;
      end_time: string;
      max_capacity: number;
      booked_count: number;
      status: string;
    }> = [];

    const validSchedules = weeklySchedules.filter((s) => s.isActive && isValidUUID(s.doctorId));
    if (validSchedules.length === 0) {
      return {
        ok: false,
        error: 'ไม่พบตารางเวลาของแพทย์ในฐานข้อมูลจริง (ไม่สามารถใช้ตารางจำลอง Mock สร้างรอบตรวจได้ กรุณาเพิ่มแพทย์และตารางเวลาจริงในระบบก่อน)',
      };
    }

    for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) {
      const weekday = clinicWeekday(date);
      if (weekday < 1 || weekday > 5) continue;
      for (const schedule of validSchedules.filter((s) => s.weekday === weekday)) {
        for (
          let minutes = toMinutes(schedule.startTime);
          minutes + schedule.slotDurationMinutes <= toMinutes(schedule.endTime);
          minutes += schedule.slotDurationMinutes
        ) {
          const startTime = fromMinutes(minutes);
          const endTime = fromMinutes(minutes + schedule.slotDurationMinutes);
          const exists =
            existingSlots.some(
              (slot) =>
                slot.doctorId === schedule.doctorId &&
                slot.slotDate === date &&
                slot.startTime === startTime &&
                slot.endTime === endTime,
            ) ||
            newRows.some(
              (r) =>
                r.doctor_id === schedule.doctorId &&
                r.slot_date === date &&
                r.start_time === startTime &&
                r.end_time === endTime,
            );
          const overlaps =
            existingSlots.some(
              (slot) =>
                slot.doctorId === schedule.doctorId &&
                slot.slotDate === date &&
                startTime < slot.endTime &&
                endTime > slot.startTime,
            ) ||
            newRows.some(
              (r) =>
                r.doctor_id === schedule.doctorId &&
                r.slot_date === date &&
                startTime < r.end_time &&
                endTime > r.start_time,
            );

          if (!exists && !overlaps && date >= today) {
            newRows.push({
              doctor_id: schedule.doctorId,
              slot_date: date,
              start_time: startTime,
              end_time: endTime,
              max_capacity: schedule.defaultCapacity,
              booked_count: 0,
              status: 'available',
            });
          }
        }
      }
    }

    if (newRows.length === 0) {
      return { ok: true, value: 0 };
    }

    const { error } = await this.client.from('appointment_slots').insert(newRows);
    if (error) {
      return { ok: false, error: error.message || 'ไม่สามารถสร้างรอบตรวจได้' };
    }

    return { ok: true, value: newRows.length };
  }
}
