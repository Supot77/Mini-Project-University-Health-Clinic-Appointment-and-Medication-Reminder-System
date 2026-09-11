"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardClock,
  Hospital,
  LayoutDashboard,
  LogIn,
  Menu,
  Package,
  Stethoscope,
  UserRound,
  UserSearch,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/database";
import ProfileAccountDrawer from "@/components/profile/ProfileAccountDrawer";

type NavigationIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

interface NavigationLink {
  href: string;
  label: string;
  icon: NavigationIcon;
}

interface NavigationGroup {
  id: string;
  label: string;
  icon: NavigationIcon;
  items: NavigationLink[];
}

const navigationByRole: Record<UserRole, NavigationGroup[]> = {
  patient: [
    {
      id: "appointments",
      label: "นัดหมาย",
      icon: ClipboardClock,
      items: [
        { href: "/appointments", label: "นัดหมายของฉัน", icon: ClipboardClock },
        { href: "/schedules", label: "ตารางแพทย์", icon: CalendarDays },
      ],
    },
    {
      id: "health",
      label: "สุขภาพของฉัน",
      icon: Hospital,
      items: [
        { href: "/records", label: "ประวัติและผลการรักษา", icon: ClipboardClock },
        { href: "/reminders", label: "เตือนยา", icon: Bell },
      ],
    },
  ],
  medical: [
    {
      id: "care",
      label: "งานตรวจ",
      icon: Stethoscope,
      items: [
        { href: "/appointments", label: "นัดหมายผู้ป่วย", icon: ClipboardClock },
        { href: "/patients/search", label: "ค้นหาผู้ป่วย", icon: UserSearch },
        { href: "/records", label: "บันทึกการรักษา", icon: ClipboardClock },
      ],
    },
    {
      id: "schedule",
      label: "ตารางปฏิบัติงาน",
      icon: CalendarDays,
      items: [{ href: "/schedules", label: "ตารางแพทย์", icon: CalendarDays }],
    },
    {
      id: "pharmacy",
      label: "งานยา",
      icon: Package,
      items: [{ href: "/pharmacy", label: "คลังยา", icon: Package }],
    },
  ],
  staff_admin: [
    {
      id: "clinic",
      label: "จัดการคลินิก",
      icon: Hospital,
      items: [
        { href: "/appointments", label: "นัดหมาย", icon: ClipboardClock },
        { href: "/schedules", label: "ตารางและรอบตรวจ", icon: CalendarDays },
        { href: "/departments", label: "จัดการแผนก", icon: Hospital },
      ],
    },
    {
      id: "users",
      label: "ผู้ใช้งาน",
      icon: UserSearch,
      items: [{ href: "/staff/accounts", label: "จัดการข้อมูลผู้ใช้งาน", icon: UserSearch }],
    },
    {
      id: "follow-up",
      label: "ติดตามผู้ป่วย",
      icon: Bell,
      items: [{ href: "/reminders", label: "เตือนยา", icon: Bell }],
    },
  ],
};

const guestNavigationLink: NavigationLink = {
  href: "/schedules",
  label: "ตารางแพทย์",
  icon: CalendarDays,
};

function linkClasses(active: boolean, compact = false) {
  const base = "flex items-center gap-3 rounded-brand-sm px-3 font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent";
  const sizing = compact ? "min-h-11 text-[15px]" : "min-h-10 text-[13px] xl:text-[15px]";
  const color = active ? "bg-white/15 text-white" : "text-brand-footer-text hover:bg-white/10 hover:text-white";
  return `${base} ${sizing} ${color}`;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, signOut, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/");
    } catch (error) {
      console.error("ออกจากระบบไม่สำเร็จ", error);
    } finally {
      setMobileMenuOpen(false);
      setAccountMenuOpen(false);
      setOpenGroup(null);
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const visibleGroups = isAuthenticated && role ? navigationByRole[role] : [];
  const isGroupActive = (group: NavigationGroup) => group.items.some((item) => isActive(item.href));

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setOpenGroup(null);
  };

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 min-h-16 border-b border-white/10 bg-brand-ink text-white shadow-sm"
      onMouseLeave={() => setOpenGroup(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenGroup(null);
      }}
    >
      <nav aria-label="เมนูหลัก" className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={() => { setMobileMenuOpen((open) => !open); setOpenGroup(null); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-brand-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent lg:hidden"
          aria-label={mobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>

        <Link href={isAuthenticated ? "/dashboard" : "/"} onClick={closeMobileMenu} className="flex shrink-0 items-center gap-2 rounded-brand-sm font-bold tracking-tight transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent">
          <span className="flex h-8 w-8 items-center justify-center rounded-brand-sm bg-brand-accent text-brand-ink" aria-hidden="true"><Hospital className="h-[18px] w-[18px]" /></span>
          <span className="text-[15px] sm:text-base">WU Clinic</span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-start gap-1 lg:flex xl:gap-2">
          {isAuthenticated && role ? (
            <>
              <Link href="/dashboard" aria-current={isActive("/dashboard") ? "page" : undefined} className={linkClasses(isActive("/dashboard"))}>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                <span>ภาพรวม</span>
              </Link>
              {visibleGroups.map((group) => {
                const Icon = group.icon;
                const active = isGroupActive(group);
                const expanded = openGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={expanded}
                    aria-controls={`desktop-menu-${group.id}`}
                    onMouseEnter={() => setOpenGroup(group.id)}
                    onFocus={() => setOpenGroup(group.id)}
                    onClick={() => setOpenGroup(group.id)}
                    className={`${linkClasses(active)} cursor-pointer border-0`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{group.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                );
              })}
            </>
          ) : (
            <Link href={guestNavigationLink.href} aria-current={isActive(guestNavigationLink.href) ? "page" : undefined} className={linkClasses(isActive(guestNavigationLink.href))}>
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span>{guestNavigationLink.label}</span>
            </Link>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
          {isAuthenticated && (
            <Link href="/notifications" aria-current={isActive("/notifications") ? "page" : undefined} aria-label="แจ้งเตือน" title="แจ้งเตือน" className="flex size-10 items-center justify-center rounded-brand-sm text-brand-footer-text transition-[background-color,color] duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">
              <Bell className="size-[18px]" aria-hidden="true" />
            </Link>
          )}

          {isAuthenticated && role === "patient" && (
            <Link href="/appointments" className="hidden min-h-10 items-center gap-2 rounded-full bg-brand-accent px-4 text-[13px] font-bold text-brand-ink transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent sm:flex">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />จองคิว
            </Link>
          )}

          {!isLoading && (isAuthenticated ? (
            <button
              type="button"
              onClick={() => setAccountMenuOpen(true)}
              className="flex min-h-10 items-center gap-1.5 rounded-brand-sm border border-white/10 px-2.5 sm:px-3 text-[13px] font-medium text-brand-footer-text transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              aria-label="เปิดเมนูบัญชี"
              aria-expanded={accountMenuOpen}
            >
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden max-w-28 truncate sm:inline">{user?.full_name ?? "บัญชี"}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-150 ${accountMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          ) : (
            <Link href="/login" className="flex min-h-10 items-center gap-2 rounded-full bg-brand-accent px-3 text-[13px] font-bold text-brand-ink transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent sm:px-4">
              <LogIn className="h-4 w-4" aria-hidden="true" />เข้าสู่ระบบ
            </Link>
          ))}
        </div>
      </nav>

      {isAuthenticated && role && openGroup && (
        <div className="absolute inset-x-0 top-16 hidden border-t border-white/10 bg-brand-ink/98 shadow-2xl backdrop-blur lg:block" onMouseEnter={() => setOpenGroup(openGroup)}>
          <div className="mx-auto grid max-w-[1440px] grid-cols-3 gap-8 px-6 py-7 xl:px-10">
            {visibleGroups.filter((group) => group.id === openGroup).map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.id} className="col-span-3">
                  <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">
                    <GroupIcon className="size-4" aria-hidden="true" />
                    <span>{group.label}</span>
                  </div>
                  <nav id={`desktop-menu-${group.id}`} aria-label={`${group.label} เมนูย่อย`} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenGroup(null)} className={`group flex min-h-14 items-center gap-3 rounded-brand-sm px-4 py-3 transition-[background-color,color,transform] duration-150 hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${active ? "bg-white/10 text-white" : "text-brand-footer-text"}`}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-accent"><ItemIcon className="size-4" aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                          <ChevronRight className="size-4 text-white/40 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <nav id="mobile-navigation" aria-label="เมนูมือถือ" className="absolute inset-x-0 top-16 max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-brand-ink px-4 pb-5 pt-3 shadow-2xl lg:hidden">
          <div className="mx-auto grid max-w-lg gap-1">
            {isAuthenticated && role ? (
              <>
                <Link href="/dashboard" onClick={closeMobileMenu} aria-current={isActive("/dashboard") ? "page" : undefined} className={linkClasses(isActive("/dashboard"), true)}>
                  <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden="true" /><span>ภาพรวม</span>
                </Link>
                {visibleGroups.map((group) => {
                  const Icon = group.icon;
                  const expanded = openGroup === group.id;
                  return (
                    <div key={group.id}>
                      <button type="button" onClick={() => setOpenGroup(expanded ? null : group.id)} aria-expanded={expanded} aria-controls={`mobile-menu-${group.id}`} className={`flex min-h-11 w-full items-center gap-3 rounded-brand-button px-3 text-left text-[15px] font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${isGroupActive(group) ? "bg-white/15 text-white" : "text-brand-footer-text hover:bg-white/10 hover:text-white"}`}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" /><span className="flex-1">{group.label}</span><ChevronDown className={`h-4 w-4 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                      {expanded && (
                        <div id={`mobile-menu-${group.id}`} className="ml-4 grid gap-1 border-l border-white/15 py-1 pl-3">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            const active = isActive(item.href);
                            return <Link key={item.href} href={item.href} onClick={closeMobileMenu} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-brand-button px-3 text-[15px] transition-colors ${active ? "bg-white/15 text-white" : "text-brand-footer-text hover:bg-white/10 hover:text-white"}`}><ItemIcon className="h-[17px] w-[17px]" aria-hidden="true" /><span>{item.label}</span></Link>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <Link href={guestNavigationLink.href} onClick={closeMobileMenu} aria-current={isActive(guestNavigationLink.href) ? "page" : undefined} className={linkClasses(isActive(guestNavigationLink.href), true)}>
                <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" /><span>{guestNavigationLink.label}</span>
              </Link>
            )}

            {!isAuthenticated && (
              <div className="mt-2 border-t border-white/10 pt-3">
                <Link href="/login" onClick={closeMobileMenu} className="flex min-h-11 items-center justify-center gap-2 rounded-brand-button bg-brand-accent px-4 text-[15px] font-bold text-brand-ink">
                  <LogIn className="h-4 w-4" aria-hidden="true" />เข้าสู่ระบบ
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
      <ProfileAccountDrawer role={role} open={accountMenuOpen} onClose={() => setAccountMenuOpen(false)} onSignOut={() => void handleSignOut()} />
    </header>
  );
}
