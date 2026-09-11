# 04. สถาปัตยกรรมและจุดเชื่อมระบบ

ปรับปรุง 9 กันยายน 2569 (2026-09-09) — target architecture ตาม scope manual และหมายเหตุ as-built จาก code path; ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

package.json เป็นแหล่งอ้างอิงเวอร์ชันจริงของ Next.js, React, TypeScript, Tailwind CSS, Supabase และ Vitest ห้ามยึดเอกสารเวอร์ชันเก่าแทน package ที่ติดตั้งจริง

Role contract กลางมี 3 ค่าเท่านั้น: `patient`, `medical` (แพทย์/เภสัชกร) และ `staff_admin` (เจ้าหน้าที่/แอดมิน)

## หมายเหตุจากการ reverse-engineer

เอกสารนี้ยังเป็น target architecture; จาก code path ปัจจุบัน route นัดหมาย/ผลตรวจใช้ PAI database repository และ RPC ตามที่ออกแบบ แต่ schedule บางคำสั่ง, dashboard metric, reminders และ pharmacy ยังมี mock/direct-service/local-storage path. ให้ใช้ [02](02_user_stories.md), [03](03_database_design_and_er.md) และ [11](11_functional_requirements.md) เป็นตาราง as-built gap และอย่าอ้างส่วน target ด้านล่างเป็นหลักฐานว่า runtime ทุกโมดูลใช้ DB จริงแล้ว

## ชั้นการทำงาน

- `src/app` และ components: ฟอร์มและหน้าจอตาม role พร้อม loading/empty/error และ keyboard
- role-specific pages/containers: แยก data loader, action และ permission boundary เมื่อ role เห็นข้อมูลหรือทำคำสั่งต่างกัน
- services/hooks: เรียกข้อมูลและคำสั่งผ่าน repository contract
- database repository: implementation หลักของ runtime เชื่อม Supabase ด้วย session ของผู้ใช้และ RLS/RPC
- mock repository: implementation สำหรับ automated tests และ offline demo ต้อง deterministic และใช้ contract เดียวกับ database repository
- ไม่มี worker, cron, queue, email provider, Web Push หรือการเปลี่ยนสถานะตามเวลา

## หลักการธุรกรรมและสิทธิ์

คำสั่งแต่ละรายการต้องตรวจ role, input และความสัมพันธ์ของข้อมูลก่อนบันทึก เช่น จอง slot, อนุมัตินัด, จบตรวจ และจ่ายยา หากไม่ผ่านต้องไม่เปลี่ยน state เดิม ไม่เพิ่ม idempotency workflow หรือ transaction สำหรับฟีเจอร์ที่ถูกตัดออกจาก scope

สิทธิ์ต้องตรวจที่ service/data layer ไม่อาศัยการซ่อนเมนู `patient` อ่านข้อมูลของตนเองเท่านั้น `medical` เห็นข้อมูลตามงานที่รับผิดชอบ และ `staff_admin` เห็นข้อมูลรวมตามสิทธิ์โดยไม่เปิดเผย diagnosis ใน Dashboard

## ลำดับข้อมูลหลัก

```text
ผู้ป่วยจอง slot
  → เจ้าหน้าที่/แอดมินอนุมัตินัด
  → แพทย์/เภสัชกรบันทึกผลตรวจและจัดการรายการยา
  → เจ้าหน้าที่/แอดมินกรอกรายการเตือน
  → ผู้ป่วยบันทึกผลเตือนด้วยมือ
```

ทุกลูกศรเกิดจากคำสั่งของผู้ใช้ที่มีสิทธิ์ ไม่มีงานที่ทำต่อเองเมื่อเวลาผ่านไปหรือเมื่อปิดเว็บ

## ภาพรวมชั้นระบบ

```text
Next.js App Router
├── Route/layout guards: ตรวจ session และส่งผู้ใช้เข้า entry page ของ role
├── Role-specific pages/containers: patient, medical, staff_admin
├── Shared UI: presentational components ที่ไม่มี permission logic
├── Services/Repositories: domain contract + Supabase implementation
└── Supabase: Auth, PostgreSQL, RLS และ RPC ที่จำเป็นต่อ transaction
```

## ขอบเขตเทคโนโลยีและการตรวจ

- ใช้ Supabase Auth และ database เป็น runtime หลัก แต่ห้ามเปิด `service_role` ใน browser
- Automated unit/component tests ใช้ mock/fake และห้ามใช้ network หรือฐานจริง; database integration tests แยกชุดและใช้ฐานทดสอบที่ระบุชัด
- role contract ปัจจุบันใช้ 3 ค่าและ migration/RLS ต้องรองรับค่า canonical เดียวกันก่อน deploy
- ก่อนส่งมอบต้องผ่าน lint, typecheck, test และ build พร้อมตรวจ Chrome 360px/1280px, keyboard, loading, empty และ error

## ลำดับการประมวลผลคำสั่ง

1. Route/layout guard อ่าน session และ role จาก Supabase แล้วเลือก entry page หรือ role-specific container ที่ถูกต้อง
2. UI ส่งคำสั่งผ่าน service/repository contract และไม่เขียน Supabase query หรือ mock data โดยตรง
3. service ตรวจ role, input, ownership และความสัมพันธ์ข้อมูลก่อนเรียก database repository
4. database repository ใช้ Supabase client ตาม execution context และให้ RLS/RPC ตรวจสิทธิ์/transaction ซ้ำ
5. UI แสดง loading/empty/error และคงข้อมูลเดิมเมื่อคำสั่งล้มเหลว; tests inject mock repository ผ่าน contract เดียวกัน

## จุดเชื่อมระหว่างโมดูล

| จุดเชื่อม | ข้อมูลที่ต้องส่งต่อ | สิ่งที่ผู้รับต้องตรวจ |
| --- | --- | --- |
| Auth → ทุกโมดูล | user ID, role และ session | session ยังใช้ได้ และ role อยู่ใน 3 ค่ากลาง |
| Schedule → Appointment | slot, แพทย์, วันเวลา, capacity, status | slot ยังว่างและความจุไม่เกิน |
| Appointment → Medical | appointment, ผู้ป่วย, แพทย์, สถานะตรวจ | ผู้ทำเป็นผู้รับผิดชอบนัด |
| Medical → Pharmacy | รายการยาและจำนวนที่สั่ง | จ่ายได้เต็มตามจำนวนหรือปฏิเสธโดยไม่ตัด stock |
| Pharmacy → Reminder | รายการจ่ายเต็มและผู้ป่วย | เตือนเฉพาะรายการที่จ่ายเต็ม |
| ทุกโมดูล → UI | ผลสำเร็จหรือ error | ไม่รายงานสำเร็จเมื่อ state ไม่ได้เปลี่ยนตามคำสั่ง |

ตารางนี้ขยายความจาก contract เดิมเพื่อให้ทีมตรวจจุดเชื่อมตรงกัน Database repository เป็น adapter ภายนอกหลักเพียงชุดเดียวของ runtime; บริการอื่นยังอยู่นอก scope
