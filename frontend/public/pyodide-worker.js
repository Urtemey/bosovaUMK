// Web Worker for running code in browser-side runtimes.
// Python uses Pyodide. C and C++ use JSCPP, a lightweight educational interpreter.

let pyodide = null;
let jscppLoaded = false;

async function initPyodide() {
  if (pyodide) return pyodide;
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');
  pyodide = await loadPyodide();
  return pyodide;
}

function initJSCPP() {
  if (jscppLoaded) return;
  importScripts('/vendor-jscpp.js');
  jscppLoaded = true;
}

function runJSCPP(code, stdin) {
  initJSCPP();
  let output = '';
  const oldLog = console.log;
  const oldInfo = console.info;
  const oldWarn = console.warn;
  const capture = (...args) => {
    output += args.join(' ') + '\n';
  };
  console.log = capture;
  console.info = capture;
  console.warn = capture;
  try {
    const exitCode = JSCPP.run(code, stdin || '');
    const suffix = exitCode && exitCode !== 0 ? `\n(program exited with code ${exitCode})` : '';
    return (output.trim() || '(??? ??????)') + suffix;
  } finally {
    console.log = oldLog;
    console.info = oldInfo;
    console.warn = oldWarn;
  }
}

async function runPython(code, stdin, debug) {
  const py = await initPyodide();

  py.runPython(`
import sys, io
sys.stdin = io.StringIO(${JSON.stringify(stdin || '')})
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);

  if (debug) {
    py.runPython(`
import sys, io
_debug_log = io.StringIO()
def _tracer(frame, event, arg):
    if event == 'line' and frame.f_code.co_filename == '<exec>':
        lineno = frame.f_lineno
        local_vars = {k: repr(v) for k, v in frame.f_locals.items() if not k.startswith('_')}
        if local_vars:
            _debug_log.write(f"[line {lineno}] {local_vars}\\n")
    return _tracer
sys.settrace(_tracer)
`);
    py.runPython(code);
    py.runPython('sys.settrace(None)');
    const stdout = py.runPython('_stdout_capture.getvalue()');
    const debugLog = py.runPython('_debug_log.getvalue()');
    return ((debugLog ? '--- Debug trace ---\n' + debugLog + '\n--- Output ---\n' : '') + (stdout || '(??? ??????)')).trim();
  }

  py.runPython(code);
  const stdout = py.runPython('_stdout_capture.getvalue()');
  return (stdout || '').trim() || '(??? ??????)';
}

self.onmessage = async function (e) {
  const { type, language = 'python', code, stdin, debug } = e.data;

  if (type === 'init') {
    try {
      if (language === 'python') await initPyodide();
      if (language === 'c' || language === 'cpp') initJSCPP();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: '?? ??????? ????????? runtime: ' + String(err) });
    }
    return;
  }

  if (type !== 'run') return;

  try {
    if (language === 'python') {
      const output = await runPython(code, stdin, debug);
      self.postMessage({ type: 'result', output });
      try {
        pyodide.runPython('import sys; sys.stdin = sys.__stdin__; sys.stdout = sys.__stdout__; sys.settrace(None)');
      } catch (_) { /* ignore */ }
      return;
    }

    if (language === 'c' || language === 'cpp') {
      const output = runJSCPP(code, stdin);
      self.postMessage({ type: 'result', output });
      return;
    }
  } catch (err) {
    try {
      if (pyodide) {
        pyodide.runPython('import sys; sys.stdin = sys.__stdin__; sys.stdout = sys.__stdout__; sys.settrace(None)');
      }
    } catch (_) { /* ignore */ }
    const errStr = String(err);
    const lines = errStr.split('\n');
    const shortErr = lines.slice(-6).join('\n');
    self.postMessage({ type: 'error', error: shortErr });
  }
};
