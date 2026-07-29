// gesture-ui.js — shared UI feedback for the ARM→CAPTURE gesture verbs
// (swipe/track): both quiz-cell.js and boss-fight.js drive a hint line +
// a gauge fill off the SAME (phase, progress) callback shape that
// gesture-dispatcher.js's armSwipeGate/armMultiTrackGate/armTrackGate
// report — this is the one place that phrasing/wiring lives, instead of
// each caller re-writing its own copy.
import { handCentroid, coverMap } from './gesture-math.js';
import { extendedFingerTips, CAPTURE_W, CAPTURE_H } from './camera-engine.js';
export function armStatusHandler(hintEl, fillEl, captureLabel) {
  return (phase, p) => {
    if (fillEl) fillEl.style.width = p * 100 + '%';
    if (!hintEl) return;
    if (phase === 'arm') hintEl.textContent = `giơ ✋ để khoá tay — ${Math.round(p * 100)}%`;
    else if (phase === 'capture') hintEl.textContent = captureLabel;
    else if (phase === 'timeout') hintEl.textContent = 'hết giờ rồi — giơ ✋ lại để thử tiếp';
  };
}

// ── fingertip-fx overlay: a mini spinning magic circle + drifting rune
// glyphs on each ACTIVE fingertip, drawn on a <canvas> layered over a chip's
// <video> (or fullscreen) — the only visual proof-of-life a student/teacher
// gets that the camera actually sees the hand. Fed by
// gesture-dispatcher.js's onLandmarks() PASSIVE tap, so it never touches the
// priority ladder — it just paints whatever the dispatcher already saw.
// Mirrored (1-x) to match the chip video's CSS `scaleX(-1)`. One shared
// painter (FingertipFxPainter) backs all three call sites below (chip
// overlay, fullscreen track dot, fullscreen kickoff showcase) — upgraded
// 2026-07-04 from plain glow dots (owner: "nhìn phèn dã man") to echo
// ritual-vortex.js's magic-circle language instead of a color-swap-only
// success state, then again 2026-07-04 per owner add-on feedback:
//   1. the palm-center glow is GONE ("trung tâm thì không nên hiện") — only
//      fingertips draw.
//   2. only ACTUALLY-EXTENDED fingertips light up (camera-engine.js's
//      extendedFingerTips), not always all 5 ("nếu chỉ yêu cầu 1 finger thì
//      không nên hiện hết 5") — a hold-1-finger gate naturally shows one
//      dot because only one finger is really extended; no separate
//      "required count" needs threading in from each call site, the
//      camera's own read of the hand already answers it. Open-palm (✋=5)
//      and track (no specific count) still read as "show all 5" simply
//      because a fully open hand really does have 5 tips extended.
//   3. each fingertip gets a DISTINCT glyph + hue (FINGER_STYLE below), not
//      5 identical clones ("mỗi đầu ngón tay lên có màn khác nhau") — then,
//      2026-07-04 owner add-on ("5 ngón tay nên có 5 mào magic circle khác
//      nhau" + a hue-only shift on a green success tint still read as "same
//      green blob"): each fingertip now gets a genuinely DIFFERENT CIRCLE
//      GEOMETRY too (a distinct inscribed polygon per FINGER_STYLE.shape,
//      see drawMiniCircle below), not just a color/hue variant of the same
//      ring+6-tick shape — so five active fingertips read as five different
//      SIGILS even in the flat success tint, not one recolored clone. ──
const TIP_IDX = [4, 8, 12, 16, 20];   // thumb, index, middle, ring, pinky tips
// FINGER_STYLE — keyed by landmark index, gives each fingertip's mini-circle
// a fixed distinct rune, hue-rotate degree (ctx.filter, cheap — no manual HSL
// math), inscribed polygon `shape` (drawMiniCircle's SHAPES table — the part
// that actually reads as "a different magic circle", not just a tint), and a
// spin `dir` (±1, so neighbors visibly counter-rotate instead of all
// spinning the same way) — five axes of difference per fingertip, not one.
export const FINGER_STYLE = {
  4: { glyph: 'ᚠ', hue: -40, shape: 'hex', dir: -1 },      // thumb — 6-point star (hexagram), spins backward
  8: { glyph: 'ᚱ', hue: 0, shape: 'ring', dir: 1 },        // index — 0 = no shift; ring = the original plain tick-ring look
  12: { glyph: 'ᛟ', hue: 30, shape: 'square', dir: -1 },   // middle — rotated square, spins backward
  16: { glyph: 'ᛒ', hue: 60, shape: 'triangle', dir: 1 },  // ring finger — triangle
  20: { glyph: 'ᛊ', hue: -20, shape: 'rings', dir: 1 },    // pinky — concentric rings only, no polygon/ticks
};
// Same rune alphabet ritual-vortex.js's RUNES draws its floating glyph-dust
// and circle bands from (that file is a classic <script>, not an ES module,
// so its RUNES const isn't importable — copied literally to keep the same
// visual vocabulary rather than inventing a second alphabet).
const FX_GLYPHS = [...'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛉᛊᛏᛒᛖᛗᛟ'];
const FX_GLYPH_CAP = 36;              // hard cap on live glyph particles per painter — stays cheap on a school laptop

// ── comet trail (track quiz "casting magic at the target" fx, 2026-07-04) —
// a capped ring buffer of recent centroid positions, painted as shrinking/
// fading dots behind the current point (oldest = smallest/dimmest), plus a
// few short glyph sparks peeling off the trail. Cheap: no allocation beyond
// a fixed-length array push/shift, no extra particle system. ──
const TRAIL_CAP = 16;                 // ~0.25s of trail at 60fps — a comet tail, not a smear
export class TrailPainter {
  #pts = [];
  push(x, y) { this.#pts.push({ x, y }); if (this.#pts.length > TRAIL_CAP) this.#pts.shift(); }
  reset() { this.#pts = []; }
  // paint(ctx, color, chargeP) — chargeP (0..1, e.g. the nearest target's
  // track-hold progress) brightens/widens the trail so it visibly
  // "intensifies" while charging a correct target, per the spell-cast ask.
  paint(ctx, color, chargeP = 0) {
    const n = this.#pts.length; if (n < 2) return;
    const boost = 1 + chargeP * 1.4;
    for (let i = 0; i < n; i++) {
      const p = this.#pts[i], t = (i + 1) / n;              // 0..1, oldest→newest
      const r = (1.5 + t * 4.5) * boost, alpha = t * t * (0.15 + chargeP * .35);
      ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = color; ctx.shadowBlur = 10 * boost;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
}

function drawGlowDot(ctx, x, y, color, r) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

// ── pure particle math (exported for tests, see test-gesture-fx.mjs) ──
// A glyph particle: spawned at a fingertip, drifts outward/upward, fades
// and rotates over a short lifespan. dt-driven (no wall-clock reads inside)
// so it's deterministic and testable without a fake timer.
export function spawnGlyphParticle(x, y, ch, rand = Math.random) {
  const ang = -Math.PI / 2 + (rand() - .5) * 2.4;             // mostly upward, some spread
  const spd = 10 + rand() * 22;
  return { x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, age: 0, life: .6 + rand() * .5, ch, rot: rand() * Math.PI * 2, vrot: (rand() - .5) * 3 };
}
// stepGlyphParticles(list, dt) — advances every particle by dt (seconds),
// drops any past its lifespan. Pure: returns a new array, never mutates.
export function stepGlyphParticles(list, dt) {
  return list.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, age: p.age + dt, rot: p.rot + p.vrot * dt })).filter(p => p.age < p.life);
}

// SHAPES — pure geometry table (exported for tests, see test-gesture-fx.mjs):
// each entry returns the vertex angles (radians, 0 = +x axis) of the polygon
// inscribed in the mini-circle for that fingertip's `shape` key. 'ring' and
// 'rings' have no polygon (empty array) — they stay pure ring(s), which is
// itself a distinct silhouette from the four polygon shapes. Kept separate
// from drawMiniCircle so the actual vertex math is unit-testable without a
// canvas context.
export const SHAPES = {
  hex: n3(6),                 // hexagram — 6-point star, drawn as two overlapping triangles below
  ring: [],                   // plain ring + 6 tick marks (the original look) — index finger's baseline
  square: n3(4, Math.PI / 4), // diamond (square rotated 45°)
  triangle: n3(3, -Math.PI / 2), // point-up triangle
  rings: [],                  // concentric rings only, no ticks/polygon — pinky's minimalist signature
};
function n3(n, offset = 0) { return Array.from({ length: n }, (_, i) => offset + i / n * Math.PI * 2); }

// One mini magic circle: base ring(s) + a shape-specific inscribed polygon
// (or extra ring, or tick marks) + a small central rune glyph — each
// fingertip's `shape`/`glyph`/`hue` (FINGER_STYLE) combine so five active
// fingertips read as five genuinely DIFFERENT sigils, not five recolors of
// the same ring+ticks (owner: "vẫn là màu xanh lá" — a hue-rotate alone on a
// mostly-green success tint still read as one blob). `spin` = current
// rotation (rad, sign/offset chosen by the caller so fingers desync/counter-
// rotate instead of spinning in lockstep), `glow` scales brightness/blur —
// the success state is brighter + spinning faster, not just a color swap.
// `hueDeg` (0 = no shift) additionally tints this fingertip's ring via a
// cheap canvas `filter: hue-rotate()` instead of manual HSL math — color AND
// geometry both vary now, so success state still reads as 5 distinct sigils.
function drawMiniCircle(ctx, x, y, r, spin, color, glow, glyph, hueDeg = 0, shape = 'ring') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  if (hueDeg) ctx.filter = `hue-rotate(${hueDeg}deg)`;
  ctx.shadowColor = color; ctx.shadowBlur = 6 * glow; ctx.strokeStyle = color;
  ctx.globalAlpha = Math.min(1, .55 * glow); ctx.lineWidth = Math.max(.6, r * .07);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * .68, 0, Math.PI * 2); ctx.stroke();
  const verts = SHAPES[shape] || [];
  if (shape === 'hex') {                                  // hexagram: two overlapping triangles (offset 60°), not a hexagon outline
    [0, Math.PI / 3].forEach(off => { ctx.beginPath();
      [0, 1, 2].forEach(i => { const a = off + i / 3 * Math.PI * 2, px = Math.cos(a) * r * .8, py = Math.sin(a) * r * .8;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
      ctx.closePath(); ctx.stroke(); });
  } else if (verts.length) {                              // square/triangle: single closed polygon inscribed at r*.8
    ctx.beginPath();
    verts.forEach((a, i) => { const px = Math.cos(a) * r * .8, py = Math.sin(a) * r * .8; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
    ctx.closePath(); ctx.stroke();
  } else if (shape === 'rings') {                         // pinky: a third concentric ring instead of ticks/polygon
    ctx.beginPath(); ctx.arc(0, 0, r * .4, 0, Math.PI * 2); ctx.stroke();
  } else {                                                 // 'ring' (index, the baseline look): 6 tick marks between the two rings
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .68, Math.sin(a) * r * .68); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
  }
  if (glyph) { ctx.rotate(-spin); ctx.fillStyle = color; ctx.font = `${r * 1.1}px "Segoe UI Historic","Segoe UI Symbol",serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, 0, 0); }
  ctx.restore();
}

function drawGlyphParticle(ctx, p, color, scale) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
  ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.fillStyle = color;
  ctx.font = `${12 * scale}px "Segoe UI Historic","Segoe UI Symbol",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.ch, 0, 0);
  ctx.restore();
}

// FingertipFxPainter — stateful (owns a capped glyph-particle pool + a
// rotation phase), one instance per overlay. paint(now, w, h, lm, has, opts)
// draws the full picture for one frame: a mini circle per ACTIVE tip (see
// FINGER_STYLE/extendedFingerTips above — no palm glow anymore) plus a
// low-rate glyph emitter per active tip (fast hand motion naturally leaves a
// denser trail — no extra "trail" bookkeeping needed, emission is just
// per-frame). opts: {scale, success, emitRate} — scale sizes everything for
// context (chip vs fullscreen), success brightens + speeds the spin,
// emitRate caps glyph spawns/sec (default low, "money shot" but cheap).
export class FingertipFxPainter {
  #particles = []; #spin = 0; #lastNow = null; #emitAcc = 0;
  // opts.vw/vh — intrinsic size of the SOURCE video the landmarks come from
  // (default: camera-engine.js's CAPTURE_W/H, the actual getUserMedia()
  // capture resolution). BUG FIX (owner: "5 màu circle ở 5 đầu ngón cũng
  // không cố định hả?... hình như cũng không phải ở đầu ngón tay"): the
  // video element is shown with CSS `object-fit:cover`, but landmarks used
  // to be mapped straight onto the canvas as `nx*w, ny*h` — that's only
  // correct when the canvas aspect happens to equal the video's; otherwise
  // the cover crop shifts what's actually visible and every dot drifts off
  // the real fingertip (worse the more the box's aspect differs from
  // 480x360, e.g. the fullscreen overlay). Routed through
  // gesture-math.js#coverMap, which reproduces the exact same
  // scale-to-fill-then-center-crop object-fit:cover does, so a fingertip in
  // the feed lands under the same fingertip on screen for both the chip
  // overlay and the fullscreen canvas (both call this same paint()).
  paint(ctx, w, h, lm, has, opts = {}) {
    const scale = opts.scale ?? 1, ok = !!opts.success, emitRate = opts.emitRate ?? 6;
    const vw = opts.vw ?? CAPTURE_W, vh = opts.vh ?? CAPTURE_H;
    const now = opts.now ?? (typeof performance !== 'undefined' ? performance.now() : 0);
    const dt = this.#lastNow == null ? 0 : Math.min(.1, (now - this.#lastNow) / 1000); this.#lastNow = now;
    this.#spin += (ok ? 2.6 : 1.2) * dt;
    ctx.clearRect(0, 0, w, h);
    if (!has || !lm) { this.#particles = stepGlyphParticles(this.#particles, dt); this.#paintParticles(ctx, scale); return; }
    const color = ok ? '#d9eee5' : '#78b2a5', glow = ok ? 1.6 : 1;
    // Only ACTUALLY-EXTENDED fingertips light up — a hold-1-finger gate
    // naturally shows one dot, open-palm/track naturally show up to 5,
    // because that's genuinely how many the camera sees extended. Falls
    // back to all 5 if none read as extended (e.g. a transient noisy frame
    // mid-fist) so the overlay never just goes blank while a hand IS seen.
    const activeIdx = extendedFingerTips(lm);
    const idxs = activeIdx.length ? activeIdx : TIP_IDX;
    const tips = idxs.map(i => { const p = coverMap(1 - lm[i].x, lm[i].y, w, h, vw, vh); return { i, x: p.x, y: p.y }; });
    tips.forEach(({ i, x, y }) => { const style = FINGER_STYLE[i] || {};
      drawMiniCircle(ctx, x, y, 9 * scale, this.#spin * (style.dir ?? 1) + i * .07, color, glow, style.glyph, style.hue, style.shape); });
    this.#emitAcc += dt * emitRate;
    while (this.#emitAcc >= 1 && this.#particles.length < FX_GLYPH_CAP) {
      this.#emitAcc -= 1;
      const tip = tips[Math.random() * tips.length | 0];
      this.#particles.push(spawnGlyphParticle(tip.x, tip.y, FX_GLYPHS[Math.random() * FX_GLYPHS.length | 0]));
    }
    this.#particles = stepGlyphParticles(this.#particles, dt);
    this.#paintParticles(ctx, scale);
  }
  #paintParticles(ctx, scale) { const color = '#d9eee5'; for (const p of this.#particles) drawGlyphParticle(ctx, p, color, scale); }
}

// fxByChip — WeakMap<chip, disarm()> makes armFingertipFx idempotent PER
// CHIP regardless of caller: re-arming the same chip (e.g. a caller that
// forgot it already armed, or a gate re-armed without disarming first)
// disarms the previous instance before mounting a new one, so the
// dispatcher's onLandmarks observer list never grows unbounded and a chip
// never ends up with two canvases/painters stacked on it.
const fxByChip = new WeakMap();
// armFingertipFx(dispatcher, chip, isSuccess) — mounts a canvas over `chip`
// (must be position:relative, e.g. .bcam), subscribes to the dispatcher's
// passive landmark tap, and paints the fingertip FX every frame while the
// hand is seen. `isSuccess()` (optional) is polled each frame — true →
// brighter/faster-spinning success state, false/absent → neutral.
// Returns disarm().
export function armFingertipFx(dispatcher, chip, isSuccess) {
  const prev = fxByChip.get(chip); if (prev) prev();
  let canvas = chip.querySelector('canvas.fxdots');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'fxdots'; chip.appendChild(canvas); }
  const ctx = canvas.getContext('2d');
  const painter = new FingertipFxPainter();
  // Assigning canvas.width/height (even to the SAME value) forces an implicit
  // clear/reset per the canvas spec — reading clientWidth/Height every frame
  // is cheap, but only WRITE when the size actually changed, or every frame
  // pays a needless canvas reset on top of the paint that follows.
  const resize = () => { const w = chip.clientWidth || 126, h = chip.clientHeight || 94;
    if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h; };
  resize();
  const off = dispatcher.onLandmarks((lm, has) => {
    resize();
    painter.paint(ctx, canvas.width, canvas.height, lm, has, { scale: .8, success: !!(isSuccess && isSuccess()) });
  });
  const disarm = () => { off(); ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.remove(); fxByChip.delete(chip); };
  fxByChip.set(chip, disarm);
  return disarm;
}

// armScreenFingertipDot(dispatcher, isActive, getChargeP) — same fingertip
// FX, but painted on a FIXED full-viewport canvas instead of a tiny camera
// chip — for track questions, where the student chases targets drifting
// across the whole screen (see quiz-cell.js's trackPos) and needs to see
// where their tracked point actually is in that same coordinate space.
// `isActive()` gates whether anything is drawn (only while a track question
// is armed). The tracked point is the WHOLE-HAND CENTROID
// (gesture-math.js#handCentroid) — same point fed to the track hit-test in
// two-phase-gate.js#makeTrackCapture, so the dot and the hit-test can never
// disagree (both derive from the same smoothed onLandmarks frame). Mirrored
// the SAME way as trackPos's hit-test space (1-x, y). A comet TrailPainter
// (above) follows the dot, reading as "channeling magic toward the target";
// `getChargeP()` (optional, 0..1) — the currently-nearest target's
// track-hold progress — brightens/widens the trail while charging, so it
// visibly intensifies as a catch nears. Returns disarm().
// screenDotDisarm — only one fullscreen track-dot instance is ever active
// at a time (by design, see the module comment above), so re-arming before
// disarming the previous one just replaces it instead of stacking a second
// onLandmarks subscription on the shared canvas.
let screenDotDisarm = null;
export function armScreenFingertipDot(dispatcher, isActive, getChargeP) {
  if (screenDotDisarm) screenDotDisarm();
  let canvas = document.querySelector('canvas.fxscreendot');
  if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'fxscreendot'; document.body.appendChild(canvas); }
  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize(); addEventListener('resize', resize);
  let spin = 0, last = null;
  const trail = new TrailPainter();
  const off = dispatcher.onLandmarks((lm, has) => {
    const now = performance.now(), dt = last == null ? 0 : Math.min(.1, (now - last) / 1000); last = now; spin += 1.4 * dt;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!has || !lm || !(isActive && isActive())) { trail.reset(); return; }
    const c = handCentroid(lm);
    // Same object-fit:cover mapping as FingertipFxPainter.paint (see its
    // comment above) — this canvas is the fullscreen track overlay, whose
    // aspect differs from the 480x360 capture far more than a small chip
    // does, so the naive nx*w/ny*h mapping drifted the worst here.
    const { x, y } = coverMap(1 - c.x, c.y, canvas.width, canvas.height, CAPTURE_W, CAPTURE_H);
    const chargeP = Math.max(0, Math.min(1, (getChargeP && getChargeP()) || 0));
    trail.push(x, y); trail.paint(ctx, '#f4c85a', chargeP);
    drawMiniCircle(ctx, x, y, 16 * (1 + chargeP * .3), spin * (1 + chargeP), '#f4c85a', 1.3 + chargeP);
    drawGlowDot(ctx, x, y, '#f4c85a', 5 * (1 + chargeP * .5));
  });
  const disarm = () => { off(); ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.remove(); removeEventListener('resize', resize); screenDotDisarm = null; };
  screenDotDisarm = disarm;
  return disarm;
}

// armFullscreenFingertipFx(dispatcher, canvas, opts) — the kickoff
// gesture-title showcase variant: same painter, bigger scale, no
// success/isActive gating (always on while a hand is seen — this canvas
// IS the show-off surface). opts: {scale, isSuccess}. Returns disarm().
const fxByCanvas = new WeakMap();   // same idempotency guard as fxByChip, keyed by the caller's own canvas
export function armFullscreenFingertipFx(dispatcher, canvas, opts = {}) {
  const prev = fxByCanvas.get(canvas); if (prev) prev();
  const ctx = canvas.getContext('2d');
  const painter = new FingertipFxPainter();
  const off = dispatcher.onLandmarks((lm, has) => {
    painter.paint(ctx, canvas.width, canvas.height, lm, has, { scale: opts.scale ?? 2.2, success: !!(opts.isSuccess && opts.isSuccess()), emitRate: opts.emitRate ?? 8 });
  });
  const disarm = () => { off(); ctx.clearRect(0, 0, canvas.width, canvas.height); fxByCanvas.delete(canvas); };
  fxByCanvas.set(canvas, disarm);
  return disarm;
}

// ── shared fullscreen camera layer — one singleton <div class="${className}">
// per class name, reused across every caller of that class (originally
// quiz-cell.js's `.trackcam`, see node.css — extracted here so other
// fullscreen-camera UIs, e.g. a boss arena, can reuse the same mount/
// singleton/teardown instead of re-deriving it). `className` picks BOTH the
// singleton slot and the CSS look (each caller owns its own node.css rules
// keyed by that class, same as `.trackcam` today) — enterFullscreenCam only
// handles the DOM/stream plumbing. Resolves the mounted <div>; rejects (like
// cameraEngine.ensure()) if there's no camera, so the caller's existing
// .catch(() => {}) no-camera fallback keeps working unchanged. ──
const fsCamEls = new Map();
export function enterFullscreenCam(cameraEngine, className) {
  return cameraEngine.ensure().then(() => {
    let el = fsCamEls.get(className);
    if (!el) { el = document.createElement('div'); el.className = className;
      el.innerHTML = '<video playsinline muted></video>'; document.body.appendChild(el); fsCamEls.set(className, el); }
    const v = el.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
    el.classList.add('on');
    return el;
  });
}
export function leaveFullscreenCam(className) { const el = fsCamEls.get(className); if (el) el.classList.remove('on'); }

// flashSlash(chip, dir) — brief CSS-only slash-trail streak across `chip` in
// the resolved swipe direction ('left'/'right'/'up'/'down'), shown the
// instant a swipe resolves and before the caller acts on it (boss-fight.js's
// #armSwipe) — a cheap DOM+CSS flourish (see node.css's `.gslash*` block),
// no canvas/particle bookkeeping needed since it's one-shot and self-removing.
export function flashSlash(chip, dir) {
  const s = document.createElement('div'); s.className = 'gslash gslash-' + dir;
  chip.appendChild(s); setTimeout(() => s.remove(), 380);
}

// HoldChoiceGate — pure "hold N fingers to pick option N" state machine
// (KICKOFF-PLAN.md Part B: ritual word-choice). Same hold-charge shape as
// quiz-cell.js's armHoldQuestion (N fingers = option N, switching target
// hard-resets the charge, no soft decay) copied out rather than imported —
// quiz-cell.js was owned by a concurrent edit when this was written; wiring
// armHoldQuestion to call this too (removing its own copy) is a follow-up
// dedup, not done here. No DOM/camera/performance.now() here — the caller
// drives it via step(now, count, has), clock injected, so it's testable
// with a fake clock (see test-ritual-choice.mjs), mirroring
// two-phase-gate.js's TwoPhaseGate.
export class HoldChoiceGate {
  #n; #correct; #holdMs; #held = 0; #target = -1; #last = null; #resolved = false;
  constructor(n, correct, holdMs) { this.#n = n; this.#correct = correct; this.#holdMs = holdMs; }
  get target() { return this.#target; }                          // -1 = no option currently held
  get progress() { return this.#target < 0 ? 0 : Math.min(1, this.#held / this.#holdMs); }
  get resolved() { return this.#resolved; }                       // true once the CORRECT option has been picked
  // step(now, count, has) — feed one camera frame; returns {idx, ok} the
  // instant an option's hold reaches holdMs, else null. A wrong pick resets
  // the held charge but does NOT set `resolved` — the gate stays live so
  // the student can retry (never a dead end).
  step(now, count, has) {
    const dt = this.#last === null ? 0 : Math.min(100, now - this.#last); this.#last = now;
    if (this.#resolved) return null;
    const idx = has && count >= 1 && count <= this.#n ? count - 1 : -1;
    if (idx !== this.#target) { this.#target = idx; this.#held = 0; } else if (idx >= 0) this.#held += dt;
    if (idx >= 0 && this.#held >= this.#holdMs) { this.#held = 0; return this.pick(idx); }
    return null;
  }
  // pick(idx) — the tap path (and the dev forceChoice hook): resolves
  // immediately, independent of camera/hold state, so tapping always works
  // even with no camera.
  pick(idx) {
    if (this.#resolved) return null;
    const ok = idx === this.#correct;
    if (ok) { this.#resolved = true; this.#target = -1; this.#held = 0; }
    return { idx, ok };
  }
}
