import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DailyServiceOffering,
  DoctorAccountOption,
  DoctorWeeklySchedule,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleService,
  ScheduleSlot,
  ScheduleSlotStatus,
} from '@/types/schedule';
import type { UserRole } from '@/types/database';
import type { ShopResult, SlotInput } from '../domain/rules';
import {
  deriveSlotStatus,
  isSlotExpired,
  validateDepartmentName,
  validateSlot,
} from '../domain/rules';

export interface DatabaseShopSnapshot {
  departments: ScheduleDepartment[];
  doctors: ScheduleDoctor[];
  services: ScheduleService[];
  dailyServiceOfferings: DailyServiceOffering[];
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

  async fetchServices(): Promise<ScheduleService[]> {
    const { data, error } = await this.client
      .from('services')
      .select('id, code, name, description, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (error || !data) {
      console.error('Error fetching services:', error);
      return [];
    }

    return data.map((row: { id: string; code: string; name: string; description: string | null; is_active: boolean }) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      isActive: row.is_active ?? true,
      hasHistory: true,
    }));
  }

  async fetchDailyServiceOfferings(): Promise<DailyServiceOffering[]> {
    const { data, error } = await this.client
      .from('daily_service_offerings')
      .select('id, service_id, doctor_id, offering_date, is_active, created_by')
      .order('offering_date', { ascending: true });

    if (error || !data) {
      console.error('Error fetching daily service offerings:', error);
      return [];
    }

    return data.map((row: { id: string; service_id: string; doctor_id: string; offering_date: string; is_active: boolean; created_by: string | null }) => ({
      id: row.id,
      serviceId: row.service_id,
      doctorId: row.doctor_id,
      offeringDate: row.offering_date,
      isActive: row.is_active ?? true,
      createdBy: row.created_by ?? undefined,
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

  async saveService(
    input: Omit<ScheduleService, 'id' | 'isActive'>,
    existingServices: ScheduleService[],
    id?: string,
  ): Promise<ShopResult<ScheduleService>> {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    if (!code || !name) return { ok: false, error: 'กรอกรหัสและชื่อบริการก่อนบันทึก' };
    if (existingServices.some((service) => service.id !== id && (service.code.toLowerCase() === code.toLowerCase() || service.name.trim().toLowerCase() === name.toLowerCase()))) {
      return { ok: false, error: 'รหัสหรือชื่อบริการนี้มีอยู่แล้ว' };
    }

    const payload = {
      code,
      name,
      description: input.description.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const query = id
      ? this.client.from('services').update(payload).eq('id', id)
      : this.client.from('services').insert({ ...payload, is_active: true });
    const { data, error } = await query.select('id, code, name, description, is_active').single();
    if (error || !data) return { ok: false, error: error?.message || 'ไม่สามารถบันทึกบริการได้' };
    return {
      ok: true,
      value: {
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description ?? '',
        isActive: data.is_active ?? true,
        hasHistory: Boolean(id),
      },
    };
  }

  async toggleService(
    id: string,
    currentActive: boolean,
  ): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>> {
    const { data, error } = await this.client
      .from('services')
      .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, is_active');
    if (error) return { ok: false, error: error.message || 'ไม่สามารถเปลี่ยนสถานะบริการได้' };
    if (!data || data.length === 0) return { ok: false, error: 'ไม่พบบริการ หรือไม่มีสิทธิ์แก้ไขบริการนี้' };
    return { ok: true, value: currentActive ? 'disabled' : 'enabled' };
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
      .select('id, doctor_id, daily_service_offering_id, slot_date, start_time, end_time, max_capacity, booked_count, status, created_at, updated_at, daily_service_offering:daily_service_offerings(service_id)')
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error || !data) {
      console.error('Error fetching appointment_slots:', error);
      return [];
    }

    return data.map((row: {
      id: string;
      doctor_id: string;
      daily_service_offering_id: string;
      daily_service_offering: { service_id: string } | Array<{ service_id: string }> | null;
      slot_date: string;
      start_time: string;
      end_time: string;
      max_capacity: number;
      booked_count: number;
      status: string;
    }) => ({
      id: row.id,
      doctorId: row.doctor_id,
      serviceOfferingId: row.daily_service_offering_id,
      serviceId: Array.isArray(row.daily_service_offering) ? row.daily_service_offering[0]?.service_id ?? '' : row.daily_service_offering?.service_id ?? '',
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
    services: ScheduleService[],
    id?: string,
    todayDate?: string,
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
    const valid = validateSlot(input, existingSlots, doctors, services, id, bookedCount, todayDate);
    if (!valid.ok) return valid;

    const nextStatus = deriveSlotStatus(bookedCount, input.maxCapacity, existing?.status, {
      slotDate: input.slotDate,
      startTime: input.startTime,
      currentDate: todayDate,
    });

    const { data: offering, error: offeringError } = await this.client
      .from('daily_service_offerings')
      .upsert(
        {
          service_id: input.serviceId,
          doctor_id: input.doctorId,
          offering_date: input.slotDate,
          is_active: true,
        },
        { onConflict: 'service_id,doctor_id,offering_date' },
      )
      .select('id, service_id, doctor_id, offering_date, is_active, created_by')
      .single();
    if (offeringError || !offering) {
      return { ok: false, error: offeringError?.message || 'ไม่สามารถเตรียมบริการสำหรับวันที่เลือกได้' };
    }

    const offeringId = offering.id as string;

    if (id) {
      const { data, error } = await this.client
        .from('appointment_slots')
        .update({
          doctor_id: input.doctorId,
          daily_service_offering_id: offeringId,
          slot_date: input.slotDate,
          start_time: input.startTime,
          end_time: input.endTime,
          max_capacity: input.maxCapacity,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, doctor_id, daily_service_offering_id, slot_date, start_time, end_time, max_capacity, booked_count, status')
        .single();

      if (error) return { ok: false, error: error.message || 'ไม่สามารถแก้ไขรอบตรวจได้' };
      return {
        ok: true,
        value: {
          id: data.id,
          doctorId: data.doctor_id,
          serviceOfferingId: data.daily_service_offering_id,
          serviceId: input.serviceId,
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
        daily_service_offering_id: offeringId,
        slot_date: input.slotDate,
        start_time: input.startTime,
        end_time: input.endTime,
        max_capacity: input.maxCapacity,
        booked_count: 0,
        status: 'available',
      })
      .select('id, doctor_id, daily_service_offering_id, slot_date, start_time, end_time, max_capacity, booked_count, status')
      .single();

    if (error) return { ok: false, error: error.message || 'ไม่สามารถสร้างรอบตรวจได้' };
    return {
      ok: true,
      value: {
        id: data.id,
        doctorId: data.doctor_id,
        serviceOfferingId: data.daily_service_offering_id,
        serviceId: input.serviceId,
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

    if (currentSlot.status === 'closed') {
      if (isSlotExpired(currentSlot.slotDate, currentSlot.startTime)) {
        return { ok: false, error: 'ไม่สามารถเปิดรอบตรวจที่เลยเวลาเริ่มแล้ว' };
      }
      if (currentSlot.bookedCount >= currentSlot.maxCapacity) {
        return { ok: false, error: 'ไม่สามารถเปิดรอบตรวจที่คนเต็มแล้ว' };
      }
    }

    const nextStatus: ScheduleSlotStatus =
      currentSlot.status === 'closed'
        ? deriveSlotStatus(currentSlot.bookedCount, currentSlot.maxCapacity, undefined, {
            slotDate: currentSlot.slotDate,
            startTime: currentSlot.startTime,
          })
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
    services: ScheduleService[],
    requestedServiceId?: string,
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

    const selectedServiceId = requestedServiceId ?? services.find((service) => service.isActive)?.id;
    if (!selectedServiceId || !services.some((service) => service.id === selectedServiceId && service.isActive)) {
      return { ok: false, error: 'ต้องเลือกบริการที่เปิดใช้งานก่อนสร้างรอบตรวจ' };
    }

    const newRows: Array<{
      doctor_id: string;
      service_id: string;
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
              service_id: selectedServiceId,
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

    const offeringIds = new Map<string, string>();
    for (const row of newRows) {
      const key = `${row.service_id}:${row.doctor_id}:${row.slot_date}`;
      if (offeringIds.has(key)) continue;
      const { data: offering, error: offeringError } = await this.client
        .from('daily_service_offerings')
        .upsert(
          {
            service_id: row.service_id,
            doctor_id: row.doctor_id,
            offering_date: row.slot_date,
            is_active: true,
          },
          { onConflict: 'service_id,doctor_id,offering_date' },
        )
        .select('id')
        .single();
      if (offeringError || !offering) {
        return { ok: false, error: offeringError?.message || 'ไม่สามารถเตรียมบริการสำหรับวันที่เลือกได้' };
      }
      offeringIds.set(key, offering.id as string);
    }

    const insertRows = newRows.map((row) => ({
      doctor_id: row.doctor_id,
      daily_service_offering_id: offeringIds.get(`${row.service_id}:${row.doctor_id}:${row.slot_date}`),
      slot_date: row.slot_date,
      start_time: row.start_time,
      end_time: row.end_time,
      max_capacity: row.max_capacity,
      booked_count: row.booked_count,
      status: row.status,
    }));
    const { error } = await this.client.from('appointment_slots').insert(insertRows);
    if (error) {
      return { ok: false, error: error.message || 'ไม่สามารถสร้างรอบตรวจได้' };
    }

    return { ok: true, value: newRows.length };
  }
}
