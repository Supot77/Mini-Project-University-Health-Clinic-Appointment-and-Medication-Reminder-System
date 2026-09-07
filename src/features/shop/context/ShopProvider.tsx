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
  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): Promise<ShopResult<ScheduleDoctor>>;
  toggleDoctor(id: string): Promise<ShopResult<ScheduleDoctor | 'deleted'>>;
  saveSlot(input: SlotInput, id?: string): ShopResult<ShopSnapshot['slots'][number]>;
  toggleSlot(
    id: string,
    actorId?: string,
    role?: UserRole,
  ): ShopResult<ShopSnapshot['slots'][number]>;
  saveWeeklySchedule(
    input: Omit<DoctorWeeklySchedule, 'id'>,
    id?: string,
  ): ShopResult<DoctorWeeklySchedule>;
  generateSlotsForRange(startDate: string, endDate: string, today: string): ShopResult<number>;
  getDoctorTemplates(doctorId: string): DoctorAvailabilityTemplate[];
  saveDoctorTemplate(
    input: Omit<DoctorAvailabilityTemplate, 'id' | 'usageCount' | 'lastUsedAt'>,
  ): ShopResult<DoctorAvailabilityTemplate>;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [repository] = useState<ShopRepository>(() => createShopRepository());
  const [snapshot, setSnapshot] = useState<ShopSnapshot>(() => repository.snapshot());
  const [isLoading, setIsLoading] = useState(true);

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

  const refresh = useCallback(async () => {
    if (!dbRepo) return;
    try {
      const [deptList, docList, accountList] = await Promise.all([
        dbRepo.fetchDepartments(),
        dbRepo.fetchDoctors(),
        dbRepo.fetchDoctorAccounts(),
      ]);

      setSnapshot((current) => ({
        ...current,
        departments: deptList.length > 0 ? deptList : current.departments,
        doctors: docList.length > 0 ? docList : current.doctors,
        doctorAccounts: accountList.length > 0 ? accountList : current.doctorAccounts,
      }));
    } catch (err) {
      console.warn('ShopProvider refresh error:', err);
    }
  }, [dbRepo]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (dbRepo) {
        try {
          const [deptList, docList, accountList] = await Promise.all([
            dbRepo.fetchDepartments(),
            dbRepo.fetchDoctors(),
            dbRepo.fetchDoctorAccounts(),
          ]);
          if (isMounted) {
            setSnapshot((current) => ({
              ...current,
              departments: deptList.length > 0 ? deptList : current.departments,
              doctors: docList.length > 0 ? docList : current.doctors,
              doctorAccounts: accountList.length > 0 ? accountList : current.doctorAccounts,
            }));
          }
        } catch (err) {
          console.warn('ShopProvider initial load fallback:', err);
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
      if (dbRepo && isDbId) {
        try {
          const result = await dbRepo.saveDepartment(input, snapshot.departments, id);
          if (result.ok) {
            await refresh();
            return result;
          }
          return result;
        } catch (err) {
          console.error('Database saveDepartment failed, falling back to mock:', err);
        }
      }
      return run(() => repository.saveDepartment(input, id));
    },
    [dbRepo, refresh, repository, run, snapshot.departments],
  );

  const handleToggleDepartment = useCallback(
    async (id: string): Promise<ShopResult<'deleted' | 'disabled' | 'enabled'>> => {
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (dbRepo && isDbId) {
        const target = snapshot.departments.find((d) => d.id === id);
        if (target) {
          try {
            const result = await dbRepo.toggleDepartment(id, target.isActive);
            if (result.ok) {
              await refresh();
              return result;
            }
            return result;
          } catch (err) {
            console.error('Database toggleDepartment failed, falling back to mock:', err);
          }
        }
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
      if (dbRepo && isDbId) {
        try {
          const result = await dbRepo.saveDoctor(input, snapshot.doctors, id);
          if (result.ok) {
            await refresh();
            return result;
          }
          return result;
        } catch (err) {
          console.error('Database saveDoctor failed, falling back to mock:', err);
        }
      }
      return run(() => repository.saveDoctor(input, id));
    },
    [dbRepo, refresh, repository, run, snapshot.doctors],
  );

  const handleToggleDoctor = useCallback(
    async (id: string): Promise<ShopResult<ScheduleDoctor | 'deleted'>> => {
      const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (dbRepo && isDbId) {
        const target = snapshot.doctors.find((d) => d.id === id);
        if (target) {
          try {
            const result = await dbRepo.toggleDoctor(id, target.availability);
            if (result.ok) {
              await refresh();
              return result;
            }
            return result;
          } catch (err) {
            console.error('Database toggleDoctor failed, falling back to mock:', err);
          }
        }
      }
      return run(() => repository.toggleDoctor(id));
    },
    [dbRepo, refresh, repository, run, snapshot.doctors],
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      ...snapshot,
      isLoading,
      refresh,
      saveDepartment: handleSaveDepartment,
      toggleDepartment: handleToggleDepartment,
      saveDoctor: handleSaveDoctor,
      toggleDoctor: handleToggleDoctor,
      saveSlot: (input, id) => run(() => repository.saveSlot(input, id)),
      toggleSlot: (id, actorId, role) => run(() => repository.toggleSlot(id, actorId, role)),
      saveWeeklySchedule: (input, id) => run(() => repository.saveWeeklySchedule(input, id)),
      generateSlotsForRange: (startDate, endDate, today) =>
        run(() => repository.generateSlotsForRange(startDate, endDate, today)),
      getDoctorTemplates: (doctorId) => repository.getDoctorTemplates(doctorId),
      saveDoctorTemplate: (input) => run(() => repository.saveDoctorTemplate(input)),
    }),
    [
      snapshot,
      isLoading,
      refresh,
      handleSaveDepartment,
      handleToggleDepartment,
      handleSaveDoctor,
      handleToggleDoctor,
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
