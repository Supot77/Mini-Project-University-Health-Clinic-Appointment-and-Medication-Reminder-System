'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  Pill, 
  X, 
  Check, 
  Plus, 
  Trash2, 
  AlertCircle, 
  AlertTriangle, 
  Pencil, 
  Search, 
  Clock 
} from 'lucide-react';
import { useClinicMockDatabase } from '@/features/mock-database/ClinicMockProvider';
import { useAuth } from '@/hooks/useAuth';
import { 
  getReminders, 
  createReminder, 
  updateReminder, 
  deleteReminder, 
  getAvailableMedications 
} from '@/services/reminderService';
import type { Medication, MedicationReminderWithMedication, Profile } from '@/types/database';
import { getPatients, getProfile } from '@/services/authService';

const isUuid = (val?: string | null): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

const inputClass =
  'h-11 w-full min-w-0 rounded-lg border border-brand-border-strong bg-white px-3.5 text-sm text-brand-ink placeholder:text-brand-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong';
const textActionClass =
  'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50 cursor-pointer';

// รายชื่อผู้ป่วยตัวอย่างสำหรับคลินิก (ใช้ fallback เมื่อไม่มีข้อมูลในตาราง profiles)
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
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ค้นหาและกรองสถานะรายการยา
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all');

  // Modal State: จ่ายยา / เพิ่มยาใหม่
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['08:00', '18:00']);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');

  // Modal State: แก้ไขตัวยาที่จ่ายไปแล้ว
  const [editingItem, setEditingItem] = useState<MedicationDisplayItem | null>(null);
  const [editMedId, setEditMedId] = useState('');
  const [editTimes, setEditTimes] = useState<string[]>([]);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // Modal State: ยืนยันการลบรายการยา
  const [deletingItem, setDeletingItem] = useState<MedicationDisplayItem | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((curr) => (curr === msg ? '' : curr));
    }, 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => {
      setErrorMessage((curr) => (curr === msg ? '' : curr));
    }, 5000);
  };

  // รายชื่อผู้ป่วยทั้งหมด (แยกตามสิทธิ์)
  const allPatients = useMemo<PatientOption[]>(() => {
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

    if (dbPatients.length > 0) {
      return dbPatients;
    }
    return CLINIC_PATIENTS;
  }, [canManageMedication, user, currentUserProfile, dbPatients]);

  // ข้อมูลผู้ป่วยที่เลือก
  const currentPatient = useMemo(() => {
    return allPatients.find(p => p.id === selectedPatientId) || allPatients[0];
  }, [allPatients, selectedPatientId]);

  // คำนวณจำนวนยาตามสถานะ
  const activeCount = useMemo(() => medicationList.filter((m) => m.isActive).length, [medicationList]);
  const pausedCount = useMemo(() => medicationList.filter((m) => !m.isActive).length, [medicationList]);

  // กรองรายการยาตามคำค้นหาและสถานะ
  const filteredMedications = useMemo(() => {
    return medicationList.filter((med) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        med.name.toLowerCase().includes(q) ||
        (med.category && med.category.toLowerCase().includes(q)) ||
        med.dosageInstruction.toLowerCase().includes(q);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && med.isActive) ||
        (filterStatus === 'paused' && !med.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [medicationList, searchQuery, filterStatus]);

  // ดึงข้อมูลยาของผู้ป่วยที่เลือก
  const loadData = useCallback(async (patientId: string) => {
    setIsLoading(true);
    try {
      // 1. ดึงรายการยา
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

      // 2. โหลดรายการยาจาก Supabase (กรณี patientId เป็น UUID)
      let dbReminders: MedicationReminderWithMedication[] = [];
      if (isUuid(patientId)) {
        try {
          dbReminders = await getReminders(patientId);
        } catch (dbErr) {
          console.warn('Could not fetch reminders from Supabase for patient:', patientId, dbErr);
        }
      }

      // 3. โหลดรายการยาจาก Mock repository
      let mockReminders: unknown[] = [];
      try {
        const { data: mockData } = await repositories.reminders.listWithMedication(patientId);
        if (mockData) {
          mockReminders = mockData;
        }
      } catch (mockErr) {
        console.warn('Could not fetch reminders from mock repo:', mockErr);
      }

      // 4. แปลงข้อมูลและเติมรายละเอียดตัวยาจาก meds
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

    showNotice(
      nextActive 
        ? `เปิดการแจ้งเตือน "${item.name}" แล้ว` 
        : `หยุดการแจ้งเตือน "${item.name}" ชั่วคราวแล้ว`
    );

    const isReminderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    try {
      if (isReminderUuid) {
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
      showError('บัญชีนี้อยู่ในบทบาทผู้ป่วย ไม่มีสิทธิ์ลบรายการยา');
      return;
    }
    setDeletingItem(item);
  };

  // ยืนยันการลบรายการเตือนยาจริง
  const confirmDelete = async () => {
    if (isPatient || !deletingItem) return;
    const { id, name } = deletingItem;
    setDeletingItem(null);

    setMedicationList((prev) => prev.filter((m) => m.id !== id));
    showNotice(`ลบรายการยา "${name}" เรียบร้อยแล้ว`);

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

  // บันทึกการจ่ายยาและเพิ่มการเตือนยาใหม่
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPatient) {
      showError('บัญชีนี้อยู่ในบทบาทผู้ป่วย ไม่มีสิทธิ์สั่งจ่ายยา');
      return;
    }
    if (!selectedMedId) {
      showError('กรุณาเลือกตัวยาที่ต้องการจ่าย');
      return;
    }
    if (selectedTimes.length === 0) {
      showError('กรุณาเลือกรอบเวลาอย่างน้อย 1 ช่วงเวลา');
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

    try {
      const isTargetUserUuid = isUuid(selectedPatientId);
      const isMedUuid = isUuid(selectedMedId);

      if (isTargetUserUuid && isMedUuid) {
        try {
          const created = await createReminder({
            user_id: selectedPatientId,
            medication_id: selectedMedId,
            reminder_times: [...selectedTimes].sort(),
            start_date: startDate,
            end_date: endDate || null,
          });

          if (created) {
            savedToSupabase = true;
            showNotice(`จ่ายยา "${created.medication?.name ?? chosenMed?.name ?? 'ยา'}" ให้ ${currentPatient.name} เรียบร้อยแล้ว`);
          }
        } catch (dbErr: unknown) {
          console.warn('Supabase createReminder error:', dbErr);
        }
      }

      if (!savedToSupabase) {
        await repositories.reminders.create({
          patient_id: selectedPatientId,
          medication_id: selectedMedId,
          reminder_times: [...selectedTimes].sort(),
          start_date: startDate,
          end_date: endDate || null,
          status: 'active',
        });
        showNotice(`จ่ายยา "${chosenMed?.name ?? 'ยา'}" ให้ ${currentPatient.name} เรียบร้อยแล้ว`);
      }

      setIsAddModalOpen(false);
      setSelectedMedId('');
      setSelectedTimes(['08:00', '18:00']);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      await loadData(selectedPatientId);
    } catch (err: unknown) {
      console.error('Error handling add submit:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      showError(`เกิดข้อผิดพลาดในการทำรายการ: ${errMsg}`);
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
      showError('บัญชีนี้อยู่ในบทบาทผู้ป่วย ไม่มีสิทธิ์แก้ไขรายการยา');
      return;
    }
    setEditingItem(item);
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
      if (isPatient) showError('บัญชีนี้อยู่ในบทบาทผู้ป่วย ไม่มีสิทธิ์แก้ไขรายการยา');
      return;
    }

    if (!editMedId) {
      showError('กรุณาเลือกตัวยา');
      return;
    }
    if (editTimes.length === 0) {
      showError('กรุณาเลือกรอบเวลาอย่างน้อย 1 ช่วงเวลา');
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
      showNotice(`บันทึกการแก้ไขข้อมูลยา "${chosenMed.name}" เรียบร้อยแล้ว`);
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
      showNotice(`บันทึกการแก้ไขข้อมูลยา "${chosenMed.name}" เรียบร้อยแล้ว`);
      await loadData(selectedPatientId);
    } finally {
      setIsSaving(false);
      setEditingItem(null);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-brand-surface py-8 sm:py-10 px-4 sm:px-6 lg:px-8 font-sans text-brand-body selection:bg-brand-soft selection:text-brand-ink">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {/* Header Title & Primary Action */}
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
              รายการยาและการแจ้งเตือน
            </h1>
            <p className="mt-1 text-sm text-brand-muted">
              ตารางเวลาทานยา ข้อมูลการใช้ยา และการแจ้งเตือนสำหรับผู้ป่วย
            </p>
          </div>

          {canManageMedication && (
            <button 
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              สั่งจ่ายยา / เพิ่มยา
            </button>
          )}
        </header>

        {/* Notifications Banner */}
        <div aria-live="polite" className="space-y-3 empty:hidden">
          {notice && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                {notice}
              </span>
              <button
                type="button"
                onClick={() => setNotice('')}
                className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                aria-label="ปิดแจ้งเตือน"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                {errorMessage}
              </span>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="rounded-lg p-1 text-rose-700 hover:bg-rose-100 cursor-pointer"
                aria-label="ปิดข้อความแจ้งเตือน"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Patient Meta & Selector */}
        <section aria-label="ข้อมูลผู้ป่วย" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-brand-border-soft text-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-soft text-brand-strong font-bold text-sm flex items-center justify-center border border-brand-border-soft shrink-0">
              {currentPatient.name.charAt(0)}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-brand-ink">{currentPatient.name}</span>
              <span className="text-xs text-brand-muted tabular-nums">
                รหัสนักศึกษา: {currentPatient.studentId}
              </span>
              {currentPatient.phone && (
                <span className="text-xs text-brand-muted">
                  · โทร: {currentPatient.phone}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canManageMedication ? (
              <label className="flex items-center gap-2 text-sm text-brand-body">
                <span className="text-xs font-semibold text-brand-ink whitespace-nowrap">ผู้ป่วย:</span>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientOverride(e.target.value)}
                  className="h-10 rounded-lg border border-brand-border-strong bg-white px-3 text-xs text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
                >
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.studentId}) {p.allergies ? `[⚠️ ${p.allergies}]` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex items-center gap-2 text-sm text-brand-body">
                <span className="font-medium text-brand-ink">ผู้ป่วย:</span>
                <span>{user?.full_name || 'บัญชีของคุณ'}</span>
              </div>
            )}

            {currentPatient.allergies && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-1.5 text-xs font-semibold">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>{currentPatient.allergies}</span>
              </div>
            )}
          </div>
        </section>

        {/* Status Tabs (Left) & Search (Right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border-soft pb-1.5">
          {/* Status Tabs (Accessible Underline Tabs with Hover Box Affordance) */}
          <div 
            className="flex flex-wrap items-center gap-2" 
            role="tablist" 
            aria-label="เลือกกรองสถานะการเตือนยา"
          >
            {([
              ['all', 'ทั้งหมด', medicationList.length],
              ['active', 'เปิดเตือน', activeCount],
              ['paused', 'หยุดชั่วคราว', pausedCount],
            ] as const).map(([tab, label, count]) => {
              const isSelected = filterStatus === tab;
              return (
                <button
                  key={tab}
                  id={`${tab}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="reminders-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setFilterStatus(tab)}
                  onKeyDown={(e) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                    e.preventDefault();
                    const tabs: ('all' | 'active' | 'paused')[] = ['all', 'active', 'paused'];
                    const currentIndex = tabs.indexOf(tab);
                    let nextTab: 'all' | 'active' | 'paused';
                    if (e.key === 'Home') nextTab = 'all';
                    else if (e.key === 'End') nextTab = 'paused';
                    else if (e.key === 'ArrowRight') nextTab = tabs[(currentIndex + 1) % tabs.length];
                    else nextTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                    setFilterStatus(nextTab);
                    document.getElementById(`${nextTab}-tab`)?.focus();
                  }}
                  className={`group relative inline-flex min-h-11 items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong cursor-pointer ${
                    isSelected
                      ? 'bg-brand-soft text-brand-strong font-bold shadow-2xs'
                      : 'text-brand-body hover:bg-brand-soft/70 hover:text-brand-ink'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-brand-strong text-white shadow-2xs'
                        : 'bg-white border border-brand-border-soft text-brand-muted group-hover:border-brand-border-strong group-hover:text-brand-ink'
                    }`}
                  >
                    {count}
                  </span>
                  {/* Active & Hover Underline indicator */}
                  <span
                    className={`absolute -bottom-[7px] left-2 right-2 h-0.5 rounded-full transition-all duration-150 ${
                      isSelected
                        ? 'bg-brand-strong'
                        : 'bg-transparent group-hover:bg-brand-border-strong/70'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          {/* Search Input on the Right */}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารายการยา..."
              className="h-10 w-full min-w-0 rounded-lg border border-brand-border-strong bg-white pl-9 pr-8 text-sm text-brand-ink placeholder:text-brand-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
              aria-label="ค้นหารายการยา"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-ink p-1 cursor-pointer"
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Data Stream (Tab Panel) */}
        <section id="reminders-panel" role="tabpanel" aria-labelledby={`${filterStatus}-tab`} aria-busy={isLoading}>
          {isLoading ? (
            <div className="space-y-3.5 sm:space-y-4">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="rounded-xl border border-brand-border-soft bg-white p-5 animate-pulse flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <div className="w-11 h-11 bg-brand-soft rounded-xl"></div>
                    <div className="space-y-2.5">
                      <div className="h-4 w-48 bg-brand-soft rounded"></div>
                      <div className="h-3 w-32 bg-brand-surface rounded"></div>
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-brand-soft rounded-full"></div>
                </div>
              ))}
            </div>
          ) : medicationList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-border-strong p-10 text-center space-y-4 bg-white/40">
              <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-strong mx-auto flex items-center justify-center">
                <Pill size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-ink">
                  {isPatient ? 'คุณยังไม่มีรายการยาในระบบ' : `ยังไม่มีรายการยาสำหรับ ${currentPatient.name}`}
                </h3>
                <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-md mx-auto">
                  {isPatient
                    ? 'เมื่อแพทย์หรือเภสัชกรสั่งจ่ายยา ข้อมูลยาและเวลาทานยาจะแสดงที่นี่'
                    : 'คลิกปุ่ม "สั่งจ่ายยา / เพิ่มยา" เพื่อสั่งจ่ายยาและตั้งรอบเตือนให้ผู้ป่วยรายนี้'}
                </p>
              </div>
              {canManageMedication && (
                <div className="flex justify-center pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand-hover cursor-pointer"
                  >
                    <Plus size={16} /> สั่งจ่ายยาใหม่
                  </button>
                </div>
              )}
            </div>
          ) : filteredMedications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-border-strong bg-white/60 p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-brand-ink">
                ไม่พบรายการยาที่ตรงกับเงื่อนไข
              </p>
              <p className="text-xs text-brand-muted">
                ลองปรับคำค้นหา หรือเลือกดูสถานะทั้งหมด
              </p>
              <button 
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="text-xs font-semibold text-brand-strong hover:underline cursor-pointer"
              >
                ล้างคำค้นหาและตัวกรอง
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {filteredMedications.map((med) => (
                <article 
                  key={med.id} 
                  className={`rounded-xl border bg-white p-4 sm:p-5 shadow-2xs transition-all duration-150 hover:shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 ${
                    med.isActive 
                      ? 'border-brand-border-soft hover:border-brand-border-strong' 
                      : 'border-brand-border-soft/70 bg-slate-50/60 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* ข้อมูลยา */}
                  <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-brand-soft border border-brand-border-soft text-brand-strong flex items-center justify-center shrink-0 mt-0.5">
                      <Pill size={22} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base sm:text-lg text-brand-ink leading-snug">
                          {med.name}
                        </h3>
                        {med.category && (
                          <span className="text-[11px] font-medium bg-brand-page text-brand-body px-2.5 py-0.5 rounded-full border border-brand-border-soft">
                            {med.category}
                          </span>
                        )}
                        {!med.isActive && (
                          <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            หยุดชั่วคราว
                          </span>
                        )}
                      </div>

                      <p className="text-brand-body text-xs sm:text-sm mt-1.5 leading-relaxed">
                        {med.dosageInstruction}
                      </p>

                      {/* Time Chips */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {med.times.map((time, i) => (
                          <span 
                            key={i} 
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-strong bg-brand-soft border border-brand-border-soft px-2.5 py-0.5 rounded-full"
                          >
                            <Clock size={12} className="text-brand-strong shrink-0" />
                            <span>{time}</span>
                          </span>
                        ))}
                      </div>

                      {/* ระยะเวลาทานยา */}
                      <div className="flex items-center gap-2 mt-2.5 text-xs text-brand-muted">
                        <span>เริ่ม: {med.startDate || 'วันนี้'}</span>
                        <span>•</span>
                        <span className={med.endDate ? 'text-brand-body' : 'text-status-success font-medium flex items-center gap-1.5'}>
                          {!med.endDate && <span className="w-1.5 h-1.5 rounded-full bg-status-success inline-block"></span>}
                          {med.endDate ? `สิ้นสุด: ${med.endDate}` : 'ทานต่อเนื่องจนกว่าจะมีการเปลี่ยนแปลง'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ขวา: Toggle & Stock & Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-brand-border-soft">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-brand-muted font-medium bg-brand-surface border border-brand-border-soft px-2.5 py-1 rounded-lg">
                        {med.stockInfo}
                      </span>
                      <ToggleSwitch active={Boolean(med.isActive)} onToggle={() => handleToggle(med.id)} />
                    </div>

                    {canManageMedication && (
                      <div className="flex items-center gap-3">
                        <button 
                          type="button"
                          onClick={() => openEditModal(med)}
                          className={`${textActionClass} text-brand-strong`}
                          aria-label={`แก้ไข ${med.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          แก้ไข
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteClick(med)}
                          className={`${textActionClass} text-status-critical`}
                          aria-label={`ลบ ${med.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          ลบ
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* --- Modal: จ่ายยาและเพิ่มการแจ้งเตือนยา --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-brand-hero border border-brand-border-soft animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-brand-border-soft pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-brand-ink">
                  สั่งจ่ายยาและตั้งเวลาเตือน
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  สำหรับผู้ป่วย: <span className="font-semibold text-brand-ink">{currentPatient.name}</span> ({currentPatient.studentId})
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)} 
                className="text-brand-muted hover:text-brand-ink p-1 rounded-lg transition cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {currentPatient.allergies && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>คำเตือน: ผู้ป่วยมีประวัติ {currentPatient.allergies}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-ink mb-1.5">
                  เลือกตัวยา *
                </label>
                <select
                  required
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- กรุณาเลือกยา --</option>
                  {availableMeds.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.category} · {med.type} · คงเหลือ {med.stock})
                    </option>
                  ))}
                </select>
                {availableMeds.length === 0 && (
                  <p className="text-xs text-status-warning mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> ไม่พบรายการยาในระบบ
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-ink mb-2">
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
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition text-left cursor-pointer ${
                          isSelected
                            ? 'border-brand-strong bg-brand-soft text-brand-strong font-semibold'
                            : 'border-brand-border-soft bg-white text-brand-body hover:border-brand-border-strong'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-brand-strong border-brand-strong text-white' : 'border-brand-border-strong bg-white'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <span>{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">
                    วันที่สิ้นสุด (ไม่บังคับ)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-brand-muted mt-1">
                    {endDate ? `สิ้นสุดวันที่ ${endDate}` : 'ปล่อยว่างเพื่อให้ทานต่อเนื่อง'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border-soft">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-brand-muted hover:text-brand-ink hover:bg-brand-soft rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการจ่ายยา'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: แก้ไขตัวยาที่จ่ายไปแล้ว --- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-brand-hero border border-brand-border-soft animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-brand-border-soft pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-brand-ink">
                  แก้ไขข้อมูลยาที่จ่ายแล้ว
                </h2>
                <p className="text-xs text-brand-muted mt-0.5">
                  สำหรับผู้ป่วย: <span className="font-semibold text-brand-ink">{currentPatient.name}</span> ({currentPatient.studentId})
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setEditingItem(null)} 
                className="text-brand-muted hover:text-brand-ink cursor-pointer p-1 rounded-lg transition"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            {currentPatient.allergies && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>คำเตือน: ผู้ป่วยมีประวัติ {currentPatient.allergies}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-ink mb-1.5">
                  เลือกตัวยา *
                </label>
                <select
                  required
                  value={editMedId}
                  onChange={(e) => setEditMedId(e.target.value)}
                  className={inputClass}
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

              <div>
                <label className="block text-xs font-semibold text-brand-ink mb-2">
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
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition text-left cursor-pointer ${
                          isSelected
                            ? 'border-brand-strong bg-brand-soft text-brand-strong font-semibold'
                            : 'border-brand-border-soft bg-white text-brand-body hover:border-brand-border-strong'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-brand-strong border-brand-strong text-white' : 'border-brand-border-strong bg-white'
                        }`}>
                          {isSelected && <Check size={12} />}
                        </div>
                        <span>{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">
                    วันที่สิ้นสุด (ไม่บังคับ)
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-brand-muted mt-1">
                    {editEndDate ? `สิ้นสุดวันที่ ${editEndDate}` : 'ปล่อยว่างเพื่อให้ทานต่อเนื่อง'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border-soft">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-medium text-brand-muted hover:text-brand-ink hover:bg-brand-soft rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-strong px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-ink/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-brand-hero border border-brand-border-soft animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-status-critical mb-3">
              <div className="w-10 h-10 rounded-full bg-status-critical-bg flex items-center justify-center shrink-0 border border-red-200 text-status-critical">
                <Trash2 size={20} className="text-status-critical" />
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-ink">ยืนยันการลบรายการเตือนยา</h3>
                <p className="text-xs text-brand-muted">การดำเนินการนี้ไม่สามารถเรียกคืนได้</p>
              </div>
            </div>

            <div className="bg-brand-surface rounded-xl p-3.5 border border-brand-border-soft my-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Pill size={16} className="text-brand-strong shrink-0" />
                <span className="text-sm font-bold text-brand-ink">{deletingItem.name}</span>
                {deletingItem.category && (
                  <span className="text-[10px] font-medium bg-white text-brand-muted px-2 py-0.5 rounded border border-brand-border-soft">
                    {deletingItem.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-body pl-6">{deletingItem.dosageInstruction}</p>
              <p className="text-xs text-brand-muted pl-6">
                ผู้ป่วย: <span className="font-semibold text-brand-ink">{currentPatient.name}</span> ({currentPatient.studentId})
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-border-soft">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-xs font-medium text-brand-muted hover:text-brand-ink hover:bg-brand-soft rounded-lg transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-status-critical hover:bg-red-700 px-4 text-sm font-semibold text-white cursor-pointer"
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${
        active ? 'bg-brand-strong' : 'bg-slate-300'
      }`}
      aria-label="เปิด/ปิดการแจ้งเตือนยา"
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
