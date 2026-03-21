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
      auth.login(res.access_token as string, (res.refresh_token as string) || null, teacher, 'teacher');
      router.push('/dashboard');
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
        <Link
          href="/"
          className="back-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>

        <div className="card-lg" style={{ padding: '2rem 1.75rem' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <div className="icon-badge icon-badge-teal" style={{ marginBottom: '1rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h1 className="t-title" style={{ marginBottom: '0.3rem' }}>
              {isRegister ? 'Регистрация' : 'Вход для учителя'}
            </h1>
            <p className="t-caption">
              {isRegister
                ? 'Создайте аккаунт для управления тестами'
                : 'Войдите в свой аккаунт'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isRegister && (
              <div className="animate-fade-up">
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
              <div role="alert" className="alert alert-error animate-fade-up">
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
                fontWeight: 600,
              }}
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>

        <p className="t-caption" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          Ученик?{' '}
          <Link
            href="/student-login"
            style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
          >
            Войти как ученик
          </Link>
        </p>
      </div>
    </div>
  );
}
