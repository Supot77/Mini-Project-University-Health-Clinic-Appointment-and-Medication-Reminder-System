'use client';

import { useState } from 'react';
import { Search, Phone, AlertCircle, HeartPulse, Loader2 } from 'lucide-react';
import { searchPatients } from '@/services/authService';
import type { Profile } from '@/types/database';

const healthStatusLabel: Record<string, { text: string; className: string }> = {
  yes: { text: 'มี', className: 'bg-red-100 text-red-700 border-red-200' },
  no: { text: 'ไม่มี', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  unknown: { text: 'ไม่ทราบ', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

function HealthBadge({ status }: { status: string | null }) {
  const info = healthStatusLabel[status ?? 'unknown'] ?? healthStatusLabel.unknown;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${info.className}`}>
      {info.text}
    </span>
  );
}

export default function PatientSearchContent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setSearched(true);
    try {
      const data = await searchPatients(query);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">ค้นหาผู้ป่วย</h1>
        <p className="text-sm text-zinc-500 mt-1">ค้นหาด้วยรหัสนักศึกษาหรือเบอร์โทรศัพท์ ก่อนเข้ารับการรักษา</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="รหัสนักศึกษา หรือ เบอร์โทรศัพท์"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-sky-500 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-sky-600 transition disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          ค้นหา
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {searched && !isLoading && !error && results.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-8">ไม่พบข้อมูลผู้ป่วยที่ตรงกับคำค้นหา</p>
      )}

      <div className="space-y-3">
        {results.map((patient) => (
          <div key={patient.id} className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-semibold text-zinc-900">{patient.full_name}</h2>
                <p className="text-sm text-zinc-500">รหัสนักศึกษา: {patient.student_id || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-700 mb-3">
              <Phone className="size-4 text-zinc-400" />
              {patient.phone || 'ไม่มีข้อมูลเบอร์โทร'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5" /> ประวัติแพ้ยา
                  </p>
                  <HealthBadge status={patient.allergy_status ?? null} />
                </div>
                {patient.allergy_status === 'yes' && (
                  <p className="text-sm text-zinc-700 mt-1">{patient.allergies}</p>
                )}
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-rose-700 flex items-center gap-1.5">
                    <HeartPulse className="size-3.5" /> โรคประจำตัว
                  </p>
                  <HealthBadge status={patient.chronic_disease_status ?? null} />
                </div>
                {patient.chronic_disease_status === 'yes' && (
                  <p className="text-sm text-zinc-700 mt-1">{patient.chronic_diseases}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}