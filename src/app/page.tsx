import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  HeartPulse,
  MapPin,
  Pill,
  ShieldCheck,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";

type ClinicService = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
};

const services: ClinicService[] = [
  {
    title: "ตรวจโรคทั่วไป",
    description: "ดูแลอาการเจ็บป่วยเบื้องต้น พร้อมคำแนะนำจากทีมแพทย์",
    href: "/appointments",
    icon: Stethoscope,
    accent: "bg-[#e2f5f1] text-[#087f78]",
  },
  {
    title: "ทันตกรรม",
    description: "ตรวจสุขภาพช่องปากและวางแผนการรักษาอย่างเหมาะสม",
    href: "/schedules",
    icon: HeartPulse,
    accent: "bg-[#fff0e8] text-[#c85838]",
  },
  {
    title: "สุขภาพจิต",
    description: "พื้นที่ปลอดภัยสำหรับพูดคุยและรับคำปรึกษาอย่างเป็นส่วนตัว",
    href: "/appointments",
    icon: Syringe,
    accent: "bg-[#e9effb] text-[#355da8]",
  },
  {
    title: "บริการเภสัชกรรม",
    description: "รับยาและคำแนะนำการใช้ยาที่เข้าใจง่ายและปลอดภัย",
    href: "/pharmacy",
    icon: Pill,
    accent: "bg-[#f2edfb] text-[#7652a8]",
  },
];

const steps = [
  { number: "01", title: "เลือกบริการ", description: "ดูตารางแพทย์และเลือกบริการที่ตรงกับความต้องการ" },
  { number: "02", title: "เลือกวันเวลา", description: "เลือกช่วงเวลาที่สะดวก แล้วส่งคำขอนัดหมายออนไลน์" },
  { number: "03", title: "มาตามนัด", description: "แสดงรายละเอียดการนัดหมายกับเจ้าหน้าที่เมื่อมาถึงคลินิก" },
];

export default function Home() {
  return (
    <div className="overflow-hidden bg-[#fbfcfa] text-[#102f3d]">
      <section className="relative bg-[#eaf5f2] px-5 pb-16 pt-14 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute -right-28 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#bde4dc]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-80 w-80 rounded-full bg-[#f7d9c9]/50 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#9bcfc5] bg-white/65 px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-[#087f78]">
              <span className="h-2 w-2 rounded-full bg-[#1fa39a]" aria-hidden="true" />
              คลินิกสุขภาพมหาวิทยาลัยวลัยลักษณ์
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#102f3d] sm:text-6xl lg:text-[4.4rem]">
              ดูแลสุขภาพง่ายขึ้น
              <span className="mt-2 block text-[#087f78]">เริ่มต้นที่ WU Clinic</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[#49636b] sm:text-lg">
              นัดหมายพบแพทย์ ตรวจสอบตารางบริการ และติดตามข้อมูลสุขภาพของคุณได้ในที่เดียว ออกแบบมาให้การมาคลินิกเป็นเรื่องสบายใจตั้งแต่ต้นจนจบ
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/appointments"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#102f3d] px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,47,61,0.18)] transition hover:-translate-y-0.5 hover:bg-[#174858] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102f3d]"
              >
                จองนัดหมายออนไลน์
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/schedules"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#a9c9c4] bg-white/65 px-6 text-sm font-semibold text-[#174858] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
              >
                ดูตารางแพทย์
              </Link>
            </div>
            <p className="mt-5 text-xs text-[#60777c]">
              สำหรับเจ้าหน้าที่และบุคลากรคลินิก <Link href="/login" className="font-semibold text-[#087f78] underline decoration-[#9bcfc5] underline-offset-4 hover:text-[#065c58]">เข้าสู่ระบบจัดการ</Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[35rem] lg:mr-0">
            <div className="absolute -left-5 top-10 hidden h-28 w-28 rounded-[2rem] border border-[#9bcfc5] bg-[#d4ede7]/75 sm:block" aria-hidden="true" />
            <div className="absolute -bottom-5 -right-5 hidden h-36 w-36 rounded-full border-[18px] border-[#f3cbb8]/70 sm:block" aria-hidden="true" />
            <div className="relative rounded-[1.75rem] border border-white/80 bg-white p-4 shadow-[0_24px_70px_rgba(28,74,75,0.16)] sm:p-6">
              <div className="flex items-start justify-between border-b border-[#e7efec] pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#7d9696]">WU CLINIC</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#102f3d]">นัดหมายของคุณ</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e2f5f1] text-[#087f78]"><CalendarDays className="h-5 w-5" aria-hidden="true" /></div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#f5faf8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#789094]">เวลาทำการคลินิก</p>
                    <p className="mt-1 text-sm font-semibold text-[#102f3d]">จันทร์–ศุกร์ · 08:30–16:30 น.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d9f2e8] px-2.5 py-1 text-[11px] font-semibold text-[#14775f]"><span className="h-1.5 w-1.5 rounded-full bg-[#1aa77f]" aria-hidden="true" />พร้อมให้บริการ</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-[#e8efed] px-4 py-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-[#c85838]"><Stethoscope className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#102f3d]">ตรวจโรคทั่วไป</p><p className="mt-0.5 text-xs text-[#7b9093]">นัดหมายพบแพทย์ออนไลน์</p></div><ArrowRight className="h-4 w-4 text-[#9bb0b0]" aria-hidden="true" /></div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#e8efed] px-4 py-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9effb] text-[#355da8]"><Clock3 className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#102f3d]">ดูตารางแพทย์</p><p className="mt-0.5 text-xs text-[#7b9093]">ค้นหาวันและเวลาที่สะดวก</p></div><ArrowRight className="h-4 w-4 text-[#9bb0b0]" aria-hidden="true" /></div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-[#e7efec] pt-5 text-xs text-[#6f8789]"><MapPin className="h-4 w-4 text-[#1fa39a]" aria-hidden="true" />คลินิกสุขภาพ มหาวิทยาลัยวลัยลักษณ์</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e4ece9] bg-white px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-3 sm:divide-x sm:divide-[#e4ece9]">
          <div className="flex items-center gap-3 sm:px-6 sm:first:pl-0"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e2f5f1] text-[#087f78]"><Clock3 className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-xs font-medium text-[#7a9092]">เวลาทำการ</p><p className="mt-1 text-sm font-semibold text-[#102f3d]">จันทร์–ศุกร์ 08:30–16:30 น.</p></div></div>
          <div className="flex items-center gap-3 sm:px-6"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0e8] text-[#c85838]"><MapPin className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-xs font-medium text-[#7a9092]">สถานที่ให้บริการ</p><p className="mt-1 text-sm font-semibold text-[#102f3d]">มหาวิทยาลัยวลัยลักษณ์</p></div></div>
          <div className="flex items-center gap-3 sm:px-6 sm:last:pr-0"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9effb] text-[#355da8]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-xs font-medium text-[#7a9092]">การดูแลข้อมูล</p><p className="mt-1 text-sm font-semibold text-[#102f3d]">ข้อมูลของคุณเป็นส่วนตัว</p></div></div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087f78]">บริการของเรา</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#102f3d] sm:text-4xl">ดูแลทุกเรื่องสุขภาพในที่เดียว</h2><p className="mt-4 text-base leading-7 text-[#61777b]">เลือกบริการที่ต้องการ แล้วให้เราช่วยจัดการขั้นตอนที่เหลือให้เรียบง่ายขึ้น</p></div>
            <Link href="/schedules" className="inline-flex items-center gap-2 text-sm font-semibold text-[#087f78] hover:text-[#065c58]">ดูบริการทั้งหมด <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;
              return <Link key={service.title} href={service.href} className="group flex min-h-[15rem] flex-col border border-[#e1ebe7] bg-white p-6 shadow-[0_4px_18px_rgba(16,47,61,0.04)] transition duration-200 hover:-translate-y-1 hover:border-[#aad4cd] hover:shadow-[0_16px_36px_rgba(16,47,61,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${service.accent}`}><Icon className="h-6 w-6" aria-hidden="true" /></div><h3 className="mt-7 text-lg font-semibold text-[#102f3d]">{service.title}</h3><p className="mt-2 text-sm leading-6 text-[#718589]">{service.description}</p><span className="mt-auto inline-flex items-center gap-2 pt-6 text-xs font-bold text-[#087f78]">เริ่มต้นใช้งาน <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></Link>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#f1f7f4] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c85838]">ขั้นตอนง่ายๆ</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#102f3d] sm:text-4xl">พร้อมดูแลคุณ<br className="hidden sm:block" />ตั้งแต่นัดแรก</h2><p className="mt-5 max-w-md text-base leading-7 text-[#61777b]">ไม่ต้องเสียเวลารอคิวนาน จัดการนัดหมายและเตรียมตัวก่อนมาคลินิกได้ด้วยตัวเอง</p><Link href="/appointments" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#087f78] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#06635f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]">เริ่มจองนัดหมาย <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
          <div className="space-y-3">
            {steps.map((step) => <div key={step.number} className="flex gap-5 border-b border-[#d8e7e1] py-5 first:pt-0 last:border-0"><span className="shrink-0 pt-1 text-xs font-bold tracking-[0.16em] text-[#1fa39a]">{step.number}</span><div><h3 className="text-base font-semibold text-[#102f3d]">{step.title}</h3><p className="mt-1 text-sm leading-6 text-[#718589]">{step.description}</p></div><Check className="ml-auto mt-1 h-5 w-5 shrink-0 text-[#1fa39a]" aria-hidden="true" /></div>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 rounded-[1.75rem] bg-[#102f3d] px-7 py-10 text-center sm:px-12 lg:flex-row lg:text-left"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#83d6c6]">เริ่มต้นวันนี้</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">สุขภาพที่ดี เริ่มจากการนัดหมายที่ใช่</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#b6ced0]">เลือกบริการและเวลาที่เหมาะกับคุณ แล้วพบทีมดูแลของ WU Clinic ได้อย่างมั่นใจ</p></div><Link href="/appointments" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f4c6ae] px-6 text-sm font-bold text-[#102f3d] transition hover:bg-[#f9d5c2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c6ae]">จองนัดหมาย <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
      </section>
    </div>
  );
}
