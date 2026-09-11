'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'brand' | 'white' | 'sky' | 'slate' | 'emerald';
  label?: string;
  className?: string;
  center?: boolean;
}

const sizeMap = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const toneMap = {
  brand: 'text-brand-ink',
  white: 'text-white',
  sky: 'text-sky-600',
  slate: 'text-slate-400',
  emerald: 'text-emerald-600',
};

export default function LoadingSpinner({
  size = 'md',
  tone = 'brand',
  label,
  className = '',
  center = false,
}: LoadingSpinnerProps) {
  const content = (
    <div
      role="status"
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-live="polite"
    >
      <Loader2
        className={`animate-spin ${sizeMap[size]} ${toneMap[tone]}`}
        aria-hidden="true"
      />
      {label ? (
        <span className="text-xs font-medium text-slate-600">{label}</span>
      ) : (
        <span className="sr-only">กำลังโหลด...</span>
      )}
    </div>
  );

  if (center) {
    return (
      <div className="flex min-h-40 w-full items-center justify-center p-6">
        {content}
      </div>
    );
  }

  return content;
}
