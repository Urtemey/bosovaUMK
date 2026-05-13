// Web Worker for running Python code via Pyodide.

let pyodide = null;

async function initPyodide() {
  if (pyodide) return pyodide;
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');
  pyodide = await loadPyodide();
  return pyodide;
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
    return ((debugLog ? '--- Debug trace ---\n' + debugLog + '\n--- Output ---\n' : '') + (stdout || '(no output)')).trim();
  }

  py.runPython(code);
  const stdout = py.runPython('_stdout_capture.getvalue()');
  return (stdout || '').trim() || '(no output)';
}

self.onmessage = async function (e) {
  const { type, language = 'python', code, stdin, debug } = e.data;

  if (type === 'init') {
    try {
      await initPyodide();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: 'Failed to load runtime: ' + String(err) });
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
