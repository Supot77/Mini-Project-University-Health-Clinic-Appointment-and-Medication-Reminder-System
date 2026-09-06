import type {
  Appointment,
  AppointmentSlot,
  Broadcast,
  Department,
  Doctor,
  InventoryLog,
  MedicalRecord,
  Medication,
  MedicationLog,
  MedicationReminder,
  Notification,
  Profile,
  UserRole,
} from '@/types/database';

const CREATED_AT = '2026-09-01T01:30:00.000Z';
const UPDATED_AT = '2026-09-05T08:00:00.000Z';

function profile(id: string, fullName: string, role: UserRole, studentId: string | null = null): Profile {
  return {
    id,
    student_id: studentId,
    full_name: fullName,
    phone: '080-000-0000',
    emergency_phone: null,
    address: 'มหาวิทยาลัยวลัยลักษณ์',
    allergies: id === 'profile-wednesday' ? 'PENICILLIN' : null,
    chronic_diseases: null,
    role,
    avatar_url: null,
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
  };
}

export interface ClinicMockTables {
  profiles: Profile[];
  departments: Department[];
  doctors: Doctor[];
  appointment_slots: AppointmentSlot[];
  appointments: Appointment[];
  medical_records: MedicalRecord[];
  medications: Medication[];
  inventory_logs: InventoryLog[];
  medication_reminders: MedicationReminder[];
  medication_logs: MedicationLog[];
  notifications: Notification[];
  broadcasts: Broadcast[];
}

export const clinicMockTables: ClinicMockTables = {
  profiles: [
    profile('profile-nick-fury', 'Nick Fury', 'admin'),
    profile('profile-leslie-knope', 'Leslie Knope', 'staff'),
    profile('profile-severus-snape', 'Severus Snape', 'pharmacist'),
    profile('profile-stephen-strange', 'Stephen Strange', 'doctor'),
    profile('profile-meredith-grey', 'Meredith Grey', 'doctor'),
    profile('profile-charles-xavier', 'Charles Xavier', 'doctor'),
    profile('profile-leonard-mccoy', 'Leonard McCoy', 'doctor'),
    profile('profile-bruce-banner', 'Bruce Banner', 'doctor'),
    profile('profile-shuri-udaku', 'Shuri Udaku', 'doctor'),
    profile('profile-peter-parker', 'Peter Parker', 'patient', '66000001'),
    profile('profile-wednesday', 'Wednesday Addams', 'patient', '66000002'),
    profile('profile-sherlock', 'Sherlock Holmes', 'patient', '66000003'),
    profile('profile-katniss', 'Katniss Everdeen', 'patient', '66000004'),
    profile('profile-eleven', 'Eleven Hopper', 'patient', '66000005'),
    profile('profile-bruce-wayne', 'Bruce Wayne', 'patient', '66000006'),
    profile('profile-anakin', 'Anakin Skywalker', 'patient', '66000007'),
    profile('profile-lara', 'Lara Croft', 'patient', '66000008'),
  ],
  departments: [
    { id: 'dept-general', name: 'เวชปฏิบัติทั่วไป', description: 'ตรวจอาการทั่วไปและออกใบรับรองแพทย์', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'dept-mental', name: 'สุขภาพจิตและให้คำปรึกษา', description: 'นัดตรวจและให้คำปรึกษารายบุคคล', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'dept-vaccine', name: 'วัคซีนและสร้างเสริมภูมิคุ้มกัน', description: 'บริการวัคซีนแบบหนึ่งรอบรับได้หลายคน', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'dept-physio', name: 'กายภาพบำบัด', description: 'ประเมินและติดตามการฟื้นฟู', created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  doctors: [
    { id: 'profile-stephen-strange', specialty: 'เวชศาสตร์ทั่วไป', department_id: 'dept-general', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'profile-meredith-grey', specialty: 'เวชศาสตร์ครอบครัว', department_id: 'dept-general', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'profile-charles-xavier', specialty: 'สุขภาพจิตและการให้คำปรึกษา', department_id: 'dept-mental', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'profile-leonard-mccoy', specialty: 'วัคซีนและภูมิคุ้มกัน', department_id: 'dept-vaccine', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'profile-bruce-banner', specialty: 'เวชศาสตร์ฟื้นฟู', department_id: 'dept-physio', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'profile-shuri-udaku', specialty: 'กายภาพและการเคลื่อนไหว', department_id: 'dept-physio', created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  appointment_slots: [
    { id: 'slot-history-7d', doctor_id: 'profile-stephen-strange', slot_date: '2026-09-05', start_time: '10:00', end_time: '10:30', max_capacity: 1, booked_count: 1, status: 'full', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-history-30d', doctor_id: 'profile-charles-xavier', slot_date: '2026-08-20', start_time: '13:00', end_time: '14:00', max_capacity: 1, booked_count: 1, status: 'full', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-001', doctor_id: 'profile-stephen-strange', slot_date: '2026-09-07', start_time: '08:30', end_time: '09:00', max_capacity: 1, booked_count: 1, status: 'full', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-002', doctor_id: 'profile-stephen-strange', slot_date: '2026-09-07', start_time: '09:00', end_time: '09:30', max_capacity: 1, booked_count: 0, status: 'available', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-003', doctor_id: 'profile-charles-xavier', slot_date: '2026-09-07', start_time: '13:00', end_time: '14:00', max_capacity: 1, booked_count: 1, status: 'full', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-004', doctor_id: 'profile-leonard-mccoy', slot_date: '2026-09-08', start_time: '09:00', end_time: '09:30', max_capacity: 4, booked_count: 3, status: 'available', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-005', doctor_id: 'profile-shuri-udaku', slot_date: '2026-09-08', start_time: '10:00', end_time: '11:00', max_capacity: 1, booked_count: 0, status: 'closed', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-006', doctor_id: 'profile-meredith-grey', slot_date: '2026-09-09', start_time: '13:00', end_time: '13:30', max_capacity: 1, booked_count: 0, status: 'available', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'slot-007', doctor_id: 'profile-bruce-banner', slot_date: '2026-09-10', start_time: '13:00', end_time: '14:00', max_capacity: 1, booked_count: 0, status: 'available', created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  appointments: [
    { id: 'appointment-history-7d', user_id: 'profile-peter-parker', slot_id: 'slot-history-7d', queue_number: 1, reason: 'ติดตามอาการย้อนหลัง', status: 'completed', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'appointment-history-30d', user_id: 'profile-wednesday', slot_id: 'slot-history-30d', queue_number: 1, reason: 'ให้คำปรึกษาย้อนหลัง', status: 'completed', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'appointment-peter', user_id: 'profile-peter-parker', slot_id: 'slot-001', queue_number: 1, reason: 'ไข้และปวดศีรษะ', status: 'confirmed', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'appointment-wednesday', user_id: 'profile-wednesday', slot_id: 'slot-003', queue_number: 1, reason: 'ปรึกษาสุขภาพ', status: 'completed', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'appointment-sherlock', user_id: 'profile-sherlock', slot_id: 'slot-004', queue_number: 1, reason: 'รับวัคซีน', status: 'pending', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'appointment-katniss', user_id: 'profile-katniss', slot_id: 'slot-004', queue_number: 2, reason: 'รับวัคซีน', status: 'confirmed', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'appointment-eleven', user_id: 'profile-eleven', slot_id: 'slot-004', queue_number: 3, reason: 'รับวัคซีน', status: 'completed', created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  medical_records: [
    { id: 'record-wednesday', appointment_id: 'appointment-wednesday', patient_id: 'profile-wednesday', doctor_id: 'profile-charles-xavier', diagnosis: 'ติดตามอาการทั่วไป', treatment_notes: 'พักผ่อนและติดตามอาการ', prescribed_medications: [{ medication_id: 'med-amoxicillin', name: 'Amoxicillin 500mg', dosage: '1 แคปซูล', frequency: 'วันละ 3 ครั้ง', duration_days: 5, quantity: 15 }], created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'record-eleven', appointment_id: 'appointment-eleven', patient_id: 'profile-eleven', doctor_id: 'profile-leonard-mccoy', diagnosis: 'รับวัคซีนตามกำหนด', treatment_notes: 'สังเกตอาการหลังรับวัคซีน', prescribed_medications: [], created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  medications: [
    { id: 'med-paracetamol', name: 'Paracetamol 500mg', type: 'เม็ด', category: 'ยาแก้ปวดลดไข้', stock: 120, min_stock: 50, expiry_date: '2027-06-30', description: 'บรรเทาปวดและลดไข้', ingredients: 'Paracetamol', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'med-amoxicillin', name: 'Amoxicillin 500mg', type: 'แคปซูล', category: 'ยาปฏิชีวนะ', stock: 45, min_stock: 30, expiry_date: '2027-03-31', description: 'ยาปฏิชีวนะกลุ่มเพนิซิลลิน', ingredients: 'Amoxicillin', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'med-omeprazole', name: 'Omeprazole 20mg', type: 'แคปซูล', category: 'ยาระบบทางเดินอาหาร', stock: 80, min_stock: 40, expiry_date: '2027-04-30', description: 'ยาลดกรด', ingredients: 'Omeprazole', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'med-ibuprofen', name: 'Ibuprofen 400mg', type: 'เม็ด', category: 'ยาแก้ปวดลดไข้', stock: 38, min_stock: 30, expiry_date: '2027-02-28', description: 'บรรเทาปวดและอักเสบ', ingredients: 'Ibuprofen', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'med-cetirizine', name: 'Cetirizine 10mg', type: 'เม็ด', category: 'ยาแก้แพ้', stock: 12, min_stock: 20, expiry_date: '2026-11-30', description: 'ลดอาการแพ้', ingredients: 'Cetirizine', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'med-ors', name: 'ORS', type: 'ผง', category: 'ยาระบบทางเดินอาหาร', stock: 60, min_stock: 15, expiry_date: '2027-08-31', description: 'ผงเกลือแร่', ingredients: 'Electrolytes', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'med-diclofenac', name: 'Diclofenac Gel', type: 'เจล', category: 'ยาใช้ภายนอก', stock: 24, min_stock: 10, expiry_date: '2027-01-31', description: 'บรรเทาปวดกล้ามเนื้อ', ingredients: 'Diclofenac', is_active: true, created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  inventory_logs: [
    { id: 'inventory-001', medication_id: 'med-cetirizine', pharmacist_id: 'profile-severus-snape', action: 'dispense', quantity: 8, reason: 'จ่ายตามใบสั่งยา', created_at: UPDATED_AT },
    { id: 'inventory-002', medication_id: 'med-paracetamol', pharmacist_id: 'profile-severus-snape', action: 'add', quantity: 100, reason: 'รับยาเข้าคลัง', created_at: CREATED_AT },
  ],
  medication_reminders: [
    { id: 'reminder-peter-paracetamol', user_id: 'profile-peter-parker', medication_id: 'med-paracetamol', reminder_times: ['08:00', '20:00'], start_date: '2026-09-05', end_date: '2026-09-11', status: 'active', created_at: CREATED_AT, updated_at: UPDATED_AT },
    { id: 'reminder-wednesday-amoxicillin', user_id: 'profile-wednesday', medication_id: 'med-amoxicillin', reminder_times: ['08:00', '13:00', '20:00'], start_date: '2026-09-05', end_date: '2026-09-09', status: 'paused', created_at: CREATED_AT, updated_at: UPDATED_AT },
  ],
  medication_logs: [
    { id: 'dose-peter-morning', reminder_id: 'reminder-peter-paracetamol', scheduled_datetime: '2026-09-05T01:00:00.000Z', actual_datetime: '2026-09-05T01:05:00.000Z', status: 'taken', created_at: UPDATED_AT, updated_at: UPDATED_AT },
    { id: 'dose-peter-evening', reminder_id: 'reminder-peter-paracetamol', scheduled_datetime: '2026-09-05T13:00:00.000Z', actual_datetime: null, status: 'pending', created_at: UPDATED_AT, updated_at: UPDATED_AT },
  ],
  notifications: [
    { id: 'notification-001', user_id: 'profile-peter-parker', type: 'appointment', title: 'ยืนยันนัดหมายแล้ว', message: 'นัดหมายกับ Stephen Strange ได้รับการยืนยัน', is_read: false, created_at: UPDATED_AT },
    { id: 'notification-002', user_id: 'profile-peter-parker', type: 'reminder', title: 'ถึงเวลาทานยา', message: 'Paracetamol 500mg เวลา 20:00 น.', is_read: false, created_at: UPDATED_AT },
    { id: 'notification-003', user_id: 'profile-wednesday', type: 'broadcast', title: 'ประกาศจากคลินิก', message: 'คลินิกเปิดให้บริการตามเวลาปกติ', is_read: true, created_at: CREATED_AT },
  ],
  broadcasts: [],
};

export function createClinicMockTables(): ClinicMockTables {
  return structuredClone(clinicMockTables);
}
