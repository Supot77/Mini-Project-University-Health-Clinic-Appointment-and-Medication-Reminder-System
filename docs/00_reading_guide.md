# 00. คู่มืออ่านเอกสาร

ปรับปรุง 7 กันยายน 2569 (2026-09-07) — ข้อกำหนดสำหรับพัฒนา ยังไม่ใช่หลักฐานว่าโค้ดหรือฐานข้อมูลทำครบแล้ว

ข้อสรุปทีมใน [10](10_team_decisions.md) เป็นหลักสำหรับกติกาที่เปลี่ยนล่าสุด [09](09_implementation_plan.md) เป็นแผนดำเนินงาน [08](08_system_rules_and_acceptance.md) เป็นข้อกำหนดและเกณฑ์ตรวจรับ หากพบเนื้อหาเก่าใน Git history หรือ PDF archive ให้ยึดข้อสรุปล่าสุดที่ทีมตอบรับ ไม่ใช้ข้อเสนอที่ยังไม่อนุมัติแทนข้อยุติ

## Role contract ปัจจุบัน

ระบบมี 3 บทบาทเท่านั้น เรียงลำดับเดียวกันในเอกสาร โค้ด mock และฐานข้อมูล:

1. ผู้ป่วย (`patient`)
2. แพทย์/เภสัชกร (`medical`)
3. เจ้าหน้าที่/แอดมิน (`staff_admin`)

แพทย์กับเภสัชกรใช้ role เดียวกัน และเจ้าหน้าที่กับแอดมินใช้ role เดียวกัน นักศึกษา/บุคลากรเป็นประเภทผู้ป่วย ไม่ใช่ role เพิ่ม

| เอกสาร | ใช้ทำอะไร |
| --- | --- |
| [01 ภาพรวม](01_project_overview.md) | เป้าหมายและเจ้าของงาน |
| [02 User Stories](02_user_stories.md) | หน้าที่ผู้ใช้แต่ละโมดูล |
| [03 แบบข้อมูลและ ER](03_database_design_and_er.md) | แบบข้อมูลปัจจุบันและส่วนที่ตัดออก |
| [04 สถาปัตยกรรม](04_system_architecture_and_tech_stack.md) | ขอบเขตบริการ สิทธิ์และงานตามเวลา |
| [05 โฟลเดอร์และ Git](05_folder_and_git_workflow.md) | พื้นที่งานและคู่ตรวจ |
| [06 Roadmap](06_development_roadmap.md) | แผน 5–18 กันยายน |
| [07 ขอบเขต](07_foundation_and_scope.md) | งานที่คงไว้ งานที่เปลี่ยน และเรื่องค้าง |
| [08 กติกาและเกณฑ์](08_system_rules_and_acceptance.md) | กติกาปัจจุบัน AC และ SCN |
| [09 แผนพัฒนา](09_implementation_plan.md) | จุดเชื่อมและสิ่งที่ต้องทำภายหลัง |
| [10 ข้อสรุปทีม](10_team_decisions.md) | คำตอบที่ตกลงแล้วและประเด็นที่ยังเปิด |
| [Catalog เดโม](superpowers/specs/2026-09-04-clinic-demo-data-design.md) | บัญชีสังเคราะห์ ตารางตรวจและยา |
| [Process diagram](clinic-manual-process.html) | ภาพรวม flow manual ของ 3 role |
| [ER diagram](clinic-er-diagram.html) | แบบข้อมูลและความสัมพันธ์ของ 11 ตาราง |
| [SQL เดิม](SQL.md) | อ้างอิงทางประวัติศาสตร์ ไม่ใช่ migration ตามข้อสรุปใหม่ |

แยกสถานะ ตกลงความต้องการแล้ว / แบบเทคนิคเสนอ / พัฒนาแล้ว / deploy แล้ว / ตรวจรับแล้ว เสมอ เอกสาร 00–11 ต้องใช้ role contract และ scope manual เดียวกัน การอนุญาตให้เชื่อมฐานจริงไม่ใช่หลักฐานว่า migration ถูก deploy หรือ flow ผ่านการตรวจรับ

## Data source และ UI contract ปัจจุบัน

- Runtime เป้าหมายใช้ Supabase จริงผ่าน database repository ภายใต้ service/repository contract; mock repository ใช้ใน automated tests และ offline demo ที่ระบุชัด
- Database client ใช้ session ของผู้ใช้และบังคับสิทธิ์ด้วย RLS/RPC ห้ามให้ browser รับ `service_role` หรือ secret
- ทั้ง 3 role ต้องมี entry page/dashboard ของตนเอง เมื่อข้อมูลหรือคำสั่งต่างกันต้องแยก role-specific page/container/component และตรวจสิทธิ์ทั้ง route, service/repository และ database
- Shared presentational component ใช้ร่วมกันได้เมื่อไม่มีความต่างด้านสิทธิ์หรือข้อมูล ห้ามมี production UI สำหรับสลับ role เพื่อข้าม session จริง

## วิธีอ่านเมื่อข้อมูลต่างกัน

ให้ใช้ลำดับนี้เพื่อป้องกันการนำข้อเสนอเก่ากลับมาเป็น requirement: [10](10_team_decisions.md) → [08](08_system_rules_and_acceptance.md) → [09](09_implementation_plan.md) → [11](11_functional_requirements.md) จากนั้นใช้ [03](03_database_design_and_er.md) อธิบายโครงข้อมูล, [02](02_user_stories.md) อธิบายมุมมองผู้ใช้ และ [01](01_project_overview.md), [04](04_system_architecture_and_tech_stack.md), [05](05_folder_and_git_workflow.md), [06](06_development_roadmap.md), [07](07_foundation_and_scope.md) เป็นเอกสารประกอบ

คำว่า “ตกลงแล้ว” หมายถึงทีมยืนยันขอบเขตหรือกติกา คำว่า “แผน” หมายถึงงานที่ควรทำต่อ และคำว่า “พัฒนา/ตรวจรับแล้ว” ต้องมีหลักฐานจากโค้ดหรือคำสั่งตรวจจริง เอกสารนี้ไม่เปลี่ยนสถานะของงานเพียงเพราะมีการเขียนรายละเอียดเพิ่ม

## คำศัพท์ที่ต้องใช้ให้ตรงกัน

| คำ | ความหมายในเอกสารชุดนี้ |
| --- | --- |
| role | ค่าบทบาทของบัญชี มีเพียง `patient`, `medical`, `staff_admin` |
| หน้าที่ | งานย่อยของ role เช่น `medical` ทำหน้าที่แพทย์หรือเภสัชกรได้ แต่ไม่กลายเป็น role ใหม่ |
| manual | ผู้ใช้ที่มีสิทธิ์เป็นผู้กดคำสั่งและบันทึกผลเอง ไม่มี worker หรือการเปลี่ยนสถานะตามเวลา |
| database runtime | Supabase จริงที่แอปอ่านเขียนผ่าน repository, session และ RLS |
| mock | adapter ข้อมูลสังเคราะห์สำหรับ automated tests หรือ offline demo ไม่ใช่ runtime หลัก |
| scope | สิ่งที่ต้องคงไว้ในรอบนี้ ส่วนที่ไม่อยู่ในตารางหรือรายการ FR ถือว่านอก scope |
