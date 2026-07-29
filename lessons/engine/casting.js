// casting.js — spell-cast + screen-fx presentation over the shared scene
// panel. Plain functions, no `this`: every function takes the scenePanel
// element (and, for cast, a small ctx bag) explicitly. Casting = the ROOT
// app's arc with the ROOT app's ENGINE: spell-vfx.js is the real WebGL mote
// system + UnrealBloomPass (a verbatim port of src/main.js, lazy ES-module
// import). The canvas-2D RitualVortex stays as the cast fallback if the
// module can't load, sharing the mounted engine with the photo booth via the
// `vortexShare` object every caller passes in (so a cast can "consume" the
// booth's mounted vortex exactly like the pre-split code did).
import { FX, BURST_SPARKS, CAST_WIND_MS } from './constants.js';

// The cast burst: flash + shockwave + embers flung outward in the spell color.
export function burst(scenePanel) {
  const old = scenePanel.querySelector('.burst'); if (old) old.remove();
  const b = document.createElement('div'); b.className = 'burst';
  b.innerHTML = '<i class="bflash"></i><i class="bwave"></i>';
  for (let i = 0; i < BURST_SPARKS; i++) {
    const s = document.createElement('i'); s.className = 'bspark';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 170, z = 3 + Math.random() * 6;
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    s.style.width = s.style.height = z + 'px'; s.style.animationDelay = Math.random() * .12 + 's';
    b.appendChild(s);
  }
  scenePanel.appendChild(b);
}

// End on the fx: freeze the camera (pause + dim, HUD off), fire the burst,
// and leave the result as the panel's final frame. mountScene() thaws it.
export function showFx(scenePanel, big, sub, color) {
  scenePanel.style.setProperty('--c', color);
  scenePanel.querySelector('#cam').pause();
  scenePanel.classList.remove('frozen'); void scenePanel.offsetWidth; scenePanel.classList.add('frozen');
  scenePanel.querySelector('.vortex').style.opacity = '0';
  burst(scenePanel);
  const r = scenePanel.querySelector('.result');
  r.classList.remove('pixels');
  r.firstElementChild.textContent = big;
  r.firstElementChild.style.textShadow = `0 0 30px ${color},0 0 80px ${color}`;
  r.lastElementChild.textContent = sub;
  r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
}
export function showValue(scenePanel, v) { showFx(scenePanel, String(v), 'output', '#78b2a5'); }

// pixel_display(grid) (camera_charm): Python already renders the 0/1 grid to
// a '\n'-joined block-character string (see py/camera_charm/__init__.py) —
// this just freezes the frame and drops that text, verbatim, into the same
// AR result slot showFx() uses, switched to a monospace/pre-wrap look via
// the .pixels modifier (node.css) so rows line up as a little picture.
export function showPixels(scenePanel, text) {
  scenePanel.style.setProperty('--c', '#78b2a5');
  scenePanel.querySelector('#cam').pause();
  scenePanel.classList.remove('frozen'); void scenePanel.offsetWidth; scenePanel.classList.add('frozen');
  scenePanel.querySelector('.vortex').style.opacity = '0';
  burst(scenePanel);
  const r = scenePanel.querySelector('.result');
  r.classList.add('pixels');
  r.firstElementChild.textContent = text;
  r.firstElementChild.style.textShadow = 'none';
  r.lastElementChild.textContent = 'pixel_display()';
  r.classList.remove('show'); void r.offsetWidth; r.classList.add('show');
}

// screenFx modes: the machine's SCREEN is the output. Two kinds:
//   'wash'  — lighten()/darken(), a light/dark overlay on #sclight (mutually
//             exclusive with each other, unrelated to 'cam' modes below)
//   'cam'   — a pure-CSS filter/transform class on #cam itself (sepia/
//             invert/grayscale/mirror) — cheap "webcam filter" recipes, no
//             new WebGL/canvas work, just a class toggle (see node.css). Also
//             mutually exclusive among themselves (one filter class at a time).
// Either kind PERSISTS until the next screen change or the next RUN
// (mountScene() clears both). 'shake' is a one-shot CSS animation, no persisted state.
const SCREEN_FX = {
  lighten: { kind: 'wash', cls: 'up', label: '☀ màn hình sáng bừng lên' },
  darken: { kind: 'wash', cls: 'down', label: '🌙 màn hình tối sầm lại' },
  sepia: { kind: 'cam', cls: 'fx-sepia', label: '📜 màn hình ngả vàng cổ điển' },
  invert: { kind: 'cam', cls: 'fx-invert', label: '🌀 màu sắc đảo ngược hết' },
  grayscale: { kind: 'cam', cls: 'fx-gray', label: '⚫⚪ màn hình về đen trắng' },
  mirror: { kind: 'cam', cls: 'fx-mirror', label: '🪞 hình ảnh lật lại đúng chiều thật' },
  blur: { kind: 'cam', cls: 'fx-blur', label: '🌫 hình ảnh được làm mờ' },
  sharpen: { kind: 'cam', cls: 'fx-sharpen', label: '🔎 đường nét được tăng tương phản' },
  rotate: { kind: 'cam', cls: 'fx-rotate', label: '🖐 hình ảnh xoay theo hướng bàn tay' },
  shake: { kind: 'shake', label: '💥 màn hình rung lên' },
};
const CAM_FX_CLASSES = ['fx-sepia', 'fx-invert', 'fx-gray', 'fx-mirror', 'fx-blur', 'fx-sharpen', 'fx-rotate'];

export function screenFx(scenePanel, mode, outLine) {
  const cfg = SCREEN_FX[mode] || SCREEN_FX.lighten;
  if (cfg.kind === 'wash') {
    let l = scenePanel.querySelector('#sclight');
    if (!l) { l = document.createElement('i'); l.id = 'sclight'; scenePanel.appendChild(l); }
    l.className = cfg.cls;
    scenePanel.classList.remove(...CAM_FX_CLASSES);
  } else if (cfg.kind === 'cam') {
    const l = scenePanel.querySelector('#sclight'); if (l) l.className = '';
    scenePanel.classList.remove(...CAM_FX_CLASSES);
    scenePanel.classList.add(cfg.cls);
  } else if (cfg.kind === 'shake') {
    scenePanel.classList.remove('fx-shake'); void scenePanel.offsetWidth; scenePanel.classList.add('fx-shake');
    setTimeout(() => scenePanel.classList.remove('fx-shake'), 500);
  }
  scenePanel.querySelector('#scstat').textContent = cfg.label;
  outLine(`${cfg.label.split(' ')[0]} ${mode}()`);
}

let spellVfx = null, spellVfxLoading = null, spellEngine = null;
function loadSpellVfx() {
  spellVfxLoading ||= import('./spell-vfx.js').then(m => { spellVfx = m; }).catch(() => {});
  return spellVfxLoading;
}

// castSpell(name, ctx) — ctx: {scenePanel, fxQueue, vortexShare, loadVortex}.
// fxQueue serializes casts against booth acts (same queue instance); the
// caller is responsible for releasing the camera after fxQueue settles.
export function castSpell(name, ctx) {
  const s = FX[name] || { label: String(name).toUpperCase(), color: '#78b2a5', bloom: 2.8 };
  ctx.fxQueue.run(() => doCast(s, name, ctx));
}

async function doCast(s, name, { scenePanel, vortexShare, loadVortex }) {
  scenePanel.style.setProperty('--c', s.color);
  scenePanel.querySelector('#scstat').textContent = 'bụi phép đang tụ lại…';
  scenePanel.classList.add('casting');                // darken the camera plate — additive dust needs darkness (root: updatePresence)
  await loadSpellVfx();
  if (spellVfx) {
    spellEngine ||= spellVfx.mount(scenePanel);       // one engine per page, remounts with the panel wherever it goes
    await spellEngine.cast(s.color, s.bloom);         // resolves at the detonation
    scenePanel.classList.remove('casting');
    showFx(scenePanel, s.label, name + '()', s.color);
    return;
  }
  scenePanel.classList.remove('casting');
  await loadVortex();                                 // fallback: the canvas-2D replica
  if (!self.RitualVortex) { showFx(scenePanel, s.label, name + '()', s.color); return; }
  vortexShare.vfx = self.RitualVortex.mount(scenePanel, { circle: false, cy: .5 });
  vortexShare.captured = true;                        // the cast consumes the engine — booth remounts fresh next use
  await new Promise(res => {
    const t0 = performance.now();
    const f = () => { const k = Math.min(1, (performance.now() - t0) / CAST_WIND_MS);
      vortexShare.vfx.setCharge(k * k * (3 - 2 * k));
      if (k < 1) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
  showFx(scenePanel, s.label, name + '()', s.color);
  vortexShare.vfx.burst();                            // the funnel detonates over the frozen frame
  vortexShare.vfx.setAmbient(0);                       // …and the ambient dust dies with it — nothing drifts over the result forever
}

// createFxQueue() — the serialization queue casts and booth acts share (one
// "spell at a time" over the live camera). busy>0 also feeds the camera
// release gate (a cast/booth fx over the live cam is a camera user too).
export function createFxQueue() {
  let q = Promise.resolve(), busy = 0;
  return {
    get busy() { return busy; },
    run(fn) { busy++; q = q.then(fn).catch(() => {}).finally(() => { busy--; }); return q; },
  };
}
