'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TopProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // When route/search changes, show brief progress sequence asynchronously
    const animId = requestAnimationFrame(() => {
      setVisible(true);
      setProgress(30);
    });

    const timer1 = setTimeout(() => {
      setProgress(85);
    }, 120);

    const timer2 = setTimeout(() => {
      setProgress(100);
    }, 280);

    const timer3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 550);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[99999] h-[2.5px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-brand-ink via-brand to-status-success shadow-[0_0_8px_rgba(31,163,154,0.5)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transitionProperty: 'width, opacity',
        }}
      />
    </div>
  );
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarContent />
    </Suspense>
  );
}
