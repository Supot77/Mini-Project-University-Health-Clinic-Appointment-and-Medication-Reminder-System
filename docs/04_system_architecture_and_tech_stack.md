# 04. สถาปัตยกรรมและจุดเชื่อมระบบ

ปรับปรุง 7 กันยายน 2569 (2026-09-07) — ฉบับ scope manual ขนาดเล็กตาม D22 ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

package.json เป็นแหล่งอ้างอิงเวอร์ชันจริงของ Next.js, React, TypeScript, Tailwind CSS, Supabase และ Vitest ห้ามยึดเอกสารเวอร์ชันเก่าแทน package ที่ติดตั้งจริง

Role contract กลางมี 3 ค่าเท่านั้น: `patient`, `medical` (แพทย์/เภสัชกร) และ `staff_admin` (เจ้าหน้าที่/แอดมิน)

## ชั้นการทำงาน

- `src/app` และ components: ฟอร์มและหน้าจอตาม role พร้อม loading/empty/error และ keyboard
- services/hooks: เรียกข้อมูลและคำสั่งผ่าน repository contract
- mock repository: implementation ที่เปิดใช้ในปัจจุบันและต้อง deterministic
- database adapter: เตรียม contract ได้ แต่ยังไม่เปิด runtime และห้าม request ฐานจริง
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
├── Client UI: ฟอร์มและหน้าตาม role
├── Services/Repositories: contract และ mock adapter
└── Supabase (เตรียมไว้): Auth/ฐานข้อมูลสำหรับอนาคต ไม่เปิดใช้ในรอบ mock
```

## ขอบเขตเทคโนโลยีและการตรวจ

- ใช้ Supabase Auth ได้ตาม implementation ที่มีอยู่ แต่ห้ามเปิด `service_role` ใน browser
- Automated tests ห้ามใช้ network, บัญชีภายนอก หรือฐานข้อมูลจริง
- role contract ปัจจุบันใช้ 3 ค่าและมี migration สำหรับรวมค่า legacy; migration ยังไม่ถูกรันกับฐานจริง และ runtime ยังใช้ mock adapter
- ก่อนส่งมอบต้องผ่าน lint, typecheck, test และ build พร้อมตรวจ Chrome 360px/1280px, keyboard, loading, empty และ error

## ลำดับการประมวลผลคำสั่ง

1. UI อ่าน session และส่งคำสั่งผ่าน service/repository contract ไม่แก้ mock data ตรง ๆ
2. service ตรวจ role, input, ความเป็นเจ้าของ และความสัมพันธ์กับข้อมูลที่เกี่ยวข้อง
3. mock repository อ่านหรือเขียนข้อมูลแบบ deterministic แล้วคืนผลสำเร็จหรือ error
4. UI แสดงผลลัพธ์และสถานะ loading/empty/error; เมื่อคำสั่งล้มเหลวต้องใช้ข้อมูลเดิม
5. database adapter ในอนาคตต้องรับ contract เดียวกัน แต่รอบนี้ยังไม่เปิด runtime และไม่เรียกฐานจริง

## จุดเชื่อมระหว่างโมดูล

| จุดเชื่อม | ข้อมูลที่ต้องส่งต่อ | สิ่งที่ผู้รับต้องตรวจ |
| --- | --- | --- |
| Auth → ทุกโมดูล | user ID, role และ session | session ยังใช้ได้ และ role อยู่ใน 3 ค่ากลาง |
| Schedule → Appointment | slot, แพทย์, วันเวลา, capacity, status | slot ยังว่างและความจุไม่เกิน |
| Appointment → Medical | appointment, ผู้ป่วย, แพทย์, สถานะตรวจ | ผู้ทำเป็นผู้รับผิดชอบนัด |
| Medical → Pharmacy | รายการยาและจำนวนที่สั่ง | จ่ายได้เต็มตามจำนวนหรือปฏิเสธโดยไม่ตัด stock |
| Pharmacy → Reminder | รายการจ่ายเต็มและผู้ป่วย | เตือนเฉพาะรายการที่จ่ายเต็ม |
| ทุกโมดูล → UI | ผลสำเร็จหรือ error | ไม่รายงานสำเร็จเมื่อ state ไม่ได้เปลี่ยนตามคำสั่ง |

ตารางนี้ขยายความจาก contract เดิมเพื่อให้ทีมตรวจจุดเชื่อมตรงกัน ไม่ได้เพิ่ม adapter หรือบริการภายนอกใหม่
