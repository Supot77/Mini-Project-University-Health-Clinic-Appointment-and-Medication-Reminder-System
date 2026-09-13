import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PharmacyContent from '@/components/pharmacy/PharmacyContent';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    role: 'medical',
    isLoading: false,
  }),
}));

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [
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
          ],
          error: null,
        }),
      }),
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
    expect(await screen.findByText('ดูอย่างเดียว (ล็อค)')).toBeInTheDocument();
  });

  it('shows locked add button and read-only status for staff_admin role', async () => {
    render(<PharmacyContent currentRole="staff_admin" userName="เจ้าหน้าที่ สมใจ" />);

    expect(screen.getByText(/เจ้าหน้าที่คลินิก \(Staff - ดูอย่างเดียว\)/)).toBeInTheDocument();
    expect(screen.getByText('นำเข้าเวชภัณฑ์ใหม่ (ล็อค)')).toBeInTheDocument();
    expect(await screen.findByText('ดูอย่างเดียว (ล็อค)')).toBeInTheDocument();
  });

  it('shows active add button and manage actions for medical role', async () => {
    render(<PharmacyContent currentRole="medical" userName="นพ. สมชาย" />);

    expect(screen.getByText(/บุคลากรทางการแพทย์ \(Medical - จัดการยาได้\)/)).toBeInTheDocument();
    expect(screen.getByText('นำเข้าเวชภัณฑ์ใหม่')).toBeInTheDocument();
    expect(screen.queryByText('นำเข้าเวชภัณฑ์ใหม่ (ล็อค)')).not.toBeInTheDocument();

    // Active edit button should exist
    expect(await screen.findByTitle('แก้ไขข้อมูล')).toBeInTheDocument();
    expect(screen.getByTitle('ลบ / พักการใช้งานเวชภัณฑ์')).toBeInTheDocument();
  });
});

