import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, FileHeart, FlaskConical } from 'lucide-react';

export const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50';
export const primaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40';
export const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40';

export default function PaiPageHeader({ title, description, active, children }: {
  title: string;
  description: string;
  active: 'appointments' | 'records';
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
        <p className="flex items-start gap-2"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span><strong>โหมดตัวอย่าง</strong> · ข้อมูลสมมติ ทดลองได้ในหน้านี้ และเริ่มใหม่เมื่อออกจากหน้าหรือรีเฟรช</span></p>
        <span>วันจำลอง: 7 ก.ย. 2569 · เวลาไทย</span>
      </div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="mb-2 text-xs font-semibold tracking-widest text-sky-600">WU CLINIC / CARE</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div>
        {children}
      </div>
      <nav aria-label="นัดหมายและผลตรวจ" className="flex gap-1 border-b border-slate-200">
        {([{ key: 'appointments', href: '/appointments', label: 'นัดหมายและคิว', icon: CalendarDays }, { key: 'records', href: '/records', label: 'ผลตรวจและใบสั่งยา', icon: FileHeart }] as const).map(({ key, href, label, icon: Icon }) => (
          <Link key={key} href={href} aria-current={active === key ? 'page' : undefined} className={`flex min-h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-sky-600 sm:px-5 ${active === key ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</Link>
        ))}
      </nav>
    </div>
  );
}
