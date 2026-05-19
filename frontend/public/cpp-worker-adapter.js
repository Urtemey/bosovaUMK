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

self.onmessage = function (e) {
  const { type, code, stdin, debug } = e.data || {};
  if (type === 'init') {
    self.postMessage({ type: 'ready' });
    return;
  }
  if (type !== 'run') return;

  try {
    const out = runJSCPP(code || '', stdin || '');
    if (debug) {
      self.postMessage({
        type: 'result',
        output:
          '=== Листинг ===\n' + numberedListing(code) +
          '\n\n=== Вывод ===\n' + out,
      });
    } else {
      self.postMessage({ type: 'result', output: out });
    }
  } catch (err) {
    // JSCPP-сообщение нередко уже содержит позицию (line N) — показываем как есть,
    // ничего не выдумывая. В debug добавляем нумерованный листинг для поиска строки.
    const msg = err && err.message ? String(err.message) : String(err);
    self.postMessage({
      type: 'error',
      error: debug
        ? '=== Листинг ===\n' + numberedListing(code) + '\n\n=== Ошибка ===\n' + msg
        : msg,
    });
  }
};
