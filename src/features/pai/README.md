# งานปาย: นัด คิว ผลตรวจ และรายการยา

อัปเดต 8 กันยายน 2569 ตาม D22/D23, FR-APT-01–06 และ FR-MED-01–03

## Runtime และพฤติกรรม

- `/appointments` ใช้ route guard เดิมและ container ตาม patient/medical/staff_admin
- `/records` ตรวจ role ที่ server; เฉพาะผู้ป่วยและแพทย์ เจ้าหน้าที่ไม่เปิด diagnosis
- `runtime/databaseRepository.ts` ตรวจ session/active profile ทุกคำสั่งและเรียก Supabase RPC ด้วย client ของผู้ใช้ ไม่มี mock fallback
- `runtime/contract.ts` กำหนด validation/contract; SQL ตรวจ role/ownership/state ซ้ำ
- `runtime/mockRepository.ts` เป็น adapter test/offline เท่านั้น ไม่ import ใน production
- หน้าตัวอย่างเดิมยังอยู่เพื่อรักษา tests เก่า แต่ไม่อยู่ในเส้นทาง runtime

ผู้ป่วยเลือกรอบจากตารางเดิม กรอกเหตุผลและจองเป็น pending มีเลขคิวรายรอบ ปฏิเสธรอบเต็ม/ปิด/เริ่มแล้ว/แพทย์หรือแผนกไม่ active และจองซ้ำ ผู้ป่วยส่งคำขอยกเลิกได้ โดยยังไม่เปลี่ยนสถานะหรือคืนความจุจนเจ้าหน้าที่กดยกเลิก

เจ้าหน้าที่อนุมัติ/ปฏิเสธ/ยกเลิกนัดทีละรายการและเริ่ม/จบตรวจตามสถานะ แพทย์เริ่ม/จบตรวจเฉพาะนัดของตน จบตรวจต้องมีผลตรวจ ผู้ป่วยเห็นผลหลังจบตรวจเท่านั้น แพทย์อ่านประวัติผู้ป่วยที่รับผิดชอบได้ แต่แก้ผลของแพทย์อื่นไม่ได้

บันทึกผลตรวจครั้งเดียวต่อนัด เลือกยาจาก catalog จริง กรอกจำนวน ขนาดยา ความถี่ และระยะเวลา บันทึกพร้อมจบตรวจในธุรกรรมเดียวหรือบันทึกแล้วจบภายหลังก็ได้ ไม่มี version/automation คำสั่งผิดไม่ทิ้งผลตรวจบางส่วน

รายการยาเก็บใน `medical_records.prescribed_medications` ตาม contract กลาง: medication_id, name, dosage, frequency, duration_days, quantity ชื่อยามาจากฐาน ไม่เชื่อชื่อจาก client การจ่ายยา/ตัด stock เป็นงานกัญจน์และไม่ได้แก้ในงานนี้

## ขอบเขตและผลกระทบ

ไม่แก้ `src/features/shop/**`, `src/components/schedules/**`, routes ตาราง/แผนก, scheduleService, shared types, layout หรือ Supabase clients เดิม

Migration ใหม่สร้างเฉพาะตาราง ฟังก์ชัน policy และ index ชื่อ `pai_*` ไม่แก้ schema, RLS, status หรือ `booked_count` ของ slot เดิม การตรวจความจุอ่าน `appointment_slots.booked_count` ของช็อปแล้วบวกจำนวนนัด active ใน `pai_appointments`

ส่งต่อคู่ตรวจช็อปและเจ้าของโมดูล: การเขียน appointments/medical_records จาก authenticated client ต้องผ่าน RPC ใหม่ สิทธิ์อ่านนัดของ medical จำกัดเฉพาะนัดของตน staff ไม่อ่าน diagnosis ใครใช้ appointmentService เก่าที่เขียนตรงต้องย้ายมา contract ใหม่นี้ก่อนเปิด flow นั้น (runtime ปายใหม่ไม่ใช้ service เก่า) ไม่มีการส่งข้อความหรือเปิด PR แทนผู้ใช้

## ลงฐานเป้าหมาย

Deploy แล้วบน project `fjzqcmcyemtzrtvmlqdv` วันที่ 8 กันยายน 2569 ผ่าน migration history แยกเฉพาะ `20260908170000_pai_manual_appointments_records.sql` และ `20260908171000_pai_restrict_new_objects.sql` ตรวจ dry-run หลัง deploy แล้วฐานเป็น `upToDate: true`

1. เปิด SQL Editor ของ project `fjzqcmcyemtzrtvmlqdv` ตรวจว่าเป็น development/staging และสำรองข้อมูลเดิม
2. รัน `supabase/tests/pai-preflight.sql` (metadata/counts เท่านั้น) หากมีผลตรวจซ้ำ นัด active ซ้ำ หรือจำนวนจองไม่ตรง ให้เจ้าของตรวจแก้ก่อน ไม่ลบข้อมูลเพื่อให้ migration ผ่าน
3. ให้เจ้าของ auth ยืนยันผู้ป่วยเปลี่ยน profiles.role/is_active ของตนเพื่อยกระดับสิทธิ์ไม่ได้ Policy เก่า “Users can update own profile” เพียงอย่างเดียวไม่ป้องกันการเปลี่ยนคอลัมน์สิทธิ์ งานปายอ่าน role ที่ฐานควบคุมและไม่แก้โมดูล auth ของฟีม
4. ใช้ฐาน 11 ตารางที่มี canonical roles และ contract fields แล้ว รัน `supabase/migrations/13_pai_manual_appointments_records.sql` ทั้งไฟล์ SQL ใช้ transaction ไม่มี reset/seed/ลบข้อมูล/แก้ตารางช็อป
5. Environment แอปต้องมี NEXT_PUBLIC_SUPABASE_URL ตาม URL ข้างต้น และ public key ของ project เดียวกันใน NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY ไม่ใส่ service_role ไม่ส่ง key ในแชต ไฟล์ .env.local เดิมไม่ได้เปิดหรือแก้
6. ใช้บัญชีสังเคราะห์ผู้ป่วยสองคน แพทย์สองคน และเจ้าหน้าที่หนึ่งคน ทดสอบจองพร้อมกันที่ความจุ 1, อ่านข้ามบัญชี, เริ่ม/จบตรวจ, ขอ/อนุมัติยกเลิก, บันทึกยาผิดแล้ว state เดิมคงอยู่
7. ตรวจ Chrome 360px/1280px, keyboard, loading/empty/error ด้วย session จริงก่อนรับงาน

## การทดสอบ

`tests/pai-runtime.test.ts` และ `tests/pai-runtime-ui.test.tsx` เพิ่ม 23 tests: contract/adapter/session/role/validation/UI รวมรักษา state หลังล้มเหลวและ retry; pai-runtime-fixtures.ts เป็นข้อมูลสังเคราะห์

PostgreSQL integration แยก: `supabase/tests/pai-local-integration.mjs` ใช้ PGlite ในหน่วยความจำ ไม่มี network/credentials ติดตั้งในโฟลเดอร์ชั่วคราวและส่ง path ของ package เป็น argument ไม่เพิ่ม dependency ใน package.json

```powershell
node supabase/tests/pai-local-integration.mjs C:/Users/sspy2/AppData/Local/Temp/uniclinic-pai-sql-tests/node_modules/@electric-sql/pglite/dist/index.js
```

ตรวจ 29 assertions: migration ใช้ซ้ำได้, role/ownership/RLS, ซ่อนผลก่อนจบตรวจ, ห้ามแก้หลังบันทึก, rollback, capacity/คำขอยกเลิก, JSON ยาและไม่แตะ stock ไม่ใช่หลักฐาน Supabase remote หรือ concurrency แบบหลาย connection

Bootstrap local integration แก้ delimiter $func ที่ผิดใน 02_rls.sql เฉพาะ string ในฐานจำลองเพื่อทดสอบ policies เดิม ไม่ได้แก้ไฟล์ migration เก่า เจ้าของต้องตรวจแก้ไฟล์เก่าก่อนใช้ติดตั้งฐานใหม่

## ผลตรวจและข้อจำกัด

- Full suite ผ่าน 142 tests / 19 files (รวมใหม่ 23 ข้อ) ใช้ `npm.cmd run test -- --maxWorkers=2 --minWorkers=1` นอก sandbox เนื่องจาก esbuild ถูกปฏิเสธสิทธิ์อ่าน config
- Lint เฉพาะไฟล์ปายใหม่ผ่าน; full lint ยังมี error เดิมที่ `src/app/(patient)/reminders/page.tsx:168` (react-hooks/set-state-in-effect) และ warnings นอกขอบเขต
- Typecheck/build ติด export เดิมที่หาย getStaffProfileDirectory/StaffProfileDirectoryItem จาก dashboardService ซึ่งใช้ใน StaffProfileDirectory ไม่แก้ไฟล์เฮิร์บ/ฟีมเพื่อกลบปัญหา
- Build ใน sandbox ติด Google Fonts ด้วย; รันนอก sandbox แล้วเหลือ export เดิม
- ยังไม่ได้ตรวจ Chrome จริง 360/1280, session จริง, remote SQL/RLS และจองพร้อมกันหลาย connection เพราะไม่มี browser/ช่องทางจัดการฐานที่เชื่อมต่อ
- ยังไม่ commit/push และยังไม่อ้างว่าพร้อมใช้งานจริงครบทั้งหมดจน deploy SQL และปิดข้อจำกัดข้างต้น
