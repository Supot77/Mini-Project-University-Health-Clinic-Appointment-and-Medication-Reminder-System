'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  GraduationCap,
  HeartPulse,
  Palmtree,
  Plus,
  Search,
  Umbrella,
  X,
  XCircle,
} from 'lucide-react';
import { useShop } from '@/features/shop/context/ShopProvider';
import { countAffectedSlots } from '@/features/shop/domain/rules';
import type { DoctorLeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/schedule';
import type { UserRole } from '@/types/database';

const DEMO_TODAY = '2026-09-07';

interface LeaveWorkspaceProps {
  role?: UserRole;
  actorId?: string;
}

const leaveTypeLabels: Record<LeaveType, { label: string; icon: typeof Palmtree; badgeClass: string }> = {
  vacation: {
    label: 'ลาพักร้อน',
    icon: Palmtree,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  sick: {
    label: 'ลาป่วย',
    icon: HeartPulse,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  academic: {
    label: 'ลาประชุมวิชาการ/อบรม',
    icon: GraduationCap,
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  personal: {
    label: 'ลากิจ',
    icon: Umbrella,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

const statusLabels: Record<LeaveRequestStatus, { label: string; badgeClass: string; icon: typeof Clock }> = {
  pending: {
    label: 'รออนุมัติ',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
  },
  approved: {
    label: 'อนุมัติแล้ว',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'ไม่อนุมัติ',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: XCircle,
  },
};

const monthNamesTh = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatThaiDate(isoDate: string) {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const year = parseInt(parts[0], 10) + 543;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${monthNamesTh[month]} ${year}`;
}

function calculateDays(start: string, end: string) {
  if (!start || !end) return 1;
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
}

export default function LeaveWorkspace({ role = 'staff_admin', actorId = 'mock-staff' }: LeaveWorkspaceProps) {
  const { doctors, departments, slots, leaveRequests, submitLeave, decideLeave, cancelLeave } = useShop();

  const isStaffAdmin = role === 'staff_admin';

  // Find if current user is a doctor
  const currentDoctor = useMemo(() => {
    return doctors.find((doctor) => doctor.profileId === actorId || doctor.id === actorId);
  }, [doctors, actorId]);

  // UI state
  const [activeTab, setActiveTab] = useState<'all' | LeaveRequestStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LeaveType>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [leaveDraft, setLeaveDraft] = useState<{
    doctorId: string;
    startDate: string;
    endDate: string;
    leaveType: LeaveType;
    reason: string;
  }>({
    doctorId: currentDoctor?.id ?? '',
    startDate: DEMO_TODAY,
    endDate: DEMO_TODAY,
    leaveType: 'vacation',
    reason: '',
  });

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    leave: DoctorLeaveRequest;
    decision: 'approved' | 'rejected';
    note: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Live calculation of affected slots in the draft form
  const draftAffectedSlotsCount = useMemo(() => {
    if (!leaveDraft.doctorId || !leaveDraft.startDate || !leaveDraft.endDate) return 0;
    return countAffectedSlots(slots, leaveDraft.doctorId, leaveDraft.startDate, leaveDraft.endDate);
  }, [slots, leaveDraft.doctorId, leaveDraft.startDate, leaveDraft.endDate]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return leaveRequests
      .slice()
      .sort((a, b) => {
        // Pending first, then newest
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return (b.createdAt ?? b.startDate).localeCompare(a.createdAt ?? a.startDate);
      })
      .filter((req) => {
        if (activeTab !== 'all' && req.status !== activeTab) return false;
        if (typeFilter !== 'all' && req.leaveType !== typeFilter) return false;
        if (doctorFilter !== 'all' && req.doctorId !== doctorFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const doc = doctors.find((d) => d.id === req.doctorId);
          const docName = doc?.fullName.toLowerCase() ?? '';
          const reason = req.reason.toLowerCase();
          const note = req.decisionNote?.toLowerCase() ?? '';
          if (!docName.includes(q) && !reason.includes(q) && !note.includes(q)) return false;
        }
        return true;
      });
  }, [leaveRequests, activeTab, typeFilter, doctorFilter, searchQuery, doctors]);

  // Statistics Summary
  const stats = useMemo(() => {
    const pending = leaveRequests.filter((r) => r.status === 'pending').length;
    const onLeaveToday = leaveRequests.filter(
      (r) => r.status === 'approved' && r.startDate <= DEMO_TODAY && r.endDate >= DEMO_TODAY
    ).length;
    const approvedMonth = leaveRequests.filter(
      (r) => r.status === 'approved' && r.startDate.startsWith(DEMO_TODAY.slice(0, 7))
    ).length;
    const totalClosedSlots = slots.filter((s) => s.status === 'closed' && s.closedReason === 'doctor_leave').length;
    return { pending, onLeaveToday, approvedMonth, totalClosedSlots };
  }, [leaveRequests, slots]);

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!leaveDraft.doctorId) {
      setFormError('กรุณาเลือกแพทย์ที่ต้องการยื่นลา');
      return;
    }
    if (!leaveDraft.reason.trim()) {
      setFormError('กรุณาระบุเหตุผลการลา');
      return;
    }
    const result = submitLeave({
      doctorId: leaveDraft.doctorId,
      startDate: leaveDraft.startDate,
      endDate: leaveDraft.endDate,
      leaveType: leaveDraft.leaveType,
      reason: leaveDraft.reason.trim(),
      requestedBy: actorId,
    });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setNotice('ส่งคำขอการลาเรียบร้อยแล้ว');
    setFormOpen(false);
    setLeaveDraft({
      doctorId: currentDoctor?.id ?? '',
      startDate: DEMO_TODAY,
      endDate: DEMO_TODAY,
      leaveType: 'vacation',
      reason: '',
    });
  };

  const handleConfirmDecision = () => {
    if (!decisionModal) return;
    const { leave, decision, note } = decisionModal;
    const result = decideLeave(leave.id, decision, actorId, DEMO_TODAY, note);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setNotice(
      decision === 'approved'
        ? 'อนุมัติคำขอลาและปิดรอบตรวจที่เกี่ยวข้องเรียบร้อย'
        : 'บันทึกการไม่อนุมัติคำขอเรียบร้อย'
    );
    setDecisionModal(null);
  };

  const handleCancelLeave = (id: string) => {
    if (!confirm('ยืนยันยกเลิกคำขอการลานี้ใช่หรือไม่?')) return;
    const result = cancelLeave(id, actorId);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setNotice('ยกเลิกคำขอการลาแล้ว');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Notifications / Alerts */}
      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {formError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
          <button type="button" onClick={() => setFormError(null)} className="text-rose-700 hover:text-rose-950">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Header & KPI Statistics */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600">
              <Umbrella className="h-4 w-4" />
              <span>Doctor Leave Management</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">ระบบจัดการวันลาแพทย์</h1>
            <p className="mt-1 text-sm text-slate-500">
              ยื่นคำขอลา ตรวจสอบผลกระทบต่อรอบตรวจ และดำเนินการปิดรับนัดอัตโนมัติเมื่อได้รับการอนุมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormOpen(true);
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0a2540] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123e67]"
          >
            <Plus className="h-4 w-4" />
            <span>ส่งคำขอลาใหม่</span>
          </button>
        </div>

        {/* 4 Stat Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="text-xs font-semibold text-amber-800">รอการพิจารณา</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{stats.pending}</div>
            <div className="mt-0.5 text-[11px] text-amber-700">คำขอที่รอเจ้าหน้าที่ตรวจสอบ</div>
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
            <div className="text-xs font-semibold text-violet-800">แพทย์ที่ลาอยู่วันนี้</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-violet-900">{stats.onLeaveToday}</div>
            <div className="mt-0.5 text-[11px] text-violet-700">ตรงกับวันที่ {formatThaiDate(DEMO_TODAY)}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="text-xs font-semibold text-emerald-800">อนุมัติในเดือนนี้</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{stats.approvedMonth}</div>
            <div className="mt-0.5 text-[11px] text-emerald-700">รายการลาที่ผ่านการอนุมัติแล้ว</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-600">รอบตรวจที่ปิดเนื่องจากลา</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stats.totalClosedSlots}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">ปิดรับนัดอัตโนมัติป้องกันคนไข้จอง</div>
          </div>
        </div>
      </section>

      {/* 3. Filter Toolbar */}
      <section aria-label="เครื่องมือกรองและค้นหา" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({leaveRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'pending'
                  ? 'bg-white text-amber-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รออนุมัติ ({leaveRequests.filter((r) => r.status === 'pending').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'approved'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              อนุมัติแล้ว ({leaveRequests.filter((r) => r.status === 'approved').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'rejected'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ไม่อนุมัติ ({leaveRequests.filter((r) => r.status === 'rejected').length})
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อแพทย์ หรือเหตุผล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Leave Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none"
            >
              <option value="all">ทุกประเภทการลา</option>
              <option value="vacation">🏖️ ลาพักร้อน</option>
              <option value="sick">🤒 ลาป่วย</option>
              <option value="academic">🎓 ลาประชุมวิชาการ</option>
              <option value="personal">📋 ลากิจ</option>
            </select>

            {/* Doctor filter (for staff) */}
            {isStaffAdmin && (
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none"
              >
                <option value="all">แพทย์ทุกคน</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {/* 4. Requests List */}
      <section aria-label="รายการคำขอวันลา" className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <Umbrella className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-800">ไม่พบคำขอการลา</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchQuery || typeFilter !== 'all' || activeTab !== 'all'
                ? 'ลองปรับเปลี่ยนเงื่อนไขการค้นหาหรือตัวกรองด้านบน'
                : 'ยังไม่มีประวัติการส่งคำขอลาในระบบ'}
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>ส่งคำขอลาตอนนี้</span>
            </button>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const doctor = doctors.find((d) => d.id === req.doctorId);
            const dept = departments.find((d) => d.id === doctor?.departmentId);
            const typeConfig = leaveTypeLabels[req.leaveType ?? 'personal'];
            const statusConfig = statusLabels[req.status];
            const StatusIcon = statusConfig.icon;
            const TypeIcon = typeConfig.icon;
            const daysCount = calculateDays(req.startDate, req.endDate);

            // Compute affected slots for this specific request
            const affectedCount = countAffectedSlots(slots, req.doctorId, req.startDate, req.endDate);

            return (
              <article
                key={req.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-violet-300 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.badgeClass}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span>{statusConfig.label}</span>
                    </span>

                    {/* Leave Type Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeConfig.badgeClass}`}
                    >
                      <TypeIcon className="h-3 w-3" />
                      <span>{typeConfig.label}</span>
                    </span>

                    {/* Department Tag */}
                    {dept && (
                      <span className="text-xs text-slate-400">
                        {dept.name}
                      </span>
                    )}
                  </div>

                  {/* Doctor & Date */}
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-slate-950">
                      {doctor?.fullName ?? 'แพทย์ในระบบ'}
                      {doctor?.specialty && (
                        <span className="ml-2 text-xs font-normal text-slate-500">({doctor.specialty})</span>
                      )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">
                        {formatThaiDate(req.startDate)} – {formatThaiDate(req.endDate)}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                        {daysCount} วัน
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-slate-700">
                    <strong className="font-medium text-slate-900">เหตุผล:</strong> {req.reason}
                  </p>

                  {/* Decision Note or Impact Barometer */}
                  {req.status === 'pending' ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {affectedCount > 0
                          ? `พบ ${affectedCount} รอบตรวจที่เปิดไว้ — ระบบจะปิดรอบตรวจอัตโนมัติเมื่ออนุมัติ`
                          : 'ไม่พบรอบตรวจที่ตรงกับช่วงวันลาดังกล่าว'}
                      </span>
                    </div>
                  ) : req.status === 'approved' ? (
                    <div className="space-y-0.5 text-xs text-emerald-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>อนุมัติคำขอแล้ว (ปิดรอบตรวจที่เกี่ยวข้องแล้ว)</span>
                      </div>
                      {req.decisionNote && (
                        <p className="text-slate-500">บันทึก: {req.decisionNote}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-xs text-rose-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>ไม่อนุมัติคำขอการลา</span>
                      </div>
                      {req.decisionNote && (
                        <p className="text-slate-500">เหตุผลประกอบ: {req.decisionNote}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-center">
                  {/* Staff_Admin Decision Buttons */}
                  {isStaffAdmin && req.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setDecisionModal({
                            leave: req,
                            decision: 'approved',
                            note: '',
                          })
                        }
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>อนุมัติ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDecisionModal({
                            leave: req,
                            decision: 'rejected',
                            note: '',
                          })
                        }
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <span>ไม่อนุมัติ</span>
                      </button>
                    </>
                  )}

                  {/* Cancel Button (Available for author/doctor or staff if pending) */}
                  {req.status === 'pending' && (isStaffAdmin || req.requestedBy === actorId) && (
                    <button
                      type="button"
                      onClick={() => handleCancelLeave(req.id)}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                      title="ยกเลิกคำขอนี้"
                    >
                      ยกเลิกคำขอ
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* 5. Submit Leave Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="submit-leave-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Umbrella className="h-4 w-4" />
                </div>
                <h2 id="submit-leave-title" className="text-lg font-bold text-slate-900">
                  ส่งคำขอวันลาแพทย์
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="mt-4 space-y-4">
              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">แพทย์ผู้ขอลา</label>
                <select
                  value={leaveDraft.doctorId}
                  onChange={(e) => setLeaveDraft((c) => ({ ...c, doctorId: e.target.value }))}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-violet-500 focus:outline-none"
                >
                  <option value="">-- เลือกแพทย์ --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.specialty || 'แพทย์'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">ประเภทการลา</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(leaveTypeLabels) as LeaveType[]).map((t) => {
                    const cfg = leaveTypeLabels[t];
                    const active = leaveDraft.leaveType === t;
                    const Icon = cfg.icon;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setLeaveDraft((c) => ({ ...c, leaveType: t }))}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-medium transition ${
                          active
                            ? 'border-violet-600 bg-violet-50 text-violet-900 font-semibold ring-1 ring-violet-600'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">เริ่มตั้งแต่วันที่</label>
                  <input
                    type="date"
                    value={leaveDraft.startDate}
                    onChange={(e) => setLeaveDraft((c) => ({ ...c, startDate: e.target.value }))}
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">ถึงวันที่</label>
                  <input
                    type="date"
                    value={leaveDraft.endDate}
                    onChange={(e) => setLeaveDraft((c) => ({ ...c, endDate: e.target.value }))}
                    required
                    min={leaveDraft.startDate}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Signature Feature: Live Impact Preview Barometer */}
              <div
                className={`rounded-xl border p-3 text-xs transition ${
                  draftAffectedSlotsCount > 0
                    ? 'border-amber-200 bg-amber-50/80 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {draftAffectedSlotsCount > 0 ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                  <div>
                    <span className="font-bold">
                      {draftAffectedSlotsCount > 0
                        ? `ตรวจพบ ${draftAffectedSlotsCount} รอบตรวจที่เปิดไว้ในช่วงเวลานี้`
                        : 'ไม่พบรอบตรวจที่ตรงกับช่วงเวลานี้'}
                    </span>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                      {draftAffectedSlotsCount > 0
                        ? 'เมื่อคำขอนี้ได้รับการอนุมัติ ระบบจะดำเนินการปิดรับนัดและเปลี่ยนสถานะเป็น "ปิดรับนัด (แพทย์ลา)" โดยอัตโนมัติ'
                        : 'สามารถยื่นคำขอได้อย่างราบรื่น ไม่มีการเปิดรอบตรวจชนกับช่วงวันลา'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">เหตุผลการลา</label>
                <textarea
                  rows={2}
                  value={leaveDraft.reason}
                  onChange={(e) => setLeaveDraft((c) => ({ ...c, reason: e.target.value }))}
                  placeholder="เช่น ลาพักผ่อนประจำปี, เข้าร่วมงานสัมมนาวิชาการทางการแพทย์..."
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0a2540] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123e67]"
                >
                  ส่งคำขอลา
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Decision Modal (Approve / Reject) */}
      {decisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="decision-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
          >
            <h2 id="decision-title" className="text-lg font-bold text-slate-950">
              {decisionModal.decision === 'approved' ? 'อนุมัติคำขอการลา' : 'ปฏิเสธคำขอการลา'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {decisionModal.decision === 'approved'
                ? 'เมื่อยืนยัน ระบบจะปิดรอบตรวจของแพทย์ที่ตรงกับวันลาดังกล่าวโดยอัตโนมัติ'
                : 'ระบุเหตุผลในการไม่อนุมัติคำขอ เพื่อแจ้งให้แพทย์ทราบ'}
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs space-y-1 text-slate-700">
              <div>
                <strong>แพทย์:</strong>{' '}
                {doctors.find((d) => d.id === decisionModal.leave.doctorId)?.fullName ?? '-'}
              </div>
              <div>
                <strong>ช่วงเวลา:</strong> {formatThaiDate(decisionModal.leave.startDate)} –{' '}
                {formatThaiDate(decisionModal.leave.endDate)}
              </div>
              <div>
                <strong>เหตุผล:</strong> {decisionModal.leave.reason}
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700">บันทึกเพิ่มเติม (ไม่บังคับ)</label>
              <input
                type="text"
                value={decisionModal.note}
                onChange={(e) => setDecisionModal((c) => (c ? { ...c, note: e.target.value } : null))}
                placeholder={
                  decisionModal.decision === 'approved'
                    ? 'เช่น อนุมัติเรียบร้อย ได้ตรวจสอบรอบตรวจแล้ว'
                    : 'เช่น ช่วงเวลาดังกล่าวมีภาระงานตรวจหนาแน่น'
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm ${
                  decisionModal.decision === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {decisionModal.decision === 'approved' ? 'ยืนยันอนุมัติ' : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
