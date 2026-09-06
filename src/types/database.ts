// Persisted contract for migrations 01-03. Runtime still uses mock repositories.

export type UserRole = 'patient' | 'staff' | 'doctor' | 'pharmacist' | 'admin';

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rejected';

export type SlotStatus = 'available' | 'full' | 'closed';

export type MedicationReminderStatus = 'pending_confirmation' | 'active' | 'completed' | 'cancelled' | 'paused';

export type MedicationLogStatus = 'pending' | 'taken' | 'missed';

export type NotificationType = 'reminder' | 'appointment' | 'broadcast' | 'system';

export type InventoryAction = 'add' | 'dispense' | 'adjust' | 'damage';

export type PatientType = 'student' | 'employee';
export type HealthDeclarationStatus = 'yes' | 'no' | 'unknown';
export type RescheduleProposalStatus = 'pending' | 'accepted' | 'alternative_selected' | 'auto_confirmed' | 'rejected' | 'expired' | 'withdrawn' | 'superseded';
export type PrescriptionItemStatus = 'active' | 'partially_dispensed' | 'dispensed' | 'cancelled';
export type StockReservationStatus = 'active' | 'consumed' | 'released' | 'expired';
export type EmailJobType = 'dose_advance' | 'dose_final_repeat' | 'staff_override' | 'appointment' | 'backorder_ready';
export type EmailJobStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'skipped_paused';

// ----- Table Interfaces -----

export interface Profile {
  id: string;
  student_id: string | null;
  full_name: string;
  phone: string | null;
  emergency_phone: string | null;
  address: string | null;
  allergies: string | null;
  chronic_diseases: string | null;
  role: UserRole;
  avatar_url: string | null;
  patient_type?: PatientType | null;
  employee_id?: string | null;
  organization?: string | null;
  allergy_status?: HealthDeclarationStatus | null;
  chronic_disease_status?: HealthDeclarationStatus | null;
  is_active?: boolean;
  permission_version?: number;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string; // FK → profiles.id
  specialty: string | null;
  department_id: string | null; // FK → departments.id
  created_at: string;
  updated_at: string;
}

export interface AppointmentSlot {
  id: string;
  doctor_id: string; // FK → doctors.id
  slot_date: string; // DATE
  start_time: string; // TIME
  end_time: string; // TIME
  max_capacity: number;
  booked_count: number;
  status: SlotStatus;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string; // FK → profiles.id (patient)
  slot_id: string; // FK → appointment_slots.id
  queue_number: number | null;
  reason: string | null;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface PrescribedMedication {
  medication_id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  quantity: number;
}

export interface MedicalRecord {
  id: string;
  appointment_id: string; // FK → appointments.id
  patient_id: string; // FK → profiles.id
  doctor_id: string; // FK → doctors.id
  diagnosis: string | null;
  treatment_notes: string | null;
  prescribed_medications: PrescribedMedication[] | null; // JSONB
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  name: string;
  type: string; // เม็ด, แคปซูล, น้ำ
  category: string;
  stock: number;
  min_stock: number;
  expiry_date: string | null; // DATE
  description: string | null;
  ingredients: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryLog {
  id: string;
  medication_id: string; // FK → medications.id
  pharmacist_id: string; // FK → profiles.id
  action: InventoryAction;
  quantity: number;
  reason: string | null;
  dispensing_item_id?: string | null;
  performed_by?: string | null;
  idempotency_key?: string | null;
  created_at: string;
}

export interface MedicationReminder {
  id: string;
  user_id: string; // FK → profiles.id
  medication_id: string; // FK → medications.id
  reminder_times: string[]; // text[] e.g. ['08:00', '12:00', '18:00']
  start_date: string; // DATE
  end_date: string | null; // DATE
  status: MedicationReminderStatus;
  dispensing_item_id?: string | null;
  created_by?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  locked_at?: string | null;
  email_pause_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  reminder_id: string; // FK → medication_reminders.id
  scheduled_datetime: string; // TIMESTAMPTZ
  actual_datetime: string | null; // TIMESTAMPTZ
  status: MedicationLogStatus;
  record_deadline?: string | null;
  revision?: number;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string; // FK → profiles.id
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  event_key?: string | null;
  broadcast_id?: string | null;
  read_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface RescheduleProposal {
  id: string;
  appointment_id: string;
  old_slot_id: string;
  proposed_slot_id: string;
  proposed_by: string;
  sent_at: string;
  response_deadline: string;
  reservation_expires_at: string | null;
  status: RescheduleProposalStatus;
  responded_at: string | null;
  responded_by: string | null;
  version: number;
  request_key: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionItem {
  id: string;
  medical_record_id: string;
  medication_id: string;
  prescribed_quantity: number;
  cancelled_quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  duration_days: number | null;
  instructions: string | null;
  status: PrescriptionItemStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DispensingEvent {
  id: string;
  patient_id: string;
  dispensed_by: string;
  dispensed_at: string;
  reason: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface DispensingItem {
  id: string;
  dispensing_event_id: string;
  prescription_item_id: string;
  quantity: number;
  partial_reason: string | null;
  created_at: string;
}

export interface StockReservation {
  id: string;
  prescription_item_id: string;
  medication_id: string;
  quantity: number;
  confirmed_by: string;
  confirmed_at: string;
  status: StockReservationStatus;
  consumed_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionChange {
  id: string;
  prescription_item_id: string;
  from_version: number;
  to_version: number;
  before_value: Record<string, unknown>;
  after_value: Record<string, unknown>;
  reason: string;
  changed_by: string;
  created_at: string;
}

export interface MedicationLogChange {
  id: string;
  medication_log_id: string;
  before_status: MedicationLogStatus;
  after_status: MedicationLogStatus;
  before_actual_datetime: string | null;
  after_actual_datetime: string | null;
  reason: string;
  changed_by: string;
  created_at: string;
}

export interface EmailJob {
  id: string;
  recipient_id: string;
  medication_log_id: string | null;
  job_type: EmailJobType;
  scheduled_at: string;
  status: EmailJobStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  requested_by: string | null;
  request_reason: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface Broadcast {
  id: string;
  sent_by: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  audience: Record<string, unknown>;
  request_key: string;
  sent_at: string;
  created_at: string;
}

// ----- Joined / Extended Types -----

export interface DoctorWithProfile extends Doctor {
  profile?: Profile;
  department?: Department;
}

export interface AppointmentSlotWithDoctor extends AppointmentSlot {
  doctor?: DoctorWithProfile;
}

export interface AppointmentWithDetails extends Appointment {
  slot?: AppointmentSlotWithDoctor;
  patient?: Profile;
}

export interface MedicalRecordWithDetails extends MedicalRecord {
  appointment?: Appointment;
  patient?: Profile;
  doctor?: DoctorWithProfile;
}

export interface MedicationReminderWithMedication extends MedicationReminder {
  medication?: Medication;
}
