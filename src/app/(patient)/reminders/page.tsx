'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bell, Pill, ChevronRight, Menu, X, Check, Plus, History, Settings, CalendarIcon 
} from 'lucide-react';
import { useClinicMockDatabase } from '@/features/mock-database/ClinicMockProvider';
import { useAuth } from '@/hooks/useAuth';

// Interface สำหรับข้อมูลยา (ปรับให้ตรงกับ UI)
interface MedicationDisplayItem {
  id: string;
  name: string;
  dosageInstruction: string;
  times: string[];
  stockInfo?: string;
  nextDoseMinutes?: number; // เวลาที่เหลือก่อนถึงมื้อยาถัดไป
  isActive?: boolean;
}

export default function RemindersPage() {
  const { user } = useAuth();
  const patientUserId = user?.id ?? 'profile-peter-parker';
  const { repositories } = useClinicMockDatabase();
  const [medicationList, setMedicationList] = useState<MedicationDisplayItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // สำหรับมือถือ

  // ฟังก์ชันแปลงเวลาเป็นภาษาไทย (เช้า, กลางวัน, เย็น, ก่อนนอน)
  const formatTimeToThai = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 11) return `เช้า ${time} น.`;
    if (hour >= 11 && hour < 15) return `กลางวัน ${time} น.`;
    if (hour >= 15 && hour < 20) return `เย็น ${time} น.`;
    return `ก่อนนอน ${time} น.`;
  };

  const handleToggle = (id: string) => {
    setMedicationList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextActive = !item.isActive;
          void repositories.reminders.updateStatus(id, nextActive ? 'active' : 'paused');
          return { ...item, isActive: nextActive };
        }
        return item;
      })
    );
  };

  // ดึงข้อมูลจาก Database
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      let res = await repositories.reminders.listWithMedication(patientUserId);
      if (!res.data || res.data.length === 0) {
        res = await repositories.reminders.listWithMedication('profile-peter-parker');
      }
      if (!active || !res.data) return;
      
      const mappedList = res.data.flatMap((reminder) => {
        const times = reminder.reminder_times.map((t) => formatTimeToThai(t));
        const med = reminder.medication;
        const desc = med?.description ? ` (${med.description})` : '';
        const dosage = (med as unknown as { dosage?: string })?.dosage ?? `1 ${med?.type ?? 'เม็ด'}`;
        const instruction = reminder.status === 'paused'
          ? `รับทาน ครั้งละ ${dosage} · ยาหยุดชั่วคราว`
          : `รับทาน ครั้งละ ${dosage} · วันละ ${reminder.reminder_times.length} ครั้ง${desc}`;

        return {
          id: reminder.id,
          name: med?.name ?? 'ยาไม่ระบุชื่อ',
          dosageInstruction: instruction,
          times: times,
          stockInfo: `เหลือ ${med?.stock ?? 30} ${med?.type ?? 'เม็ด'}`,
          nextDoseMinutes: 20,
          isActive: reminder.status !== 'paused',
        } satisfies MedicationDisplayItem;
      });
      setMedicationList(mappedList);
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [patientUserId, repositories]);

  return (
    <div className="w-full font-sans text-slate-800">
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col lg:flex-row w-full min-h-[calc(100vh-4rem)]">
        
        {/* --- 2. Sidebar (ซ้าย ชิดขอบ) --- */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col
          lg:static lg:inset-auto lg:z-auto lg:w-64 lg:shrink-0 lg:transform-none lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
             <h2 className="font-bold text-xl text-slate-800">เมนูหลัก</h2>
             <button onClick={() => setIsSidebarOpen(false)} className="ml-auto lg:hidden text-slate-500 hover:text-slate-700">
                <X size={20} />
             </button>
          </div>

          <nav className="p-4 space-y-2 flex-1">
             <SidebarItem icon={<History size={20} />} text="ประวัติการทานยา" />
             <SidebarItem icon={<Bell size={20} />} text="เตือนยา" active />
             <SidebarItem icon={<Settings size={20} />} text="ตั้งค่า" />
          </nav>
        </aside>

        {/* --- 3. Main Content (ขวา) --- */}
        <main className="flex-1 min-w-0 bg-slate-50 p-4 sm:p-6 lg:p-8">
          
          {/* Mobile Header (แสดงเฉพาะมือถือ) */}
          <div className="lg:hidden mb-6 flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                <Menu size={20} />
             </button>
             <h1 className="text-xl font-bold text-slate-800">เตือนยา</h1>
          </div>

          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Header Title (Desktop) */}
            <div className="hidden lg:block mb-8">
              <h1 className="text-2xl font-bold text-slate-800">ข้อมูลยาที่ต้องทาน</h1>
            </div>

            {/* Summary Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                     <CalendarIcon size={20} />
                  </div>
                  <span className="font-bold text-slate-700">ยาทั้งหมด {medicationList.length} รายการ</span>
               </div>
               <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2">
                  เพิ่มยา <Plus size={16} />
               </button>
            </div>

            {/* --- List ยา (ปรับตามภาพ Wu Clinic) --- */}
            <div className="space-y-4">
              {medicationList.map((med) => (
                <div key={med.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                   <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      
                      {/* ซ้าย: ข้อมูลยา (ฉลากยา) */}
                      <div className="flex gap-4 w-full md:w-auto">
                         {/* Icon */}
                         <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <Pill className="text-blue-600" size={28} />
                         </div>

                         {/* Text */}
                         <div className="flex-1">
                            <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{med.name}</h3>
                            <p className="text-slate-600 text-sm mb-3">{med.dosageInstruction}</p>
                            
                            {/* Time Chips */}
                            <div className="flex flex-wrap gap-2">
                               {med.times.map((time, i) => (
                                  <span key={i} className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                                     <Check size={12} /> {time}
                                  </span>
                               ))}
                            </div>
                         </div>
                      </div>

                      {/* ขวา: Toggle & สถานะ */}
                      <div className="flex flex-col items-end gap-2 min-w-[140px] mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                         <span className="text-xs text-slate-400 font-medium">{med.stockInfo}</span>
                         <div className="flex items-center gap-3">
                            <ToggleSwitch active={Boolean(med.isActive)} onToggle={() => handleToggle(med.id)} />
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>

            {/* --- History Timeline --- */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mt-8">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-base">ประวัติการทานยา (7 วันล่าสุด)</h3>
                  <button className="text-blue-600 text-sm font-medium flex items-center gap-1">
                     ดูทั้งหมด <ChevronRight size={16} />
                  </button>
               </div>
               
               <div className="flex justify-between items-center px-2 relative">
                  {/* Line */}
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 z-0"></div>
                  
                  {/* Mock Data Timeline */}
                  {[6, 7, 8, 9, 10, 11, 12].map((date) => {
                     const isDone = date < 10; // Mock: วันก่อนหน้าทานแล้ว
                     return (
                        <div key={date} className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                              isDone 
                                 ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-110' 
                                 : 'bg-white border-slate-300 text-slate-300'
                           }`}>
                              {isDone && <Check size={16} strokeWidth={3} />}
                           </div>
                           <span className={`text-xs font-bold ${isDone ? 'text-blue-600' : 'text-slate-400'}`}>
                              {date} ก.พ.
                           </span>
                        </div>
                     );
                  })}
               </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// --- Components ย่อย ---

function SidebarItem({ icon, text, active = false }: { icon: React.ReactNode, text: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
      active 
         ? 'bg-blue-50 text-blue-700 shadow-sm' 
         : 'text-slate-600 hover:bg-slate-100'
    }`}>
      {icon}
      <span>{text}</span>
    </button>
  );
}

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle?: () => void }) {
  return (
    <button 
      type="button"
      onClick={onToggle}
      className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out flex items-center cursor-pointer ${
        active ? 'bg-blue-600' : 'bg-slate-300'
      }`}
      aria-label="เปิด/ปิดการแจ้งเตือนยา"
    >
      <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ${
        active ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  );
}