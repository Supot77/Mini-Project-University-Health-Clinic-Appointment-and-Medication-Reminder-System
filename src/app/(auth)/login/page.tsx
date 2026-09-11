'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { signIn } from '@/services/authService';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isLoading = isSubmitting || isRedirecting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      setIsSubmitting(false);
      setIsRedirecting(true);

      const redirect = searchParams.get('redirect');
      router.push(redirect || '/profile');
      router.refresh();
    } catch (err) {
      setIsSubmitting(false);
      setIsRedirecting(false);
      setError(
        err instanceof Error
          ? err.message
          : 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบ email/password อีกครั้ง'
      );
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-zinc-100 relative overflow-hidden">
      {isRedirecting && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200"
        >
          <div className="relative mb-4 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-sky-500 animate-ping opacity-75" />
            </div>
          </div>
          <h2 className="text-base font-bold text-zinc-900">
            เข้าสู่ระบบสำเร็จ
          </h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-xs">
            กำลังนำทางไปยังหน้าโปรไฟล์ กรุณารอสักครู่...
          </p>
        </div>
      )}

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">
          เข้าสู่ระบบ
        </h1>

        <p className="text-zinc-500 mt-2">
          ระบบคลินิกสุขภาพมหาวิทยาลัย
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Email
          </label>

          <input
            type="email"
            required
            disabled={isLoading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@wu.ac.th"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Password
          </label>

          <input
            type="password"
            required
            disabled={isLoading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition disabled:bg-zinc-50 disabled:text-zinc-400"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-sky-500 text-white font-semibold rounded-xl hover:bg-sky-600 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden="true" />}
          {isRedirecting
            ? 'กำลังนำทางไปหน้าโปรไฟล์...'
            : isSubmitting
            ? 'กำลังเข้าสู่ระบบ...'
            : 'เข้าสู่ระบบ'}
        </button>

        <p className="text-center text-sm text-zinc-500">
          ยังไม่มีบัญชี?{' '}
          <Link
            href="/register"
            className="text-sky-500 font-medium hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner center label="กำลังโหลดหน้าเข้าสู่ระบบ..." />}>
      <LoginForm />
    </Suspense>
  );
}
