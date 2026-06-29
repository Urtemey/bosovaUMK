'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { testsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import SplitTestModal from '@/components/tests/SplitTestModal';
import { GRADES, SPO_GRADE, gradeSections, gradeLabel, SECTION_LABELS } from '@/lib/sections';

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  section?: string | null;
  question_count: number;
  is_published: boolean;
}

const GRADE_BG: Record<number, string> = {
  5: '#edf2f9',
  6: '#eef4fb',
  7: '#f3eff9',
  8: '#fef6ee',
  9: '#edf9f3',
  10: '#fdf0f2',
  11: '#f5eef8',
  [SPO_GRADE]: '#eef1f4',
};

const GRADE_COLOR: Record<number, string> = {
  5: '#2b4c7e',
  6: '#3b7cc1',
  7: '#7c54c4',
  8: '#c87533',
  9: '#2b9e6b',
  10: '#c44b5c',
  11: '#9b45b5',
  [SPO_GRADE]: '#5a6b7a',
};

function pluralQuestions(n: number) {
  if (n === 1) return '1 вопрос';
  if (n >= 2 && n <= 4) return `${n} вопроса`;
  return `${n} вопросов`;
}

function DashboardTestCard({
  test,
  index,
  onDelete,
  onSplit,
  onMove,
  onExport,
  deleting,
  moving,
  selectMode,
  selected,
  onToggleSelect,
}: {
  test: Test;
  index: number;
  onDelete: (test: Test) => void;
  onSplit: (test: Test) => void;
  onMove: (test: Test) => void;
  onExport: (test: Test) => void;
  deleting: boolean;
  moving: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const bg = GRADE_BG[test.grade] ?? '#f0fdfa';
  const color = GRADE_COLOR[test.grade] ?? '#2b4c7e';

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const cardStyle: React.CSSProperties = {
    animationDelay: `${0.04 * Math.min(index, 10)}s`,
    opacity: deleting || moving ? 0.5 : 1,
    ...(selectMode && selected
      ? { outline: `2px solid ${color}`, outlineOffset: 2 }
      : {}),
    ...(selectMode ? { cursor: 'pointer' } : {}),
  };

  const inner = (
    <>
      <div className="test-card-top" style={{ background: bg }}>
        {selectMode && (
          <div
            style={{
              position: 'absolute', top: '0.625rem', left: '0.625rem', zIndex: 2,
              width: 22, height: 22, borderRadius: '50%',
              border: `2px solid ${selected ? color : 'var(--color-text-muted)'}`,
              background: selected ? color : 'rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {selected && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            right: '0.875rem',
            bottom: '-0.375rem',
            fontSize: '3.5rem',
            fontWeight: 900,
            color,
            opacity: 0.07,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {test.grade}
        </span>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>

        {!selectMode && (
        <div style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', display: 'flex', gap: '0.25rem' }}>
          {/* Скачать (HTML) */}
          <button
            type="button"
            onClick={(e) => { stop(e); onExport(test); }}
            aria-label={`Скачать тест «${test.title}»`}
            title="Скачать в читаемом формате (HTML)"
            className="test-card-action-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
          </button>

          {/* Перенести в класс */}
          <button
            type="button"
            onClick={(e) => { stop(e); onMove(test); }}
            disabled={moving}
            aria-label="Перенести в другой класс"
            title="Перенести в другой класс"
            className="test-card-action-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 9l-3 3 3 3" />
              <path d="M2 12h12" />
              <path d="M19 15l3-3-3-3" />
              <path d="M22 12H10" />
            </svg>
          </button>

          {/* Разделить тест */}
          <button
            type="button"
            onClick={(e) => { stop(e); onSplit(test); }}
            aria-label={`Разделить тест «${test.title}»`}
            title="Разделить тест"
            className="test-card-action-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M20 4L8.12 15.88" />
              <path d="M14.47 14.48L20 20" />
              <path d="M8.12 8.12L12 12" />
            </svg>
          </button>

          {/* Удалить */}
          <button
            type="button"
            onClick={(e) => { stop(e); onDelete(test); }}
            disabled={deleting}
            aria-label={`Удалить тест «${test.title}»`}
            title="Удалить тест"
            className="test-card-action-btn test-card-action-btn-danger"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
        )}
      </div>

      <div className="test-card-body">
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <span className="pill-tag pill-tag-blue">{gradeLabel(test.grade)}</span>
          {test.section && (
            <span className="pill-tag pill-tag-muted">{SECTION_LABELS[test.section] || test.section}</span>
          )}
          <span className={`pill-tag ${test.is_published ? 'pill-tag-green' : 'pill-tag-muted'}`}>
            {test.is_published ? 'Опубликован' : 'Черновик'}
          </span>
        </div>
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
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {test.topic}
          </p>
        )}
      </div>

      <div className="test-card-footer">
        <span>{pluralQuestions(test.question_count)}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-accent)', fontWeight: 600 }}>
          {selectMode ? (selected ? 'Выбран' : 'Выбрать') : 'Открыть →'}
        </span>
      </div>
    </>
  );

  if (selectMode) {
    return (
      <div
        className="test-card animate-fade-up"
        style={cardStyle}
        onClick={() => onToggleSelect(test.id)}
        role="button"
        aria-pressed={selected}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/test/${test.id}`} className="test-card animate-fade-up" style={cardStyle}>
      {inner}
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="test-card" style={{ pointerEvents: 'none' }}>
      <div className="skeleton" style={{ height: 84, borderRadius: 0 }} />
      <div className="test-card-body">
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 999 }} />
        </div>
        <div className="skeleton" style={{ height: 14, width: '85%', marginTop: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '60%' }} />
      </div>
      <div className="test-card-footer" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="skeleton" style={{ height: 10, width: 80 }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { token, role, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [splitTest, setSplitTest] = useState<Test | null>(null);
  const [moveTest, setMoveTest] = useState<Test | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteS3, setDeleteS3] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [settingSection, setSettingSection] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectGrade = (gradeTests: Test[]) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = gradeTests.every((t) => next.has(t.id));
      if (allSelected) gradeTests.forEach((t) => next.delete(t.id));
      else gradeTests.forEach((t) => next.add(t.id));
      return next;
    });

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkOpen(false);
    setDeleteS3(false);
    setSectionOpen(false);
  };

  // Подразделы, доступные для всех выбранных тестов (пересечение по классам).
  // Если выбраны тесты разных классов — общими будут только БУ/УУ.
  const selectedTests = tests.filter((t) => selectedIds.has(t.id));
  const availableSections = (() => {
    const lists = selectedTests.map((t) => gradeSections(t.grade)).filter((l) => l.length > 0);
    if (lists.length === 0) return [];
    return lists.reduce((acc, l) => acc.filter((s) => l.includes(s)));
  })();

  const handleSetSection = async (section: string | null) => {
    if (!token || settingSection || selectedIds.size === 0) return;
    setSettingSection(true);
    try {
      const ids = Array.from(selectedIds);
      const res = (await testsApi.setSection(token, ids, section)) as { updated: number; skipped: number };
      const idSet = new Set(ids);
      setTests((prev) =>
        prev.map((t) =>
          idSet.has(t.id) && (section === null || gradeSections(t.grade).includes(section))
            ? { ...t, section }
            : t,
        ),
      );
      setSectionOpen(false);
      const label = section === null ? 'Без раздела' : SECTION_LABELS[section] || section;
      window.alert(
        `Перемещено в «${label}»: ${res.updated}` +
          (res.skipped ? `\nПропущено (раздел недоступен для класса): ${res.skipped}` : ''),
      );
      exitSelectMode();
    } catch (e) {
      console.error(e);
      window.alert('Не удалось переместить тесты в раздел.');
    } finally {
      setSettingSection(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!token || bulkDeleting || selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = (await testsApi.bulkDelete(token, Array.from(selectedIds), deleteS3)) as {
        deleted_tests: number;
        deleted_questions: number;
        images_deleted: number;
        images_skipped: number;
        images_failed: number;
        s3_error: string | null;
      };
      setTests((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      const parts = [`Удалено тестов: ${res.deleted_tests}, вопросов: ${res.deleted_questions}`];
      if (deleteS3) {
        parts.push(
          `Изображений из S3: удалено ${res.images_deleted}` +
            (res.images_skipped ? `, оставлено (используются) ${res.images_skipped}` : '') +
            (res.images_failed ? `, ошибок ${res.images_failed}` : ''),
        );
        if (res.s3_error) parts.push(res.s3_error);
      }
      window.alert(parts.join('\n'));
      exitSelectMode();
    } catch (e) {
      console.error(e);
      window.alert('Не удалось удалить выбранные тесты.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportOne = async (test: Test) => {
    if (!token || exporting) return;
    setExporting(true);
    try {
      await testsApi.exportOne(token, test.id);
    } catch (e) {
      console.error(e);
      window.alert('Не удалось выгрузить тест.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportBulk = async (ids: number[]) => {
    if (!token || exporting || ids.length === 0) return;
    setExporting(true);
    try {
      await testsApi.exportBulk(token, ids);
    } catch (e) {
      console.error(e);
      window.alert('Не удалось выгрузить тесты.');
    } finally {
      setExporting(false);
    }
  };

  const selectPublished = () =>
    setSelectedIds(new Set(tests.filter((t) => t.is_published).map((t) => t.id)));

  const handleMoveTest = async (test: Test, grade: number) => {
    if (!token || movingId !== null) return;
    setMoveTest(null);
    setMovingId(test.id);
    try {
      await testsApi.update(token, test.id, { grade });
      setTests((prev) => prev.map((t) => (t.id === test.id ? { ...t, grade } : t)));
    } catch (e) {
      console.error(e);
      window.alert('Не удалось перенести тест.');
    } finally {
      setMovingId(null);
    }
  };

  const reloadTests = async () => {
    if (!token) return;
    try {
      const data = (await testsApi.my(token)) as Test[];
      setTests(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTest = async (test: Test) => {
    if (!token) return;
    if (deletingId !== null) return;
    const confirmed = window.confirm(
      `Удалить тест «${test.title}»?\n\nВместе с ним будут удалены все назначения, попытки и ответы учеников.`,
    );
    if (!confirmed) return;
    setDeletingId(test.id);
    try {
      await testsApi.delete(token, test.id);
      setTests((prev) => prev.filter((t) => t.id !== test.id));
    } catch (e) {
      console.error(e);
      window.alert('Не удалось удалить тест. Попробуйте ещё раз.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!token || role !== 'admin') {
      router.push('/login');
      return;
    }
    async function load() {
      try {
        const data = (await testsApi.my(token!)) as Test[];
        setTests(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, role, router, authLoading]);

  const grouped = tests.reduce(
    (acc, t) => {
      if (!acc[t.grade]) acc[t.grade] = [];
      acc[t.grade].push(t);
      return acc;
    },
    {} as Record<number, Test[]>,
  );

  let cardIndex = 0;

  return (
    <>
      {/* ── Teacher hero ────────────────────────────────── */}
      <section className="hero-banner">
        <div
          style={{
            maxWidth: '75rem',
            margin: '0 auto',
            padding: '2.5rem 1.5rem 3rem',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div className="geo-shape geo-shape-rect" style={{ top: '0.5rem', right: '4%', width: 180, height: 180 }} />
          <div className="geo-shape geo-shape-circle" style={{ bottom: '-1.5rem', right: '12%', width: 100, height: 100 }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <p className="hero-eyebrow animate-fade-up stagger-1">Панель учителя</p>
            <h1 className="hero-title animate-fade-up stagger-2" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
              Добро пожаловать{user ? `, ${user.display_name}` : ''}!
            </h1>
            <p className="hero-subtitle animate-fade-up stagger-3" style={{ marginBottom: '1.625rem' }}>
              Создавайте тесты, управляйте классами и отслеживайте успеваемость учеников
            </p>
            <div className="animate-fade-up stagger-4" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/dashboard/tests/new" className="btn btn-lg btn-cta">
                + Создать тест
              </Link>
              <Link href="/dashboard/import" className="btn btn-lg btn-outline-white">
                Импорт из HTML
              </Link>
              <Link href="/dashboard/classrooms" className="btn btn-lg btn-outline-white">
                Мои классы
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tests section ────────────────────────────────── */}
      <div className="page-bg">
        <div style={{ maxWidth: '75rem', margin: '0 auto', padding: '2rem 1.5rem 3.5rem' }}>
          <div
            className="animate-fade-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.75rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <h2 className="t-display" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', marginBottom: '0.125rem' }}>
                Мои тесты
              </h2>
              {!loading && (
                <p className="t-caption">
                  {tests.length} {tests.length === 1 ? 'тест' : tests.length < 5 ? 'теста' : 'тестов'}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selectMode ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={selectPublished}
                    title="Выбрать все опубликованные тесты"
                  >
                    Выбрать опубликованные
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={selectedIds.size === 0 || exporting}
                    onClick={() => handleExportBulk(Array.from(selectedIds))}
                  >
                    {exporting ? 'Выгрузка…' : `Скачать (${selectedIds.size})`}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={selectedIds.size === 0}
                    onClick={() => setSectionOpen(true)}
                  >
                    В раздел ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={selectedIds.size === 0}
                    onClick={() => setBulkOpen(true)}
                  >
                    Удалить выбранные ({selectedIds.size})
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={exitSelectMode}>
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  {tests.length > 0 && (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectMode(true)}>
                      Выбрать
                    </button>
                  )}
                  <Link href="/dashboard/tests/new" className="btn btn-sm btn-primary">
                    + Новый тест
                  </Link>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div>
              {[1, 2].map((i) => (
                <div key={i} style={{ marginBottom: '2rem' }}>
                  <div className="skeleton" style={{ width: 80, height: 14, marginBottom: '0.875rem' }} />
                  <div className="card-grid">
                    {[1, 2, 3].map((j) => <SkeletonCard key={j} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : tests.length === 0 ? (
            <div className="empty-state animate-scale-in">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ margin: '0 auto 1rem', opacity: 0.6 }}
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 7h8M8 11h8M8 15h5" />
              </svg>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
                Тестов пока нет
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Создайте первый тест и выдайте его классу
              </p>
              <Link href="/dashboard/tests/new" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                + Создать тест
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {Object.entries(grouped)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([grade, gradeTests]) => (
                  <section key={grade}>
                    <div className="section-header animate-fade-up">
                      <span className="section-bar" style={{ background: GRADE_COLOR[Number(grade)] ?? 'var(--color-accent)' }} />
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                        {gradeLabel(Number(grade))}
                      </h3>
                      <span className="t-caption">
                        {gradeTests.length}{' '}
                        {gradeTests.length === 1 ? 'тест' : gradeTests.length < 5 ? 'теста' : 'тестов'}
                      </span>
                      {selectMode ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => toggleSelectGrade(gradeTests)}
                        >
                          {gradeTests.every((t) => selectedIds.has(t.id)) ? 'Снять класс' : 'Выбрать класс'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ marginLeft: 'auto' }}
                          disabled={exporting}
                          onClick={() => handleExportBulk(gradeTests.map((t) => t.id))}
                          title={`Скачать все тесты «${gradeLabel(Number(grade))}» одним файлом`}
                        >
                          Скачать класс
                        </button>
                      )}
                    </div>

                    <div className="card-grid">
                      {gradeTests.map((test) => (
                        <DashboardTestCard
                          key={test.id}
                          test={test}
                          index={cardIndex++}
                          onDelete={handleDeleteTest}
                          onSplit={setSplitTest}
                          onMove={setMoveTest}
                          onExport={handleExportOne}
                          deleting={deletingId === test.id}
                          moving={movingId === test.id}
                          selectMode={selectMode}
                          selected={selectedIds.has(test.id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </div>
      </div>

      {splitTest && token && (
        <SplitTestModal
          test={splitTest}
          token={token}
          onClose={() => setSplitTest(null)}
          onDone={(createdCount) => {
            setSplitTest(null);
            reloadTests();
            window.alert(
              `Создано тестов: ${createdCount}. Исходный тест переведён в черновик.`,
            );
          }}
        />
      )}

      {bulkOpen && (
        <div
          onClick={() => !bulkDeleting && setBulkOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,24,30,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-lg"
            style={{ width: '100%', maxWidth: '26rem', padding: '1.5rem', background: 'var(--color-surface)' }}
          >
            <h2 className="t-subtitle" style={{ marginBottom: '0.5rem' }}>
              Удалить тесты ({selectedIds.size})
            </h2>
            <p className="t-caption" style={{ marginBottom: '1rem' }}>
              Будут удалены выбранные тесты вместе с их вопросами, назначениями,
              попытками и ответами учеников. Это действие необратимо.
            </p>

            <label
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--color-surface-2)',
                cursor: 'pointer', marginBottom: '1.25rem',
              }}
            >
              <input
                type="checkbox"
                checked={deleteS3}
                onChange={(e) => setDeleteS3(e.target.checked)}
                style={{ marginTop: '0.15rem', width: 16, height: 16, flexShrink: 0 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Удалить связанные изображения из S3
                </span>
                <span className="t-caption">
                  Только те, что больше не используются другими тестами. Общие
                  картинки останутся.
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" disabled={bulkDeleting} onClick={() => setBulkOpen(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn-danger" disabled={bulkDeleting} onClick={handleBulkDelete}>
                {bulkDeleting ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sectionOpen && (
        <div
          onClick={() => !settingSection && setSectionOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,24,30,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-lg"
            style={{ width: '100%', maxWidth: '26rem', padding: '1.5rem', background: 'var(--color-surface)' }}
          >
            <h2 className="t-subtitle" style={{ marginBottom: '0.5rem' }}>
              Переместить в раздел ({selectedIds.size})
            </h2>
            <p className="t-caption" style={{ marginBottom: '1rem' }}>
              Выбранные тесты будут отнесены к указанному подразделу. Доступны
              только подразделы, общие для классов выбранных тестов.
            </p>

            {availableSections.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                Для выбранных классов нет подразделов. Можно только убрать раздел.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {availableSections.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-secondary"
                    disabled={settingSection}
                    onClick={() => handleSetSection(s)}
                    style={{ minWidth: '4.5rem', flex: '1 0 auto' }}
                  >
                    {SECTION_LABELS[s] || s}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={settingSection}
                onClick={() => handleSetSection(null)}
              >
                Убрать раздел
              </button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={settingSection} onClick={() => setSectionOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {moveTest && (
        <div
          onClick={() => setMoveTest(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(20,24,30,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-lg"
            style={{ width: '100%', maxWidth: '24rem', padding: '1.5rem', background: 'var(--color-surface)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 className="t-subtitle" style={{ marginBottom: '0.25rem' }}>Перенести в класс</h2>
                <p className="t-caption">«{moveTest.title}» · сейчас {gradeLabel(moveTest.grade)}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoveTest(null)} aria-label="Закрыть">&times;</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {GRADES.filter((g) => g !== moveTest.grade).map((g) => (
                <button
                  key={g}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleMoveTest(moveTest, g)}
                  style={{ minWidth: '5rem', flex: '1 0 auto' }}
                >
                  {gradeLabel(g)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
