import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';
import * as authService from '@/services/authService';

const routerState = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const searchParamsState = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerState,
  useSearchParams: () => searchParamsState,
}));

vi.mock('@/services/authService', () => ({
  signIn: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form properly', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('example@wu.ac.th')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  });

  it('shows loading animation and redirect state during successful login', async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    const signInPromise = new Promise((resolve) => {
      resolveSignIn = resolve;
    });
    vi.mocked(authService.signIn).mockReturnValue(signInPromise as never);

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('example@wu.ac.th'), {
      target: { value: 'patient@wu.ac.th' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    const submitBtn = screen.getByRole('button', { name: 'เข้าสู่ระบบ' });
    fireEvent.click(submitBtn);

    // During authentication
    expect(screen.getByRole('button', { name: /กำลังเข้าสู่ระบบ/i })).toBeDisabled();

    // Resolve sign in
    resolveSignIn({ user: { id: 'test-user' } });

    // Expect redirect overlay and button text
    await waitFor(() => {
      expect(screen.getByText('เข้าสู่ระบบสำเร็จ')).toBeInTheDocument();
      expect(screen.getByText('กำลังนำทางไปยังหน้าโปรไฟล์ กรุณารอสักครู่...')).toBeInTheDocument();
      expect(routerState.push).toHaveBeenCalledWith('/profile');
      expect(routerState.refresh).toHaveBeenCalled();
    });
  });

  it('handles sign in error and resets button', async () => {
    vi.mocked(authService.signIn).mockRejectedValue(new Error('รหัสผ่านไม่ถูกต้อง'));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('example@wu.ac.th'), {
      target: { value: 'wrong@wu.ac.th' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpass' },
    });

    const submitBtn = screen.getByRole('button', { name: 'เข้าสู่ระบบ' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('รหัสผ่านไม่ถูกต้อง')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).not.toBeDisabled();
    });
  });
});
