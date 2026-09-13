import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DepartmentWorkspace from '@/components/schedules/DepartmentWorkspace';
import type { ScheduleDepartment, ScheduleDoctor, ScheduleSlot } from '@/types/schedule';

const shop = vi.hoisted(() => ({
  departments: [] as ScheduleDepartment[],
  doctors: [] as ScheduleDoctor[],
  slots: [] as ScheduleSlot[],
  doctorAccounts: [] as { profileId: string; fullName: string; email: string; initials: string }[],
  isLoading: false,
  saveDepartment: vi.fn(),
  toggleDepartment: vi.fn(),
  saveDoctor: vi.fn(),
  toggleDoctor: vi.fn(),
}));

vi.mock('@/features/shop/context/ShopProvider', () => ({ useShop: () => shop }));

describe('Department and doctor workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shop.isLoading = false;
    shop.slots = [];
    shop.departments = [
      { id: 'general', name: 'เวชปฏิบัติทั่วไป', description: 'ตรวจอาการทั่วไป', isActive: true },
      { id: 'physio', name: 'กายภาพบำบัด', description: '', isActive: true },
      { id: 'inactive', name: 'แผนกที่ปิด', description: '', isActive: false },
    ];
    shop.doctors = [
      { id: 'doctor-1', profileId: 'profile-1', fullName: 'นพ. สมชาย ใจดี', email: 'doctor1@example.test', initials: 'SJ', specialty: 'เวชศาสตร์ครอบครัว', departmentId: 'general', availability: 'active', hasHistory: true },
      { id: 'doctor-2', profileId: 'profile-2', fullName: 'พญ. สมใจ ใจดี', email: 'doctor2@example.test', initials: 'SI', specialty: 'เวชศาสตร์ฟื้นฟู', departmentId: 'physio', availability: 'on_leave', hasHistory: true },
      { id: 'doctor-3', profileId: 'profile-3', fullName: 'นพ. หยุดตรวจ', email: '', initials: 'HT', specialty: '', departmentId: 'general', availability: 'inactive', hasHistory: true },
    ];
    shop.doctorAccounts = [
      { profileId: 'profile-1', fullName: 'นพ. สมชาย ใจดี', email: 'doctor1@example.test', initials: 'SJ' },
      { profileId: 'new-profile', fullName: 'พญ. แพทย์ใหม่', email: 'new@example.test', initials: 'PN' },
    ];
  });

  afterEach(() => vi.restoreAllMocks());

  it('searches departments and includes inactive entries only when requested', () => {
    render(<DepartmentWorkspace />);
    expect(screen.queryByRole('heading', { name: 'แผนกที่ปิด' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหาแผนก' }), { target: { value: 'อาการทั่วไป' } });
    expect(screen.getByRole('heading', { name: 'เวชปฏิบัติทั่วไป' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'กายภาพบำบัด' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหาแผนก' }), { target: { value: 'แผนกที่ปิด' } });
    expect(screen.getByRole('heading', { name: 'ไม่พบแผนก' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'แสดงที่ปิดใช้' }));
    expect(screen.getByRole('heading', { name: 'แผนกที่ปิด' })).toBeInTheDocument();
  });

  it('switches tabs by keyboard and filters doctors by department and specialty', () => {
    render(<DepartmentWorkspace />);
    const departmentsTab = screen.getByRole('tab', { name: /^แผนก/ });
    departmentsTab.focus();
    fireEvent.keyDown(departmentsTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /^แพทย์/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /^แพทย์/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByRole('combobox', { name: 'แผนก' }), { target: { value: 'physio' } });
    expect(screen.getByRole('heading', { name: 'พญ. สมใจ ใจดี' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'นพ. สมชาย ใจดี' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหาแพทย์' }), { target: { value: 'เวชศาสตร์ฟื้นฟู' } });
    expect(screen.getByText('ลาตรวจ')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหาแพทย์' }), { target: { value: 'ไม่ตรงกับแพทย์' } });
    expect(screen.getByRole('heading', { name: 'ไม่พบแพทย์' })).toBeInTheDocument();
  });

  it('saves a department through the existing contract and closes the drawer', async () => {
    shop.saveDepartment.mockResolvedValueOnce({ ok: true, value: { id: 'new' } });
    render(<DepartmentWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มแผนก' }));
    fireEvent.change(screen.getByRole('textbox', { name: /ชื่อแผนก/ }), { target: { value: 'อายุรกรรม' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'รายละเอียดแผนก' }), { target: { value: 'โรคของผู้ใหญ่' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกแผนก' }));
    expect(await screen.findByText('เพิ่มแผนกใหม่สำเร็จ')).toBeInTheDocument();
    expect(shop.saveDepartment).toHaveBeenCalledWith({ name: 'อายุรกรรม', description: 'โรคของผู้ใหญ่' }, undefined);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves the edited department draft when validation fails', async () => {
    shop.saveDepartment.mockResolvedValueOnce({ ok: false, error: 'ชื่อแผนกซ้ำ' });
    const before = structuredClone(shop.departments);
    render(<DepartmentWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไข เวชปฏิบัติทั่วไป' }));
    fireEvent.change(screen.getByRole('textbox', { name: /ชื่อแผนก/ }), { target: { value: 'กายภาพบำบัด' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกแผนก' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อแผนกซ้ำ');
    expect(screen.getByRole('textbox', { name: /ชื่อแผนก/ })).toHaveValue('กายภาพบำบัด');
    expect(shop.departments).toEqual(before);
  });

  it('preselects the department when adding a doctor from an empty roster', async () => {
    shop.doctors = shop.doctors.filter((doctor) => doctor.departmentId !== 'physio');
    shop.saveDoctor.mockResolvedValueOnce({ ok: true, value: { id: 'new-doctor' } });
    render(<DepartmentWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มแพทย์ในแผนก' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: /แผนกสังกัด/ })).toHaveValue('physio');
    expect(within(dialog).queryByRole('option', { name: /นพ\. สมชาย/ })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('combobox', { name: /เลือกบัญชีแพทย์/ }), { target: { value: 'new-profile' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกข้อมูลแพทย์' }));
    expect(await screen.findByText('ผูกแพทย์เข้ากับแผนกสำเร็จ')).toBeInTheDocument();
    expect(shop.saveDoctor).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'new-profile', departmentId: 'physio', fullName: 'พญ. แพทย์ใหม่' }), undefined);
  });

  it('preserves doctor data on a failed save and does not mutate the list', async () => {
    shop.saveDoctor.mockResolvedValueOnce({ ok: false, error: 'ไม่สามารถบันทึกแพทย์ได้' });
    const before = structuredClone(shop.doctors);
    render(<DepartmentWorkspace />);
    fireEvent.click(screen.getByRole('tab', { name: /^แพทย์/ }));
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไข นพ. สมชาย ใจดี' }));
    expect(screen.getByRole('combobox', { name: /เลือกบัญชีแพทย์/ })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'ความเชี่ยวชาญเฉพาะทาง' }), { target: { value: 'เวชปฏิบัติทั่วไป' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูลแพทย์' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่สามารถบันทึกแพทย์ได้');
    expect(screen.getByRole('textbox', { name: 'ความเชี่ยวชาญเฉพาะทาง' })).toHaveValue('เวชปฏิบัติทั่วไป');
    expect(shop.doctors).toEqual(before);
  });

  it('keeps focus in the drawer and returns it to the trigger after Escape', () => {
    render(<DepartmentWorkspace />);
    const trigger = screen.getByRole('button', { name: 'เพิ่มแผนก' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('textbox', { name: /ชื่อแผนก/ })).toHaveFocus();
    const save = screen.getByRole('button', { name: 'บันทึกแผนก' });
    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    const close = screen.getByRole('button', { name: 'ปิดแผงแก้ไข' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.keyDown(save, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows loading states and disables creation until loading completes', () => {
    shop.isLoading = true;
    render(<DepartmentWorkspace />);
    expect(screen.getByRole('status', { name: 'กำลังโหลดรายการแผนก' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เพิ่มแผนก' })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: /^แพทย์/ }));
    expect(screen.getByRole('status', { name: 'กำลังโหลดรายชื่อแพทย์' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เพิ่มแพทย์' })).toBeDisabled();
  });

  it('does not change a department or doctor when the confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DepartmentWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: 'ปิดใช้ เวชปฏิบัติทั่วไป' }));
    expect(shop.toggleDepartment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: /^แพทย์/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ปิดใช้ นพ. สมชาย ใจดี' }));
    expect(shop.toggleDoctor).not.toHaveBeenCalled();
  });
});
