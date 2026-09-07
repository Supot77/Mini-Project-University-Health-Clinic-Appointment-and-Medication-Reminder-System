# Design Specification: Doctor Availability Templates and Schedule Permissions

- **Date**: 2026-09-08
- **Topic**: Doctor Availability Templates, History Recommendations, and Role-based Slot Closure Permissions
- **Status**: Approved by User

---

## 1. Overview & Background

In the clinic scheduling module (`/schedules`), schedule slots (`appointment_slots`) and weekly availability (`weekly_schedules`) were previously managed with a clinic-wide administrator view. With doctors (`medical` role) accessing the schedule, two key capabilities are required:
1. **Permission Isolation**: A doctor (`medical`) must NOT be permitted to close or edit slots assigned to other doctors. They may only toggle/close their own slots. System administrators (`staff_admin`) maintain clinic-wide authority.
2. **Doctor Availability & Historical Templates**: Doctors must be able to specify their convenient availability time blocks per weekday. When setting times, previously used time/capacity patterns must be saved and offered as quick-apply recommendation chips. If a doctor has no prior history, no recommendations should be displayed.

---

## 2. Architecture & Role Boundaries

### 2.1 Role Identification
The page receives `actorId` and `role` from the authenticated session.
- `currentDoctor = doctors.find(d => d.profileId === actorId || d.id === actorId)`
- If `role === 'medical'` and a doctor record exists, the workspace enters Doctor Mode for that doctor.

### 2.2 UI Permissions
- **Slot Modification**:
  - `canModifySlot(slot) = role === 'staff_admin' || slot.doctorId === currentDoctor?.id`
  - When `canModifySlot(slot)` is false, edit and close buttons in `SlotCard` are hidden or disabled.
- **Header Actions**:
  - `role === 'medical'`: View toggle between "ตารางของฉัน" (My Schedule) and "ภาพรวมคลินิก (ดูเท่านั้น)" (Clinic Overview - Read-only). A dedicated "ตั้งเวลาที่สะดวก" (Set Convenient Times) button replaces the central schedule manager button.
  - `role === 'staff_admin'`: Clinic-wide doctor filter, "จัดการตารางแพทย์" (Manage Doctor Schedules) panel, and "+ เพิ่มรอบตรวจ" (Add Slot) button.

### 2.3 Repository Permission Enforcement
- In `ShopRepository.toggleSlot(slotId, actorId, role)`:
  - If `role === 'medical'` and the slot's `doctorId !== currentDoctor.id`, the operation returns `{ ok: false, error: 'ไม่มีสิทธิ์จัดการรอบตรวจของแพทย์ท่านอื่น' }`.

---

## 3. Data Model & History Recommendation Logic

### 3.1 Availability Template Model
```typescript
export interface DoctorAvailabilityTemplate {
  id: string;
  doctorId: string;
  label?: string;
  startTime: string; // "09:00"
  endTime: string;   // "12:00"
  defaultCapacity: number; // e.g. 10
  usageCount: number;
  lastUsedAt: string; // ISO string
}
```

### 3.2 History & Recommendation Rule
- System queries `getDoctorTemplates(doctorId)`.
- If `templates.length === 0`:
  - Show standard empty state form with no suggestion chips.
- If `templates.length > 0`:
  - Display top templates ordered by `usageCount DESC, lastUsedAt DESC` as quick-fill chips:
    e.g. `[ ⚡ 09:00–12:00 (10 คน) ]`
  - Clicking a chip populates `startTime`, `endTime`, and `defaultCapacity` into the active draft form.
- Upon saving a new convenient time:
  - Either increment `usageCount` and update `lastUsedAt` if pattern exists, or create a new `DoctorAvailabilityTemplate`.
  - Also persist to `DoctorWeeklySchedule` for availability matching.

---

## 4. Quality Gates & Verification

- `npm run lint`: Zero ESLint errors.
- `npx --no-install tsc --noEmit`: Zero TypeScript compilation errors.
- `npm run test`: All unit tests pass, including:
  - Doctor cannot close another doctor's slots.
  - Doctor can close their own slots.
  - Availability templates are saved and retrieved per doctor.
  - Empty history returns zero recommendations.
- `npm run build`: Production Next.js 16.3 Turbopack build completes successfully.
