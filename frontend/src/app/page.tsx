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

const GRADE_LABELS: Record<number, string> = {
  5: 'Знакомство с ПК',
  6: 'Алгоритмы',
  7: 'Информация',
  8: 'Архитектура',
  9: 'Сети и модели',
  10: 'Программирование',
  11: 'ИИ и данные',
};

function GradeIcon({ grade, color }: { grade: number; color: string }) {
  const icons: Record<number, React.ReactNode> = {
    5: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
    6: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    7: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    8: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
      </svg>
    ),
    9: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
      </svg>
    ),
    10: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    11: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 014 4v1a3 3 0 013 3 3 3 0 01-1 5.83V17a4 4 0 01-4 4h-4a4 4 0 01-4-4v-1.17A3 3 0 015 10a3 3 0 013-3V6a4 4 0 014-4z" />
        <path d="M10 10h4M10 14h4" />
      </svg>
    ),
  };
  return <>{icons[grade] || icons[5]}</>;
}

function pluralQ(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

function TestCard({ test, index }: { test: Test; index: number }) {
  const bg = GRADE_BG[test.grade] ?? '#f0fdfa';
  const color = GRADE_COLOR[test.grade] ?? '#2b4c7e';

  return (
    <Link
      href={`/test/${test.id}`}
      className="test-card animate-fade-up"
      style={{ animationDelay: `${0.05 * Math.min(index, 8)}s` }}
    >
      <div className="test-card-top" style={{ background: bg }}>
        <span
          style={{
            position: 'absolute',
            right: '0.75rem',
            bottom: '-0.5rem',
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
        <GradeIcon grade={test.grade} color={color} />
      </div>

      <div className="test-card-body">
        <span className="pill-tag pill-tag-blue">Информатика</span>
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

      <div className="test-card-footer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>{pluralQ(test.question_count)}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontWeight: 600 }}>
          Пройти →
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
        <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 14, width: '85%', marginTop: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '60%' }} />
      </div>
      <div className="test-card-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="skeleton" style={{ height: 10, width: 80 }} />
      </div>
    </div>
  );
}

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
  const gradeColor = GRADE_COLOR[selectedGrade] ?? '#2b4c7e';

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
            zIndex: 1,
          }}
        >
          {/* Floating geometric shapes */}
          <div className="geo-shape geo-shape-rect" style={{ top: '1.5rem', right: '4%', width: 220, height: 220 }} />
          <div className="geo-shape geo-shape-circle" style={{ bottom: '0.5rem', right: '14%', width: 110, height: 110 }} />
          <div className="geo-shape geo-shape-diamond" style={{ top: '35%', right: '7%', width: 56, height: 56, background: 'rgba(255,255,255,0.03)' }} />
          <div className="geo-shape geo-shape-circle" style={{ top: '15%', right: '28%', width: 32, height: 32, borderColor: 'rgba(200,117,51,0.15)' }} />

          <div style={{ maxWidth: '38rem', position: 'relative', zIndex: 1 }}>
            <p className="hero-eyebrow animate-fade-up stagger-1">
              УМК «Информатика» Босова Л.Л., Босова А.Ю.
            </p>
            <h1 className="hero-title animate-fade-up stagger-2">
              Тестирование
              <br />
              по информатике
            </h1>
            <p className="hero-subtitle animate-fade-up stagger-3" style={{ marginBottom: '2rem' }}>
              Тематические тесты для 5–11 классов. Интерактивная проверка знаний для учителей и учеников.
            </p>

            <div className="animate-fade-up stagger-4">
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
                <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                  Привет, {user.display_name}! Выбери класс и начни тест.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tests catalog ────────────────────────────────── */}
      <div className="page-bg">
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '2.5rem 1.5rem 4rem',
          }}
        >
          <h2
            className="t-display animate-fade-up"
            style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)', marginBottom: '0.375rem' }}
          >
            Тесты по информатике
          </h2>
          <p
            className="t-body animate-fade-up stagger-1"
            style={{ marginBottom: '1.5rem' }}
          >
            Выберите класс и пройдите тематический тест
          </p>

          {/* Grade filter pills */}
          <div
            className="animate-fade-up stagger-2"
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginBottom: '2rem',
            }}
          >
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`grade-pill-btn ${selectedGrade === g ? 'active' : ''}`}
                onClick={() => setSelectedGrade(g)}
                aria-pressed={selectedGrade === g}
                title={GRADE_LABELS[g]}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Grade heading */}
          <div
            className="section-header animate-fade-up stagger-3"
          >
            <span className="section-bar" style={{ background: gradeColor }} />
            <span style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--color-text-primary)' }}>
              {selectedGrade} класс
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              — {GRADE_LABELS[selectedGrade]}
            </span>
            {!loading && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {tests.length}{' '}
                {tests.length === 1 ? 'тест' : tests.length < 5 ? 'теста' : 'тестов'}
              </span>
            )}
          </div>

          {/* Cards grid */}
          <div className="card-grid">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)
            ) : tests.length === 0 ? (
              <div
                className="animate-fade-up empty-state"
                style={{ gridColumn: '1 / -1' }}
              >
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                  Тестов для {selectedGrade} класса пока нет
                </p>
              </div>
            ) : (
              tests.map((test, idx) => <TestCard key={test.id} test={test} index={idx} />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
