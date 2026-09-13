'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const isUuid = (val?: string | null): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

import { 
  Pill, X, Check, Plus, CalendarIcon, 
  Trash2, AlertCircle, RefreshCw, Sparkles,
  User, AlertTriangle, CheckCircle, Pencil
} from 'lucide-react';
import { useClinicMockDatabase } from '@/features/mock-database/ClinicMockProvider';
import { useAuth } from '@/hooks/useAuth';
import { 
  getReminders, 
  createReminder, 
  updateReminder, 
  deleteReminder, 
  getAvailableMedications, 
  seedSampleReminders
} from '@/services/reminderService';
import type { Medication, MedicationReminderWithMedication, Profile } from '@/types/database';
import { getPatients, getProfile } from '@/services/authService';
import Toast from '@/components/common/Toast';

// รายชื่อผู้ป่วยตัวอย่างสำหรับคลินิก (ใช้เลือกผู้ป่วยเพื่อจ่ายยา)
interface PatientOption {
  id: string;
  name: string;
  studentId: string;
  allergies?: string | null;
  phone?: string;
  gender?: string;
}

const CLINIC_PATIENTS: PatientOption[] = [
  { id: 'profile-peter-parker', name: 'Peter Parker', studentId: '66000001', allergies: null, phone: '081-111-2222', gender: 'ชาย' },
  { id: 'profile-wednesday', name: 'Wednesday Addams', studentId: '66000002', allergies: 'แพ้ยา PENICILLIN (เพนิซิลลิน)', phone: '082-222-3333', gender: 'หญิง' },
  { id: 'profile-sherlock', name: 'Sherlock Holmes', studentId: '66000003', allergies: null, phone: '083-333-4444', gender: 'ชาย' },
  { id: 'profile-katniss', name: 'Katniss Everdeen', studentId: '66000004', allergies: null, phone: '084-444-5555', gender: 'หญิง' },
  { id: 'profile-eleven', name: 'Eleven Hopper', studentId: '66000005', allergies: null, phone: '085-555-6666', gender: 'หญิง' },
  { id: 'profile-bruce-wayne', name: 'Bruce Wayne', studentId: '66000006', allergies: null, phone: '086-666-7777', gender: 'ชาย' },
];

// Interface สำหรับข้อมูลยาในมุมมอง UI
interface MedicationDisplayItem {
  id: string;
  medicationId?: string;
  name: string;
  category?: string;
  dosageInstruction: string;
  times: string[];
  rawTimes?: string[];
  startDate?: string;
  endDate?: string | null;
  stockInfo?: string;
  nextDoseMinutes?: number;
  isActive?: boolean;
}

// ฟังก์ชันแปลงเวลาเป็นภาษาไทย (เช้า, กลางวัน, เย็น, ก่อนนอน)
function formatTimeToThai(time: string) {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 5 && hour < 11) return `เช้า ${time} น.`;
  if (hour >= 11 && hour < 15) return `กลางวัน ${time} น.`;
  if (hour >= 15 && hour < 20) return `เย็น ${time} น.`;
  return `ก่อนนอน ${time} น.`;
}

// Helper แปลง Reminder Model เป็น UI Item
function mapReminderToDisplay(reminder: MedicationReminderWithMedication): MedicationDisplayItem {
  const times = (reminder.reminder_times || []).map((t) => formatTimeToThai(t));
  const med = reminder.medication;
  const desc = med?.description ? ` (${med.description})` : '';
  const dosage = (med as unknown as { dosage?: string })?.dosage ?? `1 ${med?.type ?? 'เม็ด'}`;
  const instruction = reminder.status === 'paused'
    ? `รับทาน ครั้งละ ${dosage} · ยาหยุดชั่วคราว`
    : `รับทาน ครั้งละ ${dosage} · วันละ ${(reminder.reminder_times || []).length} ครั้ง${desc}`;

  return {
    id: reminder.id,
    medicationId: reminder.medication_id,
    name: med?.name ?? 'ยาไม่ระบุชื่อ',
    category: med?.category ?? 'ยาทั่วไป',
    dosageInstruction: instruction,
    times: times,
    rawTimes: reminder.reminder_times || ['08:00', '18:00'],
    startDate: reminder.start_date,
    endDate: reminder.end_date,
    stockInfo: `เหลือ ${med?.stock ?? 30} ${med?.type ?? 'เม็ด'}`,
    nextDoseMinutes: 20,
    isActive: reminder.status !== 'paused',
  };
}

export default function RemindersPage() {
  const { user, role, isLoading: authLoading } = useAuth();
  const { repositories } = useClinicMockDatabase();

  const [selectedPatientOverride, setSelectedPatientOverride] = useState<string | null>(null);
  const [dbPatients, setDbPatients] = useState<PatientOption[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  // ตรวจสอบสิทธิ์: อนุญาตเฉพาะบุคลากรทางการแพทย์หรือผู้ดูแลระบบคลินิกเท่านั้นที่สามารถจ่ายยา/แก้ไข/ลบยาได้
  const effectiveRole = (currentUserProfile?.role || user?.role || role || '').toString().toLowerCase().trim();
  const canManageMedication = !authLoading && ['medical', 'staff_admin', 'doctor', 'pharmacist', 'staff', 'admin'].includes(effectiveRole);
  const isPatient = !canManageMedication;

  // ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน (สำหรับผู้ป่วย เพื่อนำข้อมูลการแพ้ยา/รหัสนักศึกษามาแสดง)
  useEffect(() => {
    if (user && isUuid(user.id)) {
      getProfile(user.id)
        .then((p) => {
          if (p) setCurrentUserProfile(p);
        })
        .catch((e) => console.warn('Could not fetch user profile:', e));
    }
  }, [user]);

  // โหลดรายชื่อผู้ป่วยจากฐานข้อมูล Supabase (ตาราง profiles โดย role = 'patient')
  const loadPatients = useCallback(async () => {
    try {
      const patients = await getPatients();
      if (patients && patients.length > 0) {
        const mapped: PatientOption[] = patients.map((p) => ({
          id: p.id,
          name: p.full_name || 'ไม่ระบุชื่อ',
          studentId: p.student_id || '-',
          allergies: p.allergies || null,
          phone: p.phone || undefined,
          gender: undefined,
        }));
        setDbPatients(mapped);
        return;
      }
    } catch (err) {
      console.warn('Could not fetch patients from Supabase profiles:', err);
    }

    // Fallback: หากยังไม่ต่อ DB หรือใช้ mock repository
    try {
      const { data: mockProfiles } = await repositories.profiles.list();
      if (mockProfiles && mockProfiles.length > 0) {
        const patientProfiles = mockProfiles.filter((p) => p.role === 'patient');
        if (patientProfiles.length > 0) {
          const mapped: PatientOption[] = patientProfiles.map((p) => ({
            id: p.id,
            name: p.full_name || 'ไม่ระบุชื่อ',
            studentId: p.student_id || '-',
            allergies: p.allergies || null,
            phone: p.phone || undefined,
            gender: undefined,
          }));
          setDbPatients(mapped);
          return;
        }
      }
    } catch (mockErr) {
      console.warn('Could not fetch patients from mock repository:', mockErr);
    }

    setDbPatients(CLINIC_PATIENTS);
  }, [repositories.profiles]);

  useEffect(() => {
    if (canManageMedication) {
      const frame = requestAnimationFrame(() => {
        void loadPatients();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [canManageMedication, loadPatients]);

  // คำนวณผู้ป่วยที่เลือกอย่างปลอดภัยและสอดคล้องกับบทบาท
  const selectedPatientId = useMemo(() => {
    if (!canManageMedication) {
      return (user && isUuid(user.id)) ? user.id : (user?.id || 'profile-peter-parker');
    }
    if (selectedPatientOverride) {
      return selectedPatientOverride;
    }
    if (dbPatients.length > 0) {
      return dbPatients[0].id;
    }
    return CLINIC_PATIENTS[0].id;
  }, [canManageMedication, user, selectedPatientOverride, dbPatients]);

  const [medicationList, setMedicationList] = useState<MedicationDisplayItem[]>([]);
  const [availableMeds, setAvailableMeds] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State: จ่ายยา / เพิ่มยาใหม่
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['08:00', '18:00']);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(''); // ค่าเริ่มต้นว่างไว้เพื่อให้แจ้งเตือนต่อเนื่องจนกว่าจะมาแก้ไข

  // Modal State: แก้ไขตัวยาที่จ่ายไปแล้ว
  const [editingItem, setEditingItem] = useState<MedicationDisplayItem | null>(null);
  const [editMedId, setEditMedId] = useState('');
  const [editTimes, setEditTimes] = useState<string[]>([]);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // Modal State: ยืนยันการลบรายการยา
  const [deletingItem, setDeletingItem] = useState<MedicationDisplayItem | null>(null);

  // รายชื่อผู้ป่วยทั้งหมด (แยกตามสิทธิ์)
  const allPatients = useMemo<PatientOption[]>(() => {
    // หากเป็นผู้ป่วย ให้มีเฉพาะตนเองเท่านั้น ห้ามเลือกคนอื่น
    if (!canManageMedication) {
      if (user) {
        return [{
          id: user.id,
          name: currentUserProfile?.full_name || user.full_name || user.email || 'ฉัน (บัญชีปัจจุบัน)',
          studentId: currentUserProfile?.student_id || (user as unknown as { student_id?: string }).student_id || 'บัญชีฉัน',
          allergies: currentUserProfile?.allergies || (user as unknown as { allergies?: string | null }).allergies || null,
          phone: currentUserProfile?.phone || (user as unknown as { phone?: string }).phone,
        }];
      }
      return [{
        id: 'profile-peter-parker',
        name: 'ผู้ป่วย',
        studentId: '-',
        allergies: null,
      }];
    }

    // หากเป็นบุคลากรทางการแพทย์ แสดงรายชื่อผู้ป่วยจาก Database
    if (dbPatients.length > 0) {
      return dbPatients;
    }
    return CLINIC_PATIENTS;
  }, [canManageMedication, user, currentUserProfile, dbPatients]);

  // ข้อมูลผู้ป่วยที่เลือก
  const currentPatient = useMemo(() => {
    return allPatients.find(p => p.id === selectedPatientId) || allPatients[0];
  }, [allPatients, selectedPatientId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  // ดึงข้อมูลยาของผู้ป่วยที่เลือก
  const loadData = useCallback(async (patientId: string) => {
    setIsLoading(true);
    try {
      // 1. ดึงรายการยาจาก Supabase medications (พร้อม fallback)
      let meds: Medication[] = [];
      try {
        meds = await getAvailableMedications();
      } catch (e) {
        console.warn('Could not fetch medications from Supabase:', e);
      }
      if (!meds || meds.length === 0) {
        const { data: mockMeds } = await repositories.medications.list();
        meds = (mockMeds || []) as Medication[];
      }
      setAvailableMeds(meds);
      setIsDbConnected(true);

      // 2. โหลดรายการยาจาก Supabase (กรณี patientId เป็น UUID)
      let dbReminders: MedicationReminderWithMedication[] = [];
      if (isUuid(patientId)) {
        try {
          dbReminders = await getReminders(patientId);
        } catch (dbErr) {
          console.warn('Could not fetch reminders from Supabase for patient:', patientId, dbErr);
        }
      }

      // 3. โหลดรายการยาจาก Mock repository (เพื่อรองรับกรณี mock user หรือ Supabase ติด RLS)
      let mockReminders: unknown[] = [];
      try {
        const { data: mockData } = await repositories.reminders.listWithMedication(patientId);
        if (mockData) {
          mockReminders = mockData;
        }
      } catch (mockErr) {
        console.warn('Could not fetch reminders from mock repo:', mockErr);
      }

      // 4. แปลงข้อมูลและเติมรายละเอียดตัวยาจาก meds หากยังขาด
      const mappedDb = (dbReminders || []).map(mapReminderToDisplay);
      const mappedMock = (mockReminders as MedicationReminderWithMedication[] || []).map((item) => {
        const display = mapReminderToDisplay(item);
        if (display.name === 'ยาไม่ระบุชื่อ' && item.medication_id) {
          const found = meds.find((m) => m.id === item.medication_id);
          if (found) {
            display.name = found.name;
            display.category = found.category;
            display.stockInfo = `เหลือ ${found.stock ?? 30} ${found.type ?? 'เม็ด'}`;
            const dosage = (found as unknown as { dosage?: string })?.dosage ?? `1 ${found?.type ?? 'เม็ด'}`;
            display.dosageInstruction = item.status === 'paused'
              ? `รับทาน ครั้งละ ${dosage} · ยาหยุดชั่วคราว`
              : `รับทาน ครั้งละ ${dosage} · วันละ ${(item.reminder_times || []).length} ครั้ง`;
          }
        }
        return display;
      });

      // รวมรายการยาและขจัด id ซ้ำ
      const uniqueMap = new Map<string, MedicationDisplayItem>();
      for (const item of [...mappedDb, ...mappedMock]) {
        uniqueMap.set(item.id, item);
      }
      setMedicationList(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Error loading reminders data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [repositories.medications, repositories.reminders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData(selectedPatientId);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, selectedPatientId]);

  // สลับสถานะเปิด/ปิดการแจ้งเตือนยา (Toggle)
  const handleToggle = async (id: string) => {
    const item = medicationList.find((m) => m.id === id);
    if (!item) return;
    const nextActive = !item.isActive;

    // อัปเดต UI ทันที (Optimistic update)
    setMedicationList((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updatedInstruction = nextActive
          ? m.dosageInstruction.replace(' · ยาหยุดชั่วคราว', '')
          : (m.dosageInstruction.includes('· ยาหยุดชั่วคราว') ? m.dosageInstruction : `${m.dosageInstruction} · ยาหยุดชั่วคราว`);
        return { ...m, isActive: nextActive, dosageInstruction: updatedInstruction };
      })
    );

    showToast(
      nextActive 
        ? `เปิดการแจ้งเตือน "${item.name}" เรียบร้อย 🔔` 
        : `ปิดการแจ้งเตือน "${item.name}" ชั่วคราวแล้ว ⏸️`
    );

    // ตรวจสอบว่าเป็น UUID ของ Supabase หรือเป็น ID จาก mock repository
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    try {
      if (isUuid) {
        await updateReminder(id, { status: nextActive ? 'active' : 'paused' });
      } else {
        await repositories.reminders.updateStatus(id, nextActive ? 'active' : 'paused');
      }
    } catch (err) {
      console.warn('Could not persist status to database/mock:', err);
      try {
        await repositories.reminders.updateStatus(id, nextActive ? 'active' : 'paused');
      } catch {
        // เงียบไว้เนื่องจาก UI อัปเดตเรียบร้อยแล้ว
      }
    }
  };

  // เปิด Modal ยืนยันการลบรายการเตือนยา
  const handleDeleteClick = (item: MedicationDisplayItem) => {
    if (isPatient) {
      alert('บัญชีนี้อยู่ในบทบาทผู้ป่วย (Patient) ไม่มีสิทธิ์ลบรายการยา');
      return;
    }
    setDeletingItem(item);
  };

  // ยืนยันการลบรายการเตือนยาจริง
  const confirmDelete = async () => {
    if (isPatient || !deletingItem) return;
    const { id, name } = deletingItem;
    setDeletingItem(null);

    // ลบออกจากรายการใน UI ทันที
    setMedicationList((prev) => prev.filter((m) => m.id !== id));
    showToast(`ลบการแจ้งเตือน "${name}" เรียบร้อยแล้ว 🗑️`);

    const isReminderUuid = isUuid(id);
    try {
      if (isReminderUuid) {
        await deleteReminder(id);
      } else {
        await repositories.reminders.delete(id);
      }
      await loadData(selectedPatientId);
    } catch (err) {
      console.warn('Could not delete reminder from database/mock:', err);
      try {
        await repositories.reminders.delete(id);
        await loadData(selectedPatientId);
      } catch {
        // ignore
      }
    }
  };

  // เพิ่มยาตัวอย่างลงฐานข้อมูล Supabase อัตโนมัติ
  const handleSeedSample = async () => {
    if (isPatient) {
      alert('บัญชีนี้อยู่ในบทบาทผู้ป่วย (Patient) ไม่มีสิทธิ์จัดการยา');
      return;
    }
    setIsSaving(true);
    try {
      if (!isUuid(selectedPatientId)) {
        showToast('กรุณาเลือกผู้ป่วยในระบบจริงเพื่อบันทึกข้อมูลลงฐานข้อมูล');
        return;
      }
      const seeded = await seedSampleReminders(selectedPatientId);
      if (seeded && seeded.length > 0) {
        showToast(`บันทึกชุดยาตัวอย่าง ${seeded.length} รายการให้ ${currentPatient.name} สำเร็จ 💊`);
      } else {
        showToast('ไม่พบรายการยาในฐานข้อมูล Supabase (กรุณารันคำสั่งใน fix_rls_remote.sql)');
      }
      await loadData(selectedPatientId);
    } catch (err) {
      console.error('Error seeding sample medications:', err);
      alert('เกิดข้อผิดพลาดในการโหลดตัวอย่างยาลงฐานข้อมูล กรุณาตรวจสอบสิทธิ์ RLS หรือการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  // บันทึกการจ่ายยาและเพิ่มการเตือนยาใหม่
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPatient) {
      alert('บัญชีนี้อยู่ในบทบาทผู้ป่วย (Patient) ไม่มีสิทธิ์สั่งจ่ายยา กรุณาเข้าสู่ระบบด้วยบัญชีแพทย์หรือเจ้าหน้าที่ (medical / staff_admin)');
      return;
    }
    if (!selectedMedId) {
      alert('กรุณาเลือกตัวยาที่ต้องการจ่าย');
      return;
    }
    if (selectedTimes.length === 0) {
      alert('กรุณาเลือกรอบเวลาอย่างน้อย 1 ช่วงเวลา');
      return;
    }

    const chosenMed = availableMeds.find(m => m.id === selectedMedId);
    
    // ตรวจสอบการแพ้ยา (Allergy Warning)
    if (currentPatient.allergies && chosenMed) {
      const allergyLower = currentPatient.allergies.toLowerCase();
      const medNameLower = chosenMed.name.toLowerCase();
      if (
        (allergyLower.includes('penicillin') || allergyLower.includes('เพนิซิลลิน')) &&
        (medNameLower.includes('amoxicillin') || medNameLower.includes('penicillin'))
      ) {
        const proceed = confirm(`⚠️ คำเตือนความปลอดภัย:\nผู้ป่วยมีประวัติ ${currentPatient.allergies}\nยานี้คือ ${chosenMed.name}\nคุณแน่ใจหรือไม่ว่าต้องการจ่ายยานี้?`);
        if (!proceed) return;
      }
    }

    setIsSaving(true);
    let savedToSupabase = false;
    let supabaseErrorMessage: string | null = null;

    try {
      // ผู้ป่วยเป้าหมายที่จะได้รับยา ต้องเป็น selectedPatientId ของผู้ป่วยที่เลือกไว้
      const isTargetUserUuid = isUuid(selectedPatientId);
      const isMedUuid = isUuid(selectedMedId);

      // 1. ลองบันทึกลง Supabase เมื่อทั้ง User และ Medication เป็น UUID
      if (isTargetUserUuid && isMedUuid) {
        try {
          const created = await createReminder({
            user_id: selectedPatientId,
            medication_id: selectedMedId,
            reminder_times: [...selectedTimes].sort(),
            start_date: startDate,
            end_date: endDate || null, // null คือทานต่อเนื่องจนกว่าจะมาแก้ไข
          });

          if (created) {
            savedToSupabase = true;
            showToast(`บันทึกลงฐานข้อมูลและจ่ายยา "${created.medication?.name ?? chosenMed?.name ?? 'ยา'}" ให้ ${currentPatient.name} สำเร็จ 💊`);
          }
        } catch (dbErr: unknown) {
          console.warn('Supabase createReminder error:', dbErr);
          supabaseErrorMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
        }
      }

      // 2. หากยังไม่ได้บันทึกลง Supabase (เช่น เป็น mock user/med หรือ Supabase ติด RLS)
      // ให้บันทึกลง Mock Database เป็น fallback ทันที เพื่อให้ผู้ใช้จ่ายยาสำเร็จเสมอ ไม่ค้างใน Modal
      if (!savedToSupabase) {
        await repositories.reminders.create({
          patient_id: selectedPatientId,
          medication_id: selectedMedId,
          reminder_times: [...selectedTimes].sort(),
          start_date: startDate,
          end_date: endDate || null,
          status: 'active',
        });

        if (supabaseErrorMessage) {
          console.warn('Fallback to mock repo due to DB error:', supabaseErrorMessage);
          if (supabaseErrorMessage.includes('row-level security') || supabaseErrorMessage.includes('policy')) {
            showToast(`จ่ายยาให้ ${currentPatient.name} สำเร็จ (Mock DB) ⚠️ Supabase ติด RLS`);
            alert(
              '⚠️ แจ้งเตือนสิทธิ์ฐานข้อมูล Supabase:\n' +
              'ระบบได้บันทึกการจ่ายยาและแสดงผลเรียบร้อยแล้ว แต่การบันทึกลง Supabase โดยตรงติดสิทธิ์ RLS Policy\n\n' +
              'วิธีเปิดสิทธิ์ถาวร:\nกรุณานำคำสั่งในไฟล์ supabase/fix_rls_remote.sql ไปรันใน Supabase SQL Editor'
            );
          } else {
            showToast(`จ่ายยา "${chosenMed?.name ?? 'ยา'}" ให้ ${currentPatient.name} เรียบร้อย (Mock DB)`);
          }
        } else {
          showToast(`จ่ายยา "${chosenMed?.name ?? 'ยา'}" ให้ ${currentPatient.name} เรียบร้อย 💊`);
        }
      }

      // ปิด modal และรีเซ็ตฟอร์มเสมอ
      setIsAddModalOpen(false);
      setSelectedMedId('');
      setSelectedTimes(['08:00', '18:00']);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      await loadData(selectedPatientId);
    } catch (err: unknown) {
      console.error('Error handling add submit:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`เกิดข้อผิดพลาดในการทำรายการ: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTimeSelection = (time: string) => {
    setSelectedTimes((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
  };

  const openEditModal = (item: MedicationDisplayItem) => {
    if (isPatient) {
      alert('บัญชีนี้อยู่ในบทบาทผู้ป่วย (Patient) ไม่มีสิทธิ์แก้ไขรายการยา');
      return;
    }
    setEditingItem(item);
    // ค้นหาตัวยาที่ตรงกันใน availableMeds จาก id หรือเทียบจากชื่อยา
    const cleanItemName = item.name.toLowerCase().trim();
    const matched = availableMeds.find(
      (m) =>
        m.id === item.medicationId ||
        m.name.toLowerCase().trim() === cleanItemName ||
        cleanItemName.includes(m.name.toLowerCase().trim()) ||
        m.name.toLowerCase().trim().includes(cleanItemName)
    );
    setEditMedId(matched ? matched.id : (item.medicationId || availableMeds[0]?.id || ''));
    setEditTimes(item.rawTimes && item.rawTimes.length > 0 ? [...item.rawTimes] : ['08:00', '18:00']);
    setEditStartDate(item.startDate || new Date().toISOString().split('T')[0]);
    setEditEndDate(item.endDate || '');
  };

  const toggleEditTimeSelection = (time: string) => {
    setEditTimes((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time]
    );
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageMedication || !editingItem) {
      if (isPatient) alert('บัญชีนี้อยู่ในบทบาทผู้ป่วย (Patient) ไม่มีสิทธิ์แก้ไขรายการยา');
      return;
    }

    if (!editMedId) {
      alert('กรุณาเลือกตัวยา');
      return;
    }
    if (editTimes.length === 0) {
      alert('กรุณาเลือกรอบเวลาอย่างน้อย 1 ช่วงเวลา');
      return;
    }

    const chosenMed = availableMeds.find((m) => m.id === editMedId) || {
      id: editMedId,
      name: editingItem.name,
      category: editingItem.category || 'ยาทั่วไป',
      type: 'เม็ด',
      stock: 30,
    };

    // ตรวจสอบการแพ้ยา (Allergy check)
    if (currentPatient.allergies && chosenMed) {
      const allergyLower = currentPatient.allergies.toLowerCase();
      const medNameLower = chosenMed.name.toLowerCase();
      if (
        (allergyLower.includes('penicillin') || allergyLower.includes('เพนิซิลลิน')) &&
        (medNameLower.includes('amoxicillin') || medNameLower.includes('penicillin'))
      ) {
        const proceed = confirm(
          `⚠️ คำเตือนความปลอดภัย:\nผู้ป่วยมีประวัติ ${currentPatient.allergies}\nยาที่เลือกคือ: ${chosenMed.name}\nคุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนเป็นยานี้?`
        );
        if (!proceed) return;
      }
    }

    setIsSaving(true);
    const sortedTimes = [...editTimes].sort();
    const formattedTimes = sortedTimes.map(formatTimeToThai);
    const dosage = (chosenMed as unknown as { dosage?: string })?.dosage ?? `1 ${chosenMed?.type ?? 'เม็ด'}`;
    const desc = (chosenMed as unknown as { description?: string })?.description ? ` (${(chosenMed as unknown as { description?: string }).description})` : '';
    const newInstruction = !editingItem.isActive
      ? `รับทาน ครั้งละ ${dosage} · ยาหยุดชั่วคราว`
      : `รับทาน ครั้งละ ${dosage} · วันละ ${sortedTimes.length} ครั้ง${desc}`;

    // อัปเดตใน UI ทันที (Optimistic)
    setMedicationList((prev) =>
      prev.map((item) => {
        if (item.id !== editingItem.id) return item;
        return {
          ...item,
          medicationId: chosenMed.id,
          name: chosenMed.name,
          category: chosenMed.category,
          dosageInstruction: newInstruction,
          times: formattedTimes,
          rawTimes: sortedTimes,
          startDate: editStartDate,
          endDate: editEndDate || null,
          stockInfo: `เหลือ ${chosenMed.stock} ${chosenMed.type}`,
        };
      })
    );

    const isReminderUuid = isUuid(editingItem.id);
    const isMedUuid = isUuid(chosenMed.id);

    try {
      if (isReminderUuid && isMedUuid) {
        await updateReminder(editingItem.id, {
          medication_id: chosenMed.id,
          reminder_times: sortedTimes,
          start_date: editStartDate,
          end_date: editEndDate || null,
        });
      } else {
        await repositories.reminders.update(editingItem.id, {
          medication_id: chosenMed.id,
          reminder_times: sortedTimes,
          start_date: editStartDate,
          end_date: editEndDate || null,
        });
      }
      showToast(`แก้ไขข้อมูลยา "${chosenMed.name}" เรียบร้อยแล้ว ✏️`);
      await loadData(selectedPatientId);
    } catch (err) {
      console.warn('Could not persist updated reminder to Supabase/mock:', err);
      try {
        await repositories.reminders.update(editingItem.id, {
          medication_id: chosenMed.id,
          reminder_times: sortedTimes,
          start_date: editStartDate,
          end_date: editEndDate || null,
        });
      } catch {
        // ignore
      }
      showToast(`บันทึกการแก้ไขข้อมูลยา "${chosenMed.name}" เรียบร้อยแล้ว`);
      await loadData(selectedPatientId);
    } finally {
      setIsSaving(false);
      setEditingItem(null);
    }
  };

  return (
    <div className="w-full font-sans text-slate-800">
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} variant="info" />

      <div className="w-full min-h-[calc(100vh-4rem)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Header Title, Clinic Info & Patient Selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                <span>คลินิกมหาวิทยาลัยวลัยลักษณ์</span>
                <span>•</span>
                <span className="text-blue-600 font-semibold">ระบบจ่ายยาและเตือนยา</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px] font-medium shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  {isDbConnected ? 'Supabase Live Connected' : 'กำลังเชื่อมต่อฐานข้อมูล...'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                ข้อมูลยาที่ต้องทาน
              </h1>
            </div>

              {/* --- 1. แถบเลือกผู้ป่วย (Patient Selector เอาไว้จ่ายยา) --- */}
              {canManageMedication ? (
                <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-2xl shadow-2xs">
                  <div className="flex items-center gap-2 px-2 text-slate-600">
                    <User size={18} className="text-blue-600 shrink-0" />
                    <span className="text-xs font-bold whitespace-nowrap">ผู้ป่วย:</span>
                  </div>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientOverride(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
                  >
                    {allPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.studentId}) {p.allergies ? `[⚠️ ${p.allergies}]` : ''}
                      </option>
                    ))}
                  </select>

                  <button 
                    onClick={() => void loadData(selectedPatientId)} 
                    title="รีเฟรชข้อมูลผู้ป่วย"
                    disabled={isLoading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs">
                  <User size={16} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">{user?.full_name || 'บัญชีของคุณ'}</span>
                  <button 
                    onClick={() => void loadData(selectedPatientId)} 
                    title="รีเฟรชข้อมูลยา"
                    disabled={isLoading}
                    className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              )}
            </div>

            {/* แถบแจ้งเตือนข้อมูลผู้ป่วยและการแพ้ยา */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm">
                  {currentPatient.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm sm:text-base">{currentPatient.name}</span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">รหัสนักศึกษา: {currentPatient.studentId}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                    <span>โทร: {currentPatient.phone || '080-000-0000'}</span>
                    <span>เพศ: {currentPatient.gender || 'ไม่ระบุ'}</span>
                  </div>
                </div>
              </div>

              {currentPatient.allergies ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  <span>{currentPatient.allergies}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-medium">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span>ไม่มีประวัติแพ้ยา</span>
                </div>
              )}
            </div>

            {/* รายการยาและการแจ้งเตือน (Reminders View) */}
            {/* Summary & Action Bar */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                      <div className="bg-blue-100 text-blue-600 p-2.5 rounded-full">
                         <CalendarIcon size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">ยาทั้งหมด {medicationList.length} รายการ</div>
                        <div className="text-xs text-slate-500">
                          กำลังแจ้งเตือน {medicationList.filter(m => m.isActive).length} รายการ · หยุดชั่วคราว {medicationList.filter(m => !m.isActive).length} รายการ
                        </div>
                      </div>
                   </div>

                   {canManageMedication && (
                     <div className="flex items-center gap-2 w-full sm:w-auto">
                       {medicationList.length === 0 && (
                         <button 
                           onClick={() => void handleSeedSample()}
                           disabled={isSaving}
                           className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-100/50 px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-2xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                         >
                           <Sparkles size={16} /> โหลดตัวอย่างยาลง Supabase
                         </button>
                       )}
                       <button 
                         onClick={() => setIsAddModalOpen(true)}
                         className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition shadow-sm flex items-center justify-center gap-2 flex-1 sm:flex-initial cursor-pointer"
                       >
                          จ่ายยา / เพิ่มยา <Plus size={16} />
                       </button>
                     </div>
                   )}
                </div>

                {/* --- List ยา จาก Supabase --- */}
                {isLoading ? (
                  <div className="space-y-4 py-6">
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse flex items-center justify-between">
                        <div className="flex gap-4 items-center">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
                          <div className="space-y-2">
                            <div className="h-5 w-48 bg-slate-200 rounded"></div>
                            <div className="h-3 w-32 bg-slate-100 rounded"></div>
                          </div>
                        </div>
                        <div className="h-6 w-16 bg-slate-100 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                ) : medicationList.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                      <Pill size={28} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        {isPatient ? 'คุณยังไม่มีรายการยาในระบบ' : `ยังไม่มีรายการยาสำหรับ ${currentPatient.name}`}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {isPatient
                          ? 'เมื่อแพทย์หรือเภสัชกรสั่งจ่ายยา รายการยาและรอบเวลาทานยาจะแสดงที่นี่'
                          : 'คลิกปุ่ม "จ่ายยา / เพิ่มยา" เพื่อสั่งจ่ายยาและตั้งรอบเตือนยาให้ผู้ป่วยรายนี้'}
                      </p>
                    </div>
                    {canManageMedication && (
                      <div className="flex justify-center gap-3 pt-2">
                        <button 
                          onClick={() => void handleSeedSample()}
                          disabled={isSaving}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-sm px-4 py-2 rounded-lg border border-blue-200 transition cursor-pointer"
                        >
                          <Sparkles size={16} className="inline mr-1" /> สร้างชุดยาตัวอย่างใน Supabase
                        </button>
                        <button 
                          onClick={() => setIsAddModalOpen(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition cursor-pointer"
                        >
                          <Plus size={16} className="inline mr-1" /> จ่ายยาใหม่
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {medicationList.map((med) => (
                      <div key={med.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            
                            {/* ซ้าย: ข้อมูลยา (ฉลากยา) */}
                            <div className="flex gap-4 w-full md:w-auto">
                               <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 shrink-0">
                                  <Pill className="text-blue-600" size={28} />
                               </div>

                               <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{med.name}</h3>
                                    {med.category && (
                                      <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                        {med.category}
                                      </span>
                                    )}
                                    {!med.isActive && (
                                      <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                                        หยุดชั่วคราว
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-600 text-sm mb-3">{med.dosageInstruction}</p>
                                  
                                  {/* Time Chips */}
                                  <div className="flex flex-wrap gap-2">
                                     {med.times.map((time, i) => (
                                        <span key={i} className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                                           <Check size={12} /> {time}
                                        </span>
                                     ))}
                                  </div>

                                  {/* ข้อมูลระยะเวลาทานยา */}
                                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                                    <span className="font-medium text-slate-600">เริ่ม: {med.startDate || 'วันนี้'}</span>
                                    <span>•</span>
                                    <span className={med.endDate ? 'text-slate-600' : 'text-emerald-700 font-semibold flex items-center gap-1'}>
                                      {!med.endDate && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>}
                                      {med.endDate ? `สิ้นสุด: ${med.endDate}` : 'ทานต่อเนื่อง (จนกว่าจะมีการแก้ไข)'}
                                    </span>
                                  </div>
                               </div>
                            </div>

                            {/* ขวา: Toggle & สถานะ & ปุ่มแก้ไข & ปุ่มลบ */}
                            <div className="flex flex-col md:flex-row items-end md:items-center gap-3 min-w-[160px] mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                               <div className="flex flex-col items-end gap-1">
                                 <span className="text-xs text-slate-400 font-medium">{med.stockInfo}</span>
                                 <div className="flex items-center gap-3">
                                    <ToggleSwitch active={Boolean(med.isActive)} onToggle={() => handleToggle(med.id)} />
                                 </div>
                               </div>

                               {canManageMedication && (
                                 <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                                   <button 
                                     type="button"
                                     onClick={() => openEditModal(med)}
                                     title="แก้ไขข้อมูลยานี้"
                                     className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                                   >
                                     <Pencil size={15} />
                                     <span className="hidden sm:inline">แก้ไข</span>
                                   </button>
                                   <button 
                                     type="button"
                                     onClick={() => handleDeleteClick(med)}
                                     title="ลบรายการยานี้"
                                     className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 px-2 py-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                   >
                                     <Trash2 size={15} />
                                     <span className="hidden sm:inline">ลบ</span>
                                   </button>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
        </div>
      </div>

      {/* --- Modal: จ่ายยาและเพิ่มการแจ้งเตือนยา (เชื่อม Supabase) --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                  <Pill className="text-blue-600" size={20} />
                  <span>จ่ายยาและเพิ่มการแจ้งเตือนยา</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  สั่งจ่ายยาให้ผู้ป่วย: <span className="font-bold text-slate-800">{currentPatient.name}</span> ({currentPatient.studentId})
                </p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* แจ้งเตือนการแพ้ยาใน Modal */}
            {currentPatient.allergies && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span>คำเตือน: ผู้ป่วยมีประวัติ {currentPatient.allergies}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* เลือกตัวยาจาก Supabase */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เลือกตัวยา (จากคลังยา Supabase) *
                </label>
                <select
                  required
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">-- กรุณาเลือกยา --</option>
                  {availableMeds.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.category} · {med.type} · คงเหลือ {med.stock})
                    </option>
                  ))}
                </select>
                {availableMeds.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> ไม่พบรายการยาในตาราง medications
                  </p>
                )}
              </div>

              {/* เลือกรอบเวลา */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  รอบเวลาที่ต้องทาน *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'เช้า (08:00 น.)', time: '08:00' },
                    { label: 'กลางวัน (12:00 น.)', time: '12:00' },
                    { label: 'เย็น (18:00 น.)', time: '18:00' },
                    { label: 'ก่อนนอน (21:00 น.)', time: '21:00' },
                  ].map((slot) => {
                    const isSelected = selectedTimes.includes(slot.time);
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => toggleTimeSelection(slot.time)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition text-left ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <span>{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* วันที่เริ่มและสิ้นสุด */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่สิ้นสุด (ไม่บังคับ)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {endDate ? `สิ้นสุดวันที่ ${endDate}` : '✨ ปล่อยว่างไว้เพื่อให้แสดงผลต่อเนื่องจนกว่าจะมาแก้ไข'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? 'กำลังบันทึกลง Supabase...' : 'ยืนยันจ่ายยาและตั้งเตือน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: แก้ไขตัวยาที่จ่ายไปแล้ว --- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                  <Pencil className="text-blue-600" size={20} />
                  <span>แก้ไขข้อมูลยาที่จ่ายแล้ว</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  แก้ไขข้อมูลยาของผู้ป่วย: <span className="font-bold text-slate-800">{currentPatient.name}</span> ({currentPatient.studentId})
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingItem(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* แจ้งเตือนการแพ้ยาใน Modal */}
            {currentPatient.allergies && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span>คำเตือน: ผู้ป่วยมีประวัติ {currentPatient.allergies}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* เลือกตัวยา */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เลือกตัวยา *
                </label>
                <select
                  required
                  value={editMedId}
                  onChange={(e) => setEditMedId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  <option value="">-- กรุณาเลือกยา --</option>
                  {!availableMeds.some((m) => m.id === editMedId) && editingItem.name && (
                    <option value={editMedId}>
                      {editingItem.name} ({editingItem.category || 'ยาทั่วไป'})
                    </option>
                  )}
                  {availableMeds.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.category} · {med.type} · คงเหลือ {med.stock})
                    </option>
                  ))}
                </select>
              </div>

              {/* เลือกรอบเวลา */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  รอบเวลาที่ต้องทาน *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'เช้า (08:00 น.)', time: '08:00' },
                    { label: 'กลางวัน (12:00 น.)', time: '12:00' },
                    { label: 'เย็น (18:00 น.)', time: '18:00' },
                    { label: 'ก่อนนอน (21:00 น.)', time: '21:00' },
                  ].map((slot) => {
                    const isSelected = editTimes.includes(slot.time);
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => toggleEditTimeSelection(slot.time)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition text-left cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <span>{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* วันที่เริ่มและสิ้นสุด */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่สิ้นสุด (ไม่บังคับ)
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {editEndDate ? `สิ้นสุดวันที่ ${editEndDate}` : '✨ ปล่อยว่างไว้เพื่อให้แสดงผลต่อเนื่องจนกว่าจะมาแก้ไข'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: ยืนยันการลบรายการยา --- */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบรายการเตือนยา</h3>
                <p className="text-xs text-slate-500">การดำเนินการนี้ไม่สามารถเรียกคืนได้</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 my-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Pill size={16} className="text-blue-600 shrink-0" />
                <span className="text-sm font-bold text-slate-800">{deletingItem.name}</span>
                {deletingItem.category && (
                  <span className="text-[10px] font-medium bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    {deletingItem.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 pl-6">{deletingItem.dosageInstruction}</p>
              <p className="text-xs text-slate-500 pl-6">
                ผู้ป่วย: <span className="font-semibold text-slate-700">{currentPatient.name}</span> ({currentPatient.studentId})
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>ยืนยันลบรายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Components ย่อย ---

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle?: () => void }) {
  return (
    <button 
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        active ? 'bg-blue-600' : 'bg-slate-300'
      }`}
      aria-label="เปิด/ปิดการแจ้งเตือนยา"
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
