'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { ClinicMockDatabase } from './engine';
import { createClinicRepositories, type ClinicRepositories } from './repositories';

interface ClinicMockContextValue {
  database: ClinicMockDatabase;
  repositories: ClinicRepositories;
}

const ClinicMockContext = createContext<ClinicMockContextValue | null>(null);

export function ClinicMockProvider({ children }: { children: ReactNode }) {
  const [database] = useState(() => new ClinicMockDatabase());
  const [repositories] = useState(() => createClinicRepositories(database));
  return <ClinicMockContext.Provider value={{ database, repositories }}>{children}</ClinicMockContext.Provider>;
}

export function useClinicMockDatabase() {
  const context = useContext(ClinicMockContext);
  if (!context) throw new Error('useClinicMockDatabase must be used inside ClinicMockProvider');
  return context;
}

export function useOptionalClinicMockDatabase() {
  return useContext(ClinicMockContext);
}
