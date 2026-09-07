'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createShopRepository } from '../data/repositoryFactory';
import type { ShopRepository, ShopSnapshot } from '../domain/repository';
import type { DoctorWeeklySchedule, DoctorAvailabilityTemplate, ScheduleDepartment, ScheduleDoctor } from '@/types/schedule';
import type { UserRole } from '@/types/database';
import type { ShopResult, SlotInput } from '../domain/rules';

interface ShopContextValue extends ShopSnapshot {
  saveDepartment(input: Omit<ScheduleDepartment, 'id' | 'isActive'>, id?: string): ShopResult<ScheduleDepartment>;
  toggleDepartment(id: string): ShopResult<'deleted' | 'disabled' | 'enabled'>;
  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): ShopResult<ScheduleDoctor>;
  toggleDoctor(id: string): ShopResult<ScheduleDoctor | 'deleted'>;
  saveSlot(input: SlotInput, id?: string): ShopResult<ShopSnapshot['slots'][number]>;
  toggleSlot(id: string, actorId?: string, role?: UserRole): ShopResult<ShopSnapshot['slots'][number]>;
  saveWeeklySchedule(input: Omit<DoctorWeeklySchedule, 'id'>, id?: string): ShopResult<DoctorWeeklySchedule>;
  generateSlotsForRange(startDate: string, endDate: string, today: string): ShopResult<number>;
  getDoctorTemplates(doctorId: string): DoctorAvailabilityTemplate[];
  saveDoctorTemplate(input: Omit<DoctorAvailabilityTemplate, 'id' | 'usageCount' | 'lastUsedAt'>): ShopResult<DoctorAvailabilityTemplate>;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [repository] = useState<ShopRepository>(() => createShopRepository());
  const [snapshot, setSnapshot] = useState<ShopSnapshot>(() => repository.snapshot());
  const run = useCallback(<T,>(command: () => ShopResult<T>) => {
    const result = command();
    if (result.ok) setSnapshot(repository.snapshot());
    return result;
  }, [repository]);

  const value = useMemo<ShopContextValue>(() => ({
    ...snapshot,
    saveDepartment: (input, id) => run(() => repository.saveDepartment(input, id)),
    toggleDepartment: (id) => run(() => repository.toggleDepartment(id)),
    saveDoctor: (input, id) => run(() => repository.saveDoctor(input, id)),
    toggleDoctor: (id) => run(() => repository.toggleDoctor(id)),
    saveSlot: (input, id) => run(() => repository.saveSlot(input, id)),
    toggleSlot: (id, actorId, role) => run(() => repository.toggleSlot(id, actorId, role)),
    saveWeeklySchedule: (input, id) => run(() => repository.saveWeeklySchedule(input, id)),
    generateSlotsForRange: (startDate, endDate, today) => run(() => repository.generateSlotsForRange(startDate, endDate, today)),
    getDoctorTemplates: (doctorId) => repository.getDoctorTemplates(doctorId),
    saveDoctorTemplate: (input) => run(() => repository.saveDoctorTemplate(input)),
  }), [repository, run, snapshot]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside ShopProvider');
  return value;
}
