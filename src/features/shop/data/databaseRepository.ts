import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DoctorAccountOption,
  ScheduleDepartment,
  ScheduleDoctor,
} from '@/types/schedule';
import type { ShopResult } from '../domain/rules';
import { validateDepartmentName } from '../domain/rules';

export interface DatabaseShopSnapshot {
  departments: ScheduleDepartment[];
  doctors: ScheduleDoctor[];
  doctorAccounts: DoctorAccountOption[];
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
      const fullName = profile?.full_name ?? 'ไม่ระบุชื่อ';
      const initials = fullName
        .split(' ')
        .map((part: string) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'DR';

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
}
