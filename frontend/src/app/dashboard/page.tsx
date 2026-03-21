'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { testsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  question_count: number;
  is_published: boolean;
}

const GRADE_BG: Record<number, string> = {
  5: '#eff6ff',
  6: '#ecfeff',
  7: '#f5f3ff',
  8: '#fff7ed',
  9: '#f0fdf4',
  10: '#fef2f2',
  11: '#fdf4ff',
};

const GRADE_COLOR: Record<number, string> = {
  5: '#2563eb',
  6: '#0891b2',
  7: '#7c3aed',
  8: '#d97706',
  9: '#059669',
  10: '#dc2626',
  11: '#db2777',
};

function pluralQuestions(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

/* ─── Dashboard test card ───────────────────────────────────── */

function DashboardTestCard({ test }: { test: Test }) {
  const bg = GRADE_BG[test.grade] ?? '#eff6ff';
  const color = GRADE_COLOR[test.grade] ?? '#2563eb';

  return (
    <Link href={`/test/${test.id}`} className="test-card">
      {/* Coloured top */}
      <div className="test-card-top" style={{ background: bg }}>
        <span
          style={{
            position: 'absolute',
            right: '0.875rem',
            bottom: '-0.375rem',
            fontSize: '3.75rem',
            fontWeight: 900,
            color,
            opacity: 0.1,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {test.grade}
        </span>
        <svg
          width="38"
          height="38"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      </div>

      {/* Body */}
      <div className="test-card-body">
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <span className="pill-tag pill-tag-blue">{test.grade} класс</span>
          <span
            className={`pill-tag ${test.is_published ? 'pill-tag-green' : 'pill-tag-muted'}`}
          >
            {test.is_published ? 'Опубликован' : 'Черновик'}
          </span>
        </div>
        <h3
          style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--color-text-primary)',
            marginTop: '0.125rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as React.CSSProperties}
        >
          {test.title}
        </h3>
        {test.topic && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {test.topic}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="test-card-footer">
        <span>{pluralQuestions(test.question_count)}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontWeight: 500 }}>
          Открыть →
        </span>
      </div>
    </Link>
  );
}

/* ─── Skeleton card ─────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="test-card" style={{ pointerEvents: 'none' }}>
      <div style={{ height: 80, background: 'var(--color-surface-3)' }} />
      <div className="test-card-body">
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <div style={{ width: 60, height: 20, background: 'var(--color-surface-3)', borderRadius: 999 }} />
          <div style={{ width: 80, height: 20, background: 'var(--color-surface-3)', borderRadius: 999 }} />
        </div>
        <div style={{ height: 13, width: '85%', background: 'var(--color-surface-3)', borderRadius: 4, marginTop: 8 }} />
        <div style={{ height: 11, width: '60%', background: 'var(--color-surface-3)', borderRadius: 4 }} />
      </div>
      <div className="test-card-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div style={{ height: 10, width: 80, background: 'var(--color-surface-3)', borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { token, role, user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || role !== 'teacher') {
      router.push('/login');
      return;
    }
    async function load() {
      try {
        const data = (await testsApi.my(token!)) as Test[];
        setTests(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, role, router]);

  const grouped = tests.reduce(
    (acc, t) => {
      if (!acc[t.grade]) acc[t.grade] = [];
      acc[t.grade].push(t);
      return acc;
    },
    {} as Record<number, Test[]>,
  );

  return (
    <>
      {/* ── Teacher hero ────────────────────────────────── */}
      <section className="hero-banner">
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '2.5rem 1.5rem 3rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: '4rem',
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-2rem',
              right: '10rem',
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.375rem',
              }}
            >
              Панель учителя
            </p>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.2,
                marginBottom: '0.625rem',
                letterSpacing: '-0.02em',
              }}
            >
              Добро пожаловать{user ? `, ${user.display_name}` : ''}!
            </h1>
            <p
              style={{
                fontSize: '1rem',
                color: 'rgba(255,255,255,0.75)',
                marginBottom: '1.625rem',
              }}
            >
              Создавайте тесты, управляйте классами и отслеживайте успеваемость учеников
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/dashboard/tests/new" className="btn btn-lg btn-cta">
                + Создать тест
              </Link>
              <Link href="/dashboard/import" className="btn btn-lg btn-outline-white">
                Импорт из HTML
              </Link>
              <Link href="/dashboard/classrooms" className="btn btn-lg btn-outline-white">
                Мои классы
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tests section ────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface-2)' }}>
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '2rem 1.5rem 3.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1.375rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                Мои тесты
              </h2>
              {!loading && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                  {tests.length} {tests.length === 1 ? 'тест' : tests.length < 5 ? 'теста' : 'тестов'}
                </p>
              )}
            </div>
            <Link href="/dashboard/tests/new" className="btn btn-sm btn-primary">
              + Новый тест
            </Link>
          </div>

          {loading ? (
            <div>
              {[1, 2].map((i) => (
                <div key={i} style={{ marginBottom: '2rem' }}>
                  <div
                    style={{
                      width: 80,
                      height: 14,
                      background: 'var(--color-surface-3)',
                      borderRadius: 4,
                      marginBottom: '0.875rem',
                    }}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '1rem',
                    }}
                  >
                    {[1, 2, 3].map((j) => <SkeletonCard key={j} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div
              style={{
                padding: '4rem 1rem',
                textAlign: 'center',
                background: 'var(--color-surface)',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: '14px',
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ margin: '0 auto 1rem' }}
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 7h8M8 11h8M8 15h5" />
              </svg>
              <p
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.375rem',
                }}
              >
                Тестов пока нет
              </p>
              <p
                style={{
                  fontSize: '0.9375rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '1.25rem',
                }}
              >
                Создайте первый тест и выдайте его классу
              </p>
              <Link
                href="/dashboard/tests/new"
                className="btn btn-primary"
                style={{ display: 'inline-flex' }}
              >
                + Создать тест
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem' }}>
              {Object.entries(grouped)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([grade, gradeTests]) => (
                  <section key={grade}>
                    {/* Grade label */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.875rem',
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          height: 20,
                          background: GRADE_COLOR[Number(grade)] ?? 'var(--color-accent)',
                          borderRadius: 2,
                          flexShrink: 0,
                        }}
                      />
                      <h3
                        style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {grade} класс
                      </h3>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        {gradeTests.length}{' '}
                        {gradeTests.length === 1
                          ? 'тест'
                          : gradeTests.length < 5
                          ? 'теста'
                          : 'тестов'}
                      </span>
                    </div>

                    {/* Cards */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '1rem',
                      }}
                    >
                      {gradeTests.map((test) => (
                        <DashboardTestCard key={test.id} test={test} />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
