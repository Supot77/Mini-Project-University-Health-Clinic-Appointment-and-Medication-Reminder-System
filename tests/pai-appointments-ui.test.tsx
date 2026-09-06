import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppointmentWorkspace from '@/features/pai/appointments/AppointmentWorkspace';

function openBooking() {
  fireEvent.click(screen.getByRole('button', { name: 'จองนัดหมายใหม่' }));
  return within(screen.getByRole('region', { name: 'จองนัดหมายใหม่' }));
}

describe('appointment preview workspace', () => {
  it('books a selected slot and shows the resulting pending request in the patient list', () => {
    render(<AppointmentWorkspace />);
    const booking = openBooking();
    expect(booking.getByLabelText('วันที่ต้องการนัด')).toHaveAttribute('min', '2026-09-08');
    expect(booking.getByLabelText('วันที่ต้องการนัด')).toHaveAttribute('max', '2026-09-21');
    expect(booking.getByRole('button', { name: 'ยืนยันส่งคำขอนัด' })).toBeDisabled();

    fireEvent.click(booking.getByRole('button', { name: /09:00–09:30/ }));
    fireEvent.change(booking.getByLabelText('อาการเบื้องต้น / เหตุผลที่นัด'), { target: { value: 'ปรึกษาอาการทั่วไป' } });
    fireEvent.click(booking.getByRole('button', { name: 'ยืนยันส่งคำขอนัด' }));

    expect(screen.queryByRole('region', { name: 'จองนัดหมายใหม่' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('รอเจ้าหน้าที่อนุมัติ');
    expect(within(screen.getByRole('article', { name: 'นัดหมาย APT-007' })).getByText('รออนุมัติ')).toBeInTheDocument();
  });

  it('switches preview roles, clears transient filters and exposes only each role’s appointment actions', () => {
    render(<AppointmentWorkspace />);
    openBooking();
    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหานัดหมาย' }), { target: { value: 'unknown' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'มุมมองตัวอย่าง' }), { target: { value: 'staff' } });

    expect(screen.queryByRole('region', { name: 'จองนัดหมายใหม่' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'จองนัดหมายใหม่' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ค้นหานัดหมาย' })).toHaveValue('');
    expect(screen.getByRole('article', { name: 'นัดหมาย APT-004' })).toBeInTheDocument();
    const pending = within(screen.getByRole('article', { name: 'นัดหมาย APT-002' }));
    fireEvent.click(pending.getByRole('button', { name: 'อนุมัตินัด' }));
    expect(pending.getByText('ยืนยันแล้ว')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'มุมมองตัวอย่าง' }), { target: { value: 'doctor' } });
    expect(screen.queryByRole('article', { name: 'นัดหมาย APT-004' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อนุมัตินัด' })).not.toBeInTheDocument();
    const ownAppointment = within(screen.getByRole('article', { name: 'นัดหมาย APT-001' }));
    fireEvent.click(ownAppointment.getByRole('button', { name: 'เริ่มตรวจ' }));
    expect(ownAppointment.getByText('กำลังตรวจ')).toBeInTheDocument();
    expect(ownAppointment.getByRole('link', { name: 'ไปหน้าบันทึกผลตรวจ' })).toHaveAttribute('href', '/records');
  });

  it('shows an empty search result and restores the list when filters are cleared', () => {
    render(<AppointmentWorkspace />);
    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหานัดหมาย' }), { target: { value: 'no-such-appointment' } });

    expect(screen.getByRole('heading', { name: 'ไม่พบนัดหมาย' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'ประวัตินัดหมาย' }));
    expect(screen.getByText('เมื่อมีรายการนัดหมาย จะแสดงในส่วนนี้')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ล้างตัวกรอง' })).not.toBeInTheDocument();
  });

  it('keeps failed bookings editable, disables unavailable slots and resets the selected slot after changing departments', () => {
    render(<AppointmentWorkspace />);
    const booking = openBooking();
    expect(booking.getByRole('button', { name: /09:30–10:00.*เต็มแล้ว/ })).toBeDisabled();
    fireEvent.click(booking.getByRole('button', { name: /09:00–09:30/ }));
    fireEvent.change(booking.getByLabelText('อาการเบื้องต้น / เหตุผลที่นัด'), { target: { value: '   ' } });
    fireEvent.click(booking.getByRole('button', { name: 'ยืนยันส่งคำขอนัด' }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาระบุอาการเบื้องต้น');
    expect(screen.queryByRole('article', { name: 'นัดหมาย APT-007' })).not.toBeInTheDocument();
    expect(booking.getByRole('button', { name: /09:00–09:30/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(booking.getByLabelText('แผนก'), { target: { value: 'ทันตกรรม' } });
    expect(booking.getByRole('button', { name: 'ยืนยันส่งคำขอนัด' })).toBeDisabled();
    expect(booking.getByRole('button', { name: /10:00–10:30.*ปิดรับจอง/ })).toBeDisabled();
    fireEvent.change(booking.getByLabelText('วันที่ต้องการนัด'), { target: { value: '2026-09-12' } });
    expect(booking.getByText('ไม่มีรอบตรวจในวันนี้ ลองเลือกวันอื่น')).toBeInTheDocument();
  });
});
