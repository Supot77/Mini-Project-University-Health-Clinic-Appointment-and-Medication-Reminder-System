# 04. สถาปัตยกรรมและจุดเชื่อมระบบ

ปรับปรุง 7 กันยายน 2569 (2026-09-07) — ฉบับ scope manual ขนาดเล็กตาม D22 ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

package.json เป็นแหล่งอ้างอิงเวอร์ชันจริงของ Next.js, React, TypeScript, Tailwind CSS, Supabase และ Vitest ห้ามยึดเอกสารเวอร์ชันเก่าแทน package ที่ติดตั้งจริง

## ชั้นการทำงาน

- `src/app` และ components: ฟอร์มและหน้าจอตาม role พร้อม loading/empty/error และ keyboard
- services/hooks: เรียกข้อมูลและคำสั่งผ่าน repository contract
- mock repository: implementation ที่เปิดใช้ในปัจจุบันและต้อง deterministic
- database adapter: เตรียม contract ได้ แต่ยังไม่เปิด runtime และห้าม request ฐานจริง
- ไม่มี worker, cron, queue, email provider, Web Push หรือการเปลี่ยนสถานะตามเวลา

## หลักการธุรกรรมและสิทธิ์

คำสั่งแต่ละรายการต้องตรวจ role, input และความสัมพันธ์ของข้อมูลก่อนบันทึก เช่น จอง slot, อนุมัตินัด, จบตรวจ และจ่ายยา หากไม่ผ่านต้องไม่เปลี่ยน state เดิม ไม่เพิ่ม idempotency workflow หรือ transaction สำหรับฟีเจอร์ที่ถูกตัดออกจาก scope

สิทธิ์ต้องตรวจที่ service/data layer ไม่อาศัยการซ่อนเมนู ผู้ป่วยอ่านข้อมูลของตนเองเท่านั้น Staff/Pharmacist ไม่เห็น diagnosis และ Admin ไม่มีสิทธิ์คลินิกโดยอัตโนมัติ

## ลำดับข้อมูลหลัก

```text
Patient จอง slot
  → Staff อนุมัตินัด
  → Doctor บันทึกผลตรวจและรายการยา
  → Pharmacist จ่ายเต็มด้วยมือ
  → Staff กรอกรายการเตือน
  → Patient บันทึกผลเตือนด้วยมือ
```

ทุกลูกศรเกิดจากคำสั่งของผู้ใช้ที่มีสิทธิ์ ไม่มีงานที่ทำต่อเองเมื่อเวลาผ่านไปหรือเมื่อปิดเว็บ

## ภาพรวมชั้นระบบ

```text
Next.js App Router
├── Client UI: ฟอร์มและหน้าตาม role
├── Services/Repositories: contract และ mock adapter
└── Supabase (เตรียมไว้): Auth/ฐานข้อมูลสำหรับอนาคต ไม่เปิดใช้ในรอบ mock
```

## ขอบเขตเทคโนโลยีและการตรวจ

- ใช้ Supabase Auth ได้ตาม implementation ที่มีอยู่ แต่ห้ามเปิด `service_role` ใน browser
- Automated tests ห้ามใช้ network, บัญชีภายนอก หรือฐานข้อมูลจริง
- งานเอกสารนี้ไม่เปลี่ยน migration, seed, types หรือ runtime ให้ใช้ database adapter
- ก่อนส่งมอบต้องผ่าน lint, typecheck, test และ build พร้อมตรวจ Chrome 360px/1280px, keyboard, loading, empty และ error
