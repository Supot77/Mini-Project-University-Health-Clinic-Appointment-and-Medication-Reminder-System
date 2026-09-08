import Link from "next/link";
import { Clock3, Hospital, MapPin } from "lucide-react";

const patientLinks = [
  { label: "นัดหมายออนไลน์", href: "/appointments" },
  { label: "ตารางแพทย์", href: "/schedules" },
  { label: "ประวัติสุขภาพ", href: "/records" },
  { label: "โปรไฟล์ของฉัน", href: "/profile" },
];

const staffLinks = [
  { label: "เข้าสู่ระบบเจ้าหน้าที่", href: "/login" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "จัดการคลังยา", href: "/pharmacy" },
  { label: "ค้นหาผู้ป่วย", href: "/patients/search" },
];

export default function Footer() {
  return (
    <footer className="w-full bg-[#102f3d] px-5 py-14 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#83d6c6]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#83d6c6] text-[#102f3d]"><Hospital className="h-5 w-5" aria-hidden="true" /></span>
              <span className="text-lg font-semibold tracking-[-0.02em]">WU Clinic</span>
            </Link>
            <p className="mt-5 text-sm leading-7 text-[#b6ced0]">คลินิกสุขภาพมหาวิทยาลัยวลัยลักษณ์ ดูแลทุกขั้นตอนของการนัดหมายและบริการสุขภาพให้เป็นเรื่องง่าย</p>
            <div className="mt-6 space-y-3 text-xs text-[#b6ced0]"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#83d6c6]" aria-hidden="true" />มหาวิทยาลัยวลัยลักษณ์</div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#83d6c6]" aria-hidden="true" />จันทร์–ศุกร์ 08:30–16:30 น.</div></div>
          </div>

          <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#83d6c6]">สำหรับผู้ป่วย</h2><ul className="mt-5 space-y-3 text-sm text-[#b6ced0]">{patientLinks.map((link) => <li key={link.href}><Link href={link.href} className="transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#83d6c6]">{link.label}</Link></li>)}</ul></div>
          <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#83d6c6]">สำหรับบุคลากร</h2><ul className="mt-5 space-y-3 text-sm text-[#b6ced0]">{staffLinks.map((link) => <li key={link.href}><Link href={link.href} className="transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#83d6c6]">{link.label}</Link></li>)}</ul></div>
          <div><h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#83d6c6]">ข้อมูลสำคัญ</h2><p className="mt-5 text-sm leading-7 text-[#b6ced0]">หากมีอาการฉุกเฉิน กรุณาติดต่อหน่วยฉุกเฉินใกล้บ้านทันที ระบบนี้ใช้สำหรับการนัดหมายและจัดการข้อมูลคลินิก</p></div>
        </div>

        <div className="flex flex-col gap-3 pt-7 text-xs text-[#88a7aa] sm:flex-row sm:items-center sm:justify-between"><p>© 2026 WU Clinic · มหาวิทยาลัยวลัยลักษณ์</p><p>ระบบสำหรับการเรียนการสอน ข้อมูลในระบบเป็นข้อมูลสาธิต</p></div>
      </div>
    </footer>
  );
}
