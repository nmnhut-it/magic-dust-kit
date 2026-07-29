// lessons/engine/stage-player.js — reusable teacher-driven SCENE PLAYER.
// A "stage" is pure data: STAGE = [{kind:'title'|'embed'|'video'|'ritual'|'go', ...}].
// The player advances scenes on teacher input (→ / Space / tap-right-half,
// ← / tap-left-half back, Esc jumps to the final 'go' scene) and renders
// scene-dots. ENGINE-layer: only imports ./ritual-theme.js (another ENGINE
// file, for the MOTIONS list), no node.js/notebook coupling, so any future
// teacher-facing demo assembly can reuse it (per KICKOFF-PLAN.md).
//
// Design split for testability: `nextIndex`/`prevIndex`/`escIndex` are PURE
// functions (index math only, see lessons/test-stage-player.mjs) driving a
// tiny class `StagePlayer` that owns index state + scene lifecycle callbacks.
// DOM mounting (`mount(stage, host, opts)`) is a thin wrapper around that
// class — video/embed teardown, crossfade, and input wiring all live there
// but never touch the index math.
//
// This is a projector/ambient backdrop, never a self-driving slideshow: NO
// scene auto-advances (video end/cap only enable a freeze-frame skip point,
// they never call next() themselves) and every scene must stay visually
// alive indefinitely while parked (title breathes, ritual loops its charge
// sine, video freezes on a dimmed last frame with a pulsing → hint instead
// of hard-cutting). The cursor hides after a few idle seconds (CSS
// `cursor:none`, see IDLE_MS) since this runs projected with no visible mouse.
import { MOTIONS } from './ritual-theme.js';
import { CameraEngine } from './camera-engine.js';
import { GestureDispatcher } from './gesture-dispatcher.js';
import { armFullscreenFingertipFx } from './gesture-ui.js';
import { RITUAL_SEC, RITUAL_DECAY } from './constants.js';

// ── pure index math (exported for tests) ──
function clampIndex(i, len) { return Math.max(0, Math.min(len - 1, i)); }
function nextIndex(i, len) { return clampIndex(i + 1, len); }
function prevIndex(i, len) { return clampIndex(i - 1, len); }
function lastGoIndex(stage) {                                          // Esc jumps to the FINAL 'go' scene (falls back to the last scene if none)
  for (let i = stage.length - 1; i >= 0; i--) if (stage[i].kind === 'go') return i;
  return stage.length - 1;
}
// isAutoNext(scene) — pure predicate: does this scene advance itself when it
// completes (video ended/cap, gesture-title full charge) instead of parking
// forever for the teacher to tap →? Two spellings accepted so content reads
// naturally per scene kind: `autoNext:true` (video) or `next:'auto'`
// (gesture-title, matches its {kind,title,hint,theme,next} shape from the
// v2 brief). Exported so a fresh content author can be tested without DOM.
function isAutoNext(scene) { return scene.autoNext === true || scene.next === 'auto'; }

// ── StagePlayer: pure index/lifecycle state machine, no DOM ──
// callbacks: { onEnter(scene, index), onExit(scene, index) }
class StagePlayer {
  constructor(stage, callbacks = {}) {
    if (!Array.isArray(stage) || !stage.length) throw new Error('StagePlayer: stage must be a non-empty array');
    this.stage = stage; this.cb = callbacks; this.index = -1;
  }
  get scene() { return this.index >= 0 ? this.stage[this.index] : null; }
  start() { this._goTo(0); }
  next() { this._goTo(nextIndex(this.index, this.stage.length)); }
  prev() { this._goTo(prevIndex(this.index, this.stage.length)); }
  jumpToEnd() { this._goTo(lastGoIndex(this.stage)); }
  _goTo(i) {
    i = clampIndex(i, this.stage.length);
    if (i === this.index) return;                                     // at an edge (first/last) — no-op, no re-enter/exit churn
    const prevScene = this.scene, prevIdx = this.index;
    if (prevScene && this.cb.onExit) this.cb.onExit(prevScene, prevIdx);
    this.index = i;
    if (this.cb.onEnter) this.cb.onEnter(this.scene, this.index);
  }
}

// ── DOM mount ──
// opts: { onDone } fired once when a 'go' scene is entered and the teacher
// advances past it (or it's the sole terminal scene) — kickoff.js uses it
// to navigate. Video scenes: tap-to-skip + hard WATCH_MS cap (never wait on
// `ended` alone — see onboard.js's ACT1 comment for the lesson this follows).
const WATCH_MS_DEFAULT = 15000;                                        // hard cap if a scene doesn't specify capMs — only enables the freeze/skip point, never auto-advances
const IDLE_MS = 2500;                                                  // no mouse movement for this long → hide the cursor (projector backdrop)

// normalizes a scene renderer's return into {destroy, onKey} — renderers may
// return a bare teardown fn (destroy-only) or a {destroy, onKey} object (the
// ritual scene needs onKey for live ↑/↓ motion cycling)
function normalizeHandle(ret) {
  if (typeof ret === 'function') return { destroy: ret, onKey: null };
  if (ret && typeof ret === 'object') return { destroy: ret.destroy || (() => {}), onKey: ret.onKey || null };
  return { destroy: () => {}, onKey: null };
}

function mount(stage, host, opts = {}) {
  host.classList.add('stg-host');
  host.innerHTML = `
    <div class="stg-flash" id="stgflash"></div>
    <div class="stg-scene" id="stgscene"></div>
    <div class="stg-dots" id="stgdots"></div>
    <div class="stg-hint" id="stghint">→ để bắt đầu</div>
    <button class="stg-nav stg-nav-l" id="stgnavl" aria-label="back" title="←"></button>
    <button class="stg-nav stg-nav-r" id="stgnavr" aria-label="next" title="→"></button>
    <button class="stg-nav stg-nav-end" id="stgnavend" aria-label="skip to map" title="Esc">⏭</button>`;
  const $scene = host.querySelector('#stgscene'), $dots = host.querySelector('#stgdots');
  const $flash = host.querySelector('#stgflash'), $hint = host.querySelector('#stghint');
  // ── always-on-top nav (siblings of $scene, never wiped by scene teardown) ──
  // An `embed` scene's iframe (a SEPARATE document) swallows clicks/keydown
  // the instant it has focus — parent document listeners never see them. A
  // stacked overlay element still wins the hit-test at that pixel regardless
  // of the iframe underneath, so these buttons are the one thing that always
  // works to advance/back/skip, iframe-focused or not.
  const $navL = host.querySelector('#stgnavl'), $navR = host.querySelector('#stgnavr'), $navEnd = host.querySelector('#stgnavend');
  $navL.onclick = e => { e.stopPropagation(); back(); };
  $navR.onclick = e => { e.stopPropagation(); advance(); };
  $navEnd.onclick = e => { e.stopPropagation(); toEnd(); };
  $dots.innerHTML = stage.map(() => '<i></i>').join('');
  const dots = [...$dots.children];
  let handle = { destroy: () => {}, onKey: null }, hintShown = true, dead = false;

  function flash() { $flash.classList.remove('go'); void $flash.offsetWidth; $flash.classList.add('go'); }
  function hideHint() { if (!hintShown) return; hintShown = false; $hint.classList.add('gone'); }

  function renderScene(scene, index) {
    dots.forEach((d, i) => d.classList.toggle('on', i === index));
    $scene.innerHTML = '';
    // autoNext scenes call `advance` themselves when they complete (video
    // ended/cap, gesture-title full charge) — a fresh closure per scene so a
    // stale call after teardown/re-entry can't advance the WRONG scene.
    const advance = () => { if (player.scene === scene) player.next(); };
    if (scene.kind === 'title') return mountTitle(scene, $scene);
    if (scene.kind === 'embed') return mountEmbed(scene, $scene);
    if (scene.kind === 'video') return mountVideo(scene, $scene, advance);
    if (scene.kind === 'ritual') return mountRitual(scene, $scene);
    if (scene.kind === 'gesture-title') return mountGestureTitle(scene, $scene, advance);
    if (scene.kind === 'go') { if (opts.onDone) opts.onDone(scene); return () => {}; }
    return () => {};                                                   // unknown kind — render nothing rather than throw (teacher demo must never hard-stop)
  }

  const player = new StagePlayer(stage, {
    onExit: () => { handle.destroy(); handle = { destroy: () => {}, onKey: null }; },
    onEnter: (scene, index) => { flash(); handle = normalizeHandle(renderScene(scene, index)); },
  });

  function advance() { hideHint(); player.next(); }
  function back() { hideHint(); player.prev(); }
  function toEnd() { hideHint(); player.jumpToEnd(); }

  function onKey(e) {
    if (dead) return;
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && handle.onKey) { handle.onKey(e); return; }   // ritual scene: live motion-preset cycling, doesn't advance
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.key === 'Escape') { e.preventDefault(); toEnd(); }
  }
  function onClick(e) {
    if (dead) return;
    const rect = host.getBoundingClientRect();
    (e.clientX - rect.left) < rect.width / 2 ? back() : advance();
  }
  document.addEventListener('keydown', onKey);
  host.addEventListener('click', onClick);

  // idle cursor: this page runs as a projected backdrop — hide the mouse
  // pointer after a few seconds of no movement, show it again on the next move.
  let idleTimer = setTimeout(() => host.classList.add('stg-idle'), IDLE_MS);
  function onMove() { host.classList.remove('stg-idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => host.classList.add('stg-idle'), IDLE_MS); }
  host.addEventListener('mousemove', onMove);

  player.start();
  return {
    next: advance, prev: back, jumpToEnd: toEnd,
    get index() { return player.index; }, get scene() { return player.scene; },
    destroy() {
      dead = true;
      document.removeEventListener('keydown', onKey); host.removeEventListener('click', onClick); host.removeEventListener('mousemove', onMove);
      clearTimeout(idleTimer);
      handle.destroy();
      host.innerHTML = ''; host.classList.remove('stg-host', 'stg-idle');
    },
  };
}

// ── scene renderers — each returns a teardown fn (or undefined) ──
function mountTitle(scene, host) {
  const wrap = document.createElement('div'); wrap.className = 'stg-title';
  wrap.innerHTML = `
    <canvas class="stg-title-vfx"></canvas>
    <div class="stg-title-fg">
      <h1>${scene.title || 'MAGIC DUST'}</h1>
      ${scene.subtitle ? `<p>${scene.subtitle}</p>` : ''}
    </div>`;
  host.appendChild(wrap);
  let vfx = null, dead = false;
  const cv = wrap.querySelector('canvas');
  // reuse ritual-vortex.js (classic <script>, window.RitualVortex) as the
  // ambient backdrop — mount() replaces our placeholder canvas with its own,
  // so give it a dedicated host div instead of the title's own <canvas>.
  const vfxHost = document.createElement('div'); vfxHost.className = 'stg-title-vfxhost';
  wrap.replaceChild(vfxHost, cv);
  function boot() {
    if (dead || !self.RitualVortex) return;
    vfx = self.RitualVortex.mount(vfxHost, { cy: .5, ambient: 1, spread: 1.3 });
    vfx.setAmbient(1);
  }
  if (self.RitualVortex) boot();
  else {
    const s = document.createElement('script'); s.src = './ritual-vortex.js'; s.onload = boot;   // resolved against the document (kickoff.html, lives in lessons/) not this module's path
    document.head.appendChild(s);
  }
  return () => { dead = true; if (vfx) vfx.stop(); };
}

function mountEmbed(scene, host) {
  const frame = document.createElement('iframe');
  frame.className = 'stg-embed'; frame.src = scene.src;
  frame.setAttribute('allow', 'camera; microphone');                   // the root VFX app needs the webcam for the live dust summon
  frame.setAttribute('allowfullscreen', '');
  host.appendChild(frame);
  return () => { frame.src = 'about:blank'; frame.remove(); };          // blanking src tears down the iframe's own camera stream → the LED goes off
}

// Video scenes park by default (freeze on ended/error/cap, teacher taps →
// same as every other scene) — UNLESS the scene sets `autoNext:true`, opt-in
// per scene (v2's one-gesture kickoff flow: the portal-dive clip plays then
// the map loads with zero teacher input). The cap exists so a stalled/
// missing clip can't leave the stage stuck mid-video forever — with
// autoNext it fires `advance()` instead of just freezing.
function mountVideo(scene, host, advance) {
  const capMs = scene.capMs || WATCH_MS_DEFAULT, auto = isAutoNext(scene);
  const wrap = document.createElement('div'); wrap.className = 'stg-video';
  wrap.innerHTML = `<video playsinline autoplay muted></video><div class="stg-skip">chạm để tiếp tục ▶</div>`;
  host.appendChild(wrap);
  const vid = wrap.querySelector('video');
  let frozen = false;
  const freeze = () => {
    if (frozen) return; frozen = true; clearTimeout(capTimer);
    if (auto) { advance(); return; }
    wrap.classList.add('frozen'); try { vid.pause(); } catch {}
  };
  vid.src = scene.src; vid.onended = freeze; vid.onerror = freeze;
  vid.play().catch(() => {});                                          // autoplay can be blocked pre-interaction — the cap timer still catches it
  const capTimer = setTimeout(freeze, capMs);                           // hard cap: enables the frozen/skippable state (or auto-advance)
  return () => { frozen = true; clearTimeout(capTimer); vid.pause(); vid.src = ''; };
}

// Ritual showcase scene — mounts ritual-vortex.js FULLSCREEN with a theme
// (preset name or object, per engine/ritual-theme.js) and drives its charge
// input with a slow sine so the magic circle swells/relaxes in an endless
// breathing loop (same setCharge(c) seam ritual-controller.js feeds from
// gesture/hold progress — read there for the seam, never imported here).
// ↑/↓ while this scene is active cycle live through the 5 motion presets
// (engine/ritual-theme.js's MOTIONS) so the owner can flip variants while
// talking; a small corner label names the current preset, fading after 1s.
const RITUAL_OMEGA = .00055;                                            // full breathe cycle ≈ 11.4s — slow enough to read as "alive", not pulsing
const MOTION_GLYPHS = { orbit: 'say', 'spiral-in': 'if', pulse: 'while', rain: 'read', comet: '==' };   // per-node vocabulary, cosmetic only — echoes each motion's real assignment in the saga (see README's ritual theme table)

function mountRitual(scene, host) {
  const wrap = document.createElement('div'); wrap.className = 'stg-ritual';
  wrap.innerHTML = `<div class="stg-ritual-vfxhost"></div><div class="stg-ritual-label" id="stgrlabel"></div>`;
  host.appendChild(wrap);
  const vfxHost = wrap.querySelector('.stg-ritual-vfxhost'), $label = wrap.querySelector('#stgrlabel');
  let vfx = null, dead = false, raf = 0, labelTimer = 0;
  let motionI = Math.max(0, MOTIONS.indexOf(themeMotion(scene.theme)));

  function themeMotion(theme) {
    if (typeof theme === 'string') return theme;
    if (theme && theme.motion) return theme.motion;
    return MOTIONS[0];
  }
  function showLabel(name) {
    $label.textContent = name; $label.classList.remove('fade');
    clearTimeout(labelTimer); labelTimer = setTimeout(() => $label.classList.add('fade'), 1000);
  }
  function applyMotion(name) {
    if (dead || !self.RitualVortex) return;
    if (vfx) vfx.stop();
    vfx = self.RitualVortex.mount(vfxHost, { theme: { motion: name, glyphs: MOTION_GLYPHS[name] || '' }, cy: .5, ambient: 1, spread: 1.3 });
    showLabel(name);
  }
  function boot() {
    if (dead) return;
    applyMotion(MOTIONS[motionI]);
    let t0 = performance.now();
    const loop = now => {
      if (dead) return;
      const t = now - t0, c = .1 + .85 * (.5 + .5 * Math.sin(t * RITUAL_OMEGA));   // breathes between ~10% and ~95% charge, never fully idle or fully sealed-looking
      if (vfx) vfx.setCharge(c);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  if (self.RitualVortex) boot();
  else { const s = document.createElement('script'); s.src = './ritual-vortex.js'; s.onload = boot; document.head.appendChild(s); }

  function onKey(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    motionI = (motionI + (e.key === 'ArrowUp' ? 1 : MOTIONS.length - 1)) % MOTIONS.length;
    applyMotion(MOTIONS[motionI]);
  }
  return { destroy: () => { dead = true; cancelAnimationFrame(raf); clearTimeout(labelTimer); if (vfx) vfx.stop(); }, onKey };
}

// ── gesture-title scene — the v2 one-gesture kick-off (owner: "chỉ cần 1
// dòng 'Kotopia chờ bạn', xong ritual phát là được, tự động luôn"). ONE
// screen, ZERO keyboard/click required: a breathing title line over the
// living magic circle; the camera pipeline is wired up and armed the
// INSTANT this scene mounts (scene 0 = page load) — no button, no tap, not
// even a first keypress needed to start tracking (owner's sharpened
// requirement). getUserMedia does not require a user gesture, only
// permission, so on an already-granted origin the camera goes hot silently;
// if denied/unsupported the .catch swallows it and the page just stays a
// beautiful ambient title (silent →/Space/click fallback still live via
// stage-player's own top-level handlers). The instant a hand is seen, the
// upgraded fingertip FX (gesture-ui.js's mini circles + glyph trails) is the
// whole "show off our gesture tech" beat, zero instruction needed. Holding
// an open palm (5 fingers) charges the vortex over RITUAL_SEC with
// RITUAL_DECAY soft-decay on drop (same feel as ritual-controller.js's
// #step — copied here, not imported, since that class owns a DOM ritual
// overlay this page doesn't have). Full charge → flash + burst() → auto
// `advance()`. No AudioContext anywhere on this scene: this page may never
// see a user gesture at all, so any sound would risk a browser autoplay
// rejection thrown into a page with no error UI to catch it — simplest safe
// choice is to just not have sound here.
const GT_DENSITY = .35;         // thinned ambient glyph-dust for the fullscreen showcase (owner: "phèn dã man" at the old full COUNT density)
const GT_HINT_IDLE_MS = 7000;   // hint only nags if tracking is LIVE and no hand has been seen this long — never on a page that's simply idle mid-talk

function mountGestureTitle(scene, host, advance) {
  const wrap = document.createElement('div'); wrap.className = 'stg-gtitle';
  wrap.innerHTML = `
    <div class="stg-gtitle-vfxhost"></div>
    <canvas class="stg-gtitle-fx"></canvas>
    <div class="stg-gtitle-fg">
      <h1>${scene.title || 'Kotopia đang chờ bạn'}</h1>
      <p class="stg-gtitle-hint">${scene.hint || 'giơ ✋ lên nào'}</p>
    </div>
    <div class="stg-gflash"></div>`;
  host.appendChild(wrap);
  const vfxHost = wrap.querySelector('.stg-gtitle-vfxhost'), fxCanvas = wrap.querySelector('.stg-gtitle-fx');
  const $hint = wrap.querySelector('.stg-gtitle-hint'), $flash = wrap.querySelector('.stg-gflash');
  const resizeFx = () => { fxCanvas.width = innerWidth; fxCanvas.height = innerHeight; };
  resizeFx(); addEventListener('resize', resizeFx);

  let dead = false, sealed = false, vfx = null;
  let charge = 0, last = performance.now(), lastHandSeen = 0, trackingLive = false;

  function boot() {
    if (dead || !self.RitualVortex) return;
    vfx = self.RitualVortex.mount(vfxHost, { cy: .5, ambient: 1, spread: 1.3, density: GT_DENSITY, theme: scene.theme });
    vfx.setAmbient(1);
  }
  if (self.RitualVortex) boot();
  else { const s = document.createElement('script'); s.src = './ritual-vortex.js'; s.onload = boot; document.head.appendChild(s); }

  // minimal camera/gesture wiring, mirrored from node.js's composition
  // (camera-engine.js + gesture-dispatcher.js own the whole MediaPipe
  // pipeline already — this page just needs its own dispatcher/engine pair,
  // no notebook/booth to share state with).
  const videoEl = document.createElement('video'); videoEl.playsInline = true; videoEl.muted = true; videoEl.style.display = 'none';
  wrap.appendChild(videoEl);
  const dispatcher = new GestureDispatcher({ isRunning: () => false, frozenCheck: () => sealed, boothSummon: () => false, boothEmit: () => {}, hud: () => {} });
  const cam = new CameraEngine(videoEl, { onFrame: res => dispatcher.onHands(res), watchdogActive: () => !sealed });
  cam.ensure().then(() => { trackingLive = true; }).catch(() => {});   // denied/unsupported → silently stays an ambient title page

  const disarmFx = armFullscreenFingertipFx(dispatcher, fxCanvas, { scale: 2.4, isSuccess: () => charge > .05 });

  dispatcher.armFingerGate((count, has) => {
    if (sealed) return;
    const now = performance.now();
    if (has) lastHandSeen = now;
    $hint.classList.toggle('show', trackingLive && lastHandSeen > 0 && (now - lastHandSeen > GT_HINT_IDLE_MS));
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const open = has && count === 5;
    charge = open ? Math.min(1, charge + dt / RITUAL_SEC) : Math.max(0, charge - dt * RITUAL_DECAY / RITUAL_SEC);
    if (vfx) vfx.setCharge(charge);
    if (charge >= 1) seal();
  });

  function seal() {
    if (sealed) return; sealed = true;
    wrap.classList.add('sealed');
    if (vfx) vfx.burst();
    $flash.classList.add('go');
    setTimeout(advance, 900);        // let the flash/burst read before the video scene cuts in
  }

  return () => {
    dead = true; sealed = true;
    removeEventListener('resize', resizeFx);
    dispatcher.disarmFingerGate(); disarmFx();
    cam.release();
    if (vfx) vfx.stop();
  };
}

// mountGestureTitle is exported standalone (not just used internally by
// mount()) so a single-scene host — lessons/entry.js, the saga homepage's
// entry funnel — can reuse the exact same gesture-title implementation
// kickoff.js's deck uses, instead of forking a copy. Its signature was
// already generic (scene, host, advance) with no StagePlayer/stage coupling,
// so no logic changes were needed here — just widening the export list.
if (typeof window !== 'undefined') window.StagePlayer = { mount, StagePlayer, nextIndex, prevIndex, lastGoIndex, clampIndex, isAutoNext, mountGestureTitle };   // guarded: this file is also imported headlessly by test-stage-player.mjs (no DOM there)
export { mount, StagePlayer, nextIndex, prevIndex, lastGoIndex, clampIndex, isAutoNext, mountGestureTitle };
