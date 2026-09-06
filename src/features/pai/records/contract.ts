export type RecordPreview = 'patient' | 'doctor';

export interface DemoPrescriptionItem {
  id: string;
  name: string;
  unit: string;
  ordered: number;
  dispensed: number;
  instructions: string;
  dispensedInstructions: string;
}

export interface DemoRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  doctorId: string;
  doctorName: string;
  department: string;
  dateLabel: string;
  symptoms: string;
  allergy: string;
  diagnosis: string;
  advice: string;
  status: 'draft' | 'completed';
  version: number;
  prescriptions: DemoPrescriptionItem[];
  history: { version: number; description: string; reason: string }[];
}

export interface RecordDraft {
  diagnosis: string;
  advice: string;
  prescriptions: { name: string; quantity: number; unit: string; instructions: string }[];
}

export type RecordResult = { ok: true; record: DemoRecord } | { ok: false; error: string };

// Local preview contract. Auth and cross-module persistence are separate future work.
export interface RecordsDemoRepository {
  list(view: RecordPreview): Promise<DemoRecord[]>;
  saveDraft(id: string, draft: RecordDraft, version: number): RecordResult;
  complete(id: string, version: number): RecordResult;
  amendPending(id: string, itemId: string, change: { quantity: number; instructions: string; reason: string }, version: number): RecordResult;
}

export const PREVIEW_DOCTOR_ID = 'demo-doctor-a';
export const PREVIEW_PATIENT_ID = 'demo-patient-a';
