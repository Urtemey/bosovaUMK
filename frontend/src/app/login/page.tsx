'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res: Record<string, unknown>;
      if (isRegister) {
        res = await authApi.register({ login, password, display_name: displayName }) as Record<string, unknown>;
      } else {
        res = await authApi.login({ login, password }) as Record<string, unknown>;
      }
      const teacher = res.teacher as { id: number; login: string; display_name: string };
      auth.login(res.access_token as string, teacher, 'teacher');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '22rem' }}>
        {/* Back link */}
        <Link
          href="/"
          className="t-caption"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1.5rem', textDecoration: 'none', color: 'var(--color-text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>

        <div className="card-lg" style={{ padding: '2rem 1.75rem' }}>
          {/* Header */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: 'var(--color-accent)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1 className="t-title" style={{ marginBottom: '0.25rem' }}>
              {isRegister ? 'Регистрация' : 'Вход для учителя'}
            </h1>
            <p className="t-caption">
              {isRegister
                ? 'Создайте аккаунт для управления тестами'
                : 'Войдите в свой аккаунт'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isRegister && (
              <div>
                <label className="label" htmlFor="displayName">Имя</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  placeholder="Иванова Мария Петровна"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="login">Логин</label>
              <input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="input"
                placeholder="teacher"
                required
                autoComplete="username"
                autoCapitalize="none"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '0.625rem 0.875rem',
                  background: 'var(--color-danger-bg)',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  color: 'var(--color-danger)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.25rem' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Подождите...
                </span>
              ) : isRegister ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </form>

          {/* Toggle register/login */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>

        {/* Student login link */}
        <p className="t-caption" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          Ученик?{' '}
          <Link
            href="/student-login"
            style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
          >
            Войти как ученик
          </Link>
        </p>
      </div>
    </div>
  );
}
