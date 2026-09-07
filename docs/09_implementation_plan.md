# 09. แผนพัฒนาและส่งต่องาน

ปรับปรุง 7 กันยายน 2569 (2026-09-07) — แผนฉบับ scope manual ขนาดเล็กตาม D22 ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

## หลักการก่อนลงโค้ด

1. ใช้ FR ใน [11](11_functional_requirements.md) และเกณฑ์ใน [08](08_system_rules_and_acceptance.md) เป็นขอบเขตปัจจุบัน
2. ตัด worker, cron, email, retry, catch-up, status transition ตามเวลา และ schema สำหรับแบ่งจ่าย/กันยา/ยาค้างออกจากงานใหม่
3. แยก UI จาก service/repository contract และใช้ mock ที่ deterministic ต่อไป
4. แก้เฉพาะไฟล์ในขอบเขตของโมดูล เพิ่ม test สำหรับ success, validation, permission และยืนยันว่า error ไม่เปลี่ยน state
5. ไม่รัน migration, seed หรือ request ไปฐานข้อมูลจริงจากงานนี้

## ลำดับ implementation

| ลำดับ | งาน | ผลลัพธ์ |
| --- | --- | --- |
| 1 | Auth/profile/role | สมัคร login session และสิทธิ์พื้นฐาน |
| 2 | Schedule | Staff กรอกแผนก แพทย์ slot และปิด slot ด้วยมือ |
| 3 | Appointment | Patient จอง; Staff อนุมัติ/ปฏิเสธ/ยกเลิก; Doctor เริ่ม/จบตรวจ |
| 4 | Medical record | Doctor บันทึกผลตรวจและรายการยา; Patient อ่านของตน |
| 5 | Pharmacy | Pharmacist ตรวจ stock และจ่ายเต็มครั้งเดียว |
| 6 | Manual reminder | Staff กรอกรายการเตือน; Patient บันทึกผลเอง |
| 7 | Broadcast/dashboard | Admin ส่งข้อความเอง และแต่ละ role ดูข้อมูลที่บันทึกแล้ว |
| 8 | ตรวจรับ | รัน tests และตรวจ AC01–AC15 ตาม [08](08_system_rules_and_acceptance.md) |

## สัญญาส่งต่องานขั้นต่ำ

| ผู้ส่ง → ผู้รับ | ข้อมูลที่ต้องมี |
| --- | --- |
| Auth → ทุกโมดูล | user ID, role, session validity และขอบเขตข้อมูล |
| Schedule → Appointment | slot ID, doctor ID, วันเวลาไทย, capacity และสถานะ slot |
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
| ช้อป | แผนก แพทย์ ตารางและ slot | ปาย |
| ปาย | นัด คิว ผลตรวจ และรายการยา | ช้อป |
| กัญจน์ | คลังและจ่ายเต็ม | กลอง |
| กลอง | รายการเตือนแบบ manual | กัญจน์ |
| เฮิร์บ | Broadcast และ Dashboard | ฟีม |

## หลักฐานก่อนส่งงาน

รัน `npm run lint`, `npx --no-install tsc --noEmit`, `npm run test` และ `npm run build` จาก root ในสถานะโค้ดล่าสุด รายงานผลจริงทุกคำสั่ง และระบุส่วนที่ยังไม่ได้ตรวจ ไม่ใช้เอกสารแทนหลักฐานการทดสอบ
