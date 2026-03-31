'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { assignmentsApi, attemptsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  question_count: number;
  settings: Record<string, unknown>;
}

interface Assignment {
  id: number;
  test_id: number;
  settings_override: Record<string, unknown>;
  test: Test;
}

function pluralQ(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

const GRADE_COLOR: Record<number, string> = {
  5: '#2b4c7e', 6: '#3b7cc1', 7: '#7c54c4',
  8: '#c87533', 9: '#2b9e6b', 10: '#c44b5c', 11: '#9b45b5',
};

export default function MyAssignmentsPage() {
  const { token, user, role } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    if (!token || role !== 'student') {
      router.replace('/student-login');
      return;
    }
    assignmentsApi.my(token)
      .then((data) => setAssignments(data as Assignment[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, role, router]);

  const handleStart = async (a: Assignment) => {
    if (!token) return;
    setStarting(a.id);
    try {
      const res = await attemptsApi.start({ test_id: a.test.id, assignment_id: a.id }, token) as { attempt: { id: number } };
      router.push(`/attempt/${res.attempt.id}`);
    } catch (e) {
      console.error(e);
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ marginBottom: '0.75rem', padding: '1.25rem' }}>
            <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 13, width: '40%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <h1 className="t-display" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)', marginBottom: '0.375rem' }}>
        Мои задания
      </h1>
      {user && (
        <p className="t-caption" style={{ marginBottom: '1.5rem' }}>
          {user.display_name}
        </p>
      )}

      {assignments.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p className="t-body" style={{ color: 'var(--color-text-muted)' }}>
            Заданий пока нет
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {assignments.map((a) => {
            const color = GRADE_COLOR[a.test.grade] ?? 'var(--color-accent)';
            const maxAttempts = (a.settings_override?.max_attempts ?? a.test.settings?.max_attempts ?? 1) as number;
            return (
              <div
                key={a.id}
                className="card"
                style={{ padding: '1.25rem', borderLeft: `3px solid ${color}`, display: 'flex', alignItems: 'center', gap: '1rem' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {a.test.grade} класс
                    </span>
                  </div>
                  <h3 className="t-subtitle" style={{ marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.test.title}
                  </h3>
                  <p className="t-caption">
                    {pluralQ(a.test.question_count)} · {maxAttempts} {maxAttempts === 1 ? 'попытка' : maxAttempts < 5 ? 'попытки' : 'попыток'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleStart(a)}
                  disabled={starting === a.id}
                  style={{ flexShrink: 0 }}
                >
                  {starting === a.id ? 'Загрузка...' : 'Начать'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
