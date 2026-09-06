import {
  PREVIEW_DOCTOR_ID, PREVIEW_PATIENT_ID,
  type DemoRecord, type RecordResult, type RecordsDemoRepository,
} from './contract';

const base: DemoRecord = {
  id: 'REC-001', patientId: PREVIEW_PATIENT_ID, patientName: 'นักศึกษาตัวอย่าง ก', patientCode: 'DEMO-001',
  doctorId: PREVIEW_DOCTOR_ID, doctorName: 'พญ. แพทย์ตัวอย่าง ก', department: 'เวชปฏิบัติทั่วไป',
  dateLabel: '7 ก.ย. 2569 · 09:00 น.', symptoms: 'ติดตามอาการตามนัด (ข้อมูลสมมติ)',
  allergy: 'ไม่ทราบ — รอซักประวัติ', diagnosis: '', advice: '', status: 'draft', version: 1,
  prescriptions: [], history: [],
};

function fixtures(): DemoRecord[] {
  return [
    { ...base },
    {
      ...base, id: 'REC-002', dateLabel: '3 ก.ย. 2569 · 10:00 น.', status: 'completed',
      symptoms: 'เข้ารับการตรวจทั่วไป (ข้อมูลสมมติ)', diagnosis: 'บันทึกผลการตรวจตัวอย่าง',
      advice: 'คำแนะนำตัวอย่างสำหรับสาธิตหน้าจอเท่านั้น',
      prescriptions: [
        { id: 'RX-001', name: 'ยาตัวอย่าง A', unit: 'เม็ด', ordered: 12, dispensed: 4, instructions: 'คำสั่งใช้ส่วนค้าง (ข้อมูลสมมติ)', dispensedInstructions: 'คำสั่งใช้ที่บันทึกตอนจ่าย (ข้อมูลสมมติ)' },
        { id: 'RX-002', name: 'ยาตัวอย่าง B', unit: 'ซอง', ordered: 3, dispensed: 3, instructions: 'คำสั่งใช้ตัวอย่าง', dispensedInstructions: 'คำสั่งใช้ตัวอย่าง' },
      ],
    },
    {
      ...base, id: 'REC-003', dateLabel: '20 ส.ค. 2569 · 13:30 น.', status: 'completed',
      doctorId: 'demo-doctor-b', doctorName: 'นพ. แพทย์ตัวอย่าง ข',
      diagnosis: 'ประวัติการตรวจครั้งก่อน (ข้อมูลสมมติ)', advice: 'คำแนะนำที่บันทึกไว้ในครั้งก่อน (ข้อมูลสมมติ)',
    },
    { ...base, id: 'REC-004', patientId: 'demo-patient-b', patientName: 'บุคลากรตัวอย่าง ข', patientCode: 'DEMO-002', dateLabel: '7 ก.ย. 2569 · 10:30 น.' },
    { ...base, id: 'REC-005', patientId: 'demo-patient-c', patientName: 'ผู้ป่วยตัวอย่าง ค', patientCode: 'DEMO-003', doctorId: 'demo-doctor-b', status: 'completed', diagnosis: 'ข้อมูลของผู้ป่วยรายอื่น' },
  ];
}

function copy(record: DemoRecord): DemoRecord {
  return { ...record, prescriptions: record.prescriptions.map(item => ({ ...item })), history: record.history.map(item => ({ ...item })) };
}

export function createRecordsDemoRepository(): RecordsDemoRepository {
  let records = fixtures().map(copy);

  function editable(id: string, version: number): RecordResult {
    const record = records.find(item => item.id === id);
    if (!record || record.doctorId !== PREVIEW_DOCTOR_ID) return { ok: false, error: 'แก้ไขได้เฉพาะผลตรวจของแพทย์ตัวอย่าง ก' };
    if (record.version !== version) return { ok: false, error: 'ข้อมูลเปลี่ยนแล้ว กรุณาเปิดรายการล่าสุดอีกครั้ง' };
    return { ok: true, record: copy(record) };
  }

  function persist(record: DemoRecord, description: string, reason = ''): RecordResult {
    const updated = { ...record, version: record.version + 1, history: [...record.history, { version: record.version + 1, description, reason }] };
    records = records.map(item => item.id === updated.id ? updated : item);
    return { ok: true, record: copy(updated) };
  }

  return {
    async list(view) {
      const responsiblePatients = new Set(records.filter(record => record.doctorId === PREVIEW_DOCTOR_ID).map(record => record.patientId));
      return records.filter(record => view === 'patient'
        ? record.patientId === PREVIEW_PATIENT_ID && record.status === 'completed'
        : responsiblePatients.has(record.patientId)).map(copy);
    },
    saveDraft(id, draft, version) {
      const result = editable(id, version);
      if (!result.ok) return result;
      if (result.record.status !== 'draft') return { ok: false, error: 'ผลตรวจที่ปิดแล้วเปิดอ่านได้อย่างเดียว' };
      if (draft.prescriptions.some(item => !item.name.trim() || !item.unit.trim() || !item.instructions.trim() || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999)) {
        return { ok: false, error: 'กรอกชื่อยา หน่วย คำสั่งใช้ และจำนวนเต็ม 1–999 ให้ครบทุกแถว หรือลบแถวที่ไม่ใช้' };
      }
      const record = { ...result.record, diagnosis: draft.diagnosis.trim(), advice: draft.advice.trim(), prescriptions: draft.prescriptions.map((item, index) => ({ id: `${id}-RX-${index + 1}`, name: item.name.trim(), unit: item.unit.trim(), ordered: item.quantity, dispensed: 0, instructions: item.instructions.trim(), dispensedInstructions: '' })) };
      return persist(record, 'บันทึกแบบร่างผลตรวจ');
    },
    complete(id, version) {
      const result = editable(id, version);
      if (!result.ok) return result;
      if (result.record.status !== 'draft') return { ok: false, error: 'รายการนี้ปิดตรวจแล้ว' };
      if (!result.record.diagnosis.trim()) return { ok: false, error: 'กรอกและบันทึกผลวินิจฉัยก่อนปิดตรวจ' };
      return persist({ ...result.record, status: 'completed' }, 'ปิดตรวจในหน้าตัวอย่าง');
    },
    amendPending(id, itemId, change, version) {
      const result = editable(id, version);
      if (!result.ok) return result;
      const item = result.record.prescriptions.find(item => item.id === itemId);
      if (result.record.status !== 'completed' || !item || item.ordered <= item.dispensed) return { ok: false, error: 'รายการนี้ไม่มีส่วนค้างที่แก้ไขได้' };
      if (!change.reason.trim()) return { ok: false, error: 'ระบุเหตุผลการแก้ไขส่วนค้าง' };
      if (!change.instructions.trim() || !Number.isSafeInteger(change.quantity) || change.quantity < 0 || change.quantity > 999) return { ok: false, error: 'กรอกคำสั่งใช้และจำนวนค้างเป็นจำนวนเต็ม 0–999' };
      const record = { ...result.record, prescriptions: result.record.prescriptions.map(current => current.id === itemId ? { ...current, ordered: current.dispensed + change.quantity, instructions: change.instructions.trim() } : current) };
      return persist(record, `${item.name}: ค้าง ${item.ordered - item.dispensed} → ${change.quantity} ${item.unit}; คำสั่งใช้ “${item.instructions}” → “${change.instructions.trim()}”`, change.reason.trim());
    },
  };
}
