'use client';

import Link from 'next/link';
import { ChevronRight, FileClock, LogOut, Settings, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { useEffect } from 'react';
import type { UserRole } from '@/types/database';

interface ProfileAccountDrawerProps {
  open: boolean;
  fullName: string;
  role: UserRole | null;
  onClose: () => void;
  onSignOut: () => void;
}

const menuItems = [
  { href: '/appointments', label: 'ประวัติการรักษา', icon: FileClock },
  { href: '/results', label: 'ผลการตรวจ', icon: Stethoscope },
  { href: '/profile#security', label: 'ความปลอดภัยและรหัสผ่าน', icon: ShieldCheck },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings },
];

const roleLabels: Record<UserRole, string> = {
  patient: 'ผู้ป่วย',
  medical: 'แพทย์ / เภสัชกร',
  staff_admin: 'เจ้าหน้าที่ / แอดมิน',
};

export default function ProfileAccountDrawer({ open, fullName, role, onClose, onSignOut }: ProfileAccountDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 top-16 z-[60]  hidden xl:block ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button type="button" onClick={onClose} aria-label="ปิดเมนูบัญชี" className="absolute inset-0 bg-transparent" />
      <aside id="profile-account-menu" className={`absolute inset-x-2 top-2 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl transition-all duration-200 ease-out sm:left-auto sm:right-6 sm:w-[360px] ${open ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`} aria-label="เมนูบัญชี">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800" aria-hidden="true"><UserRound className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-950">{fullName}</p>
            <p className="mt-0.5 text-sm text-slate-500">{role ? roleLabels[role] : 'บัญชีผู้ใช้'}</p>
            <Link href="/profile" onClick={onClose} className="mt-1 inline-block text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline">ดูโปรไฟล์ของคุณ</Link>
          </div>
        </div>
        <nav className="space-y-1 p-2" aria-label="รายการเมนูบัญชี">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-teal-800"><Icon className="size-5 shrink-0 text-slate-500" aria-hidden="true" /><span className="flex-1">{item.label}</span><ChevronRight className="size-4 text-slate-400" aria-hidden="true" /></Link>;
          })}
          <div className="mx-1 my-2 border-t border-slate-200" />
          <button type="button" onClick={onSignOut} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"><LogOut className="size-5 shrink-0" aria-hidden="true" /><span>ออกจากระบบ</span></button>
        </nav>
      </aside>
    </div>
  );
}
