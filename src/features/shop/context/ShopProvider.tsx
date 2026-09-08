'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/utils/supabase/client';
import { createShopRepository } from '../data/repositoryFactory';
import { DatabaseShopRepository } from '../data/databaseRepository';
import type { ShopRepository, ShopSnapshot } from '../domain/repository';
import type {
  DoctorWeeklySchedule,
  DoctorAvailabilityTemplate,
  ScheduleDepartment,
  ScheduleDoctor,
  ScheduleService,
  ScheduleSlot,
} from '@/types/schedule';
import type { UserRole } from '@/types/database';
import type { ShopResult, SlotInput } from '../domain/rules';

interface ShopContextValue extends ShopSnapshot {
  isLoading: boolean;
  refresh(): Promise<void>;
  saveDepartment(
    input: Omit<ScheduleDepartment, 'id' | 'isActive'>,
    id?: string,
  ): Promise<ShopResult<ScheduleDepartment>>;
  toggleDepartment(id: string): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>>;
  saveService(
    input: Omit<ScheduleService, 'id' | 'isActive'>,
    id?: string,
  ): Promise<ShopResult<ScheduleService>>;
  toggleService(id: string): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>>;
  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): Promise<ShopResult<ScheduleDoctor>>;
  toggleDoctor(id: string): Promise<ShopResult<ScheduleDoctor | 'deleted'>>;
  saveSlot(
    input: SlotInput,
    id?: string,
    todayDate?: string,
  ): Promise<ShopResult<ScheduleSlot>> | ShopResult<ScheduleSlot>;
  toggleSlot(
    id: string,
    actorId?: string,
    role?: UserRole,
  ): Promise<ShopResult<ScheduleSlot>> | ShopResult<ScheduleSlot>;
  saveWeeklySchedule(
    input: Omit<DoctorWeeklySchedule, 'id'>,
    id?: string,
  ): ShopResult<DoctorWeeklySchedule>;
  generateSlotsForRange(
    startDate: string,
    endDate: string,
    today: string,
    serviceId?: string,
  ): Promise<ShopResult<number>> | ShopResult<number>;
  getDoctorTemplates(doctorId: string): DoctorAvailabilityTemplate[];
  saveDoctorTemplate(
    input: Omit<DoctorAvailabilityTemplate, 'id' | 'usageCount' | 'lastUsedAt'>,
  ): ShopResult<DoctorAvailabilityTemplate>;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const supabaseClient = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  const dbRepo = useMemo(() => {
    return supabaseClient ? new DatabaseShopRepository(supabaseClient) : null;
  }, [supabaseClient]);

  const [repository] = useState<ShopRepository>(() => createShopRepository());
  const [snapshot, setSnapshot] = useState<ShopSnapshot>(() => {
    // When Supabase is configured, initialize empty so mock data never appears in real database mode
    if (typeof window !== 'undefined' || process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return {
        departments: [],
        doctors: [],
        services: [],
        dailyServiceOfferings: [],
        slots: [],
        weeklySchedules: [],
        doctorAccounts: [],
      };
    }
    return repository.snapshot();
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!dbRepo) return;
    try {
      const [deptList, docList, serviceList, offeringList, accountList, slotList] = await Promise.all([
        dbRepo.fetchDepartments(),
        dbRepo.fetchDoctors(),
        dbRepo.fetchServices(),
        dbRepo.fetchDailyServiceOfferings(),
        dbRepo.fetchDoctorAccounts(),
        dbRepo.fetchSlots(),
      ]);

      setSnapshot({
        departments: deptList,
        doctors: docList,
        services: serviceList,
        dailyServiceOfferings: offeringList,
        slots: slotList,
        doctorAccounts: accountList,
        weeklySchedules: [],
      });
    } catch (err) {
      console.warn('ShopProvider refresh error:', err);
    }
  }, [dbRepo]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (dbRepo) {
        try {
          const [deptList, docList, serviceList, offeringList, accountList, slotList] = await Promise.all([
            dbRepo.fetchDepartments(),
            dbRepo.fetchDoctors(),
            dbRepo.fetchServices(),
            dbRepo.fetchDailyServiceOfferings(),
            dbRepo.fetchDoctorAccounts(),
            dbRepo.fetchSlots(),
          ]);
          if (isMounted) {
            setSnapshot({
              departments: deptList,
              doctors: docList,
              services: serviceList,
              dailyServiceOfferings: offeringList,
              slots: slotList,
              doctorAccounts: accountList,
              weeklySchedules: [],
            });
          }
        } catch (err) {
          console.warn('ShopProvider initial load error:', err);
        }
      }
      if (isMounted) setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [dbRepo]);

  const run = useCallback(
    <T,>(command: () => ShopResult<T>) => {
      const result = command();
      if (result.ok) setSnapshot(repository.snapshot());
      return result;
    },
    [repository],
  );

  const handleSaveDepartment = useCallback(
    async (
      input: Omit<ScheduleDepartment, 'id' | 'isActive'>,
      id?: string,
    ): Promise<ShopResult<ScheduleDepartment>> => {
      const isDbId = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : true;
      if (dbRepo) {
        if (!isDbId) {
          return { ok: false, error: 'รหัสแผนกไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        try {
          const result = await dbRepo.saveDepartment(input, snapshot.departments, id);
          if (result.ok) {
            await refresh();
          }
          return result;
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกแผนก' };
        }
      }
      return run(() => repository.saveDepartment(input, id));
    },
    [dbRepo, refresh, repository, run, snapshot.departments],
  );

  const handleToggleDepartment = useCallback(
    async (id: string): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>> => {
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (dbRepo) {
        if (!isDbId) {
          return { ok: false, error: 'รหัสแผนกไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        const target = snapshot.departments.find((d) => d.id === id);
        if (target) {
          try {
            const result = await dbRepo.toggleDepartment(id, target.isActive);
            if (result.ok) {
              await refresh();
            }
            return result;
          } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะแผนก' };
          }
        }
        return { ok: false, error: 'ไม่พบแผนกที่ต้องการแก้ไข' };
      }
      return run(() => repository.toggleDepartment(id));
    },
    [dbRepo, refresh, repository, run, snapshot.departments],
  );

  const handleSaveDoctor = useCallback(
    async (
      input: Omit<ScheduleDoctor, 'id'>,
      id?: string,
    ): Promise<ShopResult<ScheduleDoctor>> => {
      const isDbId = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : true;
      if (dbRepo) {
        if (!isDbId) {
          return { ok: false, error: 'รหัสแพทย์ไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        try {
          const result = await dbRepo.saveDoctor(input, snapshot.doctors, id);
          if (result.ok) {
            await refresh();
          }
          return result;
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลแพทย์' };
        }
      }
      return run(() => repository.saveDoctor(input, id));
    },
    [dbRepo, refresh, repository, run, snapshot.doctors],
  );

  const handleSaveService = useCallback(
    async (
      input: Omit<ScheduleService, 'id' | 'isActive'>,
      id?: string,
    ): Promise<ShopResult<ScheduleService>> => {
      const isDbId = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : true;
      if (dbRepo) {
        if (!isDbId) return { ok: false, error: 'รหัสบริการไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        try {
          const result = await dbRepo.saveService(input, snapshot.services, id);
          if (result.ok) await refresh();
          return result;
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกบริการ' };
        }
      }
      return run(() => repository.saveService(input, id));
    },
    [dbRepo, refresh, repository, run, snapshot.services],
  );

  const handleToggleService = useCallback(
    async (id: string): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>> => {
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (dbRepo) {
        if (!isDbId) return { ok: false, error: 'รหัสบริการไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        const target = snapshot.services.find((service) => service.id === id);
        if (!target) return { ok: false, error: 'ไม่พบบริการที่ต้องการแก้ไข' };
        try {
          const result = await dbRepo.toggleService(id, target.isActive);
          if (result.ok) await refresh();
          return result;
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะบริการ' };
        }
      }
      return run(() => repository.toggleService(id));
    },
    [dbRepo, refresh, repository, run, snapshot.services],
  );

  const handleToggleDoctor = useCallback(
    async (id: string): Promise<ShopResult<ScheduleDoctor | 'deleted'>> => {
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (dbRepo) {
        if (!isDbId) {
          return { ok: false, error: 'รหัสแพทย์ไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        const target = snapshot.doctors.find((d) => d.id === id);
        if (target) {
          try {
            const result = await dbRepo.toggleDoctor(id, target.availability);
            if (result.ok) {
              await refresh();
            }
            return result;
          } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะแพทย์' };
          }
        }
        return { ok: false, error: 'ไม่พบแพทย์ที่ต้องการแก้ไข' };
      }
      return run(() => repository.toggleDoctor(id));
    },
    [dbRepo, refresh, repository, run, snapshot.doctors],
  );

  const handleSaveSlot = useCallback(
    async (input: SlotInput, id?: string, todayDate?: string): Promise<ShopResult<ScheduleSlot>> => {
      const isDbId = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : true;
      const isDbDoctor = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.doctorId);
      if (dbRepo) {
        if (!isDbDoctor) {
          return { ok: false, error: 'รหัสแพทย์ไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        if (id && !isDbId) {
          return { ok: false, error: 'รหัสรอบตรวจไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        try {
          const result = await dbRepo.saveSlot(
            input,
            snapshot.slots,
            snapshot.doctors,
            snapshot.services,
            id,
            todayDate,
          );
          if (result.ok) {
            await refresh();
          }
          return result;
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกรอบตรวจ' };
        }
      }
      return run(() => repository.saveSlot(input, id, todayDate));
    },
    [dbRepo, refresh, repository, run, snapshot.doctors, snapshot.services, snapshot.slots],
  );

  const handleToggleSlot = useCallback(
    async (
      id: string,
      actorId?: string,
      role?: UserRole,
    ): Promise<ShopResult<ScheduleSlot>> => {
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (dbRepo) {
        if (!isDbId) {
          return { ok: false, error: 'รหัสรอบตรวจไม่ถูกต้องตามระบบฐานข้อมูล (ต้องเป็น UUID)' };
        }
        const target = snapshot.slots.find((s) => s.id === id);
        if (target) {
          try {
            const result = await dbRepo.toggleSlot(id, target, actorId, role);
            if (result.ok) {
              await refresh();
            }
            return result;
          } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปรับสถานะรอบตรวจ' };
          }
        }
        return { ok: false, error: 'ไม่พบรอบตรวจที่ต้องการแก้ไข' };
      }
      return run(() => repository.toggleSlot(id, actorId, role));
    },
    [dbRepo, refresh, repository, run, snapshot.slots],
  );

  const handleGenerateSlotsForRange = useCallback(
    async (startDate: string, endDate: string, today: string, serviceId?: string): Promise<ShopResult<number>> => {
      if (dbRepo) {
        try {
          const result = await dbRepo.generateSlotsForRange(
            startDate,
            endDate,
            today,
            snapshot.weeklySchedules,
            snapshot.slots,
            snapshot.services,
            serviceId,
          );
          if (result.ok) {
            await refresh();
          }
          return result;
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างรอบตรวจ' };
        }
      }
      return run(() => repository.generateSlotsForRange(startDate, endDate, today, serviceId));
    },
    [dbRepo, refresh, repository, run, snapshot.services, snapshot.slots, snapshot.weeklySchedules],
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      ...snapshot,
      isLoading,
      refresh,
      saveDepartment: handleSaveDepartment,
      toggleDepartment: handleToggleDepartment,
      saveService: handleSaveService,
      toggleService: handleToggleService,
      saveDoctor: handleSaveDoctor,
      toggleDoctor: handleToggleDoctor,
      saveSlot: handleSaveSlot,
      toggleSlot: handleToggleSlot,
      saveWeeklySchedule: (input, id) => run(() => repository.saveWeeklySchedule(input, id)),
      generateSlotsForRange: handleGenerateSlotsForRange,
      getDoctorTemplates: (doctorId) => repository.getDoctorTemplates(doctorId),
      saveDoctorTemplate: (input) => run(() => repository.saveDoctorTemplate(input)),
    }),
    [
      snapshot,
      isLoading,
      refresh,
      handleSaveDepartment,
      handleToggleDepartment,
      handleSaveService,
      handleToggleService,
      handleSaveDoctor,
      handleToggleDoctor,
      handleSaveSlot,
      handleToggleSlot,
      handleGenerateSlotsForRange,
      run,
      repository,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside ShopProvider');
  return value;
}
