'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Clock,
  Package,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { Medication } from '@/types/database';

const supabase = createClient();

type StockStatus = 'sufficient' | 'reorder' | 'critical' | 'expired' | 'inactive';

interface MedicationDraft {
  name: string;
  type: string;
  category: string;
  stock: number;
  min_stock: number;
  expiry_date: string;
  description: string;
  ingredients: string;
  is_active: boolean;
}

const DEFAULT_DRAFT: MedicationDraft = {
  name: '',
  type: 'เม็ด',
  category: 'ยาแก้ปวดลดไข้',
  stock: 100,
  min_stock: 30,
  expiry_date: '',
  description: '',
  ingredients: '',
  is_active: true,
};

const TYPE_OPTIONS = [
  'เม็ด',
  'แคปซูล',
  'ยาน้ำ',
  'ผง',
  'น้ำ',
  'ครีม/เจล',
  'ขี้ผึ้ง',
  'เม็ดอม',
  'ยาฉีด',
  'เวชภัณฑ์ทั่วไป',
];

const COMMON_CATEGORIES = [
  'ยาแก้ปวดลดไข้',
  'ยาปฏิชีวนะ',
  'ยาระบบทางเดินอาหาร',
  'ยาแก้แพ้',
  'ยาแก้ปวดภายนอก',
  'ยาระบบทางเดินหายใจ',
  'ยาหยอดตา/หู',
  'วิตามิน/เกลือแร่',
  'เวชภัณฑ์ทำแผล',
];

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T23:59:59`;
  const expiryDate = new Date(normalized);
  if (Number.isNaN(expiryDate.getTime())) return false;
  return expiryDate.getTime() < Date.now();
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr || isExpired(dateStr)) return false;
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T23:59:59`;
  const expiryDate = new Date(normalized);
  if (Number.isNaN(expiryDate.getTime())) return false;
  const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diffDays <= 90 && diffDays >= 0;
}

function getStockStatus(item: Medication): StockStatus {
  if (!item.is_active) return 'inactive';
  if (isExpired(item.expiry_date)) return 'expired';
  if (item.stock === 0) return 'critical';
  if (item.min_stock > 0 && item.stock < item.min_stock * 0.5) return 'critical';
  if (item.min_stock > 0 && item.stock <= item.min_stock) return 'reorder';
  return 'sufficient';
}

function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export default function PharmacyPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc' | 'expiry'>('name');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medication | null>(null);
  const [draft, setDraft] = useState<MedicationDraft>(DEFAULT_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Medication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 3500);
    return () => clearTimeout(timer);
  }, [successToast]);

  const loadMedications = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }
      setMedications((data as Medication[]) ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Supabase';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function startFetching() {
      try {
        const { data, error } = await supabase
          .from('medications')
          .select('*')
          .order('name', { ascending: true });

        if (ignore) return;
        if (error) throw error;
        setMedications((data as Medication[]) ?? []);
      } catch (err: unknown) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Supabase';
        setErrorMessage(msg);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void startFetching();
    return () => {
      ignore = true;
    };
  }, []);

  const categoriesInDb = useMemo(() => {
    const set = new Set<string>();
    medications.forEach((m) => {
      if (m.category?.trim()) set.add(m.category.trim());
    });
    return Array.from(set);
  }, [medications]);

  const stats = useMemo(() => {
    let sufficient = 0;
    let reorder = 0;
    let critical = 0;
    let expiringSoon = 0;
    let expiredOrInactive = 0;

    medications.forEach((m) => {
      const status = getStockStatus(m);
      if (status === 'sufficient') sufficient++;
      if (status === 'reorder') reorder++;
      if (status === 'critical') critical++;
      if (isExpiringSoon(m.expiry_date)) expiringSoon++;
      if (status === 'expired' || status === 'inactive') expiredOrInactive++;
    });

    return {
      total: medications.length,
      sufficient,
      reorder,
      critical,
      expiringSoon,
      expiredOrInactive,
    };
  }, [medications]);

  const filteredMedications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return medications
      .filter((item) => {
        if (q) {
          const matchName = item.name.toLowerCase().includes(q);
          const matchCategory = item.category?.toLowerCase().includes(q) ?? false;
          const matchDesc = item.description?.toLowerCase().includes(q) ?? false;
          const matchIngr = item.ingredients?.toLowerCase().includes(q) ?? false;
          if (!matchName && !matchCategory && !matchDesc && !matchIngr) return false;
        }

        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }

        if (selectedType !== 'all' && item.type !== selectedType) {
          return false;
        }

        if (statusFilter !== 'all') {
          const status = getStockStatus(item);
          if (statusFilter === 'sufficient' && status !== 'sufficient') return false;
          if (statusFilter === 'reorder' && status !== 'reorder') return false;
          if (statusFilter === 'critical' && status !== 'critical') return false;
          if (statusFilter === 'expiring_soon' && !isExpiringSoon(item.expiry_date)) return false;
          if (statusFilter === 'expired' && status !== 'expired' && status !== 'inactive') return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'th');
        if (sortBy === 'stock_asc') return a.stock - b.stock;
        if (sortBy === 'stock_desc') return b.stock - a.stock;
        if (sortBy === 'expiry') {
          if (!a.expiry_date) return 1;
          if (!b.expiry_date) return -1;
          return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        }
        return 0;
      });
  }, [medications, searchQuery, selectedCategory, selectedType, statusFilter, sortBy]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setDraft(DEFAULT_DRAFT);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Medication) => {
    setEditingItem(item);
    setDraft({
      name: item.name,
      type: item.type || 'เม็ด',
      category: item.category || '',
      stock: item.stock ?? 0,
      min_stock: item.min_stock ?? 0,
      expiry_date: item.expiry_date || '',
      description: item.description || '',
      ingredients: item.ingredients || '',
      is_active: item.is_active ?? true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!draft.name.trim()) {
      setFormError('กรุณากรอกชื่อเวชภัณฑ์');
      return;
    }

    if (!draft.category.trim()) {
      setFormError('กรุณาระบุหมวดหมู่ยา');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type.trim(),
        category: draft.category.trim(),
        stock: Number(draft.stock) || 0,
        min_stock: Number(draft.min_stock) || 0,
        expiry_date: draft.expiry_date || null,
        description: draft.description?.trim() || null,
        ingredients: draft.ingredients?.trim() || null,
        is_active: draft.is_active,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('medications')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        setSuccessToast(`อัปเดตข้อมูล "${draft.name}" สำเร็จ`);
      } else {
        const { error } = await supabase
          .from('medications')
          .insert([payload]);

        if (error) throw error;
        setSuccessToast(`เพิ่มเวชภัณฑ์ "${draft.name}" เข้าสู่คลังยาสำเร็จ`);
      }

      setIsModalOpen(false);
      await loadMedications();
    } catch (err: unknown) {
      const errObj = err as { message?: string; details?: string; hint?: string };
      const msg = errObj?.message || (err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ');
      console.error('Failed to save medication:', err);
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMedication = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      setSuccessToast(`ลบรายการ "${deleteTarget.name}" ออกจากคลังยาแล้ว`);
      setDeleteTarget(null);
      await loadMedications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถลบรายการได้';
      alert(`เกิดข้อผิดพลาด: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800 shadow-xl transition-all animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-2 rounded-lg p-1 text-emerald-600 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold tracking-wider text-sky-600 uppercase">
                WU CLINIC / PHARMACY
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Supabase Live
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              คลังยาและเวชภัณฑ์ (Medication Inventory)
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              ควบคุมสต็อกเวชภัณฑ์ เฝ้าระวังยาใกล้หมดอายุ และบันทึกข้อมูลแบบเรียลไทม์
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadMedications()}
              disabled={isLoading}
              title="รีเฟรชข้อมูล"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-sky-700 active:scale-95"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>นำเข้าเวชภัณฑ์ใหม่</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertOctagon className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Supabase</p>
              <p className="text-xs text-rose-600 mt-0.5">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadMedications()}
              className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200 shadow-xs hover:bg-rose-100"
            >
              ลองใหม่
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            key: 'all',
            label: 'รายการทั้งหมด',
            value: stats.total,
            sub: 'ในระบบคลังยา',
            icon: Package,
            color: 'bg-sky-50 text-sky-600',
            activeBorder: 'ring-2 ring-sky-500',
          },
          {
            key: 'sufficient',
            label: 'มีเพียงพอ',
            value: stats.sufficient,
            sub: 'พร้อมให้บริการ',
            icon: CheckCircle2,
            color: 'bg-emerald-50 text-emerald-600',
            activeBorder: 'ring-2 ring-emerald-500',
          },
          {
            key: 'reorder',
            label: 'ต้องสั่งเพิ่ม',
            value: stats.reorder,
            sub: 'ต่ำกว่าเกณฑ์',
            icon: AlertTriangle,
            color: 'bg-amber-50 text-amber-600',
            activeBorder: 'ring-2 ring-amber-500',
          },
          {
            key: 'critical',
            label: 'วิกฤตใกล้หมด',
            value: stats.critical,
            sub: 'เร่งด่วนที่สุด',
            icon: AlertOctagon,
            color: 'bg-rose-50 text-rose-600',
            activeBorder: 'ring-2 ring-rose-500',
          },
          {
            key: 'expiring_soon',
            label: 'ใกล้หมดอายุ',
            value: stats.expiringSoon,
            sub: '≤ 90 วันข้างหน้า',
            icon: Clock,
            color: 'bg-violet-50 text-violet-600',
            activeBorder: 'ring-2 ring-violet-500',
          },
          {
            key: 'expired',
            label: 'หมดอายุ / ปิดใช้',
            value: stats.expiredOrInactive,
            sub: 'คัดแยกออกจากคลัง',
            icon: Ban,
            color: 'bg-slate-100 text-slate-600',
            activeBorder: 'ring-2 ring-slate-500',
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = statusFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === item.key ? 'all' : item.key))}
              className={`flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:shadow-sm hover:border-slate-300 ${
                isActive ? `${item.activeBorder} bg-slate-50/50` : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{item.label}</span>
                <span className={`rounded-xl p-2 ${item.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อยา, หมวดหมู่, สรรพคุณ หรือตัวยาสำคัญ..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          >
            <option value="all">ทุกหมวดหมู่ยา</option>
            {categoriesInDb.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          >
            <option value="all">ทุกรูปแบบ (Type)</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            >
              <option value="name">เรียงตาม: ชื่อ (ก-ฮ)</option>
              <option value="stock_asc">เรียงตาม: สต็อกน้อย → มาก</option>
              <option value="stock_desc">เรียงตาม: สต็อกมาก → น้อย</option>
              <option value="expiry">เรียงตาม: วันหมดอายุเร็วสุด</option>
            </select>
          </div>

          {(searchQuery || selectedCategory !== 'all' || selectedType !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedType('all');
                setStatusFilter('all');
              }}
              className="h-11 rounded-xl px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-4">ชื่อเวชภัณฑ์ / ตัวยา</th>
                <th scope="col" className="px-4 py-4">รูปแบบ</th>
                <th scope="col" className="px-4 py-4">หมวดหมู่</th>
                <th scope="col" className="px-5 py-4">ระดับสต็อกคงเหลือ</th>
                <th scope="col" className="px-4 py-4">วันหมดอายุ</th>
                <th scope="col" className="px-4 py-4">สถานะ</th>
                <th scope="col" className="px-4 py-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-sky-600 mb-2" />
                    <span>กำลังโหลดข้อมูลจากฐานข้อมูล Supabase...</span>
                  </td>
                </tr>
              ) : filteredMedications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Pill className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-base font-semibold text-slate-700">ไม่พบรายการเวชภัณฑ์</p>
                    <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองที่เลือกไว้</p>
                  </td>
                </tr>
              ) : (
                filteredMedications.map((item) => {
                  const status = getStockStatus(item);
                  const expiring = isExpiringSoon(item.expiry_date);
                  const expired = isExpired(item.expiry_date);

                  const maxDisplay = Math.max(item.min_stock * 2, item.stock, 1);
                  const percent = Math.min(Math.round((item.stock / maxDisplay) * 100), 100);

                  let progressColor = 'bg-emerald-500';
                  if (status === 'reorder') progressColor = 'bg-amber-500';
                  if (status === 'critical') progressColor = 'bg-rose-500';

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl bg-sky-50 p-2 text-sky-600">
                            <Pill className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-snug">{item.name}</p>
                            {item.description && (
                              <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{item.description}</p>
                            )}
                            {item.ingredients && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                ตัวยา: {item.ingredients}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item.type || '-'}
                        </span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-600">{item.category || '-'}</span>
                      </td>

                      <td className="px-5 py-4 min-w-[160px]">
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-base font-bold text-slate-900">{item.stock}</span>
                            <span className="text-slate-400">ขั้นต่ำ {item.min_stock}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressColor}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        <div className="space-y-0.5">
                          <p className={`font-medium ${expired ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                            {formatDisplayDate(item.expiry_date)}
                          </p>
                          {expired && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                              <Ban className="h-3 w-3" /> หมดอายุแล้ว
                            </span>
                          )}
                          {!expired && expiring && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              <Clock className="h-3 w-3" /> ใกล้หมดอายุ
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        {status === 'sufficient' && (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            มีเพียงพอ
                          </span>
                        )}
                        {status === 'reorder' && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            ต้องสั่งเพิ่ม
                          </span>
                        )}
                        {status === 'critical' && (
                          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                            วิกฤตใกล้หมด
                          </span>
                        )}
                        {status === 'expired' && (
                          <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                            หมดอายุ
                          </span>
                        )}
                        {status === 'inactive' && (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20">
                            ปิดใช้งาน
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            title="แก้ไขข้อมูล"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-sky-600 transition"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="ลบเวชภัณฑ์"
                            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingItem ? 'แก้ไขข้อมูลเวชภัณฑ์' : 'นำเข้าเวชภัณฑ์ใหม่'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  บันทึกข้อมูลเข้าสู่ฐานข้อมูลจริงของคลินิก (Supabase)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedication} className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ชื่อยา / เวชภัณฑ์ *
                </label>
                <input
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="เช่น Paracetamol 500mg, Amoxicillin"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">รูปแบบ (Type)</label>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">หมวดหมู่ยา *</label>
                  <input
                    type="text"
                    required
                    list="category-suggestions"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    placeholder="เช่น ยาแก้ปวดลดไข้"
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                  <datalist id="category-suggestions">
                    {COMMON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    สต็อกปัจจุบัน (Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draft.stock}
                    onChange={(e) => setDraft({ ...draft, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    สต็อกขั้นต่ำ (Min Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draft.min_stock}
                    onChange={(e) => setDraft({ ...draft, min_stock: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">วันหมดอายุ (Expiry Date)</label>
                <input
                  type="date"
                  value={draft.expiry_date}
                  onChange={(e) => setDraft({ ...draft, expiry_date: e.target.value })}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">คำอธิบาย / ข้อบ่งใช้</label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="เช่น ยาบรรเทาอาการปวดศีรษะ เป็นไข้"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ตัวยาสำคัญ (Ingredients)</label>
                <input
                  type="text"
                  value={draft.ingredients}
                  onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                  placeholder="เช่น Paracetamol 500 mg"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active_checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="is_active_checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                  เปิดให้พร้อมจ่ายในระบบ (Active Status)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700 transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'บันทึกการแก้ไข' : 'เพิ่มเวชภัณฑ์'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="rounded-xl bg-rose-50 p-2.5">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">ยืนยันการลบเวชภัณฑ์</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              คุณต้องการลบรายการ <strong className="text-slate-900">&quot;{deleteTarget.name}&quot;</strong> ออกจากฐานข้อมูล Supabase ถาวรหรือไม่? การดำเนินการนี้ไม่สามารถเรียกคืนได้
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteMedication()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
