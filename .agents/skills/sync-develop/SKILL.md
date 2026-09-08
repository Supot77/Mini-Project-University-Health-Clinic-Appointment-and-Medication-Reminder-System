---
name: sync-develop
description: Fetch the latest develop branch and safely sync/merge it into the current working feature branch following repository workflow rules. Triggers on /sync-develop, "sync develop", "update branch", "fetch develop", "merge develop", "ซิงค์ develop", "อัปเดตงานจาก develop", "ดึง develop เข้า branch", "sync with develop", or whenever the user asks to bring recent develop changes into their branch.
---

# Sync Develop

Skill สำหรับซิงค์อัปเดตล่าสุดจาก `origin/develop` เข้าสู่ feature branch ปัจจุบันอย่างปลอดภัยตามกฎของโปรเจกต์ใน `AGENTS.md` และ `docs/05_folder_and_git_workflow.md`

## หลักการสำคัญ (Repository Rules)

1. **ไม่ทำลายงานเดิม**: ตรวจ `git status` ก่อนเสมอ หากมี uncommitted changes ค้างอยู่ ต้องไม่ overwrite หรือ discard โดยพลการ
2. **ห้ามทำงานตรงบน main/develop**: ต้องทำบน feature branch ของตนเองเท่านั้น (`feat/<module>-<summary>`)
3. **หยุดทันทีเมื่อเกิด Conflict**: หากเกิด merge conflict ให้หยุดทันที รักษางานเดิม และรายงานไฟล์ที่ชนกันให้ผู้ใช้ทราบเพื่อประสานเจ้าของโมดูล
4. **ต้องตรวจ Quality Gates**: หลัง merge สำเร็จ ต้องรัน typecheck และ test เพื่อยืนยันว่าโค้ดที่รวมมาไม่ทำให้ระบบพัง

---

## ขั้นตอนการทำงาน (Step-by-Step Workflow)

### 1. ตรวจสอบสถานะ Working Tree และ Branch ปัจจุบัน
รันคำสั่ง:
```bash
git status
```
- **เงื่อนไขตรวจสอบ**:
  - ตรวจสอบชื่อ branch ปัจจุบัน: หากอยู่ที่ `main` หรือ `develop` ให้แจ้งเตือนผู้ใช้ทันทีว่าควรสลับไปยัง feature branch ก่อน
  - หาก working tree **ไม่สะอาด** (มี modified/untracked files ที่ยังไม่ commit): หยุดและแจ้งผู้ใช้ให้ commit หรือ stash ก่อนซิงค์

### 2. Fetch origin develop
ดึงประวัติล่าสุดจาก remote:
```bash
git fetch origin develop
```
ตรวจสอบ commit ล่าสุดของ `origin/develop`:
```bash
git log -n 1 --oneline origin/develop
```

### 3. ตรวจสอบความแตกต่างก่อน Merge
ตรวจสอบว่า branch ปัจจุบันตามหลังหรือขัดแย้งกับ `origin/develop` หรือไม่:
```bash
git log -n 3 --oneline HEAD
git log HEAD..origin/develop --oneline
```
- หากไม่มี commit ใหม่จาก `origin/develop` (`HEAD..origin/develop` ว่างเปล่า):
  - รายงานผู้ใช้ว่า branch เป็นปัจจุบันอยู่แล้ว ไม่ต้อง merge

### 4. ดำเนินการ Merge
หากมี commit ใหม่จาก `origin/develop`:
```bash
git merge origin/develop
```
- **กรณี Fast-Forward หรือ Auto-Merge ผ่าน**: ดำเนินการต่อในข้อ 5
- **กรณีเกิด Merge Conflict**:
  - หยุดทันที ห้ามรัน commit บังคับ หรือเลือกลบโค้ดของผู้อื่น
  - แสดงรายการไฟล์ที่ conflict:
    ```bash
    git status
    ```
  - รายงานผู้ใช้ตามกฎ `AGENTS.md`: ระบุไฟล์ที่ conflict และแนะนำแนวทางประสานงานเจ้าของโมดูล

### 5. รัน Quality Gates ตรวจสอบความถูกต้อง
หลังจาก merge สำเร็จ ให้รันการตรวจสอบเพื่อความมั่นใจ:
```bash
npx --no-install tsc --noEmit
npm run test
```
- หากพบ type error หรือ test fail: แสดง error ให้ผู้ใช้เห็นทันที
- หากผ่านครบถ้วน: ดำเนินการขั้นตอนสุดท้าย

### 6. สรุปผลและเสนอ Push
สรุปผลด้วยภาษาที่กระชับ ชัดเจน (Caveman Thai style):
- ชื่อ branch ปัจจุบัน
- Commit ล่าสุดที่ merge เข้ามา
- ผลการตรวจ Quality Gates (tsc, test)
- สอบถามผู้ใช้ว่าต้องการให้ `git push origin <branch>` เพื่อ sync ขึ้น remote เลยหรือไม่ (หรือ push ให้ทันทีหากผู้ใช้มีคำสั่งชัดเจน)

