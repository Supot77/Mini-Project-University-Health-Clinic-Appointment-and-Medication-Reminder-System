import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import AppointmentPage from '@/features/pai/runtime/AppointmentPage';
import { MedicalRecordsPage, PatientRecordsPage } from '@/features/pai/runtime/RecordsPage';
import { createPaiMockRepository } from '@/features/pai/runtime/mockRepository';
import type { PaiRepository } from '@/features/pai/runtime/contract';
import { fixture, medicationId, withAppointment } from './pai-runtime-fixtures';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('Pai database-backed role containers with injected offline repository', () => {
  it.each(['medical', 'staff_admin'] as const)('shows patient contact to %s', async (role) => {
    const seed = withAppointment(role);
    seed.appointments[0].patient_phone = '0800000000';
    render(<AppointmentPage role={role} repository={createPaiMockRepository(seed)} />);
    expect(await screen.findByText('เบอร์โทรผู้ป่วย: 0800000000')).toBeInTheDocument();
  });
  it('labels a missing phone without inventing a contact', async () => {
    render(<AppointmentPage role="medical" repository={createPaiMockRepository(withAppointment())} />);
    expect(await screen.findByText('เบอร์โทรผู้ป่วย: ไม่ได้ระบุ')).toBeInTheDocument();
  });
  it('saves and displays the prescribed dose, meal, times and duration', async () => {
    const repo = createPaiMockRepository(withAppointment());
    render(<MedicalRecordsPage repository={repo} />);
    fireEvent.change(await screen.findByLabelText('ผลวินิจฉัย'), { target: { value: 'ผลทดสอบ' } });
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการยา' }));
    fireEvent.change(screen.getByLabelText('ยา', { exact: true }), { target: { value: medicationId } });
    fireEvent.change(screen.getByLabelText('ขนาดยาต่อครั้ง (ระบุหน่วย)'), { target: { value: '2 เม็ด' } });
    fireEvent.change(screen.getByLabelText('การใช้ยากับอาหาร'), { target: { value: 'หลังอาหาร' } });
    fireEvent.change(screen.getByLabelText('ช่วงเวลาและความถี่ในการใช้ยา'), { target: { value: 'เช้า เที่ยง เย็น' } });
    fireEvent.change(screen.getByLabelText('ระยะเวลา (วัน)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('จำนวนที่สั่ง'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันบันทึกผลและจบตรวจ' }));
    expect(await screen.findByText('หลังอาหาร · เช้า เที่ยง เย็น')).toBeInTheDocument();
    expect(screen.getByText('2 เม็ด')).toBeInTheDocument();
    expect(screen.getByText('3 วัน')).toBeInTheDocument();
    expect((await repo.load()).records[0].prescribed_medications?.[0]).toMatchObject({ dosage: '2 เม็ด', frequency: 'หลังอาหาร · เช้า เที่ยง เย็น', duration_days: 3, quantity: 18 });
  });
  it('shows loading, then empty state without a role switcher', async () => {
    render(<AppointmentPage role="patient" repository={createPaiMockRepository(fixture())} />);
    expect(screen.getByRole('status', { name: 'กำลังโหลดหน้าบริการ' })).toBeInTheDocument();
    expect(await screen.findByText('ไม่พบนัดหมายตามเงื่อนไขนี้')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /มุมมอง/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อนุมัตินัด' })).not.toBeInTheDocument();
  });
  it('shows database error and supports retry instead of rendering demo data', async () => {
    const repo = createPaiMockRepository(fixture());
    const load = vi.fn().mockRejectedValueOnce(new Error('ฐานข้อมูลไม่พร้อม')).mockImplementation(() => repo.load());
    render(<AppointmentPage role="patient" repository={{ ...repo, load }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ฐานข้อมูลไม่พร้อม');
    fireEvent.click(screen.getByRole('button', { name: 'โหลดข้อมูลใหม่' }));
    expect(await screen.findByText('ไม่พบนัดหมายตามเงื่อนไขนี้')).toBeInTheDocument();
  });
  it('staff sees approval/cancellation but no record link or booking form', async () => {
    const seed = withAppointment('staff_admin'); seed.appointments[0].status = 'pending';
    render(<AppointmentPage role="staff_admin" repository={createPaiMockRepository(seed)} />);
    expect(await screen.findByRole('button', { name: 'อนุมัตินัด' })).toBeInTheDocument();
    expect(screen.getByText('LIVE DATABASE')).toBeInTheDocument();
    expect(screen.getByText('ASIA/BANGKOK')).toBeInTheDocument();
    expect(screen.getAllByText('รออนุมัติ', { selector: 'p' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'ผลตรวจและรายการยา' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'จองนัดใหม่' })).not.toBeInTheDocument();
  });
  it('opens the whole date filter block and requires a rejection reason for staff', async () => {
    const seed = withAppointment('staff_admin'); seed.appointments[0].status = 'pending';
    render(<AppointmentPage role="staff_admin" repository={createPaiMockRepository(seed)} />);
    const dateFilter = await screen.findByRole('button', { name: 'กรองวันที่' });
    fireEvent.click(dateFilter);
    expect(screen.getByRole('dialog', { name: 'กรองวันที่' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ปิดปฏิทิน' }));
    expect(document.activeElement).toBe(dateFilter);
    fireEvent.click(screen.getByText('ปฏิเสธนัด', { selector: 'summary' }));
    const reason = screen.getByRole('textbox', { name: 'เหตุผลการปฏิเสธ' });
    expect(screen.getByRole('button', { name: 'ยืนยันปฏิเสธนัด' })).toBeInTheDocument();
    fireEvent.submit(reason.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผลการปฏิเสธ');
    fireEvent.change(reason, { target: { value: 'รอบบริการถูกยกเลิก' } });
    fireEvent.submit(reason.closest('form')!);
    expect(await screen.findByText('ปฏิเสธนัดแล้วและบันทึกเหตุผล')).toBeInTheDocument();
    expect(await screen.findByText('เหตุผลการปฏิเสธ:')).toBeInTheDocument();
    expect(screen.getByText('รอบบริการถูกยกเลิก')).toBeInTheDocument();
  });
  it('prevents duplicate clicks while a transition is pending and keeps the old state after failure', async () => {
    const seed = withAppointment('staff_admin'); seed.appointments[0].status = 'pending';
    const repo = createPaiMockRepository(seed);
    let reject: (error: Error) => void = () => {};
    const transition = vi.fn(() => new Promise<void>((_, r) => { reject = r; }));
    render(<AppointmentPage role="staff_admin" repository={{ ...repo, transition }} />);
    const button = await screen.findByRole('button', { name: 'อนุมัตินัด' });
    fireEvent.click(button); fireEvent.click(button);
    expect(transition).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    reject(new Error('สถานะเปลี่ยนแล้ว'));
    expect(await screen.findByRole('alert')).toHaveTextContent('สถานะเปลี่ยนแล้ว');
    expect(screen.getByText('รออนุมัติ', { selector: 'span' })).toBeInTheDocument();
  });
  it('does not render a snapshot for a different role', async () => {
    render(<PatientRecordsPage repository={createPaiMockRepository(fixture('staff_admin'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่มีสิทธิ์');
    expect(screen.queryByRole('heading', { name: 'บันทึกผลตรวจและรายการยา' })).not.toBeInTheDocument();
  });
  it('medical saves a result and the completed record appears after reload', async () => {
    render(<MedicalRecordsPage repository={createPaiMockRepository(withAppointment())} />);
    const diagnosis = await screen.findByRole('textbox', { name: 'ผลวินิจฉัย' });
    fireEvent.change(diagnosis, { target: { value: 'ผลทดสอบ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันบันทึกผลและจบตรวจ' }));
    expect(await screen.findByText('บันทึกผลและจบตรวจแล้ว ผู้ป่วยเปิดอ่านได้')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/ผลวินิจฉัย:/).parentElement).toHaveTextContent('ผลทดสอบ'));
    expect(screen.queryByRole('button', { name: 'ยืนยันบันทึกผลและจบตรวจ' })).not.toBeInTheDocument();
  });
  it('failed record save retains the entered diagnosis for correction', async () => {
    const repo: PaiRepository = { ...createPaiMockRepository(withAppointment()), saveRecord: vi.fn().mockRejectedValue(new Error('ไม่พบยา')) };
    render(<MedicalRecordsPage repository={repo} />);
    const diagnosis = await screen.findByRole('textbox', { name: 'ผลวินิจฉัย' });
    fireEvent.change(diagnosis, { target: { value: 'ผลทดสอบ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันบันทึกผลและจบตรวจ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบยา');
    expect(diagnosis).toHaveValue('ผลทดสอบ');
  });
});
