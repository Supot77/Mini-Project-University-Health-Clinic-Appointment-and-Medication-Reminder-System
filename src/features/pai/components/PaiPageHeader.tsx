import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, FileHeart, FlaskConical } from 'lucide-react';

export const inputClass = 'min-h-11 w-full rounded-xl border border-brand-border-soft bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-strong focus:ring-4 focus:ring-brand-soft disabled:bg-brand-surface';
export const primaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-strong px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-40';
export const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border-soft bg-white px-4 py-2 text-sm font-medium text-brand-hover transition hover:bg-brand-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-40';

export default function PaiPageHeader({ title, description, active, children }: {
  title: string;
  description: string;
  active: 'appointments' | 'records';
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-page px-4 py-3 text-xs leading-5 text-brand-ink">
        <p className="flex items-start gap-2"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><strong>โหมดตัวอย่าง</strong> · ข้อมูลสมมติ ทดลองได้ในหน้านี้ และเริ่มใหม่เมื่อออกจากหน้าหรือรีเฟรช</span></p>
        <span>วันจำลอง: 7 ก.ย. 2569 · เวลาไทย</span>
      </div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="mb-2 text-xs font-semibold tracking-widest text-brand-strong">WU CLINIC / CARE</p><h1 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-brand-muted">{description}</p></div>
        {children}
      </div>
      <nav aria-label="นัดหมายและผลตรวจ" className="flex gap-1 border-b border-slate-200">
        {([{ key: 'appointments', href: '/appointments', label: 'นัดหมายและคิว', icon: CalendarDays }, { key: 'records', href: '/records', label: 'ผลตรวจและใบสั่งยา', icon: FileHeart }] as const).map(({ key, href, label, icon: Icon }) => (
          <Link key={key} href={href} aria-current={active === key ? 'page' : undefined} className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-strong sm:px-5 ${active === key ? 'border-brand-strong text-brand-strong' : 'border-transparent text-brand-muted hover:text-brand-ink'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</Link>
        ))}
      </nav>
    </div>
  );
}
