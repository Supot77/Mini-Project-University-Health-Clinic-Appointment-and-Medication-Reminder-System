# Technical Design: Database-backed Departments and Doctors Management

- **Date**: 2026-09-08
- **Module**: Shop / Scheduling (แผนก แพทย์ ตารางและ slot)
- **Author**: Antigravity Assistant & Engineering Team
- **Status**: Approved by User

---

## 1. Overview & Objective

เชื่อมต่อระบบจัดการแผนก (`departments`) และแพทย์ (`doctors`) ในหน้า `/departments` (`DepartmentWorkspace.tsx`) เข้ากับฐานข้อมูลจริงของ Supabase ตามข้อกำหนด Database-First ใน `AGENTS.md` แทนที่การใช้ In-memory Mock Repository เพียงอย่างเดียว เพื่อให้เจ้าหน้าที่ (`staff_admin`) สามารถเพิ่ม แก้ไข และเปิด/ปิดการใช้งานแผนกและแพทย์บนฐานข้อมูลจริงได้สำเร็จ พร้อมแสดงผลข้อมูลที่เชื่อมโยงกับ `profiles` อย่างถูกต้อง

---

## 2. Database Schema & RLS Policy

### 2.1 Schema Mapping

1. **Table `departments`**:
   - `id` (uuid, PK, default `gen_random_uuid()`)
   - `name` (text, NOT NULL)
   - `description` (text, Nullable)
   - `is_active` (boolean, default `true`)
   - `created_at`, `updated_at` (timestamptz)

2. **Table `doctors`**:
   - `id` (uuid, PK, FK → `profiles.id`)
   - `specialty` (text, Nullable)
   - `department_id` (uuid, Nullable, FK → `departments.id`)
   - `created_at`, `updated_at` (timestamptz)

3. **Table `profiles`** (ความสัมพันธ์):
   - `id` (uuid, PK, FK → `auth.users.id`)
   - `full_name` (text)
   - `role` (`'patient' | 'medical' | 'staff_admin'`)
   - `is_active` (boolean)

### 2.2 RLS Migration (`supabase/migrations/09_staff_admin_manage_doctors.sql`)

ปัจจุบันตาราง `doctors` มีเฉพาะ policy `SELECT` และตาราง `profiles` อนุญาตให้อัปเดตเฉพาะโปรไฟล์ตนเอง จึงจำเป็นต้องเพิ่มสิทธิ์ให้ `staff_admin` ดังนี้:

```sql
-- 1. ให้ staff_admin จัดการตาราง doctors ได้ทั้งหมด
CREATE POLICY "Staff/Admin can manage doctors"
  ON public.doctors FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN ('staff_admin', 'admin', 'staff')
  )
  WITH CHECK (
    public.get_user_role() IN ('staff_admin', 'admin', 'staff')
  );

-- 2. ให้ staff_admin อัปเดตสถานะ is_active ของ profiles ได้
CREATE POLICY "Staff/Admin can update profiles active status"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('staff_admin', 'admin', 'staff')
  );
```

---

## 3. Data Access & Repository Architecture

### 3.1 Repository Contract Consistency
- คง interface `ShopRepository` ใน `src/features/shop/domain/repository.ts` เพื่อให้ UI และ Consumer ไม่ขึ้นกับชนิดของแหล่งข้อมูล
- สร้าง `DatabaseShopRepository` ใน `src/features/shop/data/databaseRepository.ts`
- คง `MockShopRepository` ไว้เพื่อใช้งานใน Automated Tests (Vitest) เพื่อความ deterministic

### 3.2 Operations & Data Flow

1. **ดึงข้อมูล (Fetch)**:
   - `departments`: ดึงจาก `departments` เรียงตาม `name ASC`
   - `doctors`: ดึงจาก `doctors` พร้อม Join `profile:profiles!doctors_id_fkey(id, full_name, role, is_active)`
   - `doctorAccounts`: ดึงจาก `profiles` ที่ `role = 'medical'` และ `is_active = true` สำหรับให้เจ้าหน้าที่เลือกผูกเป็นแพทย์
2. **จัดการแผนก (`saveDepartment` / `toggleDepartment`)**:
   - สร้างใหม่: `INSERT INTO departments (name, description, is_active)`
   - แก้ไข: `UPDATE departments SET name = ..., description = ... WHERE id = ...`
   - เปิด/ปิด: `UPDATE departments SET is_active = NOT is_active WHERE id = ...` (Soft delete ปลอดภัยต่อ FK)
3. **จัดการแพทย์ (`saveDoctor` / `toggleDoctor`)**:
   - ผูกแพทย์ใหม่: `INSERT INTO doctors (id, specialty, department_id) VALUES (profileId, specialty, departmentId)`
   - แก้ไขแพทย์: `UPDATE doctors SET specialty = ..., department_id = ... WHERE id = ...`
   - เปิด/ปิดการทำงาน: `UPDATE profiles SET is_active = NOT is_active WHERE id = ...`

---

## 4. UI Alignment (`DepartmentWorkspace.tsx`)

1. **ปรับลดฟิลด์ที่ไม่มีใน Database**:
   - นำฟิลด์ `code`, `room`, `tone` ออกจากแบบฟอร์มและการ์ดแผนก เพื่อให้ตรงกับ Database Schema จริง 100%
   - ฟอร์มแผนกเหลือ: `name` (ชื่อแผนก) และ `description` (คำอธิบาย)
2. **ปรับปรุงแบบฟอร์มแพทย์**:
   - เลือกบัญชีบุคลากรทางการแพทย์ (`doctorAccounts`)
   - เลือกแผนกที่เปิดใช้งาน
   - ระบุความเชี่ยวชาญ (`specialty`)
3. **UX & Feedback**:
   - แสดงสถานะ Loading ขณะดึงหรือบันทึกข้อมูล
   - แสดงข้อความสำเร็จ (Notice banner)
   - แสดง Error Alert ภาษาไทยหากเกิดปัญหาจาก Supabase หรือสิทธิ์ RLS

---

## 5. Verification & Quality Gates Plan

1. **Automated Tests**:
   - ทดสอบ `MockShopRepository` ทำงานตาม contract
   - ทดสอบ mapping logic ระหว่าง database records กับ domain types
2. **Quality Gates**:
   - `npm run lint` : 0 errors
   - `npx --no-install tsc --noEmit` : 0 errors
   - `npm run test` : ผ่าน 100%
   - `npm run build` : สร้าง Production bundle สำเร็จ
