// two-phase-gate.js — pure ARM→CAPTURE state machine shared by every "new"
// gesture verb (swipe/track/multi-track): hold ✋=5 steady to ARM (lock on,
// unambiguous "tracking starts now" moment), then a bounded CAPTURE window
// where a pluggable per-verb `capture` object decides when the gesture
// resolves. No DOM/camera/performance.now() here — the caller drives it via
// step(now, frame), clock injected, so this is testable with a fake clock
// and synthetic frames (see test-two-phase-gate.mjs). Extracted from
// gesture-dispatcher.js's armSwipeGate/armTrackGate/armMultiTrackGate, which
// used to copy this exact ARM phase three times.
import { GESTURE_ARM_MS, GESTURE_CAPTURE_MS, TRACK_CATCH_RADIUS, TRACK_HOLD_MS } from './constants.js';
import { detectSwipe, trackDistance, handCentroid } from './gesture-math.js';

const ARM_DECAY = 2.2; // soft decay factor when the arm sign drops — matches armActHoldGate's forgiveness

export class TwoPhaseGate {
  // capture — {reset(), step({lm,has,count}, elapsed, dt) => {done, progress}}:
  // reset() runs every time CAPTURE (re)starts (first entry AND after a
  // timeout re-arm, so per-round state like swipe history or track charge
  // never leaks across attempts); step() runs every capture frame and
  // returns `done` (a non-null resolved value) or null to keep waiting,
  // plus a 0..1 `progress` for onState('capture', progress).
  #capture; #onState; #onDone; #armMs; #captureMs; #armWant;
  #phase = 'arm'; #armHeld = 0; #captureStart = 0; #last = null; #done = false;
  constructor({ capture, onState, onDone, armMs = GESTURE_ARM_MS, captureMs = GESTURE_CAPTURE_MS, armWant = 5 }) {
    this.#capture = capture; this.#onState = onState || (() => {}); this.#onDone = onDone || (() => {});
    this.#armMs = armMs; this.#captureMs = captureMs; this.#armWant = armWant;
  }
  get done() { return this.#done; }
  get phase() { return this.#phase; }

  step(now, frame) {
    if (this.#done) return;                                        // resolved — caller should stop feeding frames (and disarm)
    const dt = this.#last === null ? 0 : Math.min(100, now - this.#last); this.#last = now; // dt clamp: a paused tab / dropped frames must not dump a huge charge at once
    const { lm = null, has = false, count = 0 } = frame || {};
    if (this.#phase === 'arm') {
      this.#armHeld = (has && count === this.#armWant) ? this.#armHeld + dt : Math.max(0, this.#armHeld - dt * ARM_DECAY);
      this.#onState('arm', Math.min(1, this.#armHeld / this.#armMs));
      if (this.#armHeld >= this.#armMs) { this.#phase = 'capture'; this.#captureStart = now; this.#capture.reset(); this.#onState('capture', 0); }
      return;
    }
    const elapsed = now - this.#captureStart;
    const { done, progress } = this.#capture.step({ lm, has, count }, elapsed, dt);
    if (done !== null && done !== undefined) { this.#done = true; this.#onDone(done); return; }
    this.#onState('capture', Math.min(1, progress));
    if (elapsed >= this.#captureMs) { this.#phase = 'arm'; this.#armHeld = 0; this.#capture.reset(); this.#onState('timeout', 0); } // soft retry, no penalty
  }
}

// makeSwipeCapture(axis) — swipe verb: push the fingertip (landmark 8,
// mirrored screen space) into a rolling history each frame and ask
// gesture-math.js#detectSwipe; progress is just elapsed/captureMs since
// there's nothing to accumulate. Uses `elapsed` (time since capture start,
// not wall-clock) as the sample timestamp — detectSwipe only cares about
// relative deltas, so this keeps the capture object clock-free too.
export function makeSwipeCapture(axis = 'any', captureMs = GESTURE_CAPTURE_MS) {
  let history = [];
  return {
    reset() { history = []; },
    step({ lm, has }, elapsed) {
      if (has && lm) { history.push({ x: 1 - lm[8].x, y: lm[8].y, t: elapsed }); if (history.length > 30) history.shift(); }
      return { done: detectSwipe(history, axis) || null, progress: elapsed / captureMs };
    },
  };
}

// makeTrackCapture(getTargets) — track/multi-track verb: getTargets() =>
// [{key,x,y}, ...] (armTrackGate's single-target case is just a 1-entry
// list). Each target accumulates its OWN charge while the tracked point sits
// within catchRadius of it (soft-decays otherwise); a lost hand decays ALL
// targets — so hopping between targets, or losing tracking, can never leak
// charge into the right answer. Resolves with whichever target's charge
// first reaches holdMs. Tracked point is the WHOLE-HAND centroid
// (gesture-math.js#handCentroid), not a single fingertip — see that
// function's comment for why (a lone fingertip's jitter was swallowing
// small, deliberate hover motions). Mirrored the same way as lm[8] was
// (1-x) since handCentroid averages raw (unmirrored) landmark x's.
export function makeTrackCapture(getTargets, holdMs = TRACK_HOLD_MS, catchRadius = TRACK_CATCH_RADIUS) {
  let held = new Map();
  return {
    reset() { held = new Map(); },
    step({ lm, has }, elapsed, dt) {
      const targets = getTargets();
      if (!has || !lm) {
        for (const t of targets) held.set(t.key, Math.max(0, (held.get(t.key) || 0) - dt * ARM_DECAY));
        return { done: null, progress: 0 };
      }
      const c = handCentroid(lm); const fx = 1 - c.x, fy = c.y; let bestP = 0, doneKey = null;
      for (const t of targets) {
        const d = trackDistance(fx, fy, t.x, t.y);
        const prev = held.get(t.key) || 0;
        const next = d <= catchRadius ? prev + dt : Math.max(0, prev - dt * ARM_DECAY);
        held.set(t.key, next); bestP = Math.max(bestP, next / holdMs);
        if (next >= holdMs && doneKey === null) doneKey = t.key;
      }
      return { done: doneKey, progress: bestP };
    },
  };
}
