# Shared Supabase-Compatible Mock Database Design

วันที่: 5 กันยายน 2569 (2026-09-05)

> สถานะ: superseded โดย D23 ใน `docs/10_team_decisions.md` สำหรับ runtime ฐานจำลองในเอกสารนี้เป็น test adapter/offline demo เท่านั้น ไม่ใช่ production runtime และข้อความห้ามเชื่อมฐานจริงด้านล่างเป็นขอบเขตทางประวัติศาสตร์ของงานเดิม

## 1. เป้าหมาย

สร้างฐานข้อมูลจำลองส่วนกลางสำหรับทุกโมดูลของระบบคลินิก ให้หน้าและ service ทำงานเสมือนอ่านเขียนข้อมูลจาก Supabase โครงการเดียวกัน โดยไม่เชื่อมฐานข้อมูลจริงและไม่เปลี่ยน migration

ข้อมูลจำลองต้องสัมพันธ์กันตั้งแต่บัญชี แผนก แพทย์ รอบตรวจ นัด ผลตรวจ ใบสั่งยา คลัง การเตือน การแจ้งเตือน และ Dashboard เมื่อโมดูลหนึ่งแก้ข้อมูล โมดูลอื่นที่อ้างถึงข้อมูลเดียวกันต้องเห็นผลใน session เดียวกัน

## 2. หลักอ้างอิง

- ตอนเขียน spec นี้ใช้ 11 ตารางใน `supabase/migrations/01_schema.sql`; วันที่ 6 กันยายน 2569 มี normalized contract ใน migration 03 เพิ่มแล้ว แต่ runtime mock ชุดนี้ยังคง shape เดิมเพื่อ compatibility
- ใช้ข้อสรุปใน `docs/10_team_decisions.md` และเกณฑ์ใน `docs/08_system_rules_and_acceptance.md` เป็นกฎธุรกิจ
- ใช้ Catalog ใน `docs/superpowers/specs/2026-09-04-clinic-demo-data-design.md` เป็นข้อมูลตั้งต้น
- ER ตารางธุรกรรมใหม่ได้รับรองภายหลังใน `2026-09-06-normalized-database-schema-design.md`; การขยาย mock ไปใช้ตารางใหม่เป็นงานแยก

## 3. ขอบเขต

### Persisted mock tables

จำลองตารางปัจจุบันครบ 11 ตาราง:

1. `profiles`
2. `departments`
3. `doctors`
4. `appointment_slots`
5. `appointments`
6. `medical_records`
7. `medications`
8. `inventory_logs`
9. `medication_reminders`
10. `medication_logs`
11. `notifications`

ชื่อ field ใช้ snake_case และชนิดข้อมูลตรงกับ database types ปัจจุบัน ทุก row มี UUID คงที่และความสัมพันธ์อ้างถึง row ที่มีอยู่จริง

### โมดูลผู้ใช้งาน

- ฟีม: บัญชี โปรไฟล์ บทบาท และข้อมูลสุขภาพที่อนุญาต
- ช้อป: แผนก แพทย์ รอบตรวจ และความจุ
- ปาย: นัด คิว สถานะตรวจ ผลตรวจ และใบสั่งยา JSONB ตาม schema ปัจจุบัน
- กัญจน์: ยา สต๊อก และ inventory log
- กลอง: รายการเตือนและบันทึกมื้อ
- เฮิร์บ: การแจ้งเตือนและข้อมูลตั้งต้นของ Dashboard ตามบทบาท

## 4. สิ่งที่ไม่อยู่ในขอบเขต

- ไม่เชื่อม Supabase จริง
- ไม่แก้ migration, RLS หรือ remote database
- ไม่สร้าง Auth user จริงหรือส่งอีเมลจริง
- ไม่ขยาย runtime mock ไปยัง normalized tables ในงานเดิมนี้
- ไม่จำลอง SQL parser หรือ Supabase query builder ครบทุก operator
- ไม่ทำ realtime subscription, storage, edge function หรือ network retry จริง
- refresh browser แล้วข้อมูลกลับสู่ Catalog ตั้งต้น

## 5. สถาปัตยกรรม

ระบบแบ่งเป็นห้าชั้น:

1. **Database row types** — ใช้ types ปัจจุบันเป็น persisted shape และเพิ่มเฉพาะชนิด helper โดยไม่เปลี่ยน schema
2. **Clinic catalog** — fixture ส่วนกลางที่มี row ทุกตารางและ ID คงที่
3. **Mock database engine** — ถือ state, ตรวจ primary/foreign key, clone ผลลัพธ์ และจัดธุรกรรมจำลอง
4. **Data adapters/repositories** — คืนผลแบบ Supabase และทำ relational mapping ที่แต่ละ service ต้องใช้
5. **Services และ UI providers** — service รับ adapter ผ่าน dependency injection; provider เผยแพร่ snapshot ใหม่หลัง mutation สำเร็จ

UI ห้าม import fixture โดยตรง ทุกหน้าต้องอ่านเขียนผ่าน service หรือ repository contract เดียวกับที่ Supabase implementation ใช้

## 6. Supabase-compatible response contract

ทุก operation เป็น asynchronous และคืนค่า:

```ts
type DataResult<T> =
  | { data: T; error: null }
  | { data: null; error: MockPostgrestError };

interface MockPostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}
```

ใช้ error code ที่สื่อความหมายตาม PostgreSQL/PostgREST ในกรณีหลัก:

- `23505` — unique violation
- `23503` — foreign key violation
- `23514` — check constraint violation
- `PGRST116` — `.single()` ไม่พบหรือพบมากกว่าหนึ่ง row
- `MOCK_FORBIDDEN` — operation ที่ role จำลองไม่มีสิทธิ์
- `MOCK_CONFLICT` — ธุรกรรมจำลองขัดกับ state ปัจจุบัน

adapter จำลอง latency แบบ deterministic ระยะสั้นเพื่อให้ UI แสดง loading state ได้ โดย tests สามารถตั้ง latency เป็นศูนย์

## 7. Query และ mutation ที่รองรับ

ไม่สร้าง query builder ทั่วไป แต่สร้าง repository methods ตาม use case จริง เช่น:

- `profiles.list`, `profiles.getById`, `profiles.update`
- `schedules.listDepartments`, `schedules.listDoctors`, `schedules.listSlots`
- `schedules.createSlot`, `schedules.updateSlot`, `schedules.closeSlot`
- `appointments.listByPatient`, `appointments.listQueue`, `appointments.create`, `appointments.updateStatus`
- `records.getByAppointment`, `records.save`
- `pharmacy.listMedications`, `pharmacy.adjustStock`, `pharmacy.listInventoryLogs`
- `reminders.listByPatient`, `reminders.create`, `reminders.confirmTimes`, `reminders.recordDose`
- `notifications.listInbox`, `notifications.markRead`
- `dashboard.getRoleSummary`

method signatures และ row shapes ต้องใช้ร่วมกับ Supabase repository implementation ภายหลังได้ การเปลี่ยน adapter ต้องเกิดที่ composition root เท่านั้น

## 8. ข้อมูล Catalog กลาง

Catalog ประกอบด้วย:

- Profiles 17 บัญชี: Admin 1, Staff 1, Pharmacist 1, Doctor 6 และ Patient 8
- Departments 4 แผนก
- Doctors 6 คนและสังกัดแผนก
- Appointment slots ครอบคลุมย้อนหลัง 7 วัน วันนี้ และล่วงหน้า 14 วันใน `Asia/Bangkok`
- Appointments ที่ครอบคลุมทุกสถานะหลักและ SCN-01–03
- Medical records ที่มีทั้งใบสั่งยาและไม่มีรายการยา
- Medications 7 รายการตาม Catalog พร้อมกรณี low stock และใกล้หมดอายุ
- Inventory logs ที่สัมพันธ์กับการรับเข้า ปรับยอด และจ่ายจริง
- Medication reminders/logs สำหรับสถานะรอยืนยัน ทำงาน พัก กินแล้ว และพลาด
- Notifications แบบอ่านแล้ว/ยังไม่อ่าน รวม appointment, reminder, broadcast และ system

ข้อมูลสุขภาพและบัญชีทั้งหมดเป็นข้อมูลสมมติ ไม่ใช้ข้อมูลบุคคลจริง ไม่เก็บ secret หรือรหัสผ่านใน client fixture

## 9. ความสัมพันธ์และ integrity

เมื่อสร้าง catalog และหลัง mutation ต้องตรวจอย่างน้อย:

- `doctors.id` อ้างถึง profile role `doctor`
- `doctors.department_id` อ้างถึง department
- `appointment_slots.doctor_id` อ้างถึง doctor
- `appointments.user_id` อ้างถึง profile role `patient`
- `appointments.slot_id` อ้างถึง slot
- `medical_records` อ้างถึง appointment, patient และ doctor ที่สัมพันธ์กัน
- ยาใน `prescribed_medications` อ้างถึง medication ที่มีอยู่
- `inventory_logs` อ้างถึง medication และ profile ผู้ดำเนินการ
- reminders/logs/notifications อ้างถึงเจ้าของและรายการต้นทางที่มีอยู่
- `booked_count` ต้องตรงกับจำนวน appointment ที่ยังกันความจุ ตามสถานะที่ระบบกำหนด

fixture ที่ผิด integrity ทำให้ tests ล้มเหลวทันที ไม่ปล่อยให้ UI ซ่อนปัญหา

## 10. Transaction และ concurrency จำลอง

command ที่กระทบหลาย row ใช้ transaction function ซึ่ง clone state ก่อนทำงาน ตรวจทุกเงื่อนไข แล้ว commit state ใหม่เพียงครั้งเดียว หากขั้นตอนใดล้มเหลวต้องคืน error และไม่เปลี่ยนข้อมูลบางส่วน

รองรับกรณีหลัก:

- จองที่และเพิ่ม `booked_count` พร้อมกัน
- ยกเลิกนัดและคืนที่เพียงครั้งเดียว
- เปลี่ยนสถานะตรวจโดยตรวจ role/เจ้าของนัด
- ตัดสต๊อกพร้อมเขียน inventory log
- สร้าง reminder จากยาที่จ่ายจริง

การทดสอบสองคำสั่งพร้อมกันใช้ revision number ของ database state เพื่อให้สำเร็จเพียงคำสั่งที่อ่าน revision ล่าสุด กรณีชนกันคืน `MOCK_CONFLICT`

## 11. Provisional workflows

กฎที่ mock 11 ตารางยังเก็บไม่ครบ ได้แก่ ประวัติข้อเสนอเลื่อนนัด การแบ่งจ่าย การกันยา การแก้ใบสั่ง และ broadcast ต้นฉบับ แม้ persisted schema ใหม่ได้รับรองภายหลังแล้ว

ใน mock phase ให้รองรับผ่าน use-case RPC contract และ derived read model เช่น:

- `proposeReschedule()`
- `dispensePrescription()`
- `reserveOutstandingMedication()`
- `cancelOutstandingMedication()`
- `createBroadcast()`

ข้อมูลสนับสนุนเก็บใน namespace `provisional` ภายใน mock engine ไม่ export เป็น table API ทุก type และ comment ต้องระบุว่าเปลี่ยนได้เมื่อทีมรับรอง ER/migration

## 12. Authorization จำลอง

mock session ระบุ `profileId` และ `role` ปัจจุบัน repository ตรวจสิทธิ์ก่อนอ่านเขียนตามตารางสิทธิ์ล่าสุด แต่ mock authorization มีไว้ทดสอบ UI เท่านั้น ไม่ถือเป็น RLS และไม่ใช้เป็นหลักฐานด้านความปลอดภัย

กรณีถูกปฏิเสธต้องคืน `MOCK_FORBIDDEN` และไม่เปิดข้อมูลต้องห้ามใน `details` ของ error

## 13. Data flow

1. `ClinicMockProvider` สร้าง engine และ session จำลองหนึ่งครั้งที่ layout ร่วม
2. feature service ขอข้อมูลจาก repository แบบ async
3. repository อ่าน snapshot หรือเริ่ม transaction
4. engine ตรวจ authorization, constraint และ revision
5. operation สำเร็จคืน `{ data, error: null }` และ provider แจ้ง subscribers
6. operation ล้มเหลวคืน `{ data: null, error }` โดย state ไม่เปลี่ยน
7. ทุกหน้าที่พึ่งข้อมูลเดียวกัน render จาก revision ใหม่

## 14. Loading, empty และ error

- ทุกหน้ามี loading state ระหว่างรอ async operation
- ผลลัพธ์ array ว่างแสดง empty state ที่บอกวิธีดำเนินการต่อ
- query error แสดงข้อความและ retry action
- mutation error แสดง field error หรือข้อความรวมตามชนิดข้อผิดพลาด
- tests สามารถสั่งให้ adapter คืน error เฉพาะ operation เพื่อทดสอบ UI ได้

## 15. แผนย้ายโมดูล

### ระยะ 1 — Foundation

- สร้าง row catalog, engine, response/error types, session และ integrity tests
- สร้าง repository interfaces และ mock composition root

### ระยะ 2 — Shop compatibility

- ย้าย `ShopProvider` และ mock repository เดิมมาใช้ engine กลาง
- รักษาพฤติกรรมหน้าจอและ validation ที่มีอยู่

### ระยะ 3 — Core clinical flow

- เชื่อม appointments และ records ให้ใช้ profile/slot/doctor ชุดเดียวกัน
- เพิ่ม transaction จอง ยกเลิก และเปลี่ยนสถานะ

### ระยะ 4 — Pharmacy และ reminders

- เชื่อมยา inventory logs และใบสั่ง JSONB ปัจจุบัน
- เชื่อม reminder/log กับผู้ป่วยและยาที่จ่ายจริง

### ระยะ 5 — Notifications และ dashboard

- สร้าง inbox และ role summary จาก state กลาง
- ตรวจไม่ให้ Dashboard เปิดเผยข้อมูลเกินสิทธิ์

แต่ละระยะต้อง build และทดสอบผ่านก่อนเริ่มระยะถัดไป เพื่อไม่ให้การย้ายหน้าหนึ่งทำลายหน้าที่ใช้งานอยู่

## 16. การทดสอบ

### Contract tests

รัน test suite เดียวกันกับ mock repository และ Supabase repository ภายหลัง เพื่อยืนยันว่า success/error shape, sorting, filtering และ mutation behavior ตรงกัน

### Integrity tests

- ID ไม่ซ้ำ
- foreign key ครบ
- role ตรง entity
- จำนวนจองตรงกับ appointment
- JSON prescription อ้างถึงยาได้
- เวลาอยู่ใน `Asia/Bangkok` และข้อมูลวันที่ครอบคลุมช่วงเดโม

### Transaction tests

- สองบัญชีจองที่สุดท้าย สำเร็จหนึ่งบัญชี
- คำสั่งล้มเหลวไม่ทิ้ง partial state
- ยกเลิกซ้ำไม่คืนความจุเพิ่ม
- ตัดสต๊อกพร้อม log และไม่ติดลบ

### Integration tests

- เปลี่ยนแผนก/แพทย์แล้วตารางตรวจเห็นข้อมูลเดียวกัน
- สร้างนัดแล้วคิวและ Dashboard เปลี่ยนตาม
- ปิดตรวจพร้อมผลแล้วผู้ป่วยเห็น record ของตน
- จ่ายยาแล้วสต๊อก log และ reminder source เปลี่ยนสอดคล้องกัน
- notification อ่านแล้วทำให้ unread count ลดเฉพาะเจ้าของ

### Quality gates

- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- ตรวจ Chrome ปัจจุบันที่ 360px และ 1280px พร้อม keyboard flow

## 17. เงื่อนไขสำเร็จ

- ทุกโมดูลอ่านข้อมูลจาก catalog กลางผ่าน async repository โดยไม่มี inline fixture ในหน้า
- response และ error shape เหมือน Supabase ในขอบเขตที่ประกาศ
- persisted rows ของ mock เดิมตรง 11-table compatibility shape
- mutation ข้ามโมดูลสะท้อนจาก state ชุดเดียวกัน
- กฎที่ยังไม่อยู่ใน mock เดิมถูกแยกเป็น provisional RPC อย่างชัดเจน
- ไม่มี network request หรือการเขียนไป Supabase จริง
- refresh แล้วรีเซ็ตข้อมูลและ tests รันซ้ำได้ผลเดิม
