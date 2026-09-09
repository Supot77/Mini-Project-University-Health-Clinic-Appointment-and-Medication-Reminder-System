'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
} from 'lucide-react';

import {
  getPatientForStaffAdmin,
  staffAdminUpdatePatient,
  type StaffAdminPatientUpdates,
} from '@/services/authService';

import type {
  HealthDeclarationStatus,
  PatientType,
} from '@/types/database';

interface StaffEditPatientFormProps {
  patientId: string;
}

const initialForm: StaffAdminPatientUpdates = {
  full_name: '',
  phone: '',
  emergency_phone: '',
  address: '',

  patient_type: 'student',
  student_id: '',
  employee_id: '',
  organization: '',

  allergy_status: 'unknown',
  allergies: '',

  chronic_disease_status: 'unknown',
  chronic_diseases: '',
};

export default function StaffEditPatientForm({
  patientId,
}: StaffEditPatientFormProps) {
  const router = useRouter();

  const [form, setForm] =
    useState<StaffAdminPatientUpdates>(initialForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPatient() {
      setIsLoading(true);
      setError(null);

      try {
        const patient =
          await getPatientForStaffAdmin(patientId);

        if (!active) return;

        setForm({
          full_name: patient.full_name ?? '',
          phone: patient.phone ?? '',
          emergency_phone:
            patient.emergency_phone ?? '',
          address: patient.address ?? '',

          patient_type:
            patient.patient_type ?? 'student',
          student_id: patient.student_id ?? '',
          employee_id: patient.employee_id ?? '',
          organization: patient.organization ?? '',

          allergy_status:
            patient.allergy_status ?? 'unknown',
          allergies: patient.allergies ?? '',

          chronic_disease_status:
            patient.chronic_disease_status ?? 'unknown',
          chronic_diseases:
            patient.chronic_diseases ?? '',
        });
      } catch (loadError) {
        if (!active) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'โหลดข้อมูลผู้ป่วยไม่สำเร็จ'
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPatient();

    return () => {
      active = false;
    };
  }, [patientId]);

  function updateField<
    K extends keyof StaffAdminPatientUpdates
  >(
    field: K,
    value: StaffAdminPatientUpdates[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await staffAdminUpdatePatient(patientId, form);

      setSuccess('บันทึกข้อมูลผู้ป่วยเรียบร้อยแล้ว');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'บันทึกข้อมูลไม่สำเร็จ'
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-72 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2
            className="size-5 animate-spin text-sky-600"
            aria-hidden="true"
          />

          กำลังโหลดข้อมูลผู้ป่วย...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-sky-700"
        >
          <ArrowLeft
            className="size-4"
            aria-hidden="true"
          />

          กลับ
        </button>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          แก้ไขข้อมูลผู้ป่วย
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          แก้ไขข้อมูลส่วนตัว รหัสประจำตัว
          และข้อมูลสุขภาพของผู้ป่วย
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* ข้อมูลส่วนตัว */}

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            ข้อมูลส่วนตัว
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                ชื่อ–นามสกุล
              </span>

              <input
                required
                value={form.full_name}
                onChange={(event) =>
                  updateField(
                    'full_name',
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-slate-700">
                เบอร์โทรศัพท์
              </span>

              <input
                required
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  updateField('phone', event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm font-medium text-slate-700">
                เบอร์ติดต่อฉุกเฉิน
              </span>

              <input
                type="tel"
                value={form.emergency_phone ?? ''}
                onChange={(event) =>
                  updateField(
                    'emergency_phone',
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                ที่อยู่
              </span>

              <textarea
                rows={3}
                value={form.address ?? ''}
                onChange={(event) =>
                  updateField(
                    'address',
                    event.target.value
                  )
                }
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>
        </section>

        {/* ประเภทและรหัส */}

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            ประเภทและรหัสประจำตัว
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-700">
                ประเภทผู้ป่วย
              </span>

              <select
                value={form.patient_type}
                onChange={(event) =>
                  updateField(
                    'patient_type',
                    event.target.value as PatientType
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="student">
                  นักศึกษา
                </option>

                <option value="employee">
                  บุคลากร
                </option>
              </select>
            </label>

            {form.patient_type === 'student' ? (
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  รหัสนักศึกษา
                </span>

                <input
                  required
                  value={form.student_id ?? ''}
                  onChange={(event) =>
                    updateField(
                      'student_id',
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            ) : (
              <>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    รหัสบุคลากร
                  </span>

                  <input
                    required
                    value={form.employee_id ?? ''}
                    onChange={(event) =>
                      updateField(
                        'employee_id',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    หน่วยงาน
                  </span>

                  <input
                    required
                    value={form.organization ?? ''}
                    onChange={(event) =>
                      updateField(
                        'organization',
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </>
            )}
          </div>
        </section>

        {/* ข้อมูลสุขภาพ */}

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            ข้อมูลสุขภาพ
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  ประวัติแพ้ยา
                </span>

                <select
                  value={form.allergy_status}
                  onChange={(event) =>
                    updateField(
                      'allergy_status',
                      event.target
                        .value as HealthDeclarationStatus
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="unknown">
                    ไม่ทราบ
                  </option>

                  <option value="no">ไม่มี</option>

                  <option value="yes">มี</option>
                </select>
              </label>

              {form.allergy_status === 'yes' && (
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    รายละเอียดการแพ้ยา
                  </span>

                  <textarea
                    required
                    rows={3}
                    value={form.allergies ?? ''}
                    onChange={(event) =>
                      updateField(
                        'allergies',
                        event.target.value
                      )
                    }
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              )}
            </div>

            <div>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  โรคประจำตัว
                </span>

                <select
                  value={form.chronic_disease_status}
                  onChange={(event) =>
                    updateField(
                      'chronic_disease_status',
                      event.target
                        .value as HealthDeclarationStatus
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="unknown">
                    ไม่ทราบ
                  </option>

                  <option value="no">ไม่มี</option>

                  <option value="yes">มี</option>
                </select>
              </label>

              {form.chronic_disease_status ===
                'yes' && (
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    รายละเอียดโรคประจำตัว
                  </span>

                  <textarea
                    required
                    rows={3}
                    value={
                      form.chronic_diseases ?? ''
                    }
                    onChange={(event) =>
                      updateField(
                        'chronic_diseases',
                        event.target.value
                      )
                    }
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              )}
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSaving}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save
                className="size-4"
                aria-hidden="true"
              />
            )}

            {isSaving
              ? 'กำลังบันทึก...'
              : 'บันทึกข้อมูล'}
          </button>
        </div>
      </form>
    </main>
  );
}