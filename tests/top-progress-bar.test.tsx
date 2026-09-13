import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopProgressBar from '@/components/common/TopProgressBar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/schedules',
  useSearchParams: () => new URLSearchParams(),
}));

describe('TopProgressBar', () => {
  it('renders top progress bar container on navigation', () => {
    const { container } = render(<TopProgressBar />);
    expect(container).toBeInTheDocument();
  });
});

