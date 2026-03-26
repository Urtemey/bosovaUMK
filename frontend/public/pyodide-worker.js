// Web Worker for running Python code via Pyodide
// Runs in a separate thread so infinite loops don't freeze the UI

let pyodide = null;

async function initPyodide() {
  if (pyodide) return pyodide;
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');
  pyodide = await loadPyodide();
  return pyodide;
}

self.onmessage = async function (e) {
  const { type, code, stdin, debug } = e.data;

  if (type === 'run') {
    try {
      const py = await initPyodide();

      // Set up stdin/stdout capture
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
        const combined = (debugLog ? '--- Debug trace ---\n' + debugLog + '\n--- Output ---\n' : '') + (stdout || '(нет вывода)');
        self.postMessage({ type: 'result', output: combined.trim() });
      } else {
        py.runPython(code);
        const stdout = py.runPython('_stdout_capture.getvalue()');
        self.postMessage({ type: 'result', output: (stdout || '').trim() || '(нет вывода)' });
      }

      // Restore
      py.runPython('import sys; sys.stdin = sys.__stdin__; sys.stdout = sys.__stdout__');
    } catch (err) {
      try {
        if (pyodide) {
          pyodide.runPython('import sys; sys.stdin = sys.__stdin__; sys.stdout = sys.__stdout__; sys.settrace(None)');
        }
      } catch (_) { /* ignore */ }
      // Extract last meaningful lines from the traceback
      const errStr = String(err);
      const lines = errStr.split('\n');
      const shortErr = lines.slice(-4).join('\n');
      self.postMessage({ type: 'error', error: shortErr });
    }
  } else if (type === 'init') {
    try {
      await initPyodide();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: 'Не удалось загрузить Pyodide: ' + String(err) });
    }
  }
};
