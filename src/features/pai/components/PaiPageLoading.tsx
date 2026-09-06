export default function PaiPageLoading() {
  return (
    <div role="status" aria-label="กำลังโหลดหน้าบริการ" className="space-y-6">
      <p className="text-sm text-slate-500">กำลังโหลดหน้าบริการ…</p>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-10 w-2/3 rounded-xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-2xl bg-slate-100" />)}</div>
        <div className="h-80 rounded-2xl border border-slate-100 bg-white" />
      </div>
    </div>
  );
}
