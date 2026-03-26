'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import HtmlContent from '@/components/ui/HtmlContent';

/* ── Pyodide loader (singleton) ─────────────────────────────── */
let pyodidePromise: Promise<unknown> | null = null;

function loadPyodide(): Promise<unknown> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js';
    script.onload = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pyodide = await (window as any).loadPyodide();
        resolve(pyodide);
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return pyodidePromise;
}

/* ── CodeMirror lazy loader ──────────────────────────────────── */
interface CMModules {
  EditorView: typeof import('@codemirror/view').EditorView;
  basicSetup: typeof import('codemirror').basicSetup;
  python: typeof import('@codemirror/lang-python').python;
  oneDark: typeof import('@codemirror/theme-one-dark').oneDark;
  EditorState: typeof import('@codemirror/state').EditorState;
  keymap: typeof import('@codemirror/view').keymap;
  indentWithTab: typeof import('@codemirror/commands').indentWithTab;
}

let cmModulesPromise: Promise<CMModules> | null = null;

function loadCMModules(): Promise<CMModules> {
  if (cmModulesPromise) return cmModulesPromise;
  cmModulesPromise = (async () => {
    const [cm, langPy, theme, state, view, commands] = await Promise.all([
      import('codemirror'),
      import('@codemirror/lang-python'),
      import('@codemirror/theme-one-dark'),
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/commands'),
    ]);
    return {
      EditorView: view.EditorView,
      basicSetup: cm.basicSetup,
      python: langPy.python,
      oneDark: theme.oneDark,
      EditorState: state.EditorState,
      keymap: view.keymap,
      indentWithTab: commands.indentWithTab,
    };
  })();
  return cmModulesPromise;
}

/* ── Types ────────────────────────────────────────────────────── */
interface TestCase {
  input: string;
  expected_output: string;
}

interface Props {
  content: {
    text: string;
    language?: string; // 'python' | 'pascal'
    test_cases?: TestCase[];
    starter_code?: string;
  };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

interface RunResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

/* ── Component ───────────────────────────────────────────────── */
export default function CodeEditor({ content, value, onChange, disabled }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<unknown>(null);
  const codeRef = useRef<string>((value as { code?: string })?.code || content.starter_code || '');

  const [language] = useState(content.language || 'python');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [error, setError] = useState('');
  const [pyodideReady, setPyodideReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  // Initialize CodeMirror
  useEffect(() => {
    let view: { destroy: () => void } | null = null;
    let cancelled = false;

    (async () => {
      if (!editorRef.current) return;
      const cm = await loadCMModules();
      if (cancelled || !editorRef.current) return;

      const updateListener = cm.EditorView.updateListener.of((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          codeRef.current = code;
        }
      });

      const state = cm.EditorState.create({
        doc: codeRef.current,
        extensions: [
          cm.basicSetup,
          cm.python(),
          cm.oneDark,
          cm.keymap.of([cm.indentWithTab]),
          updateListener,
          cm.EditorView.theme({
            '&': { fontSize: '14px', maxHeight: '400px' },
            '.cm-scroller': { overflow: 'auto', maxHeight: '400px' },
            '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
            '.cm-gutters': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
          }),
          cm.EditorView.editable.of(!disabled),
        ],
      });

      view = new cm.EditorView({
        state,
        parent: editorRef.current,
      });
      viewRef.current = view;
      setEditorReady(true);
    })();

    return () => {
      cancelled = true;
      if (view) view.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  // Preload Pyodide
  useEffect(() => {
    if (language === 'python') {
      loadPyodide().then(() => setPyodideReady(true)).catch(() => {});
    }
  }, [language]);

  const runCode = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError('');
    setResults([]);

    const code = codeRef.current;
    const testCases = content.test_cases || [];

    try {
      if (language === 'python') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pyodide = await loadPyodide() as any;
        const newResults: RunResult[] = [];
        const outputs: string[] = [];

        for (const tc of testCases) {
          try {
            // Redirect stdin/stdout
            pyodide.runPython(`
import sys, io
_stdin_data = ${JSON.stringify(tc.input)}
sys.stdin = io.StringIO(_stdin_data)
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);
            pyodide.runPython(code);
            const actual = pyodide.runPython(`
_stdout_capture.getvalue()
`) as string;

            // Restore
            pyodide.runPython(`
sys.stdin = sys.__stdin__
sys.stdout = sys.__stdout__
`);

            const trimmedActual = (actual || '').trim();
            const trimmedExpected = tc.expected_output.trim();
            const passed = trimmedActual === trimmedExpected;

            newResults.push({
              input: tc.input,
              expected: tc.expected_output,
              actual: trimmedActual,
              passed,
            });
            outputs.push(trimmedActual);
          } catch (e) {
            // Restore on error
            try {
              pyodide.runPython(`
import sys
sys.stdin = sys.__stdin__
sys.stdout = sys.__stdout__
`);
            } catch { /* ignore */ }

            const errMsg = String(e).split('\n').slice(-2).join('\n');
            newResults.push({
              input: tc.input,
              expected: tc.expected_output,
              actual: `Ошибка: ${errMsg}`,
              passed: false,
            });
            outputs.push('');
          }
        }

        setResults(newResults);
        onChange({ code, outputs });
      } else {
        setError(`Язык "${language}" пока не поддерживается для выполнения в браузере. Используйте Python.`);
      }
    } catch (e) {
      setError(`Ошибка выполнения: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [running, content.test_cases, language, onChange]);

  // Run without test cases (free run)
  const runFree = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError('');
    setResults([]);

    const code = codeRef.current;

    try {
      if (language === 'python') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pyodide = await loadPyodide() as any;
        pyodide.runPython(`
import sys, io
sys.stdin = io.StringIO("")
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);
        pyodide.runPython(code);
        const output = pyodide.runPython(`_stdout_capture.getvalue()`) as string;
        pyodide.runPython(`
sys.stdin = sys.__stdin__
sys.stdout = sys.__stdout__
`);
        setResults([{
          input: '',
          expected: '',
          actual: (output || '').trim(),
          passed: true,
        }]);
        onChange({ code, outputs: [(output || '').trim()] });
      }
    } catch (e) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pyodide = await loadPyodide() as any;
        pyodide.runPython(`import sys; sys.stdin = sys.__stdin__; sys.stdout = sys.__stdout__`);
      } catch { /* ignore */ }
      setError(String(e).split('\n').slice(-3).join('\n'));
    } finally {
      setRunning(false);
    }
  }, [running, language, onChange]);

  const hasTestCases = content.test_cases && content.test_cases.length > 0;
  const allPassed = results.length > 0 && results.every(r => r.passed);

  return (
    <div>
      <div style={{ fontWeight: 500, marginBottom: '1rem', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
        <HtmlContent html={content.text} />
      </div>

      {/* Language badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.2rem 0.5rem', borderRadius: 6,
          background: language === 'python' ? '#306998' : '#2b4c7e',
          color: '#fff', fontSize: '0.6875rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
          {language}
        </span>
        {language === 'python' && (
          <span style={{
            fontSize: '0.6875rem', color: pyodideReady ? 'var(--color-ok)' : 'var(--color-text-muted)',
          }}>
            {pyodideReady ? 'Pyodide готов' : 'Загрузка Pyodide...'}
          </span>
        )}
      </div>

      {/* Code editor */}
      <div style={{
        border: '1px solid var(--color-border-strong)',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#282c34',
      }}>
        {/* Editor header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.375rem 0.75rem',
          background: '#21252b', borderBottom: '1px solid #3e4451',
        }}>
          <span style={{ fontSize: '0.6875rem', color: '#abb2bf', fontFamily: 'monospace' }}>
            solution.{language === 'python' ? 'py' : 'pas'}
          </span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {!hasTestCases && (
              <button
                type="button"
                onClick={runFree}
                disabled={running || !editorReady || disabled}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.5rem', borderRadius: 5,
                  border: 'none', cursor: running || disabled ? 'not-allowed' : 'pointer',
                  background: '#3b4048', color: '#abb2bf',
                  fontSize: '0.6875rem', fontWeight: 600,
                  opacity: running || disabled ? 0.5 : 1,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Запустить
              </button>
            )}
            {hasTestCases && (
              <button
                type="button"
                onClick={runCode}
                disabled={running || !editorReady || disabled}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.625rem', borderRadius: 5,
                  border: 'none', cursor: running || disabled ? 'not-allowed' : 'pointer',
                  background: '#2b8a55', color: '#fff',
                  fontSize: '0.6875rem', fontWeight: 600,
                  opacity: running || disabled ? 0.5 : 1,
                }}
              >
                {running ? (
                  <>
                    <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                    Выполнение...
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    Проверить
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* CodeMirror mount point */}
        <div ref={editorRef} style={{ minHeight: 200 }} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '0.75rem', padding: '0.625rem 0.75rem',
          borderRadius: 8, background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger)',
          fontFamily: 'monospace', fontSize: '0.8125rem',
          color: 'var(--color-danger)', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {error}
        </div>
      )}

      {/* Test results */}
      {results.length > 0 && hasTestCases && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem',
          }}>
            <span style={{
              fontWeight: 700, fontSize: '0.8125rem',
              color: allPassed ? 'var(--color-ok)' : 'var(--color-danger)',
            }}>
              {allPassed
                ? `Все тесты пройдены (${results.length}/${results.length})`
                : `Пройдено ${results.filter(r => r.passed).length} из ${results.length}`
              }
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 0.625rem',
                  borderRadius: 8,
                  background: r.passed ? 'var(--color-ok-bg)' : 'var(--color-danger-bg)',
                  border: `1px solid ${r.passed ? '#a7e8c0' : '#f5b7b1'}`,
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: r.passed ? 'var(--color-ok)' : 'var(--color-danger)' }}>
                    {r.passed ? '✓' : '✗'} Тест {i + 1}
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {r.input && <div><strong>Ввод:</strong> {r.input}</div>}
                  <div><strong>Ожидалось:</strong> {r.expected}</div>
                  <div><strong>Получено:</strong> {r.actual}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Free run output */}
      {results.length > 0 && !hasTestCases && (
        <div style={{
          marginTop: '0.75rem', padding: '0.625rem 0.75rem',
          borderRadius: 8, background: '#1e1e1e', border: '1px solid #3e4451',
        }}>
          <div style={{ fontSize: '0.6875rem', color: '#abb2bf', marginBottom: '0.25rem', fontWeight: 600 }}>
            Вывод:
          </div>
          <pre style={{
            margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '0.8125rem', color: '#e5e5e5', whiteSpace: 'pre-wrap',
          }}>
            {results[0]?.actual || '(пусто)'}
          </pre>
        </div>
      )}
    </div>
  );
}
