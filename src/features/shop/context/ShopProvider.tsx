'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createShopRepository } from '../data/repositoryFactory';
import type { ShopRepository, ShopSnapshot } from '../domain/repository';
import type { DoctorLeaveRequest, DoctorWeeklySchedule, ScheduleDepartment, ScheduleDoctor } from '@/types/schedule';
import type { ShopResult, SlotInput } from '../domain/rules';

interface ShopContextValue extends ShopSnapshot {
  saveDepartment(input: Omit<ScheduleDepartment, 'id' | 'isActive'>, id?: string): ShopResult<ScheduleDepartment>;
  toggleDepartment(id: string): ShopResult<'deleted' | 'disabled' | 'enabled'>;
  saveDoctor(input: Omit<ScheduleDoctor, 'id'>, id?: string): ShopResult<ScheduleDoctor>;
  toggleDoctor(id: string): ShopResult<ScheduleDoctor | 'deleted'>;
  saveSlot(input: SlotInput, id?: string): ShopResult<ShopSnapshot['slots'][number]>;
  toggleSlot(id: string): ShopResult<ShopSnapshot['slots'][number]>;
  saveWeeklySchedule(input: Omit<DoctorWeeklySchedule, 'id'>, id?: string): ShopResult<DoctorWeeklySchedule>;
  submitLeave(input: Omit<DoctorLeaveRequest, 'id' | 'status'>): ShopResult<DoctorLeaveRequest>;
  decideLeave(id: string, status: 'approved' | 'rejected', decidedBy: string, today: string, decisionNote?: string): ShopResult<DoctorLeaveRequest>;
  cancelLeave(id: string, requestedBy: string): ShopResult<DoctorLeaveRequest>;
  generateSlotsForRange(startDate: string, endDate: string, today: string): ShopResult<number>;
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
    toggleSlot: (id) => run(() => repository.toggleSlot(id)),
    saveWeeklySchedule: (input, id) => run(() => repository.saveWeeklySchedule(input, id)),
    submitLeave: (input) => run(() => repository.submitLeave(input)),
    decideLeave: (id, status, decidedBy, today, decisionNote) => run(() => repository.decideLeave(id, status, decidedBy, today, decisionNote)),
    cancelLeave: (id, requestedBy) => run(() => repository.cancelLeave(id, requestedBy)),
    generateSlotsForRange: (startDate, endDate, today) => run(() => repository.generateSlotsForRange(startDate, endDate, today)),
  }), [repository, run, snapshot]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside ShopProvider');
  return value;
}
