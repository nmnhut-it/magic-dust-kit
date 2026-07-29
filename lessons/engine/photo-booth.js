// photo-booth.js — Node 1's CAMERA CHARM. Python's camera_charm.photo_booth()
// drives this (the while-loop lives inside the module — student code stays
// loop-free): it asks for one of the three booth signs (kind 'gesture'), then
// conjure/vortex/capture (tell kind 'booth') run the fx over the live camera;
// capture composes a beauty-filtered polaroid with the particle canvas burned
// in and a save link, and breaks the loop.
// NOTE (deviation from the split outline): the constructor also takes
// fxQueue/askGate/outLine/appendOutput — casts and booth acts must serialize
// on the SAME queue (they render onto the same scenePanel/camera), and the
// vortexShare getter is the exact mechanism casting.js uses to "consume" the
// booth's mounted engine on a cast (matching the pre-split single-boothVfx
// behavior) — this coupling is inherent to the original design, not new.
import { ASK_GRACE_MS, GESTURE_HOLD_MS, BOOTH_SIGNS } from './constants.js';
import { fingerAskStub } from './ask-gate.js';
import { armFingertipFx } from './gesture-ui.js';

export class PhotoBooth {
  #vfx = null; #charge = 0; #tween = 0; #summoning = false; #captured = false;
  #scenePanel; #cameraEngine; #gestureDispatcher; #loadVortex; #fxQueue; #askGate; #outLine; #appendOutput;
  #share;
  constructor(scenePanel, { cameraEngine, gestureDispatcher, loadVortex, fxQueue, askGate, outLine, appendOutput }) {
    this.#scenePanel = scenePanel; this.#cameraEngine = cameraEngine; this.#gestureDispatcher = gestureDispatcher;
    this.#loadVortex = loadVortex; this.#fxQueue = fxQueue; this.#askGate = askGate;
    this.#outLine = outLine; this.#appendOutput = appendOutput;
    const self = this;
    this.#share = {
      get vfx() { return self.#vfx; }, set vfx(v) { self.#vfx = v; },
      get captured() { return self.#captured; }, set captured(v) { self.#captured = v; },
    };
  }
  get isSummoning() { return this.#summoning; }
  get vortexShare() { return this.#share; }              // shared with casting.js's ctx
  emit(x, y, n) { if (this.#vfx) this.#vfx.emit(x, y, n); } // open-palm pour, called from GestureDispatcher

  // act('conjure'|'vortex'|'capture') — queued so casts and booth acts serialize.
  act(action) {
    const p = this.#fxQueue.run(() => this.#doBooth(action));
    p.finally(() => setTimeout(() => this.#cameraEngine.release(), 600));
    return p;
  }
  async #doBooth(action) {
    await this.#cameraEngine.ensure().catch(() => {});
    await this.#loadVortex();
    if (!self.RitualVortex) return;
    if (!this.#vfx || this.#captured) {                // first use / rerun after a snap → a fresh engine over the panel
      this.#vfx = self.RitualVortex.mount(this.#scenePanel, { circle: false, ambient: 0, cy: .5 });
      this.#charge = 0; this.#summoning = false; this.#captured = false; cancelAnimationFrame(this.#tween);
    }
    // conjure() arms the summon: while the palm stays open, GestureDispatcher
    // pours motes from the hand itself (no ambient dust — everything on
    // screen is theirs).
    if (action === 'conjure') { this.#summoning = true; this.#scenePanel.querySelector('#scstat').textContent = '✋ xoè bàn tay — bụi phép tuôn ra'; }
    else if (action === 'vortex') { this.#tweenCharge(.85, 1100); this.#scenePanel.querySelector('#scstat').textContent = 'xoáy nước đang cuốn bụi phép của bạn…'; }
    else if (action === 'capture') { this.#captured = true; this.#summoning = false; this.#capturePhoto(); }
  }
  #tweenCharge(to, ms) {
    cancelAnimationFrame(this.#tween);
    const from = this.#charge, t0 = performance.now();
    const f = () => { if (!this.#vfx) return;
      const k = Math.min(1, (performance.now() - t0) / ms);
      this.#charge = from + (to - from) * (k * k * (3 - 2 * k)); this.#vfx.setCharge(this.#charge);
      if (k < 1) this.#tween = requestAnimationFrame(f); };
    this.#tween = requestAnimationFrame(f);
  }

  // watch(): hold ✋ / ☝ / ✌ steady; other counts don't arm the gate.
  gestureAsk() {
    const gateBar = this.#scenePanel.querySelector('#scgate').firstElementChild;
    return new Promise(resolve => {
      let live = true, fxOff = null, target = null;
      const cleanup = () => { if (fxOff) { fxOff(); fxOff = null; } };
      this.#askGate.arm(() => { live = false; cleanup(); this.#gestureDispatcher.disarmFingerGate(); gateBar.style.width = '0%'; resolve('\x18'); });
      // armFingerGate is a 4th tier outside the three shared gate seams
      // (armActHoldGate/armTimedCatchGate/armVerbGate), so it doesn't get
      // fingertip fx for free — arm/disarm explicitly here, mirroring
      // notebook-runner.js's fingerAsk().
      fxOff = armFingertipFx(this.#gestureDispatcher, this.#scenePanel, () => target != null && !!BOOTH_SIGNS[target]);
      this.#cameraEngine.ensure().then(() => {
        if (!live) return;
        this.#scenePanel.querySelector('#scstat').textContent = '✋ rải bụi · ☝ xoáy · ✌ chụp';
        const armT = performance.now();
        let held = 0, last = performance.now();
        this.#gestureDispatcher.armFingerGate((count, has) => {
          const now = performance.now(), dt = now - last; last = now;
          if (now - armT < ASK_GRACE_MS / 2) return;      // shorter settle — booth signs chain quickly (pour→whirl→snap)
          if (!has || !BOOTH_SIGNS[count]) { target = null; held = 0; gateBar.style.width = '0%'; return; }
          if (count !== target) { target = count; held = 0; } else held += dt;
          gateBar.style.width = Math.min(100, held / GESTURE_HOLD_MS * 100) + '%';
          if (held >= GESTURE_HOLD_MS) { this.#gestureDispatcher.disarmFingerGate(); this.#askGate.clear(); cleanup(); gateBar.style.width = '0%';
            this.#outLine(`👁 dấu tay: ${BOOTH_SIGNS[count]} (${count})`); resolve(String(count)); }
        });
      }).catch(() => { if (!live) return;
        cleanup(); this.#outLine('không mở được camera — gõ số ngón tay vào ô nhé'); fingerAskStub(this.#scenePanel, null, this.#askGate, this.#outLine).then(resolve); });
    });
  }

  // ✌ SNAP: mirror the frame, beauty-filter it (tone lift + a soft blurred
  // skin pass), burn in the particle canvas, frame it, and drop a polaroid
  // with a save link into the cell. Ends on the fx: the burst fires and the
  // cam freezes.
  #capturePhoto() {
    const sp = this.#scenePanel;
    const v = sp.querySelector('#cam'), w = v.videoWidth || 640, h = v.videoHeight || 480;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.translate(w, 0); x.scale(-1, 1);
    x.filter = 'brightness(1.07) saturate(1.12) contrast(.97)';
    x.drawImage(v, 0, 0, w, h);
    x.filter = 'blur(5px) brightness(1.05)'; x.globalAlpha = .26; x.drawImage(v, 0, 0, w, h);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none';
    if (this.#vfx) { x.globalCompositeOperation = 'screen'; x.drawImage(this.#vfx.canvas, 0, 0, w, h); x.globalCompositeOperation = 'source-over'; }
    const col = getComputedStyle(document.documentElement).getPropertyValue('--c').trim() || '#78b2a5';
    x.strokeStyle = col; x.lineWidth = Math.max(6, w * .012); x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, w - x.lineWidth, h - x.lineWidth);
    x.fillStyle = col; x.font = `700 ${Math.round(h * .045)}px "Segoe UI",sans-serif`; x.textAlign = 'right';
    x.fillText('✦ magic dust', w - h * .05, h - h * .05);
    const url = c.toDataURL('image/png');
    if (this.#vfx) this.#vfx.burst();
    sp.querySelector('#cam').pause();
    sp.classList.remove('frozen'); void sp.offsetWidth; sp.classList.add('frozen');
    this.#outLine('✌ SNAP!');
    const card = document.createElement('div'); card.className = 'polaroid';
    const img = new Image(); img.src = url; card.appendChild(img);
    const bar = document.createElement('div'); bar.className = 'pbar';
    bar.innerHTML = '<span>✦ captured</span>';
    const a = document.createElement('a'); a.textContent = '⬇ SAVE'; a.download = 'magic-photo.png'; a.href = url;
    bar.appendChild(a); card.appendChild(bar);
    this.#appendOutput(card);
  }
}
