'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { testsApi } from '@/lib/api';

interface QuestionLite {
  id: number;
  content: { text?: string };
}

interface SplitTarget {
  id: number;
  title: string;
  grade: number;
  question_count: number;
}

interface Props {
  test: SplitTarget;
  token: string;
  onClose: () => void;
  onDone: (createdCount: number) => void;
}

function stripHtml(html: string): string {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

/** Даёт равные границы (split after question X) для k частей при n вопросах. */
function evenBoundaries(n: number, k: number): number[] {
  const result: number[] = [];
  for (let i = 1; i < k; i++) {
    result.push(Math.round((i * n) / k));
  }
  // гарантируем строго возрастающие в диапазоне 1..n-1
  for (let i = 0; i < result.length; i++) {
    const min = i + 1;
    const max = n - (result.length - i);
    result[i] = Math.min(Math.max(result[i], min), max);
    if (i > 0 && result[i] <= result[i - 1]) result[i] = result[i - 1] + 1;
  }
  return result;
}

export default function SplitTestModal({ test, token, onClose, onDone }: Props) {
  const [questions, setQuestions] = useState<QuestionLite[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const n = questions?.length ?? test.question_count;

  const [numParts, setNumParts] = useState(2);
  const [boundaries, setBoundaries] = useState<number[]>(() => evenBoundaries(test.question_count, 2));
  const [names, setNames] = useState<string[]>(() => [`${test.title} — часть 1`, `${test.title} — часть 2`]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = (await testsApi.get(test.id, token)) as { questions: QuestionLite[] };
        if (active) setQuestions(data.questions || []);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить вопросы');
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [test.id, token]);

  // Пересчёт границ/имён при смене числа частей.
  const applyNumParts = useCallback(
    (k: number) => {
      const clamped = Math.min(Math.max(k, 2), Math.max(2, n));
      setNumParts(clamped);
      setBoundaries(evenBoundaries(n, clamped));
      setNames((prev) =>
        Array.from({ length: clamped }, (_, i) => prev[i] ?? `${test.title} — часть ${i + 1}`),
      );
    },
    [n, test.title],
  );

  // Когда подгрузились реальные вопросы — обновить границы, если число изменилось.
  useEffect(() => {
    if (questions) {
      setBoundaries(evenBoundaries(questions.length, numParts));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const parts = useMemo(() => {
    const sorted = [...boundaries].sort((a, b) => a - b);
    const ranges: { start: number; end: number }[] = [];
    let prev = 0;
    for (let i = 0; i < numParts; i++) {
      const end = i < numParts - 1 ? sorted[i] : n;
      ranges.push({ start: prev + 1, end });
      prev = end;
    }
    return ranges;
  }, [boundaries, numParts, n]);

  function setBoundary(idx: number, value: number) {
    const min = idx + 1; // хотя бы по одному вопросу в каждой части слева
    const max = n - (numParts - 1 - idx);
    const v = Math.min(Math.max(value, min), max);
    setBoundaries((prev) => {
      const next = [...prev];
      next[idx] = v;
      // поддерживаем строгое возрастание
      for (let i = idx + 1; i < next.length; i++) {
        if (next[i] <= next[i - 1]) next[i] = next[i - 1] + 1;
      }
      for (let i = idx - 1; i >= 0; i--) {
        if (next[i] >= next[i + 1]) next[i] = next[i + 1] - 1;
      }
      return next;
    });
  }

  function setName(idx: number, value: string) {
    setNames((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  const valid =
    !!questions &&
    n >= 2 &&
    parts.every((p) => p.start <= p.end) &&
    names.slice(0, numParts).every((nm) => nm.trim().length > 0);

  async function handleSubmit() {
    if (!valid) return;
    setSubmitting(true);
    setError('');
    try {
      const segments = parts.map((p, i) => ({ title: names[i].trim(), start: p.start, end: p.end }));
      const created = (await testsApi.split(token, test.id, { segments })) as unknown[];
      onDone(created.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось разделить тест');
      setSubmitting(false);
    }
  }

  function questionText(idx1: number): string {
    if (!questions || idx1 < 1 || idx1 > questions.length) return '';
    return truncate(stripHtml(questions[idx1 - 1]?.content?.text || '')) || `Вопрос ${idx1}`;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,24,30,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-lg"
        style={{ width: '100%', maxWidth: '40rem', padding: '1.5rem', background: 'var(--color-surface)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 className="t-subtitle" style={{ marginBottom: '0.25rem' }}>Разделить тест</h2>
            <p className="t-caption">«{test.title}» · {n} вопр.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">&times;</button>
        </div>

        {loadError ? (
          <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{loadError}</p>
        ) : !questions ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="skeleton" style={{ height: 48 }} />
            <div className="skeleton" style={{ height: 48 }} />
          </div>
        ) : n < 2 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            В тесте меньше 2 вопросов — разделять нечего.
          </p>
        ) : (
          <>
            {/* Число частей */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span className="label" style={{ margin: 0 }}>Число частей</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={numParts <= 2} onClick={() => applyNumParts(numParts - 1)}>−</button>
                <span style={{ minWidth: '1.5rem', textAlign: 'center', fontWeight: 700 }}>{numParts}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={numParts >= n} onClick={() => applyNumParts(numParts + 1)}>+</button>
              </div>
            </div>

            {/* Части */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {parts.map((p, i) => {
                const count = p.end - p.start + 1;
                return (
                  <div key={i}>
                    <div style={{ padding: '0.875rem 1rem', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
                          Часть {i + 1}
                        </span>
                        <span className="t-caption">
                          вопросы {p.start}–{p.end} · {count} шт.
                        </span>
                      </div>
                      <input
                        type="text"
                        className="input"
                        value={names[i] ?? ''}
                        onChange={(e) => setName(i, e.target.value)}
                        placeholder={`Название части ${i + 1}`}
                      />
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        <div>↳ начало: <span style={{ color: 'var(--color-text-secondary)' }}>{questionText(p.start)}</span></div>
                        {count > 1 && (
                          <div>↳ конец: <span style={{ color: 'var(--color-text-secondary)' }}>{questionText(p.end)}</span></div>
                        )}
                      </div>
                    </div>

                    {/* Граница между частями */}
                    {i < numParts - 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0 0.5rem 1rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>разделить после вопроса №</span>
                        <input
                          type="number"
                          className="input"
                          value={boundaries[i]}
                          min={i + 1}
                          max={n - (numParts - 1 - i)}
                          onChange={(e) => setBoundary(i, Number(e.target.value))}
                          style={{ width: '5rem' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="t-caption" style={{ marginTop: '1.25rem', color: 'var(--color-text-muted)' }}>
              Исходный тест сохранится, но будет переведён в черновик, чтобы не дублировать новые части в каталоге.
            </p>

            {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>Отмена</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={!valid || submitting}>
                {submitting ? 'Разделение…' : `Создать ${numParts} ${numParts < 5 ? 'части' : 'частей'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
