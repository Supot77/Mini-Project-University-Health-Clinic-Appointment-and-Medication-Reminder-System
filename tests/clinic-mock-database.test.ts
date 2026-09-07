import { describe, expect, it } from 'vitest';
import { clinicMockTables } from '@/mocks/clinicDatabase';
import { ClinicMockDatabase } from '@/features/mock-database/engine';
import { createClinicRepositories } from '@/features/mock-database/repositories';
import { userRoles } from '@/types/database';

describe('shared clinic mock catalog', () => {
  it('contains the agreed account and catalog totals', () => {
    expect(clinicMockTables.profiles).toHaveLength(17);
    expect(clinicMockTables.profiles.filter((item) => item.role === 'medical')).toHaveLength(7);
    expect(clinicMockTables.profiles.filter((item) => item.role === 'patient')).toHaveLength(8);
    expect(clinicMockTables.profiles.filter((item) => item.role === 'staff_admin')).toHaveLength(2);
    expect(new Set(clinicMockTables.profiles.map((item) => item.role))).toEqual(new Set(userRoles));
    expect(clinicMockTables.departments).toHaveLength(4);
    expect(clinicMockTables.medications).toHaveLength(7);
  });

  it('keeps all foreign-key references valid', () => {
    const profileIds = new Set(clinicMockTables.profiles.map((item) => item.id));
    const departmentIds = new Set(clinicMockTables.departments.map((item) => item.id));
    const doctorIds = new Set(clinicMockTables.doctors.map((item) => item.id));
    const slotIds = new Set(clinicMockTables.appointment_slots.map((item) => item.id));
    const appointmentIds = new Set(clinicMockTables.appointments.map((item) => item.id));
    const medicationIds = new Set(clinicMockTables.medications.map((item) => item.id));
    const reminderIds = new Set(clinicMockTables.medication_reminders.map((item) => item.id));

    clinicMockTables.doctors.forEach((item) => {
      expect(profileIds.has(item.id)).toBe(true);
      expect(departmentIds.has(item.department_id ?? '')).toBe(true);
      expect(clinicMockTables.profiles.find((profile) => profile.id === item.id)?.role).toBe('medical');
    });
    clinicMockTables.appointment_slots.forEach((item) => expect(doctorIds.has(item.doctor_id)).toBe(true));
    clinicMockTables.appointments.forEach((item) => {
      expect(profileIds.has(item.user_id)).toBe(true);
      expect(slotIds.has(item.slot_id)).toBe(true);
    });
    clinicMockTables.medical_records.forEach((item) => {
      expect(appointmentIds.has(item.appointment_id)).toBe(true);
      expect(profileIds.has(item.patient_id)).toBe(true);
      expect(doctorIds.has(item.doctor_id)).toBe(true);
      item.prescribed_medications?.forEach((medication) => expect(medicationIds.has(medication.medication_id)).toBe(true));
    });
    clinicMockTables.inventory_logs.forEach((item) => {
      expect(medicationIds.has(item.medication_id)).toBe(true);
      expect(profileIds.has(item.pharmacist_id)).toBe(true);
    });
    clinicMockTables.medication_logs.forEach((item) => expect(reminderIds.has(item.reminder_id)).toBe(true));
  });
});

describe('Supabase-compatible mock repositories', () => {
  it('returns data/error responses asynchronously', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    await expect(repositories.profiles.getById('missing')).resolves.toMatchObject({ data: null, error: { code: 'PGRST116' } });
    await expect(repositories.schedules.listDepartments()).resolves.toMatchObject({ error: null, data: expect.any(Array) });
  });

  it('returns Supabase-style relational appointment data', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const result = await repositories.appointments.listWithDetails('profile-peter-parker');
    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({
      user_id: 'profile-peter-parker',
      patient: { full_name: 'Peter Parker' },
      slot: { doctor: { profile: { full_name: 'Stephen Strange' }, department: { id: 'dept-general' } } },
    });
  });

  it('joins reminders with medication and dose logs', async () => {
    const repositories = createClinicRepositories(new ClinicMockDatabase(0));
    const result = await repositories.reminders.listWithMedication('profile-peter-parker');
    expect(result.data?.[0]).toMatchObject({
      medication: { id: 'med-paracetamol' },
      logs: expect.arrayContaining([expect.objectContaining({ status: 'taken' })]),
    });
  });

  it('updates stock and inventory log in one transaction', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    const before = database.snapshot();
    const result = await repositories.pharmacy.adjustStock('med-paracetamol', 'profile-severus-snape', 'dispense', 5, 'test');
    const after = database.snapshot();
    expect(result.error).toBeNull();
    expect(after.medications.find((item) => item.id === 'med-paracetamol')?.stock).toBe(115);
    expect(after.inventory_logs).toHaveLength(before.inventory_logs.length + 1);
  });

  it('rolls back a failed stock transaction', async () => {
    const database = new ClinicMockDatabase(0);
    const repositories = createClinicRepositories(database);
    const before = database.snapshot();
    const result = await repositories.pharmacy.adjustStock('med-cetirizine', 'profile-severus-snape', 'dispense', 99);
    expect(result).toMatchObject({ data: null, error: { code: '23514' } });
    expect(database.snapshot()).toEqual(before);
  });
});
