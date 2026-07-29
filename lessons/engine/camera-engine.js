// camera-engine.js — sole owner of the shared webcam stream + MediaPipe Hands
// pipeline. No MediaPipe Camera driver (its stop() left a zombie frame loop,
// and two loops feeding hands.send() concurrently kills landmark detection
// while the video still looks live): a single rAF loop, skipping while a send
// is in flight (never re-entrant) and while the video is paused (the fx
// freeze pauses it on purpose). release() kills the loop + stops tracks (LED
// off) when nothing needs the hand; tracks-only, so a frozen frame stays
// visible. A re-acquired camera is a NEW stream — syncViews() repoints every
// live chip/overlay video at it.
import { FT_EXT, TH_RATIO, HANDS_MODEL_COMPLEXITY, THUMB_SPREAD_MIN, THUMB_INDEX_COS_MAX } from './constants.js';

// CAPTURE_W/H — the getUserMedia() capture resolution requested below.
// Exported so gesture-ui.js's fingertip-fx painter can map normalized
// landmarks through the SAME source aspect the video actually is, instead
// of assuming the canvas's own w×h (see gesture-math.js#coverMap).
export const CAPTURE_W = 480, CAPTURE_H = 360;

// loadScript(src) — keyed on `self.__mdScriptLoads` (not a local/module
// variable) so it's a PAGE-WIDE dedupe, not just a per-instance one. Several
// independent, non-cooperating loaders exist for the same MediaPipe CDN
// scripts (this file's own CameraEngine, plus the legacy onboard.js/lesson.js
// onboarding flows, which predate this refactor and load hands.js themselves)
// — each used to only check `!self.Hands` right before its own `await`, with
// no cross-file coordination, so two callers racing (e.g. the map's onboard
// flow + a CameraEngine both cold-starting around the same time) could both
// see it undefined and inject the SAME <script src> twice. MediaPipe's bundle
// is UMD/AMD (`define(...)`), and Monaco's loader.js (present on every lesson
// page) installs a real AMD loader — executing the same AMD script twice
// throws "Can only have one anonymous define call per script file" and takes
// MediaPipe down for the rest of that page (owner: "lâu lâu hay gặp làm cho
// mediapipe bị chết"). Caching the in-flight/settled promise by URL on `self`
// makes every caller — regardless of file — converge on the ONE actual
// injection. onboard.js/lesson.js should be updated to call this too; until
// then this at least makes the actively-used lesson path (this file) safe
// against racing whichever of them fires.
function loadScript(src) {
  self.__mdScriptLoads ||= {};
  return self.__mdScriptLoads[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
// handSize — wrist(0)→mid-MCP(9) distance, exported: doubles as the "how big
// does this hand look to the camera" metric pickClosestHand uses (bigger
// apparent hand = physically closer to the lens, all else equal).
export function handSize(lm) { return Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || .001; }
export function handAngleDegrees(lm) {
  return Math.atan2(lm[9].y - lm[0].y, lm[9].x - lm[0].x) * 180 / Math.PI + 90;
}
function extFinger(lm, pip, tip) { const h = handSize(lm); return Math.max(0, Math.min(1, ((lm[pip].y - lm[tip].y) / h) * 4.5)); }
// thumbUp(lm) — BUG FIX (owner: "giơ 1 nó không nhận" — holding just the
// index finger for a node06 exercise wasn't registering as count===1). Root
// cause: the original check ONLY compared the thumb tip(4)/IP(2)'s distance
// to the pinky MCP(17) — but on a natural "index-only" hand (thumb curled
// IN, resting across the front of the folded middle/ring/pinky, which is
// the common way people make this sign), the tip ends up FARTHER from
// landmark 17 than the IP joint is, even though the thumb never left the
// palm — a false "extended" read that inflates a real 1-finger hold to a
// reported 2 (index + phantom thumb), so any exact `count===1`/`expect:1`
// check downstream (boss rounds, code-cell finger asks) fails. A genuinely
// extended thumb doesn't just drift from the pinky side — it sticks OUT
// away from the whole hand, i.e. away from the index MCP(5) too. Requiring
// BOTH conditions (still checked pairwise so a rotated/mirrored hand stays
// robust) filters the curled-across-palm false positive while a real
// open/spread thumb (bigger tip-to-index-MCP spread, scaled by handSize)
// still passes. See test-camera-engine.mjs for the synthetic repro.
// thumbAbductCos — cosine of the angle between the thumb direction (CMC 1 →
// TIP 4) and the index direction (MCP 5 → TIP 8). Orientation-INVARIANT: a
// real extended thumb splays away from the index (wide angle → LOW cosine);
// a thumb curled across the palm points roughly along the fingers (narrow
// angle → HIGH cosine). This is the SECOND, independent discriminator that
// the lateral-spread metric alone couldn't provide (both a curled-across and
// an open thumb can be near-straight and both clear the pinky guard, so
// spread was the only separator and its valid band was painfully narrow —
// owner kept hitting the dead zone: too strict → "ngón cái không bắt được",
// too loose → "giơ 1 nó nhận thành 2").
function thumbAbductCos(lm) { const tx = lm[4].x - lm[1].x, ty = lm[4].y - lm[1].y, ix = lm[8].x - lm[5].x, iy = lm[8].y - lm[5].y; return (tx * ix + ty * iy) / ((Math.hypot(tx, ty) || 1e-6) * (Math.hypot(ix, iy) || 1e-6)); }
function thumbUp(lm) {
  const px = lm[17].x, py = lm[17].y;
  const farFromPinkyBase = Math.hypot(lm[4].x - px, lm[4].y - py) > Math.hypot(lm[2].x - px, lm[2].y - py) * TH_RATIO;
  if (!farFromPinkyBase) return false;
  // Extended if EITHER signal fires (OR, not AND) — gives a real thumb two
  // easy paths to be counted (a laterally-spread thumb, OR one splayed at a
  // wide angle from the index even if the 2D lateral projection is short),
  // while the curled-across-palm false positive fails BOTH (small spread AND
  // narrow angle). See test-camera-engine.mjs for the fixture separation.
  const spread = Math.hypot(lm[4].x - lm[5].x, lm[4].y - lm[5].y) / handSize(lm) >= THUMB_SPREAD_MIN;
  const splayed = thumbAbductCos(lm) <= THUMB_INDEX_COS_MAX;
  return spread || splayed;
}
// thumbMetrics(lm) — diagnostics for real-webcam tuning (consumed by the
// dispatcher's window.__thumbTrace hook): the exact numbers thumbUp() decides
// on, so a misdetected real hand can be captured and the thresholds locked to
// actual camera data instead of synthetic fixtures. Not used in the hot path.
export function thumbMetrics(lm) { const px = lm[17].x, py = lm[17].y; return { spread: Math.hypot(lm[4].x - lm[5].x, lm[4].y - lm[5].y) / handSize(lm), abductCos: thumbAbductCos(lm), farFromPinky: Math.hypot(lm[4].x - px, lm[4].y - py) / (Math.hypot(lm[2].x - px, lm[2].y - py) || 1e-6), thumbUp: thumbUp(lm) }; }
// isShaka(lm) — thumb+pinky "shaka"/🤙 sign: thumb OUT (thumbUp) AND pinky
// extended AND the middle three (index/middle/ring) curled. Composed from the
// SAME per-finger primitives countFingers already uses (extFinger/thumbUp) —
// no new landmark-math stack. Used by the badge-claim gesture (gift-cell.js's
// badge variant, see FORGE-PLAN.md/README.md) instead of the ring-catch
// high-five. Pure/no DOM, unit-testable — see test-camera-engine.mjs.
export function isShaka(lm) {
  if (!thumbUp(lm)) return false;
  if (extFinger(lm, 18, 20) <= FT_EXT) return false; // pinky must be out
  if (extFinger(lm, 6, 8) > FT_EXT) return false;    // index curled
  if (extFinger(lm, 10, 12) > FT_EXT) return false;  // middle curled
  if (extFinger(lm, 14, 16) > FT_EXT) return false;  // ring curled
  return true;
}
export function countFingers(lm) { let n = 0;
  if (extFinger(lm, 6, 8) > FT_EXT) n++; if (extFinger(lm, 10, 12) > FT_EXT) n++;
  if (extFinger(lm, 14, 16) > FT_EXT) n++; if (extFinger(lm, 18, 20) > FT_EXT) n++;
  if (thumbUp(lm)) n++; return n; }
// extendedFingerTips(lm) — which of the 5 fingertip landmarks (4/8/12/16/20)
// are ACTUALLY extended right now, using the exact same per-finger checks
// countFingers sums up. Consumed by gesture-ui.js's FingertipFxPainter so the
// fingertip FX lights up only the finger(s) really held up (a 1-finger hold
// gate naturally shows one dot, not five) instead of always drawing all 5 —
// no separate "required count" needs to be threaded in from each gate/call
// site, the camera's own read of the hand IS the answer.
const TIP_FOR_FINGER = [[6, 8], [10, 12], [14, 16], [18, 20]]; // [pip, tip] per non-thumb finger
export function extendedFingerTips(lm) {
  const tips = [];
  if (thumbUp(lm)) tips.push(4);
  for (const [pip, tip] of TIP_FOR_FINGER) if (extFinger(lm, pip, tip) > FT_EXT) tips.push(tip);
  return tips;
}
// pickClosestHand(hands) — MediaPipe can report multiple hands
// (multiNumHands below); when it does, prefer the one that looks CLOSEST to
// the camera (largest apparent handSize) as the single hand every consumer
// (finger count, centroid, FX) sees — picked ONCE here so count/centroid/FX
// never disagree about which hand is "the" hand. Pure (no camera/DOM), so
// it's unit-testable; returns null for an empty list.
export function pickClosestHand(hands) {
  let best = null, bestSize = -1;
  for (const h of hands) { const s = handSize(h); if (s > bestSize) { bestSize = s; best = h; } }
  return best;
}

export class CameraEngine {
  #videoEl; #onFrame; #watchdogActive;
  #ready = false; #stream = null; #hands = null; #raf = 0; #sending = false; #starting = null;
  #lastResult = 0; #restartAt = 0;
  // MediaPipe's legacy solutions share one global emscripten `Module`, so a
  // SelfieSegmentation built while Hands is still fetching its wasm resolves
  // through Hands' locateFile, 404s, and aborts BOTH graphs — hand tracking
  // dies silently. Anything that loads a second solution (human-layers.js)
  // must await this first. Root toy: same guard in src/main.js.
  #handsFirstFrame = null;
  #handsUp = null;
  #handAngle = 0;
  constructor(videoEl, { onFrame, watchdogActive }) {
    this.#videoEl = videoEl; this.#onFrame = onFrame; this.#watchdogActive = watchdogActive;
  }
  get isReady() { return this.#ready; }
  /** Resolves once MediaPipe Hands has delivered a frame — see #handsFirstFrame. */
  handsRunning() {
    if (!this.#handsUp) this.#handsUp = new Promise(resolve => { this.#handsFirstFrame = resolve; });
    return this.#handsUp;
  }
  get stream() { return this.#stream; }
  get videoEl() { return this.#videoEl; }

  #onResults = res => {
    this.#lastResult = performance.now();               // the watchdog's heartbeat
    if (this.#handsFirstFrame) { this.#handsFirstFrame(); this.#handsFirstFrame = null; }
    const hand = pickClosestHand(res.multiHandLandmarks || []);
    if (hand) {
      const raw = handAngleDegrees(hand);
      let delta = raw - this.#handAngle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      this.#handAngle += delta * .18;
      this.#videoEl.style.setProperty('--hand-angle', `${this.#handAngle}deg`);
      const still = document.getElementById('camstill');
      if (still) still.style.setProperty('--hand-angle', `${this.#handAngle}deg`);
    }
    this.#onFrame(res);
  };

  ensure() {
    if (this.#ready) {
      // A cast's freeze-frame PAUSES the video (and paused video = no frames
      // to MediaPipe = dead gates). Whoever needs the hand next comes through
      // here — resume.
      if (this.#videoEl.paused && this.#videoEl.srcObject) this.#videoEl.play().catch(() => {});
      return Promise.resolve();
    }
    this.#starting ||= (async () => {
      if (!self.Hands) await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      if (!this.#hands) {
        this.#hands = new self.Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
        // maxNumHands: 2 (was 1) — so a second hand drifting into frame
        // doesn't just get ignored/flicker the tracked one; onHands picks
        // whichever detected hand is CLOSEST to camera via pickClosestHand
        // (below), so there is still exactly one "the hand" for every gate.
        this.#hands.setOptions({ maxNumHands: 2, modelComplexity: HANDS_MODEL_COMPLEXITY, minDetectionConfidence: .7, minTrackingConfidence: .6, selfieMode: false });
        this.#hands.onResults(this.#onResults);
      }
      // 480x360 capture (not the display element's CSS size, which is separate
      // and untouched) — already at the low-res target for hands.send() cost;
      // school laptops don't need more than this to drive finger-count/landmark math.
      this.#stream = await navigator.mediaDevices.getUserMedia({ video: { width: CAPTURE_W, height: CAPTURE_H } });
      this.#videoEl.srcObject = this.#stream; await this.#videoEl.play().catch(() => {});
      this.#ready = true; this.#lastResult = performance.now();
      const loop = async () => {
        if (!this.#ready) return;                        // released → this loop dies with it
        this.#raf = requestAnimationFrame(loop);
        if (this.#videoEl.paused || this.#videoEl.readyState < 2) return; // fx freeze pauses on purpose — no frames, no watchdog
        const now = performance.now();
        // Watchdog: frames should be flowing but MediaPipe results stopped —
        // the pipeline silently died (it happens); force a clean restart.
        if (this.#watchdogActive() && now - this.#lastResult > 3500 && now - this.#restartAt > 6000) {
          this.#restartAt = now; this.restart(); return;
        }
        if (this.#sending) return;
        this.#sending = true;
        try { await this.#hands.send({ image: this.#videoEl }); } catch { /* a dropped frame is fine */ }
        this.#sending = false;
      };
      this.#raf = requestAnimationFrame(loop);
      const still = document.getElementById('camstill'); if (still) still.style.display = 'none'; // live feed replaces the freeze-frame survivor
      this.syncViews();
    })().finally(() => { this.#starting = null; });
    return this.#starting;
  }

  // A re-acquired camera is a NEW stream — refresh every live chip/overlay video.
  syncViews() {
    const src = this.#videoEl.srcObject;
    document.querySelectorAll('.bcam.on video, #rcam').forEach(v => { if (v.srcObject !== src) v.srcObject = src; v.play().catch(() => {}); });
  }

  release() {
    if (!this.#ready || this.#starting || this.#watchdogActive()) return;
    this.#snapshotStill();                                // a paused video whose tracks die renders BLACK — keep the last frame on a canvas
    this.#ready = false; cancelAnimationFrame(this.#raf);
    if (this.#stream) { this.#stream.getTracks().forEach(t => t.stop()); this.#stream = null; }
  }

  // Freeze-frame survivor: painted over the video element, hidden again on re-acquire.
  #snapshotStill() {
    const v = this.#videoEl;
    if (!v.videoWidth) return;
    let c = document.getElementById('camstill');
    if (!c) { c = document.createElement('canvas'); c.id = 'camstill'; v.after(c); }
    c.width = v.videoWidth; c.height = v.videoHeight;
    try { c.getContext('2d').drawImage(v, 0, 0); c.style.display = ''; } catch { /* no frame yet */ }
  }

  // The watchdog's hammer: tear the stream down and bring it back. Gates and
  // asks survive — they're callbacks fed by onHands, which resumes with the
  // fresh stream; syncViews() repoints the chip videos.
  restart() {
    this.#ready = false; this.#sending = false; cancelAnimationFrame(this.#raf);
    if (this.#stream) { this.#stream.getTracks().forEach(t => t.stop()); this.#stream = null; }
    this.ensure().catch(() => {});
  }
}
