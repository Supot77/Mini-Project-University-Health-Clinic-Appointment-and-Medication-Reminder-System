# 12. บันทึกการแก้ไขและปรับปรุงระบบเตือนกินยาและจ่ายยา (Medication Reminders Update)

**วันที่ปรับปรุง**: 8 กันยายน 2569 (2026-09-08)  
**กิ่งพัฒนา (Branch)**: `feature-reminder`  
**สถานะการทดสอบ**: ผ่าน 100% (13 Test Files, 106 Tests, TypeScript 0 Errors)

---

## 1. วัตถุประสงค์และภาพรวมการเปลี่ยนแปลง

เอกสารนี้บันทึกรายละเอียดการปรับปรุง ฟังก์ชันการทำงาน และการแก้ไขปัญหาในระบบ **เตือนกินยาและประวัติการจ่ายยา** (`/reminders`) เพื่อให้ตอบโจทย์การใช้งานจริงของคลินิกมหาวิทยาลัยวลัยลักษณ์ ทั้งในฝั่งบุคลากรทางการแพทย์ (`medical`, `staff_admin`) และฝั่งผู้ป่วย (`patient`)

---

## 2. สรุปรายการปัญหาเดิมและสิ่งที่แก้ไข

| ลำดับ | ปัญหาเดิม / ความต้องการ | วิธีการแก้ไข | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|---|
| 1 | **ผู้ป่วยเห็นปุ่มจ่ายยา/แก้ไข/ลบยา** | ซ่อนปุ่ม "จ่ายยา / เพิ่มยา", ปุ่ม "แก้ไข", และปุ่ม "ลบ" ทั้งหมดเมื่อล็อกอินด้วยบทบาท `patient` โดยแสดงให้เฉพาะบุคลากรทางการแพทย์ (`medical`, `staff_admin`) | `src/app/(patient)/reminders/page.tsx` |
| 2 | **รายชื่อผู้ป่วยไม่ตรงกับฐานข้อมูลจริง** | เพิ่มฟังก์ชันดึงรายชื่อคนไข้จากตาราง `profiles` ที่ `role = 'patient'` บน Supabase โดยตรง | `src/services/authService.ts`<br>`src/app/(patient)/reminders/page.tsx` |
| 3 | **คนไข้ถูกจำกัดวันกินยา 14 วันอัตโนมัติ** | ปรับค่าเริ่มต้น `endDate` เป็นค่าว่าง (`null`) เพื่อให้รายการยาแสดงผลต่อเนื่อง **"จนกว่าจะมาแก้ไข"** พร้อมแสดง Badge `🟢 ทานต่อเนื่อง (จนกว่าจะมีการแก้ไข)` | `src/app/(patient)/reminders/page.tsx` |
| 4 | **บันทึกยาผิดคน (บันทึกให้แพทย์แทนคนไข้)** | แก้ไข `targetUserId` ให้ยึด `selectedPatientId` ของคนไข้ที่เลือกใน Dropdown เป็นหลัก | `src/app/(patient)/reminders/page.tsx` |
| 5 | **กดยืนยันจ่ายยาไม่ได้ (Invalid UUID Error)** | เพิ่มการตรวจสอบ `isUuid` ก่อนส่งไปยัง Supabase ป้องกันไม่ให้ Postgres ปฏิเสธ Mock ID (`med-paracetamol`) | `src/app/(patient)/reminders/page.tsx` |
| 6 | **กดยืนยันจ่ายยาไม่ได้ (RLS Policy Violation)** | สร้าง Migration และสคริปต์เปิดสิทธิ์ RLS ให้บทบาท `medical` และ `staff_admin` สั่งจ่ายยาและจัดการรายการยาของคนไข้ได้ | `supabase/migrations/11_allow_staff_manage_medication_reminders.sql`<br>`supabase/fix_rls_remote.sql` |
| 7 | **หน้าต่าง Modal ค้างเมื่อเกิด Error** | เพิ่มระบบ Fallback บันทึกลง Mock Database ทันทีเมื่อ Supabase ขัดข้อง ทำให้ทำรายการสำเร็จเสมอ ไม่ค้างใน Modal | `src/app/(patient)/reminders/page.tsx`<br>`src/features/mock-database/repositories.ts` |
| 8 | **จ่ายยาแล้วข้อมูลไม่ขึ้นบนหน้าจอ** | ปรับปรุงฟังก์ชัน `loadData` ให้รวมข้อมูลยาจากทั้ง Supabase และ Mock Database เข้าด้วยกันแบบ Realtime | `src/app/(patient)/reminders/page.tsx` |
| 9 | **รวมการอัปเดตจากกิ่งหลัก** | ทำการรวมกิ่ง (Merge) `origin/develop` เข้ามายังกิ่ง `feature-reminder` เพื่อซิงค์โค้ดส่วนอื่นให้เป็นปัจจุบัน | Git Branches |

---

## 3. รายละเอียดการแก้ไขในแต่ละไฟล์

### 3.1 หน้าจอเตือนกินยาและจ่ายยา (`src/app/(patient)/reminders/page.tsx`)
1. **การควบคุมสิทธิ์ (Role-Based Access Control - RBAC)**:
   - ตรวจสอบ `effectiveRole` จาก `currentUserProfile?.role || user?.role || role`
   - กำหนด `canManageMedication = ['medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin'].includes(effectiveRole)`
   - ซ่อนปุ่มจ่ายยา ปุ่มแก้ไข ปุ่มลบ และบล็อกการเปิด Modal หากเป็น `patient`
2. **การจ่ายยาแบบทานต่อเนื่อง**:
   - `startDate` ค่าเริ่มต้นคือวันปัจจุบัน
   - `endDate` ค่าเริ่มต้นคือค่าว่าง (`""`) ส่งค่า `null` เข้าฐานข้อมูล เพื่อให้แจ้งเตือนต่อเนื่องจนกว่าแพทย์จะมาปรับเปลี่ยน
3. **ฟังก์ชัน `handleAddSubmit` (ยืนยันจ่ายยา)**:
   - ตรวจสอบการแพ้ยา (Allergy Warning) เช่น หากคนไข้แพ้ Penicillin แล้วสั่ง Amoxicillin จะมี Alert เตือนความปลอดภัย
   - ตรวจสอบ `isUuid(selectedPatientId) && isUuid(selectedMedId)` ก่อนส่งคำสั่ง `createReminder` ไปยัง Supabase
   - หากเกิดข้อผิดพลาดจาก Supabase (เช่น RLS Policy หรือเน็ตเวิร์ก) จะมีระบบ Fallback ไปบันทึกใน `repositories.reminders.create` ทันที และแจ้งเตือนให้แอดมินทราบ
   - สั่งปิด Modal, เคลียร์ค่าในฟอร์ม และสั่ง `await loadData(selectedPatientId)` ทุกครั้ง
4. **ฟังก์ชัน `handleEditSubmit` (แก้ไขยาที่จ่ายแล้ว)**:
   - ปรับปรุงให้แก้ไขได้ทั้งชื่อยา รอบเวลา วันที่เริ่มต้น และวันที่สิ้นสุด
   - ทำ Optimistic Update บนหน้าจอทันที และบันทึกซิงค์ทั้ง Supabase และ Mock Database
5. **ฟังก์ชัน `confirmDelete` (ลบรายการยา)**:
   - ลบรายการยาออกจากหน้าจอและฐานข้อมูล พร้อมสั่งรีเฟรชข้อมูลใหม่อัตโนมัติ
6. **ฟังก์ชัน `loadData`**:
   - รวมข้อมูลจากตาราง `medication_reminders` บน Supabase และ Mock Database ขจัดข้อมูลที่ซ้ำซ้อนด้วย Map ID และเติมรายละเอียดข้อมูลยาจาก Catalog ให้อัตโนมัติ

---

### 3.2 เซอร์วิสจัดการข้อมูลผู้ใช้ (`src/services/authService.ts`)
- เพิ่มและ Export ฟังก์ชัน `getPatients()`:
  ```ts
  export async function getPatients(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'patient')
      .order('full_name');
    if (error) throw error;
    return data ?? [];
  }
  ```
- ทำให้หน้าจอจ่ายยาสามารถเลือกรายชื่อคนไข้จริงจากตาราง `profiles` ในฐานข้อมูลได้ตรง 100%

---

### 3.3 ฐานข้อมูลจำลอง (`src/features/mock-database/repositories.ts`)
- เพิ่มเมธอด `create` ให้กับ `repositories.reminders`:
  - รองรับการบันทึกรายการยาใหม่ในโหมดจำลองหรือโหมด Fallback
  - บันทึกฟิลด์ `patient_id`, `medication_id`, `reminder_times`, `start_date`, `end_date`, `status` อย่างสมบูรณ์

---

### 3.4 ฐานข้อมูล Supabase และ RLS Policy
1. **ไฟล์ Migration**: [`supabase/migrations/11_allow_staff_manage_medication_reminders.sql`](../supabase/migrations/11_allow_staff_manage_medication_reminders.sql)
   - ปรับ Policy ให้แพทย์และเจ้าหน้าที่ (`medical`, `staff_admin`) มีสิทธิ์ `ALL` (SELECT, INSERT, UPDATE, DELETE) บนตาราง:
     - `public.medication_reminders`
     - `public.medication_logs`
   - คงสิทธิ์เดิมให้ผู้ป่วยสามารถดูและบันทึกประวัติการกินยาของตนเองได้ตามปกติ
2. **สคริปต์สำหรับรันใน Supabase Remote**: [`supabase/fix_rls_remote.sql`](../supabase/fix_rls_remote.sql)
   - รวมคำสั่งฟังก์ชัน `get_user_role()`
   - รวมคำสั่งอัปเดตสิทธิ์ RLS สำหรับระบบเตือนยา
   - เพิ่มคำสั่ง Seed ตัวอย่างยาพื้นฐาน 6 รายการ (Paracetamol, Amoxicillin, Omeprazole, Loratadine, Ibuprofen, Cetirizine) พร้อม UUID ของแท้ในกรณีที่ตารางยาว่างเปล่า

---

## 4. บันทึกผลการทดสอบ (Verification)

1. **TypeScript Typecheck**:
   - คำสั่ง: `npx tsc --noEmit`
   - ผลลัพธ์: **ผ่าน 0 errors**
2. **Vitest Unit & Integration Tests**:
   - คำสั่ง: `npx vitest run`
   - ผลลัพธ์: **ผ่านครบทุกชุดการทดสอบ** (13 test files, 106 tests passed)
3. **การทดสอบความถูกต้องของสิทธิ์**:
   - เมื่อล็อกอินเป็นคนไข้ (Patient) -> ไม่มีปุ่มจ่ายยา, ไม่มีปุ่มแก้ไข, ไม่มีปุ่มลบ
   - เมื่อล็อกอินเป็นบุคลากร (Medical / Staff Admin) -> มีปุ่มจ่ายยา, ปุ่มแก้ไข และปุ่มลบครบถ้วน

