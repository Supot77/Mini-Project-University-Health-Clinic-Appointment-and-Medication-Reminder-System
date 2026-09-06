import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecordsWorkspace from '@/features/pai/records/RecordsWorkspace';
import { createRecordsDemoRepository } from '@/features/pai/records/mockRepository';

afterEach(cleanup);

describe('Pai records UI preview', () => {
  it('loads completed patient records, searches and clears an empty result', async () => {
    render(<RecordsWorkspace />);
    expect(screen.getByRole('status', { name: 'กำลังโหลดผลตรวจ' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /เปิดผลตรวจ REC-002/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /เปิดผลตรวจ REC-001/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'แก้ไขส่วนค้าง' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'ค้นหาผลตรวจ' }), { target: { value: 'ไม่ตรงกับข้อมูล' } });
    expect(screen.getByText('ไม่พบผลตรวจ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
    expect(screen.getByRole('button', { name: /เปิดผลตรวจ REC-002/ })).toBeInTheDocument();
  });

  it('lets the doctor save a draft and complete only the saved diagnosis', async () => {
    render(<RecordsWorkspace />);
    await screen.findByRole('button', { name: /เปิดผลตรวจ REC-002/ });
    fireEvent.click(screen.getByRole('button', { name: 'แพทย์', exact: true }));
    await screen.findByRole('form', { name: 'บันทึกผลตรวจตัวอย่าง' });
    fireEvent.click(screen.getByRole('button', { name: 'ปิดตรวจ', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('กรอกและบันทึกผลวินิจฉัย');
    fireEvent.change(screen.getByLabelText(/ผลวินิจฉัย/), { target: { value: 'ผลตรวจสำหรับทดสอบ' } });
    expect(screen.getByRole('button', { name: 'ปิดตรวจ', exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกแบบร่าง' }));
    fireEvent.click(screen.getByRole('button', { name: 'ปิดตรวจ', exact: true }));
    expect(screen.getByText('ผลตรวจสำหรับทดสอบ')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'บันทึกผลตรวจตัวอย่าง' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ผู้ป่วย', exact: true }));
    expect(await screen.findByRole('button', { name: /เปิดผลตรวจ REC-001/ })).toBeInTheDocument();
  });

  it('requires an amendment reason and offers no edit for a dispensed item or another doctor', async () => {
    render(<RecordsWorkspace />);
    await screen.findByRole('button', { name: /เปิดผลตรวจ REC-002/ });
    fireEvent.click(screen.getByRole('button', { name: 'แพทย์', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: /เปิดผลตรวจ REC-002/ }));
    expect(screen.getAllByRole('button', { name: 'แก้ไขส่วนค้าง' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขส่วนค้าง' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ระบุเหตุผล');
    fireEvent.change(screen.getByLabelText(/จำนวนค้างใหม่/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/เหตุผลการแก้ไข/), { target: { value: 'ปรับข้อมูลทดสอบ' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    expect(screen.getByText('REC-002 · เวอร์ชัน 2')).toBeInTheDocument();
    expect(screen.getByText(/เหตุผล: ปรับข้อมูลทดสอบ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /เปิดผลตรวจ REC-003/ }));
    const details = screen.getByRole('article', { name: 'รายละเอียดผลตรวจ REC-003' });
    expect(within(details).getByText(/ประวัติจากแพทย์อื่น · เปิดอ่านได้อย่างเดียว/)).toBeInTheDocument();
    expect(within(details).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers retry when the preview repository fails to load', async () => {
    const repository = createRecordsDemoRepository();
    const originalList = repository.list;
    repository.list = vi.fn().mockRejectedValueOnce(new Error('demo failure')).mockImplementation(originalList);
    render(<RecordsWorkspace repository={repository} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('โหลดผลตรวจไม่สำเร็จ');
    fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
    expect(await screen.findByRole('button', { name: /เปิดผลตรวจ REC-002/ })).toBeInTheDocument();
  });
});
