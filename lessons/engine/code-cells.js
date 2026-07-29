// code-cells.js — Monaco-backed code cells (Run/output; Shift+Enter runs, ↺
// resets). el._editor stash pattern unchanged from the pre-split code.
import { MONACO_VS } from './constants.js';
import { renderProse } from './prose.js';

let monacoReady = null;
let monacoThemeReady = false;
const MONACO_LOAD_TIMEOUT_MS = 8000;
function configureMonaco() {
  if (monacoThemeReady || !globalThis.monaco?.editor) return;
  globalThis.monaco.editor.defineTheme('magic', { base: 'vs', inherit: true, rules: [
    { token: 'comment', foreground: '687A74', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9A4F00', fontStyle: 'bold' },
    { token: 'string', foreground: '7A5A00' },
    { token: 'number', foreground: '006B55' },
    { token: 'identifier', foreground: '173F49' },
  ], colors: {
    'editor.background': '#fffaf0', 'editor.foreground': '#183f49',
    'editorLineNumber.foreground': '#78b2a5', 'editorCursor.foreground': '#4f6f73',
    'editor.selectionBackground': '#d9eee5', 'editor.inactiveSelectionBackground': '#d9eee5',
  } });
  monacoThemeReady = true;
}
export function ensureMonaco() {
  monacoReady ||= new Promise(res => {
    if (globalThis.monaco?.editor) { configureMonaco(); res(true); return; }
    const amdRequire = globalThis.require;
    if (typeof amdRequire !== 'function') { res(false); return; }
    let settled = false;
    const finish = loaded => { if (settled) return; settled = true; clearTimeout(timer); if (loaded) configureMonaco(); res(loaded); };
    const timer = setTimeout(() => finish(false), MONACO_LOAD_TIMEOUT_MS);
    try {
      amdRequire.config({ paths: { vs: MONACO_VS } });
      globalThis.MonacoEnvironment = { getWorkerUrl: () => 'data:text/javascript;charset=utf-8,' };
      amdRequire(['vs/editor/editor.main'], () => finish(true), () => finish(false));
    } catch { finish(false); }
  });
  return monacoReady;
}

// codeCell(c, {runCell, workerUp}) — workerUp() reports whether the Pyodide
// worker is already up (enables Run immediately instead of waiting on boot).
export function codeCell(c, { runCell, workerUp, stickyOutput = false }) {
  const el = document.createElement('div'); el.className = 'codecell'; el._src = c.code; el._expect = c.expect; el._expectOut = c.expectOut; el._stopCompletes = c.stopCompletes === true; el._stickyOutput = c.stickyOutput === true || stickyOutput; // experiential cells keep their scene visible and leave scrolling to the learner
  el._solution = c.solution;
  el._solutionExplanation = c.solutionExplanation;
  el.innerHTML = `
    <div class="chead"><span class="inlbl mono">In [ ]</span><span class="clabel mono">${c.label || 'cell.py'}</span>
      <div class="chead-actions">
        ${c.solution ? `<button class="csolution" title="xem đáp án đầy đủ">💡 XEM ĐÁP ÁN</button>` : ''}
        ${c.solutionExplanation ? `<button class="cexplain" hidden title="đọc giải thích từng dòng">🔎 GIẢI THÍCH TỪNG DÒNG</button>` : ''}
        <button class="cfull" title="mở rộng ô này ra toàn màn hình (Esc để thoát)" aria-pressed="false">⛶</button>
        <button class="creset" title="đặt lại ô này">↺</button>
        <button class="crun" disabled>▶ RUN</button>
      </div></div>
    ${c.note ? `<div class="cnote">${renderProse(c.note)}</div>` : ''}
    <div class="cworkspace">
      <div class="ced"></div>
      <section class="coutput" aria-label="Kết quả chạy code">
        <div class="coutput-label mono">OUTPUT</div>
        <div class="cout mono"></div>
      </section>
    </div>
    ${c.solutionExplanation ? `<div class="csolution-explanation" hidden><ol>${c.solutionExplanation.map(item => `<li><b>Dòng ${item.line}</b><span>${renderProse(item.text)}</span></li>`).join('')}</ol></div>` : ''}
  `;
  // Fullscreen this cell. Monaco sizes itself to its container, so it has to be
  // told the container changed; without the relayout the editor keeps the old
  // narrow width and the extra space goes to waste.
  const fullBtn = el.querySelector('.cfull');
  const setFull = on => {
    el.classList.toggle('cell-full', on);
    document.body.classList.toggle('cell-full-on', on);
    fullBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    fullBtn.textContent = on ? '⤡' : '⛶';
    setTimeout(() => { try { el._editor?.layout(); } catch { /* editor not up yet */ } }, 60);
  };
  fullBtn.onclick = () => setFull(!el.classList.contains('cell-full'));
  el._exitFull = () => { if (el.classList.contains('cell-full')) setFull(false); };
  // Esc is what everyone reaches for to leave a fullscreen thing. Bound once at
  // the document level rather than per-cell, so it cannot leak listeners as the
  // notebook builds more cells.
  if (!document.body.dataset.cellFullEsc) {
    document.body.dataset.cellFullEsc = '1';
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const open = document.querySelector('.codecell.cell-full');
      if (open && open._exitFull) { e.preventDefault(); open._exitFull(); }
    });
  }
  el.querySelector('.crun').onclick = () => runCell(el);
  el.querySelector('.creset').onclick = () => { if (el._editor) el._editor.setValue(el._src); };
  const solutionBtn = el.querySelector('.csolution');
  const explainBtn = el.querySelector('.cexplain');
  const explainPanel = el.querySelector('.csolution-explanation');
  if (explainBtn) explainBtn.onclick = () => {
    const showing = explainPanel.hidden;
    explainPanel.hidden = !showing;
    explainBtn.classList.toggle('shown', showing);
    explainBtn.textContent = showing ? '↩ ẨN GIẢI THÍCH' : '🔎 GIẢI THÍCH TỪNG DÒNG';
  };
  if (solutionBtn) solutionBtn.onclick = () => {
    if (!el._editor) return;
    const showingSolution = solutionBtn.classList.toggle('shown');
    el._editor.setValue(showingSolution ? el._solution : el._src);
    solutionBtn.textContent = showingSolution ? '↩ ẨN ĐÁP ÁN' : '💡 XEM ĐÁP ÁN';
    if (explainBtn) explainBtn.hidden = !showingSolution;
    if (!showingSolution && explainPanel) {
      explainPanel.hidden = true;
      explainBtn.classList.remove('shown');
      explainBtn.textContent = '🔎 GIẢI THÍCH TỪNG DÒNG';
    }
  };
  ensureMonaco().then(() => mountEditor(el, c.code, runCell));
  if (workerUp()) el.querySelector('.crun').disabled = false;
  return el;
}

export function mountEditor(el, src, runCell) {
  const host = el.querySelector('.ced');
  // Inline, the editor grows with the code up to a sane ceiling; the fullscreen
  // mode overrides this height in CSS and lets it fill the overlay instead.
  const fit = n => { host.style.height = Math.min(Math.max(n * 22 + 22, 66), 380) + 'px'; };
  fit(src.split('\n').length);
  if (!globalThis.monaco?.editor) return mountFallbackEditor(el, host, src, runCell, fit);
  const ed = globalThis.monaco.editor.create(host, { value: src, language: 'python', theme: 'magic',
    fontFamily: 'Cascadia Code, Consolas, ui-monospace, monospace', fontSize: 13.5, lineHeight: 22,
    minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 10 },
    renderLineHighlight: 'none', tabSize: 4, fixedOverflowWidgets: true, folding: false,
    lineNumbers: 'off', scrollbar: { vertical: 'hidden' }, overviewRulerLanes: 0 });
  ed.onDidChangeModelContent(() => { fit(ed.getModel().getLineCount()); ed.layout(); });
  ed.addCommand(globalThis.monaco.KeyMod.Shift | globalThis.monaco.KeyCode.Enter, () => runCell(el));
  el._editor = ed;
  return ed;
}

function mountFallbackEditor(el, host, src, runCell, fit) {
  const note = document.createElement('div'); note.className = 'ced-fallback-note'; note.textContent = 'Đang dùng trình soạn thảo gọn vì Monaco chưa tải được.';
  const textarea = document.createElement('textarea'); textarea.className = 'ced-fallback mono'; textarea.value = src;
  textarea.setAttribute('aria-label', 'Ô nhập code Python'); textarea.setAttribute('spellcheck', 'false');
  const callbacks = new Set();
  const sync = () => { fit(textarea.value.split('\n').length); callbacks.forEach(callback => callback()); };
  textarea.addEventListener('input', sync);
  textarea.addEventListener('keydown', event => { if (event.shiftKey && event.key === 'Enter') { event.preventDefault(); runCell(el); } });
  host.replaceChildren(note, textarea);
  const editor = {
    getValue: () => textarea.value,
    setValue: value => { textarea.value = String(value); sync(); },
    getModel: () => ({ getLineCount: () => textarea.value.split('\n').length }),
    onDidChangeModelContent: callback => { callbacks.add(callback); return { dispose: () => callbacks.delete(callback) }; },
    addCommand: () => {}, layout: () => {},
    updateOptions: options => { if (options?.fontSize) textarea.style.fontSize = `${options.fontSize}px`; if (options?.lineHeight) textarea.style.lineHeight = `${options.lineHeight}px`; },
  };
  el._editor = editor;
  return editor;
}
