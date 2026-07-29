// gesture-dispatcher.js — single onHands() entry point for every camera
// frame, fanning it out to whichever hand-consumer currently owns it. The
// priority order below is load-bearing — preserved EXACTLY from the
// pre-split node.js onHands():
//   1. ritual active            → forward to the ritual's frame handler, return
//   2. act-gate armed (idle)    → call actGate(count, has), return
//   3. scene panel frozen       → return, no HUD update
//   4. booth summon + open palm → emit a pour effect (falls through, no return)
//   5. paint the HUD
//   6. finger-gate armed        → call fingerGate(count, has)
import { countFingers, pickClosestHand, thumbMetrics, isShaka } from './camera-engine.js';
import { ACT_HOLD_MS, LM_SMOOTH_ALPHA, GESTURE_HOLD_MS } from './constants.js';
import { TwoPhaseGate } from './two-phase-gate.js';
import { getVerb } from './gesture-registry.js';
import { armFingertipFx } from './gesture-ui.js';
import { smoothLandmarks, handCentroid } from './gesture-math.js';

const CATCH_DEBOUNCE_MS = 120;   // a momentary flicker of the right count still needs to hold this long — filters noise, not a real "charge"

// revealChipWhenReady(v, chip) — every gate below did `chip.classList.add('on')`
// the instant cameraEngine.ensure() resolved, which only means the SHARED
// stream/pipeline is up — this chip's OWN <video> (srcObject just assigned)
// still has to buffer its first frame. On a warm camera (already flowing for
// an earlier cell) that's instant and invisible; on a COLD reconnect/resume
// (fresh page load, ensure() itself already took seconds) the chip — now
// promoted fullscreen by node.css's ".xxxcell .bcam" rule — popped in as a
// raw black rectangle for a beat while the cell's own prompt text was still
// mid-typewriter, reading as a jarring race (owner: "camera hiện lên, chưa
// xong nhưng chữ vẫn tiếp tục chạy"). Wait for the chip's own video to have
// an actual frame (readyState>=2 / 'loadeddata') before revealing it.
function revealChipWhenReady(v, chip) {
  // v.readyState == null → not a real <video> (a test's minimal mock, which
  // doesn't track buffering) — reveal immediately, same as the old behavior;
  // real <video> elements always report a number here, so only THOSE get
  // gated on an actual frame below.
  if (v.readyState == null || v.readyState >= 2) { chip.classList.add('on'); return; }
  // Property assignment (not addEventListener) — some call sites are driven
  // through fake/minimal <video> mocks in tests that don't implement
  // addEventListener; assigning .onloadeddata never throws on a plain object,
  // so a mock that never fires it just means the chip reveals a beat "late"
  // in that harness, not a swallowed exception that silently kills the gate.
  v.onloadeddata = () => chip.classList.add('on');
}

export class GestureDispatcher {
  #isRunning; #frozenCheck; #boothSummon; #boothEmit; #hud;
  #ritual = null;         // {onFrame(count, has)} | null — set by RitualController
  #actGate = null;        // (count, has) => void
  #fingerGate = null;     // (count, has) => void
  #motionGate = null;     // (lm, has, count) => void — raw landmarks, for swipe/track gates
  #landmarkObservers = []; // (lm, has, count) => void — PASSIVE taps, never consume, see onLandmarks()
  #smoothed = null;       // running EMA landmark array (gesture-math.js#smoothLandmarks) — null while no hand is seen
  #tip = null;            // last smoothed hand CENTROID (all 21 landmarks, see gesture-math.js#handCentroid), mirrored normalized [0,1] — see get lastFingertip()
  #lastRaw = null;        // last RAW (unsmoothed) landmark array — for the thumb-trace diagnostic hook
  constructor({ isRunning, frozenCheck, boothSummon, boothEmit, hud }) {
    this.#isRunning = isRunning; this.#frozenCheck = frozenCheck;
    this.#boothSummon = boothSummon; this.#boothEmit = boothEmit; this.#hud = hud;
    // Real-webcam thumb tuning hook (owner kept hitting the narrow thumb
    // detection band). Hold the pose that misdetects, then in the devtools
    // console: __thumbTrace('label'). It logs + accumulates the exact
    // thumbMetrics (spread / abductCos / farFromPinky / thumbUp) of the last
    // seen hand into window.__thumbTraces, which can be copied out and pasted
    // back here to lock THUMB_SPREAD_MIN / THUMB_INDEX_COS_MAX to real data.
    if (typeof window !== 'undefined') { window.__thumbTraces = window.__thumbTraces || []; window.__thumbTrace = (label = '') => { if (!this.#lastRaw) { console.warn('__thumbTrace: no hand seen this frame — hold the pose in view first'); return null; } const m = thumbMetrics(this.#lastRaw); const rec = { label, ...m, count: countFingers(this.#lastRaw) }; window.__thumbTraces.push(rec); console.log('[thumbTrace]', rec); return rec; }; }
  }
  setRitual(handlers) { this.#ritual = handlers; }
  // act gate and motion gate are mutually exclusive — a cell arms ONE verb
  // tier or the other (see onHands' priority ladder), never both at once.
  // Arming one while the other is still armed is a caller bug (forgot to
  // disarm the previous question/round's gate) — throw loudly instead of
  // letting one silently shadow the other. armFingerGate is a separate tier
  // (fires alongside neither) and is NOT part of this invariant.
  armActGate(fn) { if (this.#motionGate) throw new Error('armActGate: motion gate already armed — disarm it first'); this.#actGate = fn; }
  disarmActGate() { this.#actGate = null; }
  armFingerGate(fn) { this.#fingerGate = fn; }
  disarmFingerGate() { this.#fingerGate = null; }
  armMotionGate(fn) { if (this.#actGate) throw new Error('armMotionGate: act gate already armed — disarm it first'); this.#motionGate = fn; }
  disarmMotionGate() { this.#motionGate = null; }
  get actGateArmed() { return !!this.#actGate; }
  get fingerGateArmed() { return !!this.#fingerGate; }
  get motionGateArmed() { return !!this.#motionGate; }
  // lastFingertip — {x,y} normalized [0,1] mirrored screen space (same space
  // as trackPos()/detectSwipe's history), or null if no hand is currently
  // seen. Reads the SAME smoothed whole-hand CENTROID the fingertip-fx dot
  // and the track hit-test math use (see gesture-math.js#handCentroid) — for
  // juice that wants to react to "where is the tracked point right now"
  // without re-subscribing to onLandmarks (e.g. quiz-cell.js's track-chip
  // proximity magnetism). Name kept as "fingertip" for the public API (no
  // call site needed to change), even though the point is now a centroid.
  get lastFingertip() { return this.#tip; }
  hasActiveConsumer() { return this.#isRunning() || !!this.#actGate || !!this.#fingerGate || !!this.#motionGate || !!this.#ritual; }

  // onLandmarks(fn) — PASSIVE per-frame observer, fn(lm, has, count), called
  // on EVERY frame regardless of which consumer (if any) owns the ladder —
  // for the fingertip-fx overlay (gesture-ui.js), which must draw whether a
  // gate is armed or not. Never consumes, never alters the ladder: fires
  // first thing in onHands, before the priority ladder below. A throwing
  // observer must not break the ladder for anyone else — caught and logged,
  // not rethrown. Returns an unsubscribe function.
  onLandmarks(fn) { this.#landmarkObservers.push(fn); return () => { this.#landmarkObservers = this.#landmarkObservers.filter(f => f !== fn); }; }

  // armActHoldGate(cameraEngine, chip, want, alive, onProgress, onDone, opts) —
  // the shared "hold N fingers steady" gate used by act transitions (splash
  // enter, gift/bundle open, ritual begin): soft-decays if the sign is
  // dropped so a brief slip doesn't reset the whole charge. Automatically
  // arms the fingertip-fx overlay (gesture-ui.js#armFingertipFx) over `chip`
  // for the gate's whole lifetime and disarms it on every exit path (done,
  // camera lost) — so no call site has to remember to wire it itself.
  // opts.noFingertipFx: true skips this (escape hatch for a future site that
  // must not show it; no such site exists today).
  armActHoldGate(cameraEngine, chip, want, alive, onProgress, onDone, opts = {}) {
    cameraEngine.ensure().then(() => {
      if (!alive()) return;
      const v = chip.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
      revealChipWhenReady(v, chip);
      const fill = chip.querySelector('.bgauge i');
      let held = 0, last = performance.now(), matching = false;
      let fxOff = opts.noFingertipFx ? null : armFingertipFx(this, chip, () => matching);
      const disarmFx = () => { if (fxOff) { fxOff(); fxOff = null; } };
      this.armActGate((count, has) => {
        if (!alive()) { this.disarmActGate(); chip.classList.remove('on'); disarmFx(); return; }
        const now = performance.now(), dt = Math.min(100, now - last); last = now; // cap: a pause (running cell owns the hand) must not dump a huge dt
        matching = !!(has && count === want);
        held = matching ? held + dt : Math.max(0, held - dt * 2.2); // soft decay — dropping the sign relaxes the charge
        const p = Math.min(1, held / ACT_HOLD_MS);
        fill.style.width = p * 100 + '%'; onProgress(p);
        if (held >= ACT_HOLD_MS) { this.disarmActGate(); chip.classList.remove('on'); disarmFx(); onDone(); }
      });
    }).catch(() => {});                                 // no camera → button/tap only, chip never shows
  }

  // armTimedCatchGate(cameraEngine, chip, want, alive, onCatch, opts) — fires
  // the MOMENT the sign is held (debounced ~120ms against noise), not after a
  // long charge — for rhythm-style "catch it now" gates (gift claim) where
  // WHEN you sign matters, not how long. onCatch receives no args; the
  // caller reads its own timing state (e.g. a ring's current phase) to grade
  // the catch — this gate only tells you the moment of intent. Auto-arms/
  // disarms fingertip fx same as armActHoldGate; opts.noFingertipFx opts out.
  armTimedCatchGate(cameraEngine, chip, want, alive, onCatch, opts = {}) {
    cameraEngine.ensure().then(() => {
      if (!alive()) return;
      const v = chip.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
      revealChipWhenReady(v, chip);
      let held = 0, last = performance.now(), matching = false;
      let fxOff = opts.noFingertipFx ? null : armFingertipFx(this, chip, () => matching);
      const disarmFx = () => { if (fxOff) { fxOff(); fxOff = null; } };
      this.armActGate((count, has) => {
        if (!alive()) { this.disarmActGate(); chip.classList.remove('on'); disarmFx(); return; }
        const now = performance.now(), dt = Math.min(100, now - last); last = now;
        matching = !!(has && count === want);
        held = matching ? held + dt : 0;             // no soft decay here — a miss just resets, the ring keeps looping regardless
        if (held >= CATCH_DEBOUNCE_MS) { this.disarmActGate(); chip.classList.remove('on'); disarmFx(); onCatch(); }
      });
    }).catch(() => {});
  }

  // armShakaHoldGate(cameraEngine, chip, alive, onProgress, onDone, opts) — the
  // 🤙 thumb+pinky "shaka" hold gate (badge claim, see gift-cell.js's badge
  // variant + FORGE-PLAN.md/README.md): held steady for GESTURE_HOLD_MS
  // (constants.js, 700ms — same tier as the photo-booth sign holds), soft-
  // decaying like armActHoldGate so a brief slip doesn't reset the whole
  // charge. Needs raw landmarks (isShaka reads the full hand shape, not just
  // a finger count) so it rides the MOTION gate tier, not the act-gate one —
  // mutually exclusive with armMotionGate's other users, which is fine since
  // no cell arms both at once. Auto-arms/disarms fingertip fx like the other
  // gates; opts.noFingertipFx opts out.
  armShakaHoldGate(cameraEngine, chip, alive, onProgress, onDone, opts = {}) {
    cameraEngine.ensure().then(() => {
      if (!alive()) return;
      const v = chip.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
      revealChipWhenReady(v, chip);
      const fill = chip.querySelector('.bgauge i');
      let held = 0, last = performance.now(), matching = false;
      let fxOff = opts.noFingertipFx ? null : armFingertipFx(this, chip, () => matching);
      const disarmFx = () => { if (fxOff) { fxOff(); fxOff = null; } };
      this.armMotionGate((lm, has) => {
        if (!alive()) { this.disarmMotionGate(); chip.classList.remove('on'); disarmFx(); return; }
        const now = performance.now(), dt = Math.min(100, now - last); last = now;
        matching = !!(has && lm && isShaka(lm));
        held = matching ? held + dt : Math.max(0, held - dt * 2.2);
        const p = Math.min(1, held / GESTURE_HOLD_MS);
        fill.style.width = p * 100 + '%'; onProgress(p);
        if (held >= GESTURE_HOLD_MS) { this.disarmMotionGate(); chip.classList.remove('on'); disarmFx(); onDone(); }
      });
    }).catch(() => {});                                 // no camera → button/tap only, chip never shows
  }

  // BUG FIX (owner 2026-07-04, "camera stops detecting the hand partway
  // through a node"): camera-engine.js's send loop wraps `hands.send()` in a
  // try/catch that treats ANY exception — including one thrown synchronously
  // out of THIS callback — as "a dropped frame is fine" and swallows it
  // forever. Worse, the watchdog heartbeat (`#lastResult`) is stamped by
  // camera-engine BEFORE calling this handler, so it keeps ticking even while
  // every frame throws — the watchdog never notices anything is wrong. Net
  // effect: one uncaught throw anywhere in the priority ladder (a gate
  // callback with a stale/out-of-range read, a hud fn, etc.) permanently
  // blinds every consumer with no recovery and no visible error, until the
  // whole cell/page reloads. Every stage below is now individually
  // try/caught (matching the landmark-observer loop's existing pattern) so a
  // single bad frame/consumer logs and is skipped, instead of taking the
  // entire gesture pipeline down for the rest of the session.
  onHands = res => {
    let lm = null, has = false, count = 0;
    try {
      const handList = res.multiHandLandmarks || [];
      has = handList.length > 0;
      // camera-engine.js now detects up to 2 hands (maxNumHands:2) — pick the
      // one CLOSEST to camera (largest apparent handSize) ONCE, right here, so
      // count/centroid/FX all agree on the same single "the hand" every frame
      // instead of each independently guessing which of N raw hands to read.
      const rawLm = has ? pickClosestHand(handList) : null;
      has = has && !!rawLm;                                   // pickClosestHand can legitimately return null (empty list); don't treat that as a hand
      this.#lastRaw = rawLm;                                  // stash for the __thumbTrace diagnostic hook (raw, pre-smooth — same landmarks countFingers/thumbUp decide on)
      count = has ? countFingers(rawLm) : 0;                  // finger-count math wants the RAW landmarks (extension thresholds), not smoothed lag
      // Smooth ONCE here and hand the SAME smoothed array to every consumer
      // below (fingertip-fx dot, swipe/track hit-test) — smoothing only one of
      // them would let the visible dot and the actual hit-test point disagree.
      this.#smoothed = has ? smoothLandmarks(this.#smoothed, rawLm, LM_SMOOTH_ALPHA) : null;
      lm = this.#smoothed;
      this.#tip = has && lm ? (c => ({ x: 1 - c.x, y: c.y }))(handCentroid(lm)) : null;
    } catch (e) { console.error('gesture-dispatcher: hand read/smooth threw — treating frame as no-hand', e); lm = null; has = false; count = 0; this.#tip = null; }
    for (const fn of this.#landmarkObservers) { try { fn(lm, has, count); } catch (e) { console.error('gesture-dispatcher: onLandmarks observer threw', e); } }
    if (this.#ritual) { try { this.#ritual.onFrame(count, has); } catch (e) { console.error('gesture-dispatcher: ritual onFrame threw', e); } return; } // the ritual owns the hand
    if (this.#actGate && !this.#isRunning()) { try { this.#actGate(count, has); } catch (e) { console.error('gesture-dispatcher: actGate threw', e); } return; } // a RUNNING cell's camera ask outranks an armed act gate
    if (this.#motionGate && !this.#isRunning()) { try { this.#motionGate(lm, has, count); } catch (e) { console.error('gesture-dispatcher: motionGate threw', e); } return; } // same tier as actGate — a cell arms one or the other, never both
    if (this.#frozenCheck()) return;                                        // the moment is sealed — no live HUD
    if (this.#boothSummon() && has && count === 5) {                       // conjure armed: an open palm POURS dust from the hand
      try { this.#boothEmit(1 - lm[9].x, lm[9].y, 5); } catch (e) { console.error('gesture-dispatcher: boothEmit threw', e); }
    }
    try { this.#hud(count, has); } catch (e) { console.error('gesture-dispatcher: hud threw', e); }
    if (this.#fingerGate) { try { this.#fingerGate(count, has); } catch (e) { console.error('gesture-dispatcher: fingerGate threw', e); } }
  };

  // armVerbGate(verb, cameraEngine, chip, spec, alive, onState, onDone) —
  // the ONE registry-driven entry point for every ARM→CAPTURE gesture verb
  // (see gesture-registry.js — adding a verb is a registry entry, not a new
  // method here). TWO-PHASE: (1) ARM — hold ✋ open palm steady for
  // GESTURE_ARM_MS: an unambiguous "locked on, tracking starts now" moment
  // (fixes the old failure mode where continuous detection never told the
  // student whether to hold or move, or whether the camera even saw them).
  // (2) CAPTURE — a bounded GESTURE_CAPTURE_MS window where the verb's
  // capture object (built by its registry captureFactory from `spec`, e.g.
  // swipe's {axis} or track's {getTargets}) decides when the gesture
  // resolves. onState(phase, progress) fires every frame for UI
  // ('arm'|'capture'|'timeout'); onDone(value) fires once with the
  // capture's resolved value. A capture timeout just re-arms — soft retry,
  // no penalty, same forgiving posture as armActHoldGate's decay. Auto-arms/
  // disarms fingertip fx (success state = currently in the CAPTURE phase);
  // opts.noFingertipFx opts out (no site needs this today).
  armVerbGate(verb, cameraEngine, chip, spec, alive, onState, onDone, opts = {}) {
    const capture = getVerb(verb).captureFactory(spec);   // resolve BEFORE the async ensure — a typo'd verb throws at the call site, not inside a swallowed promise
    cameraEngine.ensure().then(() => {
      if (!alive()) return;
      const v = chip.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
      revealChipWhenReady(v, chip);
      let phase = 'arm';
      let fxOff = opts.noFingertipFx ? null : armFingertipFx(this, chip, () => phase === 'capture');
      const disarmFx = () => { if (fxOff) { fxOff(); fxOff = null; } };
      const gate = new TwoPhaseGate({
        capture, onState: (ph, p) => { phase = ph; onState(ph, p); },
        onDone: val => { this.disarmMotionGate(); chip.classList.remove('on'); disarmFx(); onDone(val); },
      });
      this.armMotionGate((lm, has, count) => {
        if (!alive()) { this.disarmMotionGate(); chip.classList.remove('on'); disarmFx(); return; }
        gate.step(performance.now(), { lm, has, count });
      });
    }).catch(() => {});                                   // no camera → caller's tap fallback only
  }

  // The three original named gates live on as one-line delegating aliases —
  // public API pinned across the registry refactor, callers never changed.
  // armSwipeGate — onDone(dir): fingertip trail (landmark 8) resolves a swipe
  // direction via gesture-math.js#detectSwipe, optionally axis-locked.
  armSwipeGate(cameraEngine, chip, alive, onState, onDone, axis = 'any') { this.armVerbGate('swipe', cameraEngine, chip, { axis }, alive, onState, onDone); }
  // armMultiTrackGate — onDone(key): getTargets() => [{key,x,y}, ...] offers
  // MULTIPLE drifting targets; each accumulates its OWN charge while the
  // fingertip sits within TRACK_CATCH_RADIUS (soft-decays otherwise), so
  // resting on the wrong one never secretly helps the right one; first to
  // TRACK_HOLD_MS wins — how a "chase the moving right answer" quiz question
  // resolves, right OR wrong (see quiz-cell.js).
  armMultiTrackGate(cameraEngine, chip, getTargets, alive, onState, onDone) { this.armVerbGate('track', cameraEngine, chip, { getTargets }, alive, onState, onDone); }
  // armTrackGate — single-target track (a 1-entry target list); onDone()
  // takes no args, like the old hand-written gate.
  armTrackGate(cameraEngine, chip, getTargetPos, alive, onState, onDone) {
    this.armVerbGate('track', cameraEngine, chip, { getTargets: () => { const p = getTargetPos(); return [{ key: 'target', x: p.x, y: p.y }]; } }, alive, onState, () => onDone());
  }
}
