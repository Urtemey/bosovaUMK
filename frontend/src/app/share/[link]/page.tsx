'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { assignmentsApi, attemptsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Question {
  id: number;
  order: number;
  question_type: string;
  content: Record<string, unknown>;
  points: number;
}

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  description: string;
  question_count: number;
  questions: Question[];
}

interface Assignment {
  id: number;
  test_id: number;
  settings_override: Record<string, unknown>;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: 'Одиночный выбор',
  multiple_choice: 'Множественный выбор',
  text_input: 'Ввод ответа',
  matching: 'Соответствие',
  drag_drop: 'Перетаскивание',
  select_list: 'Выбор из списка',
};

function pluralQuestions(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

export default function ShareLinkPage() {
  const { link } = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const [test, setTest] = useState<Test | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anonymousName, setAnonymousName] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await assignmentsApi.getByLink(String(link)) as { assignment: Assignment; test: Test };
        setAssignment(data.assignment);
        setTest(data.test);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить тест');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [link]);

  const handleStart = async () => {
    if (!user && !anonymousName.trim()) return;
    if (!test || !assignment) return;
    setStarting(true);
    try {
      const body: { test_id: number; assignment_id?: number; anonymous_name?: string } = {
        test_id: test.id,
        assignment_id: assignment.id,
      };
      if (!user) {
        body.anonymous_name = anonymousName.trim();
      }
      const res = await attemptsApi.start(body, token) as Record<string, unknown>;
      const attempt = res.attempt as { id: number };
      router.push(`/attempt/${attempt.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось начать тест');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
            <p className="t-caption">Загружаем тест...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !test) {
    return (
      <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--color-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '1.5rem',
          }}
        >
          !
        </div>
        <p className="t-subtitle" style={{ marginBottom: '0.5rem' }}>Ссылка недействительна</p>
        <p className="t-caption">{error}</p>
      </div>
    );
  }

  if (!test || !assignment) return null;

  const gradeVar = `var(--color-g${test.grade})`;

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '1.5rem 1rem 2.5rem' }}>
      {/* Test header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: gradeVar,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {test.grade} класс
          </span>
          {test.topic && (
            <>
              <span className="t-caption" style={{ color: 'var(--color-border-strong)' }}>·</span>
              <span className="t-caption">{test.topic}</span>
            </>
          )}
        </div>
        <h1 className="t-display" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)' }}>{test.title}</h1>
        {test.description && (
          <p className="t-body" style={{ marginTop: '0.5rem' }}>{test.description}</p>
        )}
      </div>

      {/* Test info card */}
      <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {test.question_count}
            </div>
            <div className="t-caption">{pluralQuestions(test.question_count)}</div>
          </div>
          <div style={{ width: 1, background: 'var(--color-border)' }} />
          <div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {(assignment.settings_override?.max_attempts as number) || 1}
            </div>
            <div className="t-caption">попыток</div>
          </div>
        </div>
      </div>

      {/* Questions list */}
      {test.questions && test.questions.length > 0 && (
        <div className="card-lg" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
            <h2 className="t-label">Вопросы</h2>
          </div>
          {test.questions.map((q, i) => (
            <div
              key={q.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 1rem',
                borderBottom: i < test.questions.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span className="t-caption">{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Anonymous name input */}
      {!user && (
        <div style={{ marginBottom: '1rem' }}>
          <label className="label">Ваше имя</label>
          <input
            type="text"
            className="input"
            value={anonymousName}
            onChange={(e) => setAnonymousName(e.target.value)}
            placeholder="Введите ваше имя"
            style={{ marginTop: '0.375rem' }}
            required
          />
        </div>
      )}

      {error && (
        <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{error}</p>
      )}

      {/* Start button */}
      <button
        type="button"
        onClick={handleStart}
        disabled={starting || (!user && !anonymousName.trim())}
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
      >
        {starting ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            Загрузка...
          </span>
        ) : 'Начать тест'}
      </button>
    </div>
  );
}
