'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { attemptsApi } from '@/lib/api';

interface StudentResult {
  student: { id: number; display_name: string };
  attempt: {
    id: number;
    score_percent: number;
    duration_seconds: number;
    started_at: string;
    finished_at: string;
  } | null;
}

interface QuestionStat {
  question_id: number;
  order: number;
  question_type: string;
  text: string;
  total_answered: number;
  correct_count: number;
  wrong_count: number;
  correct_percent: number | null;
  avg_time_seconds: number | null;
}

interface StatsData {
  classroom: { id: number; name: string; grade: number };
  test: { id: number; title: string };
  student_results: StudentResult[];
  question_stats: QuestionStat[];
  total_students: number;
  attempted_count: number;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} сек`;
  return `${m} мин ${s} сек`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export default function TestStatsPage() {
  const { id, testId } = useParams();
  const router = useRouter();
  const { token, role, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!token || role !== 'teacher') {
      router.push('/login');
      return;
    }
    async function load() {
      try {
        const result = await attemptsApi.stats(token!, Number(id), Number(testId)) as StatsData;
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, testId, token, role, router, authLoading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
          <p className="t-caption">Загружаем статистику...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <p className="t-body" style={{ color: 'var(--color-danger)' }}>{error || 'Данные не найдены'}</p>
      </div>
    );
  }

  const avgScore = data.student_results
    .filter(r => r.attempt)
    .reduce((sum, r) => sum + (r.attempt?.score_percent || 0), 0);
  const attemptedCount = data.attempted_count;
  const avgScoreValue = attemptedCount > 0 ? Math.round(avgScore / attemptedCount) : 0;

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      {/* Back */}
      <button type="button" onClick={() => router.push(`/classroom/${id}`)} className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Назад к классу
      </button>

      {/* Header */}
      <h1 className="t-title" style={{ marginBottom: '0.25rem' }}>{data.test.title}</h1>
      <p className="t-caption" style={{ marginBottom: '1.5rem' }}>
        {data.classroom.name} -- Детальная статистика
      </p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="card-lg" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
          <p className="t-caption" style={{ marginBottom: '0.25rem' }}>Прошли тест</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {attemptedCount} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>из {data.total_students}</span>
          </p>
        </div>
        <div className="card-lg" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
          <p className="t-caption" style={{ marginBottom: '0.25rem' }}>Средний балл</p>
          <p style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: avgScoreValue >= 70 ? 'var(--color-ok)' : avgScoreValue >= 40 ? 'var(--color-warn)' : 'var(--color-danger)',
          }}>
            {attemptedCount > 0 ? `${avgScoreValue}%` : '--'}
          </p>
        </div>
        <div className="card-lg" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
          <p className="t-caption" style={{ marginBottom: '0.25rem' }}>Вопросов</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {data.question_stats.length}
          </p>
        </div>
      </div>

      {/* Student results table */}
      <div className="card-lg" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="t-subtitle">Результаты учеников</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="journal-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Ученик</th>
                <th style={{ textAlign: 'center' }}>Результат</th>
                <th style={{ textAlign: 'center' }}>Длительность</th>
                <th style={{ textAlign: 'center' }}>Дата</th>
              </tr>
            </thead>
            <tbody>
              {data.student_results.map((r) => (
                <tr key={r.student.id}>
                  <td>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {r.student.display_name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.attempt ? (
                      <span className={`score-badge ${
                        r.attempt.score_percent >= 70 ? 'score-high' :
                        r.attempt.score_percent >= 40 ? 'score-med' : 'score-low'
                      }`}>
                        {Math.round(r.attempt.score_percent)}%
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>--</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="t-caption">
                      {r.attempt?.duration_seconds ? formatDuration(r.attempt.duration_seconds) : '--'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="t-caption">
                      {r.attempt?.finished_at ? formatDate(r.attempt.finished_at) : '--'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-question stats */}
      <div className="card-lg" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="t-subtitle">Статистика по вопросам</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="journal-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: 40 }}>#</th>
                <th style={{ textAlign: 'left' }}>Вопрос</th>
                <th style={{ textAlign: 'center' }}>Правильных</th>
                <th style={{ textAlign: 'center' }}>Неправильных</th>
                <th style={{ textAlign: 'center' }}>Среднее время</th>
              </tr>
            </thead>
            <tbody>
              {data.question_stats.map((q) => {
                let diffColor = 'var(--color-text-muted)';
                let diffCls = '';
                if (q.correct_percent !== null) {
                  if (q.correct_percent >= 70) {
                    diffColor = 'var(--color-ok)';
                    diffCls = 'score-high';
                  } else if (q.correct_percent >= 40) {
                    diffColor = 'var(--color-warn)';
                    diffCls = 'score-med';
                  } else {
                    diffColor = 'var(--color-danger)';
                    diffCls = 'score-low';
                  }
                }
                return (
                  <tr key={q.question_id}>
                    <td style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{q.order}</td>
                    <td>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                        {truncate(q.text, 60)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {q.correct_percent !== null ? (
                        <span className={`score-badge ${diffCls}`}>
                          {q.correct_count}/{q.total_answered} ({q.correct_percent}%)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>--</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: q.wrong_count > 0 ? diffColor : 'var(--color-text-muted)' }}>
                        {q.wrong_count}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="t-caption">
                        {q.avg_time_seconds !== null ? formatDuration(q.avg_time_seconds) : '--'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
