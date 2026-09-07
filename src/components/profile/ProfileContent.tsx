"use client";

import { startTransition, useEffect, useState } from "react";
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
  Pill,
  ShieldCheck,
  X,
  Check,
  Loader2,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  patient: "ผู้ป่วย",
  medical: "แพทย์/เภสัชกร",
  staff_admin: "เจ้าหน้าที่/แอดมิน",
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

  // --- Edit: ข้อมูลส่วนตัว ---
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    full_name: "",
    phone: "",
    emergency_phone: "",
    address: "",
  });
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // --- Edit: ข้อมูลสุขภาพ ---
  const [editingHealth, setEditingHealth] = useState(false);
  const [allergyStatus, setAllergyStatus] = useState<HealthStatus>("unknown");
  const [allergyDetail, setAllergyDetail] = useState("");
  const [chronicStatus, setChronicStatus] = useState<HealthStatus>("unknown");
  const [chronicDetail, setChronicDetail] = useState("");
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

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

    setAllergyStatus((data?.allergy_status as HealthStatus) ?? "unknown");
    setAllergyDetail(data?.allergies ?? "");
    setChronicStatus(
      (data?.chronic_disease_status as HealthStatus) ?? "unknown",
    );
    setChronicDetail(data?.chronic_diseases ?? "");

    if (data?.role === "medical") {
      const { data: doctorData } = await supabase
        .from("doctors")
        .select("specialty, department:departments(name)")
        .eq("id", user.id)
        .single();
      setDoctorInfo(doctorData as unknown as DoctorInfo);
    }
  }

  useEffect(() => {
    if (!user) {
      const timer = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    startTransition(() => setIsLoading(true));
    // The async loader synchronizes this component with the authenticated profile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile()
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    if (role === "patient" && !personalForm.emergency_phone.trim()) {
      setPersonalError("กรุณากรอกเบอร์ติดต่อฉุกเฉิน");
      return;
    }

    setSavingPersonal(true);
    try {
      await updateProfile(user.id, {
        full_name: personalForm.full_name.trim(),
        phone: personalForm.phone.trim(),
        emergency_phone: personalForm.emergency_phone.trim() || null,
        address: personalForm.address.trim() || null,
      });
      await loadProfile();
      setEditingPersonal(false);
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleSaveHealth() {
    if (!user) return;
    setHealthError(null);

    if (allergyStatus === "yes" && !allergyDetail.trim()) {
      setHealthError("กรุณากรอกรายละเอียดประวัติแพ้ยา");
      return;
    }
    if (chronicStatus === "yes" && !chronicDetail.trim()) {
      setHealthError("กรุณากรอกรายละเอียดโรคประจำตัว");
      return;
    }

    setSavingHealth(true);
    try {
      await updateProfile(user.id, {
        allergy_status: allergyStatus,
        allergies: allergyStatus === "yes" ? allergyDetail.trim() : null,
        chronic_disease_status: chronicStatus,
        chronic_diseases: chronicStatus === "yes" ? chronicDetail.trim() : null,
      });
      await loadProfile();
      setEditingHealth(false);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingHealth(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-zinc-500">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-zinc-500">กรุณาเข้าสู่ระบบก่อนดูข้อมูลส่วนตัว</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const role = profile?.role;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">ข้อมูลส่วนตัว</h1>

      {/* ===== การ์ดข้อมูลส่วนตัว ===== */}
      <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xl font-semibold shrink-0">
              {profile?.full_name?.charAt(0) ?? "?"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                {profile?.full_name}
              </h2>
              <p className="text-sm text-zinc-500">
                {roleLabels[role ?? ""] ?? role}
              </p>
            </div>
          </div>
          {!editingPersonal && (
            <button
              onClick={() => setEditingPersonal(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-50 transition"
            >
              <Pencil className="size-3.5" />
              แก้ไขข้อมูล
            </button>
          )}
        </div>

        {editingPersonal ? (
          <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4">
            {personalError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {personalError}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                ชื่อ-นามสกุล
              </label>
              <input
                value={personalForm.full_name}
                onChange={(e) =>
                  setPersonalForm({
                    ...personalForm,
                    full_name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                value={personalForm.phone}
                onChange={(e) =>
                  setPersonalForm({ ...personalForm, phone: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            {role === "patient" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  เบอร์ติดต่อฉุกเฉิน<span className="text-red-500"> *</span>
                </label>
                <input
                  value={personalForm.emergency_phone}
                  onChange={(e) =>
                    setPersonalForm({
                      ...personalForm,
                      emergency_phone: e.target.value,
                    })
                  }
                  placeholder="08X-XXX-XXXX"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                ที่อยู่
              </label>
              <textarea
                value={personalForm.address}
                onChange={(e) =>
                  setPersonalForm({ ...personalForm, address: e.target.value })
                }
                placeholder="ไม่บังคับ"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSavePersonal}
                disabled={savingPersonal}
                className="inline-flex items-center gap-1.5 bg-sky-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sky-600 transition disabled:opacity-60"
              >
                {savingPersonal ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                บันทึก
              </button>
              <button
                onClick={() => {
                  setEditingPersonal(false);
                  setPersonalError(null);
                  loadProfile();
                }}
                disabled={savingPersonal}
                className="inline-flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-50 transition"
              >
                <X className="size-4" />
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Phone className="size-4 text-zinc-400" />
              {profile?.phone || "ยังไม่ได้กรอกเบอร์โทรศัพท์"}
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Mail className="size-4 text-zinc-400" />
              {user.email}
            </div>
            {profile?.emergency_phone && (
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Phone className="size-4 text-rose-400" />
                ฉุกเฉิน: {profile.emergency_phone}
              </div>
            )}
            {profile?.address && (
              <p className="text-sm text-zinc-700">📍 {profile.address}</p>
            )}
          </div>
        )}
      </section>

      {/* ===== เนื้อหาต่างกันตาม role ===== */}

      {role === "patient" && (
        <>
          <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <HeartPulse className="size-5 text-sky-500" />
                ข้อมูลสุขภาพ
              </h2>
              {!editingHealth && (
                <button
                  onClick={() => setEditingHealth(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-50 transition"
                >
                  <Pencil className="size-3.5" />
                  แก้ไขข้อมูล
                </button>
              )}
            </div>

            {editingHealth ? (
              <div className="space-y-5">
                {healthError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {healthError}
                  </p>
                )}
                {/* ประวัติแพ้ยา */}
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">
                    ประวัติแพ้ยา
                  </p>
                  <div className="flex gap-4 mb-2">
                    {(["yes", "no", "unknown"] as HealthStatus[]).map((s) => (
                      <label
                        key={s}
                        className="flex items-center gap-1.5 text-sm text-zinc-700"
                      >
                        <input
                          type="radio"
                          name="allergyStatus"
                          checked={allergyStatus === s}
                          onChange={() => setAllergyStatus(s)}
                        />
                        {s === "yes" ? "มี" : s === "no" ? "ไม่มี" : "ไม่ทราบ"}
                      </label>
                    ))}
                  </div>
                  {allergyStatus === "yes" && (
                    <textarea
                      value={allergyDetail}
                      onChange={(e) => setAllergyDetail(e.target.value)}
                      placeholder="ระบุรายละเอียด เช่น แพ้เพนิซิลลิน"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-none"
                    />
                  )}
                </div>

                {/* โรคประจำตัว */}
                <div>
                  <p className="text-sm font-medium text-zinc-700 mb-2">
                    โรคประจำตัว
                  </p>
                  <div className="flex gap-4 mb-2">
                    {(["yes", "no", "unknown"] as HealthStatus[]).map((s) => (
                      <label
                        key={s}
                        className="flex items-center gap-1.5 text-sm text-zinc-700"
                      >
                        <input
                          type="radio"
                          name="chronicStatus"
                          checked={chronicStatus === s}
                          onChange={() => setChronicStatus(s)}
                        />
                        {s === "yes" ? "มี" : s === "no" ? "ไม่มี" : "ไม่ทราบ"}
                      </label>
                    ))}
                  </div>
                  {chronicStatus === "yes" && (
                    <textarea
                      value={chronicDetail}
                      onChange={(e) => setChronicDetail(e.target.value)}
                      placeholder="ระบุรายละเอียด เช่น เบาหวาน ความดันโลหิตสูง"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-none"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveHealth}
                    disabled={savingHealth}
                    className="inline-flex items-center gap-1.5 bg-sky-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sky-600 transition disabled:opacity-60"
                  >
                    {savingHealth ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    บันทึก
                  </button>
                  <button
                    onClick={() => {
                      setEditingHealth(false);
                      setHealthError(null);
                      loadProfile();
                    }}
                    disabled={savingHealth}
                    className="inline-flex items-center gap-1.5 border border-zinc-200 text-zinc-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-50 transition"
                  >
                    <X className="size-4" />
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="size-3.5" /> ประวัติแพ้ยา
                  </p>
                  <p className="text-sm text-zinc-700">
                    {profile?.allergies || "ไม่มีข้อมูล"}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                  <p className="text-xs font-medium text-rose-700 flex items-center gap-1.5 mb-1">
                    <HeartPulse className="size-3.5" /> โรคประจำตัว
                  </p>
                  <p className="text-sm text-zinc-700">
                    {profile?.chronic_diseases || "ไม่มีข้อมูล"}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 mb-4">
              <FileClock className="size-5 text-sky-500" />
              ประวัติการรักษาล่าสุด
            </h2>
            <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-6 text-center">
              <p className="text-sm text-zinc-500">รอเชื่อมต่อกับระบบนัดหมาย</p>
              <p className="text-xs text-zinc-400 mt-1">
                📋 ส่วนนี้ดึงข้อมูลจากงานของ ปาย
              </p>
            </div>
          </section>
        </>
      )}

      {role === "medical" && (
        <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 mb-4">
            <Stethoscope className="size-5 text-emerald-500" />
            งานแพทย์และเภสัชกรรม
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-medium text-emerald-700 mb-1">ความเชี่ยวชาญ</p>
              <p className="text-sm text-zinc-700">{doctorInfo?.specialty || "งานจ่ายยา/งานแพทย์"}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-medium text-emerald-700 mb-1">แผนก</p>
              <p className="text-sm text-zinc-700">{doctorInfo?.department?.name || "คลังยาและจ่ายยา"}</p>
            </div>
            <Link href="/pharmacy" className="rounded-xl bg-violet-50 border border-violet-100 p-4 hover:border-violet-300 transition">
              <p className="text-xs font-medium text-violet-700 mb-1 flex items-center gap-1"><Pill className="size-3.5" />คลังยา</p>
              <p className="text-sm text-zinc-700">ตรวจสต๊อกและจ่ายยาเต็มครั้งเดียว</p>
            </Link>
          </div>
        </section>
      )}

      {role === "staff_admin" && (
        <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 mb-4">
            <ShieldCheck className="size-5 text-indigo-500" />
            งานเจ้าหน้าที่และผู้ดูแลระบบ
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/schedules" className="rounded-xl bg-amber-50 border border-amber-100 p-4 hover:border-amber-300 transition"><p className="text-sm font-medium text-amber-700 mb-1">ตารางแพทย์</p><p className="text-xs text-zinc-500">จัดการรอบตรวจและวันลาแพทย์</p></Link>
            <Link href="/departments" className="rounded-xl bg-amber-50 border border-amber-100 p-4 hover:border-amber-300 transition"><p className="text-sm font-medium text-amber-700 mb-1">จัดการแผนก</p><p className="text-xs text-zinc-500">เพิ่ม/แก้ไขแผนกการรักษา</p></Link>
            <Link href="/appointments" className="rounded-xl bg-amber-50 border border-amber-100 p-4 hover:border-amber-300 transition"><p className="text-sm font-medium text-amber-700 mb-1">นัดหมาย</p><p className="text-xs text-zinc-500">อนุมัติและจัดการนัดด้วยมือ</p></Link>
            <Link href="/dashboard" className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 hover:border-indigo-300 transition"><p className="text-sm font-medium text-indigo-700 mb-1">Dashboard/Broadcast</p><p className="text-xs text-zinc-500">ดูภาพรวมและส่งประกาศ</p></Link>
          </div>
        </section>
      )}
    </div>
  );
}
