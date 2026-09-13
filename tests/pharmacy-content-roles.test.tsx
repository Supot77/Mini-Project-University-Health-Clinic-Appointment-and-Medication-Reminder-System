import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PharmacyContent from '@/components/pharmacy/PharmacyContent';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-med-1', email: 'doctor@wu.ac.th' },
    role: 'medical',
    isLoading: false,
  }),
}));

const mockMedications = [
  {
    id: 'med-1',
    name: 'Paracetamol 500mg',
    type: 'เม็ด',
    category: 'ยาแก้ปวดลดไข้',
    stock: 50,
    min_stock: 20,
    expiry_date: '2027-12-31',
    is_active: true,
  },
  {
    id: 'med-2',
    name: 'Amoxicillin 500mg',
    type: 'แคปซูล',
    category: 'ยาปฏิชีวนะ',
    stock: 10,
    min_stock: 15,
    expiry_date: '2027-06-30',
    is_active: true,
  },
];

const mockMedicalRecords = [
  {
    id: 'rec-1',
    appointment_id: 'apt-1',
    patient_id: 'pat-1',
    doctor_id: 'doc-1',
    diagnosis: 'ไข้หวัดทั่วไป มีไข้สูง',
    treatment_notes: 'พักผ่อน ดื่มน้ำมากๆ',
    prescribed_medications: [
      {
        medication_id: 'med-1',
        name: 'Paracetamol 500mg',
        dosage: '1 เม็ด',
        frequency: 'หลังอาหาร เช้า-เย็น',
        duration_days: 3,
        quantity: 6,
      },
    ],
    created_at: '2026-09-13T10:00:00Z',
  },
  {
    id: 'rec-2',
    appointment_id: 'apt-2',
    patient_id: 'pat-2',
    doctor_id: 'doc-1',
    diagnosis: 'ปวดท้องโรคกระเพาะ',
    treatment_notes: 'รับประทานยาตรงเวลา',
    prescribed_medications: [
      {
        medication_id: 'med-2',
        name: 'Amoxicillin 500mg',
        dosage: '1 เม็ด',
        frequency: 'ก่อนอาหาร เช้า-เย็น',
        duration_days: 5,
        quantity: 10,
        dispensed: true,
        dispensed_at: '2026-09-13T11:00:00Z',
        dispensed_by: 'doc-1',
      },
    ],
    created_at: '2026-09-13T09:00:00Z',
  },
];

const mockProfiles = [
  {
    id: 'pat-1',
    full_name: 'นายสมศักดิ์ รักเรียน',
    student_id: '65123456',
    phone: '0812345678',
    role: 'patient',
  },
  {
    id: 'pat-2',
    full_name: 'นางสาว อารียา สุขใจ',
    student_id: '65123999',
    phone: '0898765432',
    role: 'patient',
  },
  {
    id: 'doc-1',
    full_name: 'นพ. วิชัย เก่งการุณ',
    role: 'medical',
  },
];

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-med-1' } }, error: null }),
    },
    from: (table: string) => ({
      select: () => {
        const queryObj = {
          order: () => {
            if (table === 'medications') {
              return Promise.resolve({ data: mockMedications, error: null });
            }
            if (table === 'medical_records') {
              return Promise.resolve({ data: mockMedicalRecords, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
          in: (_col: string, ids: string[]) => {
            if (table === 'profiles') {
              const matched = mockProfiles.filter((p) => ids.includes(p.id));
              return Promise.resolve({ data: matched, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
          eq: () => Promise.resolve({ data: [], error: null }),
        };
        return queryObj;
      },
      update: () => ({
        eq: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));

describe('PharmacyContent Role Permissions & Lock Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows locked add button and read-only status for admin role', async () => {
    render(<PharmacyContent currentRole="admin" userName="แอดมิน สมบัติ" />);

    // Check header badge
    expect(screen.getByText(/ผู้ดูแลระบบ \(Admin - ดูอย่างเดียว\)/)).toBeInTheDocument();

    // Check read-only banner
    expect(screen.getByText(/โหมดดูอย่างเดียว \(Read-Only\)/)).toBeInTheDocument();

    // Check locked add button
    expect(screen.getByText('นำเข้าเวชภัณฑ์ใหม่ (ล็อค)')).toBeInTheDocument();

    // Check table row has read-only lock
    const lockedRows = await screen.findAllByText('ดูอย่างเดียว (ล็อค)');
    expect(lockedRows.length).toBeGreaterThan(0);
  });

  it('shows locked add button and read-only status for staff_admin role', async () => {
    render(<PharmacyContent currentRole="staff_admin" userName="เจ้าหน้าที่ สมใจ" />);

    expect(screen.getByText(/เจ้าหน้าที่คลินิก \(Staff - ดูอย่างเดียว\)/)).toBeInTheDocument();
    expect(screen.getByText('นำเข้าเวชภัณฑ์ใหม่ (ล็อค)')).toBeInTheDocument();
    const lockedRows = await screen.findAllByText('ดูอย่างเดียว (ล็อค)');
    expect(lockedRows.length).toBeGreaterThan(0);
  });

  it('shows active add button and manage actions for medical role', async () => {
    render(<PharmacyContent currentRole="medical" userName="นพ. สมชาย" />);

    expect(screen.getByText(/บุคลากรทางการแพทย์ \(Medical - จัดการยาได้\)/)).toBeInTheDocument();
    expect(screen.getByText('นำเข้าเวชภัณฑ์ใหม่')).toBeInTheDocument();
    expect(screen.queryByText('นำเข้าเวชภัณฑ์ใหม่ (ล็อค)')).not.toBeInTheDocument();

    // Active edit and delete buttons should exist
    const editButtons = await screen.findAllByTitle('แก้ไขข้อมูล');
    expect(editButtons.length).toBeGreaterThan(0);
    const deleteButtons = screen.getAllByTitle('ลบ / พักการใช้งานเวชภัณฑ์');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('switches to prescriptions tab and displays prescription details', async () => {
    render(<PharmacyContent currentRole="medical" userName="นพ. สมชาย" />);

    // Click on prescriptions tab
    const prescriptionsTab = screen.getByRole('button', {
      name: /รายการสั่งยาและตัดจ่าย/,
    });
    expect(prescriptionsTab).toBeInTheDocument();
    fireEvent.click(prescriptionsTab);

    // Verify patient name and doctor name are shown
    expect(await screen.findByText('นายสมศักดิ์ รักเรียน')).toBeInTheDocument();
    expect(screen.getByText('65123456')).toBeInTheDocument();
    expect(screen.getAllByText('นพ. วิชัย เก่งการุณ').length).toBeGreaterThan(0);
    expect(screen.getByText(/ไข้หวัดทั่วไป/)).toBeInTheDocument();

    // Verify medication details and stock status
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    expect(screen.getAllByText('พร้อมตัดจ่าย').length).toBeGreaterThan(0);

    // Role medical should see active dispense button
    expect(screen.getByRole('button', { name: /ตัดสต็อกจ่ายยา/ })).toBeInTheDocument();
  });

  it('shows locked dispense button in prescriptions tab for admin role', async () => {
    render(<PharmacyContent currentRole="admin" userName="แอดมิน สมบัติ" />);

    const prescriptionsTab = screen.getByRole('button', {
      name: /รายการสั่งยาและตัดจ่าย/,
    });
    fireEvent.click(prescriptionsTab);

    expect(await screen.findByText('นายสมศักดิ์ รักเรียน')).toBeInTheDocument();

    // Role admin should see locked dispense indicator
    expect(screen.getByText('ตัดสต็อก (ล็อค)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ตัดสต็อกจ่ายยา' })).not.toBeInTheDocument();
  });

  it('shows locked dispense button in prescriptions tab for staff_admin role', async () => {
    render(<PharmacyContent currentRole="staff_admin" userName="เจ้าหน้าที่ สมใจ" />);

    const prescriptionsTab = screen.getByRole('button', {
      name: /รายการสั่งยาและตัดจ่าย/,
    });
    fireEvent.click(prescriptionsTab);

    expect(await screen.findByText('นายสมศักดิ์ รักเรียน')).toBeInTheDocument();

    // Role staff_admin should see locked dispense indicator
    expect(screen.getByText('ตัดสต็อก (ล็อค)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ตัดสต็อกจ่ายยา' })).not.toBeInTheDocument();
  });

  it('displays dispensed badge and disabled action for already dispensed prescriptions', async () => {
    render(<PharmacyContent currentRole="medical" userName="นพ. สมชาย" />);

    const prescriptionsTab = screen.getByRole('button', {
      name: /รายการสั่งยาและตัดจ่าย/,
    });
    fireEvent.click(prescriptionsTab);

    // Wait for prescriptions to load
    expect(await screen.findByText('ปวดท้องโรคกระเพาะ')).toBeInTheDocument();

    // The dispensed prescription (rec-2) should show "จ่ายยาครบถ้วนแล้ว"
    expect(screen.getByText('จ่ายยาครบถ้วนแล้ว')).toBeInTheDocument();
    expect(screen.getByText('ตัดจ่ายสต็อกแล้ว')).toBeInTheDocument();
  });

  it('opens confirmation modal when clicking dispense and handles confirm', async () => {
    render(<PharmacyContent currentRole="medical" userName="นพ. สมชาย" />);

    const prescriptionsTab = screen.getByRole('button', {
      name: /รายการสั่งยาและตัดจ่าย/,
    });
    fireEvent.click(prescriptionsTab);

    expect(await screen.findByText('ไข้หวัดทั่วไป มีไข้สูง')).toBeInTheDocument();

    const dispenseBtn = screen.getByRole('button', { name: /ตัดสต็อกจ่ายยา/ });
    fireEvent.click(dispenseBtn);

    // Confirmation modal should open
    expect(screen.getByRole('heading', { name: 'ยืนยันการตัดสต็อกจ่ายยา' })).toBeInTheDocument();
    expect(screen.getByText('รายการเวชภัณฑ์ที่จะตัดสต็อก')).toBeInTheDocument();
    expect(screen.getByText('คงเหลือหลังจ่าย')).toBeInTheDocument();

    // Click confirm button
    const confirmBtn = screen.getByRole('button', { name: /ยืนยันการตัดสต็อกจ่ายยา/ });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });
  });
});
