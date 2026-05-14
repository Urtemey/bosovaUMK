'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ── CodeMirror lazy loader ──────────────────────────────────── */
interface CMModules {
  EditorView: typeof import('@codemirror/view').EditorView;
  basicSetup: typeof import('codemirror').basicSetup;
  python: typeof import('@codemirror/lang-python').python;
  cpp: typeof import('@codemirror/lang-cpp').cpp;
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
    const [cm, langPy, langCpp, theme, state, view, commands] = await Promise.all([
      import('codemirror'),
      import('@codemirror/lang-python'),
      import('@codemirror/lang-cpp'),
      import('@codemirror/theme-one-dark'),
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/commands'),
    ]);
    return {
      EditorView: view.EditorView,
      basicSetup: cm.basicSetup,
      python: langPy.python,
      cpp: langCpp.cpp,
      oneDark: theme.oneDark,
      EditorState: state.EditorState,
      keymap: view.keymap,
      indentWithTab: commands.indentWithTab,
      Compartment: state.Compartment,
    };
  })();
  return cmModulesPromise;
}


type PanelLanguage = 'python' | 'cpp' | 'c';

const LANGUAGE_STORAGE_KEY = 'attempt-ide-language';
const CODE_STORAGE_PREFIX = 'attempt-ide-code-v2';
const LANGUAGE_OPTIONS: Record<PanelLanguage, { label: string; fileName: string; defaultCode: string }> = {
  python: { label: 'Python', fileName: 'main.py', defaultCode: `# Python
print("Hello")
` },
  cpp: { label: 'C++', fileName: 'main.cpp', defaultCode: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello" << endl;
    return 0;
}
` },
  c: { label: 'C', fileName: 'main.c', defaultCode: `#include <stdio.h>

int main() {
    printf("Hello\\n");
    return 0;
}
` },
};

function isPanelLanguage(value: string | null): value is PanelLanguage {
  return value === 'python' || value === 'cpp' || value === 'c';
}

function codeStorageKey(language: PanelLanguage) {
  return `${CODE_STORAGE_PREFIX}-${language}`;
}

function getLanguageExtension(cm: CMModules, language: PanelLanguage) {
  return language === 'python' ? cm.python() : cm.cpp();
}

function workerPath(language: PanelLanguage) {
  return language === 'python' ? '/pyodide-worker.js' : '/cpp-worker-adapter.js';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PythonPanel({ open, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null);
  const languageCompRef = useRef<{ reconfigure: (ext: unknown) => unknown } | null>(null);
  const [language, setLanguage] = useState<PanelLanguage>(() => {
    if (typeof window === 'undefined') return 'python';
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isPanelLanguage(savedLanguage) ? savedLanguage : 'python';
  });
  const languageRef = useRef<PanelLanguage>(language);
  const codeRef = useRef<string>(
    typeof window !== 'undefined'
      ? localStorage.getItem(codeStorageKey(language)) || LANGUAGE_OPTIONS[language].defaultCode
      : ''
  );
  const workerRef = useRef<Worker | null>(null);
  const mountedRef = useRef(false);

  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [stdinInput, setStdinInput] = useState('');

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Init Web Worker when panel opens
  useEffect(() => {
    if (!open) return;
    if (workerRef.current) return;

    const worker = new Worker(workerPath(language));
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, output: out, error: err } = e.data;
      if (type === 'ready') setRuntimeReady(true);
      else if (type === 'result') { setOutput(out || ''); setRunning(false); }
      else if (type === 'error') { setError(err || 'Ошибка'); setRunning(false); }
    };
    worker.onerror = () => { setError('Worker ошибка'); setRunning(false); };
    worker.postMessage({ type: 'init', language });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [open, language]);

  // Init CodeMirror when panel opens
  useEffect(() => {
    if (!open || mountedRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let view: any = null;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!editorRef.current || cancelled) return;
      const cm = await loadCMModules();
      if (cancelled || !editorRef.current) return;

      const languageComp = new cm.Compartment();
      languageCompRef.current = languageComp as unknown as { reconfigure: (ext: unknown) => unknown };

      const updateListener = cm.EditorView.updateListener.of((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          codeRef.current = code;
          localStorage.setItem(codeStorageKey(languageRef.current), code);
        }
      });

      const state = cm.EditorState.create({
        doc: codeRef.current,
        extensions: [
          cm.basicSetup,
          languageComp.of(getLanguageExtension(cm, language)),
          cm.oneDark,
          cm.keymap.of([cm.indentWithTab]),
          updateListener,
          cm.EditorView.theme({
            '&': { fontSize: '13px', height: '100%' },
            '.cm-scroller': { overflow: 'auto', height: '100%' },
            '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
            '.cm-gutters': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" },
          }),
        ],
      });

      view = new cm.EditorView({ state, parent: editorRef.current });
      viewRef.current = view;
      setEditorReady(true);
      mountedRef.current = true;
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (view) {
        view.destroy();
        viewRef.current = null;
        mountedRef.current = false;
      }
    };
  }, [open, language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; mountedRef.current = false; }
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    };
  }, []);

  const runCode = useCallback((debug = false) => {
    if (running || !workerRef.current) return;
    setRunning(true);
    setError('');
    setOutput('');
    workerRef.current.postMessage({ type: 'run', language, code: codeRef.current, stdin: stdinInput, debug });
  }, [running, stdinInput, language]);

  const stopCode = useCallback(() => {
    if (!running || !workerRef.current) return;
    workerRef.current.terminate();
    workerRef.current = null;
    setRunning(false);
    setError('Выполнение прервано');
    setRuntimeReady(false);

    const worker = new Worker(workerPath(language));
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const { type, output: out, error: err } = e.data;
      if (type === 'ready') setRuntimeReady(true);
      else if (type === 'result') { setOutput(out || ''); setRunning(false); }
      else if (type === 'error') { setError(err || 'Ошибка'); setRunning(false); }
    };
    worker.onerror = () => { setError('Worker ошибка'); setRunning(false); };
    worker.postMessage({ type: 'init', language });
  }, [running, language]);


  const changeLanguage = useCallback(async (nextLanguage: PanelLanguage) => {
    if (nextLanguage === language) return;
    const currentCode = viewRef.current?.state?.doc?.toString?.() || codeRef.current;
    localStorage.setItem(codeStorageKey(language), currentCode);

    const nextCode = localStorage.getItem(codeStorageKey(nextLanguage)) || LANGUAGE_OPTIONS[nextLanguage].defaultCode;
    codeRef.current = nextCode;
    setLanguage(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setOutput('');
    setError('');
    setRuntimeReady(false);

    if (viewRef.current && languageCompRef.current) {
      const cm = await loadCMModules();
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: nextCode },
        effects: languageCompRef.current.reconfigure(getLanguageExtension(cm, nextLanguage)),
      });
    }
  }, [language]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 90vw)', zIndex: 999,
        display: 'flex', flexDirection: 'column',
        background: '#1e1e2e',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
        animation: 'slideInRight 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.5rem 0.75rem',
          background: '#181825', borderBottom: '1px solid #313244', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#cdd6f4' }}>
            IDE
          </span>
          <select
            value={language}
            onChange={(e) => changeLanguage(e.target.value as PanelLanguage)}
            disabled={running}
            style={{
              marginRight: 'auto', padding: '0.25rem 0.5rem', borderRadius: 6,
              border: '1px solid #313244', background: '#1e1e2e', color: '#cdd6f4',
              fontSize: '0.75rem', fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {(Object.keys(LANGUAGE_OPTIONS) as PanelLanguage[]).map((key) => (
              <option key={key} value={key}>{LANGUAGE_OPTIONS[key].label}</option>
            ))}
          </select>

          {/* Run */}
          <button type="button" onClick={() => runCode(false)} disabled={running || !editorReady}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3rem 0.625rem', borderRadius: 6,
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
              background: '#2b8a55', color: '#fff',
              fontSize: '0.75rem', fontWeight: 700,
              opacity: running || !editorReady ? 0.5 : 1,
            }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Запуск
          </button>

          {/* Debug */}
          <button type="button" onClick={() => runCode(true)} disabled={running || !editorReady}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3rem 0.625rem', borderRadius: 6,
              border: 'none', cursor: running ? 'not-allowed' : 'pointer',
              background: '#2b4c7e', color: '#fff',
              fontSize: '0.75rem', fontWeight: 700,
              opacity: running || !editorReady ? 0.5 : 1,
            }}>
            Отладка
          </button>

          {/* Stop */}
          <button type="button" onClick={stopCode} disabled={!running}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3rem 0.625rem', borderRadius: 6,
              border: 'none', cursor: !running ? 'not-allowed' : 'pointer',
              background: '#c44133', color: '#fff',
              fontSize: '0.75rem', fontWeight: 700,
              opacity: !running ? 0.3 : 1,
            }}>
            Стоп
          </button>

          {/* Close */}
          <button type="button" onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              border: 'none', cursor: 'pointer', background: '#313244', color: '#a6adc8',
              marginLeft: '0.25rem',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Runtime status */}
        {!runtimeReady && (
          <div style={{ padding: '0.25rem 0.75rem', background: '#181825', borderBottom: '1px solid #313244', fontSize: '0.6875rem', color: '#c07b22' }}>
            loading runtime...
          </div>
        )}
        <div style={{ padding: '0.25rem 0.75rem', background: '#181825', borderBottom: '1px solid #313244', fontSize: '0.6875rem', color: '#a6adc8', fontFamily: 'monospace' }}>
          {LANGUAGE_OPTIONS[language].fileName}
        </div>

        {/* Editor */}
        <div ref={editorRef} style={{ flex: '1 1 50%', overflow: 'auto', minHeight: 150 }} />

        {/* Output */}
        <div style={{
          flex: '1 1 30%', display: 'flex', flexDirection: 'column',
          borderTop: '2px solid #313244', background: '#11111b', minHeight: 100,
        }}>
          <div style={{ padding: '0.25rem 0.75rem', background: '#181825', borderBottom: '1px solid #313244', fontSize: '0.6875rem', fontWeight: 700, color: '#cdd6f4' }}>
            Вывод
          </div>
          <div style={{
            flex: 1, overflow: 'auto', padding: '0.5rem 0.75rem',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', lineHeight: 1.5,
          }}>
            {running && <span style={{ color: '#c07b22' }}>Выполнение...</span>}
            {error && <pre style={{ margin: 0, color: '#f38ba8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</pre>}
            {output && <pre style={{ margin: 0, color: '#cdd6f4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{output}</pre>}
          </div>
        </div>

        {/* Stdin */}
        <div style={{ padding: '0.375rem 0.75rem', borderTop: '1px solid #313244', background: '#181825', flexShrink: 0 }}>
          <input
            value={stdinInput}
            onChange={(e) => setStdinInput(e.target.value)}
            placeholder="stdin (ввод для input())..."
            style={{
              width: '100%', background: '#1e1e2e', border: '1px solid #313244',
              borderRadius: 6, color: '#cdd6f4', padding: '0.3rem 0.5rem',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', outline: 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
