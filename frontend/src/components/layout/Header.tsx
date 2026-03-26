'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

/* ─── Icon primitives ─────────────────────────────────────── */

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconTests({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

function IconClasses({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconCode({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconLogin({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

/* ─── Logo ───────────────────────────────────────────────── */

function Logo() {
  return (
    <span
      style={{
        fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
        fontWeight: 800,
        fontSize: '1.0625rem',
        color: 'var(--color-accent)',
        letterSpacing: '-0.02em',
      }}
    >
      УМК Информатика
    </span>
  );
}

/* ─── Component ───────────────────────────────────────────── */

export default function Header() {
  const { user, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* ── Desktop header (≥640px) ──────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
          display: 'none',
        }}
        className="sm-header animate-slide-down"
      >
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '0 1.5rem',
            height: '3.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <Logo />
          </Link>

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}>
            <Link
              href="/"
              className={`nav-link ${pathname === '/' ? 'active' : ''}`}
            >
              Каталог
            </Link>

            {user && role === 'teacher' && (
              <>
                <Link
                  href="/dashboard"
                  className={`nav-link ${isActive('/dashboard') && !isActive('/dashboard/classrooms') && !isActive('/dashboard/questions') ? 'active' : ''}`}
                >
                  Мои тесты
                </Link>
                <Link
                  href="/dashboard/questions"
                  className={`nav-link ${isActive('/dashboard/questions') ? 'active' : ''}`}
                >
                  Банк заданий
                </Link>
                <Link
                  href="/dashboard/classrooms"
                  className={`nav-link ${isActive('/dashboard/classrooms') ? 'active' : ''}`}
                >
                  Классы
                </Link>
              </>
            )}

            <Link
              href="/code-editor"
              className={`nav-link ${isActive('/code-editor') ? 'active' : ''}`}
            >
              IDE
            </Link>
          </nav>

          {/* Auth area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            {user ? (
              <>
                {role === 'teacher' && (
                  <Link href="/dashboard/tests/new" className="btn btn-sm btn-cta">
                    + Создать тест
                  </Link>
                )}
                <span
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    maxWidth: '10rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {user.display_name}
                </span>
                <button
                  onClick={handleLogout}
                  className="btn btn-sm btn-ghost"
                  type="button"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link href="/student-login" className="btn btn-sm btn-secondary">
                  Ученик
                </Link>
                <Link href="/login" className="btn btn-sm btn-cta">
                  Войти
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile top bar (<640px) ───────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
        className="mobile-header"
      >
        <div
          style={{
            padding: '0 1rem',
            height: '3.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <Logo />
          </Link>

          {!user && (
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <Link
                href="/student-login"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
              >
                Ученик
              </Link>
              <Link
                href="/login"
                className="btn btn-sm btn-cta"
                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
              >
                Войти
              </Link>
            </div>
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  maxWidth: '7rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                {user.display_name}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                type="button"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile bottom nav (<640px) ────────────────────── */}
      <nav
        className="bottom-nav mobile-bottom-nav"
        aria-label="Основная навигация"
        style={{ display: 'flex' }}
      >
        <Link
          href="/"
          className={`bottom-nav-item ${pathname === '/' ? 'active' : ''}`}
        >
          <IconHome active={pathname === '/'} />
          <span>Каталог</span>
        </Link>

        {user && role === 'teacher' ? (
          <>
            <Link
              href="/dashboard"
              className={`bottom-nav-item ${isActive('/dashboard') && !isActive('/dashboard/classrooms') && !isActive('/dashboard/questions') ? 'active' : ''}`}
            >
              <IconTests active={isActive('/dashboard') && !isActive('/dashboard/classrooms') && !isActive('/dashboard/questions')} />
              <span>Тесты</span>
            </Link>
            <Link
              href="/dashboard/classrooms"
              className={`bottom-nav-item ${isActive('/dashboard/classrooms') ? 'active' : ''}`}
            >
              <IconClasses active={isActive('/dashboard/classrooms')} />
              <span>Классы</span>
            </Link>
          </>
        ) : !user ? (
          <>
            <Link
              href="/student-login"
              className={`bottom-nav-item ${pathname === '/student-login' ? 'active' : ''}`}
            >
              <IconLogin active={pathname === '/student-login'} />
              <span>Ученик</span>
            </Link>
            <Link
              href="/login"
              className={`bottom-nav-item ${pathname === '/login' ? 'active' : ''}`}
            >
              <IconLogin active={pathname === '/login'} />
              <span>Учитель</span>
            </Link>
          </>
        ) : null}

        <Link
          href="/code-editor"
          className={`bottom-nav-item ${isActive('/code-editor') ? 'active' : ''}`}
        >
          <IconCode active={isActive('/code-editor')} />
          <span>Python</span>
        </Link>
      </nav>

      {/* ── Responsive display rules ──────────────────────── */}
      <style>{`
        @media (min-width: 640px) {
          .sm-header { display: block !important; }
          .mobile-header { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
        }
        @media (max-width: 639px) {
          .sm-header { display: none !important; }
          .mobile-header { display: block !important; }
          .mobile-bottom-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
