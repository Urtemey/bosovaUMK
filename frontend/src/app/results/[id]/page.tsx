'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { attemptsApi, testsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface AnswerData {
  id: number;
  question_id: number;
  student_answer: unknown;
  is_correct: boolean;
}

interface AttemptData {
  id: number;
  test_id: number;
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  score_percent: number;
  is_finished: boolean;
  answers: AnswerData[];
}

interface Question {
  id: number;
  order: number;
  question_type: string;
  content: Record<string, unknown>;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} сек`;
  return `${m} мин ${s} сек`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}


export default function ResultsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const attemptData = await attemptsApi.get(Number(id), token) as AttemptData;
        setAttempt(attemptData);

        const test = await testsApi.get(attemptData.test_id) as { title: string; questions: Question[] };
        setTestTitle(test.title);
        setQuestions(test.questions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
          <p className="t-caption">Загружаем результаты...</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div style={{ maxWidth: '40rem', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <p className="t-body">Результаты не найдены</p>
      </div>
    );
  }

  const score = Math.round(attempt.score_percent);
  const correctCount = attempt.answers.filter(a => a.is_correct).length;
  const wrongAnswers = questions.filter(q => {
    const ans = attempt.answers.find(a => a.question_id === q.id);
    return ans && !ans.is_correct;
  });

  // Score colour
  let scoreColor = 'var(--color-danger)';
  let scoreBorder = '#fecaca';
  let scoreBg = 'var(--color-danger-bg)';
  if (score >= 70) {
    scoreColor = 'var(--color-ok)';
    scoreBorder = '#bbf7d0';
    scoreBg = 'var(--color-ok-bg)';
  } else if (score >= 40) {
    scoreColor = 'var(--color-warn)';
    scoreBorder = 'var(--color-accent-muted)';
    scoreBg = 'var(--color-warn-bg)';
  }

  // SVG circle
  const R = 48;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - score / 100);

  return (
    <div style={{ maxWidth: '44rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/')}
        className="t-caption"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          marginBottom: '1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: 'var(--color-text-muted)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        На главную
      </button>

      {/* Test title */}
      <h1 className="t-title" style={{ marginBottom: '0.25rem' }}>{testTitle}</h1>
      <p className="t-caption" style={{ marginBottom: '1.5rem' }}>Результаты прохождения</p>

      {/* Score card */}
      <div
        style={{
          background: scoreBg,
          border: `1px solid ${scoreBorder}`,
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          alignItems: 'center',
        }}
      >
        {/* Circle + label */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ position: 'relative', width: 112, height: 112 }}>
            <svg
              width="112"
              height="112"
              viewBox="0 0 112 112"
              style={{ transform: 'rotate(-90deg)' }}
              aria-hidden="true"
            >
              <circle
                cx="56"
                cy="56"
                r={R}
                fill="none"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="8"
              />
              <circle
                cx="56"
                cy="56"
                r={R}
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
                {score}%
              </span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            width: '100%',
            maxWidth: '22rem',
          }}
        >
          {[
            { label: 'Правильных', value: `${correctCount} из ${questions.length}` },
            { label: 'Длительность', value: attempt.duration_seconds ? formatDuration(attempt.duration_seconds) : '—' },
            { label: 'Начало', value: attempt.started_at ? formatTime(attempt.started_at) : '—' },
            { label: 'Конец', value: attempt.finished_at ? formatTime(attempt.finished_at) : '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '8px',
                padding: '0.625rem 0.875rem',
              }}
            >
              <div className="t-caption">{label}</div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)', marginTop: '0.125rem' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Question result grid */}
      <div className="card-lg" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="t-subtitle">Ответы по вопросам</h2>
        </div>
        <div style={{ padding: '1.125rem 1.25rem' }}>
          {/* Grid of numbered tiles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
            {questions.map((q, i) => {
              const answer = attempt.answers.find(a => a.question_id === q.id);
              const isCorrect = answer?.is_correct;
              const isAnswered = !!answer;

              let bg = 'var(--color-surface-3)';
              let color = 'var(--color-text-muted)';
              let border = 'transparent';

              if (isAnswered && isCorrect) {
                bg = 'var(--color-ok-bg)';
                color = 'var(--color-ok)';
                border = '#bbf7d0';
              } else if (isAnswered && !isCorrect) {
                bg = 'var(--color-danger-bg)';
                color = 'var(--color-danger)';
                border = '#fecaca';
              }

              return (
                <div
                  key={q.id}
                  title={`Вопрос ${i + 1}: ${isAnswered ? (isCorrect ? 'верно' : 'неверно') : 'без ответа'}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    background: bg,
                    color,
                    border: `1.5px solid ${border}`,
                  }}
                  aria-label={`Вопрос ${i + 1}: ${isAnswered ? (isCorrect ? 'верно' : 'неверно') : 'без ответа'}`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { color: 'var(--color-ok)', bg: 'var(--color-ok-bg)', label: 'Верно' },
              { color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', label: 'Неверно' },
              { color: 'var(--color-text-muted)', bg: 'var(--color-surface-3)', label: 'Без ответа' },
            ].map(({ color, bg, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${color}` }} />
                <span className="t-caption">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wrong answers detail */}
      {wrongAnswers.length > 0 && (
        <div className="card-lg">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
            <h2 className="t-subtitle">Неверные ответы</h2>
          </div>
          <div>
            {wrongAnswers.map((q, idx) => {
              const qIdx = questions.findIndex(qs => qs.id === q.id);
              return (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    gap: '0.875rem',
                    padding: '0.875rem 1.25rem',
                    borderBottom: idx < wrongAnswers.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: 'var(--color-danger-bg)',
                      color: 'var(--color-danger)',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {qIdx + 1}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                      {(q.content.text as string) || `Вопрос ${qIdx + 1}`}
                    </p>
                    <p className="t-caption" style={{ marginTop: '0.25rem', color: 'var(--color-danger)' }}>
                      Ответ неверный
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Retry / Home buttons */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="btn btn-secondary"
        >
          На главную
        </button>
        <button
          type="button"
          onClick={() => router.push(`/test/${attempt.test_id}`)}
          className="btn btn-primary"
        >
          Пройти ещё раз
        </button>
      </div>
    </div>
  );
}
