'use client';

export default function ScheduleSkeleton() {
  return (
    <div role="status" aria-label="กำลังโหลดตารางตรวจแพทย์" className="space-y-6">
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        <div className="h-6 w-56 rounded bg-brand-border-soft" />
        <div className="grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className={index === 0 ? 'col-span-2 sm:col-span-1' : ''}>
              <div className="mb-2 h-3 w-12 rounded bg-brand-border-soft" />
              <div className="h-11 rounded-lg border border-brand-border-soft" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="hidden grid-cols-7 divide-x divide-brand-border-soft border-y border-brand-border-soft lg:grid">
        {Array.from({ length: 7 }, (_, day) => (
          <div key={day} className="min-h-[420px] space-y-8 px-3 py-5">
            <div className="mx-auto h-6 w-12 rounded bg-brand-border-soft motion-safe:animate-pulse" />
            {Array.from({ length: day % 2 + 1 }, (_, row) => (
              <div key={row} className="space-y-3 border-l-2 border-brand-border pl-3 motion-safe:animate-pulse">
                <div className="h-3 w-4/5 rounded bg-brand-border-soft" />
                <div className="h-3 w-full rounded bg-brand-border-soft" />
                <div className="h-3 w-3/5 rounded bg-brand-border-soft" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="divide-y divide-brand-border-soft border-y border-brand-border-soft lg:hidden">
        {[0, 1, 2].map((day) => (
          <div key={day} className="space-y-5 py-6 motion-safe:animate-pulse">
            <div className="h-5 w-28 rounded bg-brand-border-soft" />
            <div className="space-y-3 border-l-2 border-brand-border pl-3">
              <div className="h-3 w-32 rounded bg-brand-border-soft" />
              <div className="h-3 w-44 rounded bg-brand-border-soft" />
              <div className="h-3 w-24 rounded bg-brand-border-soft" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลดตารางตรวจแพทย์...</span>
    </div>
  );
}
