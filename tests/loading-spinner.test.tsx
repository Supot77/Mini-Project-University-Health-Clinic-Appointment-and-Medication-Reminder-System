import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingSpinner from '@/components/common/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders default spinner with role="status" and sr-only fallback label', () => {
    render(<LoadingSpinner />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument();
  });

  it('renders with custom visible label', () => {
    render(<LoadingSpinner label="กำลังโหลดข้อมูลตารางตรวจ..." size="lg" tone="sky" />);

    expect(screen.getByText('กำลังโหลดข้อมูลตารางตรวจ...')).toBeInTheDocument();
  });

  it('renders centered container when center=true', () => {
    const { container } = render(<LoadingSpinner center label="กำลังโหลด..." />);

    expect(container.firstChild).toHaveClass('flex', 'items-center', 'justify-center');
  });
});

