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
  5: '#edf2f9',
  6: '#eef4fb',
  7: '#f3eff9',
  8: '#fef6ee',
  9: '#edf9f3',
  10: '#fdf0f2',
  11: '#f5eef8',
};

const GRADE_COLOR: Record<number, string> = {
  5: '#2b4c7e',
  6: '#3b7cc1',
  7: '#7c54c4',
  8: '#c87533',
  9: '#2b9e6b',
  10: '#c44b5c',
  11: '#9b45b5',
};

function pluralQuestions(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

function DashboardTestCard({ test, index }: { test: Test; index: number }) {
  const bg = GRADE_BG[test.grade] ?? '#f0fdfa';
  const color = GRADE_COLOR[test.grade] ?? '#2b4c7e';

  return (
    <Link
      href={`/test/${test.id}`}
      className="test-card animate-fade-up"
      style={{ animationDelay: `${0.04 * Math.min(index, 10)}s` }}
    >
      <div className="test-card-top" style={{ background: bg }}>
        <span
          style={{
            position: 'absolute',
            right: '0.875rem',
            bottom: '-0.375rem',
            fontSize: '3.5rem',
            fontWeight: 900,
            color,
            opacity: 0.07,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {test.grade}
        </span>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      </div>

      <div className="test-card-body">
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <span className="pill-tag pill-tag-blue">{test.grade} класс</span>
          <span className={`pill-tag ${test.is_published ? 'pill-tag-green' : 'pill-tag-muted'}`}>
            {test.is_published ? 'Опубликован' : 'Черновик'}
          </span>
        </div>
        <h3
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
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
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {test.topic}
          </p>
        )}
      </div>

      <div className="test-card-footer">
        <span>{pluralQuestions(test.question_count)}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontWeight: 600 }}>
          Открыть →
        </span>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="test-card" style={{ pointerEvents: 'none' }}>
      <div className="skeleton" style={{ height: 84, borderRadius: 0 }} />
      <div className="test-card-body">
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 999 }} />
        </div>
        <div className="skeleton" style={{ height: 14, width: '85%', marginTop: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '60%' }} />
      </div>
      <div className="test-card-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="skeleton" style={{ height: 10, width: 80 }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { token, role, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
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
  }, [token, role, router, authLoading]);

  const grouped = tests.reduce(
    (acc, t) => {
      if (!acc[t.grade]) acc[t.grade] = [];
      acc[t.grade].push(t);
      return acc;
    },
    {} as Record<number, Test[]>,
  );

  let cardIndex = 0;

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
            zIndex: 1,
          }}
        >
          <div className="geo-shape geo-shape-rect" style={{ top: '0.5rem', right: '4%', width: 180, height: 180 }} />
          <div className="geo-shape geo-shape-circle" style={{ bottom: '-1.5rem', right: '12%', width: 100, height: 100 }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="hero-eyebrow animate-fade-up stagger-1">Панель учителя</p>
            <h1 className="hero-title animate-fade-up stagger-2" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
              Добро пожаловать{user ? `, ${user.display_name}` : ''}!
            </h1>
            <p className="hero-subtitle animate-fade-up stagger-3" style={{ marginBottom: '1.625rem' }}>
              Создавайте тесты, управляйте классами и отслеживайте успеваемость учеников
            </p>
            <div className="animate-fade-up stagger-4" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
      <div className="page-bg">
        <div style={{ maxWidth: '75rem', margin: '0 auto', padding: '2rem 1.5rem 3.5rem' }}>
          <div
            className="animate-fade-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.75rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h2 className="t-display" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', marginBottom: '0.125rem' }}>
                Мои тесты
              </h2>
              {!loading && (
                <p className="t-caption">
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
                  <div className="skeleton" style={{ width: 80, height: 14, marginBottom: '0.875rem' }} />
                  <div className="card-grid">
                    {[1, 2, 3].map((j) => <SkeletonCard key={j} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="empty-state animate-scale-in">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ margin: '0 auto 1rem', opacity: 0.6 }}
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 7h8M8 11h8M8 15h5" />
              </svg>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                Тестов пока нет
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Создайте первый тест и выдайте его классу
              </p>
              <Link href="/dashboard/tests/new" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                + Создать тест
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {Object.entries(grouped)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([grade, gradeTests]) => (
                  <section key={grade}>
                    <div className="section-header animate-fade-up">
                      <span className="section-bar" style={{ background: GRADE_COLOR[Number(grade)] ?? 'var(--color-accent)' }} />
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {grade} класс
                      </h3>
                      <span className="t-caption">
                        {gradeTests.length}{' '}
                        {gradeTests.length === 1 ? 'тест' : gradeTests.length < 5 ? 'теста' : 'тестов'}
                      </span>
                    </div>

                    <div className="card-grid">
                      {gradeTests.map((test) => (
                        <DashboardTestCard key={test.id} test={test} index={cardIndex++} />
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
