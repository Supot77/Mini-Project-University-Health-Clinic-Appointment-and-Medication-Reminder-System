'use client';

import Link from 'next/link';
import { FileClock, LogOut, Settings, ShieldCheck, Stethoscope, UserRound, X } from 'lucide-react';
import { useEffect } from 'react';
import type { UserRole } from '@/types/database';

interface ProfileAccountDrawerProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  role: UserRole | null;
}

type AccountMenuItem = { href: string; label: string; icon: typeof UserRound; active?: boolean };

const accountItemsByRole: Record<UserRole, AccountMenuItem[]> = {
  patient: [
    { href: '/records', label: 'ประวัติการรักษา', icon: FileClock },
    { href: '/reminders', label: 'เตือนยา', icon: Stethoscope },
  ],
  medical: [
    { href: '/records', label: 'บันทึกการรักษา', icon: Stethoscope },
    { href: '/appointments', label: 'นัดหมายผู้ป่วย', icon: FileClock },
  ],
  staff_admin: [{ href: '/appointments', label: 'นัดหมาย', icon: FileClock }],
};

export default function ProfileAccountDrawer({ open, onClose, onSignOut, role }: ProfileAccountDrawerProps) {
  const menuItems: AccountMenuItem[] = [
    { href: '/profile', label: 'ข้อมูลส่วนตัว', icon: UserRound, active: true },
    ...(role ? accountItemsByRole[role] : []),
    { href: '/profile#security', label: 'ความปลอดภัยและรหัสผ่าน', icon: ShieldCheck },
    { href: '/settings', label: 'ตั้งค่า', icon: Settings },
  ];

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[60] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button type="button" onClick={onClose} aria-label="ปิดเมนูบัญชี" className={`absolute inset-0 bg-slate-950/55 backdrop-blur-[1px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute bottom-0 right-0 top-0 flex w-[332px] max-w-[88vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`} aria-label="เมนูบัญชี">
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-7">
          <h2 className="text-2xl font-bold text-slate-950">Profile</h2>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100" aria-label="ปิด"><X className="size-6" aria-hidden="true" /></button>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6" aria-label="รายการเมนูบัญชี">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = item.active ?? false;
            return <Link key={item.href} href={item.href} onClick={onClose} className={`flex min-h-14 items-center gap-4 rounded-xl px-5 text-base transition ${active ? 'bg-gradient-to-r from-teal-50 to-cyan-50 font-semibold text-teal-800' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-800'}`}><Icon className={`size-6 shrink-0 ${active ? 'text-teal-700' : 'text-slate-500'}`} aria-hidden="true" /><span>{item.label}</span></Link>;
          })}
          <div className="mx-2 my-5 border-t border-slate-200" />
          <button type="button" onClick={onSignOut} className="flex min-h-14 w-full items-center gap-4 rounded-xl px-5 text-left text-base font-semibold text-rose-600 transition hover:bg-rose-50"><LogOut className="size-6 shrink-0" aria-hidden="true" /><span>ออกจากระบบ</span></button>
        </nav>
      </aside>
    </div>
  );
}
