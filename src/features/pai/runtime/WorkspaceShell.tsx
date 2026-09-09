import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, FileHeart, RefreshCw, ShieldCheck } from 'lucide-react';
import type { PaiRole } from './contract';

export interface WorkspaceHeaderStat {
  label: string;
  value: number | string;
  tone: 'default' | 'success' | 'info' | 'warning' | 'danger';
}

export default function WorkspaceShell({ role, section, error, message, busy, reload, children, stats }: {
  role: PaiRole; section: 'appointments' | 'records'; error: string; message: string; busy: boolean;
  reload: () => Promise<void>; children: ReactNode; stats?: WorkspaceHeaderStat[];
}) {
  const roleLabel = role === 'patient' ? 'ผู้ป่วย' : role === 'medical' ? 'แพทย์/เภสัชกร' : 'เจ้าหน้าที่/แอดมิน';
  const title = section === 'appointments' ? 'นัดหมายและคิวตรวจ' : 'ผลตรวจและรายการยา';
  return <section className="mx-auto max-w-6xl space-y-5 text-slate-800">
    <header className="relative overflow-hidden rounded-3xl border border-brand-border-soft bg-white shadow-sm">
      <div className="absolute inset-y-3 left-0 w-2 rounded-r-full bg-brand" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl"><div className="flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-status-success-bg px-3 py-1.5 text-xs font-semibold text-status-success"><span className="h-2 w-2 rounded-full bg-status-success" aria-hidden="true" />LIVE DATABASE</span><span className="text-xs font-semibold tracking-wide text-brand-muted">ASIA/BANGKOK</span></div>
          <p className="mt-4 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brand-strong"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> WU CLINIC · {roleLabel}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brand-muted">{role === 'patient' ? 'จัดการนัดหมายและติดตามข้อมูลการรักษาของคุณได้ในที่เดียว' : role === 'medical' ? 'ดูคิวที่รับผิดชอบและบันทึกผลตรวจอย่างปลอดภัย' : 'จัดการคำขอนัดและติดตามคิวของผู้รับบริการทีละรายการ'} · ข้อมูลจากระบบปัจจุบัน</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border-soft bg-white px-4 py-2 text-sm font-semibold text-brand-hover transition hover:border-brand-border hover:bg-brand-surface hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} onClick={() => void reload()}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />โหลดข้อมูลใหม่</button>
          {stats && stats.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="min-w-[82px] rounded-2xl border border-brand-border-soft bg-brand-surface/70 px-3 py-3 text-center"><p className={`text-xl font-bold ${stat.tone === 'success' ? 'text-status-success' : stat.tone === 'info' ? 'text-status-info' : stat.tone === 'warning' ? 'text-status-warning' : stat.tone === 'danger' ? 'text-status-critical' : 'text-brand-ink'}`}>{stat.value}</p><p className="mt-1 text-[11px] leading-4 text-brand-muted">{stat.label}</p></div>)}</div>}
        </div>
      </div>
    </header>
    <nav aria-label="นัดหมายและผลตรวจ" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <Link href="/appointments" aria-current={section === 'appointments' ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${section === 'appointments' ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><CalendarDays className="h-4 w-4" aria-hidden="true" />นัดหมายและคิว</Link>
      {role !== 'staff_admin' && <Link href="/records" aria-current={section === 'records' ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${section === 'records' ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><FileHeart className="h-4 w-4" aria-hidden="true" />ผลตรวจและรายการยา</Link>}
    </nav>
    {error && <p role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />{error}</p>}
    {message && <p role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />{message}</p>}
    {children}
  </section>;
}
