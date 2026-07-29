// ritual-controller.js — hold the node's gesture at the camera: the vortex
// charges up (--rc drives rings/glow/scene light), then flash + shake + seal.
// Falls back to the press-and-hold button when no camera is available. The
// real particle vortex (ritual-vortex.js, lazy-loaded on first need) is one
// engine shared with the photo booth's mount call shape — opening the ritual
// always (re)mounts it onto the overlay with fresh state.
import { $, sparkBurst } from './dom-scaffold.js';
import { GESTURE_FINGERS, RITUAL_SEC, RITUAL_DECAY, SAGA_KEY, HOLD_SEC, CAMERA_WAIT_MS, RITUAL_CHANT_ARM_MIN, QUIZ_HOLD_MS } from './constants.js';
import { matchWord } from './chant-match.js';
import { HoldChoiceGate } from './gesture-ui.js';
import { telemetry } from './telemetry.js';

// wrong-pick encouragement lines (Pip's voice) — rotates so retrying never
// reads as scolding; a wrong pick NEVER ends the choice phase (see #onChoiceResult).
const CHOICE_RETRY_HINTS = ['chưa đúng đâu, thử lại nào!', 'gần rồi, đoán lại xem nào!', 'không sao, giơ tay chọn lại nhé!'];

export class RitualController {
  #overlayEl; #N; #cameraEngine; #gestureDispatcher; #progressStore; #loadVortex; #onSealed;
  #active = false; #charge = 0; #last = 0; #raf = 0; #count = -1; #has = false; #forced = null; #sealed = false;
  #vfx = null; #holdT = 0; #holdRAF = 0; #holdLast = 0;
  #fingers;
  // concept-chant gate (optional, content: ritual.chant/ritual.chantAccept)
  #chant; #chantAccept; #voice = null; #voiceDown = false; #chantMatched = false;
  // ritual word-choice (KICKOFF-PLAN.md Part B, optional: content ritual.choice)
  // — a pre-seal knowledge check that runs INSIDE the ritual's own frame
  // handler (never armActGate/armMotionGate: the ritual already owns the
  // hand via setRitual, and double-arming those gates throws — see
  // gesture-dispatcher.js's armActGate/armMotionGate invariant).
  #choice; #choiceGate = null; #choiceResolved = false; #choiceEls = null;
  constructor(overlayEl, N, { cameraEngine, gestureDispatcher, progressStore, loadVortex, onSealed }) {
    this.#overlayEl = overlayEl; this.#N = N; this.#cameraEngine = cameraEngine; this.#gestureDispatcher = gestureDispatcher;
    this.#progressStore = progressStore; this.#loadVortex = loadVortex; this.#onSealed = onSealed;
    this.#fingers = N.ritual?.fingers ?? GESTURE_FINGERS[N.ritual?.gesture] ?? 5;
    this.#chant = N.ritual?.chant || null; this.#chantAccept = N.ritual?.chantAccept || [];
    this.#choice = N.ritual?.choice || null;
    $('holdBtn').addEventListener('pointerdown', e => this.holdStart(e));
    addEventListener('pointerup', () => this.holdEnd()); addEventListener('pointercancel', () => this.holdEnd());
  }
  get isActive() { return this.#active; }
  get isSealed() { return this.#sealed; }

  // ritualCellEl() — the notebook's final blocking cell: "BEGIN THE RITUAL",
  // fed into NotebookRunner via setRitualCellFactory (see node.js).
  // RITUAL-MERGE (FORGE-PLAN.md, owner: "thấy vẫn còn ritual"): on a ko-boss
  // node the KO fight IS the seal ritual — same vortex, same phong-ấn FX —
  // so the trailing cell degenerates to a short auto-seal beat instead of a
  // second "BEGIN THE RITUAL" gesture gate. Non-ko nodes keep the full ritual.
  ritualCellEl = () => {
    if ((this.#N.cells || []).some(c => c.boss && c.boss.ko)) {
      const el = document.createElement('div'); el.className = 'ritualcell koseal';
      el.innerHTML = `<div class="rlead">✦ PHONG ẤN ĐÃ KHẮC — cánh cổng kế tiếp đang mở…</div>`;
      el._arm = () => setTimeout(() => this.seal(), 1100);
      return el;
    }
    const el = document.createElement('div'); el.className = 'ritualcell';
    el.innerHTML = `<div class="rlead">Cỗ máy đã thuộc về bạn. Khắc phong ấn để thắp sáng chặng đường nào!</div>
      <button class="cta big" id="ritualBtn">⟡ BẮT ĐẦU NGHI THỨC</button>
      <div class="ghint">☝ giơ MỘT ngón tay để bắt đầu — hoặc bấm nút</div>
      <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>`;
    const btn = el.querySelector('#ritualBtn'); btn.onclick = () => this.open();
    el._arm = () => this.#gestureDispatcher.armActHoldGate(this.#cameraEngine, el.querySelector('.bcam'), 1,
      () => !this.#sealed && this.#overlayEl.classList.contains('gone'),
      p => btn.style.setProperty('--gc', p), () => this.open());
    return el;
  };

  #ensureVortex() {
    return this.#loadVortex().then(() => { if (self.RitualVortex) { this.#vfx = self.RitualVortex.mount(this.#overlayEl, { theme: this.#N.ritual?.theme }); this.#vfx.setCharge(this.#charge); } }); // theme: per-node visual variant (§A), pure pass-through — RitualVortex resolves/validates it
  }
  // 2026-07-04 (owner): SpeechRecognition is DISABLED in the ritual — SR is
  // blocked/locked on the deployment machines, so we never start it, never
  // prompt for the mic, and the caption no longer invites yelling either.
  // forceChant/nodeDev.chant still exercise matchWord for dev/tests.
  #startVoiceIfChant() { this.#voiceDown = true; }
  #stopVoice() { if (this.#voice) { this.#voice.stop(); this.#voice = null; } }
  #onChantMatch() {
    if (this.#sealed || !this.#chant || this.#chantMatched) return;
    if (this.#charge >= RITUAL_CHANT_ARM_MIN) { this.#chantMatched = true; this.#charge = 1; }   // surge to 100% -> seal on next tick
  }
  // 2026-07-04 live test: SR missed a real kid-yelled "say", so the chant is
  // a BONUS, never a gate — the correct sign alone always reaches 100%; a
  // chant hit just surges it instantly (#onChantMatch). Ceiling kept as a
  // seam in case a future chant wants to re-gate.
  #ceiling() { return 1; }
  forceChant(text) {                                      // dev hook: inject a fake transcript through the REAL matcher
    if (!this.#chant) return;
    const t = text ?? this.#chant;
    if (matchWord(t, this.#chant, this.#chantAccept)) this.#onChantMatch(t);
  }

  open() {
    this.#overlayEl.classList.remove('gone');
    if (this.#sealed || this.#active) return;
    this.#ensureVortex();                                 // (re)claims the engine from the booth if Node 1 used it
    this.#startVoiceIfChant();
    const inChoice = this.#choice && !this.#choiceResolved;
    if (inChoice) this.#renderChoiceUI();                 // built immediately (no camera dependency) — tap must work with zero delay
    $('rstat').textContent = inChoice ? '' : 'waking the camera…';
    // A camera permission prompt the player never answers (ignored, or the
    // browser silently blocks it) leaves ensure() pending FOREVER — no
    // resolve, no reject — which used to mean the hold-button fallback never
    // appeared and the ritual looked stuck. Race a hard timeout against it so
    // the fallback always shows up, even if the camera promise later settles.
    let settled = false;
    const noCam = () => {
      // choice phase: tap already works via each option's onclick — no
      // hold-button fallback needed, just a hint. seal phase: unchanged.
      if (this.#choice && !this.#choiceResolved) $('rstat').textContent = 'không có camera — chạm để chọn đáp án nhé';
      else { $('rstat').textContent = 'no camera — press and hold the seal instead'; $('holdBtn').classList.remove('gone'); }
    };
    const giveUp = setTimeout(() => { if (settled || this.#active) return; noCam(); }, CAMERA_WAIT_MS);
    this.#cameraEngine.ensure().then(() => {
      settled = true; clearTimeout(giveUp);
      this.#cameraEngine.videoEl.play().catch(() => {});  // may be paused by an fx freeze
      const rv = $('rcam'); rv.srcObject = this.#cameraEngine.stream; rv.play().catch(() => {});
      this.#active = true;
      if (this.#choice && !this.#choiceResolved) this.#armChoiceFrames(); else this.#beginSeal();
    }).catch(() => { settled = true; clearTimeout(giveUp); noCam(); });
  }
  // ── ritual word-choice (KICKOFF-PLAN.md Part B) ── reuses quiz-cell's
  // .qopt/.qn/.qfill/.qburst/.nope/.yes classes (see node.css's quiz-cell
  // block) so the answer buttons look and animate identically to a quiz
  // question — only the .rchoice/.rcq/.rchint wrapper is new, ritual-themed.
  #renderChoiceUI() {
    if (this.#choiceEls) return;
    const host = document.createElement('div'); host.className = 'rchoice';
    host.innerHTML = `<div class="rcq"></div><div class="qopts"></div><div class="rchint">giơ đúng số ngón tay của đáp án — hoặc chạm</div>`;
    host.querySelector('.rcq').textContent = this.#choice.q;
    const opts = host.querySelector('.qopts');
    this.#choice.a.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'qopt';
      b.innerHTML = `<i class="qn">${i + 1}</i>${t}<b class="qfill"></b>`;
      b.onclick = () => this.#pickChoice(i);
      opts.appendChild(b);
    });
    this.#overlayEl.querySelector('.actin').appendChild(host);
    this.#overlayEl.classList.add('choicephase');
    this.#choiceEls = host;
    this.#choiceGate = new HoldChoiceGate(this.#choice.a.length, this.#choice.correct, QUIZ_HOLD_MS);
  }
  // #armChoiceFrames() — wires the camera's per-frame finger count into the
  // choice gate via the ritual's OWN onFrame handler (setRitual), never
  // armActGate/armMotionGate — the ritual already owns the hand for the
  // whole open()→seal() lifetime, and those two gates are mutually
  // exclusive/throw-on-double-arm (see gesture-dispatcher.js). Tap still
  // resolves independently via each button's onclick either way.
  #armChoiceFrames() {
    this.#gestureDispatcher.setRitual({ onFrame: (count, has) => { this.#count = count; this.#has = has; } });
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(now => this.#choiceStep(now));
  }
  #choiceStep(now) {
    if (this.#choiceResolved || !this.#choiceGate) return;
    const res = this.#choiceGate.step(now, this.#count, this.#has);
    this.#paintChoice();
    if (res) this.#onChoiceResult(res);
    if (!this.#choiceResolved) this.#raf = requestAnimationFrame(n => this.#choiceStep(n));
  }
  #paintChoice() {
    if (!this.#choiceEls) return;
    const btns = this.#choiceEls.querySelectorAll('.qopt');
    const target = this.#choiceGate.target, p = this.#choiceGate.progress;
    btns.forEach((b, i) => { const on = i === target; b.classList.toggle('arm', on);
      b.style.setProperty('--qp', on ? p : 0); b.querySelector('.qfill').style.width = (on ? p * 100 : 0) + '%'; });
  }
  #pickChoice(i) {                                        // tap path — resolves regardless of camera/hold state
    if (this.#choiceResolved || !this.#choiceGate) return;
    const res = this.#choiceGate.pick(i);
    if (res) this.#onChoiceResult(res);
  }
  #onChoiceResult({ idx, ok }) {
    const btns = this.#choiceEls.querySelectorAll('.qopt'); const btn = btns[idx];
    if (!ok) {
      btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');   // shake, retry — never a dead end
      const hint = this.#choiceEls.querySelector('.rchint');
      hint.textContent = CHOICE_RETRY_HINTS[Math.floor(Math.random() * CHOICE_RETRY_HINTS.length)];
      setTimeout(() => { if (!this.#choiceResolved && hint) hint.textContent = 'giơ đúng số ngón tay của đáp án — hoặc chạm'; }, 1400);
      return;
    }
    btn.classList.add('yes'); sparkBurst(this.#choiceEls, btn); this.#choiceResolved = true;
    cancelAnimationFrame(this.#raf);
    setTimeout(() => this.#enterSealPhase(), 620);          // spark/celebration beat, then the unchanged seal phase
  }
  forceChoice(i) {                                          // dev hook: defaults to the correct option
    if (!this.#choice || !this.#choiceGate) return;
    this.#pickChoice(i ?? this.#choice.correct);
  }
  #enterSealPhase() {
    if (this.#choiceEls) { this.#choiceEls.remove(); this.#choiceEls = null; }
    this.#overlayEl.classList.remove('choicephase');
    if (this.#active) this.#beginSeal();
    else { $('rstat').textContent = 'no camera — press and hold the seal instead'; $('holdBtn').classList.remove('gone'); }
  }
  #beginSeal() {
    this.#charge = 0; this.#last = performance.now();
    this.#gestureDispatcher.setRitual({ onFrame: (count, has) => { this.#count = count; this.#has = has; } });
    this.#raf = requestAnimationFrame(now => this.#step(now));
  }
  #step(now) {
    const dt = (now - this.#last) / 1000; this.#last = now;
    const feeding = this.#forced != null ? this.#forced === this.#fingers : (this.#has && this.#count === this.#fingers);
    const sec = RITUAL_SEC;                       // chant is bonus-only (see #ceiling) — hold speed never depends on voice
    const ceiling = this.#ceiling();
    this.#charge = feeding ? Math.min(ceiling, this.#charge + dt / sec)
                           : Math.max(0, this.#charge - dt * RITUAL_DECAY / sec);
    this.#paint(this.#charge, feeding);
    if (this.#charge >= 1) { this.seal(); return; }
    if (this.#active) this.#raf = requestAnimationFrame(n => this.#step(n));
  }
  #paint(c, feeding) {
    this.#overlayEl.style.setProperty('--rc', c);
    if (this.#vfx) this.#vfx.setCharge(c);
    $('rgate').firstElementChild.style.width = c * 100 + '%';
    $('rstat').textContent = feeding
      ? `sealing… ${Math.round(c * 100)}%`
      : `hold ${this.#N.ritual?.gesture || '✋'} steady — feed the vortex`;
  }
  #holdStep(now) {
    this.#holdT += (now - this.#holdLast) / 1000; this.#holdLast = now;
    const sec = HOLD_SEC;                         // same: tap-hold never slowed by a pending chant
    $('holdFill').style.height = Math.min(100, this.#holdT / sec * 100) + '%';
    const c = this.#chantMatched ? 1 : Math.min(this.#ceiling(), this.#holdT / sec);   // the hold drives the same charge the gesture would
    this.#overlayEl.style.setProperty('--rc', c); if (this.#vfx) this.#vfx.setCharge(c);
    if (c >= 1) { this.seal(); return; }
    this.#holdRAF = requestAnimationFrame(n => this.#holdStep(n));
  }
  holdStart(e) { e.preventDefault(); if (this.#sealed || (this.#choice && !this.#choiceResolved)) return; this.#holdLast = performance.now(); this.#holdRAF = requestAnimationFrame(n => this.#holdStep(n)); }
  holdEnd() {
    cancelAnimationFrame(this.#holdRAF);
    if (!this.#sealed) { this.#holdT = 0; $('holdFill').style.height = '0%';
      this.#overlayEl.style.setProperty('--rc', 0); if (this.#vfx) this.#vfx.setCharge(0); }
  }
  forceFingerCount(n) { this.#forced = n; }               // test hook: force a finger count into the ritual

  seal() {
    if (this.#sealed) return; this.#sealed = true; this.#active = false;
    this.#gestureDispatcher.setRitual(null); this.#stopVoice();
    cancelAnimationFrame(this.#raf); cancelAnimationFrame(this.#holdRAF);
    const o = this.#overlayEl; o.style.setProperty('--rc', 1); o.classList.add('sealing');
    if (this.#vfx) this.#vfx.burst();                     // the funnel detonates: embers scatter as the seal lands
    $('rflash').classList.add('go'); $('holdBtn').classList.add('gone'); $('rgate').classList.add('gone');
    $('rstat').textContent = ''; $('rdone').classList.remove('gone');
    const cur = parseInt(localStorage.getItem(SAGA_KEY), 10) || 0;
    const sagaProgress = Math.max(cur, this.#N.index + 1);
    localStorage.setItem(SAGA_KEY, sagaProgress);
    telemetry.courseComplete(this.#N, { completion: 'ritual', sagaProgress });
    this.#progressStore.clear();                          // node finished — the in-node resume checkpoint is now moot
    sessionStorage.setItem('magicdust.sealed', String(this.#N.index)); // the map frames + flashes the next node on arrival
    setTimeout(() => this.#onSealed(), 1800);
  }
}
