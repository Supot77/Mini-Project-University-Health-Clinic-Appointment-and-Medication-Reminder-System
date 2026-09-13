import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from '@/components/common/Toast';

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces a transient status and dismisses after its duration', () => {
    const onDismiss = vi.fn();
    render(<Toast message="บันทึกข้อมูลแล้ว" onDismiss={onDismiss} duration={3500} />);

    expect(screen.getByRole('status')).toHaveTextContent('บันทึกข้อมูลแล้ว');
    expect(screen.getByRole('status').parentElement).toHaveAttribute('aria-live', 'polite');

    vi.advanceTimersByTime(3499);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('pauses dismissal while hovered or focused', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast message="อัปเดตแล้ว" onDismiss={onDismiss} duration={3500} />);
    const toast = screen.getByRole('status');

    fireEvent.mouseEnter(toast);
    vi.advanceTimersByTime(5000);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(toast);
    vi.advanceTimersByTime(3499);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    onDismiss.mockClear();
    rerender(<Toast message="อัปเดตอีกครั้ง" onDismiss={onDismiss} duration={3500} />);
    const focusedToast = screen.getByRole('status');
    fireEvent.focus(screen.getByRole('button', { name: 'ปิดข้อความแจ้งเตือน' }));
    vi.advanceTimersByTime(5000);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.blur(focusedToast, { relatedTarget: document.body });
    vi.advanceTimersByTime(3500);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('supports manual dismissal', () => {
    const onDismiss = vi.fn();
    render(<Toast message="บันทึกแล้ว" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'ปิดข้อความแจ้งเตือน' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
