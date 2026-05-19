/* eslint-disable */
// Adapter around JSCPP worker bundle. JSCPP installs its own onmessage handler,
// so we load it once, save that handler, and call it with a temporary postMessage.

importScripts('/vendor-jscpp.js');

const jscppOnMessage = self.onmessage;

function runJSCPP(code, stdin) {
  let output = '';
  let finalError = '';
  let finished = false;
  const originalPostMessage = self.postMessage.bind(self);

  self.postMessage = (message) => {
    if (message && message.type === 'stdio.write') {
      output += String(message.data ?? '');
      return;
    }
    if (message && message.id === 1) {
      finished = true;
      if (message.err) {
        finalError = message.msg || 'JSCPP error';
      }
    }
  };

  try {
    jscppOnMessage({ data: [1, 'run', code, stdin || '', {}] });
  } finally {
    self.postMessage = originalPostMessage;
  }

  if (finalError) throw new Error(finalError);
  if (!finished && !output) throw new Error('JSCPP did not return a result');
  return output.trim() || '(no output)';
}

function numberedListing(code) {
  const lines = String(code || '').split('\n');
  const width = String(lines.length).length;
  return lines
    .map((line, i) => String(i + 1).padStart(width, ' ') + ' | ' + line)
    .join('\n');
}

// Пошаговый трейс через debug-протокол JSCPP. Полностью изолирован от runJSCPP:
// путь «Запустить» не использует эту функцию. Использует тот же synchronous
// jscppOnMessage. ВНИМАНИЕ: `s` (отладчик) — глобальный state самого бандла;
// каждый новый 'run' его перезаписывает, отдельно сбрасывать не нужно.
function runJSCPPDebug(code, stdin) {
  const MAX_STEPS = 1500;       // защита от зависания на циклах
  const MAX_TRACE_CHARS = 60000;

  let stdout = '';
  let lastReply = null;
  const originalPostMessage = self.postMessage.bind(self);
  self.postMessage = (message) => {
    if (message && message.type === 'stdio.write') {
      stdout += String(message.data ?? '');
      return;
    }
    lastReply = message;
  };

  const call = (cmd, ...args) => {
    lastReply = null;
    jscppOnMessage({ data: [1, cmd, ...args] });
    return lastReply;
  };

  try {
    // Старт debug-сессии. Ошибка компиляции/парсинга прилетит здесь.
    const startReply = call('run', code, stdin || '', { debug: true });
    if (startReply && startReply.err === -1) {
      throw new Error(startReply.msg || 'JSCPP error');
    }

    const trace = [];
    let traceLen = 0;
    let prevVars = Object.create(null); // name -> строковое значение, для diff
    let steps = 0;
    let truncated = false;
    let runtimeError = '';

    while (steps < MAX_STEPS) {
      const cont = call('continue');
      if (!cont) break;
      if (cont.err === -1) {            // ошибка времени выполнения
        runtimeError = cont.msg || 'JSCPP error';
        break;
      }
      const node = (call('nextNode') || {}).data || {};
      const line = node.sLine;
      // done: continue вернул не строго false, либо sentinel sLine === -1
      const finished = cont.data !== false || line === -1 || line == null;
      if (finished) break;

      const varsReply = call('variable');
      const vars = Array.isArray(varsReply && varsReply.data) ? varsReply.data : [];
      const changed = [];
      const snapshot = Object.create(null);
      for (const v of vars) {
        let val;
        try { val = String(v.value); } catch (_) { val = '<?>'; }
        snapshot[v.name] = val;
        if (prevVars[v.name] !== val) changed.push(v.name + '=' + val);
      }
      prevVars = snapshot;

      const text = changed.length
        ? '[строка ' + line + '] ' + changed.join(', ')
        : '[строка ' + line + ']';
      trace.push(text);
      traceLen += text.length + 1;
      steps++;
      if (traceLen > MAX_TRACE_CHARS) { truncated = true; break; }
    }
    if (steps >= MAX_STEPS) truncated = true;

    let body = (trace.join('\n') || '(шагов не зафиксировано)');
    if (truncated) body += '\n… трейс усечён (слишком много шагов)';
    let out =
      '=== Трейс ===\n' + body +
      '\n\n=== Вывод ===\n' + (stdout.trim() || '(нет вывода)');
    if (runtimeError) {
      out += '\n\n=== Ошибка ===\n' + runtimeError;
    }
    return out;
  } finally {
    self.postMessage = originalPostMessage;
  }
}

self.onmessage = function (e) {
  const { type, code, stdin, debug } = e.data || {};
  if (type === 'init') {
    self.postMessage({ type: 'ready' });
    return;
  }
  if (type !== 'run') return;

  // ── Debug: реальный пошаговый трейс, изолирован от пути Run ──────
  if (debug) {
    try {
      self.postMessage({ type: 'result', output: runJSCPPDebug(code || '', stdin || '') });
    } catch (err) {
      // Фолбэк: если стэппинг упал (в т.ч. syntax error) — отдаём
      // прагматичный листинг + сообщение, чтобы не потерять диагностику.
      const msg = err && err.message ? String(err.message) : String(err);
      self.postMessage({
        type: 'error',
        error: '=== Листинг ===\n' + numberedListing(code) + '\n\n=== Ошибка ===\n' + msg,
      });
    }
    return;
  }

  // ── Run: путь без изменений ─────────────────────────────────────
  try {
    self.postMessage({ type: 'result', output: runJSCPP(code || '', stdin || '') });
  } catch (err) {
    self.postMessage({ type: 'error', error: err && err.message ? String(err.message) : String(err) });
  }
};
