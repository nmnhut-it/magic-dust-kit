// human-layers.js — the HUMAN CHARM behind camera_charm.find_human().
//
// The island teaches one idea: an image is light you can add, and layers stack.
// Everything up to here stacks flat — a plate goes over the whole frame, across
// the learner's face included. Finding the person is what turns a stack into
// DEPTH, so the last thing the island hands over is the mask:
//
//   scene   — a generated backdrop that replaces the room entirely
//   behind  — an FX plate BETWEEN the backdrop and the learner
//   person  — the learner, cut out of the camera and drawn sharp
//   front   — an FX plate IN FRONT of them (petals, dust near the lens)
//
// Same maths the learner wrote by hand: every FX plate is glowing light on
// black, composited with 'lighter'. The only new thing is WHERE in the stack
// each one lands.
//
// Unlike the root app's src/segmentation.js this is PANEL-SCOPED: the lesson
// camera is a 480px box, not the viewport, so the canvases mount inside
// #scenepanel and size to it.
//
// Used by engine/interactive-studio.js for the `human_layers` studio action.

const SEG_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation';
const EMA = 0.45;          // per-inference smoothing; see the note in #onMask
const EVERY = 3;           // infer on 1 render frame in N
const COVER = 1.0;
const MAX_MS = 14000;      // never let a lesson hang on a stalled clip

export class HumanLayers {
  #panel; #video; #seg = null; #frame = 0; #have = false; #busy = false; #stop = false;
  #accum = document.createElement('canvas');
  #person = document.createElement('canvas');
  #solid = document.createElement('canvas');
  #cv; #ctx; #scene = null; #behind = null; #front = null;
  errors = 0; masks = 0; frames = 0;
  get ready() { return this.#have; }

  constructor(panel, video) {
    this.#panel = panel; this.#video = video;
    const c = document.createElement('canvas');
    c.className = 'human-layers';
    panel.appendChild(c);
    this.#cv = c; this.#ctx = c.getContext('2d');
    this.#size();
  }

  #size() {
    const r = this.#panel.getBoundingClientRect(), d = devicePixelRatio || 1;
    this.#cv.width = Math.max(2, r.width * d | 0);
    this.#cv.height = Math.max(2, r.height * d | 0);
  }

  async init() {
    if (!self.SelfieSegmentation) await new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = `${SEG_CDN}/selfie_segmentation.js`; s.crossOrigin = 'anonymous';
      s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
    const seg = new self.SelfieSegmentation({ locateFile: f => `${SEG_CDN}/${f}` });
    seg.setOptions({ modelSelection: 1 });
    seg.onResults(r => this.#onMask(r));
    this.#seg = seg;
  }

  // clips: {scene, behind, front} — each an already-playing <video> or null
  play(clips = {}) {
    this.#scene = clips.scene || null;
    this.#behind = clips.behind || null;
    this.#front = clips.front || null;
    this.#stop = false;
    return new Promise(resolve => {
      const started = performance.now();
      const step = () => {
        if (this.#stop) { resolve('stopped'); return; }
        this.frames++;
        this.#size();
        this.#pump();
        this.#draw();
        if (performance.now() - started > MAX_MS) { resolve('played'); return; }
        // a one-shot behind/front clip ending is the natural end of the beat
        if (this.#behind?.ended || this.#front?.ended) { resolve('played'); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // maskGrid(side) — the mask as PLAIN DATA for camera_charm.human_mask():
  // grid[row][col] is 1 when that cell sits on the person and 0 when it does
  // not. Waits for the model to settle, since the first inferences arrive
  // half-formed and a learner looping over a half-mask sees nonsense.
  async maskGrid(side = 16) {
    for (let tries = 0; tries < 60 && !this.#have; tries++) {
      this.#pump();
      await new Promise(r => setTimeout(r, 100));
    }
    if (!this.#have) return [];
    const a = this.#accum, small = document.createElement('canvas');
    small.width = side; small.height = side;
    const x = small.getContext('2d', { willReadFrequently: true });
    // mirror it, so a cell on the learner's right is on the right of the grid
    x.setTransform(-1, 0, 0, 1, side, 0);
    x.drawImage(a, 0, 0, side, side);
    const data = x.getImageData(0, 0, side, side).data, grid = [];
    for (let r = 0; r < side; r++) {
      const line = [];
      for (let c = 0; c < side; c++) line.push(data[(r * side + c) * 4 + 3] > 110 ? 1 : 0);
      grid.push(line);
    }
    return grid;
  }

  // stop() removes the canvas; freeze() only halts the loop and leaves the last
  // composite sitting there. A run that ends by deleting its own output leaves
  // the learner staring at a bare camera feed, which reads as "my effect never
  // happened" — the result has to outlive the cell that made it.
  stop() { this.#stop = true; this.#cv.remove(); }
  freeze() { this.#stop = true; this.#cv.classList.add('result-frozen'); }

  async #pump() {
    if (!this.#seg || this.#busy) return;
    const v = this.#video;
    // a 0x0 video makes the graph throw createImageBitmap from inside its own
    // onResults, where the caller cannot see it
    if (!v || !v.videoWidth || !v.videoHeight || v.readyState < 2) return;
    if (this.#frame++ % EVERY) return;
    this.#busy = true;
    try { await this.#seg.send({ image: v }); }
    catch { this.errors++; }
    finally { this.#busy = false; }
  }

  #onMask(r) {
    const m = r && r.segmentationMask;
    if (!m || !m.width || !m.height) return;
    this.masks++;
    const a = this.#accum;
    if (a.width !== m.width) {
      a.width = m.width; a.height = m.height;
      for (const c of [this.#person, this.#solid]) { c.width = m.width; c.height = m.height; }
    }
    const x = a.getContext('2d');
    // Fade the old mask BY EMA and add EMA*new, so a steady mask converges to
    // fully opaque. Erasing at alpha 1 here is a wipe, not a fade, and caps the
    // silhouette at EMA — a translucent person that the FX shines through.
    x.globalCompositeOperation = 'destination-out'; x.globalAlpha = EMA;
    x.fillStyle = '#000'; x.fillRect(0, 0, a.width, a.height);
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = EMA; x.drawImage(m, 0, 0);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    this.#have = true;
  }

  // S-curve so occlusion is decisive: square (kills background haze), then two
  // 'lighter' self-composites (v -> 1-(1-v)^2) to drive the body solid.
  #solidMask() {
    const s = this.#solid, x = s.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, s.width, s.height);
    x.drawImage(this.#accum, 0, 0);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(this.#accum, 0, 0);
    x.globalCompositeOperation = 'lighter'; x.drawImage(s, 0, 0); x.drawImage(s, 0, 0);
    x.globalCompositeOperation = 'source-over';
    return s;
  }

  #cutout() {
    const p = this.#person, x = p.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, p.width, p.height);
    x.drawImage(this.#solidMask(), 0, 0);
    x.globalCompositeOperation = 'source-in'; x.drawImage(this.#video, 0, 0, p.width, p.height);
    x.globalCompositeOperation = 'source-over';
    return p;
  }

  // cover-fit + the mirror the lesson camera applies in CSS
  #blit(src, mirror, blend = 'source-over', alpha = 1) {
    const ctx = this.#ctx, W = this.#cv.width, H = this.#cv.height;
    const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    if (!sw || !sh) return;
    const s = Math.max(W / sw, H / sh) * COVER, dw = sw * s, dh = sh * s;
    ctx.save();
    ctx.globalCompositeOperation = blend; ctx.globalAlpha = alpha;
    if (mirror) ctx.setTransform(-1, 0, 0, 1, W, 0);
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  #draw() {
    const ctx = this.#ctx, W = this.#cv.width, H = this.#cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // No mask yet — nobody in frame, or a covered lens. Draw the show ANYWAY,
    // just flat: backdrop and both plates, with no cut-out between them. An
    // empty stage reads as a broken program; a flat show reads as exactly what
    // it is, and the depth appears the moment a person does.
    const person = this.#have ? this.#cutout() : null;
    if (this.#scene) this.#blit(this.#scene, false);
    if (this.#behind) this.#blit(this.#behind, false, 'lighter');
    if (person) this.#blit(person, true);
    if (this.#front) this.#blit(this.#front, false, 'lighter');
  }
}
