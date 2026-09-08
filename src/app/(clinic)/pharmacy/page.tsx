"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Medication, MOCK_DB } from "../../../../docs/superpowers/specs/MOCK_MEDICATIONS";

type Status = "มีเพียงพอ" | "ต้องสั่งเพิ่ม" | "วิกฤตใกล้หมด" | "หมดอายุ" | "นำออก";

const TYPE_OPTIONS = [
  "ยาเม็ด (Tablet)",
  "แคปซูล (Capsule)",
  "ยาน้ำ (Syrup)",
  "ผง (Powder)",
  "น้ำ (Solution)",
  "ครีม/โลชั่น (Cream)",
  "ครีม/ขี้ผึ้ง (Ointment)",
  "เม็ดอม (Lozenges)",
];

const EMPTY_DRAFT = {
  name: "",
  type: TYPE_OPTIONS[0],
  category: "",
  stock: 0,
  min_stock: 0,
  expiry_date: "",
};

// คำนวณสถานะสต็อกอัตโนมัติจาก stock เทียบ min_stock — ไม่ต้องเก็บใน DB, ไม่มีวันไม่ตรงกับตัวเลขจริง
function getMedicationStatus(item: Medication): Status {
  if (item.is_deleted) {
    return "นำออก";
  }

  if (isExpired(item.expiry_date)) {
    return "หมดอายุ";
  }

  if (item.min_stock <= 0) {
    return item.stock > 0 ? "มีเพียงพอ" : "วิกฤตใกล้หมด";
  }

  const ratio = item.stock / item.min_stock;
  if (ratio < 0.5) return "วิกฤตใกล้หมด";
  if (item.stock < item.min_stock) return "ต้องสั่งเพิ่ม";
  return "มีเพียงพอ";
}

const STATUS_STYLE: Record<Status, string> = {
  มีเพียงพอ: "bg-emerald-500/10 text-emerald-600",
  "ต้องสั่งเพิ่ม": "bg-amber-500/10 text-amber-600",
  "วิกฤตใกล้หมด": "bg-rose-500/10 text-rose-600",
  "หมดอายุ": "bg-red-500/10 text-red-600",
  "นำออก": "bg-zinc-500/10 text-zinc-600",
};

function formatExpiry(dateStr: string | null) {
  if (!dateStr) return "-";

  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`;
  const d = new Date(normalized);

  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function isExpired(dateStr: string | null) {
  if (!dateStr) return false;

  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`;
  const expiryDate = new Date(normalized);

  if (Number.isNaN(expiryDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  return expiryDate < today;
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr || isExpired(dateStr)) return false;

  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`;
  const expiryDate = new Date(normalized);

  if (Number.isNaN(expiryDate.getTime())) return false;

  const today = new Date();
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays <= 90 && diffDays >= 0;
}

function normalizeCategoryName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ");
}

export default function InventoryPage() {
  const [items, setItems] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status | "all" | "near-expiry" | "expired">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleNumberInput = (
    field: "stock" | "min_stock",
    value: string
  ) => {
    if (value === "") {
      setDraft((prev) => ({ ...prev, [field]: 0 }));
      return;
    }

    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setDraft((prev) => ({ ...prev, [field]: parsed }));
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemSectionRef = useRef<HTMLDivElement | null>(null);

  const handleStatusSelection = (
    status: Status | "all" | "near-expiry" | "expired"
  ) => {
    const nextStatus = selectedStatus === status ? "all" : status;
    setSelectedCategory(null);
    setSelectedStatus(nextStatus);

    if (nextStatus !== "all") {
      scrollToItemSection();
    }
  };

  const scrollToItemSection = () => {
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      itemSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  // --- โหลดข้อมูลจริงจาก Supabase --------------------------------------
  const fetchMedications = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    /* --- COMMENTED OUT FOR MOCKUP ---
    if (!supabase) {
      setErrorMsg(
        "ยังไม่ได้ตั้งค่า Supabase ให้ครบใน .env.local ก่อนใช้งานหน้า Inventory"
      );
      setItems([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("โหลดข้อมูลไม่สำเร็จ: " + error.message);
      setItems([]);
    } else {
      setItems(data as Medication[]);
    }
    ---------------------------------- */

    // MOCKUP LOGIC
    let currentMock = MOCK_DB.MOCK_MEDICATIONS;
    try {
      const stored = localStorage.getItem("pharmacy_mock");
      if (stored) {
        currentMock = JSON.parse(stored);
        MOCK_DB.MOCK_MEDICATIONS = currentMock;
      } else {
        localStorage.setItem("pharmacy_mock", JSON.stringify(currentMock));
      }
    } catch (e) {}

    setItems([...currentMock]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMsg(null);

      /* --- COMMENTED OUT FOR MOCKUP ---
      if (!supabase) {
        if (!isActive) return;
        setErrorMsg(
          "ยังไม่ได้ตั้งค่า Supabase ให้ครบใน .env.local ก่อนใช้งานหน้า Inventory"
        );
        setItems([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (!isActive) return;

      if (error) {
        setErrorMsg("โหลดข้อมูลไม่สำเร็จ: " + error.message);
        setItems([]);
      } else {
        setItems(data as Medication[]);
      }
      ----------------------------------- */

      // MOCKUP LOGIC
      if (!isActive) return;
      let currentMock = MOCK_DB.MOCK_MEDICATIONS;
      try {
        const stored = localStorage.getItem("pharmacy_mock");
        if (stored) {
          currentMock = JSON.parse(stored);
          MOCK_DB.MOCK_MEDICATIONS = currentMock;
        } else {
          localStorage.setItem("pharmacy_mock", JSON.stringify(currentMock));
        }
      } catch (e) {}

      setItems([...currentMock]);

      setIsLoading(false);
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase();

    return items.filter((item) => {
      const status = getMedicationStatus(item);
      const matchesSearch =
        item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
      const matchesStatus =
        selectedStatus === "all"
          ? true
          : selectedStatus === "near-expiry"
            ? isExpiringSoon(item.expiry_date)
            : selectedStatus === "expired"
              ? isExpired(item.expiry_date)
              : status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      if (a.is_deleted === b.is_deleted) return 0;
      return a.is_deleted ? 1 : -1;
    });
  }, [items, searchTerm, selectedCategory, selectedStatus]);

  const summaryData = useMemo(() => {
    const statusSummary = {
      "มีเพียงพอ": 0,
      "ต้องสั่งเพิ่ม": 0,
      "วิกฤตใกล้หมด": 0,
      "หมดอายุ": 0,
      "นำออก": 0,
    } as Record<Status, number>;

    for (const item of items) {
      const status = getMedicationStatus(item);
      statusSummary[status] += 1;
    }

    const categorySummary = Object.entries(
      items.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const expiringSoon = items.filter((item) => isExpiringSoon(item.expiry_date));
    const expiredItems = items.filter((item) => isExpired(item.expiry_date));
    const maxCategory = categorySummary[0]?.total ?? 1;
    const maxStatus = Math.max(...Object.values(statusSummary), 1);

    return {
      total: items.length,
      inStock: statusSummary["มีเพียงพอ"],
      reorder: statusSummary["ต้องสั่งเพิ่ม"],
      critical: statusSummary["วิกฤตใกล้หมด"],
      expired: statusSummary["หมดอายุ"],
      removed: statusSummary["นำออก"],
      expiringSoon: expiringSoon.length,
      categorySummary,
      statusSummary,
      expiredItems,
      maxCategory,
      maxStatus,
    };
  }, [items]);

  const categoryHealth = useMemo(() => {
    const health: Record<string, "healthy" | "warning" | "critical"> = {};

    for (const item of items) {
      const state = getMedicationStatus(item);
      const current = health[item.category];

      if (!current) {
        health[item.category] = state === "หมดอายุ" || state === "วิกฤตใกล้หมด" ? "critical" : state === "ต้องสั่งเพิ่ม" ? "warning" : "healthy";
        continue;
      }

      if (state === "หมดอายุ" || state === "วิกฤตใกล้หมด") {
        health[item.category] = "critical";
      } else if (current !== "critical" && (state === "ต้องสั่งเพิ่ม" || state === "มีเพียงพอ")) {
        health[item.category] = current === "warning" ? "warning" : "healthy";
      }
    }

    return health;
  }, [items]);

  const donutSegments = [
    { label: "มีเพียงพอ", value: summaryData.inStock, color: "#22c55e" },
    { label: "ต้องสั่งเพิ่ม", value: summaryData.reorder, color: "#f59e0b" },
    { label: "วิกฤตใกล้หมด", value: summaryData.critical, color: "#f43f5e" },
    { label: "หมดอายุ", value: summaryData.expired, color: "#ef4444" },
    { label: "นำออก", value: summaryData.removed, color: "#71717a" }, // zinc-500
  ].filter((segment) => segment.value > 0);

  const donutTotal = donutSegments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  const hasActiveFilter = selectedStatus !== "all" || selectedCategory !== null || searchTerm.trim() !== "";

  const shouldShowInventoryTable = selectedStatus === "all" && !selectedCategory && !searchTerm.trim() ? true : hasActiveFilter;

  useEffect(() => {
    if (selectedStatus === "all" && !selectedCategory && !searchTerm.trim()) {
      return;
    }

    const timer = window.setTimeout(() => {
      scrollToItemSection();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [selectedStatus, selectedCategory, searchTerm]);

  // --- ฟอร์ม เพิ่ม/แก้ไข --------------------------------------------------
  const openAddForm = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: Medication) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      type: item.type,
      category: item.category,
      stock: item.stock,
      min_stock: item.min_stock,
      expiry_date: item.expiry_date ?? "",
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!draft.name.trim()) {
      setFormError("กรุณากรอกชื่อเวชภัณฑ์");
      return;
    }
    if (!draft.category.trim()) {
      setFormError("กรุณากรอกหมวดหมู่");
      return;
    }
    if (draft.stock < 0 || draft.min_stock < 0) {
      setFormError("จำนวนต้องไม่ติดลบ");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const normalizedCategory = normalizeCategoryName(draft.category);
    const existingCategory = items.find(
      (item) =>
        item.category.toLowerCase() === normalizedCategory.toLowerCase() ||
        normalizeCategoryName(item.category).toLowerCase() === normalizedCategory.toLowerCase()
    )?.category;

    const payload = {
      name: draft.name.trim(),
      type: draft.type,
      category: existingCategory ?? normalizedCategory,
      stock: draft.stock,
      min_stock: draft.min_stock,
      expiry_date: draft.expiry_date || null,
    };

    /* --- COMMENTED OUT FOR MOCKUP ---
    if (!supabase) {
      setFormError("ยังไม่ได้ตั้งค่า Supabase ให้ครบใน .env.local");
      setIsSaving(false);
      return;
    }

    const { error } = editingId
      ? await supabase.from("medications").update(payload).eq("id", editingId)
      : await supabase.from("medications").insert(payload);

    setIsSaving(false);

    if (error) {
      setFormError("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    ----------------------------------- */

    // MOCKUP LOGIC
    setIsSaving(false);
    if (editingId) {
      MOCK_DB.MOCK_MEDICATIONS = MOCK_DB.MOCK_MEDICATIONS.map(m => m.id === editingId ? { ...m, ...payload } as Medication : m);
    } else {
      MOCK_DB.MOCK_MEDICATIONS = [{ id: Date.now().toString(), ...payload } as Medication, ...MOCK_DB.MOCK_MEDICATIONS];
    }
    try {
      localStorage.setItem("pharmacy_mock", JSON.stringify(MOCK_DB.MOCK_MEDICATIONS));
    } catch (e) {}

    setIsFormOpen(false);
    setEditingId(null);
    await fetchMedications();
  };

  // --- ลบ -----------------------------------------------------------------
  const handleDelete = async (id: string) => {
    /* --- COMMENTED OUT FOR MOCKUP ---
    if (!supabase) {
      setErrorMsg("ยังไม่ได้ตั้งค่า Supabase ให้ครบใน .env.local");
      return;
    }

    setIsDeleting(true);
    const { error } = await supabase.from("medications").update({ is_deleted: true }).eq("id", id);
    setIsDeleting(false);
    setConfirmDeleteId(null);

    if (error) {
      setErrorMsg("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    ----------------------------------- */

    // MOCKUP LOGIC
    setIsDeleting(true);
    MOCK_DB.MOCK_MEDICATIONS = MOCK_DB.MOCK_MEDICATIONS.map(m =>
      m.id === id ? { ...m, is_deleted: true } : m
    );
    try {
      localStorage.setItem("pharmacy_mock", JSON.stringify(MOCK_DB.MOCK_MEDICATIONS));
    } catch (e) {}
    setIsDeleting(false);
    setConfirmDeleteId(null);

    await fetchMedications();
  };

  // --- กู้คืน -----------------------------------------------------------------
  const handleRestore = async (id: string) => {
    /* --- COMMENTED OUT FOR MOCKUP ---
    if (!supabase) {
      setErrorMsg("ยังไม่ได้ตั้งค่า Supabase ให้ครบใน .env.local");
      return;
    }

    setIsDeleting(true);
    const { error } = await supabase.from("medications").update({ is_deleted: false }).eq("id", id);
    setIsDeleting(false);

    if (error) {
      setErrorMsg("กู้คืนไม่สำเร็จ: " + error.message);
      return;
    }
    ----------------------------------- */

    // MOCKUP LOGIC
    setIsDeleting(true);
    MOCK_DB.MOCK_MEDICATIONS = MOCK_DB.MOCK_MEDICATIONS.map(m =>
      m.id === id ? { ...m, is_deleted: false } : m
    );
    try {
      localStorage.setItem("pharmacy_mock", JSON.stringify(MOCK_DB.MOCK_MEDICATIONS));
    } catch (e) {}
    setIsDeleting(false);

    await fetchMedications();
  };

  return (
    <div className="min-h-[85vh] bg-[#f5f5f7] py-16 px-6 flex flex-col items-center">
      <div className="w-full max-w-245 space-y-12">
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-zinc-200/60">
          <div className="space-y-2">
            <p className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">
              ระบบควบคุมสต็อกเวชภัณฑ์และคลังยา
            </p>
            <h1 className="text-3xl md:text-[40px] font-semibold text-[#1d1d1f] tracking-tight leading-[1.1] apple-tight-headline">
              การจัดการคลังยา (Inventory).
            </h1>
          </div>
          <button
            onClick={openAddForm}
            className="apple-btn-active bg-[#0066cc] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[#0071e3] transition shadow-sm"
          >
            + นำเข้าเวชภัณฑ์ใหม่
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-4 flex items-center text-zinc-400 text-sm pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="ค้นหาชื่อเวชภัณฑ์ หรือหมวดหมู่ยา..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-11 pr-5 rounded-full border border-zinc-200 bg-white text-sm text-[#1d1d1f] placeholder-zinc-400 outline-none transition focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <SummaryCard
            label="รวมทั้งหมด"
            value={summaryData.total}
            tone="blue"
            meta="รายการ"
            active={selectedStatus === "all" && !selectedCategory}
            onClick={() => {
              setSelectedCategory(null);
              setSelectedStatus("all");
              scrollToItemSection();
            }}
          />
          <SummaryCard
            label="มีเพียงพอ"
            value={summaryData.inStock}
            tone="green"
            meta="พร้อมจำหน่าย"
            active={selectedStatus === "มีเพียงพอ"}
            onClick={() => handleStatusSelection("มีเพียงพอ")}
          />
          <SummaryCard
            label="ต้องสั่งเพิ่ม"
            value={summaryData.reorder}
            tone="amber"
            meta="ต้องเติม"
            active={selectedStatus === "ต้องสั่งเพิ่ม"}
            onClick={() => handleStatusSelection("ต้องสั่งเพิ่ม")}
          />
          <SummaryCard
            label="วิกฤตใกล้หมด"
            value={summaryData.critical}
            tone="rose"
            meta="เร่งด่วน"
            active={selectedStatus === "วิกฤตใกล้หมด"}
            onClick={() => handleStatusSelection("วิกฤตใกล้หมด")}
          />
          <SummaryCard
            label="ใกล้หมดอายุ"
            value={summaryData.expiringSoon}
            tone="violet"
            meta="≤ 90 วัน"
            active={selectedStatus === "near-expiry"}
            onClick={() => handleStatusSelection("near-expiry")}
          />
          <SummaryCard
            label="หมดอายุ"
            value={summaryData.expired}
            tone="red"
            meta="ควรล้างทิ้ง"
            active={selectedStatus === "expired"}
            onClick={() => handleStatusSelection("expired")}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)] gap-6 items-start">
          <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
            <div className="rounded-[18px] border border-[#e0e0e0] bg-white p-5 h-full">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-700">
                  ภาพรวมคลังยา
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r="36" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    {donutSegments.map((segment, index) => {
                      const previousTotal = donutSegments
                        .slice(0, index)
                        .reduce((sum, item) => sum + item.value, 0);
                      const ratio = segment.value / donutTotal;
                      const circumference = 2 * Math.PI * 36;
                      const dash = circumference * ratio;
                      const offset = circumference * (1 - previousTotal / donutTotal) - dash;

                      return (
                        <circle
                          key={segment.label}
                          cx="60"
                          cy="60"
                          r="36"
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${circumference - dash}`}
                          strokeDashoffset={offset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">รวม</span>
                    <span className="text-lg font-bold text-[#1d1d1f]">{summaryData.total}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {donutSegments.map((segment) => (
                    <div key={segment.label} className="flex items-center justify-between gap-3 text-[11px] text-zinc-700">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span>{segment.label}</span>
                      </div>
                      <span className="font-bold">{segment.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-[18px] border border-[#e0e0e0] bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">
                    หมวดหมู่ยา
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedStatus("all");
                    }}
                    className="text-[10px] text-zinc-500 underline-offset-2 hover:underline"
                  >
                    ล้างตัวกรอง
                  </button>
                </div>

                <div className="space-y-3">
                  {summaryData.categorySummary.map(({ category, total }) => {
                    const isActive = selectedCategory === category;
                    const width = `${(total / summaryData.maxCategory) * 100}%`;
                    const categoryTone = categoryHealth[category] === "critical"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : categoryHealth[category] === "warning"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700";

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          const nextCategory = selectedCategory === category ? null : category;
                          setSelectedCategory(nextCategory);
                          setSelectedStatus("all");
                          if (nextCategory) {
                            scrollToItemSection();
                          }
                        }}
                        className={`block w-full rounded-xl border px-3 py-2 text-left transition ${
                          isActive ? categoryTone : "border-transparent bg-zinc-50 hover:bg-zinc-100"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#1d1d1f]">{category}</span>
                          <span className="text-[10px] font-bold text-[#0066cc]">{total}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-[#7cc6ff] to-[#0066cc]"
                            style={{ width }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[18px] border border-[#e0e0e0] bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">
                    ตามสถานะสต็อก
                  </h2>
                  <span className="text-[10px] text-zinc-500">เรียงตามความสำคัญ</span>
                </div>

                <div className="space-y-3">
                  {Object.entries(summaryData.statusSummary).map(([label, count]) => {
                    const isActive = selectedStatus === label;
                    const width = `${(count / summaryData.maxStatus) * 100}%`;
                    const barColor =
                      label === "มีเพียงพอ"
                        ? "from-emerald-400 to-emerald-600"
                        : label === "ต้องสั่งเพิ่ม"
                          ? "from-amber-300 to-amber-500"
                          : label === "วิกฤตใกล้หมด"
                            ? "from-rose-400 to-rose-600"
                            : label === "หมดอายุ"
                              ? "from-red-400 to-red-600"
                              : "from-zinc-400 to-zinc-600";

                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleStatusSelection(label as Status)}
                        className={`block w-full rounded-xl border px-3 py-2 text-left transition ${
                          isActive ? "border-zinc-200 bg-zinc-100" : "border-transparent bg-zinc-50 hover:bg-zinc-100"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#1d1d1f]">{label}</span>
                          <span className="text-[10px] font-bold text-zinc-600">{count}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className={`h-full rounded-full bg-linear-to-r ${barColor}`}
                            style={{ width }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-3 text-sm text-rose-600">
            {errorMsg}
            <button
              onClick={fetchMedications}
              className="ml-3 underline font-medium hover:text-rose-700"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {shouldShowInventoryTable && (
          <div ref={itemSectionRef} className="bg-white border border-[#e0e0e0] rounded-[18px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-[#fafafc] px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">
                {selectedCategory
                  ? `ยาในหมวด: ${selectedCategory}`
                  : selectedStatus === "near-expiry"
                    ? "ยาใกล้หมดอายุ"
                    : selectedStatus === "expired"
                      ? "ยาหมดอายุ"
                      : selectedStatus === "มีเพียงพอ"
                        ? "ยา มีเพียงพอ"
                        : selectedStatus === "ต้องสั่งเพิ่ม"
                          ? "ยา ต้องสั่งเพิ่ม"
                          : "ยา วิกฤตใกล้หมด"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedStatus("all");
                }}
                className="text-[10px] text-zinc-500 underline-offset-2 hover:underline"
              >
                กลับสู่ภาพรวม
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-[#fafafc] text-zinc-450 font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6 text-zinc-500">ชื่อเวชภัณฑ์</th>
                    <th className="p-4 text-zinc-500">หมวดหมู่</th>
                    <th className="p-4 text-zinc-500">จำนวนคงเหลือ</th>
                    <th className="p-4 text-zinc-500">วันหมดอายุ</th>
                    <th className="p-4 text-zinc-500">สถานะ</th>
                    <th className="p-4 pr-6 text-right text-zinc-500">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-normal">
                  {isLoading &&
                    [...Array(4)].map((_, i) => (
                      <tr key={`sk-${i}`} className="animate-pulse">
                        <td className="p-4 pl-6"><div className="h-4 w-36 rounded bg-zinc-200" /></td>
                        <td className="p-4"><div className="h-4 w-20 rounded bg-zinc-100" /></td>
                        <td className="p-4"><div className="h-4 w-16 rounded bg-zinc-100" /></td>
                        <td className="p-4"><div className="h-4 w-20 rounded bg-zinc-100" /></td>
                        <td className="p-4"><div className="h-4 w-14 rounded-full bg-zinc-100" /></td>
                        <td className="p-4 pr-6 text-right"><div className="ml-auto h-6 w-12 rounded bg-zinc-100" /></td>
                      </tr>
                    ))}

                  {!isLoading && filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <p className="text-sm font-semibold text-[#1d1d1f]">
                          ไม่พบเวชภัณฑ์ที่ค้นหา
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          ลองคำค้นอื่น หรือกด “นำเข้าเวชภัณฑ์ใหม่” เพื่อเพิ่มรายการ
                        </p>
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    filteredItems.map((item) => {
                      const status = getMedicationStatus(item);
                      return (
                        <tr key={item.id} className="hover:bg-zinc-50 transition">
                          <td className="p-4 pl-6">
                            <div className="font-bold text-[#1d1d1f]">{item.name}</div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">{item.type}</div>
                          </td>
                          <td className="p-4 text-zinc-650">{item.category}</td>
                          <td className="p-4 font-mono">
                            <span className="font-bold text-[#1d1d1f]">{item.stock}</span>
                            <span className="text-[10px] text-zinc-400 font-sans ml-1">({item.min_stock} min)</span>
                          </td>
                          <td className="p-4 text-zinc-600 font-mono">{formatExpiry(item.expiry_date)}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${STATUS_STYLE[status]}`}>
                              {status}
                            </span>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditForm(item)}
                                className="rounded-full border border-zinc-200 px-3 py-1 text-[10px] font-semibold text-[#1d1d1f] hover:bg-zinc-50 transition"
                              >
                                แก้ไข
                              </button>
                              {item.is_deleted ? (
                                <button
                                  onClick={() => handleRestore(item.id)}
                                  className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-200 transition"
                                >
                                  กู้คืน
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="rounded-full border border-rose-200 px-3 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition"
                                >
                                  ลบ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Developer Attribution Card */}
        <div className="rounded-[18px] bg-white border border-[#e0e0e0] p-6 text-center">
          <p className="text-[10px] text-zinc-500 leading-relaxed font-normal">
            📦{" "}
            <span className="font-semibold text-[#0066cc]">
              ผู้พัฒนาคนที่ 4 (Gun):
            </span>{" "}
            ระบบจัดการฐานข้อมูลยา คลังยา และระบบควบคุมสต็อกเวชภัณฑ์ (Drug
            Database & Inventory)
          </p>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">
              {editingId ? "แก้ไขข้อมูลเวชภัณฑ์" : "นำเข้าเวชภัณฑ์ใหม่"}
            </h2>

            <div className="mt-4 space-y-3">
              <ModalField label="ชื่อเวชภัณฑ์ *">
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white focus:ring-1 focus:ring-[#0066cc]"
                  placeholder="เช่น Paracetamol 500mg"
                />
              </ModalField>

              <ModalField label="รูปแบบ">
                <select
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({ ...draft, type: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white focus:ring-1 focus:ring-[#0066cc]"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </ModalField>

              <ModalField label="หมวดหมู่ *">
                <input
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white focus:ring-1 focus:ring-[#0066cc]"
                  placeholder="เช่น ยาลดไข้/ปวด"
                />
              </ModalField>

              <div className="grid grid-cols-2 gap-3">
                <ModalField label="จำนวนคงเหลือ">
                  <input
                    type="number"
                    min={0}
                    value={draft.stock}
                    onChange={(e) => handleNumberInput("stock", e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white focus:ring-1 focus:ring-[#0066cc]"
                    placeholder="0"
                  />
                </ModalField>
                <ModalField label="ยอดขั้นต่ำ (min stock)">
                  <input
                    type="number"
                    min={0}
                    value={draft.min_stock === 0 ? "" : draft.min_stock}
                    onChange={(e) => handleNumberInput("min_stock", e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white focus:ring-1 focus:ring-[#0066cc]"
                    placeholder="0"
                  />
                </ModalField>
              </div>

              <ModalField label="วันหมดอายุ">
                <input
                  type="date"
                  value={draft.expiry_date}
                  onChange={(e) =>
                    setDraft({ ...draft, expiry_date: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] focus:bg-white focus:ring-1 focus:ring-[#0066cc]"
                />
              </ModalField>
            </div>

            {formError && (
              <p className="mt-3 text-sm font-medium text-rose-600">
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="rounded-full bg-[#0066cc] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0071e3] disabled:opacity-60"
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-[18px] bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              ยืนยันลบเวชภัณฑ์นี้?
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              การลบจะถาวรและไม่สามารถกู้คืนได้
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={isDeleting}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={isDeleting}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeleting ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  meta,
  onClick,
  active,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "rose" | "violet" | "red";
  meta: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const toneStyles = {
    blue: "bg-[#eaf2ff] text-[#0066cc]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border p-4 text-left transition ${
        active ? "border-[#cfe1ff] bg-[#f5f9ff] shadow-sm" : "border-[#e0e0e0] bg-white hover:bg-zinc-50"
      }`}
    >
      <div className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${toneStyles[tone]}`}>
        {label}
      </div>
      <div className="text-3xl font-bold text-[#1d1d1f]">{value}</div>
      <div className="mt-1 text-[10px] text-zinc-500">{meta}</div>
    </button>
  );
}

function ModalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
