# 03. แบบข้อมูลและ ER

ปรับปรุง 9 กันยายน 2569 (2026-09-09) — reverse-engineer schema/runtime ให้แยก PAI active path ออกจากตารางนัด/ผลตรวจเดิม และเพิ่ม catalog บริการกับ daily offering โดยคง departments เป็นข้อมูลความถนัดของแพทย์

> ไฟล์ schema snapshot จาก Supabase เป็นข้อมูลอ้างอิง ไม่ควรรันตรง ๆ เพราะไม่มีลำดับ Foreign Key ที่รับประกันได้ ให้ใช้ migration ตามลำดับ รวม `supabase/migrations/13_services_and_daily_offerings.sql` สำหรับฐานที่มี schema เดิมแล้ว

## สถานะและขอบเขต

- Runtime หลักใช้ Supabase ผ่าน database repository; mock repository ใช้เฉพาะ automated tests/offline demo ที่ระบุชัด
- Base schema เดิมมี 11 ตาราง; migration เพิ่ม `services`, `daily_service_offerings`, `pai_appointments`, `pai_medical_records` และ `broadcasts` ตามลำดับของ migration ที่ถูกใช้จริง จึงไม่ควรสรุปจำนวนตารางเดียวโดยไม่ระบุ migration target
- Active appointment/record runtime ใช้ `pai_appointments` และ `pai_medical_records`; `appointments` และ `medical_records` เดิมยังเป็น compatibility/legacy path ของ service เก่า
- บทบาทใน `profiles.role` เหลือ 3 ค่าเท่านั้น: `patient`, `medical`, `staff_admin`
- `medical` ครอบคลุมแพทย์และเภสัชกร; `staff_admin` ครอบคลุมเจ้าหน้าที่และแอดมิน
- ตาราง normalized รุ่นเก่า เช่น `reschedule_proposals`, `prescription_items`, `dispensing_items`, `stock_reservations` และ `email_jobs` ไม่อยู่ใน scope ปัจจุบัน; `broadcasts` ใน migration `03_normalized_transactions.sql` เป็นของเก่า แต่ migration `09_broadcast_rpc.sql` มี Broadcast path แยกที่ต้องตรวจ target จริง
- คอลัมน์ compatibility ที่ยังอยู่ใน base/legacy tables ไม่ใช่หลักฐานว่าเปิดใช้ workflow เก่าแล้ว

## แผนที่ข้อมูลจาก code path ปัจจุบัน

| เส้นทาง | ตาราง/ฟังก์ชันหลัก | ข้อสรุปจาก repository |
| --- | --- | --- |
| Schedule | `services` → `daily_service_offerings` → `appointment_slots` | `DatabaseShopRepository` รองรับการอ่าน/เขียน; UI ยังมี mock composition บางคำสั่ง |
| Appointment | `pai_appointments`, `pai_workspace`, `pai_book_appointment`, `pai_transition_appointment` | route `/appointments` ใช้เส้นทางนี้; ไม่เขียน `appointments` เดิม |
| Medical record | `pai_medical_records`, `pai_save_record` | route `/records` ใช้เส้นทางนี้; หนึ่งผลตรวจต่อนัดด้วย UNIQUE |
| Pharmacy | `medications`, `inventory_logs`, `medicationService`, `/pharmacy` | เส้นทางแยกจาก PAI และมี mock/local-storage fallback; ยังไม่ยืนยัน integration แบบครบวงจร |
| Reminder/notification | `medication_reminders`, `medication_logs`, `notifications` และ service ที่เกี่ยวข้อง | มี direct Supabase service; reminders/dashboard บางส่วนยัง fallback ไป mock |
| Broadcast | `broadcasts`/RPC และ `notifications` | มี migration/RPC แยก; ต้องตรวจว่าฐานเป้าหมาย apply แล้ว |

ตารางนี้คือ as-built map ไม่ใช่การเปลี่ยน target requirement ใน [08](08_system_rules_and_acceptance.md), [09](09_implementation_plan.md) หรือ [10](10_team_decisions.md)

## RLS สำหรับค้นหาผู้ป่วย

ผู้ใช้ role `medical` และ `staff_admin` อ่านข้อมูลใน `profiles` ของผู้ป่วยได้ เพื่อใช้หน้าค้นหาผู้ป่วย ส่วนผู้ใช้ role `patient` อ่านได้เฉพาะ profile ของตนเองตาม policy เดิม การแก้ policy สำหรับฐานเดิมอยู่ใน `supabase/migrations/08_allow_medical_patient_search.sql`:

```sql
DROP POLICY IF EXISTS "Staff/Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff admin and medical can view profiles" ON public.profiles;

CREATE POLICY "Staff admin and medical can view profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() IN ('staff_admin', 'medical'));
```

ต้องรัน migration นี้บนฐาน development/staging หรือฐาน runtime ที่ตรวจสอบ target แล้วก่อนอ้างว่าการค้นหาผู้ป่วยผ่าน RLS ทำงานจริง เอกสารและ migration ใน repository ยังไม่ใช่หลักฐานว่า deploy แล้ว

## Role contract

| ลำดับ | บทบาท | ค่าใน `profiles.role` | ขอบเขตหลัก |
| --- | --- | --- | --- |
| 1 | ผู้ป่วย | `patient` | โปรไฟล์ นัด รายการเตือน และข้อมูลของตน |
| 2 | แพทย์/เภสัชกร | `medical` | ตรวจรักษา บันทึกผล และจัดการยาตามหน้าที่ |
| 3 | เจ้าหน้าที่/แอดมิน | `staff_admin` | จัดการบัญชี แผนก บริการ daily offering slot นัดหมาย รายการเตือน Dashboard และ Broadcast |

นักศึกษา/บุคลากรเป็น `patient_type` ไม่ใช่ role เพิ่ม และผู้ใช้หนึ่งบัญชีมี role เดียว

## ตารางใน scope ปัจจุบัน

| ตาราง | หน้าที่และความสัมพันธ์ | ข้อจำกัดหลัก |
| --- | --- | --- |
| `profiles` | บัญชีผู้ใช้ ขยายจาก `auth.users` | role ต้องเป็น 3 ค่า canonical |
| `departments` | กลุ่มความถนัด/สาขางานของแพทย์ | ปิดใช้งานด้วย `is_active` โดยไม่ใช้เป็นหน่วยที่ผู้ป่วยจอง |
| `services` | catalog บริการที่เปิดให้ผู้ป่วยจอง | `code` ไม่ซ้ำ; ปิดใช้งานด้วย `is_active` |
| `doctors` | รายละเอียดแพทย์ที่เป็นบัญชี `medical` | ผูกกับ `profiles` และ `departments` |
| `daily_service_offerings` | บริการของแพทย์ที่เปิดในวันนั้น | unique ต่อ `service_id`, `doctor_id`, `offering_date` |
| `appointment_slots` | รอบเวลาตรวจของบริการในวันนั้น | ต้องอ้าง `daily_service_offering_id`; status คือ `available`, `full`, `closed` |
| `pai_appointments` | การนัด active ของผู้ป่วยกับ slotใน PAI runtime | ใช้ RPC; unique active booking ต่อผู้ป่วย/slot; ไม่มี auto-reschedule/auto-no-show |
| `pai_medical_records` | ผลตรวจ active ของ PAI runtime | ผูกกับ `pai_appointments`; `appointment_id` UNIQUE; รายการยาเป็น JSONB |
| `appointments` | ตารางนัดเดิมของ service/compatibility path | ไม่ใช่ตารางที่ active PAI route เขียน |
| `medical_records` | ผลตรวจเดิมและรายการยาแบบ JSONB | ไม่ใช่ตารางที่ active PAI route เขียน |
| `medications` | Catalog และยอดคลังยา | ยอด stock ใช้ประกอบการจ่ายยา |
| `inventory_logs` | ประวัติรับเข้า ปรับยอด และจ่ายยา | เก็บผู้ทำรายการและจำนวน |
| `medication_reminders` | รายการเตือนยาของผู้ป่วย | ไม่มี worker หรือ email อัตโนมัติ |
| `medication_logs` | ผลการบันทึกกินยาแต่ละรายการ | ผู้ป่วยกดบันทึกเอง ไม่เปลี่ยนตามเวลา |
| `notifications` | กล่องข้อความรายผู้ใช้ | ผู้รับเป็นเจ้าของข้อมูลของตน |
| `broadcasts` | ประวัติคำสั่ง Broadcast ของ migration/RPC ปัจจุบัน | ต้องแยกจาก table ชื่อเดียวกันใน normalized migration เก่า และต้องตรวจ target ก่อนใช้งาน |

ข้อมูลตัวอย่างล่าสุดที่ส่งมามี 4 แผนกใน `departments` และ 8 รายการยาใน `medications`; การปรับ schema ไม่ลบหรือเปลี่ยนข้อมูลสองตารางนี้

## ER ปัจจุบัน

```mermaid
erDiagram
    profiles ||--o{ appointments : books
    profiles ||--o{ medical_records : owns
    profiles ||--o{ pai_appointments : books_active
    profiles ||--o{ pai_medical_records : owns_active
    profiles ||--o{ notifications : receives
    profiles ||--o| doctors : has_doctor_detail
    departments ||--o{ doctors : groups
    services ||--o{ daily_service_offerings : catalogs
    doctors ||--o{ daily_service_offerings : provides
    daily_service_offerings ||--o{ appointment_slots : opens
    appointment_slots ||--o{ pai_appointments : holds_active
    pai_appointments ||--o| pai_medical_records : produces_active
    appointment_slots ||--o{ appointments : holds_legacy
    appointments ||--o| medical_records : produces_legacy
    medications ||--o{ inventory_logs : changes
    medications ||--o{ medication_reminders : supports
    medication_reminders ||--o{ medication_logs : schedules
```

สัญลักษณ์ใน ER อธิบายความสัมพันธ์เชิงแบบจำลอง ไม่ได้สั่งให้ระบบสร้างข้อมูลอัตโนมัติ เช่น ผลตรวจควรมีได้ไม่เกินหนึ่งรายการต่อนัดตาม domain rule แต่ snapshot ไม่ได้ประกาศ UNIQUE ของ `medical_records.appointment_id`

## Data dictionary ฉบับตรงกับ schema ล่าสุด

ชนิดข้อมูล, ค่า NULL, default และ FK ด้านล่างยึดตาม schema snapshot ล่าสุดที่ส่งมา. ฟิลด์ compatibility ยังบันทึกไว้เพื่อไม่ให้ข้อมูลเดิมหาย แต่ไม่มี workflow เก่ารองรับใน scope นี้

### 1. `profiles`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | — | PK; FK → `auth.users.id` | รหัสบัญชีเดียวกับ Supabase Auth |
| `student_id` | `text` | ได้ | — | UNIQUE | รหัสนักศึกษา |
| `full_name` | `text` | ไม่ได้ | — | — | ชื่อ–นามสกุล |
| `phone` | `text` | ได้ | — | — | เบอร์โทรศัพท์ |
| `emergency_phone` | `text` | ได้ | — | — | เบอร์ติดต่อฉุกเฉิน |
| `address` | `text` | ได้ | — | — | ที่อยู่ |
| `allergies` | `text` | ได้ | — | — | รายละเอียดประวัติแพ้ยา |
| `chronic_diseases` | `text` | ได้ | — | — | รายละเอียดโรคประจำตัว |
| `role` | `text` | ไม่ได้ | `patient` | CHECK: `patient`, `medical`, `staff_admin` | role หลักของบัญชี |
| `avatar_url` | `text` | ได้ | — | — | URL รูปโปรไฟล์ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างบัญชี |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |
| `patient_type` | `text` | ได้ | — | CHECK: `student`, `employee` | ประเภทผู้ป่วย ไม่ใช่ role |
| `employee_id` | `text` | ได้ | — | — | รหัสบุคลากร |
| `organization` | `text` | ได้ | — | — | หน่วยงานของบุคลากร |
| `allergy_status` | `text` | ได้ | — | CHECK: `yes`, `no`, `unknown` | สถานะสรุปเรื่องแพ้ยา |
| `chronic_disease_status` | `text` | ได้ | — | CHECK: `yes`, `no`, `unknown` | สถานะสรุปโรคประจำตัว |
| `is_active` | `boolean` | ไม่ได้ | `true` | — | สถานะบัญชีใช้งาน |
| `permission_version` | `integer` | ไม่ได้ | `1` | CHECK: `> 0` | รุ่นสิทธิ์สำหรับทำให้ session เดิมหมดสิทธิ์ |

### 2. `departments`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสแผนก |
| `name` | `text` | ไม่ได้ | — | — | ชื่อแผนก |
| `description` | `text` | ได้ | — | — | รายละเอียดบริการ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างแผนก |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |
| `is_active` | `boolean` | ไม่ได้ | `true` | — | เปิด/ปิดแผนกโดยไม่ลบข้อมูล |

### 3. `doctors`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | — | PK; FK → `profiles.id` | profile ของบัญชี `medical` ที่ทำหน้าที่แพทย์ |
| `specialty` | `text` | ได้ | — | — | สาขาหรือความเชี่ยวชาญ |
| `department_id` | `uuid` | ได้ | — | FK → `departments.id` | แผนกที่สังกัด |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างข้อมูล |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |

เภสัชกรใช้ role `medical` ได้โดยไม่จำเป็นต้องมีแถวใน `doctors`

### 4A. `services`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสบริการ |
| `code` | `text` | ไม่ได้ | — | UNIQUE | รหัสบริการที่ staff ใช้อ้างอิง |
| `name` | `text` | ไม่ได้ | — | CHECK ไม่เป็นค่าว่าง | ชื่อบริการที่ผู้ป่วยเห็น |
| `description` | `text` | ได้ | — | — | รายละเอียดบริการ |
| `is_active` | `boolean` | ไม่ได้ | `true` | — | เปิด/ปิดบริการสำหรับการสร้าง offering ใหม่ |
| `created_by` | `uuid` | ได้ | — | FK → `profiles.id` | ผู้สร้าง |
| `created_at`, `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้าง/แก้ไข |

### 4B. `daily_service_offerings`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสบริการของแพทย์ในวันนั้น |
| `service_id` | `uuid` | ไม่ได้ | — | FK → `services.id` | บริการที่เปิดให้จอง |
| `doctor_id` | `uuid` | ไม่ได้ | — | FK → `doctors.id` | แพทย์ผู้ให้บริการ |
| `offering_date` | `date` | ไม่ได้ | — | — | วันที่เปิดบริการ |
| `is_active` | `boolean` | ไม่ได้ | `true` | — | เปิด/ปิดการจองของ offering |
| `created_by` | `uuid` | ได้ | — | FK → `profiles.id` | ผู้สร้าง |
| `created_at`, `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้าง/แก้ไข |

มี UNIQUE `(service_id, doctor_id, offering_date)` และ composite FK ที่บังคับให้ slot ใช้ doctor/date เดียวกับ offering

### 4C. `appointment_slots`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสรอบตรวจ |
| `doctor_id` | `uuid` | ไม่ได้ | — | FK → `doctors.id` | แพทย์เจ้าของรอบ |
| `daily_service_offering_id` | `uuid` | ไม่ได้ | — | FK → `daily_service_offerings(id, doctor_id, offering_date)` | บริการของแพทย์ในวันนั้น |
| `slot_date` | `date` | ไม่ได้ | — | — | วันที่ตรวจ |
| `start_time` | `time` | ไม่ได้ | — | — | เวลาเริ่ม |
| `end_time` | `time` | ไม่ได้ | — | — | เวลาสิ้นสุด; domain rule ต้องมากกว่าเวลาเริ่ม |
| `max_capacity` | `integer` | ไม่ได้ | `1` | — | จำนวนผู้ป่วยสูงสุด |
| `booked_count` | `integer` | ไม่ได้ | `0` | — | จำนวนที่จองแล้ว; domain rule ต้องไม่เกินความจุ |
| `status` | `text` | ไม่ได้ | `available` | CHECK: `available`, `full`, `closed` | สถานะรอบตรวจ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้าง slot |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |

### 4D. `pai_appointments` (active PAI runtime)

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสนัด active |
| `patient_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้ป่วยเจ้าของนัด |
| `slot_id` | `uuid` | ไม่ได้ | — | FK → `appointment_slots.id` | slot ที่เลือก |
| `queue_number` | `integer` | ไม่ได้ | — | CHECK: `> 0` | เลขคิวใน slot |
| `reason` | `text` | ไม่ได้ | — | CHECK: 1–2000 ตัวอักษร | อาการหรือเหตุผลที่ผู้ป่วยกรอก |
| `status` | `text` | ไม่ได้ | `pending` | CHECK: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `rejected`, `no_show` | สถานะที่ RPC อนุญาต |
| `cancel_requested_at` | `timestamptz` | ได้ | — | — | เวลาที่ผู้ป่วยส่งคำขอยกเลิก |
| `rejection_reason` | `text` | ได้ | — | CHECK: ถ้ามีต้อง 1–2000 ตัวอักษร | เหตุผลที่ staff ปฏิเสธ |
| `created_at`, `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้าง/แก้ไข |

มี partial unique index ป้องกันการจอง active ซ้ำของผู้ป่วยใน slot เดียว และ RPC จะรวม `booked_count` เดิมกับจำนวน PAI active เพื่อเช็กความจุ โดยไม่อัปเดตแถว slot เดิม

### 4E. `pai_medical_records` (active PAI runtime)

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสผลตรวจ active |
| `appointment_id` | `uuid` | ไม่ได้ | — | UNIQUE; FK → `pai_appointments.id` | นัดต้นทาง; หนึ่งผลตรวจต่อนัด |
| `patient_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้ป่วยเจ้าของผลตรวจ |
| `doctor_id` | `uuid` | ไม่ได้ | — | FK → `doctors.id` | แพทย์เจ้าของนัด |
| `diagnosis` | `text` | ไม่ได้ | — | CHECK: 1–5000 ตัวอักษร | ผลวินิจฉัย |
| `treatment_notes` | `text` | ไม่ได้ | `''` | CHECK: ไม่เกิน 5000 ตัวอักษร | คำแนะนำ/บันทึกการรักษา |
| `prescribed_medications` | `jsonb` | ไม่ได้ | `[]` | CHECK: JSON array | รายการยาที่สั่ง; RPC ตรวจยา active, จำนวน, วิธีใช้ และรายการซ้ำ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างผลตรวจ |

`pai_save_record` อนุญาตเฉพาะ `medical` ที่เป็นเจ้าของนัดและนัดอยู่ `in_progress`; ถ้าขอจบตรวจต้องมี record ก่อน ตารางนี้ยังไม่ใช่ dispense/inventory transaction

### 5. `appointments` (legacy/compatibility path)

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสนัด |
| `user_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้ป่วยเจ้าของนัด; domain rule ต้องเป็น `patient` |
| `slot_id` | `uuid` | ไม่ได้ | — | FK → `appointment_slots.id` | slot ที่เลือก |
| `queue_number` | `integer` | ได้ | — | — | เลขคิวใน slot |
| `reason` | `text` | ได้ | — | — | เหตุผลหรืออาการ |
| `status` | `text` | ไม่ได้ | `pending` | CHECK: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`, `rejected` | สถานะนัด; ไม่มีการเปลี่ยนตามเวลาอัตโนมัติ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างนัด |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |

`no_show` คงไว้ตาม schema ล่าสุดเพื่อรองรับข้อมูลเดิม แต่ไม่มี auto-no-show ใน scope manual

### 6. `medical_records` (legacy/compatibility path)

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสผลตรวจ |
| `appointment_id` | `uuid` | ไม่ได้ | — | FK → `appointments.id` | นัดต้นทาง |
| `patient_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้ป่วยเจ้าของผลตรวจ |
| `doctor_id` | `uuid` | ไม่ได้ | — | FK → `doctors.id` | แพทย์ผู้รับผิดชอบ |
| `diagnosis` | `text` | ได้ | — | — | ผลวินิจฉัย |
| `treatment_notes` | `text` | ได้ | — | — | คำแนะนำ/บันทึกการรักษา |
| `prescribed_medications` | `jsonb` | ได้ | — | JSON shape: `PrescribedMedication[]` | รายการยาในผลตรวจ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างผลตรวจ |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |

รายการยาใน JSONB ควรมี `medication_id`, `name`, `dosage`, `frequency`, `duration_days`, `quantity`; ไม่แยกเป็นตาราง prescription ใน scope ปัจจุบัน

### 7. `medications`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสยา |
| `name` | `text` | ไม่ได้ | — | — | ชื่อยาและขนาด |
| `type` | `text` | ไม่ได้ | — | — | รูปแบบยา เช่น เม็ด/แคปซูล/ผง/เจล |
| `category` | `text` | ไม่ได้ | — | — | หมวดหมู่ยา |
| `stock` | `integer` | ไม่ได้ | `0` | — | จำนวนคงเหลือ |
| `min_stock` | `integer` | ไม่ได้ | `0` | — | ระดับ stock ขั้นต่ำ |
| `expiry_date` | `date` | ได้ | — | — | วันหมดอายุ |
| `description` | `text` | ได้ | — | — | รายละเอียดการใช้ |
| `ingredients` | `text` | ได้ | — | — | ส่วนประกอบ/สารสำคัญ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างรายการ |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |
| `is_active` | `boolean` | ได้ | `true` | — | เปิด/ปิดรายการใน Catalog; snapshot อนุญาต NULL |

### 8. `inventory_logs`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสประวัติคลัง |
| `medication_id` | `uuid` | ไม่ได้ | — | FK → `medications.id` | ยาที่เปลี่ยนยอด |
| `pharmacist_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้ทำงานยาใน role `medical` |
| `action` | `text` | ไม่ได้ | — | domain: `add`, `dispense`, `adjust`, `damage` | ประเภทการเปลี่ยนคลัง |
| `quantity` | `integer` | ไม่ได้ | — | — | จำนวนที่รับเข้า/จ่าย/ปรับ/เสียหาย |
| `reason` | `text` | ได้ | — | — | เหตุผลของรายการ |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาบันทึก |
| `dispensing_item_id` | `uuid` | ได้ | — | compatibility; ไม่มี FK ใน schema ล่าสุด | ค่าอ้างอิงเก่าที่เก็บไว้ไม่ให้ข้อมูลหาย |
| `performed_by` | `uuid` | ได้ | — | FK → `profiles.id` | ผู้ปฏิบัติงานเพิ่มเติม ถ้ามี |
| `idempotency_key` | `text` | ได้ | — | compatibility | เก็บค่าเดิมได้ แต่ไม่มี workflow idempotency ใน scope |

### 9. `medication_reminders`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสรายการเตือน |
| `user_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้ป่วยเจ้าของรายการ |
| `medication_id` | `uuid` | ไม่ได้ | — | FK → `medications.id` | ยาที่นำมาสร้างรายการเตือน |
| `reminder_times` | `text[]` | ไม่ได้ | — | — | เวลาเตือน เช่น `['08:00', '20:00']` |
| `start_date` | `date` | ไม่ได้ | — | — | วันที่เริ่มรายการ |
| `end_date` | `date` | ได้ | — | — | วันที่สิ้นสุด |
| `status` | `text` | ไม่ได้ | `active` | CHECK: `pending_confirmation`, `active`, `completed`, `cancelled`, `paused` | สถานะรายการเตือน |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างรายการ |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |
| `dispensing_item_id` | `uuid` | ได้ | — | compatibility; ไม่มี FK ใน schema ล่าสุด | ค่าอ้างอิง flow แบ่งจ่ายเดิม |
| `created_by` | `uuid` | ได้ | — | FK → `profiles.id` | ผู้สร้างรายการ |
| `confirmed_by` | `uuid` | ได้ | — | FK → `profiles.id` | ผู้ยืนยัน ถ้ามี |
| `confirmed_at` | `timestamptz` | ได้ | — | — | เวลายืนยัน |
| `locked_at` | `timestamptz` | ได้ | — | — | เวลาล็อก |
| `email_pause_until` | `timestamptz` | ได้ | — | compatibility; out of scope | ค่าเดิมของ workflow email |

### 10. `medication_logs`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัส log |
| `reminder_id` | `uuid` | ไม่ได้ | — | FK → `medication_reminders.id` | รายการเตือนต้นทาง |
| `scheduled_datetime` | `timestamptz` | ไม่ได้ | — | — | วันเวลาตามรายการเตือน |
| `actual_datetime` | `timestamptz` | ได้ | — | — | เวลาที่ผู้ป่วยกดบันทึก |
| `status` | `text` | ไม่ได้ | `pending` | CHECK: `pending`, `taken`, `missed` | ผลการบันทึก |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้าง log |
| `updated_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาปรับปรุงล่าสุด |
| `record_deadline` | `timestamptz` | ได้ | — | compatibility; out of scope | ค่าเส้นตายจากแบบเก่า |
| `revision` | `integer` | ไม่ได้ | `1` | — | รุ่นข้อมูล |

`missed` คงไว้ตาม schema ล่าสุดเพื่อรองรับข้อมูลเดิม แต่ระบบปัจจุบันไม่คำนวณ missed ตามเวลาอัตโนมัติ

### 11. `notifications`

| ฟิลด์ | Type | NULL | Default | Key / constraint | ความหมาย |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ไม่ได้ | `gen_random_uuid()` | PK | รหัสข้อความ |
| `user_id` | `uuid` | ไม่ได้ | — | FK → `profiles.id` | ผู้รับข้อความ |
| `title` | `text` | ไม่ได้ | — | — | หัวข้อ |
| `message` | `text` | ไม่ได้ | — | — | เนื้อหา |
| `created_at` | `timestamptz` | ไม่ได้ | `now()` | — | เวลาสร้างข้อความ |
| `broadcast_id` | `uuid` | ได้ | — | compatibility; ไม่มี FK ใน schema ล่าสุด | ค่าอ้างอิง Broadcast แบบไม่สร้างตารางถาวร |

## ความสัมพันธ์และกติกา

| ความสัมพันธ์ | กติกา |
| --- | --- |
| `profiles` → `pai_appointments` | ผู้ป่วยหนึ่งบัญชีมีนัด active ของตนได้หลายรายการ; อ่านผ่าน PAI policy/RPC |
| `profiles` → `pai_medical_records` | ผู้ป่วยเห็นผลตรวจ active ของตนเมื่อสถานะนัด `completed` |
| `profiles` → `notifications` | ข้อความเป็นของผู้รับรายบัญชี |
| `departments` → `doctors` | แผนกใช้บอกความถนัด/สาขางานของแพทย์ |
| `services` → `daily_service_offerings` → `appointment_slots` | catalog บริการถูกเปิดให้แพทย์ในวันนั้น แล้วจึงสร้างเวลาจอง |
| `doctors` → `daily_service_offerings` | แพทย์เป็นผู้ให้บริการในวันนั้น |
| `appointment_slots` → `pai_appointments` → `pai_medical_records` | active PAI path: slot รองรับการจอง และนัดเป็นต้นทางของผลตรวจ |
| `appointment_slots` → `appointments` → `medical_records` | legacy/compatibility path; ไม่ใช่ route นัดหมายหลักที่ reverse-engineer พบ |
| `medications` → `inventory_logs` | ยาหนึ่งรายการมีประวัติคลังหลายรายการ |
| `medications` → `medication_reminders` → `medication_logs` | ยานำไปสร้างรายการเตือน และผู้ป่วยบันทึกผลแต่ละรายการ |

กติกา role, ownership, เวลา slot, ความจุ และสิทธิ์ต้องตรวจใน service/repository เพิ่มเติม เพราะบางข้อเป็น domain validation ไม่ใช่ SQL constraint ใน snapshot

## ลำดับชีวิตของข้อมูล

1. `medical` หรือ `staff_admin` เตรียม catalog บริการ; แผนกใช้จัดกลุ่มความถนัดของแพทย์
2. `medical` หรือ `staff_admin` เปิด `daily_service_offerings` ของบริการ+แพทย์+วันที่ แล้วสร้าง slot
3. `patient` เลือกบริการ/วันที่/แพทย์/slot จนเกิด `pai_appointments` ผ่าน `pai_book_appointment`
4. `staff_admin` หรือ `medical` จัดการสถานะนัดตามสิทธิ์ที่กำหนด
5. `medical` บันทึก `pai_medical_records` และรายการยาใน JSONB ผ่าน `pai_save_record`
6. งานเภสัชกรใน role `medical` ตรวจ stock และบันทึก `inventory_logs`
7. `staff_admin` จัดทำ `medication_reminders`; `patient` บันทึก `medication_logs`
8. คำสั่ง Broadcast ผ่าน RPC อาจบันทึก `broadcasts` และสร้าง `notifications` ให้ผู้รับ; ต้องตรวจ migration `09_broadcast_rpc.sql` บน target จริง

## ตารางและ workflow ที่ไม่ใช้

ไม่ใช้ตารางหรือ flow สำหรับ `reschedule_proposals`, `prescription_items`, `dispensing_events`, `dispensing_items`, `stock_reservations`, `prescription_changes`, `medication_log_changes`, `email_jobs`, worker, retry, email/Web Push, การแบ่งจ่าย, กันยา, ยาค้าง, การคืนยา และการชำระเงิน. `broadcasts` ใน migration normalized รุ่นเก่าไม่ใช้ แต่ Broadcast path ใน `09_broadcast_rpc.sql` เป็นเส้นทางแยกที่ต้องตรวจ target จริง

ฟิลด์ compatibility ที่ยังเห็นใน schema เช่น `dispensing_item_id`, `email_pause_until`, `revision` และ `broadcast_id` มีไว้รองรับข้อมูลเดิมเท่านั้น ไม่ควรนำไปสร้าง workflow ใหม่โดยไม่มี requirement เพิ่ม

## แผน migration

### ฐานข้อมูลใหม่

1. `supabase/migrations/01_schema.sql`
2. `supabase/migrations/02_rls.sql`
3. `supabase/migrations/06_consolidate_roles.sql`
4. `supabase/migrations/07_add_contract_fields.sql`
5. `supabase/migrations/08_allow_medical_patient_search.sql`
6. `supabase/migrations/09_broadcast_rpc.sql` ถ้าต้องใช้ Broadcast path ปัจจุบัน
7. `supabase/migrations/13_services_and_daily_offerings.sql`
8. `supabase/migrations/13_pai_manual_appointments_records.sql`
9. `supabase/migrations/14_pai_restrict_new_objects.sql`
10. `supabase/migrations/15_pai_rejection_reason.sql`
11. `supabase/migrations/16_pai_workspace_rejection_reason.sql`
12. `supabase/migrations/17_allow_public_view_services_and_slots.sql` ตาม policy ที่ทีมอนุมัติ

ไม่ต้องรัน `03_normalized_transactions.sql`, `04_broadcast_notification_type.sql` หรือ `05_simplify_broadcast_recipients.sql` เพราะเป็น migration ของแบบ normalized รุ่นเก่า. ไฟล์สองชุดขึ้นต้นด้วย `13_` จึงต้องตรวจ migration history/target ก่อน push ไม่สรุปจากชื่อไฟล์อย่างเดียว

### ฐานข้อมูลเดิมที่มีข้อมูล

1. สำรองข้อมูลก่อน
2. รัน `supabase/migrate_existing_schema_preserve_data.sql`
3. ถ้า legacy table มีข้อมูล สคริปต์จะหยุดและ rollback; ต้อง archive/export ก่อนจึงค่อยตัดสินใจลบ
4. ตรวจสอบ role และจำนวนข้อมูลใน `profiles`, `departments`, `medications`

### เพิ่มบริการและ offering ในฐานเดิม

หลังตรวจ target และสำรองข้อมูลแล้ว ให้รัน migration ใหม่ด้วยคำสั่ง:

```bash
supabase db push
```

Migration `13_services_and_daily_offerings.sql` จะเพิ่ม `services`, `daily_service_offerings`, เพิ่ม `appointment_slots.daily_service_offering_id`, backfill slot เดิมด้วยบริการ legacy ตาม department และเปิด RLS ให้ผู้ป่วยอ่านเฉพาะรายการ active ส่วนการรันกับฐาน remote ต้องทำบน development/staging ที่ยืนยันแล้วเท่านั้น

### กรณี reset ทั้งฐาน

`supabase/reset_to_current_schema.sql` เป็นคำสั่ง destructive สำหรับล้างข้อมูลทั้งหมด ใช้เฉพาะฐานทดลองที่ยอมรับการสูญหายของข้อมูล และไม่ใช้แทน migration แบบ preserve-data
