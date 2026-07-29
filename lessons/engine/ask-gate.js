// ask-gate.js — small shared "pending ask" plumbing used by NotebookRunner
// (cellAsk/fingerAsk) and PhotoBooth (gestureAsk): a running cell parked on a
// camera/typed ask can be CANCELLED (sentinel unwinds the worker) the moment
// another cell is run — a forgotten rerun must never brick the notebook.
// Not in the original file-split outline; factored out to avoid duplicating
// the cancel-slot + typed-fallback-input logic across notebook-runner.js and
// photo-booth.js (both need the exact same behavior).
import { ASK_CANCEL, FINGER_ASK_STUB_MAX_RETRIES } from './constants.js';

export class AskGate {
  #pending = null;
  arm(fn) { this.#pending = fn; }
  clear() { this.#pending = null; }
  get isArmed() { return !!this.#pending; }
  // cancel(): invoked by NotebookRunner when a rerun interrupts a stuck ask.
  cancel() { const fn = this.#pending; this.#pending = null; if (fn) fn(); }
}

// fingerAskStub(scenePanel, exp, askGate) — no-camera typed-count fallback,
// shared by fingerAsk() and gestureAsk()'s catch path.
export function fingerAskStub(scenePanel, exp, askGate, outLine) {
  const ask = scenePanel.querySelector('#scask'), inp = ask.querySelector('input');
  return new Promise(resolve => {
    let rejectCount = 0;
    const arm = () => { ask.style.display = 'flex'; inp.value = ''; inp.focus(); };
    arm();
    askGate.arm(() => { ask.style.display = 'none'; inp.onkeydown = null; resolve(ASK_CANCEL); });
    inp.onkeydown = e => { if (e.key !== 'Enter') return;
      const v = inp.value || '0', count = parseInt(v, 10);
      if (exp && !exp.includes(count) && ++rejectCount < FINGER_ASK_STUB_MAX_RETRIES) { inp.value = ''; outLine('giữ đúng dấu tay nhé… (số vừa nhập chưa khớp)'); return; } // re-prompt, same as camera gate
      ask.style.display = 'none'; inp.onkeydown = null; askGate.clear();
      if (exp && !exp.includes(count)) outLine('thôi, cứ nhận tạm số này rồi mình đi tiếp nhé');
      outLine('👁 thấy ' + v + ' ngón tay  [gõ phím]'); resolve(v); };
  });
}
