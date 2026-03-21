'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { classroomsApi, attemptsApi, assignmentsApi } from '@/lib/api';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

interface Student {
  id: number;
  display_name: string;
  login?: string;
  code?: string;
}

interface Classroom {
  id: number;
  name: string;
  grade: number;
  students: Student[];
}

interface TestInfo {
  id: number;
  title: string;
}

interface JournalRow {
  student: Student;
  results: Record<number, { score_percent: number; duration_seconds: number } | null>;
  average: number | null;
}

interface AssignmentItem {
  id: number;
  test_id: number;
  test_title: string;
  share_link: string | null;
  created_at: string;
  settings: Record<string, unknown>;
}

type Tab = 'students' | 'journal' | 'assignments';

function pluralStudents(n: number) {
  if (n === 1) return '1 ученик';
  if (n >= 2 && n <= 4) return `${n} ученика`;
  return `${n} учеников`;
}

function ScoreBadge({ score }: { score: number }) {
  let cls = 'score-badge score-low';
  if (score >= 70) cls = 'score-badge score-high';
  else if (score >= 40) cls = 'score-badge score-med';
  return <span className={cls}>{Math.round(score)}%</span>;
}

export default function ClassroomPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, role, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [tab, setTab] = useState<Tab>('students');
  const [loading, setLoading] = useState(true);

  // Students
  const [newStudentName, setNewStudentName] = useState('');
  const [batchNames, setBatchNames] = useState('');
  const [showBatch, setShowBatch] = useState(false);
  const [showCredentials, setShowCredentials] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Journal
  const [journalData, setJournalData] = useState<{ tests: TestInfo[]; journal: JournalRow[] } | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);

  // Assignments
  const [assignments, setAssignments] = useState<AssignmentItem[] | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token || role !== 'teacher') {
      router.push('/login');
      return;
    }
    loadClassroom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, role, router, authLoading]);

  async function loadClassroom() {
    try {
      const data = await classroomsApi.get(token!, Number(id)) as Classroom;
      setClassroom(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadJournal() {
    setJournalLoading(true);
    try {
      const data = await attemptsApi.journal(token!, Number(id)) as { tests: TestInfo[]; journal: JournalRow[] };
      setJournalData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setJournalLoading(false);
    }
  }

  async function loadAssignments() {
    setAssignmentsLoading(true);
    try {
      const data = await assignmentsApi.listForClassroom(token!, Number(id)) as AssignmentItem[];
      setAssignments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAssignmentsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'journal' && !journalData && token) {
      loadJournal();
    }
    if (tab === 'assignments' && !assignments && token) {
      loadAssignments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      await classroomsApi.addStudent(token!, Number(id), { display_name: newStudentName.trim() });
      setNewStudentName('');
      showToast('Ученик добавлен');
      await loadClassroom();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось добавить ученика');
    } finally {
      setAdding(false);
    }
  }

  async function handleBatchAdd(e: React.FormEvent) {
    e.preventDefault();
    const names = batchNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setAdding(true);
    setAddError('');
    try {
      await classroomsApi.addStudentsBatch(token!, Number(id), names);
      setBatchNames('');
      setShowBatch(false);
      showToast(`Добавлено учеников: ${names.length}`);
      await loadClassroom();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось добавить учеников');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveStudent(studentId: number) {
    if (!confirm('Удалить ученика из класса?')) return;
    try {
      await classroomsApi.removeStudent(token!, Number(id), studentId);
      showToast('Ученик удалён');
      await loadClassroom();
    } catch (e) {
      showToast('Не удалось удалить ученика', 'error');
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ width: 120, height: 14, background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: '1.25rem' }} />
        <div style={{ width: '50%', height: 28, background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: '1.5rem' }} />
        <div style={{ height: 300, background: 'var(--color-surface-3)', borderRadius: 10 }} />
      </div>
    );
  }

  if (!classroom) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <p className="t-body">Класс не найден</p>
      </div>
    );
  }

  const gradeColor = `var(--color-g${classroom.grade})`;

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      {/* Back */}
      <button type="button" onClick={() => router.push('/dashboard/classrooms')} className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        К классам
      </button>

      {/* Classroom header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '10px',
            border: `2px solid ${gradeColor}`,
            background: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            fontWeight: 800,
            color: gradeColor,
            flexShrink: 0,
          }}
        >
          {classroom.grade}
        </div>
        <div>
          <h1 className="t-title">{classroom.name}</h1>
          <p className="t-caption">{pluralStudents(classroom.students.length)}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`tab-btn ${tab === 'students' ? 'active' : ''}`}
          onClick={() => setTab('students')}
        >
          Ученики
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'journal' ? 'active' : ''}`}
          onClick={() => setTab('journal')}
        >
          Журнал
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'assignments' ? 'active' : ''}`}
          onClick={() => setTab('assignments')}
        >
          Задания
        </button>
      </div>

      {/* ── Students tab ──────────────────────────────────── */}
      {tab === 'students' && (
        <div>
          {/* Add form */}
          <div className="card-lg" style={{ padding: '1.125rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <h2 className="t-subtitle">Добавить учеников</h2>
              <button
                type="button"
                onClick={() => { setShowBatch(!showBatch); setAddError(''); }}
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showBatch ? 'По одному' : 'Списком'}
              </button>
            </div>

            {showBatch ? (
              <form onSubmit={handleBatchAdd}>
                <textarea
                  value={batchNames}
                  onChange={(e) => setBatchNames(e.target.value)}
                  placeholder={"Введите имена, каждое с новой строки:\nИванов Иван\nПетрова Мария\nСидоров Алексей"}
                  className="input"
                  style={{ minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }}
                />
                {addError && (
                  <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{addError}</p>
                )}
                <button
                  type="submit"
                  disabled={adding}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '0.625rem' }}
                >
                  {adding ? 'Добавление...' : 'Добавить всех'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="ФИО ученика"
                  className="input"
                  style={{ flex: 1 }}
                  required
                />
                <button
                  type="submit"
                  disabled={adding}
                  className="btn btn-primary"
                >
                  {adding ? (
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                  ) : 'Добавить'}
                </button>
              </form>
            )}
            {!showBatch && addError && (
              <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{addError}</p>
            )}
          </div>

          {/* Students table */}
          <div className="card-lg" style={{ overflow: 'hidden' }}>
            {classroom.students.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <p className="t-caption">В классе пока нет учеников. Добавьте их выше.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="journal-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: 32 }}>#</th>
                      <th style={{ textAlign: 'left' }}>Ученик</th>
                      <th style={{ textAlign: 'left' }}>Логин / Код</th>
                      <th style={{ textAlign: 'right', width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classroom.students.map((student, i) => (
                      <tr key={student.id}>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{i + 1}</td>
                        <td>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {student.display_name}
                          </span>
                        </td>
                        <td>
                          {showCredentials === student.id && student.login ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <code
                                style={{
                                  fontSize: '0.8125rem',
                                  background: 'var(--color-surface-2)',
                                  border: '1px solid var(--color-border)',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {student.login}
                              </code>
                              <code
                                style={{
                                  fontSize: '0.8125rem',
                                  background: 'var(--color-surface-2)',
                                  border: '1px solid var(--color-border)',
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {student.code}
                              </code>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowCredentials(showCredentials === student.id ? null : student.id)}
                              style={{
                                fontSize: '0.8125rem',
                                color: 'var(--color-accent)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              Показать
                            </button>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(student.id)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assignments tab ─────────────────────────────────── */}
      {tab === 'assignments' && (
        <div>
          {assignmentsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
                <p className="t-caption">Загружаем задания...</p>
              </div>
            </div>
          ) : !assignments || assignments.length === 0 ? (
            <div
              style={{
                padding: '4rem 1rem',
                textAlign: 'center',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: '12px',
              }}
            >
              <p className="t-subtitle" style={{ marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>
                Нет заданий
              </p>
              <p className="t-caption" style={{ marginBottom: '1rem' }}>
                Тесты для этого класса ещё не выданы
              </p>
              <Link href="/dashboard" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                Выдать тест
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {assignments.map((a) => {
                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                const fullLink = a.share_link ? `${origin}/share/${a.share_link}` : null;
                return (
                  <div key={a.id} className="card-lg" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <Link
                        href={`/test/${a.test_id}`}
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9375rem',
                          color: 'var(--color-accent)',
                          textDecoration: 'none',
                        }}
                      >
                        {a.test_title || `Тест #${a.test_id}`}
                      </Link>
                      <span className="t-caption">
                        {new Date(a.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span className="t-caption">
                        Попыток: {(a.settings.max_attempts as number) || 1}
                      </span>
                      {Boolean(a.settings.shuffle_questions) && (
                        <span className="t-caption">Перемешивание вопросов</span>
                      )}
                      {Boolean(a.settings.shuffle_answers) && (
                        <span className="t-caption">Перемешивание ответов</span>
                      )}
                    </div>
                    {fullLink && (
                      <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code
                          style={{
                            flex: 1,
                            fontSize: '0.75rem',
                            background: 'var(--color-surface-2)',
                            border: '1px solid var(--color-border)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {fullLink}
                        </code>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ flexShrink: 0 }}
                          onClick={() => {
                            navigator.clipboard.writeText(fullLink);
                            setCopiedLink(a.id);
                            setTimeout(() => setCopiedLink(null), 2000);
                          }}
                        >
                          {copiedLink === a.id ? 'Скопировано' : 'Копировать'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Journal tab ───────────────────────────────────── */}
      {tab === 'journal' && (
        <div>
          {journalLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
                <p className="t-caption">Загружаем журнал...</p>
              </div>
            </div>
          ) : !journalData || journalData.tests.length === 0 ? (
            <div
              style={{
                padding: '4rem 1rem',
                textAlign: 'center',
                border: '1px dashed var(--color-border-strong)',
                borderRadius: '12px',
              }}
            >
              <p className="t-subtitle" style={{ marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>
                Журнал пуст
              </p>
              <p className="t-caption">
                Ученики ещё не проходили тесты, либо им не выданы тесты для этого класса
              </p>
            </div>
          ) : (
            <div className="card-lg" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="journal-table" style={{ minWidth: '36rem' }}>
                  <thead>
                    <tr>
                      {/* Sticky student name column */}
                      <th
                        style={{
                          textAlign: 'left',
                          minWidth: '12rem',
                          position: 'sticky',
                          left: 0,
                          background: 'var(--color-surface-2)',
                          zIndex: 2,
                        }}
                      >
                        Ученик
                      </th>
                      {journalData.tests.map(test => (
                        <th
                          key={test.id}
                          title={test.title}
                          style={{
                            textAlign: 'center',
                            minWidth: '6rem',
                            maxWidth: '8rem',
                          }}
                        >
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '7rem',
                              textAlign: 'center',
                            }}
                          >
                            {/* Strip "Тест N." prefix if present */}
                            {test.title.replace(/^Тест\s+\d+\.\s*/i, '')}
                          </div>
                        </th>
                      ))}
                      <th
                        style={{
                          textAlign: 'center',
                          minWidth: '5rem',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Средняя
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalData.journal.map((row, i) => (
                      <tr key={row.student.id}>
                        {/* Sticky name */}
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                            zIndex: 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: '1.25rem', textAlign: 'right' }}>
                              {i + 1}
                            </span>
                            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                              {row.student.display_name}
                            </span>
                          </div>
                        </td>

                        {/* Test results */}
                        {journalData.tests.map(test => {
                          const result = row.results[test.id];
                          return (
                            <td key={test.id} style={{ textAlign: 'center' }}>
                              {result ? (
                                <Link href={`/classroom/${id}/stats/${test.id}`} style={{ textDecoration: 'none' }}>
                                  <ScoreBadge score={result.score_percent} />
                                </Link>
                              ) : (
                                <span style={{ color: 'var(--color-border-strong)', fontSize: '0.875rem' }}>—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Average */}
                        <td style={{ textAlign: 'center' }}>
                          {row.average !== null ? (
                            <span
                              style={{
                                fontSize: '0.9375rem',
                                fontWeight: 700,
                                color: row.average >= 70
                                  ? 'var(--color-ok)'
                                  : row.average >= 40
                                  ? 'var(--color-warn)'
                                  : 'var(--color-danger)',
                              }}
                            >
                              {Math.round(row.average)}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-border-strong)', fontSize: '0.875rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '0.75rem 1.125rem',
                  borderTop: '1px solid var(--color-border)',
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { cls: 'score-badge score-high', label: '≥ 70%' },
                  { cls: 'score-badge score-med', label: '40–70%' },
                  { cls: 'score-badge score-low', label: '< 40%' },
                ].map(({ cls, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span className={cls}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
