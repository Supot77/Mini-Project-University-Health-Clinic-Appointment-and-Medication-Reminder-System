import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppointmentPage from '@/features/pai/runtime/AppointmentPage';
import { MedicalRecordsPage, PatientRecordsPage } from '@/features/pai/runtime/RecordsPage';
import { createPaiMockRepository } from '@/features/pai/runtime/mockRepository';
import type { PaiRepository } from '@/features/pai/runtime/contract';
import { fixture, slotId, withAppointment } from './pai-runtime-fixtures';

describe('Pai database-backed role containers with injected offline repository', () => {
  it('shows loading, then empty state without a role switcher', async () => {
    render(<AppointmentPage role="patient" repository={createPaiMockRepository(fixture())} />);
    expect(screen.getByRole('status', { name: 'กำลังโหลดหน้าบริการ' })).toBeInTheDocument();
    expect(await screen.findByText('ไม่พบนัดหมายตามเงื่อนไขนี้')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /มุมมอง/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'อนุมัตินัด' })).not.toBeInTheDocument();
  });
  it('hydrates booking form from a slot deep link', async () => {
    render(<AppointmentPage role="patient" initialSlotId={slotId} repository={createPaiMockRepository(fixture())} />);

    expect(await screen.findByRole('heading', { name: 'จองนัดใหม่' })).toBeInTheDocument();
    expect(screen.getByLabelText('วันที่ตรวจ')).toHaveValue('2026-09-09');
    expect(screen.getByLabelText('บริการ')).toHaveValue('ทั่วไป');
    expect(screen.getByLabelText('รอบตรวจ')).toHaveValue(slotId);
  });
  it('uses a compact Thai calendar for booking date while keeping the list filter separate', async () => {
    render(<AppointmentPage role="patient" repository={createPaiMockRepository(fixture())} />);
    expect(await screen.findByRole('heading', { name: 'จองนัดใหม่' })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /เปิดปฏิทินเลือกวันที่ตรวจ/ });
    expect(screen.queryByRole('dialog', { name: 'เลือกวันที่ตรวจ' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'เลือกวันที่ตรวจ' })).toBeInTheDocument();
    expect(screen.getByText('กันยายน 2569')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    expect(screen.getByText('ตุลาคม 2569')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เดือนก่อนหน้า' }));
    fireEvent.click(screen.getByRole('button', { name: 'เลือกวันที่ 10 กันยายน 2569' }));
    expect(screen.getByLabelText('วันที่ตรวจ')).toHaveValue('2026-09-10');
    expect(screen.queryByRole('dialog', { name: 'เลือกวันที่ตรวจ' })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'เลือกวันที่ตรวจ' })).not.toBeInTheDocument();
    const dateFilter = screen.getByLabelText('กรองวันที่');
    fireEvent.click(dateFilter);
    expect(document.activeElement).toBe(dateFilter);
    expect(screen.queryByRole('dialog', { name: 'เลือกวันที่ตรวจ' })).not.toBeInTheDocument();
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
    const dateFilter = await screen.findByLabelText('กรองวันที่');
    fireEvent.click(dateFilter);
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
