'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

interface Student {
  id: number;
  display_name: string;
}

interface TestInfo {
  id: number;
  title: string;
}

interface CellResult {
  score_percent: number;
  duration_seconds: number;
}

interface JournalRow {
  student: Student;
  results: Record<number, CellResult | null>;
  average: number | null;
}

interface Props {
  data: { tests: TestInfo[]; journal: JournalRow[] };
  classroomId: number;
}

type View = 'table' | 'by-test' | 'by-student';
type SortKey = 'name' | 'average';
type SortDir = 'asc' | 'desc';

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--color-ok)';
  if (score >= 40) return 'var(--color-warn)';
  return 'var(--color-danger)';
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'score-badge score-high';
  if (score >= 40) return 'score-badge score-med';
  return 'score-badge score-low';
}

function shortTitle(title: string): string {
  return title.replace(/^Тест\s+\d+\.\s*/i, '');
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} мин ${s} с` : `${s} с`;
}

/* ── Per-test aggregate ─────────────────────────────────────── */
function testStats(test: TestInfo, journal: JournalRow[]) {
  const scores: number[] = [];
  for (const row of journal) {
    const r = row.results[test.id];
    if (r) scores.push(r.score_percent);
  }
  const done = scores.length;
  const avg = done > 0 ? scores.reduce((a, b) => a + b, 0) / done : null;
  const high = scores.filter(s => s >= 70).length;
  const med = scores.filter(s => s >= 40 && s < 70).length;
  const low = scores.filter(s => s < 40).length;
  return { done, total: journal.length, avg, high, med, low };
}

export default function JournalView({ data, classroomId }: Props) {
  const { tests, journal } = data;
  const [view, setView] = useState<View>('table');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* ── Class-wide summary ───────────────────────────────────── */
  const summary = useMemo(() => {
    const avgs = journal.map(r => r.average).filter((a): a is number => a !== null);
    const classAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    const participated = journal.filter(r =>
      tests.some(t => r.results[t.id] !== null && r.results[t.id] !== undefined)
    ).length;

    let bestTest: { title: string; avg: number } | null = null;
    let worstTest: { title: string; avg: number } | null = null;
    for (const t of tests) {
      const st = testStats(t, journal);
      if (st.avg === null) continue;
      if (!bestTest || st.avg > bestTest.avg) bestTest = { title: shortTitle(t.title), avg: st.avg };
      if (!worstTest || st.avg < worstTest.avg) worstTest = { title: shortTitle(t.title), avg: st.avg };
    }
    return { classAvg, participated, total: journal.length, bestTest, worstTest };
  }, [journal, tests]);

  /* ── Sorted rows (table view) ─────────────────────────────── */
  const sortedRows = useMemo(() => {
    const rows = [...journal];
    rows.sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.student.display_name.localeCompare(b.student.display_name, 'ru');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      // average — nulls always last regardless of direction
      const av = a.average;
      const bv = b.average;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [journal, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'average' ? 'desc' : 'asc');
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  /* ── Summary header ───────────────────────────────────────── */
  const SummaryCards = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.25rem',
      }}
    >
      <div className="card" style={{ padding: '0.875rem 1rem' }}>
        <div className="t-caption" style={{ marginBottom: '0.25rem' }}>Средний балл класса</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: summary.classAvg !== null ? scoreColor(summary.classAvg) : 'var(--color-text-muted)' }}>
          {summary.classAvg !== null ? `${Math.round(summary.classAvg)}%` : '—'}
        </div>
      </div>
      <div className="card" style={{ padding: '0.875rem 1rem' }}>
        <div className="t-caption" style={{ marginBottom: '0.25rem' }}>Участвовали</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {summary.participated}<span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}> / {summary.total}</span>
        </div>
      </div>
      <div className="card" style={{ padding: '0.875rem 1rem' }}>
        <div className="t-caption" style={{ marginBottom: '0.25rem' }}>Лучший тест</div>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary.bestTest?.title}>
          {summary.bestTest ? `${summary.bestTest.title} · ${Math.round(summary.bestTest.avg)}%` : '—'}
        </div>
      </div>
      <div className="card" style={{ padding: '0.875rem 1rem' }}>
        <div className="t-caption" style={{ marginBottom: '0.25rem' }}>Слабый тест</div>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary.worstTest?.title}>
          {summary.worstTest ? `${summary.worstTest.title} · ${Math.round(summary.worstTest.avg)}%` : '—'}
        </div>
      </div>
    </div>
  );

  /* ── Segmented switcher ───────────────────────────────────── */
  const VIEWS: { key: View; label: string }[] = [
    { key: 'table', label: 'Таблица' },
    { key: 'by-test', label: 'По тесту' },
    { key: 'by-student', label: 'По ученику' },
  ];
  const Switcher = (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        background: 'var(--color-surface-3)',
        borderRadius: 10,
        marginBottom: '1rem',
        gap: 2,
      }}
    >
      {VIEWS.map(v => (
        <button
          key={v.key}
          type="button"
          onClick={() => setView(v.key)}
          style={{
            padding: '0.4rem 0.875rem',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 700,
            background: view === v.key ? 'var(--color-surface)' : 'transparent',
            color: view === v.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            boxShadow: view === v.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'background 0.12s, color 0.12s',
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  /* ── Table view ───────────────────────────────────────────── */
  const TableView = (
    <div className="card-lg" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="journal-table" style={{ minWidth: '36rem' }}>
          <thead>
            <tr>
              <th
                onClick={() => toggleSort('name')}
                style={{
                  textAlign: 'left', minWidth: '12rem', position: 'sticky', left: 0,
                  background: 'var(--color-surface-2)', zIndex: 2, cursor: 'pointer', userSelect: 'none',
                }}
                title="Сортировать по имени"
              >
                Ученик{sortArrow('name')}
              </th>
              {tests.map(test => (
                <th key={test.id} title={test.title} style={{ textAlign: 'center', minWidth: '6rem', maxWidth: '8rem' }}>
                  <Link
                    href={`/classroom/${classroomId}/stats/${test.id}`}
                    style={{ color: 'inherit', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '7rem', margin: '0 auto' }}
                  >
                    {shortTitle(test.title)}
                  </Link>
                </th>
              ))}
              <th
                onClick={() => toggleSort('average')}
                style={{ textAlign: 'center', minWidth: '5.5rem', fontWeight: 700, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                title="Сортировать по среднему"
              >
                Средняя{sortArrow('average')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row.student.id}>
                <td
                  style={{
                    position: 'sticky', left: 0,
                    background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)',
                    zIndex: 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: '1.25rem', textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{row.student.display_name}</span>
                  </div>
                </td>
                {tests.map(test => {
                  const result = row.results[test.id];
                  return (
                    <td
                      key={test.id}
                      style={{ textAlign: 'center', background: result ? undefined : 'var(--color-surface-2)' }}
                      title={result ? `${Math.round(result.score_percent)}% · ${fmtDuration(result.duration_seconds)}` : 'Не выполнен'}
                    >
                      {result ? (
                        <Link href={`/classroom/${classroomId}/stats/${test.id}`} style={{ textDecoration: 'none' }}>
                          <span className={scoreBadgeClass(result.score_percent)}>{Math.round(result.score_percent)}%</span>
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--color-border-strong)', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center' }}>
                  {row.average !== null ? (
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: scoreColor(row.average) }}>
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
    </div>
  );

  /* ── By-test view ─────────────────────────────────────────── */
  const ByTestView = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {tests.map(test => {
        const st = testStats(test, journal);
        return (
          <div key={test.id} className="card-lg" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.625rem' }}>
              <Link
                href={`/classroom/${classroomId}/stats/${test.id}`}
                style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-accent)', textDecoration: 'none' }}
              >
                {shortTitle(test.title)}
              </Link>
              <span style={{ fontSize: '1.125rem', fontWeight: 800, color: st.avg !== null ? scoreColor(st.avg) : 'var(--color-text-muted)', flexShrink: 0 }}>
                {st.avg !== null ? `${Math.round(st.avg)}%` : '—'}
              </span>
            </div>
            {/* Distribution bar */}
            {st.done > 0 ? (
              <>
                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-surface-3)' }}>
                  {st.high > 0 && <div style={{ width: `${(st.high / st.done) * 100}%`, background: 'var(--color-ok)' }} />}
                  {st.med > 0 && <div style={{ width: `${(st.med / st.done) * 100}%`, background: 'var(--color-warn)' }} />}
                  {st.low > 0 && <div style={{ width: `${(st.low / st.done) * 100}%`, background: 'var(--color-danger)' }} />}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <span className="t-caption">Выполнили: {st.done} / {st.total}</span>
                  <span className="t-caption" style={{ color: 'var(--color-ok)' }}>≥70%: {st.high}</span>
                  <span className="t-caption" style={{ color: 'var(--color-warn)' }}>40–70%: {st.med}</span>
                  <span className="t-caption" style={{ color: 'var(--color-danger)' }}>&lt;40%: {st.low}</span>
                </div>
              </>
            ) : (
              <p className="t-caption">Тест ещё никто не проходил</p>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── By-student view ──────────────────────────────────────── */
  const ByStudentView = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {[...journal]
        .sort((a, b) => {
          if (a.average === null && b.average === null) return a.student.display_name.localeCompare(b.student.display_name, 'ru');
          if (a.average === null) return 1;
          if (b.average === null) return -1;
          return b.average - a.average;
        })
        .map(row => {
          const doneCount = tests.filter(t => row.results[t.id]).length;
          return (
            <div key={row.student.id} className="card-lg" style={{ padding: '0.875rem 1.125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{row.student.display_name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <span className="t-caption">{doneCount} / {tests.length}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: row.average !== null ? scoreColor(row.average) : 'var(--color-text-muted)' }}>
                    {row.average !== null ? `${Math.round(row.average)}%` : '—'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {tests.map(test => {
                  const r = row.results[test.id];
                  return (
                    <Link
                      key={test.id}
                      href={`/classroom/${classroomId}/stats/${test.id}`}
                      title={`${shortTitle(test.title)}${r ? `: ${Math.round(r.score_percent)}% · ${fmtDuration(r.duration_seconds)}` : ': не выполнен'}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 38, padding: '0.2rem 0.45rem', borderRadius: 6,
                        fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none',
                        background: r ? 'var(--color-surface-2)' : 'transparent',
                        border: `1px solid ${r ? 'var(--color-border)' : 'var(--color-border)'}`,
                        color: r ? scoreColor(r.score_percent) : 'var(--color-border-strong)',
                      }}
                    >
                      {r ? `${Math.round(r.score_percent)}%` : '—'}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );

  return (
    <div>
      {SummaryCards}
      {Switcher}
      {view === 'table' && TableView}
      {view === 'by-test' && ByTestView}
      {view === 'by-student' && ByStudentView}
    </div>
  );
}
