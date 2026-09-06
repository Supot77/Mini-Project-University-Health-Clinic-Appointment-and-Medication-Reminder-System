"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import { Bell, CalendarDays, ClipboardClock, Hospital, LayoutDashboard, LogIn, Menu, Package, Stethoscope, UserRound, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavigationRole = "patient" | "staff" | "doctor" | "pharmacist" | "admin";

interface NavigationItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  roles: NavigationRole[];
}

const navigationItems: NavigationItem[] = [
  { href: "/schedules", label: "ตารางแพทย์", icon: CalendarDays, roles: ["patient", "staff", "doctor"] },
  { href: "/appointments", label: "นัดหมาย", icon: ClipboardClock, roles: ["patient", "staff", "doctor"] },
  { href: "/reminders", label: "เตือนยา", icon: Bell, roles: ["patient", "staff"] },
  { href: "/pharmacy", label: "คลังยา", icon: Package, roles: ["staff", "doctor", "pharmacist"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["staff", "doctor", "pharmacist", "admin"] },
];

export default function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, signOut, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keep all routes reachable in unauthenticated demo mode, but never offer
  // Dashboard to an authenticated patient.
  const visibleNavigation = isAuthenticated && role === "patient"
    ? navigationItems.filter((item) => item.roles.includes("patient"))
    : navigationItems;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/10 bg-[#0a2540] text-white shadow-sm">
      <nav aria-label="เมนูหลัก" className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex shrink-0 items-center gap-2 rounded-lg font-bold tracking-tight transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400 text-[#0a2540]" aria-hidden="true"><Hospital className="h-[18px] w-[18px]" /></span>
          <span className="text-sm sm:text-base">WU Clinic</span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:gap-2">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 xl:text-sm ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          {isAuthenticated && role === "patient" && (
            <Link href="/appointments" className="hidden min-h-10 items-center gap-2 rounded-full bg-sky-400 px-4 text-xs font-bold text-[#0a2540] transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:flex">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />จองคิว
            </Link>
          )}

          {!isLoading && (isAuthenticated ? (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/profile" title={user?.full_name ?? "บัญชีผู้ใช้"} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                <span className="hidden max-w-28 truncate xl:inline">{user?.full_name ?? "บัญชี"}</span>
              </Link>
              <button type="button" onClick={() => void signOut()} className="min-h-10 rounded-lg px-3 text-xs text-slate-400 transition-colors hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300">ออกจากระบบ</button>
            </div>
          ) : (
            <Link href="/login" className="hidden min-h-10 items-center gap-2 rounded-full bg-sky-500 px-4 text-xs font-bold text-white transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:flex">
              <LogIn className="h-4 w-4" aria-hidden="true" />เข้าสู่ระบบ
            </Link>
          ))}

          <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 lg:hidden" aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <nav id="mobile-navigation" aria-label="เมนูมือถือ" className="absolute inset-x-0 top-16 border-t border-white/10 bg-[#0a2540] px-4 pb-5 pt-3 shadow-2xl lg:hidden">
          <div className="mx-auto grid max-w-lg gap-1">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" /><span>{item.label}</span>
                </Link>
              );
            })}

            <div className="mt-2 border-t border-white/10 pt-3">
              {isAuthenticated ? (
                <div className="flex items-center justify-between gap-3">
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-sm text-slate-200 hover:bg-white/10">
                    <UserRound className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="truncate">{user?.full_name ?? "บัญชีผู้ใช้"}</span>
                  </Link>
                  <button type="button" onClick={() => { void signOut(); setMobileMenuOpen(false); }} className="min-h-11 shrink-0 rounded-xl px-3 text-xs text-rose-200 hover:bg-rose-400/10">ออกจากระบบ</button>
                </div>
              ) : (
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 text-sm font-bold text-[#0a2540]">
                  <LogIn className="h-4 w-4" aria-hidden="true" />เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
