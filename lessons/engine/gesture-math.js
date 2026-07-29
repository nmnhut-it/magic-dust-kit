// gesture-math.js — pure landmark-history math for the swipe/track gesture
// verbs. No DOM/camera deps, so it's testable in isolation (sibling to the
// root app's gestures.js, but for the lesson engine's motion gates).
import { SWIPE_MIN_DIST, SWIPE_MAX_MS } from './constants.js';

// detectSwipe(history, axis='any') — history: array of {x,y,t} oldest→newest
// fingertip samples, x/y normalized [0,1] in mirrored screen space, t in ms.
// Finds the oldest sample still within SWIPE_MAX_MS of the newest one and
// measures displacement over that span. axis='x'|'y' restricts detection to
// that axis (used for binary left/right choices, so an accidental vertical
// wobble can't get misread as a decision); 'any' (default) picks whichever
// axis dominates. Returns 'left'|'right'|'up'|'down', or null if no swipe yet.
export function detectSwipe(history, axis = 'any') {
  if (history.length < 2) return null;
  const newest = history[history.length - 1];
  let start = history[0];
  for (const s of history) { if (newest.t - s.t <= SWIPE_MAX_MS) { start = s; break; } }
  const dx = newest.x - start.x, dy = newest.y - start.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (axis === 'x') return adx >= SWIPE_MIN_DIST ? (dx > 0 ? 'right' : 'left') : null;
  if (axis === 'y') return ady >= SWIPE_MIN_DIST ? (dy > 0 ? 'down' : 'up') : null;
  if (Math.max(adx, ady) < SWIPE_MIN_DIST) return null;
  return adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// trackDistance(x, y, tx, ty) — plain Euclidean distance in normalized coords.
export function trackDistance(x, y, tx, ty) { return Math.hypot(x - tx, y - ty); }

// gridCellAt(nx, ny, rows, cols) — maps a normalized screen point [0,1]x[0,1]
// into a 1-based grid cell number, left-to-right then top-to-bottom.
// Example for 3x3: top-left=1, center=5, bottom-right=9. The returned row/col
// are also 1-based so learner-facing helpers can say "hàng 2, cột 3"
// without exposing zero-index math.
export function gridCellAt(nx, ny, rows, cols) {
  rows = Math.max(1, Math.floor(rows || 1));
  cols = Math.max(1, Math.floor(cols || 1));
  const col0 = Math.max(0, Math.min(cols - 1, Math.floor(Math.max(0, Math.min(0.999999, nx)) * cols)));
  const row0 = Math.max(0, Math.min(rows - 1, Math.floor(Math.max(0, Math.min(0.999999, ny)) * rows)));
  return { row: row0 + 1, col: col0 + 1, cell: row0 * cols + col0 + 1 };
}

// handCentroid(lm) — average of ALL 21 landmarks (mirrored screen space,
// {x,y} normalized [0,1]). Chosen over a single fingertip (landmark 8) for
// the track/swipe hit-test point because a lone fingertip's per-frame jitter
// is a large fraction of its own travel — hovering just a fingertip near a
// target barely moved the point enough to register, and only a whole-hand
// motion reliably beat the noise floor (the exact "have to move the whole
// hand" bug this was written for). Averaging all 21 points cancels each
// joint's independent wobble (fingers curling/uncurling in place mostly
// average out) while still translating 1:1 with genuine whole-hand motion —
// so a fingertip-hover reads as a small but stable centroid nudge instead of
// a jittery near-miss. Pure/no clock reads, so it's unit-testable.
export function handCentroid(lm) {
  let sx = 0, sy = 0;
  for (const p of lm) { sx += p.x; sy += p.y; }
  return { x: sx / lm.length, y: sy / lm.length };
}

// coverMap(nx, ny, w, h, vw, vh) — maps a normalized point (nx,ny in [0,1],
// already in whatever screen-space orientation the caller wants, e.g.
// pre-mirrored) from a SOURCE video of intrinsic size vw×vh onto a
// DESTINATION canvas of size w×h that displays that video with CSS
// `object-fit:cover` (the camera chip/fullscreen video layers both use
// cover — it scales the source to fill the box, cropping whichever axis
// overflows, instead of letterboxing). A naive `nx*w, ny*h` mapping (the bug
// this fixes, see gesture-ui.js's FingertipFxPainter) assumes the video maps
// 1:1 onto the canvas, which is only true when w/h happens to equal vw/vh —
// otherwise the cover crop shifts the visible video, and every landmark
// drifts off the real fingertip by the crop offset (worse the more the
// canvas aspect differs from the source, e.g. a fullscreen box vs a 480x360
// feed). `scale = max(w/vw, h/vh)` is exactly what object-fit:cover uses:
// the axis that would otherwise letterbox is instead over-scaled until it
// fills, and the excess on the other axis is centered and cropped. Pure, no
// DOM reads — testable with plain numbers (see test-gesture-math.mjs). ──
export function coverMap(nx, ny, w, h, vw, vh) {
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale, dh = vh * scale;
  const offX = (w - dw) / 2, offY = (h - dh) / 2;
  return { x: offX + nx * dw, y: offY + ny * dh };
}

// smoothLandmarks(prev, raw, alpha) — EMA ("One-Euro-lite") smoother for a
// MediaPipe landmark array: smoothed = prev + (raw - prev) * alpha, applied
// per-point to x/y only (z and any other fields pass through unchanged).
// `prev` = null (first frame, or hand just re-acquired) returns `raw`
// unchanged — no history to blend from yet. Pure/no clock reads, so it's
// unit-testable: caller (gesture-dispatcher.js's onHands) owns the running
// `prev` and feeds it back in every frame, applying the SAME smoothed array
// to every consumer (fingertip-fx dot AND swipe/track hit-test) — smoothing
// only one of those two would make the visible dot and the actual hit-test
// point disagree, which reads as "the dot is lying."
export function smoothLandmarks(prev, raw, alpha = 0.55) {
  if (!prev) return raw;
  return raw.map((p, i) => { const q = prev[i]; return q ? { ...p, x: q.x + (p.x - q.x) * alpha, y: q.y + (p.y - q.y) * alpha } : p; });
}
