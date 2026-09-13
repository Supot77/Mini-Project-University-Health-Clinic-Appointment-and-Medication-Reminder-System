'use client';

import { CheckCircle2, Info, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

type ToastVariant = 'success' | 'info';

interface ToastProps {
  message: string | null | undefined;
  onDismiss: () => void;
  variant?: ToastVariant;
  duration?: number;
}

const variantStyles: Record<ToastVariant, { icon: typeof CheckCircle2; iconClass: string; ring: string }> = {
  success: { icon: CheckCircle2, iconClass: 'bg-status-success-bg text-status-success', ring: 'ring-emerald-200' },
  info: { icon: Info, iconClass: 'bg-status-info-bg text-status-info', ring: 'ring-brand-border' },
};

/** Compact, non-modal status message for transient action feedback. */
export default function Toast({ message, onDismiss, variant = 'success', duration = 3500 }: ToastProps) {
  const dismissRef = useRef(onDismiss);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(duration);
  const pausedSourcesRef = useRef(new Set<'hover' | 'focus'>());

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    if (!message || timerRef.current !== null || pausedSourcesRef.current.size > 0 || remainingRef.current <= 0) return;
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      dismissRef.current();
    }, remainingRef.current);
  }, [message]);

  useEffect(() => {
    remainingRef.current = duration;
    pausedSourcesRef.current.clear();
    timerRef.current = null;
    if (message) startTimer();

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [duration, message, startTimer]);

  const setPaused = (source: 'hover' | 'focus', paused: boolean) => {
    if (!message) return;
    if (paused) {
      if (pausedSourcesRef.current.has(source)) return;
      if (pausedSourcesRef.current.size === 0) clearTimer();
      pausedSourcesRef.current.add(source);
      return;
    }

    pausedSourcesRef.current.delete(source);
    if (pausedSourcesRef.current.size === 0) startTimer();
  };

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-end sm:left-auto sm:right-6" aria-live="polite" aria-atomic="true">
      <div
        role="status"
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand-ink shadow-2xl ring-1 ${styles.ring}`}
        onMouseEnter={() => setPaused('hover', true)}
        onMouseLeave={() => setPaused('hover', false)}
        onFocus={() => setPaused('focus', true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused('focus', false);
        }}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${styles.iconClass}`} aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1 break-words">{message}</span>
        <button type="button" onClick={onDismiss} className="shrink-0 rounded-lg p-1.5 text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong" aria-label="ปิดข้อความแจ้งเตือน">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
