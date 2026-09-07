"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, updateProfile } from "@/services/authService";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import {
  Phone,
  Mail,
  Pencil,
  AlertCircle,
  HeartPulse,
  FileClock,
  Stethoscope,
  ShieldCheck,
  X,
  Check,
  Loader2,
  Users,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  patient: "ผู้ใช้งาน",
  staff_admin: "เจ้าหน้าที่",
  medical: "บุคลากรทางการแพทย์",
};

type HealthStatus = "yes" | "no" | "unknown";

interface DoctorInfo {
  specialty: string | null;
  department: { name: string } | null;
}

export default function ProfileContent() {
  const { user, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =========================================================
  // Personal information edit
  // =========================================================

  const [editingPersonal, setEditingPersonal] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    full_name: "",
    phone: "",
    emergency_phone: "",
    address: "",
  });

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // =========================================================
  // Health information edit
  // =========================================================

  const [editingHealth, setEditingHealth] = useState(false);

  const [allergyStatus, setAllergyStatus] =
    useState<HealthStatus>("unknown");

  const [allergyDetail, setAllergyDetail] = useState("");

  const [chronicStatus, setChronicStatus] =
    useState<HealthStatus>("unknown");

  const [chronicDetail, setChronicDetail] = useState("");

  const [savingHealth, setSavingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const role = profile?.role ?? null;

  // =========================================================
  // Load profile
  // =========================================================

  async function loadProfile() {
    if (!user) return;

    const data = await getProfile(user.id);

    setProfile(data);

    setPersonalForm({
      full_name: data?.full_name ?? "",
      phone: data?.phone ?? "",
      emergency_phone: data?.emergency_phone ?? "",
      address: data?.address ?? "",
    });

    setAllergyStatus(
      (data?.allergy_status as HealthStatus) ?? "unknown",
    );

    setAllergyDetail(data?.allergies ?? "");

    setChronicStatus(
      (data?.chronic_disease_status as HealthStatus) ?? "unknown",
    );

    setChronicDetail(data?.chronic_diseases ?? "");

    // Medical role
    if (data?.role === "medical") {
      const { data: medicalData } = await supabase
        .from("doctors")
        .select("specialty, department:departments(name)")
        .eq("id", user.id)
        .single();

      setDoctorInfo(
        medicalData as unknown as DoctorInfo,
      );
    } else {
      setDoctorInfo(null);
    }
  }

  // =========================================================
  // Initial load
  // =========================================================

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let active = true;

    setIsLoading(true);
    setError(null);

    loadProfile()
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "โหลดข้อมูลไม่สำเร็จ",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // =========================================================
  // Save personal information
  // =========================================================

  async function handleSavePersonal() {
    if (!user) return;

    setPersonalError(null);

    if (!personalForm.full_name.trim()) {
      setPersonalError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    if (!personalForm.phone.trim()) {
      setPersonalError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (
      role === "patient" &&
      !personalForm.emergency_phone.trim()
    ) {
      setPersonalError("กรุณากรอกเบอร์ติดต่อฉุกเฉิน");
      return;
    }

    setSavingPersonal(true);

    try {
      await updateProfile(user.id, {
        full_name: personalForm.full_name.trim(),
        phone: personalForm.phone.trim(),
        emergency_phone:
          personalForm.emergency_phone.trim() || null,
        address:
          personalForm.address.trim() || null,
      });

      await loadProfile();

      setEditingPersonal(false);
    } catch (err) {
      setPersonalError(
        err instanceof Error
          ? err.message
          : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSavingPersonal(false);
    }
  }

  // =========================================================
  // Save health information
  // =========================================================

  async function handleSaveHealth() {
    if (!user) return;

    setHealthError(null);

    if (
      allergyStatus === "yes" &&
      !allergyDetail.trim()
    ) {
      setHealthError(
        "กรุณากรอกรายละเอียดประวัติแพ้ยา",
      );
      return;
    }

    if (
      chronicStatus === "yes" &&
      !chronicDetail.trim()
    ) {
      setHealthError(
        "กรุณากรอกรายละเอียดโรคประจำตัว",
      );
      return;
    }

    setSavingHealth(true);

    try {
      await updateProfile(user.id, {
        allergy_status: allergyStatus,
        allergies:
          allergyStatus === "yes"
            ? allergyDetail.trim()
            : null,

        chronic_disease_status: chronicStatus,

        chronic_diseases:
          chronicStatus === "yes"
            ? chronicDetail.trim()
            : null,
      });

      await loadProfile();

      setEditingHealth(false);
    } catch (err) {
      setHealthError(
        err instanceof Error
          ? err.message
          : "บันทึกไม่สำเร็จ",
      );
    } finally {
      setSavingHealth(false);
    }
  }

  // =========================================================
  // Loading
  // =========================================================

  if (authLoading || isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-6">
        <div className="mb-5">
          <div className="h-7 w-40 animate-pulse rounded bg-slate-100" />

          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="h-72 animate-pulse rounded-xl border border-slate-100 bg-white" />

          <div className="h-72 animate-pulse rounded-xl border border-slate-100 bg-white" />
        </div>
      </main>
    );
  }

  // =========================================================
  // No user
  // =========================================================

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            กรุณาเข้าสู่ระบบเพื่อดูข้อมูลส่วนตัว
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // Error
  // =========================================================

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
          {error}
        </div>
      </main>
    );
  }

  // =========================================================
  // Helpers
  // =========================================================

  const statusLabel = (
    status: HealthStatus | null | undefined,
  ) => {
    if (status === "yes") return "มี";
    if (status === "no") return "ไม่มี";
    return "ไม่ทราบ";
  };

  // =========================================================
  // Page
  // =========================================================

  return (
    <div
      className="relative min-h-[calc(100vh-80px)] w-screen overflow-x-hidden bg-[#f6fbff]"
      style={{
        marginLeft: "calc(50% - 50vw)",
      }}
    >
      <div className="flex min-h-[calc(100vh-80px)] w-full min-w-0 flex-col lg:flex-row">

        {/* =====================================================
            Sidebar
        ====================================================== */}

        <aside className="w-full shrink-0 border-b border-sky-100 bg-white lg:w-[260px] lg:border-b-0 lg:border-r">
          <nav className="p-3 sm:p-4 lg:sticky lg:top-[80px] lg:p-5">
            <div className="flex gap-2 overflow-x-auto pb-0.5 lg:block lg:space-y-1.5">

              {/* Profile */}

              <div className="flex min-w-max items-center gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 lg:w-full">
                <Users className="size-[18px]" />

                <span>
                  ข้อมูลส่วนตัว
                </span>
              </div>

              {/* Treatment history */}

              <Link
                href="/appointments"
                className="flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 lg:w-full"
              >
                <FileClock className="size-[18px]" />

                <span>
                  ประวัติการรักษา
                </span>
              </Link>

              {/* Results */}

              <Link
                href="/results"
                className="flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 lg:w-full"
              >
                <Stethoscope className="size-[18px]" />

                <span>
                  ผลการตรวจ
                </span>
              </Link>

              {/* Settings */}

              <Link
                href="/settings"
                className="flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 lg:w-full"
              >
                <ShieldCheck className="size-[18px]" />

                <span>
                  ตั้งค่า
                </span>
              </Link>
            </div>
          </nav>
        </aside>

        {/* =====================================================
            Main
        ====================================================== */}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px]">

            {/* Page heading */}

            <div className="mb-6">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-800 sm:text-[24px]">
                ข้อมูลส่วนตัว
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                จัดการข้อมูลส่วนตัวและข้อมูลสุขภาพของคุณ
              </p>
            </div>

            {/* =================================================
                PATIENT
            ================================================== */}

            {role === "patient" ? (
              <>
                {/* =================================================
                    Patient top cards
                ================================================== */}

                <div className="grid w-full min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">

                  {/* =================================================
                      Personal information
                  ================================================== */}

                  <section className="min-w-0 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_3px_14px_rgba(15,77,120,0.05)]">

                    <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-0">

                      <h2 className="text-[18px] font-bold text-slate-800">
                        ข้อมูลส่วนตัว
                      </h2>

                      {!editingPersonal && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingPersonal(true)
                          }
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-600 transition hover:bg-sky-50"
                        >
                          <Pencil className="size-4" />

                          แก้ไขข้อมูล
                        </button>
                      )}
                    </div>

                    {/* =================================================
                        Patient personal edit
                    ================================================== */}

                    {editingPersonal ? (
                      <div className="p-6">

                        {personalError && (
                          <p className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {personalError}
                          </p>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">

                          {/* Name */}

                          <div className="sm:col-span-2">
                            <label className="mb-2 block text-xs font-semibold text-slate-600">
                              ชื่อ-นามสกุล
                            </label>

                            <input
                              value={
                                personalForm.full_name
                              }
                              onChange={(e) =>
                                setPersonalForm({
                                  ...personalForm,
                                  full_name:
                                    e.target.value,
                                })
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                            />
                          </div>

                          {/* Phone */}

                          <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-600">
                              เบอร์โทรศัพท์
                            </label>

                            <input
                              value={
                                personalForm.phone
                              }
                              onChange={(e) =>
                                setPersonalForm({
                                  ...personalForm,
                                  phone:
                                    e.target.value,
                                })
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                            />
                          </div>

                          {/* Emergency */}

                          <div>
                            <label className="mb-2 block text-xs font-semibold text-slate-600">
                              เบอร์ติดต่อฉุกเฉิน *
                            </label>

                            <input
                              value={
                                personalForm.emergency_phone
                              }
                              onChange={(e) =>
                                setPersonalForm({
                                  ...personalForm,
                                  emergency_phone:
                                    e.target.value,
                                })
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                            />
                          </div>

                          {/* Address */}

                          <div className="sm:col-span-2">
                            <label className="mb-2 block text-xs font-semibold text-slate-600">
                              ที่อยู่
                            </label>

                            <textarea
                              value={
                                personalForm.address
                              }
                              onChange={(e) =>
                                setPersonalForm({
                                  ...personalForm,
                                  address:
                                    e.target.value,
                                })
                              }
                              rows={3}
                              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                            />
                          </div>
                        </div>

                        {/* Buttons */}

                        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-5">

                          <button
                            type="button"
                            onClick={
                              handleSavePersonal
                            }
                            disabled={
                              savingPersonal
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                          >
                            {savingPersonal ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}

                            บันทึก
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPersonal(
                                false,
                              );

                              setPersonalError(
                                null,
                              );

                              loadProfile();
                            }}
                            disabled={
                              savingPersonal
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            <X className="size-4" />

                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Patient profile header */}

                        <div className="flex min-w-0 items-center gap-4 px-4 py-5 sm:gap-5 sm:px-6">

                          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-2xl font-semibold text-sky-600 sm:size-[86px] sm:text-[30px]">
                            {profile?.avatar_url ? (
                              <img
                                src={
                                  profile.avatar_url
                                }
                                alt="รูปโปรไฟล์"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              profile?.full_name?.charAt(
                                0,
                              ) ?? "?"
                            )}
                          </div>

                          <div className="min-w-0">

                            <p className="text-[18px] font-bold text-slate-800">
                              {profile?.full_name ||
                                "ไม่ระบุชื่อ"}
                            </p>

                            <span className="mt-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600">
                              {roleLabels[
                                role || ""
                              ] || "ผู้ใช้งาน"}
                            </span>

                            <p className="mt-2 text-sm font-medium text-slate-500">
                              รหัสนักศึกษา:{" "}
                              {profile?.student_id ||
                                "ยังไม่ได้ระบุ"}
                            </p>
                          </div>
                        </div>

                        {/* Patient contact information */}

                        <div className="grid border-t border-slate-100 sm:grid-cols-2">

                          {/* Phone */}

                          <div className="border-b border-slate-100 px-4 py-5 sm:border-r sm:px-6">
                            <div className="flex items-center gap-3">

                              <div className="flex size-9 items-center justify-center rounded-full bg-sky-50">
                                <Phone className="size-4 text-sky-600" />
                              </div>

                              <div>
                                <p className="text-xs text-slate-400">
                                  เบอร์โทรศัพท์
                                </p>

                                <p className="mt-1 text-sm font-medium text-slate-700">
                                  {profile?.phone ||
                                    "ยังไม่ได้ระบุ"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Email */}

                          <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
                            <div className="flex items-center gap-3">

                              <div className="flex size-9 items-center justify-center rounded-full bg-sky-50">
                                <Mail className="size-4 text-sky-600" />
                              </div>

                              <div className="min-w-0">

                                <p className="text-xs text-slate-400">
                                  อีเมล
                                </p>

                                <p className="mt-1 break-all text-sm font-medium text-slate-700">
                                  {user.email || "-"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Emergency phone */}

                          <div className="px-4 py-5 sm:border-r sm:px-6">
                            <div className="flex items-center gap-3">

                              <div className="flex size-9 items-center justify-center rounded-full bg-rose-50">
                                <Phone className="size-4 text-rose-500" />
                              </div>

                              <div>

                                <p className="text-xs text-slate-400">
                                  เบอร์ติดต่อฉุกเฉิน
                                </p>

                                <p className="mt-1 text-sm font-medium text-slate-700">
                                  {profile?.emergency_phone ||
                                    "ยังไม่ได้ระบุ"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Address */}

                          <div className="border-t border-slate-100 px-4 py-5 sm:border-t-0 sm:px-6">

                            <div className="flex items-start gap-3">

                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50">
                                <Users className="size-4 text-sky-600" />
                              </div>

                              <div className="min-w-0">

                                <p className="text-xs text-slate-400">
                                  ที่อยู่
                                </p>

                                <p className="mt-1 text-sm font-medium leading-6 text-slate-700">
                                  {profile?.address ||
                                    "ยังไม่ได้ระบุ"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </section>

                  {/* =================================================
                      Health information
                  ================================================== */}

                  <section className="min-w-0 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_3px_14px_rgba(15,77,120,0.05)]">

                    <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-0">

                      <div>
                        <h2 className="text-[18px] font-bold text-slate-800">
                          ข้อมูลสุขภาพ
                        </h2>

                        <p className="mt-1 text-xs text-slate-400">
                          ข้อมูลสุขภาพที่บันทึกไว้ในระบบ
                        </p>
                      </div>

                      {!editingHealth && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingHealth(true)
                          }
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-600 transition hover:bg-sky-50"
                        >
                          <Pencil className="size-4" />

                          แก้ไขข้อมูล
                        </button>
                      )}
                    </div>

                    {/* Health edit */}

                    {editingHealth ? (
                      <div className="space-y-6 p-6">

                        {healthError && (
                          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {healthError}
                          </p>
                        )}

                        {/* Allergy */}

                        <div>

                          <p className="mb-3 text-sm font-semibold text-slate-700">
                            ประวัติแพ้ยา
                          </p>

                          <div className="flex flex-wrap gap-2">

                            {(
                              [
                                "yes",
                                "no",
                                "unknown",
                              ] as HealthStatus[]
                            ).map((s) => (
                              <label
                                key={s}
                                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm transition ${
                                  allergyStatus === s
                                    ? "border-sky-300 bg-sky-50 font-semibold text-sky-600"
                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="allergyStatus"
                                  checked={
                                    allergyStatus ===
                                    s
                                  }
                                  onChange={() =>
                                    setAllergyStatus(
                                      s,
                                    )
                                  }
                                  className="sr-only"
                                />

                                {s === "yes"
                                  ? "มี"
                                  : s === "no"
                                    ? "ไม่มี"
                                    : "ไม่ทราบ"}
                              </label>
                            ))}
                          </div>

                          {allergyStatus === "yes" && (
                            <textarea
                              value={allergyDetail}
                              onChange={(e) =>
                                setAllergyDetail(
                                  e.target.value,
                                )
                              }
                              placeholder="ระบุรายละเอียดประวัติแพ้ยา"
                              rows={3}
                              className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                            />
                          )}
                        </div>

                        {/* Chronic disease */}

                        <div>

                          <p className="mb-3 text-sm font-semibold text-slate-700">
                            โรคประจำตัว
                          </p>

                          <div className="flex flex-wrap gap-2">

                            {(
                              [
                                "yes",
                                "no",
                                "unknown",
                              ] as HealthStatus[]
                            ).map((s) => (
                              <label
                                key={s}
                                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm transition ${
                                  chronicStatus === s
                                    ? "border-sky-300 bg-sky-50 font-semibold text-sky-600"
                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="chronicStatus"
                                  checked={
                                    chronicStatus ===
                                    s
                                  }
                                  onChange={() =>
                                    setChronicStatus(
                                      s,
                                    )
                                  }
                                  className="sr-only"
                                />

                                {s === "yes"
                                  ? "มี"
                                  : s === "no"
                                    ? "ไม่มี"
                                    : "ไม่ทราบ"}
                              </label>
                            ))}
                          </div>

                          {chronicStatus === "yes" && (
                            <textarea
                              value={chronicDetail}
                              onChange={(e) =>
                                setChronicDetail(
                                  e.target.value,
                                )
                              }
                              placeholder="ระบุรายละเอียดโรคประจำตัว"
                              rows={3}
                              className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                            />
                          )}
                        </div>

                        {/* Health buttons */}

                        <div className="flex gap-2 border-t border-slate-100 pt-5">

                          <button
                            type="button"
                            onClick={
                              handleSaveHealth
                            }
                            disabled={savingHealth}
                            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                          >
                            {savingHealth ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}

                            บันทึก
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingHealth(false);
                              setHealthError(null);
                              loadProfile();
                            }}
                            disabled={savingHealth}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            <X className="size-4" />

                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5">

                        <div className="grid gap-4 sm:grid-cols-2">

                          {/* Allergy tile */}

                          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between gap-3">

                              <div className="flex size-11 items-center justify-center rounded-xl bg-rose-50">
                                <HeartPulse className="size-5 text-rose-500" />
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  profile?.allergy_status ===
                                  "yes"
                                    ? "bg-rose-50 text-rose-600"
                                    : profile?.allergy_status ===
                                        "no"
                                      ? "bg-emerald-50 text-emerald-600"
                                      : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {statusLabel(
                                  profile?.allergy_status as HealthStatus,
                                )}
                              </span>
                            </div>

                            <p className="mt-5 text-sm font-semibold text-slate-700">
                              ประวัติแพ้ยา
                            </p>

                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              {profile?.allergy_status ===
                                "yes" &&
                              profile?.allergies
                                ? profile.allergies
                                : profile?.allergy_status ===
                                    "no"
                                  ? "ไม่มีประวัติแพ้ยาที่ระบุ"
                                  : "ยังไม่ได้ระบุข้อมูล"}
                            </p>
                          </div>

                          {/* Chronic disease tile */}

                          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between gap-3">

                              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-50">
                                <AlertCircle className="size-5 text-sky-600" />
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  profile?.chronic_disease_status ===
                                  "yes"
                                    ? "bg-amber-50 text-amber-600"
                                    : profile?.chronic_disease_status ===
                                        "no"
                                      ? "bg-emerald-50 text-emerald-600"
                                      : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {statusLabel(
                                  profile?.chronic_disease_status as HealthStatus,
                                )}
                              </span>
                            </div>

                            <p className="mt-5 text-sm font-semibold text-slate-700">
                              โรคประจำตัว
                            </p>

                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              {profile?.chronic_disease_status ===
                                "yes" &&
                              profile?.chronic_diseases
                                ? profile.chronic_diseases
                                : profile?.chronic_disease_status ===
                                    "no"
                                  ? "ไม่มีโรคประจำตัวที่ระบุ"
                                  : "ยังไม่ได้ระบุข้อมูล"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                {/* =================================================
                    Recent treatment
                ================================================== */}

                <section className="mt-5 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_3px_14px_rgba(15,77,120,0.05)]">

                  <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-0">

                    <div className="flex items-center gap-3">

                      <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50">
                        <FileClock className="size-5 text-sky-600" />
                      </div>

                      <h2 className="text-[18px] font-bold text-slate-800">
                        ประวัติการรักษาล่าสุด
                      </h2>
                    </div>

                    <span className="text-xs text-sky-600">
                      ดูทั้งหมด ›
                    </span>
                  </div>

                  <div className="p-5">

                    <div className="flex min-h-[190px] items-center justify-center rounded-2xl bg-[#f8fcff] text-center">

                      <div>

                        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-sky-50">
                          <FileClock className="size-7 text-sky-500" />
                        </div>

                        <p className="mt-4 text-sm font-semibold text-slate-700">
                          ยังไม่มีประวัติการรักษาล่าสุด
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          เมื่อมีการรักษา ข้อมูลจะแสดงที่นี่
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              /* =====================================================
                 STAFF_ADMIN / MEDICAL
              ====================================================== */

              <div className="space-y-5">

                {/* =================================================
                    Staff / Medical personal information
                ================================================== */}

                <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_3px_14px_rgba(15,77,120,0.05)]">

                  <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-0">

                    <h2 className="text-[18px] font-bold text-slate-800">
                      ข้อมูลส่วนตัว
                    </h2>

                    {!editingPersonal && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingPersonal(true)
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-xs font-semibold text-sky-600 transition hover:bg-sky-50"
                      >
                        <Pencil className="size-4" />

                        แก้ไขข้อมูล
                      </button>
                    )}
                  </div>

                  {/* =================================================
                      Staff / Medical edit
                  ================================================== */}

                  {editingPersonal ? (
                    <div className="p-6">

                      {personalError && (
                        <p className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                          {personalError}
                        </p>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">

                        {/* Full name */}

                        <div className="sm:col-span-2">

                          <label className="mb-2 block text-xs font-semibold text-slate-600">
                            ชื่อ-นามสกุล
                          </label>

                          <input
                            value={
                              personalForm.full_name
                            }
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                full_name:
                                  e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                          />
                        </div>

                        {/* Phone */}

                        <div>

                          <label className="mb-2 block text-xs font-semibold text-slate-600">
                            เบอร์โทรศัพท์
                          </label>

                          <input
                            value={
                              personalForm.phone
                            }
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                phone:
                                  e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                          />
                        </div>

                        {/* Address */}

                        <div>

                          <label className="mb-2 block text-xs font-semibold text-slate-600">
                            ที่อยู่
                          </label>

                          <input
                            value={
                              personalForm.address
                            }
                            onChange={(e) =>
                              setPersonalForm({
                                ...personalForm,
                                address:
                                  e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2 border-t border-slate-100 pt-5">

                        <button
                          type="button"
                          onClick={
                            handleSavePersonal
                          }
                          disabled={
                            savingPersonal
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                        >
                          {savingPersonal ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}

                          บันทึก
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPersonal(false);
                            setPersonalError(null);
                            loadProfile();
                          }}
                          disabled={savingPersonal}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          <X className="size-4" />

                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6">

                      {/* Profile identity */}

                      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">

                        {/* Avatar */}

                        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-2xl font-semibold text-sky-600 sm:size-24 sm:text-3xl">

                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt="รูปโปรไฟล์"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            profile?.full_name?.charAt(
                              0,
                            ) ?? "?"
                          )}
                        </div>

                        {/* Identity */}

                        <div className="min-w-0">

                          <p className="text-xl font-bold text-slate-800">
                            {profile?.full_name ||
                              "ไม่ระบุชื่อ"}
                          </p>

                          <span className="mt-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600">
                            {roleLabels[
                              role || ""
                            ] || "ผู้ใช้งาน"}
                          </span>

                          {/* Staff ID */}

                          {role === "staff_admin" && (
                            <p className="mt-2 text-sm font-medium text-slate-500">
                              รหัสเจ้าหน้าที่:{" "}
                              {profile?.employee_id ||
                                "ยังไม่ได้ระบุ"}
                            </p>
                          )}

                          {/* Medical ID */}

                          {role === "medical" && (
                            <p className="mt-2 text-sm font-medium text-slate-500">
                              รหัสบุคลากร:{" "}
                              {profile?.employee_id ||
                                "ยังไม่ได้ระบุ"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* =================================================
                          Contact tiles
                      ================================================== */}

                      <div className="mt-6 grid border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-3">

                        {/* Phone */}

                        <div className="border-b border-slate-100 py-4 sm:pr-5 lg:border-r">

                          <div className="flex items-center gap-3">

                            <div className="flex size-9 items-center justify-center rounded-full bg-sky-50">
                              <Phone className="size-4 text-sky-600" />
                            </div>

                            <div>
                              <p className="text-xs text-slate-400">
                                เบอร์โทรศัพท์
                              </p>

                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {profile?.phone ||
                                  "ยังไม่ได้ระบุ"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Email */}

                        <div className="border-b border-slate-100 py-4 sm:pl-5 lg:border-r lg:px-5">

                          <div className="flex items-center gap-3">

                            <div className="flex size-9 items-center justify-center rounded-full bg-sky-50">
                              <Mail className="size-4 text-sky-600" />
                            </div>

                            <div className="min-w-0">

                              <p className="text-xs text-slate-400">
                                อีเมล
                              </p>

                              <p className="mt-2 break-all text-sm font-medium text-slate-700">
                                {user.email || "-"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Address */}

                        <div className="py-4 sm:col-span-2 lg:col-span-1 lg:pl-5">

                          <div className="flex items-start gap-3">

                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50">
                              <Users className="size-4 text-sky-600" />
                            </div>

                            <div className="min-w-0">

                              <p className="text-xs text-slate-400">
                                ที่อยู่
                              </p>

                              <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                                {profile?.address ||
                                  "ยังไม่ได้ระบุ"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* =================================================
                    Medical work information
                ================================================== */}

                {role === "medical" && (
                  <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_3px_14px_rgba(15,77,120,0.05)]">

                    <div className="border-b border-slate-100 px-6 py-4">

                      <h2 className="text-[18px] font-bold text-slate-800">
                        ข้อมูลการปฏิบัติงาน
                      </h2>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2">

                      {/* Specialty */}

                      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                        <p className="text-xs text-slate-400">
                          ความเชี่ยวชาญ
                        </p>

                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {doctorInfo?.specialty ||
                            "ยังไม่ได้ระบุ"}
                        </p>
                      </div>

                      {/* Department */}

                      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                        <p className="text-xs text-slate-400">
                          แผนก
                        </p>

                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {doctorInfo?.department?.name ||
                            "ยังไม่ได้ระบุ"}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* =================================================
                    Staff/Admin management
                ================================================== */}

                {role === "staff_admin" && (
                  <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_3px_14px_rgba(15,77,120,0.05)]">

                    <div className="border-b border-slate-100 px-6 py-4">

                      <h2 className="text-[18px] font-bold text-slate-800">
                        งานบริหารจัดการ
                      </h2>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2">

                      {/* Schedules */}

                      <Link
                        href="/schedules"
                        className="rounded-2xl border border-slate-100 p-5 transition hover:border-sky-200 hover:bg-sky-50/50"
                      >
                        <p className="text-sm font-semibold text-slate-700">
                          ตารางแพทย์
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          จัดการรอบตรวจและวันลาแพทย์
                        </p>
                      </Link>

                      {/* Departments */}

                      <Link
                        href="/departments"
                        className="rounded-2xl border border-slate-100 p-5 transition hover:border-sky-200 hover:bg-sky-50/50"
                      >
                        <p className="text-sm font-semibold text-slate-700">
                          จัดการแผนก
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          เพิ่ม/แก้ไขแผนกการรักษา
                        </p>
                      </Link>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}