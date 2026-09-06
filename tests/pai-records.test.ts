import { describe, expect, it } from 'vitest';
import { createRecordsDemoRepository } from '@/features/pai/records/mockRepository';

describe('Pai records local preview', () => {
  it('shows only the patient’s completed records and only assigned patients in doctor view', async () => {
    const repository = createRecordsDemoRepository();
    expect((await repository.list('patient')).map(item => item.id)).toEqual(['REC-002', 'REC-003']);
    expect((await repository.list('doctor')).map(item => item.id)).toEqual(['REC-001', 'REC-002', 'REC-003', 'REC-004']);
  });

  it('requires a saved diagnosis for completion and reveals the completed draft to its patient', async () => {
    const repository = createRecordsDemoRepository();
    const before = await repository.list('doctor');
    expect(repository.complete('REC-001', 1).ok).toBe(false);
    expect(await repository.list('doctor')).toEqual(before);
    expect(repository.saveDraft('REC-001', { diagnosis: ' ผลตรวจสมมติ ', advice: '', prescriptions: [] }, 1).ok).toBe(true);
    expect((await repository.list('patient')).map(item => item.id)).not.toContain('REC-001');
    const result = repository.complete('REC-001', 2);
    expect(result).toMatchObject({ ok: true, record: { status: 'completed', diagnosis: 'ผลตรวจสมมติ', version: 3 } });
    expect((await repository.list('patient')).map(item => item.id)).toContain('REC-001');
  });

  it('does not mutate drafts when prescription validation fails', async () => {
    const repository = createRecordsDemoRepository();
    const before = await repository.list('doctor');
    const result = repository.saveDraft('REC-001', { diagnosis: 'ผลตรวจ', advice: '', prescriptions: [{ name: 'ยาสมมติ', quantity: 1.5, unit: 'เม็ด', instructions: 'ตัวอย่าง' }] }, 1);
    expect(result.ok).toBe(false);
    expect(await repository.list('doctor')).toEqual(before);
  });

  it('preserves dispensed quantity and instructions while recording a reason and new version', async () => {
    const repository = createRecordsDemoRepository();
    const before = (await repository.list('doctor')).find(item => item.id === 'REC-002')!;
    const result = repository.amendPending('REC-002', 'RX-001', { quantity: 5, instructions: 'คำสั่งใหม่สมมติ', reason: 'แก้จำนวนตามบันทึกตัวอย่าง' }, 1);
    expect(result).toMatchObject({ ok: true, record: { version: 2 } });
    const after = (await repository.list('doctor')).find(item => item.id === 'REC-002')!;
    expect(after.prescriptions[0]).toMatchObject({ ordered: 9, dispensed: 4, instructions: 'คำสั่งใหม่สมมติ', dispensedInstructions: before.prescriptions[0].dispensedInstructions });
    expect(after.prescriptions[1]).toEqual(before.prescriptions[1]);
    expect(after.history[0]).toMatchObject({ version: 2, reason: 'แก้จำนวนตามบันทึกตัวอย่าง' });
    expect(after.history[0].description).toContain('8 → 5');
  });

  it.each([
    { id: 'REC-002', item: 'RX-001', quantity: 5, reason: ' ', version: 1 },
    { id: 'REC-002', item: 'RX-001', quantity: -1, reason: 'เหตุผล', version: 1 },
    { id: 'REC-002', item: 'RX-001', quantity: 1.5, reason: 'เหตุผล', version: 1 },
    { id: 'REC-002', item: 'RX-002', quantity: 2, reason: 'เหตุผล', version: 1 },
    { id: 'REC-002', item: 'RX-001', quantity: 5, reason: 'เหตุผล', version: 0 },
    { id: 'REC-003', item: 'RX-001', quantity: 5, reason: 'เหตุผล', version: 1 },
  ])('rejects invalid, dispensed, stale or other-doctor changes without altering state: %j', async change => {
    const repository = createRecordsDemoRepository();
    const before = await repository.list('doctor');
    expect(repository.amendPending(change.id, change.item, { quantity: change.quantity, instructions: 'ตัวอย่าง', reason: change.reason }, change.version).ok).toBe(false);
    expect(await repository.list('doctor')).toEqual(before);
  });

  it('keeps completed results and other-doctor records read-only', async () => {
    const repository = createRecordsDemoRepository();
    const before = await repository.list('doctor');
    for (const id of ['REC-002', 'REC-003']) {
      expect(repository.saveDraft(id, { diagnosis: 'เปลี่ยนผล', advice: '', prescriptions: [] }, 1).ok).toBe(false);
      expect(repository.complete(id, 1).ok).toBe(false);
    }
    expect(await repository.list('doctor')).toEqual(before);
  });

  it('keeps preview instances and returned snapshots isolated', async () => {
    const first = createRecordsDemoRepository();
    const second = createRecordsDemoRepository();
    const snapshot = await first.list('doctor');
    snapshot[1].prescriptions[0].dispensed = 999;
    expect((await first.list('doctor'))[1].prescriptions[0].dispensed).toBe(4);
    first.saveDraft('REC-001', { diagnosis: 'ผลตรวจ', advice: '', prescriptions: [] }, 1);
    expect((await second.list('doctor'))[0].diagnosis).toBe('');
  });
});
