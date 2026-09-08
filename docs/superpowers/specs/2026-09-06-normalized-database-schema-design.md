# แบบฐานข้อมูลธุรกรรมแบบแยกตาราง

วันที่รับรอง: 6 กันยายน 2569 (2026-09-06)

> สถานะ: เอกสารประวัติของ normalized schema รุ่นเก่า ข้อกำหนดไม่รันฐานจริงถูก supersede โดย D23 ใน `docs/10_team_decisions.md` การเลือก migration ปัจจุบันให้ยึด `docs/03_database_design_and_er.md` และต้องตรวจ target/RLS ก่อน deploy

## สถานะและขอบเขต

ทีมรับรองให้ใช้แบบแยกตารางแทนการเก็บธุรกรรมยาใน `medical_records.prescribed_medications` เพียงจุดเดียว ฐานปัจจุบันมีแต่ข้อมูลทดลอง จึงไม่ต้องย้ายข้อมูล JSONB เดิมเข้าสู่ตารางใหม่

งานนี้ใช้ migration แบบ additive ชื่อ `03_normalized_transactions.sql` ไม่แก้ `01_schema.sql` หรือ `02_rls.sql` ซึ่งอาจเคยถูกรันแล้ว Runtime ยังใช้ mock repository ตามเดิม และ migration จะไม่ถูกรันกับฐานจริงในงานนี้

## หลักการ compatibility

- คง 11 ตารางเดิมและ primary key เดิม
- คง `medical_records.prescribed_medications` ชั่วคราวเพื่อไม่ทำให้โค้ดเดิมเสีย แต่ห้ามใช้เป็นแหล่งข้อมูลหลักสำหรับธุรกรรมใหม่
- `prescription_items` เป็นแหล่งข้อมูลหลักของรายการยาที่สั่งหลังใช้ schema ใหม่
- เพิ่ม column ด้วย `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` และสร้างตาราง/index แบบ idempotent เท่าที่ PostgreSQL รองรับ
- ไม่ backfill, truncate, drop หรือแก้ข้อมูลเดิม
- ใช้ `timestamptz` สำหรับเหตุการณ์และเส้นตาย การตีความวัน/รอบแสดงผลใช้ `Asia/Bangkok` ใน domain/service

## การปรับ 11 ตารางเดิม

### สมาชิกและโครงสร้างคลินิก

- `profiles`: เพิ่ม `patient_type`, `employee_id`, `organization`, สถานะแพ้ยา/โรคประจำตัวแบบ `yes|no|unknown`, `is_active`, `permission_version`
- `departments`: เพิ่ม `is_active` เพื่อปิดใช้งานโดยรักษาประวัติ
- `appointment_slots`: เพิ่ม constraint เวลาเริ่มก่อนเวลาจบ ความจุเป็นบวก จำนวนจองอยู่ระหว่างศูนย์กับความจุ และจำกัดสถานะ `available|full|closed`
- `appointments`: เพิ่ม constraint สถานะ `pending|confirmed|in_progress|completed|cancelled|no_show|rejected` และ unique queue ภายในรอบเมื่อมีเลขคิว
- `medical_records`: กำหนดหนึ่งผลตรวจต่อนัดด้วย unique index

### คลัง เตือน และแจ้งเตือน

- `medications`: บังคับ `stock >= 0`, `min_stock >= 0`
- `inventory_logs`: เพิ่ม `dispensing_item_id`, `performed_by`, `idempotency_key`; คง `pharmacist_id` เพื่อ compatibility
- `medication_reminders`: เพิ่ม `dispensing_item_id`, `created_by`, `confirmed_by`, `confirmed_at`, `locked_at`, `email_pause_until`; สถานะ `pending_confirmation|active|completed|cancelled`
- `medication_logs`: เพิ่ม `record_deadline`, revision และ unique `(reminder_id, scheduled_datetime)`; สถานะ `pending|taken|missed`
- `notifications`: เพิ่ม `event_key`, `broadcast_recipient_id`, `read_at`, `deleted_at` เพื่อ dedupe และกล่องรายคน

Column ใหม่ที่ต้องรองรับข้อมูลเดิมเริ่ม nullable หรือมี default ที่ไม่ทำให้ row เดิมผิด constraint การบังคับข้อมูลครบสำหรับรายการใหม่ทำที่ service/RPC จนกว่าจะมี migration ตรวจและเติมข้อมูลเดิมแยกต่างหาก

## ตารางธุรกรรมใหม่

### นัดหมาย

`reschedule_proposals` เก็บนัด รอบเดิม รอบเสนอ ผู้เสนอ เวลาเสนอ เส้นตายตอบ สถานะผลตอบ เวลาตอบ ผู้ตอบ เวลาหมดอายุการกัน `version` และ `request_key` สถานะ: `pending|accepted|alternative_selected|auto_confirmed|rejected|expired|withdrawn|superseded`

### ใบสั่ง การจ่าย และการกันยา

- `prescription_items`: ผลตรวจ ยา จำนวนสั่ง หน่วย คำสั่งใช้ version และสถานะ
- `dispensing_events`: หนึ่งธุรกรรมการจ่าย ผู้จ่าย ผู้ป่วย เวลา เหตุผล และ `idempotency_key`
- `dispensing_items`: รายการยาในธุรกรรม จำนวนจ่าย เหตุผลแบ่งจ่าย และ link ไป prescription item
- `stock_reservations`: จำนวนกัน ผู้ยืนยันพร้อมจ่าย สถานะ `active|consumed|released|expired` เวลาและเหตุผล
- `prescription_changes`: audit ก่อน–หลัง เหตุผล ผู้แก้ และ version

จำนวนค้างคำนวณจากจำนวนสั่ง ลบจำนวนจ่ายจริงและจำนวนยกเลิกค้าง ส่วนยอดพร้อมจ่ายคำนวณจาก stock ลบ reservation ที่ยัง active ห้ามบันทึก reservation เป็นการตัด stock

### มื้อยาและงานอีเมล

- `medication_log_changes`: audit การกดกิน แก้เวลา หรือยกเลิก พร้อมค่าก่อน–หลัง ผู้แก้และเหตุผล
- `email_jobs`: ผู้รับ เหตุการณ์/มื้อ กำหนดส่ง ชนิด `dose_advance|dose_final_repeat|staff_override|appointment|backorder_ready` สถานะ `pending|processing|sent|failed|cancelled|skipped_paused` จำนวนครั้ง ผล provider และ `idempotency_key`

### Broadcast

- `broadcasts`: ผู้ส่ง เนื้อหา กลุ่มเป้าหมาย และ `request_key`
- `broadcast_recipients`: snapshot ผู้รับต่อประกาศ พร้อมเวลาอ่าน/ลบ unique `(broadcast_id, user_id)`

## Integrity และ concurrency

- จำนวนสั่ง จ่าย กัน และ stock เป็นจำนวนเต็มไม่ติดลบ; จำนวนจ่ายต้องมากกว่าศูนย์
- การจ่ายหนึ่ง event, การรับยาค้าง, การจอง/คืน/ย้ายความจุ และการกัน/ปล่อยยา ต้องทำ atomically ใน RPC/transaction ภายหลัง
- ทุกคำสั่งที่ retry ได้มี unique request/idempotency key
- ใช้ version สำหรับ optimistic concurrency ในข้อเสนอเลื่อนนัดและรายการใบสั่ง
- Foreign key ธุรกรรมสำคัญใช้ `ON DELETE RESTRICT`; audit/history ไม่ cascade หายตามข้อมูลหลัก
- Index ครอบคลุม foreign key, สถานะงานค้าง, วันนัด, กำหนดส่ง และ lookup idempotency

## RLS และข้อมูลที่เปิดเผย

Migration schema ไม่เปิดใช้งาน database adapter และไม่รวม policy แบบกว้างจาก `02_rls.sql` เป็นคำตอบสุดท้าย ต้องมี migration RLS/RPC แยกหลังตรวจ contract:

- Patient อ่านข้อมูลตนเอง
- Staff ไม่อ่าน diagnosis
- Pharmacist อ่านใบสั่งและประวัติแพ้ยา แต่ไม่อ่าน diagnosis
- Doctor อ่านประวัติผู้ป่วยในขอบเขตนัดที่รับผิดชอบ
- Admin ดูบัญชี/สถิติรวมและ Broadcast แต่ไม่เห็นข้อมูลคลินิกโดยอัตโนมัติ

เพราะ PostgreSQL RLS จำกัดแถว ไม่จำกัด column ต้องใช้ view หรือ RPC สำหรับข้อมูลที่ต้องปิดบาง column

## เอกสารและชนิดข้อมูล

- อัปเดต `docs/03_database_design_and_er.md`, `docs/09_implementation_plan.md`, `docs/10_team_decisions.md`, `docs/07_foundation_and_scope.md`, `README.md` และ spec mock ที่ระบุว่า ER ยังไม่รับรอง
- อัปเดต `src/types/database.ts` ให้มี Row/Insert/Update/Relationships ของ schema ใหม่ โดยไม่เปลี่ยน runtime repository
- ไม่แก้ feature-local domain types เว้นแต่ typecheck พิสูจน์ว่าจำเป็น

## การตรวจรับ

- Static schema tests ตรวจว่ามี table, FK, CHECK, UNIQUE และ index สำคัญ
- ตรวจว่า migration ไม่มี `DROP`, `TRUNCATE`, seed, secret หรือ network dependency
- รัน `npm run lint`, `npx --no-install tsc --noEmit`, `npm run test`, `npm run build`
- ไม่ต้องตรวจ UI 360px/1280px เพราะไม่มี UI behavior เปลี่ยน

## นอกขอบเขต

- การรัน migration/seed กับ Supabase จริง
- การล้างข้อมูลทดลอง
- การเปิด database adapter เป็น runtime
- RLS/RPC production, email worker และ provider จริง
- การตัดสินเรื่องคืนยาที่จ่ายแล้ว สูตร Dashboard และขอบเวลาอื่นที่ทีมยังไม่ได้สรุป
