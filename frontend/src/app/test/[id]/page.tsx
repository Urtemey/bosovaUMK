'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { testsApi, attemptsApi, assignmentsApi, classroomsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

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
  settings: Record<string, unknown>;
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

/* ─── Stat tile ─────────────────────────────────────────────── */
function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
        {value}
      </div>
      <div className="t-caption" style={{ marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

interface ClassroomOption {
  id: number;
  name: string;
  grade: number;
  students: { id: number; display_name: string }[];
}

/* ─── Assignment modal ────────────────────────────────────── */
function AssignModal({
  testId,
  token,
  onClose,
}: {
  testId: number;
  token: string;
  onClose: () => void;
}) {
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [loadingCls, setLoadingCls] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [assignTo, setAssignTo] = useState<'class' | 'student'>('class');
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [createShareLink, setCreateShareLink] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await classroomsApi.list(token) as ClassroomOption[];
        setClassrooms(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCls(false);
      }
    }
    load();
  }, [token]);

  const currentClassroom = classrooms.find(c => c.id === selectedClassroom);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        test_id: testId,
        settings: {
          max_attempts: maxAttempts,
          shuffle_questions: shuffleQuestions,
          shuffle_answers: shuffleAnswers,
        },
        create_share_link: createShareLink,
      };
      if (selectedClassroom) {
        body.classroom_id = selectedClassroom;
      }
      if (assignTo === 'student' && selectedStudent) {
        body.student_id = selectedStudent;
      }
      const res = await assignmentsApi.create(token, body) as Record<string, unknown>;
      setSuccess(true);
      if (res.share_link) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${origin}/share/${res.share_link}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать задание');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyLink() {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card-lg"
        style={{
          width: '100%',
          maxWidth: '28rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
        }}
      >
        {success ? (
          <div>
            <h2 className="t-title" style={{ marginBottom: '1rem' }}>Задание создано</h2>
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--color-ok-bg, #ecfdf5)',
                border: '1px solid var(--color-ok, #10b981)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: 'var(--color-ok, #10b981)',
                marginBottom: '1rem',
              }}
            >
              Тест успешно выдан!
            </div>
            {shareLink && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Ссылка для доступа</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
                  <input
                    type="text"
                    className="input"
                    value={shareLink}
                    readOnly
                    style={{ flex: 1, fontSize: '0.8125rem', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCopyLink}
                  >
                    Копировать
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 className="t-title">Выдать тест</h2>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: 'var(--color-text-muted)',
                  padding: '0.25rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Classroom select */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Класс</label>
              {loadingCls ? (
                <div className="t-caption" style={{ marginTop: '0.375rem' }}>Загрузка классов...</div>
              ) : classrooms.length === 0 ? (
                <div className="t-caption" style={{ marginTop: '0.375rem', color: 'var(--color-text-muted)' }}>
                  У вас нет классов. Создайте класс в разделе &laquo;Классы&raquo;.
                </div>
              ) : (
                <select
                  className="input"
                  value={selectedClassroom || ''}
                  onChange={(e) => {
                    setSelectedClassroom(e.target.value ? Number(e.target.value) : null);
                    setSelectedStudent(null);
                  }}
                  style={{ marginTop: '0.375rem' }}
                >
                  <option value="">-- Выберите класс --</option>
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.grade} класс)</option>
                  ))}
                </select>
              )}
            </div>

            {/* Assign to class or student */}
            {selectedClassroom && currentClassroom && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Кому выдать</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="radio"
                      name="assignTo"
                      checked={assignTo === 'class'}
                      onChange={() => { setAssignTo('class'); setSelectedStudent(null); }}
                    />
                    Всему классу
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="radio"
                      name="assignTo"
                      checked={assignTo === 'student'}
                      onChange={() => setAssignTo('student')}
                    />
                    Конкретному ученику
                  </label>
                </div>
                {assignTo === 'student' && (
                  <select
                    className="input"
                    value={selectedStudent || ''}
                    onChange={(e) => setSelectedStudent(e.target.value ? Number(e.target.value) : null)}
                    style={{ marginTop: '0.5rem' }}
                  >
                    <option value="">-- Выберите ученика --</option>
                    {currentClassroom.students.map(s => (
                      <option key={s.id} value={s.id}>{s.display_name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Share link toggle */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={createShareLink}
                  onChange={(e) => setCreateShareLink(e.target.checked)}
                />
                Создать ссылку для доступа (без авторизации)
              </label>
            </div>

            {/* Settings */}
            <div
              style={{
                padding: '0.875rem 1rem',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                marginBottom: '1rem',
              }}
            >
              <div className="t-label" style={{ marginBottom: '0.75rem' }}>Настройки</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="label" style={{ minWidth: '10rem', margin: 0 }}>Макс. попыток</label>
                  <input
                    type="number"
                    className="input"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                    min={1}
                    style={{ width: '5rem' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                  />
                  Перемешивать вопросы
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={shuffleAnswers}
                    onChange={(e) => setShuffleAnswers(e.target.checked)}
                  />
                  Перемешивать ответы
                </label>
              </div>
            </div>

            {error && (
              <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || (!selectedClassroom && !createShareLink)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  Создание...
                </span>
              ) : 'Выдать'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function TestViewPage() {
  const { id } = useParams();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const { token, role } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await testsApi.get(Number(id)) as Test;
        setTest(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleStartTest = async () => {
    setStarting(true);
    try {
      const res = await attemptsApi.start({ test_id: Number(id) }, token) as Record<string, unknown>;
      const attempt = res.attempt as { id: number };
      router.push(`/attempt/${attempt.id}`);
    } catch (e) {
      console.error(e);
      setStarting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!test || !token) return;
    setDuplicating(true);
    try {
      const newTest = await testsApi.duplicate(token, test.id) as { id: number };
      showToast('Тест дублирован');
      router.push(`/dashboard/tests/${newTest.id}/edit`);
    } catch (e) {
      console.error(e);
      showToast('Не удалось дублировать', 'error');
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ height: 16, width: 80, background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: '1.5rem' }} />
        <div style={{ height: 28, width: '60%', background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 14, width: '35%', background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: '1.5rem' }} />
        <div className="card-lg" style={{ height: 160, background: 'var(--color-surface-3)' }} />
      </div>
    );
  }

  if (!test) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <p className="t-body">Тест не найден</p>
      </div>
    );
  }

  const gradeVar = `var(--color-g${test.grade})`;

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.5rem 1rem 2.5rem' }}>
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
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
        Назад
      </button>

      {/* Title row */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
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

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.625rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatTile value={test.question_count} label={pluralQuestions(test.question_count)} />
        <StatTile value={test.settings.max_attempts as number || 1} label="попыток" />
        <StatTile value={test.settings.shuffle_questions ? 'Да' : 'Нет'} label="перемешивание" />
        <StatTile value={test.settings.show_score ? 'Да' : 'Нет'} label="показ баллов" />
      </div>

      {/* Teacher note */}
      {role === 'teacher' && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--color-warn-bg)',
            border: '1px solid var(--color-accent-muted)',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: 'var(--color-warn)',
            marginBottom: '1.5rem',
          }}
        >
          Вы просматриваете тест как учитель. Ученики увидят только вопросы без правильных ответов.
        </div>
      )}

      {/* Teacher actions */}
      {role === 'teacher' && token && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setShowAssignModal(true)}
          >
            Выдать тест
          </button>
          <Link
            href={`/dashboard/tests/${test.id}/edit`}
            className="btn btn-secondary"
            style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
          >
            Редактировать
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleDuplicate}
            disabled={duplicating}
          >
            {duplicating ? 'Копирование...' : 'Дублировать'}
          </button>
        </div>
      )}

      {/* Assign modal */}
      {showAssignModal && token && (
        <AssignModal
          testId={test.id}
          token={token}
          onClose={() => setShowAssignModal(false)}
        />
      )}

      {/* Questions preview */}
      {test.questions.length > 0 && (
        <div className="card-lg" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
            <h2 className="t-subtitle">Содержание теста</h2>
          </div>
          <div>
            {test.questions.map((q, i) => (
              <div
                key={q.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  borderBottom: i < test.questions.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: '0.9375rem',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(q.content.text as string) || 'Вопрос'}
                  </p>
                  <span className="t-caption">{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</span>
                </div>
                <span className="t-caption" style={{ flexShrink: 0 }}>{q.points} б.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start button */}
      <button
        type="button"
        onClick={handleStartTest}
        disabled={starting}
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
      >
        {starting ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            Загрузка...
          </span>
        ) : 'Начать тест'}
      </button>
    </div>
  );
}
