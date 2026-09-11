"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { roleLabels } from "@/features/dashboard/types";
import {
  deleteStaffProfile,
  getStaffProfileDirectory,
  updateStaffProfile,
  type StaffProfileDirectoryItem,
} from "@/services/dashboardService";
import type { UserRole } from "@/types/database";

const roleOrder: UserRole[] = ["patient", "medical", "staff_admin"];
type ProfileSort = "name-th" | "name-en" | "registered-asc" | "registered-desc";
type ProfileFilter = UserRole | "all" | "suspended";
type AccountAction =
  | { kind: "toggle"; profile: StaffProfileDirectoryItem; nextActive: boolean }
  | { kind: "hard-delete"; profile: StaffProfileDirectoryItem };

function displayValue(value: string | null): string {
  return value?.trim() || "ไม่ระบุ";
}

function summaryCardClass(isSelected: boolean): string {
  return `border-b-2 px-1 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${isSelected ? "border-brand-strong text-brand-strong" : "border-transparent text-brand-ink hover:border-brand-border-soft"}`;
}

export default function StaffProfileDirectory() {
  const [profiles, setProfiles] = useState<StaffProfileDirectoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<ProfileFilter>("all");
  const [sortBy, setSortBy] = useState<ProfileSort>("name-th");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] =
    useState<StaffProfileDirectoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    role: "patient" as UserRole,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function openEdit(profile: StaffProfileDirectoryItem) {
    setEditingProfile(profile);
    setEditForm({
      fullName: profile.fullName,
      phone: profile.phone ?? "",
      role: profile.role,
    });
    setSaveError(null);
  }

  function closeEdit() {
    if (saving) return;
    setEditingProfile(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!editingProfile) return;
    if (!editForm.fullName.trim()) {
      setSaveError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateStaffProfile(editingProfile.id, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        isActive: editingProfile.isActive,
      });
      await loadProfiles(true);
      setEditingProfile(null);
      setToast("บันทึกการเปลี่ยนแปลงแล้ว");
    } catch (saveProfileError) {
      setSaveError(
        saveProfileError instanceof Error
          ? saveProfileError.message
          : "บันทึกข้อมูลไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  const loadProfiles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setProfiles(await getStaffProfileDirectory());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "โหลดข้อมูลบัญชีไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfiles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfiles]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    const result: Record<UserRole, number> = {
      patient: 0,
      medical: 0,
      staff_admin: 0,
    };
    profiles.forEach((profile) => {
      result[profile.role] += 1;
    });
    return result;
  }, [profiles]);

  const suspendedCount = useMemo(
    () => profiles.filter((profile) => !profile.isActive).length,
    [profiles],
  );

  const filteredProfiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return profiles
      .filter((profile) => {
        if (roleFilter === "suspended" && profile.isActive) return false;
        if (
          roleFilter !== "all" &&
          roleFilter !== "suspended" &&
          profile.role !== roleFilter
        )
          return false;
        if (!normalizedQuery) return true;
        return [
          profile.fullName,
          profile.email ?? "",
          profile.phone ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sortBy === "registered-asc" || sortBy === "registered-desc") {
          const aTime = Date.parse(a.createdAt);
          const bTime = Date.parse(b.createdAt);
          const registrationOrder =
            sortBy === "registered-asc" ? aTime - bTime : bTime - aTime;
          if (registrationOrder !== 0) return registrationOrder;
        } else {
          const locale = sortBy === "name-th" ? "th" : "en";
          const nameOrder = a.fullName.localeCompare(b.fullName, locale, {
            sensitivity: "base",
          });
          if (nameOrder !== 0) return nameOrder;
        }
        return Number(b.isActive) - Number(a.isActive);
      });
  }, [profiles, query, roleFilter, sortBy]);

  async function confirmAccountAction() {
    if (!accountAction) return;
    const { profile } = accountAction;
    setActionSaving(true);
    setError(null);
    try {
      if (accountAction.kind === "hard-delete") {
        await deleteStaffProfile(profile.id);
      } else {
        await updateStaffProfile(profile.id, {
          fullName: profile.fullName,
          phone: profile.phone,
          role: profile.role,
          isActive: accountAction.nextActive,
        });
      }
      await loadProfiles(true);
      setAccountAction(null);
      setToast(
        accountAction.kind === "hard-delete"
          ? "ลบบัญชีถาวรเรียบร้อยแล้ว"
          : accountAction.nextActive
            ? "กู้คืนบัญชีเรียบร้อยแล้ว"
            : "ระงับบัญชีเรียบร้อยแล้ว",
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : accountAction.kind === "hard-delete"
            ? "ลบบัญชีถาวรไม่สำเร็จ"
            : accountAction.nextActive
              ? "กู้คืนบัญชีไม่สำเร็จ"
              : "ระงับบัญชีไม่สำเร็จ",
      );
      setAccountAction(null);
    } finally {
      setActionSaving(false);
    }
  }

  const isHardDeleteAction = accountAction?.kind === "hard-delete";
  const isRestoringAction =
    accountAction?.kind === "toggle" && accountAction.nextActive;

  return (
    <main className="dashboard-shell mx-auto flex max-w-7xl flex-col gap-10 pb-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
            บัญชีผู้ใช้งานทั้งหมด
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            จัดการข้อมูลติดต่อ บทบาท และสถานะการใช้งานของบัญชีในระบบ
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadProfiles(true)}
          disabled={loading || refreshing}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />{" "}
          รีเฟรช
        </button>
      </header>

      <section
        className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="สรุปจำนวนบัญชี"
      >
        <button
          type="button"
          onClick={() => setRoleFilter("all")}
          aria-pressed={roleFilter === "all"}
          className={summaryCardClass(roleFilter === "all")}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-800">บัญชีทั้งหมด</p>
            <Users className="size-5 text-sky-600" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-950">
            {profiles.length}
          </p>
        </button>
        {roleOrder.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            aria-pressed={roleFilter === role}
            className={summaryCardClass(roleFilter === role)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{role}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {roleLabels[role]}
                </p>
              </div>
              <UserRound className="size-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {counts[role]}
            </p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRoleFilter("suspended")}
          aria-pressed={roleFilter === "suspended"}
          className={summaryCardClass(roleFilter === "suspended")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">บัญชีที่ถูกระงับ</p>
              <p className="mt-0.5 text-xs text-slate-400">
                ไม่สามารถเข้าสู่ระบบได้
              </p>
            </div>
            <UserRound className="size-5 text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-950">
            {suspendedCount}
          </p>
        </button>
      </section>

      <section className="overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-brand-border-soft pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-brand-ink">รายชื่อบัญชี</h2>
            <p className="mt-1 text-sm text-brand-muted">
              แสดง {filteredProfiles.length} จาก {profiles.length} บัญชี
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="relative block sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-body"
                aria-hidden="true"
              />
              <span className="sr-only">ค้นหาบัญชี</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
                className="h-11 w-full rounded-lg border border-brand-border-strong bg-transparent py-2.5 pl-9 pr-3 text-sm text-brand-ink outline-none transition placeholder:text-brand-muted focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
              />
            </label>
            <label className="sr-only" htmlFor="role-filter">
              กรองตาม role
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as ProfileFilter)
              }
              className="h-11 rounded-lg border border-brand-border-strong bg-transparent px-3 text-sm text-brand-ink outline-none transition focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
            >
              <option value="all">บัญชีทั้งหมด</option>
              <option value="suspended">บัญชีที่ถูกระงับ</option>
              {roleOrder.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="profile-sort">
              เรียงลำดับบัญชี
            </label>
            <select
              id="profile-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ProfileSort)}
              className="h-11 rounded-lg border border-brand-border-strong bg-transparent px-3 text-sm text-brand-ink outline-none transition focus:border-brand-strong focus:ring-2 focus:ring-brand-soft"
            >
              <option value="name-th">เรียงตาม ก-ฮ</option>
              <option value="name-en">เรียงตาม A-Z</option>
              <option value="registered-asc">เรียงตามสมัครเก่าสุด</option>
              <option value="registered-desc">เรียงตามสมัครล่าสุด</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 py-10 text-sm text-brand-muted">
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            กำลังโหลดข้อมูลบัญชี…
          </div>
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadProfiles()}
              className="rounded-lg border border-brand-border-strong px-3 py-2 text-sm font-medium text-brand-strong hover:border-brand-strong hover:bg-brand-soft"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center py-10 text-sm text-brand-muted">
            ไม่พบบัญชีตามเงื่อนไขที่เลือก
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-brand-border-soft text-xs font-semibold text-brand-muted">
                <tr>
                  <th className="w-16 py-4 pr-5">ลำดับ</th>
                  <th className="py-4 pr-5">ชื่อ</th>
                  <th className="py-4 pr-5">อีเมล</th>
                  <th className="py-4 pr-5">เบอร์โทรศัพท์</th>
                  <th className="py-4 pr-5">role</th>
                  <th className="py-4">จัดการบัญชี</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border-soft">
                {filteredProfiles.map((profile, index) => (
                  <tr
                    key={profile.id}
                    className={`transition-colors ${profile.isActive ? "text-brand-body" : "text-brand-muted grayscale"}`}
                  >
                    <td className="py-5 pr-5 text-brand-muted">{index + 1}</td>
                    <td
                      className={`py-5 pr-5 font-medium ${profile.isActive ? "text-brand-ink" : "line-through"}`}
                    >
                      {displayValue(profile.fullName)}
                    </td>
                    <td className="py-5 pr-5">
                      <span className="inline-flex items-center gap-2">
                        <Mail
                          className="size-4 text-brand-muted"
                          aria-hidden="true"
                        />
                        {displayValue(profile.email)}
                      </span>
                    </td>
                    <td className="py-5 pr-5">
                      <span className="inline-flex items-center gap-2">
                        <Phone
                          className="size-4 text-brand-muted"
                          aria-hidden="true"
                        />
                        {displayValue(profile.phone)}
                      </span>
                    </td>
                    <td className="py-5 pr-5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${profile.isActive ? "text-brand-strong" : "text-brand-muted"}`}
                      >
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        {profile.role}
                      </span>
                      <span
                        className="mt-1 block text-xs text-brand-muted"
                      >
                        {roleLabels[profile.role]} ·{" "}
                        {profile.isActive ? "ใช้งานอยู่" : "ระงับบัญชี"}
                      </span>
                    </td>
                    <td className="py-5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(profile)}
                          aria-label="แก้ไขข้อมูลผู้ใช้"
                          title="แก้ไขข้อมูลผู้ใช้"
                          className="inline-flex size-10 items-center justify-center rounded-lg border border-brand-border-strong bg-transparent text-brand-strong transition hover:border-brand-strong hover:bg-brand-soft"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={profile.isActive}
                          aria-label={
                            profile.isActive
                              ? "ระงับการใช้งานบัญชี"
                              : "เปิดใช้งานบัญชี"
                          }
                          onClick={() =>
                            setAccountAction({
                              kind: "toggle",
                              profile,
                              nextActive: !profile.isActive,
                            })
                          }
                          title={
                            profile.isActive
                              ? "ระงับการใช้งานบัญชี"
                              : "เปิดใช้งานบัญชี"
                          }
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong ${profile.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`size-6 rounded-full bg-white shadow-sm transition-transform ${profile.isActive ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </button>
                        {roleFilter === "suspended" && !profile.isActive && (
                          <button
                            type="button"
                            onClick={() =>
                              setAccountAction({ kind: "hard-delete", profile })
                            }
                            aria-label="ลบบัญชีถาวร"
                            title="ลบบัญชีถาวร"
                            className="inline-flex size-10 items-center justify-center rounded-lg border border-rose-200 bg-transparent text-rose-600 transition hover:bg-rose-50"
                          >
                            <Trash2 className="size-5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {accountAction && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-action-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionSaving)
              setAccountAction(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div
              className={`mx-auto flex size-14 items-center justify-center rounded-full ${isRestoringAction ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}
            >
              {isHardDeleteAction ? (
                <Trash2 className="size-7" aria-hidden="true" />
              ) : isRestoringAction ? (
                <RotateCcw className="size-7" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-7" aria-hidden="true" />
              )}
            </div>
            <div className="mt-5 text-center">
              <h2
                id="account-action-title"
                className="text-xl font-bold text-slate-950"
              >
                {isHardDeleteAction
                  ? "ลบบัญชีถาวร?"
                  : isRestoringAction
                    ? "กู้คืนบัญชีนี้?"
                    : "ระงับบัญชีนี้?"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                บัญชี “{accountAction.profile.fullName}”{" "}
                {isHardDeleteAction
                  ? "จะถูกลบถาวรออกจากระบบและไม่สามารถกู้คืนได้"
                  : isRestoringAction
                    ? "จะสามารถกลับมาเข้าสู่ระบบได้อีกครั้ง"
                    : "จะถูกระงับและไม่สามารถเข้าสู่ระบบได้"}
              </p>
              {isHardDeleteAction ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  การลบถาวรจะไม่สามารถย้อนกลับได้
                </p>
              ) : !isRestoringAction ? (
                <p className="mt-2 text-xs text-slate-400">
                  ข้อมูลจะยังอยู่ในระบบและสามารถกู้คืนได้ภายหลัง
                </p>
              ) : null}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={actionSaving}
                onClick={() => setAccountAction(null)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={actionSaving}
                onClick={() => void confirmAccountAction()}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${isRestoringAction ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}
              >
                {actionSaving && (
                  <RefreshCw
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {actionSaving
                  ? "กำลังดำเนินการ…"
                  : isHardDeleteAction
                    ? "ยืนยันการลบถาวร"
                    : isRestoringAction
                      ? "ยืนยันการกู้คืน"
                      : "ยืนยันการระงับ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEdit();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="edit-profile-title"
                  className="text-xl font-bold text-slate-950"
                >
                  แก้ไขข้อมูลผู้ใช้งาน
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingProfile.email ?? "ไม่มีอีเมล"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="ปิด"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                ชื่อ-นามสกุล
                <input
                  value={editForm.fullName}
                  onChange={(event) =>
                    setEditForm((form) => ({
                      ...form,
                      fullName: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                เบอร์โทรศัพท์
                <input
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((form) => ({
                      ...form,
                      phone: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Role
                <select
                  value={editForm.role}
                  onChange={(event) =>
                    setEditForm((form) => ({
                      ...form,
                      role: event.target.value as UserRole,
                    }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {roleOrder.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {saveError && (
              <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {saveError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[90] flex min-w-72 items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-2xl"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </main>
  );
}
