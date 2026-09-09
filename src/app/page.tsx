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
    accent: "bg-brand-soft text-brand-strong",
  },
  {
    title: "ตรวจสุขภาพประจำปี",
    description: "ประเมินสุขภาพเบื้องต้นและรับคำแนะนำในการดูแลตัวเอง",
    href: "/schedules",
    icon: HeartPulse,
    accent: "bg-brand-soft text-brand-strong",
  },
  {
    title: "สุขภาพจิต",
    description: "พื้นที่ปลอดภัยสำหรับพูดคุยและรับคำปรึกษาอย่างเป็นส่วนตัว",
    href: "/appointments",
    icon: Syringe,
    accent: "bg-brand-soft text-brand-strong",
  },
  {
    title: "บริการเภสัชกรรม",
    description: "รับยาและคำแนะนำการใช้ยาที่เข้าใจง่ายและปลอดภัย",
    href: "/pharmacy",
    icon: Pill,
    accent: "bg-brand-soft text-brand-strong",
  },
];

const steps = [
  { number: "01", title: "เลือกบริการ", description: "ดูตารางแพทย์และเลือกบริการที่ตรงกับความต้องการ" },
  { number: "02", title: "เลือกวันเวลา", description: "เลือกช่วงเวลาที่สะดวก แล้วส่งคำขอนัดหมายออนไลน์" },
  { number: "03", title: "มาตามนัด", description: "แสดงรายละเอียดการนัดหมายกับเจ้าหน้าที่เมื่อมาถึงคลินิก" },
];

export default function Home() {
  return (
    <div className="overflow-hidden bg-brand-surface text-brand-ink">
      <section className="relative bg-brand-page px-5 py-14 sm:px-8 lg:min-h-[657px] lg:px-[51px] lg:py-[85px]">
        <div className="pointer-events-none absolute -right-28 -top-32 h-[26rem] w-[26rem] rounded-full bg-brand-accent/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-80 w-80 rounded-full bg-brand-soft/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-[1419px] items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-20">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand-border bg-white/65 px-3 py-1.5 text-[13px] font-semibold tracking-[0.08em] text-brand-strong">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              คลินิกสุขภาพมหาวิทยาลัยวลัยลักษณ์
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-brand-ink sm:text-6xl lg:text-[75px]">
              ดูแลสุขภาพง่ายขึ้น
              <span className="mt-2 block text-brand-strong">เริ่มต้นที่ WU Clinic</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-brand-body sm:text-[19px]">
              นัดหมายพบแพทย์ ตรวจสอบตารางบริการ และติดตามข้อมูลสุขภาพของคุณได้ในที่เดียว ออกแบบมาให้การมาคลินิกเป็นเรื่องสบายใจตั้งแต่ต้นจนจบ
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/appointments"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-brand-button bg-brand-ink px-6 text-[15px] font-semibold text-white shadow-brand-button transition hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ink"
              >
                จองนัดหมายออนไลน์
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/schedules"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-brand-button border border-brand-border-strong bg-white/65 px-6 text-[15px] font-semibold text-brand-hover transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
              >
                ดูตารางแพทย์
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-brand-body">
              สำหรับเจ้าหน้าที่และบุคลากรคลินิก <Link href="/login" className="font-semibold text-brand-strong underline decoration-brand-border underline-offset-4 hover:text-brand-hover">เข้าสู่ระบบจัดการ</Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[35rem] lg:mr-0">
            <div className="absolute -left-5 top-10 hidden h-28 w-28 rounded-[2rem] border border-brand-border bg-brand-soft/75 sm:block" aria-hidden="true" />
            <div className="absolute -bottom-5 -right-5 hidden h-36 w-36 rounded-full border-[18px] border-[lab(84.8225_12.5111_15.0679_/_0.7)] sm:block" aria-hidden="true" />
            <div className="relative rounded-brand-hero border border-white/80 bg-white p-4 shadow-brand-hero sm:p-6">
              <div className="flex items-start justify-between border-b border-brand-border-soft pb-5">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.13em] text-brand-muted">WU CLINIC</p>
                  <h2 className="mt-2 text-[21px] font-semibold tracking-[-0.03em] text-brand-ink">นัดหมายของคุณ</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-brand-button bg-brand-soft text-brand-strong"><CalendarDays className="h-5 w-5" aria-hidden="true" /></div>
              </div>

              <div className="mt-5 rounded-brand-card bg-brand-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-brand-muted">เวลาทำการคลินิก</p>
                    <p className="mt-1 text-[15px] font-semibold text-brand-ink">จันทร์–ศุกร์ · 08:30–16:30 น.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong"><span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />พร้อมให้บริการ</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 rounded-brand-card border border-brand-border-soft px-4 py-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-button bg-brand-soft text-brand-strong"><Stethoscope className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-brand-ink">ตรวจโรคทั่วไป</p><p className="mt-0.5 text-[13px] text-brand-muted">นัดหมายพบแพทย์ออนไลน์</p></div><ArrowRight className="h-4 w-4 text-brand-muted" aria-hidden="true" /></div>
                <div className="flex items-center gap-3 rounded-brand-card border border-brand-border-soft px-4 py-3.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-button bg-brand-soft text-brand-strong"><Clock3 className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-brand-ink">ดูตารางแพทย์</p><p className="mt-0.5 text-[13px] text-brand-muted">ค้นหาวันและเวลาที่สะดวก</p></div><ArrowRight className="h-4 w-4 text-brand-muted" aria-hidden="true" /></div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-brand-border-soft pt-5 text-[13px] text-brand-body"><MapPin className="h-4 w-4 text-brand" aria-hidden="true" />คลินิกสุขภาพ มหาวิทยาลัยวลัยลักษณ์</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-brand-border-soft bg-white px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-3 sm:divide-x sm:divide-brand-border-soft">
          <div className="flex items-center gap-3 sm:px-6 sm:first:pl-0"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-button bg-brand-soft text-brand-strong"><Clock3 className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-[13px] font-medium text-brand-muted">เวลาทำการ</p><p className="mt-1 text-[15px] font-semibold text-brand-ink">จันทร์–ศุกร์ 08:30–16:30 น.</p></div></div>
          <div className="flex items-center gap-3 sm:px-6"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-button bg-brand-soft text-brand-strong"><MapPin className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-[13px] font-medium text-brand-muted">สถานที่ให้บริการ</p><p className="mt-1 text-[15px] font-semibold text-brand-ink">มหาวิทยาลัยวลัยลักษณ์</p></div></div>
          <div className="flex items-center gap-3 sm:px-6 sm:last:pr-0"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand-button bg-brand-soft text-brand-strong"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-[13px] font-medium text-brand-muted">การดูแลข้อมูล</p><p className="mt-1 text-[15px] font-semibold text-brand-ink">ข้อมูลของคุณเป็นส่วนตัว</p></div></div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-2xl"><p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-strong">บริการของเรา</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-brand-ink sm:text-4xl">ดูแลทุกเรื่องสุขภาพในที่เดียว</h2><p className="mt-4 text-base leading-7 text-brand-body">เลือกบริการที่ต้องการ แล้วให้เราช่วยจัดการขั้นตอนที่เหลือให้เรียบง่ายขึ้น</p></div>
            <Link href="/schedules" className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand-strong hover:text-brand-hover">ดูบริการทั้งหมด <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;
              return <Link key={service.title} href={service.href} className="group flex min-h-[15rem] flex-col border border-brand-border-soft bg-white p-6 shadow-[0_4px_18px_rgba(16,47,61,0.04)] transition duration-200 hover:-translate-y-1 hover:border-brand-border hover:shadow-[0_16px_36px_rgba(16,47,61,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"><div className={`flex h-12 w-12 items-center justify-center rounded-brand-card ${service.accent}`}><Icon className="h-6 w-6" aria-hidden="true" /></div><h3 className="mt-7 text-lg font-semibold text-brand-ink">{service.title}</h3><p className="mt-2 text-[15px] leading-6 text-brand-body">{service.description}</p><span className="mt-auto inline-flex items-center gap-2 pt-6 text-[13px] font-bold text-brand-strong">เริ่มต้นใช้งาน <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></Link>;
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-surface px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
          <div><p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-strong">ขั้นตอนง่ายๆ</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em] text-brand-ink sm:text-4xl">พร้อมดูแลคุณ<br className="hidden sm:block" />ตั้งแต่นัดแรก</h2><p className="mt-5 max-w-md text-base leading-7 text-brand-body">ไม่ต้องเสียเวลารอคิวนาน จัดการนัดหมายและเตรียมตัวก่อนมาคลินิกได้ด้วยตัวเอง</p><Link href="/appointments" className="mt-8 inline-flex items-center gap-2 rounded-brand-button bg-brand-strong px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">เริ่มจองนัดหมาย <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
          <div className="space-y-3">
            {steps.map((step) => <div key={step.number} className="flex gap-5 border-b border-brand-border-soft py-5 first:pt-0 last:border-0"><span className="shrink-0 pt-1 text-[13px] font-bold tracking-[0.16em] text-brand">{step.number}</span><div><h3 className="text-base font-semibold text-brand-ink">{step.title}</h3><p className="mt-1 text-[15px] leading-6 text-brand-body">{step.description}</p></div><Check className="ml-auto mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden="true" /></div>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 rounded-brand-hero bg-brand-ink px-7 py-10 text-center sm:px-12 lg:flex-row lg:text-left"><div><p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-accent">เริ่มต้นวันนี้</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">สุขภาพที่ดี เริ่มจากการนัดหมายที่ใช่</h2><p className="mt-3 max-w-xl text-[15px] leading-6 text-brand-footer-text">เลือกบริการและเวลาที่เหมาะกับคุณ แล้วพบทีมดูแลของ WU Clinic ได้อย่างมั่นใจ</p></div><Link href="/appointments" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-brand-button bg-brand-accent px-6 text-[15px] font-bold text-brand-ink transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">จองนัดหมาย <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
      </section>
    </div>
  );
}
