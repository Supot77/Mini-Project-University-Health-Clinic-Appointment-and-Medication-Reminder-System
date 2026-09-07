-- WU Clinic Booking: destructive manual reset
--
-- ใช้เฉพาะเมื่อต้องการล้างตารางเดิมและสร้าง schema ปัจจุบันใหม่ทั้งหมด
-- คำสั่งนี้ลบข้อมูลในตารางที่ระบุแบบถาวร และไม่ควรรันกับ production โดยไม่สำรองข้อมูล
-- หลังจากรันส่วน RESET แล้ว ให้รันไฟล์ตามลำดับที่ระบุด้านล่างใน Supabase SQL Editor

BEGIN;

-- Legacy normalized tables จาก migrations 03-05
-- รวม broadcast_recipients เผื่อฐานข้อมูลเก่าเคยมีตารางนี้
DROP TABLE IF EXISTS public.medication_log_changes CASCADE;
DROP TABLE IF EXISTS public.prescription_changes CASCADE;
DROP TABLE IF EXISTS public.stock_reservations CASCADE;
DROP TABLE IF EXISTS public.dispensing_items CASCADE;
DROP TABLE IF EXISTS public.dispensing_events CASCADE;
DROP TABLE IF EXISTS public.prescription_items CASCADE;
DROP TABLE IF EXISTS public.reschedule_proposals CASCADE;
DROP TABLE IF EXISTS public.email_jobs CASCADE;
DROP TABLE IF EXISTS public.broadcast_recipients CASCADE;
DROP TABLE IF EXISTS public.broadcasts CASCADE;

-- Current tables: ลบแล้วสร้างใหม่จาก migration 01
DROP TABLE IF EXISTS public.medication_logs CASCADE;
DROP TABLE IF EXISTS public.medication_reminders CASCADE;
DROP TABLE IF EXISTS public.inventory_logs CASCADE;
DROP TABLE IF EXISTS public.medical_records CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.appointment_slots CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ฟังก์ชันนี้จะถูกสร้างใหม่/แทนที่โดย migration 02
DROP FUNCTION IF EXISTS public.get_user_role();

COMMIT;

-- รันต่อใน Supabase SQL Editor ตามลำดับนี้:
-- 1. supabase/migrations/01_schema.sql
-- 2. supabase/migrations/02_rls.sql
-- 3. supabase/migrations/06_consolidate_roles.sql
-- 4. supabase/migrations/07_add_contract_fields.sql
--
-- ห้ามรัน migrations/03_normalized_transactions.sql และ 04-05
-- เพราะเป็นตาราง/flow ที่อยู่นอก scope ปัจจุบัน
-- หากต้องการข้อมูลตัวอย่างสำหรับการสาธิต ค่อยรัน supabase/seed.sql หลังจากข้อ 4
