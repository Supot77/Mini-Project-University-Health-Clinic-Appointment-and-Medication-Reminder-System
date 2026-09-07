import { describe, expect, it } from 'vitest';
import { MockShopRepository } from '@/features/shop/data/mockRepository';
import { countAffectedSlots } from '@/features/shop/domain/rules';
import type { ScheduleSlot } from '@/types/schedule';

describe('Doctor Leave Domain and Repository', () => {
  describe('countAffectedSlots', () => {
    const mockSlots: ScheduleSlot[] = [
      {
        id: 'slot-1',
        doctorId: 'doc-1',
        departmentId: 'dept-1',
        slotDate: '2026-09-10',
        startTime: '09:00',
        endTime: '09:30',
        maxCapacity: 2,
        bookedCount: 1,
        status: 'available',
      },
      {
        id: 'slot-2',
        doctorId: 'doc-1',
        departmentId: 'dept-1',
        slotDate: '2026-09-11',
        startTime: '10:00',
        endTime: '10:30',
        maxCapacity: 2,
        bookedCount: 2,
        status: 'full',
      },
      {
        id: 'slot-3',
        doctorId: 'doc-1',
        departmentId: 'dept-1',
        slotDate: '2026-09-10',
        startTime: '14:00',
        endTime: '14:30',
        maxCapacity: 2,
        bookedCount: 0,
        status: 'closed',
      },
      {
        id: 'slot-4',
        doctorId: 'doc-2',
        departmentId: 'dept-1',
        slotDate: '2026-09-10',
        startTime: '09:00',
        endTime: '09:30',
        maxCapacity: 2,
        bookedCount: 0,
        status: 'available',
      },
    ];

    it('accurately counts open and full slots for the specified doctor in date range', () => {
      const count = countAffectedSlots(mockSlots, 'doc-1', '2026-09-10', '2026-09-11');
      expect(count).toBe(2); // slot-1 and slot-2 (slot-3 is closed, slot-4 is doc-2)
    });

    it('ignores slots already closed', () => {
      const count = countAffectedSlots(mockSlots, 'doc-1', '2026-09-10', '2026-09-10');
      expect(count).toBe(1); // only slot-1
    });

    it('returns 0 when doctor has no slots or date range is invalid', () => {
      expect(countAffectedSlots(mockSlots, 'non-existent', '2026-09-10', '2026-09-11')).toBe(0);
      expect(countAffectedSlots(mockSlots, 'doc-1', '2026-09-12', '2026-09-10')).toBe(0);
      expect(countAffectedSlots(mockSlots, '', '2026-09-10', '2026-09-11')).toBe(0);
    });
  });

  describe('MockShopRepository leave management', () => {
    it('allows submitting leave with leaveType and tracks creation date', () => {
      const repository = new MockShopRepository();
      const res = repository.submitLeave({
        doctorId: 'profile-stephen-strange',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        reason: 'ไปสัมมนาทางการแพทย์',
        leaveType: 'academic',
        requestedBy: 'profile-stephen-strange',
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.leaveType).toBe('academic');
      expect(res.value.status).toBe('pending');
      expect(res.value.createdAt).toBeDefined();

      const snapshot = repository.snapshot();
      const found = snapshot.leaveRequests.find((l) => l.id === res.value.id);
      expect(found).toBeDefined();
      expect(found?.leaveType).toBe('academic');
    });

    it('allows cancelling a pending leave request', () => {
      const repository = new MockShopRepository();
      const submitted = repository.submitLeave({
        doctorId: 'profile-stephen-strange',
        startDate: '2026-10-05',
        endDate: '2026-10-06',
        reason: 'ลาพักร้อนส่วนตัว',
        leaveType: 'vacation',
        requestedBy: 'profile-stephen-strange',
      });

      expect(submitted.ok).toBe(true);
      if (!submitted.ok) return;

      const cancelRes = repository.cancelLeave(submitted.value.id);
      expect(cancelRes.ok).toBe(true);
      if (!cancelRes.ok) return;

      expect(cancelRes.value.id).toBe(submitted.value.id);

      // State check: removed from leaveRequests
      const found = repository.snapshot().leaveRequests.find((l) => l.id === submitted.value.id);
      expect(found).toBeUndefined();

      // Cannot cancel again
      const secondCancel = repository.cancelLeave(submitted.value.id);
      expect(secondCancel.ok).toBe(false);
    });

    it('supports staff_admin deciding leave with decisionNote', () => {
      const repository = new MockShopRepository();
      const submitted = repository.submitLeave({
        doctorId: 'profile-stephen-strange',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        reason: 'ติดภารกิจด่วน',
        leaveType: 'personal',
        requestedBy: 'profile-stephen-strange',
      });

      expect(submitted.ok).toBe(true);
      if (!submitted.ok) return;

      const note = 'อนุมัติเรียบร้อย ได้จัดสรรแพทย์เวรสำรองแล้ว';
      const decideRes = repository.decideLeave(
        submitted.value.id,
        'approved',
        'staff-admin-id',
        '2026-09-07',
        note,
      );

      expect(decideRes.ok).toBe(true);
      if (!decideRes.ok) return;

      expect(decideRes.value.status).toBe('approved');
      expect(decideRes.value.decisionNote).toBe(note);
      expect(decideRes.value.decidedBy).toBe('staff-admin-id');

      const found = repository.snapshot().leaveRequests.find((l) => l.id === submitted.value.id);
      expect(found?.decisionNote).toBe(note);
    });

    it('rejects leave decision with rejection note', () => {
      const repository = new MockShopRepository();
      const submitted = repository.submitLeave({
        doctorId: 'profile-stephen-strange',
        startDate: '2026-10-15',
        endDate: '2026-10-16',
        reason: 'ลาพักผ่อน',
        leaveType: 'vacation',
        requestedBy: 'profile-stephen-strange',
      });

      expect(submitted.ok).toBe(true);
      if (!submitted.ok) return;

      const note = 'ช่วงเวลาดังกล่าวมีผู้ป่วยนัดหมายเต็มทุกรอบ ไม่สามารถอนุมัติได้';
      const decideRes = repository.decideLeave(
        submitted.value.id,
        'rejected',
        'staff-admin-id',
        '2026-09-07',
        note,
      );

      expect(decideRes.ok).toBe(true);
      if (!decideRes.ok) return;

      expect(decideRes.value.status).toBe('rejected');
      expect(decideRes.value.decisionNote).toBe(note);
    });
  });
});
