'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { questionsApi, testsApi } from '@/lib/api';
import HtmlContent from '@/components/ui/HtmlContent';

const GRADES = [5, 6, 7, 8, 9, 10, 11];
const QUESTION_TYPES: Record<string, string> = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  text_input: 'Ввод текста',
  matching: 'Соответствие',
  drag_drop: 'Перетаскивание',
  select_list: 'Выбор из списка',
  ordering: 'Упорядочивание',
  code: 'Код',
};

interface QuestionItem {
  id: number;
  test_id: number;
  question_type: string;
  content: Record<string, unknown>;
  points: number;
  test?: { test_id: number; test_title: string; grade: number; topic: string | null };
}

interface MyTest {
  id: number;
  title: string;
  grade: number;
  question_count: number;
}

export default function QuestionBrowserPage() {
  const { token, role } = useAuth();

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [grade, setGrade] = useState<number | undefined>();
  const [questionType, setQuestionType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [topics, setTopics] = useState<Record<string, string[]>>({});
  const [topic, setTopic] = useState<string | undefined>();

  // Selection & add-to-test
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [myTests, setMyTests] = useState<MyTest[]>([]);
  const [targetTestId, setTargetTestId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Load topics
  useEffect(() => {
    if (!token || role !== 'teacher') return;
    questionsApi.topics(token).then(res => setTopics(res.topics)).catch(() => {});
    testsApi.my(token).then(res => setMyTests(res as MyTest[])).catch(() => {});
  }, [token, role]);

  // Load questions
  const loadQuestions = useCallback(async () => {
    if (!token || role !== 'teacher') return;
    setLoading(true);
    try {
      const res = await questionsApi.browse(token, {
        grade, topic, question_type: questionType, search, page, per_page: 30,
      });
      setQuestions(res.questions as QuestionItem[]);
      setTotal(res.total);
      setPages(res.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, role, grade, topic, questionType, search, page]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map(q => q.id)));
    }
  };

  const handleAddToTest = async () => {
    if (!token || !targetTestId || selected.size === 0) return;
    setAdding(true);
    setAddResult('');
    try {
      const res = await questionsApi.addToTest(token, {
        test_id: targetTestId,
        question_ids: Array.from(selected),
      });
      setAddResult(`Добавлено ${res.added} вопросов в тест`);
      setSelected(new Set());
      // Refresh my tests to update counts
      testsApi.my(token).then(r => setMyTests(r as MyTest[])).catch(() => {});
    } catch (e) {
      setAddResult(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const resetFilters = () => {
    setGrade(undefined);
    setTopic(undefined);
    setQuestionType(undefined);
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  if (role !== 'teacher') {
    return (
      <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <p className="t-body">Доступ только для учителей</p>
      </div>
    );
  }

  const gradeTopics = grade ? topics[String(grade)] || [] : [];

  return (
    <div className="page-bg" style={{ minHeight: 'calc(100vh - 3.75rem)' }}>
      <div style={{ maxWidth: '75rem', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="t-display" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)', marginBottom: '0.25rem' }}>
            Банк заданий
          </h1>
          <p className="t-body" style={{ color: 'var(--color-text-muted)' }}>
            {total} вопросов. Выберите вопросы и добавьте их в свой тест.
          </p>
        </div>

        {/* Filters row */}
        <div style={{
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
          marginBottom: '1rem', alignItems: 'center',
        }}>
          {/* Grade pills */}
          <button
            type="button"
            className={`grade-pill-btn ${!grade ? 'active' : ''}`}
            onClick={() => { setGrade(undefined); setTopic(undefined); setPage(1); }}
          >
            Все
          </button>
          {GRADES.map(g => (
            <button
              key={g}
              type="button"
              className={`grade-pill-btn ${grade === g ? 'active' : ''}`}
              onClick={() => { setGrade(g); setTopic(undefined); setPage(1); }}
            >
              {g}
            </button>
          ))}

          {/* Type filter */}
          <select
            value={questionType || ''}
            onChange={e => { setQuestionType(e.target.value || undefined); setPage(1); }}
            className="input"
            style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
          >
            <option value="">Все типы</option>
            {Object.entries(QUESTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Topic filter */}
          {gradeTopics.length > 0 && (
            <select
              value={topic || ''}
              onChange={e => { setTopic(e.target.value || undefined); setPage(1); }}
              className="input"
              style={{ width: 'auto', maxWidth: 250, fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
            >
              <option value="">Все темы</option>
              {gradeTopics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <input
              className="input"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Поиск по тексту..."
              style={{ width: 200, fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSearch}>
              Найти
            </button>
          </div>

          {(grade || questionType || search || topic) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Сбросить
            </button>
          )}
        </div>

        {/* Selection toolbar */}
        {selected.size > 0 && (
          <div style={{
            position: 'sticky', top: 60, zIndex: 30,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.625rem 1rem', marginBottom: '1rem',
            background: 'var(--color-accent)', borderRadius: 10,
            color: '#fff', fontSize: '0.875rem',
          }}>
            <span style={{ fontWeight: 700 }}>
              Выбрано: {selected.size}
            </span>
            <button
              type="button"
              onClick={() => setShowAddPanel(!showAddPanel)}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: 6,
                border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
                cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem',
              }}
            >
              Добавить в тест
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              style={{
                marginLeft: 'auto', padding: '0.2rem 0.5rem', borderRadius: 6,
                border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff',
                cursor: 'pointer', fontSize: '0.75rem',
              }}
            >
              Снять выделение
            </button>
          </div>
        )}

        {/* Add-to-test panel */}
        {showAddPanel && selected.size > 0 && (
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <h3 className="t-subtitle" style={{ marginBottom: '0.75rem' }}>Добавить в тест</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={targetTestId ?? ''}
                onChange={e => setTargetTestId(Number(e.target.value) || null)}
                className="input"
                style={{ flex: 1, minWidth: 200, maxWidth: 400 }}
              >
                <option value="">— выберите тест —</option>
                {myTests.map(t => (
                  <option key={t.id} value={t.id}>
                    [{t.grade} кл.] {t.title} ({t.question_count} вопр.)
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-cta btn-sm"
                onClick={handleAddToTest}
                disabled={!targetTestId || adding}
              >
                {adding ? 'Добавление...' : `Добавить ${selected.size} вопросов`}
              </button>
            </div>
            {addResult && (
              <p style={{
                marginTop: '0.5rem', fontSize: '0.8125rem', fontWeight: 600,
                color: addResult.startsWith('Ошибка') ? 'var(--color-danger)' : 'var(--color-ok)',
              }}>
                {addResult}
              </p>
            )}
          </div>
        )}

        {/* Select all checkbox */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <input
              type="checkbox"
              checked={questions.length > 0 && selected.size === questions.length}
              onChange={selectAll}
              style={{ width: 16, height: 16 }}
            />
            Выбрать все на странице
          </label>
        </div>

        {/* Questions list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="card" style={{ padding: '1rem' }}>
                <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>Вопросы не найдены</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {questions.map(q => (
              <QuestionCard
                key={q.id}
                question={q}
                isSelected={selected.has(q.id)}
                onToggle={() => toggleSelect(q.id)}
                token={token}
                onUpdate={(updated) => {
                  setQuestions(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
                }}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.375rem', marginTop: '1.5rem',
          }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ← Назад
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', padding: '0 0.5rem' }}>
              {page} / {pages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
            >
              Далее →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Question Card ─────────────────────────────────────────── */

function QuestionCard({ question: q, isSelected, onToggle, token, onUpdate }: {
  question: QuestionItem;
  isSelected: boolean;
  onToggle: () => void;
  token: string | null;
  onUpdate: (updated: Partial<QuestionItem> & { id: number }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const content = q.content as Record<string, unknown>;
  const text = (content.text as string) || '';
  const [editText, setEditText] = useState(text);
  const [editType, setEditType] = useState(q.question_type);
  const [editPoints, setEditPoints] = useState(q.points);
  const [editOptions, setEditOptions] = useState<string[]>((content.options as string[]) || []);

  const typeName = QUESTION_TYPES[q.question_type] || q.question_type;
  const plainText = text.replace(/<[^>]*>/g, '').trim();
  const preview = plainText.length > 150 ? plainText.slice(0, 150) + '...' : plainText;
  const options = (content.options as string[]) || [];
  const image = content.image as string | undefined;

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(text);
    setEditType(q.question_type);
    setEditPoints(q.points);
    setEditOptions([...options]);
    setEditing(true);
    setExpanded(true);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    setSaving(true);
    try {
      const newContent: Record<string, unknown> = { ...content, text: editText };
      if (editOptions.length > 0) newContent.options = editOptions;
      await questionsApi.update(token, q.id, {
        content: newContent,
        question_type: editType,
        points: editPoints,
      });
      onUpdate({
        id: q.id,
        question_type: editType,
        points: editPoints,
        content: newContent,
      });
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '0.875rem 1rem',
        borderLeft: isSelected ? '3px solid var(--color-accent)' : editing ? '3px solid var(--color-warn)' : undefined,
        background: isSelected ? 'rgba(37, 99, 235, 0.03)' : editing ? 'rgba(192, 123, 34, 0.03)' : undefined,
        cursor: editing ? 'default' : 'pointer',
      }}
      onClick={() => { if (!editing) setExpanded(!expanded); }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => { e.stopPropagation(); onToggle(); }}
          onClick={e => e.stopPropagation()}
          style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, cursor: 'pointer' }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
            {q.test?.grade && (
              <span style={{
                fontSize: '0.6875rem', fontWeight: 700,
                padding: '0.125rem 0.375rem', borderRadius: 4,
                background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)',
              }}>
                {q.test.grade} кл.
              </span>
            )}
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600,
              padding: '0.125rem 0.375rem', borderRadius: 4,
              background: 'var(--color-accent-light)', color: 'var(--color-accent)',
            }}>
              {typeName}
            </span>
            {q.test?.topic && (
              <span style={{
                fontSize: '0.6875rem', color: 'var(--color-text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 250,
              }}>
                {q.test.topic}
              </span>
            )}
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
              #{q.id}
            </span>
            {/* Edit button */}
            {!editing && (
              <button
                type="button"
                onClick={startEdit}
                style={{
                  padding: '0.125rem 0.375rem', borderRadius: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                  cursor: 'pointer', fontSize: '0.6875rem', color: 'var(--color-text-secondary)',
                }}
              >
                Ред.
              </button>
            )}
          </div>

          {/* View mode */}
          {!editing && (
            <>
              {!expanded ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.5, margin: 0 }}>
                  {preview || '(без текста)'}
                </p>
              ) : (
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  <HtmlContent html={text} />
                  {image && (
                    <img src={image} alt="" style={{
                      maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                      border: '1px solid var(--color-border)', marginTop: '0.5rem',
                    }} />
                  )}
                  {options.length > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {options.map((opt, i) => (
                        <div key={i} style={{
                          padding: '0.375rem 0.625rem', borderRadius: 6,
                          background: 'var(--color-surface-2)', fontSize: '0.8125rem',
                        }}>
                          <HtmlContent html={opt} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Edit mode */}
          {editing && (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {/* Type + Points row */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value)}
                  className="input"
                  style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.3rem 0.5rem' }}
                >
                  {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  Баллы:
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editPoints}
                    onChange={e => setEditPoints(Number(e.target.value) || 1)}
                    className="input"
                    style={{ width: 50, fontSize: '0.8125rem', padding: '0.25rem 0.375rem', textAlign: 'center' }}
                  />
                </label>
              </div>

              {/* Text editor */}
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={4}
                className="input"
                style={{ fontSize: '0.8125rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                placeholder="Текст вопроса (HTML поддерживается)"
              />

              {/* Options editor */}
              {editOptions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    Варианты ответа:
                  </span>
                  {editOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 20, textAlign: 'center' }}>{i + 1}</span>
                      <input
                        value={opt}
                        onChange={e => {
                          const newOpts = [...editOptions];
                          newOpts[i] = e.target.value;
                          setEditOptions(newOpts);
                        }}
                        className="input"
                        style={{ flex: 1, fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Save/Cancel */}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveEdit}
                  disabled={saving}
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={cancelEdit}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
