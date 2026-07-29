// bypass-registry.js — cheat-mode-only Space bypass. Whatever camera/voice
// gate is currently armed registers {label, resolve} here at arm time and
// unregisters at disarm/completion. Space (cheat mode only) calls the most
// recent registration's resolve(). A stack (not a single slot): a nested
// registration (e.g. the ritual's "open" gate immediately followed by its
// "active" gate) must shadow correctly, and a stale unregister firing after
// something newer has armed must be a no-op — hence filter-by-identity
// removal rather than a naive pop().
let cheatOn = false;
let stack = [];

export function setCheatOn(v) { cheatOn = !!v; }
export function isCheatOn() { return cheatOn; }

// registerBypass(label, resolve) → unregister(). `resolve` is called with no
// args; it owns whatever it takes to make the armed gate succeed (pick the
// correct answer, force the expected finger count, etc).
export function registerBypass(label, resolve) {
  const entry = { label, resolve };
  stack.push(entry);
  return () => { stack = stack.filter(e => e !== entry); };
}

export function clearAllBypasses() { stack = []; }         // test/reset hook
export function currentBypassLabel() { return stack.length ? stack[stack.length - 1].label : null; } // test hook

// fireBypass() — invokes the top-of-stack resolve, if any. Returns whether
// something fired (so the caller can decide whether to show the toast).
export function fireBypass() {
  if (!stack.length) return false;
  const { resolve } = stack[stack.length - 1];
  resolve();
  return true;
}

// installBypassKey(onFire) — global Space listener, active only while cheat
// mode is on, and never while focus is in a text input/editor (code cells
// carry a Monaco/CodeMirror editor — a student typing a space in their code
// must never trigger this). onFire() is called only when something actually
// resolved (e.g. to show the "⏭ CHEAT" toast).
export function installBypassKey(onFire) {
  addEventListener('keydown', e => {
    if (e.code !== 'Space' || !isCheatOn()) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (t && t.closest && t.closest('.monaco-editor, .cm-editor, [contenteditable="true"]')) return;
    if (fireBypass()) { e.preventDefault(); onFire(); }
  });
}
