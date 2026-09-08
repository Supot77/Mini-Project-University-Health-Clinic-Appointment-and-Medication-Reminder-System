# 09. แผนพัฒนาและส่งต่องาน

ปรับปรุง 7 กันยายน 2569 (2026-09-07) — แผนฉบับ scope manual ขนาดเล็กตาม D22 ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

## หลักการก่อนลงโค้ด

1. ใช้ FR ใน [11](11_functional_requirements.md) และเกณฑ์ใน [08](08_system_rules_and_acceptance.md) เป็นขอบเขตปัจจุบัน
2. ตัด worker, cron, email, retry, catch-up, status transition ตามเวลา และ schema สำหรับแบ่งจ่าย/กันยา/ยาค้างออกจากงานใหม่
3. แยก UI จาก service/repository contract ใช้ Supabase database repository เป็น runtime หลัก และใช้ mock ที่ deterministic เฉพาะ automated tests/offline demo
4. แก้เฉพาะไฟล์ในขอบเขตของโมดูล เพิ่ม test สำหรับ success, validation, permission และยืนยันว่า error ไม่เปลี่ยน state
5. รัน migration/seed หรือ database integration กับ development/staging ได้หลังยืนยัน target, review diff, สำรองข้อมูลตามความเสี่ยง และได้รับอนุญาตก่อนกระทบ remote database
6. ทุก role มี guarded entry page/dashboard และแยก role-specific page/container เมื่อ data, action หรือ permission ต่างกัน โดย reuse shared presentational components

## Role contract

ใช้ 3 ค่าเท่านั้น: `patient` (ผู้ป่วย), `medical` (แพทย์/เภสัชกร) และ `staff_admin` (เจ้าหน้าที่/แอดมิน)

## ลำดับ implementation

| ลำดับ | งาน | ผลลัพธ์ |
| --- | --- | --- |
| 1 | Database foundation | ตรวจ migration/RLS/RPC, Supabase clients และ repository factory ให้ database เป็น runtime หลัก |
| 2 | Auth/profile/role shell | สมัคร login session, role guards และ entry page/dashboard สำหรับ 3 roles |
| 3 | Schedule | Supabase repository; `medical`/`staff_admin` จัดการ service catalog, daily offering, แพทย์และ slot โดยแผนกใช้บอกความถนัด |
| 4 | Appointment | role-specific containers; `patient` จอง, `staff_admin` ตัดสิน, `medical` เริ่ม/จบตรวจ |
| 5 | Medical record | `medical` บันทึกผลตรวจ/รายการยา; `patient` อ่านของตนผ่าน RLS |
| 6 | Pharmacy | `medical` ตรวจ stock และจ่ายเต็มครั้งเดียวผ่าน transaction/RPC ที่จำเป็น |
| 7 | Manual reminder | `staff_admin` กรอกรายการเตือน; `patient` บันทึกผลเอง |
| 8 | Broadcast/dashboard | `staff_admin` ส่งข้อความเอง และแต่ละ role ใช้ dashboard/container ของตน |
| 9 | ตรวจรับ | รัน tests, database integration/RLS และตรวจ AC01–AC18 ตาม [08](08_system_rules_and_acceptance.md) |

## สัญญาส่งต่องานขั้นต่ำ

| ผู้ส่ง → ผู้รับ | ข้อมูลที่ต้องมี |
| --- | --- |
| Auth → ทุกโมดูล | user ID, 3-value role, session validity และขอบเขตข้อมูล |
| Schedule → Appointment | slot ID, service ID, daily service offering ID, doctor ID, วันเวลาไทย, capacity และสถานะ slot |
| Appointment → Medical | appointment ID, patient ID, doctor ID และสถานะการตรวจ |
| Medical → Pharmacy | prescription/รายการยาและจำนวนที่สั่ง |
| Pharmacy → Reminder | dispensing ID และจำนวนที่จ่ายเต็ม |
| ทุกโมดูล → UI | ผลสำเร็จหรือ error ที่แสดงได้ และข้อมูลเดิมเมื่อคำสั่งล้มเหลว |

## สิ่งที่ไม่ต้องทำในรอบนี้

การเลื่อนนัดแบบข้อเสนอ การยืนยันเมื่อครบเวลา การ no-show/missed อัตโนมัติ การแบ่งจ่าย การกันยา ยาค้าง การแก้ใบสั่งแบบ version การตรวจแพ้ยาอัตโนมัติ การเตือนซ้ำ email/Web Push worker/cron/retry และการเชื่อมบริการภายนอก

## ผู้รับผิดชอบ

| เจ้าของ | งาน | ผู้ตรวจ |
| --- | --- | --- |
| ฟีม | สมาชิก โปรไฟล์ สิทธิ์และ session | เฮิร์บ |
| ช้อป | service catalog, daily offering, แผนกความถนัด, แพทย์ ตารางและ slot | ปาย |
| ปาย | นัด คิว ผลตรวจ และรายการยา | ช้อป |
| กัญจน์ | คลังและจ่ายเต็ม | กลอง |
| กลอง | รายการเตือนแบบ manual | กัญจน์ |
| เฮิร์บ | Broadcast และ Dashboard | ฟีม |

## หลักฐานก่อนส่งงาน

รัน `npm run lint`, `npx --no-install tsc --noEmit`, `npm run test` และ `npm run build` จาก root ในสถานะโค้ดล่าสุด รายงานผลจริงทุกคำสั่ง และระบุส่วนที่ยังไม่ได้ตรวจ งาน database-first ต้องมีหลักฐาน database integration/RLS จากฐาน development หรือ staging แยกจาก unit test ไม่ใช้เอกสารแทนหลักฐานการทดสอบ

## Dependency ของงาน

| งานก่อนหน้า | งานที่ใช้ต่อ | เหตุผล |
| --- | --- | --- |
| Auth/profile/role | ทุกโมดูล | ทุกคำสั่งต้องรู้ user ID, role และ session |
| Schedule | Appointment | การจองต้องอ้าง service offering, slot, แพทย์, เวลา และความจุที่มีอยู่ |
| Appointment | Medical record | ผลตรวจต้องผูกกับนัด ผู้ป่วย และแพทย์ที่รับผิดชอบ |
| Medical record | Pharmacy/Reminder | รายการยาต้องมาจากผลตรวจ และเตือนเฉพาะยาที่จ่ายเต็ม |
| ข้อมูลจากทุกโมดูล | Dashboard/Broadcast | แสดงหรือส่งเฉพาะข้อมูลที่บันทึกแล้ว |
| ทุกงานข้างต้น | ตรวจรับ | ต้องทดสอบ flow รวม ไม่ใช่เฉพาะหน้าของโมดูลเดียว |

## Definition of Done สำหรับแต่ละโมดูล

โมดูลถือว่าพร้อมส่งต่อเมื่อมี contract ที่ระบุ input/output และ error, Supabase repository ที่ใช้ session/RLS, mock repository สำหรับ tests, role-specific container เมื่อจำเป็น, ครอบคลุม success/validation/permission และแจ้งผลกระทบต่อไฟล์กลาง หากคำสั่งไม่ผ่านต้องพิสูจน์ว่า state เดิมไม่เปลี่ยน การมีหน้าจอ mock data หรือ query ที่ยังไม่ตรวจ RLS เพียงอย่างเดียวไม่ถือว่าพร้อมส่งต่อ

ผู้รับงานต้องตรวจข้อมูลส่งต่อกับข้อมูลในตารางสัญญา, ทดลองกรณีสำเร็จและกรณีถูกปฏิเสธ แล้วบันทึกข้อจำกัดหรือสิ่งที่ยังไม่ได้ตรวจไว้ก่อนเชื่อมกับโมดูลถัดไป
