'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { attemptsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import SingleChoice from '@/components/questions/SingleChoice';
import MultipleChoice from '@/components/questions/MultipleChoice';
import TextInput from '@/components/questions/TextInput';
import Matching from '@/components/questions/Matching';
import DragDrop from '@/components/questions/DragDrop';
import SelectFromList from '@/components/questions/SelectFromList';

interface Question {
  id: number;
  order: number;
  question_type: string;
  content: Record<string, unknown>;
  points: number;
}

interface Attempt {
  id: number;
  test_id: number;
  started_at: string;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ─── Q-nav button (compact) ─────────────────────────────────── */
interface QBtnProps {
  num: number;
  current: boolean;
  saved: boolean;
  hasAnswer: boolean;
  onClick: () => void;
  compact?: boolean;
}

function QBtn({ num, current, saved, hasAnswer, onClick, compact }: QBtnProps) {
  let cls = compact ? 'q-map-btn' : 'q-btn';
  if (current) cls += ' current';
  else if (saved) cls += ' saved';
  else if (hasAnswer) cls += ' answered';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      aria-current={current ? 'step' : undefined}
      aria-label={`Вопрос ${num}${saved ? ', подтверждён' : hasAnswer ? ', с ответом' : ''}`}
    >
      {num}
    </button>
  );
}

/* ─── Question Map Overlay ───────────────────────────────────── */
interface QMapProps {
  questions: Question[];
  currentIdx: number;
  savedQuestions: Set<number>;
  answers: Record<number, unknown>;
  onSelect: (idx: number) => void;
  onClose: () => void;
}

function QuestionMap({ questions, currentIdx, savedQuestions, answers, onSelect, onClose }: QMapProps) {
  const savedCount = questions.filter(q => savedQuestions.has(q.id)).length;
  const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;

  return (
    <div className="q-map-overlay" onClick={onClose}>
      <div className="q-map-panel animate-scale-in" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 className="t-subtitle" style={{ margin: 0 }}>Карта вопросов</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-ok)', display: 'inline-block' }} />
            Подтверждено ({savedCount})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-accent-muted)', display: 'inline-block' }} />
            С ответом ({answeredCount - savedCount})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', display: 'inline-block' }} />
            Без ответа
          </span>
        </div>

        {/* Grid */}
        <div className="q-map-grid">
          {questions.map((q, i) => (
            <QBtn
              key={q.id}
              num={i + 1}
              current={i === currentIdx}
              saved={savedQuestions.has(q.id)}
              hasAnswer={answers[q.id] !== undefined}
              onClick={() => { onSelect(i); onClose(); }}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AttemptPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token } = useAuth();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [savedQuestions, setSavedQuestions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const questionAreaRef = useRef<HTMLDivElement>(null);

  // Threshold: use grid sidebar for >=15 questions
  const isLargeTest = questions.length >= 15;

  useEffect(() => {
    async function load() {
      try {
        const res = await attemptsApi.get(Number(id), token) as Record<string, unknown>;
        const attemptData = (res.id ? res : res.attempt) as Attempt;

        if ((res as Record<string, unknown>).is_finished) {
          router.replace(`/results/${id}`);
          return;
        }

        setAttempt(attemptData);

        const { testsApi } = await import('@/lib/api');
        const test = await testsApi.get(attemptData.test_id) as { questions: Question[] };
        setQuestions(test.questions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token, router]);

  // Timer
  useEffect(() => {
    if (!attempt) return;
    const start = new Date(attempt.started_at).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIdx(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1));
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
        e.preventDefault();
        setShowMap(prev => !prev);
      } else if (e.key === 'Escape' && showMap) {
        setShowMap(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [questions.length, showMap]);

  const currentQuestion = questions[currentIdx];

  const handleAnswer = useCallback((value: unknown) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
  }, [currentQuestion]);

  const handleSaveAnswer = async () => {
    if (!currentQuestion || !attempt) return;
    const answer = answers[currentQuestion.id];
    if (answer === undefined || answer === null) return;

    setSaving(true);
    setSaveError('');
    try {
      await attemptsApi.submitAnswer(attempt.id, {
        question_id: currentQuestion.id,
        answer,
      }, token);
      setSavedQuestions(prev => new Set(prev).add(currentQuestion.id));
      // Auto-advance to next unanswered question
      const nextUnsaved = questions.findIndex(
        (q, i) => i > currentIdx && !savedQuestions.has(q.id) && q.id !== currentQuestion.id
      );
      if (nextUnsaved !== -1) {
        setCurrentIdx(nextUnsaved);
      } else if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
      }
    } catch {
      setSaveError('Не удалось сохранить ответ. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      if (currentQuestion && answers[currentQuestion.id] !== undefined) {
        await attemptsApi.submitAnswer(attempt.id, {
          question_id: currentQuestion.id,
          answer: answers[currentQuestion.id],
        }, token);
      }
      await attemptsApi.finish(attempt.id, token);
      router.push(`/results/${attempt.id}`);
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const renderQuestion = () => {
    if (!currentQuestion) return null;
    const props = {
      content: currentQuestion.content as never,
      value: answers[currentQuestion.id],
      onChange: handleAnswer,
    };

    switch (currentQuestion.question_type) {
      case 'single_choice':   return <SingleChoice {...props} />;
      case 'multiple_choice': return <MultipleChoice {...props} />;
      case 'text_input':      return <TextInput {...props} />;
      case 'matching':        return <Matching {...props} />;
      case 'drag_drop':       return <DragDrop {...props} />;
      case 'select_list':     return <SelectFromList {...props} />;
      default:
        return <p className="t-body">Неизвестный тип вопроса</p>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
          <p className="t-caption">Загружаем тест...</p>
        </div>
      </div>
    );
  }

  const savedCount = savedQuestions.size;
  const totalCount = questions.length;
  const progressPct = totalCount > 0 ? (savedCount / totalCount) * 100 : 0;
  const currentHasAnswer = currentQuestion && answers[currentQuestion.id] !== undefined;
  const currentIsSaved = currentQuestion && savedQuestions.has(currentQuestion.id);
  const allSaved = savedCount === totalCount && totalCount > 0;

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        background: 'var(--color-surface-2)',
      }}
    >
      {/* ── Question Map Overlay ─────────────────────────────── */}
      {showMap && (
        <QuestionMap
          questions={questions}
          currentIdx={currentIdx}
          savedQuestions={savedQuestions}
          answers={answers}
          onSelect={setCurrentIdx}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* ── Fixed top progress bar ─────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 40,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Progress fill */}
        <div className="progress-bar" style={{ borderRadius: 0, height: 3 }}>
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div
          style={{
            maxWidth: '60rem',
            margin: '0 auto',
            padding: '0.625rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <span className="t-caption">
            <strong style={{ color: 'var(--color-text-primary)' }}>{savedCount}</strong>
            <span style={{ color: 'var(--color-text-muted)' }}> / {totalCount}</span>
          </span>

          {/* Map toggle button */}
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }}
            title="Карта вопросов (M)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            <span className="hidden sm:inline">Карта</span>
            <span className="kbd hidden sm:inline" style={{ marginLeft: '0.125rem' }}>M</span>
          </button>

          {/* Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span
              style={{
                fontFamily: "'SF Mono', 'Fira Mono', monospace",
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div
        style={{
          maxWidth: '60rem',
          margin: '0 auto',
          padding: '1.25rem 1rem 6rem',
          display: 'flex',
          gap: '1.25rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Q-nav sidebar — desktop */}
        <aside
          className="hidden sm:block"
          style={{
            width: isLargeTest ? '11rem' : '3.25rem',
            flexShrink: 0,
            position: 'sticky',
            top: 120,
          }}
          aria-label="Навигация по вопросам"
        >
          {isLargeTest ? (
            /* Grid layout for large tests */
            <div className="q-nav-grid">
              {questions.map((q, i) => (
                <QBtn
                  key={q.id}
                  num={i + 1}
                  current={i === currentIdx}
                  saved={savedQuestions.has(q.id)}
                  hasAnswer={answers[q.id] !== undefined}
                  onClick={() => setCurrentIdx(i)}
                />
              ))}
            </div>
          ) : (
            /* Single column for small tests */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {questions.map((q, i) => (
                <QBtn
                  key={q.id}
                  num={i + 1}
                  current={i === currentIdx}
                  saved={savedQuestions.has(q.id)}
                  hasAnswer={answers[q.id] !== undefined}
                  onClick={() => setCurrentIdx(i)}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Question area */}
        <div ref={questionAreaRef} style={{ flex: 1, minWidth: 0 }}>
          {/* Question header */}
          <div style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <span
              className="t-caption"
              style={{ fontWeight: 600, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}
            >
              Вопрос {currentIdx + 1} из {totalCount}
            </span>
            {currentQuestion && (
              <span className="t-caption">{currentQuestion.points} балл{currentQuestion.points === 1 ? '' : currentQuestion.points < 5 ? 'а' : 'ов'}</span>
            )}
          </div>

          {/* Question card */}
          <div
            className="card-lg"
            style={{
              padding: '1.5rem',
              borderLeft: currentIsSaved ? '3px solid var(--color-ok)' : currentHasAnswer ? '3px solid var(--color-accent)' : undefined,
            }}
          >
            {renderQuestion()}
          </div>

          {/* Save error */}
          {saveError && (
            <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>
              {saveError}
            </div>
          )}

          {/* Mobile Q-nav — horizontal scroll for small, grid for large */}
          <div
            className="sm:hidden"
            style={{ marginTop: '1rem' }}
            aria-label="Навигация по вопросам"
          >
            <div className={isLargeTest ? 'q-nav-grid' : 'q-nav-scroll'}>
              {questions.map((q, i) => (
                <QBtn
                  key={q.id}
                  num={i + 1}
                  current={i === currentIdx}
                  saved={savedQuestions.has(q.id)}
                  hasAnswer={answers[q.id] !== undefined}
                  onClick={() => setCurrentIdx(i)}
                />
              ))}
            </div>
          </div>

          {/* Action bar */}
          <div
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            {/* Prev / Next */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="btn btn-secondary btn-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Назад
              </button>
              <button
                type="button"
                onClick={() => setCurrentIdx(Math.min(totalCount - 1, currentIdx + 1))}
                disabled={currentIdx === totalCount - 1}
                className="btn btn-secondary btn-sm"
              >
                Далее
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <span className="kbd hidden sm:inline" title="Стрелки для навигации">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </div>

            {/* Save / Finish */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!currentIsSaved && (
                <button
                  type="button"
                  onClick={handleSaveAnswer}
                  disabled={!currentHasAnswer || saving}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                      Сохранение...
                    </span>
                  ) : 'Подтвердить ответ'}
                </button>
              )}
              {currentIsSaved && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-ok)',
                    fontWeight: 500,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Ответ сохранён
                </span>
              )}
              {allSaved && (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={submitting}
                  className="btn btn-cta btn-sm"
                >
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                      Завершение...
                    </span>
                  ) : 'Завершить тест'}
                </button>
              )}
            </div>
          </div>

          {/* Finish early */}
          {!allSaved && savedCount > 0 && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="t-caption"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: 0,
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                }}
              >
                Завершить досрочно ({savedCount}/{totalCount} ответов)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
