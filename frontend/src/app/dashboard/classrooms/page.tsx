'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { classroomsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

interface Classroom {
  id: number;
  name: string;
  grade: number;
  student_count: number;
}

function pluralStudents(n: number) {
  if (n === 1) return '1 ученик';
  if (n >= 2 && n <= 4) return `${n} ученика`;
  return `${n} учеников`;
}

const gradeVar = (g: number) => `var(--color-g${g})`;

export default function ClassroomsPage() {
  const { token, role } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState(5);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!token || role !== 'teacher') {
      router.push('/login');
      return;
    }
    loadClassrooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, router]);

  async function loadClassrooms() {
    try {
      const data = await classroomsApi.list(token!) as Classroom[];
      setClassrooms(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await classroomsApi.create(token!, { name: newName.trim(), grade: newGrade });
      setNewName('');
      setShowCreate(false);
      showToast('Класс создан');
      await loadClassrooms();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Не удалось создать класс');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: '44rem', margin: '0 auto', padding: '1.5rem 1rem 2.5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="t-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '0.25rem' }}>
            Мои классы
          </h1>
          <p className="t-caption">Управление классами и учениками</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(!showCreate); setCreateError(''); }}
          className={showCreate ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
        >
          {showCreate ? 'Отмена' : '+ Создать класс'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 className="t-subtitle" style={{ marginBottom: '1rem' }}>Новый класс</h2>
          <form onSubmit={handleCreate}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: '0.625rem',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <label className="label" htmlFor="className">Название</label>
                <input
                  id="className"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="5А"
                  className="input"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="classGrade">Класс</label>
                <select
                  id="classGrade"
                  value={newGrade}
                  onChange={(e) => setNewGrade(Number(e.target.value))}
                  className="input"
                  style={{ width: 'auto', paddingRight: '2rem' }}
                >
                  {[5, 6, 7, 8, 9, 10, 11].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-end' }}
              >
                {creating ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                  </span>
                ) : 'Создать'}
              </button>
            </div>
            {createError && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
                {createError}
              </p>
            )}
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 68, background: 'var(--color-surface-3)', borderRadius: 8 }} />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <div
          style={{
            padding: '4rem 1rem',
            textAlign: 'center',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: '12px',
          }}
        >
          <p className="t-subtitle" style={{ marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>
            Классов пока нет
          </p>
          <p className="t-caption">Создайте первый класс, чтобы добавлять учеников</p>
        </div>
      ) : (
        <div
          className="card-lg"
          style={{ overflow: 'hidden' }}
          role="list"
          aria-label="Список классов"
        >
          {classrooms.map((classroom, idx) => (
            <Link
              key={classroom.id}
              href={`/classroom/${classroom.id}`}
              role="listitem"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.875rem 1.125rem',
                borderBottom: idx < classrooms.length - 1 ? '1px solid var(--color-border)' : 'none',
                textDecoration: 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-surface-2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              }}
            >
              {/* Grade badge */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  background: 'var(--color-surface-2)',
                  border: `2px solid ${gradeVar(classroom.grade)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: gradeVar(classroom.grade),
                  flexShrink: 0,
                }}
              >
                {classroom.grade}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)', marginBottom: '0.125rem' }}>
                  {classroom.name}
                </p>
                <p className="t-caption">{pluralStudents(classroom.student_count)}</p>
              </div>

              {/* Chevron */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
