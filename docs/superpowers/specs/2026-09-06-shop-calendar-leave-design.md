# Shop Calendar and Doctor Leave Design

วันที่: 6 กันยายน 2569 (2026-09-06)

สถานะ: design สำหรับ review ก่อน implementation

> สถานะเพิ่มเติม: superseded เฉพาะข้อกำหนด mock-only โดย D23 ใน `docs/10_team_decisions.md` หากนำ flow ที่ยังอยู่ใน scope มาใช้ ต้องผ่าน Supabase database repository; mock ใช้เฉพาะ tests/offline demo

## 1. เป้าหมาย

ปรับปฏิทินของช้อปให้มีมุมมอง Day, Week และ Month ในรูปแบบเรียบคล้าย Google Calendar โดยแสดงข้อมูลรอบตรวจและสถานะวันลาเท่าที่จำเป็นต่อการทำงานของเจ้าหน้าที่ ไม่ทำรายละเอียดระดับ Google Calendar ทั้งหมด

เพิ่มตารางประจำแพทย์แบบรายสัปดาห์ ให้ระบบสร้างตารางแนะนำเริ่มต้น แล้วแพทย์ปรับแต่งได้เอง พร้อม workflow วันลาแบบ `pending → approved/rejected` และการปิดรอบอัตโนมัติเมื่อวันลาได้รับอนุมัติ

ระยะนี้ใช้ mock data/mock repository เท่านั้น ไม่เชื่อม Supabase หรือฐานข้อมูลจริง

## 2. ขอบเขตและเจ้าของงาน

ช้อปเป็นเจ้าของแผนก แพทย์ ตารางตรวจ และความจุรอบ ปายเป็นคู่ตรวจและเจ้าของ flow นัดหมาย การเปลี่ยนแปลงรอบหรือสถานะปิดต้องไม่แก้การจอง, `bookedCount`, การเลื่อนนัด หรือการยกเลิกนัดของปายโดยตรง

รวม:

- Day/Week/Month calendar views และ toolbar แบบ Google Calendar อย่างย่อ
- filter แผนก แพทย์ และสถานะ
- ตารางประจำแพทย์ จ.–ศ. พร้อม template แนะนำ
- แพทย์ปรับช่วงเวลา, เปิด/ปิดวันทำงาน และความจุต่อ slot
- แพทย์ส่งคำขอวันลา; เจ้าหน้าที่อนุมัติ/ปฏิเสธใน mock UI
- auto-close เฉพาะ future slots ในช่วง approved leave
- auto-reopen เฉพาะ slot ที่ระบบปิดด้วยเหตุผล `doctor_leave` หลังวันลาสิ้นสุด
- mockup ที่โต้ตอบได้จริงและแชร์ state กับ calendar flow

ไม่รวม:

- Supabase migration, RLS, RPC, worker หรือ email
- atomic booking และการย้าย/ยกเลิกนัด
- การ cancel นัดอัตโนมัติเมื่อหมอลา
- หลายสาขา, วันหยุดภายนอก, timezone อื่น หรือรอบข้ามวัน
- persistence หลัง refresh; mock state กลับค่าเริ่มต้น

## 3. Visual and interaction direction

อ้างอิง Google Calendar เฉพาะโครงปฏิทิน:

- toolbar มี `วันนี้`, ก่อนหน้า, ถัดไป, ชื่อช่วงวันที่ และ selector `วัน | สัปดาห์ | เดือน`
- Week เป็นค่าเริ่มต้นบน desktop; Day เป็นค่าเริ่มต้นบน mobile; Month ใช้ดูภาพรวมและวันลา
- event chip แสดงเวลา, ชื่อแพทย์ และ occupancy สั้น ๆ
- status rail ซ้ายของ chip เป็น signature ของคลินิก: น้ำเงิน `available`, amber `full`, แดง `closed`, ม่วง `leave`
- พื้นหลัง slate อ่อน, เส้นแบ่งบาง, radius พอดี, ไม่มี drag-and-drop หรือ decoration ที่ทำให้ grid หนาแน่น
- keyboard focus ชัด, ทุก action ใช้ keyboard ได้, `prefers-reduced-motion` ปิด animation ที่ไม่จำเป็น

ตัวอย่างโครง:

```text
[วันนี้] [‹] [›]  กันยายน 2569              [วัน|สัปดาห์|เดือน] [แผนก] [หมอ]

อา.       จ.             อ.             พ.             พฤ.          ศ.       ส.
          08:30 Strange  09:00 Grey     วันลา·รออนุมัติ
          0/4            เต็ม 4/4       ปิดอัตโนมัติ
```

Interaction ที่ต้องทำงานจริงใน mock UI:

1. เปลี่ยน view แล้วคง filter และชุดข้อมูลเดียวกัน
2. กดวันนี้/ก่อนหน้า/ถัดไปเพื่อเปลี่ยนช่วงวันที่
3. กดช่องว่างเพื่อเปิด form สร้าง slot โดยเติมวันที่ให้อัตโนมัติ
4. กด chip เพื่อเปิดรายละเอียด slot/leave และแก้ไขหรือปิดรอบตามสิทธิ์
5. กดปุ่มจัดการตารางหมอเพื่อดู/แก้ recurring schedule
6. ส่งคำขอลาแล้วเห็นสถานะ pending; อนุมัติแล้วเห็น leave chip และ slot ปิดในทันที
7. กด filter แล้วรายการในทุกมุมมองเปลี่ยนตามทันที

## 4. Domain model

### DoctorWeeklySchedule

- `id`
- `doctorId`
- `weekday` เป็น 1–5 (จันทร์–ศุกร์)
- `startTime`, `endTime` รูป `HH:mm`
- `slotDurationMinutes` ค่าแนะนำ 30 และแก้ได้เฉพาะค่าที่ระบบรองรับ
- `defaultCapacity` ค่าแนะนำ 1 และแก้ได้
- `isActive`

หนึ่งแพทย์มีหลายช่วงในวันเดียวได้ แต่ช่วงต้องไม่ทับกันและห้ามทับพัก 12:00–13:00

### LeaveRequest

- `id`
- `doctorId`
- `startDate`, `endDate` รูป `YYYY-MM-DD` รวมวันต้นและวันท้าย
- `reason`
- `status`: `pending | approved | rejected`
- `requestedBy`
- `decidedBy?`, `decidedAt?`

ช่วงวันลาต้องไม่ข้ามวันผิดลำดับ วันลา approved ที่ทับกันสำหรับแพทย์คนเดียวกันห้ามสร้างซ้ำ

### ScheduleSlot additions

เพิ่ม `closedReason?: 'manual' | 'doctor_leave'` ให้ `ScheduleSlot` เดิม

- manual close ตั้ง `closedReason=manual`
- auto-close จาก approved leave ตั้ง `closedReason=doctor_leave`
- reopen จากระบบทำได้เฉพาะ `closedReason=doctor_leave`
- การปิด slot ไม่เปลี่ยน `bookedCount` และไม่ลบนัด

## 5. Recommended template and generation

เมื่อสร้างแพทย์ใหม่ ระบบสร้าง recurring schedule แนะนำ:

- จันทร์–ศุกร์
- 08:30–12:00 และ 13:00–16:30
- แบ่ง slot ละ 30 นาที
- ความจุเริ่มต้น 1 คน

แพทย์แก้ช่วงเวลา, ปิดวัน, และความจุได้ผ่าน schedule editor การ generate slot ใช้ช่วงวันที่ที่กำลังดูหรือช่วงที่ repository ขอ ไม่สร้างข้อมูลไม่จำเป็นทั้งปี

การสร้าง slot ต้องไม่ทับ slot เดิม หากพบ slot ที่มีอยู่แล้วให้คง slot เดิมและ reconcile status แทน ไม่สร้างซ้ำ

## 6. Leave and auto-close flow

1. Doctor ส่ง `pending` leave request พร้อมช่วงวันที่และเหตุผล
2. Staff เห็น pending requests และเลือก approve/reject
3. เมื่อ approve repository ตรวจช่วงวันที่และรอบที่เกี่ยวข้อง แล้วเรียก reconciliation ใน operation เดียวของ mock state
4. reconciliation ปิดเฉพาะ slot ที่:
   - เป็นของ doctor คนดังกล่าว
   - `slotDate >= today` ใน Asia/Bangkok
   - อยู่ในช่วง leave
   - ยังไม่ manual closed
5. slot ที่มีนัดยังคงอยู่, `bookedCount` ไม่เปลี่ยน, ไม่ auto-cancel; staff จัดการนัดทีละรายการตามข้อตกลงเดิม
6. เมื่อโหลด/เปลี่ยนช่วง/แก้ leave ระบบ reconcile อีกครั้ง เปิดกลับเฉพาะ slot `closedReason=doctor_leave` ที่อยู่นอกช่วง approved leave แล้วคำนวณ `available/full` ใหม่
7. ถ้า leave rejected ไม่มีผลต่อ slot

Mock ไม่มี background worker; reconciliation เกิดตอน snapshot/query, approve/reject และเปลี่ยนช่วงปฏิทิน เพื่อให้ deterministic

## 7. Repository and data flow

เพิ่ม method ใน `ShopRepository` contract สำหรับ:

- อ่าน recurring schedules และ leave requests
- สร้าง/แก้ recurring schedule
- สร้าง leave request
- approve/reject leave
- generate/reconcile slots ในช่วงวันที่

`MockShopRepository` เป็น implementation ปัจจุบัน `repositoryFactory` ยังเลือก mock อยู่ database adapter ในอนาคตต้องใช้ contract เดียวกันและไม่เปลี่ยน UI/domain logic

Provider เก็บ repository หนึ่ง instance และเผยแพร่ snapshot เดียวให้ DepartmentWorkspace, ScheduleWorkspace และ leave UI คำสั่งสำเร็จจึง refresh snapshot; คำสั่งผิดพลาดต้องคืน discriminated result และไม่ mutate state

## 8. Validation and error handling

- weekday 1–5, date valid และ end date ไม่ก่อน start date
- เวลา `HH:mm`, start < end, อยู่ในเวลาคลินิก, ไม่ทับพัก
- duration เป็นค่าที่รองรับและหารช่วงเวลาได้ลงตัว
- capacity เป็น integer >= 1
- doctor/department ต้อง active สำหรับ schedule ใหม่
- recurring schedule และ slot ห้าม overlap
- approved leave ห้าม overlap leave เดิมของ doctor
- unknown ID, duplicate account, invalid leave และ conflict คืน field/global error โดยไม่เปลี่ยน state
- UI แสดง empty state เมื่อไม่มี schedule/leave และ error พร้อม retry เมื่อ query fail

## 9. Testing and acceptance

### Domain/repository

- template ได้วันและช่วงเวลาตามกติกา 30 นาที, capacity 1
- doctor ปรับ template แล้ว generate slot ถูกต้อง ไม่สร้างซ้ำ
- invalid weekday/time/break/duration/capacity ถูกปฏิเสธ
- pending leave ไม่ปิด slot; approved leave ปิดเฉพาะ future slots
- leave สิ้นสุดเปิดกลับเฉพาะ `doctor_leave`; manual close คงปิด
- existing appointments และ `bookedCount` ไม่เปลี่ยน
- duplicate leave, unknown IDs และ command error ไม่ mutate state

### UI/integration

- Day/Week/Month แสดง event และ filter ชุดเดียวกัน
- toolbar เปลี่ยนช่วงและกลับวันนี้ได้
- create/edit slot ผ่าน form แล้ว calendar update
- schedule editor และ leave dialog update provider state
- approve/reject leave เห็นผลบน calendar โดยไม่ refresh page
- keyboard, focus, loading, empty, error ตรวจครบ
- Chrome 360px และ 1280px

### Gates

```bash
npm run lint
npx --no-install tsc --noEmit
npm run test
npm run build
```

ก่อนรวม main ต้องผ่าน gates และกรณีหลักที่เกี่ยวข้อง พร้อมบันทึกผลจริง ไม่อ้างว่า mock เป็นหลักฐานของ database จริง

## 10. Success criteria

- เจ้าหน้าที่เลือก Day/Week/Month และจัดการ slot ได้จาก mock UI แบบโต้ตอบจริง
- ตารางเริ่มต้นจาก template กลางและหมอปรับแต่งได้
- วันลาต้องผ่าน approval ก่อนมีผล
- approved leave ปิดรอบอนาคตอัตโนมัติ รักษานัดเดิม และ reopen ได้ถูกเหตุผล
- UI ไม่เรียก Supabase และ refresh แล้วกลับ mock catalog ตั้งต้น
- database adapter เพิ่มภายหลังได้ผ่าน repository contract เดิม

## Implementation override (2026-09-06)

Recurring doctor schedules are reference data only. The calendar must never generate booking slots automatically when the page loads, when filters change, or when the user changes day, week, or month. Staff create booking slots manually until a later approved change enables generation.
