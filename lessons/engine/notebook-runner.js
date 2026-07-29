// notebook-runner.js — builds the node's cell sequence, reveals it
// progressively (stopping at interactive cells), and bridges each running
// code cell to the shared PyBridge worker: output routing (terminal lines /
// camera 'ask'/'tell' dispatch), run cancellation, and per-cell completion.
import { NPC_NAME, PAUSE_MS, PAUSE_CH, OUTPUT_DWELL_MS, ASK_CANCEL, ASK_GRACE_MS, HOLD_MS, FINGER_ASK_FALLBACK_MS } from './constants.js';
import { quizCell } from './quiz-cell.js';
import { giftCell } from './gift-cell.js';
import { forgeCell } from './forge-cell.js';
import { checkpointCell } from './checkpoint-cell.js';
import { pixelBoardCell } from './pixel-board-cell.js';
import { widgetCell } from './widget-cell.js?v=20260714-101425';
import { bossCell } from './boss-fight.js';
import { codeCell, ensureMonaco, mountEditor } from './code-cells.js?v=20260714-165347';
import { AskGate, fingerAskStub } from './ask-gate.js';
import { cameoCell } from './cameo-cell.js';
import { introCell } from './intro-cell.js';
import { alignWalkthrough, walkthroughCell } from './walkthrough-cell.js';
import { alignProgramCounter, programCounterCell } from './program-counter-cell.js';
import { alignCodeTrace, codeTraceCell } from './code-trace-cell.js';
import { armFingertipFx } from './gesture-ui.js';
import { registerBypass } from './bypass-registry.js';
import { renderProse, rawSegmentsOf, escapeHtml, highlightCode, codeBlockClass } from './prose.js';
import { gridCellAt } from './gesture-math.js';
import { telemetry } from './telemetry.js';

// {remember:'…' | ['…', …]} — a short, concise takeaway card the eye can find
// again; an array renders as stacked lines. renderProse() so a `code` chip
// or an escaped `<`/`>` in a remember line shows correctly (was raw
// `${t}` innerHTML before — see prose.js's header for why that was unsafe).
function rememberCell(c) {
  const el = document.createElement('div'); el.className = 'remember';
  el.innerHTML = `<i>✦</i><div><b>REMEMBER</b>${[].concat(c.remember).map(t => `<span>${renderProse(t)}</span>`).join('')}</div>`;
  return el;
}
function npcCell(c) {
  const el = document.createElement('div'); el.className = 'npc'; el.dataset.text = c.npc;
  el.innerHTML = `<div class="avatar"><i></i></div><div class="bubble"><b>${NPC_NAME}</b><span class="txt"></span></div>`;
  return el;
}
const isBlocking = c => !!(c.npc || c.code || c.walkthrough || c.programCounter || c.execution || c.widget || c.gift || c.quiz || c.boss || c.ritual || c.cameo || c.checkpoint || c.forge || c.intro || c.pixelBoard);

export function classroomInstructionCell(cell) {
  if (!cell || typeof cell !== 'object' || cell.code === undefined) return cell;
  const clean = { ...cell };
  if (typeof clean.label === 'string') {
    clean.label = clean.label
      .replace(/^🔧\s*XƯỞNG PHÉP\s*:?\s*/u, 'BÀI LUYỆN · ')
      .replace(/^XƯỞNG[^:·]*[:·]?\s*/u, 'BÀI LUYỆN · ')
      .replace(/^TẦNG\s+(\d+)\s*[·:]?\s*/u, 'BÀI $1 · ');
  }
  if (typeof clean.note === 'string') {
    clean.note = clean.note
      .replace(/^XƯỞNG[^\n:]*/u, 'BÀI LUYỆN')
      .replace(/^TẦNG\s+(\d+)\s*·?[^\n]*/u, 'BÀI $1');
  }
  return clean;
}

export class NotebookRunner {
  #N; #bridge; #gestureDispatcher; #cameraEngine; #progressStore; #casting; #photoBooth; #studio; #scenePanel; #toast;
  #bookEl; #pystatEl;
  #seq = []; #frontier = 0; #runCounter = 0; #built = false; #resuming = false;
  #running = null; #captured = []; #heldCount = null;
  #askGate; #queuedRun = null; #loadVortex;
  #quizBonus = 0;                                     // correct pre-boss quiz answers — consumed by the next boss's first strike
  constructor(N, { bridge, gestureDispatcher, cameraEngine, progressStore, casting, photoBooth, studio, scenePanel, bookEl, pystatEl, toast, askGate, loadVortex }) {
    this.#N = N; this.#bridge = bridge; this.#gestureDispatcher = gestureDispatcher; this.#cameraEngine = cameraEngine;
    this.#progressStore = progressStore; this.#casting = casting; this.#photoBooth = photoBooth; this.#studio = studio;
    this.#scenePanel = scenePanel; this.#bookEl = bookEl; this.#pystatEl = pystatEl; this.#toast = toast;
    this.#askGate = askGate || new AskGate();
    this.#loadVortex = loadVortex || (() => Promise.resolve());  // ko-boss mounts the ritual vortex for its aim/detonate FX; a missing loader is a no-op (fx-less fallback)
    telemetry.configureCourse(N);
  }
  get isRunning() { return !!this.#running; }
  get askGate() { return this.#askGate; }

  onReady = () => {
    this.#clearBootAction(); this.#pystatEl.textContent = '✦ Python ready'; this.#pystatEl.classList.remove('retrying', 'error'); this.#pystatEl.classList.add('ok');
    this.#restoreRunButtons(true);
  };
  onBootStatus = ({ state, retry = 0, totalRetries = 0 } = {}) => {
    if (!this.#pystatEl) return;
    this.#clearBootAction(); this.#pystatEl.classList.remove('ok', 'retrying', 'error');
    if (state === 'loading') { this.#pystatEl.textContent = '✦ đang đánh thức Python…'; return; }
    if (state === 'retrying') { this.#pystatEl.textContent = `✦ Python chưa thức · thử lại ${retry}/${totalRetries}…`; this.#pystatEl.classList.add('retrying'); return; }
    if (state !== 'failed') return;
    this.#pystatEl.textContent = '⚠ Không tải được Python · THỬ LẠI'; this.#pystatEl.classList.add('error');
    this.#pystatEl.setAttribute('role', 'button'); this.#pystatEl.setAttribute('tabindex', '0');
    this.#pystatEl.title = 'Kiểm tra kết nối mạng rồi thử tải Python lại';
    const retryBoot = () => this.#bridge.retryBoot();
    this.#pystatEl.onclick = retryBoot;
    this.#pystatEl.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); retryBoot(); } };
  };
  #clearBootAction() {
    if (!this.#pystatEl) return;
    this.#pystatEl.onclick = null; this.#pystatEl.onkeydown = null; this.#pystatEl.title = '';
    this.#pystatEl.removeAttribute('role'); this.#pystatEl.removeAttribute('tabindex');
  }
  onDone = () => {
    const el = this.#running; if (this.#studio && !(el && el._stickyOutput)) this.#studio.stopAfter(OUTPUT_DWELL_MS + 300); this.#clearRunning(`In [${++this.#runCounter}]`);
    if (el && el._expectOut && !cellOutputSatisfies(el._expectOut, el._captured || [], el._heldCount)) {
      const hint = expectOutHint(el._expectOut, el._captured || [], el._heldCount) || 'hừm — xem lại chỗ vừa sửa rồi RUN lại nhé ✦';
      // `t-fail` alongside `t-sys` (same visual style) — a distinct marker so
      // tooling (playtest-full.mjs's CodeSolver) can tell "this run genuinely
      // failed expectOut" apart from routine `.r.t-sys` chatter that shares
      // the plain t-sys class (fingerAsk()'s own "👁 thấy N ngón tay" / "không
      // mở được camera" notices) — those aren't failure signals and were
      // being misread as one, causing a working cell to be "fixed" and
      // re-run needlessly (found via node05v2.js's too_narrow_rule.py).
      const d2 = document.createElement('div'); d2.className = 'r t-sys t-fail'; d2.textContent = hint;
      el.querySelector('.cout').appendChild(d2);
      if (el._fight) setTimeout(() => el._fight(false), 500);                  // boss code round: a clean-but-wrong run still FEEDS the boss
      return;
    }
    if (el && el._fight) { setTimeout(() => el._fight(true), 500); return; }    // boss code round: a clean, correct run lands the hit
    if (el) setTimeout(() => this.completeCell(el), OUTPUT_DWELL_MS);
  };
  onError = msg => {
    if (/__MDCANCEL__/.test(String(msg))) { this.outLine('t-sys', '⏹ đã dừng — bạn vừa chạy một ô khác'); if (this.#studio) this.#studio.stop(); this.#clearRunning('In [·]'); return; }
    const el = this.#running, last = String(msg || '').trim().split('\n').pop() || 'error';
    this.outLine('t-err', '✖ ' + last);
    const c = this.#running && this.#running._editor ? this.#running._editor.getValue() : '';
    if (/name .* is not defined/i.test(last) && /old_computer_/.test(c) && /future_machine_/.test(c))
      this.outLine('t-sys', '↑ your code mixes old_computer_ and future_machine_ — make them ALL the same machine.');
    if (this.#studio) this.#studio.stop(); this.#clearRunning('In [✖]');
    if (el && el._fight) setTimeout(() => el._fight(false), 500);               // boss code round: an error FEEDS the boss
  };
  onTell = (kind, text) => {
    if (this.#running) this.#running._captured.push({ kind, text });           // record for expectOut validation regardless of dispatch below
    if (kind === 'spell') { this.#mountScene(); this.#casting.castSpell(text); }
    else if (kind === 'label') { this.#mountScene(); this.#casting.showValue(this.#scenePanel, text); }
    else if (kind === 'booth') { this.#mountScene(); this.#photoBooth.act(text); }
    else if (kind === 'screen') { this.#mountScene(); this.#casting.screenFx(this.#scenePanel, text, t => this.outLine('t-sys', t)); }
    else if (kind === 'pixels') { this.#mountScene(); this.#casting.showPixels(this.#scenePanel, text); }
    else if (kind === 'studio') { this.#mountScene(); if (this.#studio) this.#studio.handle(text); }
    else this.outLine('t-out', text);
  };
  onAsk = async (kind, prompt) => {
    if (kind === 'fingers') { this.#mountScene(); const v = await this.fingerAsk(); if (this.#running) this.#running._heldCount = parseInt(v, 10); this.#bridge.respond(v); }
    else if (kind === 'grid') { this.#mountScene(); this.#bridge.respond(await this.gridAsk(prompt)); }
    else if (kind === 'gesture') { this.#mountScene(); this.#bridge.respond(await this.#photoBooth.gestureAsk()); }
    else if (kind === 'studio_start') { this.#mountScene(); if (this.#running) this.#running._captured.push({ kind, text: prompt }); this.#bridge.respond(this.#studio ? await this.#studio.start(prompt) : 'unavailable'); }
    else if (kind === 'hand_position') { this.#mountScene(); if (this.#running) this.#running._captured.push({ kind, text: prompt }); this.#bridge.respond(this.#studio ? await this.#studio.readHandPosition(prompt) : '{"visible":false,"x":50,"y":50}'); }
    else if (kind === 'particle_frame') { this.#mountScene(); if (this.#running) this.#running._captured.push({ kind, text: prompt }); this.#bridge.respond(this.#studio ? this.#studio.drawParticleFrame(prompt) : 'skipped'); }
    else if (kind === 'image_frame') { this.#mountScene(); if (this.#running) this.#running._captured.push({ kind, text: prompt }); this.#bridge.respond(this.#studio ? this.#studio.presentImageFrame(prompt) : 'skipped'); }
    else this.#bridge.respond(await this.cellAsk(prompt));
  };

  // ── build / reveal / resume ──
  buildCells() {
    if (this.#built) return; this.#built = true;
    const cfgs = [...(this.#N.cells || []).map(classroomInstructionCell), { ritual: true }];
    const deps = this.#cellDeps();
    // known cell types — anything else is a content bug (a typo'd key, e.g.)
    // that used to silently fall through to the ritual-cell factory and
    // render as a broken/blank cell with no clue why (see validate-content.mjs's
    // matching check). Loud + additive: known types are untouched below.
    const isKnownType = c => !!(c.npc !== undefined || c.code !== undefined || c.walkthrough || c.programCounter || c.execution || c.widget || c.gift || c.quiz || c.boss || c.cameo || c.remember || c.ritual || c.checkpoint || c.forge || c.intro || c.pixelBoard);
    cfgs.forEach((c, i) => {
      if (!isKnownType(c)) {
        console.error(`notebook-runner: unknown cell type at index ${i} (keys: ${Object.keys(c).join(', ') || 'none'})`, c);
        const el = document.createElement('div'); el.className = 'cell veiled cell-error';
        el.style.cssText = 'color:#d69a20;border:1px solid #d69a20;padding:10px;font:13px monospace';
        el.textContent = `⚠ unknown cell type at index ${i} — check lessons/content/node*.js (keys: ${Object.keys(c).join(', ') || 'none'})`;
        this.#bookEl.appendChild(el); this.#seq.push({ cfg: c, el, done: false });
        return;
      }
      const el = c.npc ? npcCell(c) : c.programCounter ? programCounterCell(c, deps) : c.execution ? codeTraceCell(c, deps) : c.walkthrough ? walkthroughCell(c, deps) : c.code !== undefined ? codeCell(c, { runCell: el2 => this.runCell(el2), workerUp: () => this.#bridge.isUp, stickyOutput: this.#N.stickyCodeOutput === true })
        : c.widget ? widgetCell(c, deps) : c.gift ? giftCell(c, deps) : c.quiz ? quizCell(c, deps)
        : c.boss ? bossCell(c, { ...deps, ensureMonaco, mountEditor: (el2, src) => mountEditor(el2, src, el3 => this.runCell(el3)), runCell: el2 => this.runCell(el2) })
        : c.cameo ? cameoCell(c, deps)
        : c.intro ? introCell(c, deps)
        : c.checkpoint ? checkpointCell(c, deps)
        : c.pixelBoard ? pixelBoardCell(c, deps)
        : c.forge ? forgeCell(c, deps)
        : c.remember ? rememberCell(c) : this.#ritualCellFactory();
      el.classList.add('cell', 'veiled'); this.#bookEl.appendChild(el); this.#seq.push({ cfg: c, el, done: false });
    });
    this.tryResume();
  }
  // set by the composition root once RitualController exists (avoids a
  // circular import — ritual-controller.js needs NotebookRunner-shaped hooks
  // for devTo(), notebook-runner needs a ritual cell factory).
  setRitualCellFactory(fn) { this.#ritualCellFactory = fn; }
  #ritualCellFactory = () => document.createElement('div');
  #cellDeps() {
    return {
      nodeIndex: this.#N.index,
      gestureDispatcher: this.#gestureDispatcher, cameraEngine: this.#cameraEngine,
      completeCell: el => this.completeCell(el), saveProgress: sub => this.#progressStore.save(this.#frontier, sub),
      onQuizCorrect: () => { this.#quizBonus++; }, getQuizBonus: () => this.#quizBonus,
      workerUp: () => this.#bridge.isUp, loadVortex: this.#loadVortex,
      studio: this.#studio, scenePanel: this.#scenePanel,
      cameraFree: this.#N.cameraFree === true,
    };
  }
  tryResume() {
    const decision = this.#progressStore.decideResume(this.#seq.length);
    if (!decision.resume) { this.#progressStore.clear(); telemetry.courseStart(this.#N, { resume: false }); this.revealNext(); return; }
    // #resuming suppresses completeCell()'s normal reveal-next/schedule-release
    // side effects while fast-forwarding through already-done history: without
    // it, EVERY devForce() below (indirectly, via completeCell() seeing its
    // cell sit exactly at the frontier) also reveals + `_arm()`s the NEXT cell
    // in line — even though that cell is about to be devForce'd itself on the
    // very next loop iteration. For a resume deep into a node with several
    // gated (checkpoint/quiz/…) cells in its history, this armed-then-abandoned
    // a camera gate per cell: armActGate() just overwrites `#actGate` with no
    // check, so an earlier cell's gate callback (the one whose own code path
    // would have removed its chip's fullscreen `.on` class) gets silently
    // orphaned — never runs again, and never disarms its `.bcam` — leaving a
    // stuck fullscreen camera nothing in the running gate can turn off (owner:
    // "camera vẫn không tắt được"). Only the REAL frontier cell should ever
    // reveal/arm; do that once via the explicit revealNext() below.
    this.#resuming = true;
    for (let i = 0; i < decision.index && i < this.#seq.length; i++) this.devForce(this.#seq[i]);
    this.#resuming = false;
    this.#restoreSubState(this.#progressStore.saved && this.#progressStore.saved.sub);
    this.#toast('✦ picking up where you left off…');
    telemetry.courseStart(this.#N, { resume: true, resumeIndex: decision.index });
    this.revealNext();
  }
  #restoreSubState(sub) {
    if (!sub) return;
    try {
      if (sub.boss) { const el = this.devBoss(); if (el && el._dev && typeof sub.boss.hp === 'number') el._dev.setHp(sub.boss.hp); }
    } catch { /* sub-state restore is a nicety */ }
  }
  revealNext({ scroll = true } = {}) {
    let last = null;
    while (this.#frontier < this.#seq.length) {
      const s = this.#seq[this.#frontier]; s.el.classList.remove('veiled'); last = s.el;
      telemetry.cellShown(this.#N, s.cfg, this.#frontier, { frontier: this.#frontier });
      if (s.cfg.npc) this.#typeBubble(s.el);
      if (s.el._arm) s.el._arm();                       // hand-first cells (quiz / gift / anatomy / ritual) arm their gesture gate on reveal
      if (isBlocking(s.cfg)) break;
      this.#frontier++;
    }
    if (last && scroll) setTimeout(() => { if (last.classList.contains('walkthrough')) alignWalkthrough(last); else if (last.classList.contains('program-counter')) alignProgramCounter(last); else if (last.classList.contains('code-trace')) alignCodeTrace(last); else last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }
  completeCell(el) {
    const s = this.#seq.find(x => x.el === el);
    if (!s || s.done) return;
    const cellIndex = this.#seq.indexOf(s);
    s.done = true; el.classList.add('done');
    const btn = el.querySelector('.crun'); if (btn) { this.#primeRunButton(btn); btn.textContent = btn.dataset.rerunLabel; }
    if (cellIndex === this.#frontier) { this.#frontier++; if (!this.#resuming) this.revealNext({ scroll: !el._stickyOutput }); }
    this.#progressStore.save(this.#frontier);            // persist WHERE (frontier) on every completed cell
    if (this.#resuming) return;                          // bulk resume replay — see tryResume()'s #resuming comment; no reveal/arm/release churn per historical cell
    telemetry.cellComplete(this.#N, s.cfg, cellIndex, { frontier: this.#frontier });
    // Release the camera only if, by the time the just-revealed next cell has
    // had a beat to re-arm, NOTHING is consuming it. Checking hasActiveConsumer
    // INSIDE the timer (not at set-time) is load-bearing: a gated cell's _arm()
    // re-acquires via cameraEngine.ensure().then(...) asynchronously, so the
    // gate isn't armed yet when this timer is scheduled — only ~600ms later.
    // The old unconditional release raced that re-arm (esp. right after a boss,
    // where the stream was torn down + re-acquired), tearing the stream back
    // down and leaving the next 1-2 cells unable to see the hand (owner bug).
    setTimeout(() => { if (!this.#gestureDispatcher.hasActiveConsumer()) this.#cameraEngine.release(); }, 600);
  }
  // Types char-by-char (unchanged feel/timing/skip-on-tap) but reveals a
  // `code`/```block``` segment (see prose.js#rawSegmentsOf) wrapped in the
  // same <code class="ic">/<pre class="cb"> markup renderProse() would have
  // produced — so code mid-sentence shows monospace/chipped as it types
  // instead of the raw backticks. Pause/skip logic still walks the FULL flat
  // raw text (backtick delimiters stripped, segment boundaries invisible to
  // it) so timing is identical to the pre-segment implementation.
  #typeBubble(el) {
    const t = el.dataset.text, span = el.querySelector('.txt'); let i = 0, timer;
    const segs = rawSegmentsOf(t);
    const flat = segs.map(s => s.value).join('');           // same chars the old textContent-based typer walked (minus backtick/fence markers)
    const renderUpTo = n => {
      let left = n, html = '';
      for (const s of segs) {
        if (left <= 0) break;
        const rawSlice = s.value.slice(0, left);
        const slice = escapeHtml(rawSlice); left -= s.value.length;
        html += s.type === 'code' ? `<code class="ic">${slice}</code>`
          : s.type === 'block' ? `<pre class="${codeBlockClass(s.lang)}"><code>${highlightCode(rawSlice, s.lang)}</code></pre>` : slice;
      }
      span.innerHTML = html;
    };
    const fin = () => setTimeout(() => this.completeCell(el), 420); // a breath after the last word, then the next cell may appear
    const tick = () => {
      renderUpTo(++i);
      if (i >= flat.length) { fin(); return; }
      const ch = flat[i - 1], nx = flat[i];
      const pause = ch === '\n' || (PAUSE_CH.includes(ch) && (nx === ' ' || nx === '\n'));
      timer = setTimeout(tick, pause ? PAUSE_MS : 17);
    };
    timer = setTimeout(tick, 17);
    el.onclick = () => { clearTimeout(timer); renderUpTo(flat.length); fin(); };
  }

  // ── dev / cheat helpers (used by cheat-panel.js and resume) ──
  devForce(s) {
    if (!s || s.done) return;
    s.el.classList.remove('veiled');
    if (s.cfg.npc) { const sp = s.el.querySelector('.txt'); if (sp) sp.innerHTML = renderProse(s.el.dataset.text); }
    this.completeCell(s.el);
  }
  async devTo(pred, enterActs) {
    if (!this.#built) { try { enterActs(); } catch { /* acts may already be past */ } }
    await new Promise(r => { const t = setInterval(() => { if (this.#built) { clearInterval(t); r(); } }, 150); });
    let guard = this.#seq.length + 2;
    while (guard-- && this.#frontier < this.#seq.length && !pred(this.#seq[this.#frontier].cfg)) this.devForce(this.#seq[this.#frontier]);
    const s = this.#seq[this.#frontier]; if (s) { s.el.classList.remove('veiled'); setTimeout(() => { if (s.el.classList.contains('walkthrough')) alignWalkthrough(s.el); else if (s.el.classList.contains('program-counter')) alignProgramCounter(s.el); else if (s.el.classList.contains('code-trace')) alignCodeTrace(s.el); else s.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); }
  }
  devBoss() { return this.#seq.map(s => s.el).find(el => el._dev); }
  get frontier() { return this.#frontier; }
  get seq() { return this.#seq; }
  devScene(bookHidden) {
    const host = !bookHidden ? (this.#seq[this.#frontier]?.el.querySelector('.cout') || this.#bookEl) : null;
    if (host) { this.#scenePanel.classList.remove('devstage'); if (this.#scenePanel.parentElement !== host) host.appendChild(this.#scenePanel); }
    else { document.body.appendChild(this.#scenePanel); this.#scenePanel.classList.add('devstage'); } // book not entered → float the stage over the act
    this.#scenePanel.classList.remove('frozen');
    const v = this.#scenePanel.querySelector('#cam'); if (this.#cameraEngine.isReady && v.paused) v.play().catch(() => {});
    dispatchEvent(new Event('resize'));                  // an engine mounted while the panel was hidden re-sizes to the real box
  }

  // ── camera/fx scene panel mount (shared; mounted into the running cell) ──
  // The camera output is a panel in the notebook flow, and a learner running a
  // cell is looking at their CODE — so the effect plays perfectly somewhere
  // below the fold and they report that nothing happened. Bring it into view
  // the moment it moves to a new cell, and flash the frame so the eye lands on
  // it. Deliberately NOT on every mountScene(): that fires on every camera ask
  // (a watch() inside a loop calls it each iteration) and would yank the page
  // out from under anyone trying to read.
  #revealScene() {
    const panel = this.#scenePanel;
    setTimeout(() => {
      // Inside the fullscreen overlay the page does not scroll at all, so the
      // pane has to be scrolled instead — scrollIntoView on the document would
      // do nothing and the camera would look missing.
      const pane = panel.closest('.coutput');
      const overlay = panel.closest('.codecell.cell-full');
      if (overlay && pane) pane.scrollTop = Math.max(0, panel.offsetTop - 8);
      else {
        const r = panel.getBoundingClientRect();
        const showing = r.top >= 0 && r.bottom <= (innerHeight || 0);
        if (!showing) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      panel.classList.remove('scene-ping');
      void panel.offsetWidth;                    // restart the animation
      panel.classList.add('scene-ping');
      setTimeout(() => panel.classList.remove('scene-ping'), 1400);
    }, 60);
  }

  #mountScene() {
    if (!this.#running) return;
    const out = this.#running.querySelector('.cout');
    this.#scenePanel.classList.remove('devstage');            // a real run reclaims the panel from the cheat stage
    const moved = this.#scenePanel.parentElement !== out;
    if (moved) { out.appendChild(this.#scenePanel); this.#revealScene(); }
    this.#scenePanel.classList.remove('frozen');
    const b = this.#scenePanel.querySelector('.burst'); if (b) b.remove();
    // NOTE: lighten()/darken()/sepia() etc. must PERSIST across mountScene()
    // calls — mountScene() runs on every camera ask (watch() inside a while
    // loop calls it every iteration, see onAsk's 'fingers' branch above), not
    // just at a fresh RUN. Resetting screenFx state here would wipe a filter
    // the instant a loop asks watch() again. Reset lives in runCell() instead
    // (the actual fresh-run boundary) — see #resetScreenFx() below.
    this.#scenePanel.querySelector('.vortex').style.opacity = '1';
    this.#scenePanel.querySelector('.result').classList.remove('show');
    // Detaching the panel (rerun clears .cout / it moves cells) PAUSES the
    // <video> — as does the fx freeze — and MediaPipe then analyzes a frozen
    // frame; resume or retries hang.
    const v = this.#scenePanel.querySelector('#cam');
    if (this.#cameraEngine.isReady && v.paused) v.play().catch(() => {});
  }

  // ── worker bridge glue: run / cancel / output ──
  outLine(cls, txt) {
    this.#appendLine(this.#running, cls, txt);
  }
  #appendLine(el, cls, txt) {
    if (!el) return;
    const d = document.createElement('div'); d.className = 'r ' + cls; d.textContent = txt;
    el.querySelector('.cout').appendChild(d);
  }
  // appendOutput(node) — drop an arbitrary DOM node (e.g. the booth's
  // polaroid card) into the running cell's output and scroll it into view.
  appendOutput(node) {
    if (!this.#running) return;
    this.#running.querySelector('.cout').appendChild(node);
    setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }
  #primeRunButton(btn) {
    if (!btn) return;
    if (!btn.dataset) btn.dataset = {};
    if (!btn.dataset.runLabel) btn.dataset.runLabel = (btn.textContent || 'RUN').trim() || 'RUN';
    if (!btn.dataset.rerunLabel) btn.dataset.rerunLabel = btn.dataset.runLabel.toUpperCase().includes('STRIKE') ? 'STRIKE AGAIN' : 'RUN AGAIN';
    if (btn.title && !btn.dataset.runTitle) btn.dataset.runTitle = btn.title;
  }
  #idleRunLabel(btn) {
    this.#primeRunButton(btn);
    const cell = typeof btn.closest === 'function' ? btn.closest('.codecell') : null;
    return cell && cell.classList && cell.classList.contains('done') ? btn.dataset.rerunLabel : btn.dataset.runLabel;
  }
  #restoreRunButton(btn, enabled = this.#bridge.isUp) {
    this.#primeRunButton(btn);
    btn.classList.remove('is-stop'); btn.classList.remove('is-stopping');
    btn.disabled = !enabled;
    btn.textContent = this.#idleRunLabel(btn);
    btn.dataset.runState = enabled ? 'idle' : 'disabled';
    if (btn.dataset.runTitle !== undefined) btn.title = btn.dataset.runTitle;
    if (typeof btn.removeAttribute === 'function') btn.removeAttribute('aria-label');
  }
  #restoreRunButtons(enabled = this.#bridge.isUp) { document.querySelectorAll('.crun').forEach(b => this.#restoreRunButton(b, enabled)); }
  #setRunning(el) {
    this.#running = el;
    const activeBtn = el.querySelector('.crun');
    document.querySelectorAll('.crun').forEach(b => {
      this.#primeRunButton(b);
      b.classList.remove('is-stopping');
      if (b === activeBtn) {
        b.disabled = false;
        b.classList.add('is-stop');
        b.textContent = 'STOP';
        b.dataset.runState = 'stop';
        b.title = 'Stop this run';
        if (typeof b.setAttribute === 'function') b.setAttribute('aria-label', 'Stop running cell');
      } else {
        b.classList.remove('is-stop');
        b.disabled = true;
        b.dataset.runState = 'blocked';
      }
    });
  }
  #markStopping(el) {
    const btn = el && el.querySelector('.crun');
    if (!btn) return;
    this.#primeRunButton(btn);
    btn.classList.add('is-stopping');
    btn.disabled = true;
    btn.textContent = 'STOPPING';
    btn.dataset.runState = 'stopping';
  }
  #stopRunning() {
    const el = this.#running;
    if (!el) return;
    this.#queuedRun = null;
    this.#markStopping(el);
    this.#askGate.cancel(); if (this.#studio && !el._stickyOutput) this.#studio.stop();
    const stopped = !!(this.#bridge.stop && this.#bridge.stop());
    this.#appendLine(el, 't-sys', stopped ? '⏹ đã dừng' : '⏳ đang yêu cầu dừng');
    this.#clearRunning('In [stop]');
    if (!stopped || !el._stopCompletes) return;
    if (el._expectOut && !cellOutputSatisfies(el._expectOut, el._captured || [], el._heldCount)) {
      const hint = expectOutHint(el._expectOut, el._captured || [], el._heldCount) || 'hãy để hoạt ảnh chạy thêm vài frame rồi STOP lại nhé ✦';
      const failure = document.createElement('div'); failure.className = 'r t-sys t-fail'; failure.textContent = hint; el.querySelector('.cout').appendChild(failure); return;
    }
    this.#appendLine(el, 't-sys', 'đã kiểm chứng vòng lặp — STOP hoàn tất project');
    setTimeout(() => this.completeCell(el), 0);
  }
  // BUG FIX (owner 2026-07-04, "camera stops detecting the hand right after
  // the boss's code round"): this used to schedule a blanket
  // cameraEngine.release() on EVERY code-cell finish, unconditionally,
  // "deferred — completeCell/revealNext may arm a gesture gate first". For a
  // BOSS code round (`el._fight`) that's a SECOND, uncoordinated camera
  // manager racing the first: boss-fight.js#armForRound already explicitly
  // releases the camera going INTO a code round and re-acquires it going OUT
  // to the next gesture round. Both timers touch the same shared
  // CameraEngine singleton with no coordination beyond CameraEngine's own
  // "don't release if something still needs it" guard (hasActiveConsumer) —
  // a guard that only helps if the boss's next-round arm has already landed
  // by the time this fixed 1.8s timer fires. Any run of slow frames/first-
  // strike bonus text/etc. nudging that arm past the deadline, and this
  // timer tears the stream/raf loop back down right after the boss just
  // spun it up for the NEXT round — no error, the hand just silently stops
  // being seen. Boss rounds own their camera lifecycle end-to-end; skip this
  // redundant release for them entirely instead of racing it.
  #clearRunning(label) {
    const wasBossRound = !!(this.#running && this.#running._fight);
    if (this.#running) this.#running.querySelector('.inlbl').textContent = label;
    this.#running = null; this.#askGate.clear();
    this.#restoreRunButtons(this.#bridge.isUp);
    if (this.#queuedRun) { const el = this.#queuedRun; this.#queuedRun = null; setTimeout(() => this.runCell(el), 60); } // the run that cancelled the stuck ask
    if (this.#gestureDispatcher.actGateArmed || this.#gestureDispatcher.fingerGateArmed) setTimeout(() => { // a rerun's cast freeze pauses #cam (~2.3s after run end) — an armed gate still needs frames
      if (this.#cameraEngine.isReady) { const v = this.#scenePanel.querySelector('#cam'); if (v.paused && v.srcObject) v.play().catch(() => {}); }
    }, 3200);
    if (!wasBossRound) setTimeout(() => this.#cameraEngine.release(), OUTPUT_DWELL_MS + 400); // deferred — completeCell/revealNext may arm a gesture gate first
  }
  // One Python runtime = one run at a time. If a previous run is still parked
  // on an input (typed prompt / hold-fingers ask), running another cell
  // CANCELS that ask (sentinel unwinds the worker) and this run starts right
  // after — a forgotten rerun must never brick the rest of the notebook.
  runCell(el) {
    if (this.#running === el) { this.#stopRunning(); return; }
    if (!this.#bridge.isUp || !el._editor) return;
    if (this.#running) {
      if (this.#askGate.isArmed) { this.#queuedRun = el; this.#askGate.cancel(); }
      else { this.#toast('⏳ one spell at a time — this cell is still working'); this.#running.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    this.#setRunning(el);
    if (this.#studio) this.#studio.stop();
    const out = el.querySelector('.cout'); out.innerHTML = ''; out.classList.add('live');
    el.querySelector('.inlbl').textContent = 'In [*]';
    el._captured = []; el._heldCount = null;             // reset per-run output/finger-count capture for expectOut validation
    this.#resetScreenFx();                                // a fresh run neutralizes any lighten()/darken()/sepia() etc. left over from a PRIOR run
    this.#bridge.run(el._editor.getValue());
  }
  #resetScreenFx() {
    const l = this.#scenePanel.querySelector('#sclight'); if (l) l.className = '';
    this.#scenePanel.classList.remove('fx-sepia', 'fx-invert', 'fx-gray', 'fx-mirror', 'fx-blur', 'fx-sharpen', 'fx-rotate', 'fx-shake');
  }
  // Inline prompt in the running cell's output (the terminal, Jupyter-style).
  cellAsk(prompt) {
    return new Promise(resolve => {
      const line = document.createElement('div'); line.className = 'r t-askline';
      line.innerHTML = `<span class="t-prompt"></span><input class="tin mono" spellcheck="false" autocomplete="off">`;
      line.firstChild.textContent = prompt;
      this.#running.querySelector('.cout').appendChild(line);
      const inp = line.lastChild; inp.focus({ preventScroll: false });
      inp.onkeydown = e => { if (e.key !== 'Enter') return;
        const v = inp.value; line.className = 'r t-echo'; line.textContent = prompt + v; this.#askGate.clear(); resolve(v); };
      this.#askGate.arm(() => { line.className = 'r t-echo'; line.textContent = prompt; resolve(ASK_CANCEL); });
    });
  }
  // Hold a finger count steady for HOLD_MS, then lock it in (typed fallback
  // if no camera). GRACE: a hand entering the frame reads as ✋5 before the
  // student poses — don't accumulate the hold for the first moment of an ask.
  fingerAsk() {
    const gateBar = this.#scenePanel.querySelector('#scgate').firstElementChild;
    // Hidden expectation: the CELL CONFIG (never the student's code) may
    // carry {expect: n | [n,…]} — only a matching count can lock in, so a
    // flaky read can never derail the exercise.
    const exp = this.#running && this.#running._expect != null ? [].concat(this.#running._expect) : null;
    return new Promise(resolve => {
      let live = true, done = false;                      // cancellable from the very start, even while the camera wakes
      let fxOff = null, bypassOff = null, target = null, fallbackTimer = null;
      const cleanup = () => { if (fxOff) { fxOff(); fxOff = null; } if (bypassOff) { bypassOff(); bypassOff = null; }
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; } };
      this.#askGate.arm(() => { live = false; done = true; cleanup(); this.#gestureDispatcher.disarmFingerGate(); gateBar.style.width = '0%'; resolve(ASK_CANCEL); });
      // Registered here, OUTSIDE cameraEngine.ensure()'s .then() — a Space
      // bypass (and the fingertip-fx mount, harmless either way) must work
      // even with no camera at all, where ensure() never settles.
      fxOff = armFingertipFx(this.#gestureDispatcher, this.#scenePanel, () => exp ? exp.includes(target) : target != null);
      bypassOff = registerBypass('python fingers-ask', () => {
        const v = exp ? exp[0] : (target != null ? target : 3);
        this.#gestureDispatcher.disarmFingerGate(); this.#askGate.clear(); cleanup(); gateBar.style.width = '0%';
        this.#scenePanel.querySelector('#scstat').textContent = 'đã thấy: ' + v;
        this.outLine('t-sys', '👁 thấy ' + v + ' ngón tay  [cheat]'); resolve(String(v));
      });
      this.#cameraEngine.ensure().then(() => {
        if (!live) return;
        const armT = performance.now();
        let held = 0, last = performance.now();
        // Camera opened fine but the pose may just never register (lighting,
        // angle, an unreliable read) — give an escape hatch after a while
        // instead of stranding the student with only a silently-inert Space
        // bypass they'd never discover (that's dev-cheat-panel-gated).
        fallbackTimer = setTimeout(() => {
          if (!live || done) return;
          this.#gestureDispatcher.disarmFingerGate(); gateBar.style.width = '0%';
          this.outLine('t-sys', 'không nhận được dấu tay — gõ số ngón tay vào ô nhé');
          fingerAskStub(this.#scenePanel, exp, this.#askGate, t => this.outLine('t-sys', t)).then(v => {
            if (done) return; done = true; cleanup(); resolve(v); });
        }, FINGER_ASK_FALLBACK_MS);
        this.#gestureDispatcher.armFingerGate((count, has) => {
          const now = performance.now(), dt = now - last; last = now;
          if (now - armT < ASK_GRACE_MS) { this.#scenePanel.querySelector('#scstat').textContent = 'chuẩn bị nhé…'; return; }
          if (!has) { target = null; held = 0; gateBar.style.width = '0%'; return; }
          if (exp && !exp.includes(count)) { target = null; held = 0; gateBar.style.width = '0%';
            this.#scenePanel.querySelector('#scstat').textContent = 'giữ đúng dấu tay nhé…'; return; }
          if (count !== target) { target = count; held = 0; } else held += dt;
          gateBar.style.width = Math.min(100, held / HOLD_MS * 100) + '%';
          if (held >= HOLD_MS) { done = true; this.#gestureDispatcher.disarmFingerGate(); this.#askGate.clear(); cleanup(); gateBar.style.width = '0%';
            this.#scenePanel.querySelector('#scstat').textContent = 'đã thấy: ' + count;
            this.outLine('t-sys', '👁 thấy ' + count + ' ngón tay'); resolve(String(count)); }
        });
      }).catch(() => { if (!live) return;
        this.outLine('t-sys', 'không mở được camera — gõ số ngón tay vào ô nhé'); fingerAskStub(this.#scenePanel, exp, this.#askGate, t => this.outLine('t-sys', t)).then(v => { done = true; cleanup(); resolve(v); }); });
    });
  }

  // Aim a single index finger at a rows x cols grid over the camera panel and
  // return the 1-based cell number. Python entrypoint: camera_charm.aim_cell().
  gridAsk(spec = '3,3') {
    const [rawRows, rawCols] = String(spec).split(',').map(v => parseInt(v, 10));
    const rows = Math.max(1, Math.min(6, rawRows || 3));
    const cols = Math.max(1, Math.min(6, rawCols || 3));
    const maxCell = rows * cols;
    const gateBar = this.#scenePanel.querySelector('#scgate').firstElementChild;
    const hudCount = this.#scenePanel.querySelector('#sccount');
    const hudStat = this.#scenePanel.querySelector('#scstat');
    const grid = document.createElement('div');
    grid.className = 'scgrid';
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const cells = [];
    for (let i = 1; i <= maxCell; i++) {
      const cell = document.createElement('i');
      cell.textContent = i;
      grid.appendChild(cell);
      cells.push(cell);
    }
    this.#scenePanel.appendChild(grid);

    const paint = cell => {
      cells.forEach((el, i) => el.classList.toggle('hot', i + 1 === cell));
      hudCount.textContent = cell || '—';
    };
    const typedFallback = resolve => {
      const ask = this.#scenePanel.querySelector('#scask');
      const label = ask.querySelector('span');
      const inp = ask.querySelector('input');
      const oldLabel = label.textContent, oldMin = inp.min, oldMax = inp.max;
      label.textContent = 'ô:';
      inp.min = '1';
      inp.max = String(maxCell);
      ask.style.display = 'flex';
      inp.value = '';
      inp.focus();
      this.#askGate.arm(() => {
        ask.style.display = 'none';
        inp.onkeydown = null;
        label.textContent = oldLabel;
        inp.min = oldMin;
        inp.max = oldMax;
        resolve(ASK_CANCEL);
      });
      inp.onkeydown = e => {
        if (e.key !== 'Enter') return;
        const v = Math.max(1, Math.min(maxCell, parseInt(inp.value, 10) || 1));
        ask.style.display = 'none';
        inp.onkeydown = null;
        label.textContent = oldLabel;
        inp.min = oldMin;
        inp.max = oldMax;
        this.#askGate.clear();
        this.outLine('t-sys', `🎯 ô ${v}  [gõ phím]`);
        resolve(String(v));
      };
    };

    return new Promise(resolve => {
      let live = true, done = false, target = null, held = 0, last = performance.now();
      let off = null, fallbackTimer = null;
      const cleanup = () => {
        live = false;
        if (off) { off(); off = null; }
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
        grid.remove();
        gateBar.style.width = '0%';
      };
      const finish = cell => {
        if (done) return;
        done = true;
        live = false;
        if (off) { off(); off = null; }
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
        this.#askGate.clear();
        paint(cell);
        const slot = cells[cell - 1];
        if (slot) slot.classList.add('locked');
        hudStat.textContent = `đã chọn ô ${cell}`;
        gateBar.style.width = '100%';
        this.outLine('t-sys', `🎯 ô ${cell}`);
        setTimeout(() => {
          grid.remove();
          gateBar.style.width = '0%';
          resolve(String(cell));
        }, 180);
      };
      this.#askGate.arm(() => { cleanup(); resolve(ASK_CANCEL); });
      off = this.#gestureDispatcher.onLandmarks((lm, has, count) => {
        if (!live || done) return;
        const now = performance.now(), dt = Math.min(100, now - last); last = now;
        if (!has || !lm || count !== 1) {
          target = null; held = 0; paint(null); gateBar.style.width = '0%';
          hudStat.textContent = 'giơ 1 ngón để chỉ vào một ô';
          return;
        }
        const p = gridCellAt(1 - lm[8].x, lm[8].y, rows, cols);
        if (p.cell !== target) { target = p.cell; held = 0; }
        else held += dt;
        paint(p.cell);
        hudStat.textContent = `giữ ô ${p.cell} — hàng ${p.row}, cột ${p.col}`;
        gateBar.style.width = Math.min(100, held / HOLD_MS * 100) + '%';
        if (held >= HOLD_MS) finish(p.cell);
      });
      this.#cameraEngine.ensure().catch(() => {
        if (!live || done) return;
        cleanup();
        this.outLine('t-sys', 'không mở được camera — gõ số ô trên lưới nhé');
        typedFallback(resolve);
      });
      fallbackTimer = setTimeout(() => {
        if (!live || done) return;
        cleanup();
        this.outLine('t-sys', 'không giữ được ô lưới — gõ số ô nhé');
        typedFallback(resolve);
      }, FINGER_ASK_FALLBACK_MS);
    });
  }
}

// cellOutputSatisfies(...) / expectOutHint(...) referenced above are provided
// by cell-validation.js as bare globals (loaded via <script defer> before this
// module — same convention as progress-versioning.js's contentVersion/decideResume).
