'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { testsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  question_count: number;
}

const GRADES = [5, 6, 7, 8, 9, 10, 11];

/* Soft pastel backgrounds per grade */
const GRADE_BG: Record<number, string> = {
  5: '#eff6ff',
  6: '#ecfeff',
  7: '#f5f3ff',
  8: '#fff7ed',
  9: '#f0fdf4',
  10: '#fef2f2',
  11: '#fdf4ff',
};

/* Matching accent colours (same as CSS vars) */
const GRADE_COLOR: Record<number, string> = {
  5: '#2563eb',
  6: '#0891b2',
  7: '#7c3aed',
  8: '#d97706',
  9: '#059669',
  10: '#dc2626',
  11: '#db2777',
};

function pluralQ(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

/* ─── Test card ─────────────────────────────────────────────── */

function TestCard({ test }: { test: Test }) {
  const bg = GRADE_BG[test.grade] ?? '#eff6ff';
  const color = GRADE_COLOR[test.grade] ?? '#2563eb';

  return (
    <Link href={`/test/${test.id}`} className="test-card">
      {/* Coloured top */}
      <div className="test-card-top" style={{ background: bg }}>
        {/* Faded grade number in corner */}
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
        {/* Monitor / computer icon */}
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </div>

      {/* Body */}
      <div className="test-card-body">
        <span className="pill-tag pill-tag-blue">Информатика</span>
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
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{pluralQ(test.question_count)}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontWeight: 500 }}>
          Пройти →
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
        <div style={{ width: 70, height: 20, background: 'var(--color-surface-3)', borderRadius: 999 }} />
        <div style={{ height: 13, width: '85%', background: 'var(--color-surface-3)', borderRadius: 4, marginTop: 8 }} />
        <div style={{ height: 11, width: '60%', background: 'var(--color-surface-3)', borderRadius: 4 }} />
      </div>
      <div
        className="test-card-footer"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div style={{ height: 10, width: 80, background: 'var(--color-surface-3)', borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function HomePage() {
  const [testsByGrade, setTestsByGrade] = useState<Record<number, Test[]>>({});
  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const { user, role } = useAuth();

  useEffect(() => {
    async function load() {
      try {
        const all = (await testsApi.list()) as Test[];
        const grouped: Record<number, Test[]> = {};
        for (const t of all) {
          if (!grouped[t.grade]) grouped[t.grade] = [];
          grouped[t.grade].push(t);
        }
        setTestsByGrade(grouped);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const tests = testsByGrade[selectedGrade] || [];
  const gradeColor = GRADE_COLOR[selectedGrade] ?? '#2563eb';

  return (
    <>
      {/* ── Hero banner ─────────────────────────────────── */}
      <section className="hero-banner">
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: 'clamp(2.5rem, 5vw, 4.5rem) 1.5rem clamp(3rem, 6vw, 5.5rem)',
            position: 'relative',
          }}
        >
          {/* Decorative blobs */}
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              right: '2rem',
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '3.5rem',
              right: '9rem',
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '1.5rem',
              right: '5rem',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              pointerEvents: 'none',
            }}
          />

          {/* Text */}
          <div style={{ maxWidth: '38rem', position: 'relative', zIndex: 1 }}>
            <p className="hero-eyebrow">
              УМК «Информатика» Босова Л.Л., Босова А.Ю.
            </p>
            <h1 className="hero-title">
              Тестирование
              <br />
              по информатике
            </h1>
            <p className="hero-subtitle" style={{ marginBottom: '2rem' }}>
              Тематические тесты для 5–11 классов. Интерактивная проверка знаний для учителей и учеников.
            </p>

            {/* CTA buttons by auth state */}
            {!user && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/login" className="btn btn-lg btn-cta">
                  Войти как учитель
                </Link>
                <Link href="/student-login" className="btn btn-lg btn-outline-white">
                  Войти как ученик
                </Link>
              </div>
            )}

            {user && role === 'teacher' && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/dashboard" className="btn btn-lg btn-cta">
                  Мои тесты
                </Link>
                <Link href="/dashboard/classrooms" className="btn btn-lg btn-outline-white">
                  Мои классы
                </Link>
              </div>
            )}

            {user && role === 'student' && (
              <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                Привет, {user.display_name}! Выбери класс и начни тест.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Tests catalog ────────────────────────────────── */}
      <div style={{ background: 'var(--color-surface-2)', minHeight: '50vh' }}>
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '2.25rem 1.5rem 3.5rem',
          }}
        >
          {/* Section header */}
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: '0.3rem',
            }}
          >
            Тесты по информатике
          </h2>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--color-text-muted)',
              marginBottom: '1.25rem',
            }}
          >
            Выберите класс и пройдите тематический тест по учебнику Босова
          </p>

          {/* Grade filter pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginBottom: '1.75rem',
            }}
          >
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`grade-pill-btn ${selectedGrade === g ? 'active' : ''}`}
                onClick={() => setSelectedGrade(g)}
                aria-pressed={selectedGrade === g}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Grade heading */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 20,
                background: gradeColor,
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: '1rem',
                color: 'var(--color-text-primary)',
              }}
            >
              {selectedGrade} класс
            </span>
            {!loading && (
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                —{' '}
                {tests.length}{' '}
                {tests.length === 1 ? 'тест' : tests.length < 5 ? 'теста' : 'тестов'}
              </span>
            )}
          </div>

          {/* Cards grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)
            ) : tests.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '3rem 1rem',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                  Тестов для {selectedGrade} класса пока нет
                </p>
              </div>
            ) : (
              tests.map((test) => <TestCard key={test.id} test={test} />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
