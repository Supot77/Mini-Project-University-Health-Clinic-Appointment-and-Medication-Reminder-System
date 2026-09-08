'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createPaiDatabaseRepository } from './databaseRepository';
import type { PaiRepository, PaiRole, PaiSnapshot } from './contract';

export function usePaiWorkspace(role: PaiRole, injected?: PaiRepository) {
  const [data, setData] = useState<PaiSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const repo = useRef<PaiRepository | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const repository = useCallback(() => {
    if (injected) return injected;
    if (!repo.current) repo.current = createPaiDatabaseRepository(createClient(), role);
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
    } catch (e) {
      if (ticket === generation.current) setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
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
      } catch (e) {
        if (active && ticket === generation.current) setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally { if (active && ticket === generation.current) setLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [repository, role]);
  async function run(command: (r: PaiRepository) => Promise<void>, success: string) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await command(repository());
      setMessage(success);
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ กรุณาโหลดใหม่ก่อนลองอีกครั้ง');
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  return { data, loading, busy, error, message, reload, run };
}
