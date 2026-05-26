'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { testsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  question_count: number;
}

const GRADES = [5, 6, 7, 8, 9, 10, 11];

const EXAM_CATALOG_RE = /(vpr|oge|ege|\u0432\u043f\u0440|\u043e\u0433\u044d|\u0435\u0433\u044d|\u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430)/i;


const GRADE_BG: Record<number, string> = {
  5: '#edf2f9',
  6: '#eef4fb',
  7: '#f3eff9',
  8: '#fef6ee',
  9: '#edf9f3',
  10: '#fdf0f2',
  11: '#f5eef8',
};

const GRADE_COLOR: Record<number, string> = {
  5: '#2b4c7e',
  6: '#3b7cc1',
  7: '#7c54c4',
  8: '#c87533',
  9: '#2b9e6b',
  10: '#c44b5c',
  11: '#9b45b5',
};



function pluralQ(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

interface DragSlot {
  draggable: boolean;
  inGrid: boolean;
  floating?: { x: number; y: number; width: number; height: number };
  setGridRef?: (el: HTMLAnchorElement | null) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLAnchorElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLAnchorElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLAnchorElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLAnchorElement>) => void;
  onClickCapture?: (e: React.MouseEvent) => void;
}

function TestCard({
  test,
  index,
  assignClassroom,
  drag,
}: {
  test: Test;
  index: number;
  assignClassroom: number | null;
  drag?: DragSlot;
}) {
  const bg = GRADE_BG[test.grade] ?? '#f0fdfa';
  const color = GRADE_COLOR[test.grade] ?? '#2b4c7e';
  const href = assignClassroom
    ? `/test/${test.id}?assign_classroom=${assignClassroom}`
    : `/test/${test.id}`;

  const floating = drag?.floating;

  const dragStyle: React.CSSProperties = drag
    ? floating
      ? {
          position: 'fixed',
          left: floating.x,
          top: floating.y,
          width: floating.width,
          height: floating.height,
          margin: 0,
          zIndex: 1000,
          transform: 'scale(1.04) rotate(-1.5deg)',
          boxShadow:
            '0 30px 60px rgba(26, 31, 37, 0.28), 0 12px 28px rgba(43, 76, 126, 0.18)',
          cursor: 'grabbing',
          transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms',
          willChange: 'transform, left, top',
          userSelect: 'none',
        }
      : {
          cursor: drag.draggable ? 'grab' : 'pointer',
          touchAction: drag.draggable ? 'none' : undefined,
          userSelect: drag.draggable ? 'none' : undefined,
        }
    : {};

  const refCallback = drag
    ? (el: HTMLAnchorElement | null) => {
        if (drag.inGrid && drag.setGridRef) drag.setGridRef(el);
      }
    : undefined;

  return (
    <Link
      href={href}
      ref={refCallback as never}
      className="test-card animate-fade-up"
      style={{
        animationDelay: floating ? undefined : `${0.05 * Math.min(index, 8)}s`,
        ...dragStyle,
      }}
      onPointerDown={drag?.onPointerDown}
      onPointerMove={drag?.onPointerMove}
      onPointerUp={drag?.onPointerUp}
      onPointerCancel={drag?.onPointerCancel}
      onClickCapture={drag?.onClickCapture}
      draggable={false}
    >
      <div className="test-card-top" style={{ background: bg }}>
        <span
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            color,
            lineHeight: 1,
          }}
        >
          {test.grade} класс
        </span>
      </div>

      <div className="test-card-body">
        <h3
          title={test.title}
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            lineHeight: 1.4,
            color: 'var(--color-text-primary)',
            marginTop: '0.125rem',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 'calc(0.9375rem * 1.4 * 3)',
          } as React.CSSProperties}
        >
          {test.title}
        </h3>
        {test.topic && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {test.topic}
          </p>
        )}
      </div>

      <div className="test-card-footer">
        <span>{pluralQ(test.question_count)}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontWeight: 600 }}>
          Пройти →
        </span>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="test-card" style={{ pointerEvents: 'none' }}>
      <div className="skeleton" style={{ height: 84, borderRadius: 0 }} />
      <div className="test-card-body">
        <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 14, width: '85%', marginTop: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '60%' }} />
      </div>
      <div className="test-card-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="skeleton" style={{ height: 10, width: 80 }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [testsByGrade, setTestsByGrade] = useState<Record<number, Test[]>>({});
  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [assignClassroom, setAssignClassroom] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, role, token } = useAuth();
  const canReorder = role === 'admin' && !assignClassroom;

  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dragRef = useRef<{
    testId: number;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const [drag, setDrag] = useState<
    | { testId: number; x: number; y: number; width: number; height: number }
    | null
  >(null);

  const persistOrder = async (grade: number, list: Test[]) => {
    if (!token) return;
    try {
      await testsApi.reorder(token, grade, list.map((t) => t.id));
    } catch (e) {
      console.error('Не удалось сохранить порядок тестов', e);
    }
  };

  const animateShifts = (prevRects: Map<number, DOMRect>) => {
    requestAnimationFrame(() => {
      prevRects.forEach((prevRect, id) => {
        const el = cardRefs.current.get(id);
        if (!el) return;
        const newRect = el.getBoundingClientRect();
        const dx = prevRect.left - newRect.left;
        const dy = prevRect.top - newRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        void el.offsetWidth;
        el.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      });
    });
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLAnchorElement>,
    test: Test,
  ) => {
    if (!canReorder) return;
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    dragRef.current = {
      testId: test.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const s = dragRef.current;
    if (!s || e.pointerId !== s.pointerId) return;

    if (!s.moved) {
      const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
      if (dist < 6) return;
      s.moved = true;
      document.body.style.cursor = 'grabbing';
    }

    e.preventDefault();
    setDrag({
      testId: s.testId,
      x: e.clientX - s.offsetX,
      y: e.clientY - s.offsetY,
      width: s.width,
      height: s.height,
    });

    const list = testsByGrade[selectedGrade] || [];
    const srcIdx = list.findIndex((t) => t.id === s.testId);
    if (srcIdx === -1) return;

    let targetIdx = -1;
    for (let i = 0; i < list.length; i++) {
      if (i === srcIdx) continue;
      const el = cardRefs.current.get(list[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      ) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1 || targetIdx === srcIdx) return;

    const prevRects = new Map<number, DOMRect>();
    cardRefs.current.forEach((el, id) => {
      if (el) prevRects.set(id, el.getBoundingClientRect());
    });

    const next = [...list];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(targetIdx, 0, moved);
    setTestsByGrade((prev) => ({ ...prev, [selectedGrade]: next }));
    animateShifts(prevRects);
  };

  const finishDrag = (e: React.PointerEvent<HTMLAnchorElement>, persist: boolean) => {
    const s = dragRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    const wasMoved = s.moved;
    dragRef.current = null;
    setDrag(null);
    document.body.style.cursor = '';
    if (wasMoved) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 50);
      if (persist) {
        const list = testsByGrade[selectedGrade] || [];
        void persistOrder(selectedGrade, list);
      }
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = Number(params.get('grade'));
    if (GRADES.includes(g)) setSelectedGrade(g);
    const a = Number(params.get('assign'));
    if (a > 0) setAssignClassroom(a);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const all = (await testsApi.list()) as Test[];
        const visibleTests = role === 'student'
          ? all.filter((test) => EXAM_CATALOG_RE.test(`${test.title} ${test.topic || ''}`))
          : all;
        const grouped: Record<number, Test[]> = {};
        for (const t of visibleTests) {
          if (!grouped[t.grade]) grouped[t.grade] = [];
          grouped[t.grade].push(t);
        }
        setTestsByGrade(grouped);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role]);

  const tests = testsByGrade[selectedGrade] || [];
  const gradeColor = GRADE_COLOR[selectedGrade] ?? '#2b4c7e';

  return (
    <>
      {/* ── Hero banner ─────────────────────────────────── */}
      <section className="hero-banner">
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: 'clamp(2.5rem, 5vw, 4.5rem) 1.5rem clamp(3rem, 6vw, 5.5rem)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Floating geometric shapes */}
          <div className="geo-shape geo-shape-rect" style={{ top: '1.5rem', right: '4%', width: 220, height: 220 }} />
          <div className="geo-shape geo-shape-circle" style={{ bottom: '0.5rem', right: '14%', width: 110, height: 110 }} />
          <div className="geo-shape geo-shape-diamond" style={{ top: '35%', right: '7%', width: 56, height: 56, background: 'rgba(255,255,255,0.03)' }} />
          <div className="geo-shape geo-shape-circle" style={{ top: '15%', right: '28%', width: 32, height: 32, borderColor: 'rgba(200,117,51,0.15)' }} />

          <div style={{ maxWidth: '38rem', position: 'relative', zIndex: 1 }}>
            <p className="hero-eyebrow animate-fade-up stagger-1">
              УМК «Информатика» Босова Л.Л., Босова А.Ю.
            </p>
            <h1 className="hero-title animate-fade-up stagger-2">
              Тестирование
              <br />
              по информатике
            </h1>
            <p className="hero-subtitle animate-fade-up stagger-3" style={{ marginBottom: '2rem' }}>
              Тематические тесты для 5–11 классов. Интерактивная проверка знаний для учителей и учеников.
            </p>

            <div className="animate-fade-up stagger-4">
              {!user && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link href="/login" className="btn btn-lg btn-cta">
                    Войти как учитель
                  </Link>
                  <Link href="/student-login" className="btn btn-lg btn-outline-white">
                    Войти как ученик
                  </Link>
                </div>
              )}

              {user && (role === 'teacher' || role === 'admin') && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link href={role === 'admin' ? '/dashboard' : '/'} className="btn btn-lg btn-cta">
                    {role === 'admin' ? 'Мои тесты' : 'Каталог'}
                  </Link>
                  <Link href="/dashboard/classrooms" className="btn btn-lg btn-outline-white">
                    Мои классы
                  </Link>
                </div>
              )}

              {user && role === 'student' && (
                <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                  Привет, {user.display_name}! Выбери класс и начни тест.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tests catalog ────────────────────────────────── */}
      <div className="page-bg">
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '2.5rem 1.5rem 4rem',
          }}
        >
          <h2
            className="t-display animate-fade-up"
            style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)', marginBottom: '0.375rem' }}
          >
            Тесты по информатике
          </h2>
          <p
            className="t-body animate-fade-up stagger-1"
            style={{ marginBottom: '1.5rem' }}
          >
            Выберите класс и пройдите тематический тест
          </p>

          {assignClassroom && (
            <div
              className="animate-fade-up"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1rem', marginBottom: '1.5rem',
                background: 'var(--color-accent-light)',
                border: '1px solid var(--color-accent)',
                borderRadius: 8, fontSize: '0.875rem', color: 'var(--color-accent)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              Выберите тест — откроется окно выдачи с уже выбранным классом
            </div>
          )}

          {/* Grade filter pills */}
          <div
            className="animate-fade-up stagger-2"
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginBottom: '2rem',
            }}
          >
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`grade-pill-btn ${selectedGrade === g ? 'active' : ''}`}
                onClick={() => setSelectedGrade(g)}
                aria-pressed={selectedGrade === g}
                title={`${g} класс`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Grade heading */}
          <div
            className="section-header animate-fade-up stagger-3"
          >
            <span className="section-bar" style={{ background: gradeColor }} />
            <span style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--color-text-primary)' }}>
              {selectedGrade} класс
            </span>
            {!loading && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {tests.length}{' '}
                {tests.length === 1 ? 'тест' : tests.length < 5 ? 'теста' : 'тестов'}
              </span>
            )}
          </div>
          {canReorder && !loading && tests.length > 1 && (
            <p
              className="t-caption"
              style={{ marginTop: '-0.5rem', marginBottom: '1rem', color: 'var(--color-text-muted)' }}
            >
              Перетащите карточку, чтобы изменить порядок отображения в каталоге.
            </p>
          )}

          {/* Cards grid */}
          <div className="card-grid">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)
            ) : tests.length === 0 ? (
              <div
                className="animate-fade-up empty-state"
                style={{ gridColumn: '1 / -1' }}
              >
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                  Тестов для {selectedGrade} класса пока нет
                </p>
              </div>
            ) : (
              tests.map((test, idx) => {
                const isDragged = drag?.testId === test.id;
                const slot: DragSlot | undefined = canReorder
                  ? {
                      draggable: true,
                      inGrid: !isDragged,
                      floating: isDragged
                        ? { x: drag!.x, y: drag!.y, width: drag!.width, height: drag!.height }
                        : undefined,
                      setGridRef: (el) => {
                        if (el) cardRefs.current.set(test.id, el);
                        else cardRefs.current.delete(test.id);
                      },
                      onPointerDown: (e) => handlePointerDown(e, test),
                      onPointerMove: handlePointerMove,
                      onPointerUp: (e) => finishDrag(e, true),
                      onPointerCancel: (e) => finishDrag(e, false),
                      onClickCapture: handleClickCapture,
                    }
                  : undefined;
                return (
                  <Fragment key={test.id}>
                    {isDragged && drag && (
                      <div
                        ref={(el) => {
                          if (el) cardRefs.current.set(test.id, el);
                          else cardRefs.current.delete(test.id);
                        }}
                        aria-hidden
                        style={{
                          height: drag.height,
                          border: '2px dashed var(--color-accent)',
                          borderRadius: 16,
                          background: 'rgba(43, 76, 126, 0.06)',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                    <TestCard
                      test={test}
                      index={idx}
                      assignClassroom={assignClassroom}
                      drag={slot}
                    />
                  </Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
