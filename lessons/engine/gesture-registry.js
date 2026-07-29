// gesture-registry.js — declarative table of "new" (ARM→CAPTURE) gesture
// verbs, Fingerpose-style: adding a verb (future punch/circle) is ONE entry
// here (a pure capture factory + optional default constants) instead of a
// new hand-written armXGate method in gesture-dispatcher.js. Consumed by:
// gesture-dispatcher.js#armVerbGate (drives the actual gate), boss-fight.js
// (which verbs a boss round may declare), validate-content.mjs (schema's
// allowed-verb list) — all three read GESTURE_VERB_NAMES/GESTURE_VERBS
// instead of hardcoding the verb strings.
import { makeSwipeCapture, makeTrackCapture } from './two-phase-gate.js';

// captureFactory(spec) => capture object (the {reset(),step()} shape
// TwoPhaseGate expects, see two-phase-gate.js). `spec` is whatever the
// caller's armVerbGate() call passes through (e.g. swipe's `axis`, track's
// `getTargets`) — the registry doesn't know the DOM/camera side at all.
// captureLabel — default capture-phase hint (gesture-ui phrasing; callers
// usually pass their own copy via armStatusHandler). quizWired — true once
// quiz-cell.js actually renders/arms this verb for a question: the
// validator only lets content declare a quiz `gesture:` the quiz UI can
// honor, otherwise it'd silently fall back to hold-to-pick at runtime.
export const GESTURE_VERBS = {
  swipe: {
    captureFactory: spec => makeSwipeCapture((spec && spec.axis) || 'any'),
    captureLabel: 'ĐÃ KHOÁ ✓ — QUẸT tay để chọn!',
    quizWired: false,          // only boss rounds render a swipe choice today (boss-fight.js#nextRound)
  },
  track: {
    captureFactory: spec => makeTrackCapture(spec && spec.getTargets),
    captureLabel: 'ĐÃ KHOÁ ✓ — đuổi theo đáp án đúng bằng ngón tay!',
    quizWired: true,           // quiz-cell.js's drifting-target question
  },
};
export const GESTURE_VERB_NAMES = Object.keys(GESTURE_VERBS);       // single source of truth for schema/dispatch — kept in sync by registerVerb

// registerVerb(name, def) — how a future verb (punch/circle/...) ships: one
// declarative call with a pure captureFactory; armVerbGate and the
// validators pick it up with zero dispatcher edits. Throws on duplicates or
// a missing factory so a bad registration fails at load, not at gate time.
export function registerVerb(name, def) {
  if (GESTURE_VERBS[name]) throw new Error(`gesture-registry: verb "${name}" already registered`);
  if (!def || typeof def.captureFactory !== 'function') throw new Error(`gesture-registry: verb "${name}" needs a captureFactory(spec) function`);
  GESTURE_VERBS[name] = def; GESTURE_VERB_NAMES.push(name);
}

// getVerb(name) — throws loudly on an unregistered verb instead of letting
// a typo silently no-op a gate (the failure mode this registry exists to
// prevent: a new verb wired in content but never registered here).
export function getVerb(name) {
  const v = GESTURE_VERBS[name];
  if (!v) throw new Error(`gesture-registry: unknown verb "${name}" — registered: ${GESTURE_VERB_NAMES.join(', ')}`);
  return v;
}
