"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Phone,
  AlertCircle,
  HeartPulse,
  Loader2,
  X,
  ChevronDown,
  UserRound,
  Pencil,
} from "lucide-react";
import {
  searchProfilesByGroup,
  type AccountGroup,
} from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/types/database";

const healthStatusLabel: Record<string, { text: string; className: string }> = {
  yes: {
    text: "มี",
    className: "bg-status-critical-bg text-status-critical border-red-200",
  },
  no: {
    text: "ไม่มี",
    className: "bg-status-success-bg text-status-success border-emerald-200",
  },
  unknown: {
    text: "ไม่ทราบ",
    className:
      "bg-status-neutral-bg text-status-neutral border-brand-border-soft",
  },
};

function HealthBadge({ status }: { status: string | null }) {
  const info =
    healthStatusLabel[status ?? "unknown"] ?? healthStatusLabel.unknown;
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${info.className}`}
    >
      {info.text}
    </span>
  );
}

const PAGE_SIZE = 10;

export default function PatientSearchContent() {
  const { role } = useAuth();
  const [accountGroup, setAccountGroup] = useState<AccountGroup>("patient");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(
    async (
      selectedGroup: AccountGroup,
      searchQuery: string,
      pageNumber: number,
      append: boolean = false,
    ) => {
      if (pageNumber === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setError(null);

      try {
        const {
          profiles,
          hasMore: moreAvailable,
          totalCount: total,
        } = await searchProfilesByGroup(
          selectedGroup,
          searchQuery,
          pageNumber,
          PAGE_SIZE,
        );

        if (append) {
          setResults((current) => [...current, ...profiles]);
        } else {
          setResults(profiles);
        }

        setHasMore(moreAvailable);
        setTotalCount(total);
        setPage(pageNumber);
        setActiveQuery(searchQuery);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [],
  );

  // โหลดข้อมูลเมื่อเปิดหน้าและเมื่อเปลี่ยนแท็บ
  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(() => {
      if (active) {
        void fetchProfiles(accountGroup, "", 0, false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accountGroup, fetchProfiles]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();

    await fetchProfiles(accountGroup, query, 0, false);
  }

  async function handleClearSearch() {
    setQuery("");

    await fetchProfiles(accountGroup, "", 0, false);
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) return;

    await fetchProfiles(accountGroup, activeQuery, page + 1, true);
  }

  function handleGroupChange(nextGroup: AccountGroup) {
    if (nextGroup === accountGroup) return;

    setQuery("");
    setActiveQuery("");
    setResults([]);
    setPage(0);
    setHasMore(false);
    setTotalCount(0);
    setAccountGroup(nextGroup);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            ค้นหาข้อมูลผู้ป่วย
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            ค้นหา ดู และข้อมูลผู้ป่วย
          </p>
        </div>

        {!isLoading && totalCount > 0 && (
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 bg-sky-50 text-sky-700 text-xs font-semibold rounded-full border border-sky-100">
            <UserRound className="size-3.5" />
            {accountGroup === "patient" ? "ผู้ป่วย" : "บุคลากร"}
            ทั้งหมด {totalCount} คน
          </span>
        )}
      </div>

      
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ชื่อ-นามสกุล, รหัสนักศึกษา หรือ เบอร์โทรศัพท์"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1 rounded-lg"
              title="ล้างคำค้นหา"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-sky-500 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-sky-600 transition disabled:opacity-60 text-sm shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          ค้นหา
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="size-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
          <Loader2 className="size-7 animate-spin text-sky-500" />
          <p className="text-sm font-medium text-zinc-500">
            กำลังโหลดรายชื่อผู้ป่วย...
          </p>
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && results.length === 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center space-y-3">
          <UserRound className="size-10 text-zinc-300 mx-auto" />
          <div>
            <p className="text-base font-semibold text-zinc-800">
              {activeQuery
                ? "ไม่พบข้อมูลผู้ป่วยที่ตรงกับคำค้นหา"
                : "ยังไม่มีข้อมูลผู้ป่วยในระบบ"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {activeQuery
                ? "ลองตรวจสอบการสะกดคำ หรือค้นหาด้วยรหัสนักศึกษา/เบอร์โทรศัพท์"
                : "เมื่อมีผู้ลงทะเบียนเป็นผู้ป่วย รายชื่อจะแสดงขึ้นที่นี่"}
            </p>
          </div>
          {activeQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-xs text-sky-600 hover:text-sky-800 font-semibold underline underline-offset-4"
            >
              แสดงรายชื่อทั้งหมด
            </button>
          )}
        </div>
      )}

      {/* Patient Cards List */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-3">
          {activeQuery && (
            <div className="flex items-center justify-between px-1 text-xs text-zinc-500">
              <span>
                ผลการค้นหาสำหรับ &ldquo;
                <span className="font-semibold text-zinc-700">
                  {activeQuery}
                </span>
                &rdquo; ({totalCount} รายการ)
              </span>
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-sky-600 hover:text-sky-800 font-medium"
              >
                ดูทั้งหมด
              </button>
            </div>
          )}

          {results.map((patient) => (
            <div
              key={patient.id}
              className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 transition hover:border-zinc-200"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-zinc-900">
                    {patient.full_name}
                  </h2>

                  <p className="text-sm text-zinc-500">
                    {patient.patient_type === "employee"
                      ? "รหัสบุคลากร"
                      : "รหัสนักศึกษา"}
                    :{" "}
                    {patient.patient_type === "employee"
                      ? patient.employee_id || "-"
                      : patient.student_id || "-"}
                  </p>
                </div>

                {role === "staff_admin" && (
                  <Link
                    href={`/patients/${patient.id}/edit`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    แก้ไขข้อมูล
                  </Link>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-700 mb-3">
                <div className="flex items-center gap-1.5">
                  <Phone className="size-4 text-zinc-400" />
                  <span>{patient.phone || "ไม่มีเบอร์โทร"}</span>
                </div>
                {patient.emergency_phone && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-600">
                      เบอร์ฉุกเฉิน:
                    </span>
                    <span>{patient.emergency_phone}</span>
                  </div>
                )}
              </div>

              <div
                className={
                  accountGroup === "patient"
                    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
                    : "hidden"
                }
              >
                {" "}
                <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                      <AlertCircle className="size-3.5 text-amber-600" />{" "}
                      ประวัติแพ้ยา
                    </p>
                    <HealthBadge
                      status={
                        patient.allergies?.trim()
                          ? "yes"
                          : (patient.allergy_status ?? null)
                      }
                    />
                  </div>
                  {patient.allergies?.trim() ||
                  patient.allergy_status === "yes" ? (
                    <p className="text-xs text-zinc-700 mt-1 font-medium">
                      {patient.allergies ||
                        "มีประวัติแพ้ยา (ไม่ระบุรายละเอียด)"}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400 mt-1">
                      ไม่มีประวัติแพ้ยา
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-rose-50/70 border border-rose-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-rose-800 flex items-center gap-1.5">
                      <HeartPulse className="size-3.5 text-rose-600" />{" "}
                      โรคประจำตัว
                    </p>
                    <HealthBadge
                      status={
                        patient.chronic_diseases?.trim()
                          ? "yes"
                          : (patient.chronic_disease_status ?? null)
                      }
                    />
                  </div>
                  {patient.chronic_diseases?.trim() ||
                  patient.chronic_disease_status === "yes" ? (
                    <p className="text-xs text-zinc-700 mt-1 font-medium">
                      {patient.chronic_diseases ||
                        "มีโรคประจำตัว (ไม่ระบุรายละเอียด)"}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400 mt-1">
                      ไม่มีโรคประจำตัว
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 font-medium px-5 py-2.5 rounded-xl transition text-sm shadow-sm disabled:opacity-60"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-sky-500" />
                    <span>กำลังโหลดเพิ่มเติม...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4 text-zinc-500" />
                    <span>
                      แสดงรายชื่อเพิ่มเติม (เหลืออีก{" "}
                      {totalCount - results.length} คน)
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {!hasMore && results.length > 0 && totalCount > PAGE_SIZE && (
            <p className="text-center text-xs text-zinc-400 pt-4">
              แสดงครบทั้งหมด {totalCount} รายการแล้ว
            </p>
          )}
        </div>
      )}
    </div>
  );
}
