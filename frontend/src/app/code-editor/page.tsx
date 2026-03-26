'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ── CodeMirror lazy loader ──────────────────────────────────── */
interface CMModules {
  EditorView: typeof import('@codemirror/view').EditorView;
  basicSetup: typeof import('codemirror').basicSetup;
  python: typeof import('@codemirror/lang-python').python;
  oneDark: typeof import('@codemirror/theme-one-dark').oneDark;
  EditorState: typeof import('@codemirror/state').EditorState;
  keymap: typeof import('@codemirror/view').keymap;
  indentWithTab: typeof import('@codemirror/commands').indentWithTab;
  Compartment: typeof import('@codemirror/state').Compartment;
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
      Compartment: state.Compartment,
    };
  })();
  return cmModulesPromise;
}

const STORAGE_KEY = 'python-editor-code';
const THEME_KEY = 'python-editor-theme';
const DEFAULT_CODE = `# Напишите код на Python\nprint("Привет, мир!")\n`;

export default function CodeEditorPage() {
  const editorRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null);
  const themeCompRef = useRef<{ reconfigure: (ext: unknown) => unknown } | null>(null);
  const codeRef = useRef<string>('');
  const workerRef = useRef<Worker | null>(null);
  const mountedRef = useRef(false);

  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [pyReady, setPyReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [stdinInput, setStdinInput] = useState('');
  const [darkTheme, setDarkTheme] = useState(true);

  // Load saved code & theme
  useEffect(() => {
    codeRef.current = localStorage.getItem(STORAGE_KEY) || DEFAULT_CODE;
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light') setDarkTheme(false);
  }, []);

  // Init Web Worker
  useEffect(() => {
    const worker = new Worker('/pyodide-worker.js');
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type: msgType, output: out, error: err } = e.data;
      if (msgType === 'ready') {
        setPyReady(true);
      } else if (msgType === 'result') {
        setOutput(out || '');
        setRunning(false);
      } else if (msgType === 'error') {
        setError(err || 'Неизвестная ошибка');
        setRunning(false);
      }
    };

    worker.onerror = () => {
      setError('Worker ошибка');
      setRunning(false);
    };

    // Start loading Pyodide in background
    worker.postMessage({ type: 'init' });

    return () => { worker.terminate(); };
  }, []);

  // Init CodeMirror — only once
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let view: any = null;

    (async () => {
      if (!editorRef.current) return;
      const cm = await loadCMModules();
      // Double-check ref wasn't cleared
      if (!editorRef.current) return;

      const themeComp = new cm.Compartment();
      themeCompRef.current = themeComp as unknown as { reconfigure: (ext: unknown) => unknown };

      const updateListener = cm.EditorView.updateListener.of((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          codeRef.current = code;
          localStorage.setItem(STORAGE_KEY, code);
        }
      });

      const savedTheme = localStorage.getItem(THEME_KEY);
      const isDark = savedTheme !== 'light';

      const lightTheme = cm.EditorView.theme({
        '&': { backgroundColor: '#ffffff' },
        '.cm-gutters': { backgroundColor: '#f8f9fa', color: '#6c757d', borderRight: '1px solid #dee2e6' },
        '.cm-activeLineGutter': { backgroundColor: '#e9ecef' },
        '.cm-activeLine': { backgroundColor: '#f1f3f5' },
      });

      const state = cm.EditorState.create({
        doc: codeRef.current,
        extensions: [
          cm.basicSetup,
          cm.python(),
          themeComp.of(isDark ? cm.oneDark : lightTheme),
          cm.keymap.of([cm.indentWithTab]),
          updateListener,
          cm.EditorView.theme({
            '&': { fontSize: '14px', height: '100%' },
            '.cm-scroller': { overflow: 'auto', height: '100%' },
            '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", minHeight: '300px' },
            '.cm-gutters': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
          }),
        ],
      });

      view = new cm.EditorView({ state, parent: editorRef.current });
      viewRef.current = view;
      setEditorReady(true);
    })();

    return () => {
      if (view) view.destroy();
      mountedRef.current = false;
    };
  }, []);

  // Toggle theme
  const toggleTheme = useCallback(async () => {
    const newDark = !darkTheme;
    setDarkTheme(newDark);
    localStorage.setItem(THEME_KEY, newDark ? 'dark' : 'light');

    if (viewRef.current && themeCompRef.current) {
      const cm = await loadCMModules();
      const lightTheme = cm.EditorView.theme({
        '&': { backgroundColor: '#ffffff' },
        '.cm-gutters': { backgroundColor: '#f8f9fa', color: '#6c757d', borderRight: '1px solid #dee2e6' },
        '.cm-activeLineGutter': { backgroundColor: '#e9ecef' },
        '.cm-activeLine': { backgroundColor: '#f1f3f5' },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comp = themeCompRef.current as any;
      viewRef.current.dispatch({
        effects: comp.reconfigure(newDark ? cm.oneDark : lightTheme),
      });
    }
  }, [darkTheme]);

  const runCode = useCallback((debug = false) => {
    if (running || !workerRef.current) return;
    setRunning(true);
    setError('');
    setOutput('');
    setExecTime(null);

    const start = performance.now();
    const worker = workerRef.current;

    // Set up a one-time handler to measure exec time
    const origHandler = worker.onmessage;
    worker.onmessage = (e) => {
      setExecTime(Math.round(performance.now() - start));
      if (origHandler) origHandler.call(worker, e);
    };

    worker.postMessage({ type: 'run', code: codeRef.current, stdin: stdinInput, debug });
  }, [running, stdinInput]);

  const stopCode = useCallback(() => {
    if (!running || !workerRef.current) return;
    // Terminate the worker and create a new one
    workerRef.current.terminate();
    setRunning(false);
    setError('Выполнение прервано');
    setPyReady(false);

    const worker = new Worker('/pyodide-worker.js');
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const { type: msgType, output: out, error: err } = e.data;
      if (msgType === 'ready') setPyReady(true);
      else if (msgType === 'result') { setOutput(out || ''); setRunning(false); }
      else if (msgType === 'error') { setError(err || 'Ошибка'); setRunning(false); }
    };
    worker.onerror = () => { setError('Worker ошибка'); setRunning(false); };
    worker.postMessage({ type: 'init' });
  }, [running]);

  const clearOutput = () => { setOutput(''); setError(''); setExecTime(null); };

  // Colors based on theme
  const bg = darkTheme ? '#1e1e2e' : '#ffffff';
  const bgToolbar = darkTheme ? '#181825' : '#f8f9fa';
  const bgOutput = darkTheme ? '#11111b' : '#f4f4f5';
  const border = darkTheme ? '#313244' : '#dee2e6';
  const textPrimary = darkTheme ? '#cdd6f4' : '#1a1f25';
  const textMuted = darkTheme ? '#6c7086' : '#8a9099';
  const textError = darkTheme ? '#f38ba8' : '#c44133';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 3.75rem)',
      background: bg,
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: bgToolbar,
        borderBottom: `1px solid ${border}`,
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{
          fontWeight: 800, fontSize: '0.875rem', color: textPrimary,
          fontFamily: 'var(--font-display), serif',
          marginRight: 'auto',
        }}>
          Python IDE
        </span>

        {/* Run */}
        <button
          type="button"
          onClick={() => runCode(false)}
          disabled={running || !editorReady}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.875rem', borderRadius: 8,
            border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            background: '#2b8a55', color: '#fff',
            fontSize: '0.8125rem', fontWeight: 700,
            opacity: running || !editorReady ? 0.5 : 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Запустить
        </button>

        {/* Debug */}
        <button
          type="button"
          onClick={() => runCode(true)}
          disabled={running || !editorReady}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.875rem', borderRadius: 8,
            border: 'none', cursor: running ? 'not-allowed' : 'pointer',
            background: 'var(--color-accent, #2b4c7e)', color: '#fff',
            fontSize: '0.8125rem', fontWeight: 700,
            opacity: running || !editorReady ? 0.5 : 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V10M18 20V4M6 20v-4"/>
          </svg>
          Отладка
        </button>

        {/* Stop */}
        <button
          type="button"
          onClick={stopCode}
          disabled={!running}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.875rem', borderRadius: 8,
            border: 'none', cursor: !running ? 'not-allowed' : 'pointer',
            background: '#c44133', color: '#fff',
            fontSize: '0.8125rem', fontWeight: 700,
            opacity: !running ? 0.3 : 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          Стоп
        </button>

        {/* Clear */}
        <button
          type="button"
          onClick={clearOutput}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.75rem', borderRadius: 8,
            border: `1px solid ${border}`, cursor: 'pointer',
            background: 'transparent', color: textMuted,
            fontSize: '0.8125rem', fontWeight: 600,
          }}
        >
          Очистить
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={darkTheme ? 'Светлая тема' : 'Тёмная тема'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${border}`, cursor: 'pointer',
            background: 'transparent', color: textMuted,
          }}
        >
          {darkTheme ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          )}
        </button>

        {/* Pyodide status */}
        <span style={{
          fontSize: '0.6875rem',
          color: pyReady ? '#2b8a55' : '#c07b22',
        }}>
          {pyReady ? '● Python' : '○ Загрузка...'}
        </span>
      </div>

      {/* Main split */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor pane */}
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '0.25rem 0.75rem',
            background: bgToolbar, borderBottom: `1px solid ${border}`,
            fontSize: '0.6875rem', color: textMuted, fontFamily: 'monospace',
          }}>
            main.py
          </div>
          <div ref={editorRef} style={{ flex: 1, overflow: 'auto' }} />
        </div>

        {/* Output pane */}
        <div style={{
          flex: '1 1 40%', display: 'flex', flexDirection: 'column',
          borderLeft: `2px solid ${border}`,
          background: bgOutput,
        }}>
          <div style={{
            padding: '0.375rem 0.75rem',
            background: bgToolbar, borderBottom: `1px solid ${border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: textPrimary }}>
              Консоль
            </span>
            {execTime !== null && (
              <span style={{ fontSize: '0.6875rem', color: textMuted }}>
                {execTime} мс
              </span>
            )}
          </div>

          <div style={{
            flex: 1, overflow: 'auto', padding: '0.75rem',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: '0.8125rem', lineHeight: 1.6,
          }}>
            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c07b22' }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(192,123,34,0.3)', borderTopColor: '#c07b22' }} />
                Выполнение...
              </div>
            )}
            {error && (
              <pre style={{ margin: 0, color: textError, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {error}
              </pre>
            )}
            {output && (
              <pre style={{ margin: 0, color: textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {output}
              </pre>
            )}
            {!running && !error && !output && (
              <span style={{ color: textMuted }}>Нажмите &quot;Запустить&quot; для выполнения кода</span>
            )}
          </div>

          {/* Stdin */}
          <div style={{
            padding: '0.5rem 0.75rem',
            borderTop: `1px solid ${border}`,
            background: bgToolbar,
          }}>
            <label style={{ display: 'block', fontSize: '0.6875rem', color: textMuted, marginBottom: '0.25rem' }}>
              Ввод (stdin):
            </label>
            <textarea
              value={stdinInput}
              onChange={(e) => setStdinInput(e.target.value)}
              placeholder="Данные для input()..."
              rows={2}
              style={{
                width: '100%', resize: 'vertical',
                background: bg, border: `1px solid ${border}`, borderRadius: 6,
                color: textPrimary, padding: '0.375rem 0.5rem',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
