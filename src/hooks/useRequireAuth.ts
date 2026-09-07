'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const requireAuth = useCallback(
    (action: () => void, redirectPath?: string) => {
      if (isLoading) return; // ยังโหลด session อยู่ ไม่ทำอะไรก่อน

      if (!user) {
        const target = redirectPath ?? window.location.pathname;
        router.push(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
      action();
    },
    [user, isLoading, router]
  );

  return { requireAuth, isLoggedIn: Boolean(user), isLoading };
}