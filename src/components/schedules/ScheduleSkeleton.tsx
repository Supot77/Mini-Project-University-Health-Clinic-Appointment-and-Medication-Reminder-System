'use client';

export default function ScheduleSkeleton() {
  return (
    <div
      role="status"
      aria-label="กำลังโหลดตารางตรวจแพทย์"
      className="space-y-4 animate-in fade-in duration-200"
    >
      {/* Top filter bar skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 w-44 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>

      {/* Calendar Grid Skeleton for Desktop */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/70">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="px-3 py-4 text-center">
              <div className="mx-auto h-3 w-8 animate-pulse rounded bg-slate-200" />
              <div className="mx-auto mt-2 h-7 w-7 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid min-h-[420px] grid-cols-7 divide-x divide-slate-100 bg-white p-2">
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div key={dayIdx} className="space-y-2 p-1.5">
              {Array.from({ length: (dayIdx % 3) + 1 }, (_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-12 animate-pulse rounded-full bg-emerald-100/60" />
                  </div>
                  <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile view skeleton */}
      <div className="space-y-3 p-4 lg:hidden">
        {Array.from({ length: 3 }, (_, idx) => (
          <div
            key={idx}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-12 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">กำลังโหลดตารางตรวจแพทย์...</span>
    </div>
  );
}

