"use client";

import Link from "next/link";
import { Clock3, Hospital, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const guestSections: FooterSection[] = [
  {
    title: "บริการคลินิก",
    links: [
      { label: "ตารางตรวจแพทย์", href: "/schedules" },
      { label: "เข้าสู่ระบบ", href: "/login" },
      { label: "สมัครสมาชิก", href: "/register" },
    ],
  },
];

const patientSections: FooterSection[] = [
  {
    title: "สำหรับผู้ป่วย",
    links: [
      { label: "นัดหมายตรวจ", href: "/appointments" },
      { label: "ตารางแพทย์", href: "/schedules" },
      { label: "ประวัติการรักษา", href: "/records" },
      { label: "แจ้งเตือนทานยา", href: "/reminders" },
      { label: "โปรไฟล์ส่วนตัว", href: "/profile" },
    ],
  },
];

const medicalSections: FooterSection[] = [
  {
    title: "เมนูสำหรับแพทย์",
    links: [
      { label: "แดชบอร์ด", href: "/dashboard" },
      { label: "ตารางตรวจแพทย์", href: "/schedules" },
      { label: "ค้นหาผู้ป่วย", href: "/patients/search" },
      { label: "คลังยา", href: "/pharmacy" },
      { label: "รายการนัดหมาย", href: "/appointments" },
    ],
  },
];

const staffAdminSections: FooterSection[] = [
  {
    title: "เมนูผู้ดูแลระบบ",
    links: [
      { label: "แดชบอร์ด", href: "/dashboard" },
      { label: "จัดการข้อมูลผู้ใช้งาน", href: "/staff/accounts" },
      { label: "จัดการแผนก", href: "/departments" },
      { label: "คลังยา", href: "/pharmacy" },
      { label: "ตารางตรวจแพทย์", href: "/schedules" },
    ],
  },
];

export default function Footer() {
  const { isAuthenticated, role } = useAuth();

  const sections: FooterSection[] = (() => {
    if (!isAuthenticated || !role) {
      return guestSections;
    }
    switch (role) {
      case "patient":
        return patientSections;
      case "medical":
        return medicalSections;
      case "staff_admin":
        return staffAdminSections;
      default:
        return guestSections;
    }
  })();

  return (
    <footer className="w-full bg-brand-ink px-5 py-[60px] text-white sm:px-8 lg:min-h-[413px] lg:px-[51px]">
      <div className="mx-auto max-w-[1419px]">
        <div className="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link
              href={isAuthenticated ? "/dashboard" : "/"}
              className="inline-flex items-center gap-3 rounded-brand-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-brand-button bg-brand-accent text-brand-ink">
                <Hospital className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[19px] font-semibold tracking-[-0.02em]">WU Clinic</span>
            </Link>
            <p className="mt-5 text-[15px] leading-7 text-brand-footer-text">
              คลินิกสุขภาพมหาวิทยาลัยวลัยลักษณ์ ดูแลทุกขั้นตอนของการนัดหมายและบริการสุขภาพให้เป็นเรื่องง่าย
            </p>
            <div className="mt-6 space-y-3 text-[13px] text-brand-footer-text">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                มหาวิทยาลัยวลัยลักษณ์
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                จันทร์–ศุกร์ 08:30–16:30 น.
              </div>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-brand-accent">
                {section.title}
              </h2>
              <ul className="mt-5 space-y-3 text-[15px] text-brand-footer-text">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-brand-accent">
              ข้อมูลสำคัญ
            </h2>
            <p className="mt-5 text-[15px] leading-7 text-brand-footer-text">
              หากมีอาการฉุกเฉิน กรุณาติดต่อหน่วยฉุกเฉินใกล้บ้านทันที ระบบนี้ใช้สำหรับการนัดหมายและจัดการข้อมูลคลินิก
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-7 text-[13px] text-brand-footer-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 WU Clinic · มหาวิทยาลัยวลัยลักษณ์</p>
          <p>ระบบสำหรับการเรียนการสอน ข้อมูลในระบบเป็นข้อมูลสาธิต</p>
        </div>
      </div>
    </footer>
  );
}
