'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';

export default function StudentLoginPage() {
  const [login, setLogin] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.studentLogin({ login: login.toUpperCase(), code }) as Record<string, unknown>;
      const student = res.student as { id: number; login: string; display_name: string };
      auth.login(res.access_token as string, null, student, 'student');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-bg"
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
      }}
    >
      <div className="animate-scale-in" style={{ width: '100%', maxWidth: '22rem' }}>
        <Link href="/" className="back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>

        <div className="card-lg" style={{ padding: '2rem 1.75rem' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <div className="icon-badge icon-badge-green" style={{ marginBottom: '1rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="t-title" style={{ marginBottom: '0.3rem' }}>
              Вход для ученика
            </h1>
            <p className="t-caption">
              Введи логин и код, которые дал учитель
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label className="label" htmlFor="studentLogin">Логин</label>
              <input
                id="studentLogin"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value.toUpperCase())}
                className="input input-mono"
                placeholder="АРГУТ307"
                maxLength={10}
                required
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>

            <div>
              <label className="label" htmlFor="studentCode">Код</label>
              <input
                id="studentCode"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="input input-mono"
                placeholder="281922"
                maxLength={6}
                required
                autoComplete="one-time-code"
              />
            </div>

            {error && (
              <div role="alert" className="alert alert-error animate-fade-up">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Подождите...
                </span>
              ) : 'Войти'}
            </button>
          </form>
        </div>

        <p className="t-caption" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          Учитель?{' '}
          <Link
            href="/login"
            style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
          >
            Войти как учитель
          </Link>
        </p>
      </div>
    </div>
  );
}
