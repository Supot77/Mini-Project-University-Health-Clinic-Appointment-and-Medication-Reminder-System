'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Pill,
  RefreshCw,
  Search,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import type { Medication } from '@/types/database';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

export interface PrescribedMedItem {
  medication_id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  quantity: number;
}

export interface PrescriptionOrder {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  patient_phone?: string | null;
  patient_student_id?: string | null;
  doctor_name: string;
  diagnosis: string;
  treatment_notes?: string | null;
  prescribed_medications: PrescribedMedItem[];
  created_at: string;
  dispensed_items_count: number;
  is_fully_dispensed: boolean;
  dispensed_at?: string | null;
  pharmacist_name?: string | null;
}

interface PrescriptionsTabProps {
  prescriptions: PrescriptionOrder[];
  isLoading: boolean;
  errorMessage: string | null;
  medications: Medication[];
  canManage: boolean;
  isAdminOrStaff: boolean;
  userId?: string;
  onRefresh: () => Promise<void>;
  onStockUpdated: () => Promise<void>;
  onShowToast: (message: string) => void;
}

function formatDisplayDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function PrescriptionsTab({
  prescriptions,
  isLoading,
  errorMessage,
  medications,
  canManage,
  userId,
  onRefresh,
  onStockUpdated,
  onShowToast,
}: PrescriptionsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'dispensed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const [dispenseTarget, setDispenseTarget] = useState<PrescriptionOrder | null>(null);
  const [isDispensing, setIsDispensing] = useState(false);
  const [dispenseReason, setDispenseReason] = useState('');

  // Stats
  const stats = useMemo(() => {
    let pending = 0;
    let dispensed = 0;
    let insufficient = 0;

    prescriptions.forEach((order) => {
      if (order.is_fully_dispensed) {
        dispensed++;
      } else {
        pending++;
        const anyShort = order.prescribed_medications.some((item) => {
          const med = medications.find(
            (m) => m.id === item.medication_id || m.name.toLowerCase() === item.name.toLowerCase()
          );
          return !med || med.stock < item.quantity;
        });
        if (anyShort) insufficient++;
      }
    });

    return {
      total: prescriptions.length,
      pending,
      dispensed,
      insufficient,
    };
  }, [prescriptions, medications]);

  // Filter & Search
  const filteredPrescriptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return prescriptions
      .filter((order) => {
        if (statusFilter === 'pending' && order.is_fully_dispensed) return false;
        if (statusFilter === 'dispensed' && !order.is_fully_dispensed) return false;

        if (q) {
          const matchPatient = order.patient_name.toLowerCase().includes(q);
          const matchStudentId = order.patient_student_id?.toLowerCase().includes(q) ?? false;
          const matchDoctor = order.doctor_name.toLowerCase().includes(q);
          const matchDiag = order.diagnosis?.toLowerCase().includes(q) ?? false;
          const matchNotes = order.treatment_notes?.toLowerCase().includes(q) ?? false;
          const matchMeds = order.prescribed_medications.some((m) =>
            m.name.toLowerCase().includes(q)
          );

          if (!matchPatient && !matchStudentId && !matchDoctor && !matchDiag && !matchNotes && !matchMeds) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [prescriptions, searchQuery, statusFilter, sortBy]);

  // Handle Dispense
  const handleConfirmDispense = async () => {
    if (!dispenseTarget || !canManage) return;
    setIsDispensing(true);
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data } = await supabase.auth.getUser();
        effectiveUserId = data.user?.id;
      }
      if (!effectiveUserId) {
        throw new Error('ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
      }

      for (const item of dispenseTarget.prescribed_medications) {
        const med = medications.find(
          (m) => m.id === item.medication_id || m.name.toLowerCase() === item.name.toLowerCase()
        );

        const targetMedId = med ? med.id : item.medication_id;
        const currentStock = med ? med.stock : 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        if (med) {
          const { error: updateError } = await supabase
            .from('medications')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', targetMedId);

          if (updateError) {
            console.error(`Failed to update stock for ${item.name}:`, updateError);
          }
        }

        const reasonText = dispenseReason.trim()
          ? `${dispenseReason.trim()} (จ่ายยาตามใบสั่งแพทย์: ${dispenseTarget.patient_name} บันทึก #${dispenseTarget.id.slice(0, 8)})`
          : `จ่ายยาตามใบสั่งแพทย์: ${dispenseTarget.patient_name} (บันทึก #${dispenseTarget.id.slice(0, 8)})`;

        const { error: logError } = await supabase.from('inventory_logs').insert({
          medication_id: targetMedId,
          pharmacist_id: effectiveUserId,
          action: 'dispense',
          quantity: item.quantity,
          reason: reasonText,
          idempotency_key: `dispense:${dispenseTarget.id}:${item.medication_id}`,
        });

        if (logError) {
          console.error(`Failed to log dispense for ${item.name}:`, logError);
        }
      }

      onShowToast(`ตัดจ่ายยาสำหรับ ${dispenseTarget.patient_name} และอัปเดตสต็อกเรียบร้อยแล้ว`);
      setDispenseTarget(null);
      setDispenseReason('');

      await onStockUpdated();
    } catch (err: unknown) {
      console.error('Dispense error:', err);
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตัดจ่ายยา');
    } finally {
      setIsDispensing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`flex flex-col items-start justify-between rounded-2xl border p-4 text-left transition ${
            statusFilter === 'all'
              ? 'border-sky-500 bg-sky-50/50 shadow-xs ring-2 ring-sky-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">ใบสั่งยาทั้งหมด</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">รวมทุกสถานะ</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={`flex flex-col items-start justify-between rounded-2xl border p-4 text-left transition ${
            statusFilter === 'pending'
              ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">รอตัดจ่ายสต็อก</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-700">{stats.pending}</p>
          <p className="mt-0.5 text-[11px] text-amber-600">ยังไม่ได้ตัดสต็อก</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('dispensed')}
          className={`flex flex-col items-start justify-between rounded-2xl border p-4 text-left transition ${
            statusFilter === 'dispensed'
              ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">ตัดจ่ายเรียบร้อย</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-700">{stats.dispensed}</p>
          <p className="mt-0.5 text-[11px] text-emerald-600">หักสต็อกคลังแล้ว</p>
        </button>

        <div className="flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex w-full items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">ยาที่สต็อกไม่พอ</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-rose-600">{stats.insufficient}</p>
          <p className="mt-0.5 text-[11px] text-rose-500">ใบสั่งยาที่ต้องการเพิ่มสต็อก</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อผู้ป่วย, รหัสนักศึกษา, ชื่อแพทย์ หรือชื่อยาที่สั่งจ่าย..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === 'pending'
                  ? 'bg-amber-100 text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รอตัดจ่าย ({stats.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('dispensed')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === 'dispensed'
                  ? 'bg-emerald-100 text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ตัดจ่ายแล้ว ({stats.dispensed})
            </button>
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="newest">วันที่สั่ง: ล่าสุดก่อน</option>
            <option value="oldest">วันที่สั่ง: เก่าสุดก่อน</option>
          </select>

          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            title="รีเฟรชรายการสั่งยา"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <p className="flex-1">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200 shadow-xs hover:bg-rose-100"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* Prescriptions List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
              <div className="h-5 w-1/3 bg-slate-200 rounded-md mb-3" />
              <div className="h-4 w-1/4 bg-slate-100 rounded-md mb-4" />
              <div className="h-16 w-full bg-slate-50 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredPrescriptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 px-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-800">ไม่พบรายการสั่งยา</h3>
          <p className="mt-1 text-xs text-slate-500">
            {searchQuery || statusFilter !== 'all'
              ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรองที่เลือก'
              : 'ยังไม่มีรายการสั่งยาจากแพทย์ในระบบ'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPrescriptions.map((order) => {
            const hasShortage = order.prescribed_medications.some((item) => {
              const med = medications.find(
                (m) => m.id === item.medication_id || m.name.toLowerCase() === item.name.toLowerCase()
              );
              return !med || med.stock < item.quantity;
            });

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300"
              >
                {/* Order Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                        <User className="h-4 w-4" />
                      </span>
                      <h3 className="font-bold text-slate-900 sm:text-base">
                        {order.patient_name}
                      </h3>
                      {order.patient_student_id && (
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {order.patient_student_id}
                        </span>
                      )}
                      {order.patient_phone && (
                        <span className="text-xs text-slate-500">
                          · {order.patient_phone}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pl-9">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Stethoscope className="h-3.5 w-3.5 text-sky-600" />
                        แพทย์: <strong>{order.doctor_name}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDisplayDateTime(order.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {order.is_fully_dispensed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <CheckCircle2 className="h-4 w-4" />
                        ตัดจ่ายสต็อกแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                        <Clock className="h-4 w-4 text-amber-600" />
                        รอตัดจ่ายสต็อก ({order.dispensed_items_count}/{order.prescribed_medications.length})
                      </span>
                    )}
                  </div>
                </div>

                {/* Diagnosis & Notes */}
                <div className="px-4 py-3 sm:px-5 border-b border-slate-100 bg-white">
                  <div className="text-xs space-y-1">
                    <p className="text-slate-700">
                      <strong className="text-slate-900">ผลวินิจฉัย:</strong> {order.diagnosis}
                    </p>
                    {order.treatment_notes && (
                      <p className="text-slate-600">
                        <strong className="text-slate-900">คำแนะนำ:</strong> {order.treatment_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Medications Table */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-sky-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        รายการยาที่แพทย์สั่งจ่าย ({order.prescribed_medications.length} รายการ)
                      </h4>
                    </div>
                    {hasShortage && !order.is_fully_dispensed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        มีเวชภัณฑ์ที่สต็อกไม่เพียงพอ
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3.5 py-2.5 font-semibold">ชื่อยา / เวชภัณฑ์</th>
                          <th className="px-3.5 py-2.5 font-semibold">ขนาดยา & วิธีใช้</th>
                          <th className="px-3.5 py-2.5 font-semibold text-center">จำนวนที่สั่ง</th>
                          <th className="px-3.5 py-2.5 font-semibold text-center">สต็อกในคลัง</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">ความพร้อมจ่าย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {order.prescribed_medications.map((item, idx) => {
                          const med = medications.find(
                            (m) => m.id === item.medication_id || m.name.toLowerCase() === item.name.toLowerCase()
                          );
                          const currentStock = med ? med.stock : 0;
                          const isSufficient = med ? currentStock >= item.quantity : false;

                          return (
                            <tr key={`${item.medication_id}-${idx}`} className="hover:bg-slate-50/50">
                              <td className="px-3.5 py-2.5 font-medium text-slate-900">
                                {item.name}
                                {med?.type && (
                                  <span className="ml-1.5 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                    {med.type}
                                  </span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-600">
                                <div>{item.dosage}</div>
                                <div className="text-[11px] text-slate-500">
                                  {item.frequency} {item.duration_days ? `· ${item.duration_days} วัน` : ''}
                                </div>
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-bold text-slate-900">
                                {item.quantity}
                              </td>
                              <td className="px-3.5 py-2.5 text-center font-semibold">
                                {med ? (
                                  <span className={currentStock < item.quantity ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                    {currentStock}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-right">
                                {!med ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    ไม่พบยาในคลัง
                                  </span>
                                ) : isSufficient ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                    <CheckCircle2 className="h-3 w-3" />
                                    พร้อมตัดจ่าย
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                    <AlertTriangle className="h-3 w-3" />
                                    สต็อกขาด {item.quantity - currentStock}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-slate-500">
                      {order.is_fully_dispensed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          ตัดจ่ายแล้วเมื่อ {formatDisplayDateTime(order.dispensed_at)}
                          {order.pharmacist_name ? ` (โดย ${order.pharmacist_name})` : ''}
                        </span>
                      ) : (
                        <span>
                          ตัดจ่ายแล้ว {order.dispensed_items_count} จาก {order.prescribed_medications.length} รายการ
                        </span>
                      )}
                    </div>

                    <div>
                      {order.is_fully_dispensed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                          <CheckCircle2 className="h-4 w-4" />
                          จ่ายยาครบถ้วนแล้ว
                        </span>
                      ) : canManage ? (
                        <button
                          type="button"
                          onClick={() => setDispenseTarget(order)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-sky-700 active:scale-95"
                        >
                          <Pill className="h-3.5 w-3.5 shrink-0" />
                          <span>ตัดสต็อกจ่ายยา</span>
                        </button>
                      ) : (
                        <div
                          title="โหมดดูอย่างเดียว: เฉพาะแพทย์หรือเภสัชกรเท่านั้นที่มีสิทธิ์ตัดสต็อกจ่ายยา (Admin และ Staff ดูได้อย่างเดียว)"
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-400 cursor-not-allowed select-none"
                        >
                          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span>ตัดสต็อก (ล็อค)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Dispensing */}
      {dispenseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Pill className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ยืนยันการตัดสต็อกจ่ายยา
                  </h3>
                  <p className="text-xs text-slate-500">
                    ระบบจะตัดลดยอดคงเหลือในคลังยาและบันทึกประวัติการจ่ายยา
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispenseTarget(null)}
                disabled={isDispensing}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Patient Details */}
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">ผู้ป่วย:</span>
                <span className="font-bold text-slate-900">
                  {dispenseTarget.patient_name} {dispenseTarget.patient_student_id ? `(${dispenseTarget.patient_student_id})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">แพทย์ผู้สั่ง:</span>
                <span className="font-semibold text-slate-800">{dispenseTarget.doctor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ผลวินิจฉัย:</span>
                <span className="text-slate-800">{dispenseTarget.diagnosis}</span>
              </div>
            </div>

            {/* Medications Preview Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                รายการเวชภัณฑ์ที่จะตัดสต็อก
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">ยา</th>
                      <th className="px-3 py-2 font-semibold text-center">สั่งจ่าย</th>
                      <th className="px-3 py-2 font-semibold text-center">ปัจจุบัน</th>
                      <th className="px-3 py-2 font-semibold text-center">คงเหลือหลังจ่าย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dispenseTarget.prescribed_medications.map((item, idx) => {
                      const med = medications.find(
                        (m) => m.id === item.medication_id || m.name.toLowerCase() === item.name.toLowerCase()
                      );
                      const currentStock = med ? med.stock : 0;
                      const remain = currentStock - item.quantity;
                      const isShort = remain < 0;

                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {item.name}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-sky-600">
                            -{item.quantity}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-600">
                            {med ? currentStock : 'ไม่พบ'}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">
                            <span className={isShort ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                              {med ? Math.max(0, remain) : '-'}
                            </span>
                            {isShort && (
                              <span className="block text-[10px] text-rose-500">
                                (สต็อกไม่พอ)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Warning if shortage */}
            {dispenseTarget.prescribed_medications.some((item) => {
              const med = medications.find(
                (m) => m.id === item.medication_id || m.name.toLowerCase() === item.name.toLowerCase()
              );
              return !med || med.stock < item.quantity;
            }) && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>
                  <strong>คำเตือน:</strong> มียาบางรายการที่มีสต็อกคงเหลือไม่เพียงพอกับจำนวนที่สั่งจ่าย กรุณาตรวจสอบหรือประสานงานแพทย์ก่อนจ่ายยา
                </span>
              </div>
            )}

            {/* Optional Note */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                หมายเหตุการตัดจ่าย (ถ้ามี)
              </label>
              <input
                type="text"
                value={dispenseReason}
                onChange={(e) => setDispenseReason(e.target.value)}
                placeholder="เช่น จ่ายยาครบตามใบสั่ง หรือระบุหมายเหตุเพิ่มเติม"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDispenseTarget(null)}
                disabled={isDispensing}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDispense()}
                disabled={isDispensing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 transition disabled:opacity-50"
              >
                {isDispensing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>กำลังตัดสต็อก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>ยืนยันการตัดสต็อกจ่ายยา</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
