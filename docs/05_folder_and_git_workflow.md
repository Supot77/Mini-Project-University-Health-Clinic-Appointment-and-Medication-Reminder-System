# 05. โฟลเดอร์และข้อตกลง Git

ปรับปรุง 5 กันยายน 2569 (2026-09-05) — ข้อกำหนดสำหรับพัฒนา ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

## พื้นที่งาน

โครงสร้างที่พบ: src/app/(auth), (clinic), (patient), (dashboard); src/components, src/services, src/hooks, src/lib, src/types และ supabase/migrations, supabase/seed.sql ใช้โครงสร้างจริงแทนตัวอย่างเส้นทางที่ตั้งตามชื่อสมาชิก

| เจ้าของ | งาน | ผู้ตรวจ |
| --- | --- | --- |
| ฟีม | สมาชิก โปรไฟล์ สิทธิ์และ session | เฮิร์บ |
| ช้อป | แผนก แพทย์ ตารางและความจุรอบ | ปาย |
| ปาย | นัด เลื่อนนัด คิว ผลตรวจและแก้ใบสั่ง | ช้อป |
| กัญจน์ | คลัง แบ่งจ่าย กันยาและค้างจ่าย | กลอง |
| กลอง | เจ้าหน้าที่ตั้งเตือน ผู้ป่วยยืนยันเวลา บันทึกมื้อและอีเมล | กัญจน์ |
| เฮิร์บ | แจ้งเตือน Broadcast และ Dashboard 4 บทบาท (ไม่รวม Patient) | ฟีม |

ไฟล์กลางให้ประสานหัวหน้าทีมและเจ้าของโมดูลพร้อมคู่ตรวจ ไม่แก้สัญญาข้อมูลของเพื่อนโดยไม่แจ้ง งานเอกสารครั้งนี้ได้รับคำสั่งเจ้าของโครงการให้ปรับทั้งชุด

## Git และตรวจงาน

ใช้แนวทาง feature → develop → main ตามกิ่งจริงใน repository ไม่มีการสร้าง เปลี่ยนชื่อ หรือ merge branch ในงานเอกสารนี้

- ก่อนส่ง PR ดึงงานร่วมและแก้ conflict ตรวจ diff ว่าอยู่ในขอบเขต
- คู่ตรวจรับผิดชอบตรวจซึ่งกันและกัน: ฟีม↔เฮิร์บ ช้อป↔ปาย กัญจน์↔กลอง
- ก่อนรวม main ต้องผ่าน lint, typecheck, build และกรณีทดสอบหลัก; SCN-01–07 ต้องผ่านก่อนนำเสนอ
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
├── supabase/migrations/     # schema/RLS เดิม; ยังไม่ sync ข้อสรุปล่าสุด
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
