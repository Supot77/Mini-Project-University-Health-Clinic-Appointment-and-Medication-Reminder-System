# 05. โฟลเดอร์และข้อตกลง Git

ปรับปรุง 7 กันยายน 2569 (2026-09-07) — ฉบับ scope manual ขนาดเล็กตาม D22 ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

ทุกโมดูลใช้ role กลางชุดเดียว: `patient`, `medical` (แพทย์/เภสัชกร) และ `staff_admin` (เจ้าหน้าที่/แอดมิน)

## พื้นที่งาน

โครงสร้างที่พบ: src/app/(auth), (clinic), (patient), (dashboard); src/components, src/services, src/hooks, src/lib, src/types และ supabase/migrations, supabase/seed.sql ใช้โครงสร้างจริงแทนตัวอย่างเส้นทางที่ตั้งตามชื่อสมาชิก

| เจ้าของ | งาน | ผู้ตรวจ |
| --- | --- | --- |
| ฟีม | สมาชิก โปรไฟล์ สิทธิ์และ session | เฮิร์บ |
| ช้อป | แผนก แพทย์ ตารางและ slot | ปาย |
| ปาย | นัด คิว ผลตรวจ และรายการยา | ช้อป |
| กัญจน์ | คลังและจ่ายเต็ม | กลอง |
| กลอง | รายการเตือนแบบ manual | กัญจน์ |
| เฮิร์บ | Broadcast และ Dashboard | ฟีม |

ไฟล์กลางให้ประสานหัวหน้าทีมและเจ้าของโมดูลพร้อมคู่ตรวจ ไม่แก้สัญญาข้อมูลของเพื่อนโดยไม่แจ้ง งานเอกสารครั้งนี้ได้รับคำสั่งเจ้าของโครงการให้ปรับทั้งชุด

## Git และตรวจงาน

ใช้แนวทาง feature → develop → main ตามกิ่งจริงใน repository ไม่มีการสร้าง เปลี่ยนชื่อ หรือ merge branch ในงานเอกสารนี้

- ก่อนส่ง PR ดึงงานร่วมและแก้ conflict ตรวจ diff ว่าอยู่ในขอบเขต
- คู่ตรวจรับผิดชอบตรวจซึ่งกันและกัน: ฟีม↔เฮิร์บ ช้อป↔ปาย กัญจน์↔กลอง
- ก่อนรวม main ต้องผ่าน lint, typecheck, build และกรณีทดสอบหลัก; AC01–AC15 ต้องผ่านก่อนนำเสนอ
- ไม่ commit ความลับ .env.local หรือ service_role; .env.example มีเพียงชื่อค่าและ placeholder ไม่ใช่คีย์จริง
- ผู้รวมโค้ดและผู้ดูแลไฟล์กลางรายบุคคลยังต้องระบุ ไม่ถือว่าคู่ตรวจเป็นผู้อนุมัติทุกการเปลี่ยนแปลงโดยอัตโนมัติ

รายละเอียดวันส่งอยู่ใน [06](06_development_roadmap.md) สัญญาส่งต่อใน [09](09_implementation_plan.md)

## โครงสร้างโฟลเดอร์ปัจจุบัน

```text
wu-clinic-booking/
├── src/app/                 # route groups: (auth), (clinic), (patient), (dashboard)
├── src/components/          # common, layout, schedules, reminders, dashboard
├── src/context/ src/hooks/  # AuthContext และ hooks
├── src/lib/                 # Supabase client/helper
├── src/services/            # Auth, Schedule, Appointment, Medication, Reminder, Dashboard
├── src/types/               # contract TypeScript กลาง
├── supabase/migrations/     # schema/RLS และ migration รวม role; ยังไม่รันกับฐานจริง
├── supabase/seed.sql        # seed เดิม
└── docs/                    # ข้อกำหนด แผน Catalog และ SQL อ้างอิง
```

ไฟล์กลาง เช่น `globals.css`, layout, `src/types/database.ts`, Supabase client และ migration ต้องแจ้งเจ้าของที่กระทบก่อนแก้ ไม่ใช่พื้นที่ห้ามแตะ แต่ต้องรวมอย่างระวังและมีคู่ตรวจ

## วงจร Git รายวัน

1. เริ่มจาก `develop` ล่าสุด สร้างกิ่ง `feat/<module>-<summary>` ของตน
2. แก้เฉพาะโมดูลและ contract ที่ตกลง หากต้องแก้ไฟล์กลางให้แจ้งใน PR
3. ก่อนเปิด PR ดึง `develop` มาแก้ conflict และรัน gate ที่เกี่ยวข้อง
4. เปิด PR จาก feature ไป `develop`; คู่ตรวจตรวจสิทธิ์, contract และกรณีทดสอบ ไม่รวมเข้า `main` ตรง
5. ผู้รวมงาน merge หลังผ่าน lint, typecheck, build และกรณีหลัก; เก็บหลักฐาน SCN ก่อนนำเสนอ

ตัวอย่างคำสั่งใช้ได้เมื่อเริ่มพัฒนา: `git switch develop`, `git pull`, `git switch -c feat/<module>-<summary>`, `git status`, `git add`, `git commit`, `git push -u origin <branch>` ห้าม commit key หรือข้อมูลจริง

## หลักแยกความรับผิดชอบของไฟล์

| พื้นที่ | หน้าที่ | ขอบเขตการแก้ |
| --- | --- | --- |
| `src/app` และ `src/components` | route, หน้าจอ และการแสดงสถานะ | ไม่ฝัง mock data หรือกติกาสิทธิ์แทน service |
| `src/services`, `src/hooks`, `src/features` | คำสั่งและการประสานงานของโมดูล | เรียกผ่าน contract และคืน error ที่ UI ใช้ได้ |
| `src/types` | type/contract ที่หลายโมดูลใช้ร่วมกัน | เปลี่ยนต้องตรวจผู้ใช้ทุกจุดและแจ้งเจ้าของไฟล์กลาง |
| `src/mocks` และ mock repository | ข้อมูลสังเคราะห์และ adapter ปัจจุบัน | ต้อง deterministic และไม่เรียก network/ฐานจริง |
| `supabase/migrations` | แบบ schema/RLS ที่เตรียมไว้ | ห้ามถือว่า deploy แล้ว และห้ามรันฐานจริงจากงาน mock |
| `docs` และ `tests` | ข้อกำหนด/แผน และหลักฐานพฤติกรรม | ต้องสอดคล้องกับ role 3 ค่าและ scope manual |

## เช็กลิสต์ก่อนเปิด PR

- ตรวจว่าไฟล์อยู่ในโมดูลของตนเอง หรือมีการแจ้งเจ้าของไฟล์กลางแล้ว
- ตรวจ role, ชื่อข้อมูล, contract และ FR ที่ได้รับผลกระทบให้ใช้คำเดียวกัน
- ทดสอบ success, validation, permission และยืนยัน state เดิมเมื่อคำสั่งล้มเหลว
- ตรวจ diff และ `git status` ไม่ให้มี secret, debug code หรืองานของผู้อื่นติดไป
- ระบุไฟล์ที่แก้ ผลกระทบ คู่ตรวจ และ quality gates ที่รันจริงใน PR
