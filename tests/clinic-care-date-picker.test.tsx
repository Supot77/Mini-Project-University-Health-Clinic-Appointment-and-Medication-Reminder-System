import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ClinicDatePicker } from '@/features/clinic-care';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('Clinic calendar', () => {
  it('marks appointments, selects ISO dates and returns focus', () => {
    const onChange = vi.fn();
    render(<ClinicDatePicker label="กรองวันที่" value="2026-09-09" markedDates={['2026-09-10']} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'กรองวันที่' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: '9 กันยายน 2569' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '10 กันยายน 2569 มีนัดหมาย' }));
    expect(onChange).toHaveBeenCalledWith('2026-09-10');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('preserves minimum date, month navigation and clearing', () => {
    const onChange = vi.fn();
    render(<ClinicDatePicker label="วันที่ตรวจ" value="2026-09-09" min="2026-09-09" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'วันที่ตรวจ' }));
    expect(screen.getByRole('button', { name: '8 กันยายน 2569' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'เดือนก่อนหน้า' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'เดือนถัดไป' }));
    expect(screen.getByText('ตุลาคม 2569')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ล้างวันที่' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
  it('moves keyboard focus across a month boundary without selecting', () => {
    const onChange = vi.fn();
    render(<ClinicDatePicker label="กรองวันที่" value="2026-09-30" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'กรองวันที่' }));
    fireEvent.keyDown(screen.getByRole('button', { name: '30 กันยายน 2569' }), { key: 'ArrowRight' });
    expect(screen.getByText('ตุลาคม 2569')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 ตุลาคม 2569' })).toHaveAttribute('tabindex', '0');
    expect(onChange).not.toHaveBeenCalled();
  });
});
