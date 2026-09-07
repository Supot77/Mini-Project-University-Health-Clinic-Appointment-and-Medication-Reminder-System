'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/services/authService';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);

      const redirect = searchParams.get('redirect');
      router.push(redirect || '/dashboard');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบ email/password อีกครั้ง'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-zinc-100">
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@wu.ac.th"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Password
          </label>

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-sky-500 text-white font-semibold rounded-xl hover:bg-sky-600 transition disabled:opacity-60"
        >
          {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
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
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}