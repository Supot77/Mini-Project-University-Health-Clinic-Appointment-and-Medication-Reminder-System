<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

use skill caveman

# มาตรฐานการทำงานของ Agent

กฎส่วนนี้ใช้กับ Agent และสมาชิกทุกคนที่แก้ไข repository นี้ ให้อ่านเอกสารที่เกี่ยวข้องก่อนเริ่มงาน โดยยึดลำดับข้อมูลจาก `docs/00_reading_guide.md`: ข้อสรุปล่าสุดใน `docs/10_team_decisions.md` เป็นหลัก ตามด้วยเกณฑ์ตรวจรับใน `docs/08_system_rules_and_acceptance.md` และแผนใน `docs/09_implementation_plan.md` ห้ามถือว่าเอกสารข้อกำหนดเป็นหลักฐานว่าโค้ดหรือฐานข้อมูลพัฒนาเสร็จหรือผ่านการทดสอบแล้ว

## ขอบเขตและเจ้าของงาน

- ทำงานเฉพาะโมดูลที่ได้รับมอบหมายตามตารางเจ้าของงานใน `README.md` และ `docs/05_folder_and_git_workflow.md` เว้นแต่ผู้ใช้หรือเจ้าของโครงการสั่งเปลี่ยนขอบเขตอย่างชัดเจน
- ตรวจ `git status` และ diff ก่อนแก้ไข รักษาการเปลี่ยนแปลงเดิมของผู้อื่น และห้ามเขียนทับ ย้อนกลับ หรือลบงานที่ไม่ได้อยู่ในขอบเขต
- ก่อนเริ่มงานใหม่ทุกครั้งบน branch ของตนเอง ต้องตรวจว่า working tree อยู่ในสภาพที่ sync ได้ แล้วดึง `develop` ล่าสุดด้วย `git fetch origin develop` และรวม `origin/develop` เข้า branch ที่กำลังทำงานก่อนเริ่มแก้โค้ด หากมีงานค้างหรือเกิด conflict ให้หยุดรักษางานเดิมและประสานเจ้าของก่อน
- หากงานจำเป็นต้องแก้โมดูล สัญญาข้อมูล หรือไฟล์ที่ผู้อื่นเป็นเจ้าของ ให้ประสานเจ้าของโมดูลและคู่ตรวจก่อน รวมทั้งระบุผลกระทบไว้ในการส่งมอบหรือ PR
- เมื่อการเปลี่ยนแปลงของหลายโมดูลขัดกัน ให้ข้อกำหนดและการเปลี่ยนแปลงที่เจ้าของโมดูลนั้นอนุมัติเป็นหลัก ห้ามแก้ conflict ด้วยการเลือกงานของตนเองทับงานเจ้าของส่วนดังกล่าวโดยพลการ
- ไฟล์กลาง เช่น types, repository interfaces, mock data, shared components, layout, Supabase client และ migration ไม่มีเจ้าของคนเดียว การแก้ไขต้องรักษาความเข้ากันได้กับทุกโมดูลที่ใช้งาน และต้องแจ้งเจ้าของโมดูลที่ได้รับผลกระทบพร้อมคู่ตรวจ
- จำกัดการ refactor ให้อยู่ในสิ่งที่จำเป็นต่อเป้าหมาย ห้ามเปลี่ยน branch, merge, commit หรือ push เว้นแต่ได้รับคำสั่ง หรือเป็นการ sync `origin/develop` เข้า branch ตนเองตามกติกาข้อนี้
- หลังทำงานเสร็จ ต้องบันทึกการเปลี่ยนแปลงไว้บน branch ของตนเองเป็นลำดับ (ตรวจ diff, commit และ push branch ของตนเองเมื่อได้รับอนุญาต) ห้ามส่งงานตรงเข้า `develop` หรือ `main`

## แนวทางข้อมูลและ Backend แบบ Database-first

- Runtime ของแอปใช้ Supabase จริงผ่าน database repository/adapter เป็น implementation หลัก ส่วน mock repository ใช้สำหรับ automated tests, Story/demo แบบ offline หรือกรณีที่ test ระบุ dependency ชัดเจนเท่านั้น
- แยก UI และ business/domain logic ออกจากแหล่งข้อมูล โดยเรียกผ่าน repository หรือ service contract ที่ชัดเจน ห้ามให้ component เขียน Supabase query หรือ import mock fixture โดยตรง
- Backend ต้องมี database repository และ mock repository ภายใต้ contract เดียวกัน พฤติกรรม ชนิดผลลัพธ์ validation และ error สำคัญต้องสอดคล้องกัน เพื่อให้ tests สลับเป็น mock ได้โดยไม่แก้ UI หรือ domain logic
- ใช้ Supabase client ตาม execution context: browser client สำหรับคำสั่งของผู้ใช้, server client สำหรับ Server Component/Server Action/Route Handler และใช้ session ของผู้ใช้ร่วมกับ RLS ห้ามใช้ `service_role` ใน browser หรือส่ง secret ไปยัง client bundle
- อนุญาตให้แก้ schema, migration, seed, RLS, RPC และ `src/types/database.ts` เมื่ออยู่ในขอบเขตงาน แต่ต้องอ่านเอกสารล่าสุด ตรวจ dependency ทุกโมดูล ใช้ migration ที่ review ได้ และระบุฐานเป้าหมายก่อนรัน
- อนุญาตให้รัน migration/seed กับฐาน development หรือ staging ที่ทีมกำหนด หลังตรวจ project/target, สำรองข้อมูลเมื่อมีข้อมูลเดิม และได้รับอนุญาตสำหรับคำสั่งที่มีผลต่อ remote database ห้ามรัน destructive reset กับ production
- ห้ามอ่าน แสดง commit หรือเผยแพร่ `.env.local`, `service_role` และ secret ใด ๆ ใช้เฉพาะชื่อ environment variable หรือ placeholder ในเอกสารและ test
- Automated tests ปกติต้อง deterministic ด้วย mock/fake และไม่พึ่ง network หรือฐานจริง ส่วน database integration test ต้องแยกคำสั่ง/ชุดทดสอบ ใช้ฐานทดสอบที่ระบุชัด และไม่รันรวมกับ unit test โดยอัตโนมัติ

## หน้าและส่วนประกอบตามบทบาท

- ระบบมี 3 role canonical: `patient`, `medical`, `staff_admin` แต่ละ role ต้องมี entry page หรือ dashboard ของตนเอง และต้องผ่าน route/layout guard ก่อน render ข้อมูล
- เมื่อ role ต่างกันด้านสิทธิ์ ข้อมูลที่เห็น หรือคำสั่งที่ทำได้ ให้แยก role-specific page/container/component ห้ามใช้ตัวเลือกสลับ role ใน production UI เพื่อจำลองสิทธิ์
- ส่วน presentational component ที่ไม่มีข้อมูลอ่อนไหวและมีพฤติกรรมเหมือนกันใช้ร่วมกันได้ ห้ามคัดลอก UI ทั้งหน้าเมื่อแยกเฉพาะ data loader, action หรือ permission boundary ก็เพียงพอ
- UI guard ใช้เพื่อประสบการณ์ผู้ใช้เท่านั้น การอนุญาตจริงต้องตรวจซ้ำใน service/repository และ Supabase RLS/RPC ทุกคำสั่งที่อ่านหรือเขียนข้อมูล

## ขั้นตอนการทำงาน

1. อ่าน `AGENTS.md`, เอกสารข้อกำหนดที่เกี่ยวข้อง และไฟล์ใน flow เดิมก่อนเสนอหรือแก้ไขงาน
2. ก่อนเขียนโค้ด Next.js ให้อ่านคู่มือหัวข้อที่เกี่ยวข้องใน `node_modules/next/dist/docs/` ตามกฎด้านบน และทำตาม API/convention ของเวอร์ชันที่ติดตั้งจริง
3. ตรวจสถานะ Git, ระบุเจ้าของโมดูล ไฟล์ที่ต้องแก้ ขอบเขตผลกระทบ และ acceptance criteria ที่เกี่ยวข้อง
4. sync `origin/develop` เข้า branch ของตนเองตามกติกา Git ก่อนเริ่มเขียนโค้ด
5. ทำการเปลี่ยนแปลงที่เล็กและตรงขอบเขต ตามรูปแบบที่มีอยู่ แยก domain logic ให้ทดสอบได้ และรักษา contract ระหว่างโมดูล
6. เมื่อพฤติกรรมเปลี่ยน ให้เพิ่มหรือปรับ tests ใน `tests/**/*.test.{ts,tsx}` โดยครอบคลุมกรณีสำเร็จ ขอบเขตสำคัญ validation/error และยืนยันว่า state ไม่เปลี่ยนเมื่อคำสั่งล้มเหลว หากพฤติกรรมนั้นเกี่ยวข้อง
7. ตรวจ diff หลังแก้ไขเพื่อหาไฟล์นอกขอบเขต secret debug code การเปลี่ยน contract โดยไม่ตั้งใจ และงานของผู้อื่นที่ถูกทับ
8. รัน quality gates ทั้งหมดและรายงานผลจริงก่อนส่งมอบ จากนั้น commit งานไว้บน branch ของตนเองตามสิทธิ์ที่ได้รับ

## การทดสอบและ Quality Gates

ทุกงานที่แก้โค้ดต้องผ่านคำสั่งต่อไปนี้จาก root ของ repository:

```bash
npm run lint
npx --no-install tsc --noEmit
npm run test
npm run build
```

- รัน test เฉพาะไฟล์ระหว่างพัฒนาได้ แต่ไม่ใช้แทน full test suite ก่อนส่งมอบ
- ห้ามกล่าวว่า lint, typecheck, test หรือ build ผ่าน หากไม่ได้รันคำสั่งนั้นจริงในสถานะโค้ดล่าสุด
- หาก gate ใดรันไม่ได้หรือล้มเหลว ให้รายงานคำสั่ง สาเหตุ และระบุว่าเป็นผลจากการเปลี่ยนแปลงครั้งนี้หรือเป็นปัญหาเดิม ห้ามปิดบังหรือข้ามโดยไม่แจ้ง
- งานที่แก้ UI ต้องตรวจ flow ที่ได้รับผลกระทบใน Chrome ที่ความกว้าง 360px และ 1280px รวมการใช้งานด้วย keyboard และสถานะ loading, empty และ error บันทึกสิ่งที่ตรวจจริงและข้อจำกัด
- ก่อนรวม `main` ต้องผ่านกรณีหลักตาม acceptance criteria ที่เกี่ยวข้อง ส่วนก่อนนำเสนอต้องตรวจ SCN-01–07 และอีเมลจริงตามเอกสารเมื่อขอบเขตงานรองรับแล้ว

## การส่งมอบ

สรุปทุกครั้งว่าแก้ไฟล์ใด พฤติกรรมใดเปลี่ยน tests ใดถูกเพิ่มหรือแก้ และผลของแต่ละ quality gate หากมีสิ่งที่ยังไม่ได้ตรวจ ความเสี่ยง การตัดสินใจที่รอเจ้าของโมดูล migration ที่ยังไม่ได้ deploy หรือ flow ฐานจริงที่ยังไม่ได้ตรวจ ต้องระบุอย่างชัดเจน
