// interactive-studio.js — hand-tracked sticker, gift, and particle output for
// camera_charm's JSON bridge. Python chooses the design; this class owns the
// camera/landmark loop and keeps raw MediaPipe data out of learner code.
import { CAPTURE_W, CAPTURE_H } from './camera-engine.js';
import { coverMap } from './gesture-math.js';
import { alignWalkthrough } from './walkthrough-cell.js';
import { buildImageLab } from './image-lab.js';
import { startVoiceGate } from './voice-gate.js';
import { wordHits } from './chant-match.js';
import { HumanLayers } from './human-layers.js';
import { mountMicMeter } from './mic-meter.js';
// The named stills live in engine/plates.js — the hand-editing cell seeds its
// board from the same table and must not drag the camera stack along.
import { IMAGE_PLATES } from './plates.js';

const MOTIONS = new Set(['orbit', 'spiral-in', 'rain', 'pulse', 'comet']);
const PHOTO_LIGHT_MODES = new Set(['steady', 'off', 'shift']);
const PHOTO_LIGHT_COLORS = { green: '#78b2a5', red: '#9b3845', yellow: '#f4c85a', blue: '#78b2a5', white: '#fffdf5', purple: '#78b2a5' };
const PHOTO_LIGHT_LABELS = { green: 'XANH LÁ', red: 'ĐỎ', yellow: 'VÀNG', blue: 'XANH DƯƠNG', white: 'TRẮNG', purple: 'TÍM' };
const ANCHOR_INDEX = { wrist: 0, palm: 9, index_tip: 8 };
const DEFAULT_STYLE = { color: '#78b2a5', symbols: '', motion: 'orbit', size: 1, density: 1, glow: 1 };
const CAMERA_START_MS = 6000;
const HANDS_WARMUP_MS = 4000;      // cap on waiting for MediaPipe Hands' first frame
const HAND_READ_MS = 1500, PARTICLE_FRAME_CAP = 120, IMAGE_FRAME_MAX_W = 64, IMAGE_FRAME_MAX_H = 48;
// A grid is two different things at two different moments. Up to ~16 cells a
// side it is a TEACHING object: every cell is a readable number. Past that it
// is the actual picture, which is what a learner must transform once the
// numbers are understood — their flip has to produce a real flipped dragon,
// not a plausible-looking mush. The ceiling is the plates' own 512px, but the
// cost is not in the learner's loop (~150ms at 512) — it is in moving three
// grids of JSON across the bridge and back: measured end to end, 256 lands
// under a second and 512 takes 2-3.5s per RUN. Lessons use 256; the lab draws
// a frame at ~200-380px anyway, so 512 buys almost no visible detail.
const IMAGE_GRID_MIN = 8, IMAGE_GRID_MAX = 512, IMAGE_GRID_SAMPLE = 'assets/pixel-art-magic-owl.webp';
// The real moving plates the root camera app summons. A learner who has just
// written the add-and-clamp blend on a 16x16 grid gets to fire the full-size
// version of the same idea over their own camera: each clip is glowing light
// on black, screen-blended, i.e. the blend they wrote, at 1280x720x24fps.
const EFFECT_CLIPS = {
  dragon: 'assets/camera-effects/overlays/dragon-strike.mp4',
  rose: 'assets/camera-effects/overlays/spirit-rose.mp4',
  stag: 'assets/camera-effects/overlays/koto-stag.mp4',
  phoenix: 'assets/camera-effects/overlays/spirit-phoenix.mp4',
  butterfly: 'assets/camera-effects/overlays/crystal-butterflies.mp4',
  sakura: 'assets/camera-effects/overlays/sakura-bloom.mp4',
  smoke: 'assets/camera-effects/overlays/smoke-blue.mp4',
  // Copied from the AR fight's plate set (ar-boss/plate-fx.js) so lessons/ ships
  // every clip it names: without it play_effect("boss") summoned the dragon.
  boss: 'assets/camera-effects/overlays/boss-curse.mp4',
  lightning: 'assets/camera-effects/overlays/lightning-ground.mp4',
};
const EFFECT_MAX_MS = 12000;
// Backdrop plates: a whole scene to stand BEHIND the learner once the human
// charm has found them. Same family as EFFECT_CLIPS, different job.
const SCENE_CLIPS = {
  forest: 'assets/camera-effects/overlays/bg-enchanted-forest.mp4',
};
// Which plates read as NEAR the lens. Petals and dust belong in front of the
// caster; a creature or an atmosphere belongs behind. This near/far split is
// the whole point of finding the human, so it lives next to the clips.
const FRONT_CLIPS = new Set(['sakura', 'flower', 'dust']);

const clamp = (value, min, max, fallback) => { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };
const shortText = (value, max, fallback = '') => { const chars = [...String(value ?? fallback)]; return chars.slice(0, max).join(''); };
const safeColor = value => {
  const color = String(value || '');
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  return rgb && rgb.slice(1).every(channel => Number(channel) <= 255) ? color : DEFAULT_STYLE.color;
};
const parsePayload = raw => { try { const v = JSON.parse(String(raw || '{}')); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const imageChannel = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(255, Math.trunc(value))) : 0;

function mountParticleGuide(host, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  host.classList.add('guided');
  const guide = document.createElement('aside'); guide.className = 'studio-particle-guide';
  const action = document.createElement('b'); action.textContent = shortText(raw.action, 28, 'QUAN SÁT');
  const title = document.createElement('strong'); title.textContent = shortText(raw.title, 70, 'Trạng thái của particle');
  guide.append(action, title);
  if (raw.formula) { const formula = document.createElement('code'); formula.textContent = shortText(raw.formula, 80); guide.appendChild(formula); }
  const fields = Array.isArray(raw.fields) ? raw.fields.slice(0, 5) : [];
  if (fields.length) {
    const state = document.createElement('div'); state.className = 'studio-particle-state';
    fields.forEach(field => { const item = document.createElement('span'); item.textContent = `${shortText(field?.label, 16, 'value')} ${shortText(field?.value, 18, '—')}`; state.appendChild(item); });
    guide.appendChild(state);
  }
  if (raw.caption) { const caption = document.createElement('p'); caption.textContent = shortText(raw.caption, 150); guide.appendChild(caption); }
  host.appendChild(guide);
}

export function normalizePhotoLightColors(input) {
  const source = Array.isArray(input) ? input.slice(0, 12) : [];
  const colors = source.map(value => PHOTO_LIGHT_COLORS[String(value || '').toLowerCase()] || safeColor(value)).filter(Boolean);
  return colors.length ? colors : [PHOTO_LIGHT_COLORS.green, PHOTO_LIGHT_COLORS.red, PHOTO_LIGHT_COLORS.yellow];
}

export function photoLightSlots() {
  const slots = [];
  for (let i = 0; i < 9; i++) slots.push({ x: 8 + i * 10.5, y: 5 });
  for (let i = 1; i < 6; i++) slots.push({ x: 92, y: 5 + i * 15 });
  for (let i = 8; i >= 0; i--) slots.push({ x: 8 + i * 10.5, y: 95 });
  for (let i = 5; i >= 1; i--) slots.push({ x: 8, y: 5 + i * 15 });
  return slots;
}

export function photoLightFrame(input, mode = 'steady', step = 0) {
  const colors = normalizePhotoLightColors(input), safeMode = PHOTO_LIGHT_MODES.has(mode) ? mode : 'steady';
  const phase = Number.isFinite(Number(step)) ? Math.max(0, Math.trunc(Number(step))) : 0;
  return photoLightSlots().map((position, index) => ({
    ...position,
    color: colors[(index + (safeMode === 'shift' ? phase : 0)) % colors.length],
    on: safeMode !== 'off',
  }));
}

export function pickLocalPhoto() {
  if (typeof document === 'undefined' || typeof FileReader === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    let settled = false; const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => finish(null), 120000);
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file || !String(file.type || '').startsWith('image/') || file.size > 12 * 1024 * 1024) { finish(null); return; }
      const reader = new FileReader(); reader.onload = () => finish(typeof reader.result === 'string' ? reader.result : null); reader.onerror = () => finish(null); reader.readAsDataURL(file);
    }, { once: true });
    input.click();
  });
}

export function normalizeImageFrame(input) {
  if (!Array.isArray(input) || !input.length || !Array.isArray(input[0]) || !input[0].length) return null;
  const height = Math.min(input.length, IMAGE_FRAME_MAX_H), width = Math.min(input[0].length, IMAGE_FRAME_MAX_W);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const sourceRow = Array.isArray(input[row]) ? input[row] : [];
    for (let col = 0; col < width; col++) {
      const pixel = sourceRow[col], offset = (row * width + col) * 4;
      if (!Array.isArray(pixel) || (pixel.length !== 3 && pixel.length !== 4)) continue;
      data[offset] = imageChannel(pixel[0]); data[offset + 1] = imageChannel(pixel[1]); data[offset + 2] = imageChannel(pixel[2]);
      data[offset + 3] = pixel.length === 4 ? imageChannel(pixel[3]) : 255;
    }
  }
  return { width, height, data };
}

export function rgbaToImageGrid(data, width, height) {
  const safeWidth = Math.max(0, Math.trunc(Number(width) || 0)), safeHeight = Math.max(0, Math.trunc(Number(height) || 0));
  if (!data || data.length < safeWidth * safeHeight * 4 || !safeWidth || !safeHeight) return [];
  const grid = [];
  for (let row = 0; row < safeHeight; row++) {
    const line = [];
    for (let col = 0; col < safeWidth; col++) {
      const offset = (row * safeWidth + col) * 4;
      line.push([imageChannel(data[offset]), imageChannel(data[offset + 1]), imageChannel(data[offset + 2])]);
    }
    grid.push(line);
  }
  return grid;
}

export function decodeImageGrid(source, size = 16) {
  if (typeof document === 'undefined' || !source) return Promise.resolve([]);
  const side = Math.round(clamp(size, IMAGE_GRID_MIN, IMAGE_GRID_MAX, 16));
  return new Promise(resolve => {
    const image = document.createElement('img');
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || typeof ctx.drawImage !== 'function' || typeof ctx.getImageData !== 'function') { resolve([]); return; }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0, side, side);
      resolve(rgbaToImageGrid(ctx.getImageData(0, 0, side, side).data, side, side));
    };
    image.onerror = () => resolve([]);
    image.src = source;
  });
}

export function normalizeStudioStyle(input = {}) {
  return {
    color: safeColor(input.color),
    symbols: shortText(input.symbols, 12),
    motion: MOTIONS.has(input.motion) ? input.motion : DEFAULT_STYLE.motion,
    size: clamp(input.size, .5, 2, DEFAULT_STYLE.size),
    density: clamp(input.density, .15, 1, DEFAULT_STYLE.density),
    glow: clamp(input.glow, .5, 2, DEFAULT_STYLE.glow),
  };
}

export function studioAnchorPoint(lm, anchor = 'palm') {
  const idx = ANCHOR_INDEX[anchor] ?? ANCHOR_INDEX.palm;
  const p = lm && lm[idx];
  return p ? { x: 1 - p.x, y: p.y } : { x: .5, y: .5 };
}

export class InteractiveStudio {
  #scenePanel; #cameraEngine; #gestureDispatcher; #loadVortex; #getVortex; #outLine;
  #pickPhoto; #decodePhoto; #wait;
  #active = false; #cameraAvailable = false; #style = { ...DEFAULT_STYLE }; #vfx = null; #lastLm = null;
  #stickers = []; #staticStickers = []; #particleFrame = null; #photoProject = null; #photoLampHost = null; #photoStartEl = null; #photoStartResolve = null; #photoSrc = null; #photoManualColors = [];
  #lightBoard = null; #lightBulbs = null; #lightGrid = null; #lightStartEl = null; #lightStartResolve = null;
  #gifts = new Set(); #bursts = new Set(); #titleEl = null; #off = null; #stopTimer = null; #pendingHand = null;
  constructor(scenePanel, { cameraEngine, gestureDispatcher, loadVortex, outLine, getVortex, pickPhoto, decodePhoto, wait } = {}) {
    this.#scenePanel = scenePanel; this.#cameraEngine = cameraEngine; this.#gestureDispatcher = gestureDispatcher;
    this.#loadVortex = loadVortex || (() => Promise.resolve()); this.#outLine = outLine || (() => {});
    this.#getVortex = getVortex || (() => globalThis.RitualVortex);
    this.#pickPhoto = pickPhoto || pickLocalPhoto; this.#decodePhoto = decodePhoto || decodeImageGrid; this.#wait = wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.#off = this.#gestureDispatcher.onLandmarks((lm, has) => this.#onLandmarks(lm, has));
  }
  get isActive() { return this.#active; }
  get cameraAvailable() { return this.#cameraAvailable; }

  async start(raw) {
    const cfg = parsePayload(raw);
    if (cfg.action === 'photo_upload') return this.#uploadPhoto();
    if (cfg.action === 'image_pick_grid') return this.#readImageGrid(cfg, true);
    if (cfg.action === 'image_sample_grid') return this.#readImageGrid(cfg, false);
    if (cfg.action === 'image_plate_grid') return this.#readPlateGrid(cfg);
    if (cfg.action === 'frame_compare') return this.#compareFrames(cfg);
    if (cfg.action === 'voice_listen') return this.#listenForWord(cfg);
    if (cfg.action === 'effect_play') return this.#playEffectClip(cfg);
    if (cfg.action === 'light_board_start') return this.#startLightBoard();
    if (cfg.action === 'light_board_clear') return this.#clearLightBulbs();
    if (cfg.action === 'light_board_bulb') return this.#placeLightBulb(cfg);
    if (cfg.action === 'light_board_grid') return this.#showLightGrid(cfg);
    if (cfg.action === 'photo_start') return this.#startPhotoLights();
    if (cfg.action === 'delay') return this.#delay(cfg);
    if (cfg.action === 'photo_lights') return this.#showPhotoLights(cfg);
    if (cfg.action === 'photo_light') return this.#setPhotoLight(cfg);
    if (cfg.action === 'particle_stage_start') return this.#startParticleStage(cfg);
    if (cfg.action === 'particle_frame') return this.drawParticleFrame(JSON.stringify(cfg));
    this.stop();
    this.#active = true; this.#renderTitle(shortText(cfg.title, 40, 'My Live Studio'));
    await this.#ensureVfx();
    let timeout = null;
    try {
      const opened = this.#cameraEngine.ensure().then(() => true, () => false);
      this.#cameraAvailable = await Promise.race([opened, new Promise(resolve => { timeout = setTimeout(() => resolve(false), CAMERA_START_MS); })]);
    } catch { this.#cameraAvailable = false; }
    if (timeout) clearTimeout(timeout);
    if (!this.#active) return 'unavailable';
    const stat = this.#scenePanel.querySelector('#scstat');
    if (this.#cameraAvailable) { if (stat) stat.textContent = 'studio đang theo dõi bàn tay'; return 'ready'; }
    if (stat) stat.textContent = 'studio đang ở chế độ xem trước';
    this.#outLine('không mở được camera — studio chuyển sang chế độ xem trước');
    this.#positionAll();
    return 'unavailable';
  }

  handle(raw) {
    const cfg = parsePayload(raw);
    if (cfg.action === 'particle_style') { this.#style = normalizeStudioStyle(cfg); if (this.#active) this.#mountVfx(); }
    else if (cfg.action === 'sticker_attach') this.#attachSticker(cfg);
    else if (cfg.action === 'sticker_clear') this.clearStickers();
    else if (cfg.action === 'sticker_at') this.#drawStickerAt(cfg);
    else if (cfg.action === 'studio_frame_clear') this.clearStudioFrame();
    else if (cfg.action === 'gift') this.#sendGift(cfg);
    else if (cfg.action === 'particle_burst') this.#particleBurst(cfg.anchor);
    else if (cfg.action === 'studio_stop') this.stop();
  }

  clearStickers() { this.#stickers.forEach(s => s.el.remove()); this.#stickers = []; }
  clearStudioFrame() {
    this.#staticStickers.forEach(el => el.remove()); this.#staticStickers = [];
    if (this.#particleFrame) this.#particleFrame.remove(); this.#particleFrame = null;
  }
  async #uploadPhoto() {
    this.stop(); this.#active = true;
    const src = await this.#pickPhoto(); this.#photoSrc = typeof src === 'string' && src ? src : null;
    this.#mountPhotoProject();
    const stat = this.#scenePanel.querySelector('#scstat');
    if (this.#photoSrc) { if (stat) stat.textContent = 'đã đặt ảnh vào khung'; return 'uploaded'; }
    if (stat) stat.textContent = 'đang dùng ảnh mẫu';
    this.#outLine('bạn chưa chọn ảnh hoặc ảnh lớn hơn 12 MB — máy dùng nền mẫu để tiếp tục');
    return 'demo';
  }
  async #readImageGrid(cfg, shouldPick) {
    this.stop(); this.#active = true;
    const picked = shouldPick ? await this.#pickPhoto() : null;
    this.#photoSrc = typeof picked === 'string' && picked ? picked : IMAGE_GRID_SAMPLE;
    const side = Math.round(clamp(cfg.size, IMAGE_GRID_MIN, IMAGE_GRID_MAX, 16));
    const grid = await this.#decodePhoto(this.#photoSrc, side);
    this.#mountPhotoProject();
    const stat = this.#scenePanel.querySelector('#scstat');
    if (stat) stat.textContent = picked ? `đã đọc ảnh thành bảng ${side}×${side}` : `đang dùng ảnh mẫu ${side}×${side}`;
    if (shouldPick && !picked) this.#outLine('bạn chưa chọn ảnh — máy dùng tranh cú phép thuật để bài vẫn chạy được');
    return JSON.stringify(Array.isArray(grid) ? grid : []);
  }
  // Flatten the camera and the plate into one still so the result survives the
  // cell that made it. Screen-blend, exactly as the CSS does live, or the saved
  // frame would be a flat paste of the plate over the picture.
  #freezeClip(clip, raw) {
    const panel = this.#scenePanel, r = panel.getBoundingClientRect();
    const w = Math.max(2, r.width | 0), h = Math.max(2, r.height | 0);
    const still = document.createElement('canvas');
    still.className = 'studio-result-still'; still.width = w; still.height = h;
    const ctx = still.getContext('2d');
    if (!ctx) return;
    const cam = panel.querySelector('#cam');
    const cover = (src, sw, sh, blend) => {
      if (!sw || !sh) return;
      ctx.save(); ctx.globalCompositeOperation = blend || 'source-over';
      const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
      ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh); ctx.restore();
    };
    if (!raw && cam) cover(cam, cam.videoWidth, cam.videoHeight);
    cover(clip, clip.videoWidth, clip.videoHeight, raw ? 'source-over' : 'screen');
    panel.appendChild(still);
  }

  #clearResultStill() {
    for (const el of this.#scenePanel.querySelectorAll('.studio-result-still, .human-layers.result-frozen')) el.remove();
  }

  // Take the whole screen for a performance and give it back afterwards.
  // Nothing else changes — the same panel, the same canvases, just big enough
  // to be the point of the exercise rather than a thumbnail beside it.
  #enterStage(caption) {
    this.#scenePanel.classList.add('stage-full');
    document.body.classList.add('stage-full-on');
    let tag = this.#scenePanel.querySelector('.stage-note');
    if (!tag) { tag = document.createElement('div'); tag.className = 'stage-note'; this.#scenePanel.appendChild(tag); }
    tag.textContent = caption || 'Pip đang chạy đoạn code của bạn…';
  }
  #exitStage() {
    this.#scenePanel.classList.remove('stage-full');
    document.body.classList.remove('stage-full-on');
    const tag = this.#scenePanel.querySelector('.stage-note');
    if (tag) tag.remove();
  }

  // human_mask — the mask as PLAIN DATA: a grid of 1 (this cell is on the
  // person) and 0 (it is not). find_human reads as magic because the stacking
  // is hidden inside it; handing over the same answer as a grid lets a learner
  // loop over it and colour the person in by hand, which is all the charm is.
  async #readHumanMask(cfg) {
    this.stop(); this.#active = true;
    const side = Math.round(clamp(cfg.size, IMAGE_GRID_MIN, IMAGE_GRID_MAX, 16));
    let camTimer = null;
    try {
      const opened = this.#cameraEngine.ensure().then(() => true, () => false);
      this.#cameraAvailable = await Promise.race([opened, new Promise(r => { camTimer = setTimeout(() => r(false), CAMERA_START_MS); })]);
    } catch { this.#cameraAvailable = false; }
    if (camTimer) clearTimeout(camTimer);
    const video = this.#scenePanel.querySelector('#cam');
    if (!this.#cameraAvailable || !video) { this.#outLine('chưa mở được camera'); return '[]'; }
    const layers = new HumanLayers(this.#scenePanel, video);
    // Wait for Hands to be running before a second MediaPipe solution loads —
    // see camera-engine.js#handsRunning for why loading both at once kills
    // hand tracking outright. Capped: if Hands never reports (a camera that
    // opened but sees nothing), the mask must still get its chance rather than
    // leaving the learner's cell hanging on a promise that never settles.
    await Promise.race([this.#cameraEngine.handsRunning(), this.#wait(HANDS_WARMUP_MS)]);
    try { await layers.init(); } catch { layers.stop(); this.#outLine('chưa tải được bùa tìm người'); return '[]'; }
    const grid = await layers.maskGrid(side);
    layers.stop(); this.stop();
    if (!grid.length) this.#outLine('chưa thấy người trong khung hình — hãy lùi ra cho camera thấy bạn');
    return JSON.stringify(grid);
  }

  // human_layers — the payoff of the whole island: find the person, then stack
  // scene / behind / person / front so the FX has actual DEPTH instead of
  // washing over the learner's face. Everything else in the island composites
  // flat; this is the same add-the-light rule with a place in the order.
  async #setHumanLayers(cfg) {
    this.stop(); this.#active = true;
    let camTimer = null;
    try {
      const opened = this.#cameraEngine.ensure().then(() => true, () => false);
      this.#cameraAvailable = await Promise.race([opened, new Promise(r => { camTimer = setTimeout(() => r(false), CAMERA_START_MS); })]);
    } catch { this.#cameraAvailable = false; }
    if (camTimer) clearTimeout(camTimer);
    const video = this.#scenePanel.querySelector('#cam');
    if (!this.#cameraAvailable || !video) { this.#outLine('chưa mở được camera — bài này cần thấy bạn thì mới xếp lớp được'); return 'no-camera'; }

    const clip = (name, table) => {
      const src = table[shortText(name, 16)];
      if (!src) return null;
      const v = document.createElement('video');
      v.src = src; v.muted = true; v.playsInline = true; v.loop = true;
      v.play().catch(() => {});
      return v;
    };
    const scene = cfg.scene ? clip(cfg.scene, SCENE_CLIPS) : null;
    const behind = cfg.behind ? clip(cfg.behind, EFFECT_CLIPS) : null;
    const front = cfg.front ? clip(cfg.front, EFFECT_CLIPS) : null;

    this.#clearResultStill();
    this.#enterStage('Pip đang chạy đoạn code của bạn…');
    const layers = new HumanLayers(this.#scenePanel, video);
    // Wait for Hands to be running before a second MediaPipe solution loads —
    // see camera-engine.js#handsRunning for why loading both at once kills
    // hand tracking outright. Capped: if Hands never reports (a camera that
    // opened but sees nothing), the mask must still get its chance rather than
    // leaving the learner's cell hanging on a promise that never settles.
    await Promise.race([this.#cameraEngine.handsRunning(), this.#wait(HANDS_WARMUP_MS)]);
    try { await layers.init(); } catch { this.#outLine('chưa tải được bùa tìm người'); layers.stop(); this.#exitStage(); return 'no-charm'; }
    const stat = this.#scenePanel.querySelector('#scstat');
    if (stat) stat.textContent = 'bùa đang tìm người trong khung hình…';
    const result = await layers.play({ scene, behind, front });
    // Always say what the charm actually did. A silent no-op is the worst
    // outcome for a learner: the program printed its lines, the stage stayed
    // empty, and nothing said which of the two had gone wrong.
    this.#outLine(`bùa tìm người: ${layers.masks} lần thấy người · ${layers.frames} khung đã vẽ`
      + `${layers.errors ? ` · ${layers.errors} khung lỗi` : ''}`
      + `${layers.ready ? '' : ' · KHÔNG thấy người — đang chiếu phẳng, hãy lùi ra cho camera thấy bạn'}`);
    layers.freeze();                 // leave the final composite on screen
    this.#exitStage();
    for (const v of [scene, behind, front]) if (v) v.pause();
    return result;
  }

  // effect_play — fires a full-size moving plate over the live camera, blended
  // with mix-blend-mode:screen (CSS does the very add-and-clamp the learner
  // wrote by hand). `own:true` opens a file picker instead of using a bundled
  // clip, so a learner can bring a video they generated themselves and watch
  // their own footage composite. Waits for the clip, capped so a looping or
  // broken file can never wedge the lesson.
  async #playEffectClip(cfg) {
    this.stop(); this.#active = true;
    // raw: show the plate exactly as it sits on disk — no camera under it,
    // no screen blend over it. The point is that an 'effect' is an ordinary
    // video on a black background, and the magic is entirely in the blend.
    const raw = !!cfg.raw;
    const wanted = shortText(cfg.name, 16);
    // An unknown name used to fall back to the dragon in silence, so a typo — or
    // a lesson naming a clip nobody bundled — looked like a working spell.
    if (!cfg.own && !EFFECT_CLIPS[wanted]) this.#outLine(`chưa có lớp hiệu ứng tên "${wanted}" — máy tạm chiếu lớp dragon`);
    let src = EFFECT_CLIPS[wanted] || EFFECT_CLIPS.dragon, revoke = null;
    if (cfg.own) {
      const picked = await this.#pickClip();
      if (!picked) { this.#outLine('bạn chưa chọn tệp — máy dùng lớp hiệu ứng có sẵn để bài vẫn chạy được'); }
      else { src = picked; revoke = picked; }
    }
    // best-effort camera behind the plate; the clip still plays without one.
    // A raw view deliberately skips it — there is nothing to composite onto.
    let camTimer = null;
    if (raw) { /* no camera for a raw view */ } else
    try {
      const opened = this.#cameraEngine.ensure().then(() => true, () => false);
      this.#cameraAvailable = await Promise.race([opened, new Promise(r => { camTimer = setTimeout(() => r(false), CAMERA_START_MS); })]);
    } catch { this.#cameraAvailable = false; }
    if (camTimer) clearTimeout(camTimer);
    this.#clearResultStill();
    this.#enterStage(raw ? 'Đây là tệp gốc, chưa pha trộn gì' : 'Pip đang chạy đoạn code của bạn…');
    const clip = document.createElement('video');
    clip.className = raw ? 'studio-effect-clip studio-effect-raw' : 'studio-effect-clip';
    clip.src = src; clip.muted = true; clip.playsInline = true; clip.autoplay = true;
    this.#scenePanel.appendChild(clip);
    const stat = this.#scenePanel.querySelector('#scstat');
    if (stat) stat.textContent = cfg.own ? 'đang chiếu lớp hiệu ứng của bạn' : `đang chiếu lớp ${shortText(cfg.name, 16)}`;
    await new Promise(resolve => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
      const timer = setTimeout(finish, EFFECT_MAX_MS);
      clip.addEventListener('ended', finish);
      clip.addEventListener('error', finish);
      clip.play().catch(finish);
    });
    this.#freezeClip(clip, raw);     // keep the last frame instead of a bare camera
    clip.remove();
    this.#exitStage();
    if (revoke) URL.revokeObjectURL(revoke);
    return 'played';
  }
  #pickClip() {
    return new Promise(resolve => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'video/*';
      let done = false;
      const finish = value => { if (done) return; done = true; input.remove(); resolve(value); };
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file || !String(file.type || '').startsWith('video/') || file.size > 40 * 1024 * 1024) { finish(null); return; }
        finish(URL.createObjectURL(file));
      };
      input.oncancel = () => finish(null);
      input.style.display = 'none'; document.body.appendChild(input); input.click();
    });
  }
  // voice_listen — real spoken INPUT for py/voice_charm.listen(). Matches the
  // utterance against the lesson's own small vocabulary with wordHits (the same
  // fold/accept/skeleton tiers the ritual gates use), and ALWAYS renders the
  // words as buttons too: a blocked mic, a silent room or a browser with no
  // SpeechRecognition must degrade to a tap, never to a dead lesson. Resolves
  // to the matched word, or '' on timeout — so if/elif/else still needs else.
  #listenForWord(cfg) {
    const words = (Array.isArray(cfg.words) ? cfg.words : []).map(w => shortText(w, 24)).filter(Boolean);
    const seconds = clamp(cfg.seconds, 2, 30, 12);
    this.#active = true;                 // deliberately NOT stop(): keep the stage up
    const host = this.#scenePanel;
    const panel = document.createElement('div'); panel.className = 'vcharm';
    panel.innerHTML = `<div class="vcharm-state">🎤 gương đang lắng nghe…</div>
      <canvas class="vcharm-meter" width="260" height="34"></canvas>
      <div class="vcharm-heard">…</div>
      <div class="vcharm-or">niệm to một từ, hoặc chạm thẳng vào từ đó</div>
      <div class="vcharm-words"></div>
      <i class="vcharm-bar"><b></b></i>`;
    const wordsEl = panel.querySelector('.vcharm-words');
    host.appendChild(panel);

    return new Promise(resolve => {
      let settled = false, gate = null, timer = null, meter = null;
      const finish = word => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        if (gate) try { gate.stop(); } catch { /* already down */ }
        if (meter) try { meter.stop(); } catch { /* already down */ }
        panel.querySelector('.vcharm-state').textContent = word ? `✦ nghe được: ${word}` : '… không nghe ra từ nào — nhánh else sẽ chạy';
        setTimeout(() => { panel.remove(); resolve(word); }, 900);   // leave the stage alone
      };
      for (const word of words) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'vcharm-word'; button.textContent = word;
        button.onclick = () => finish(word);
        wordsEl.appendChild(button);
      }
      panel.querySelector('.vcharm-bar').style.setProperty('--vcsec', `${seconds}s`);
      timer = setTimeout(() => finish(''), seconds * 1000);
      // A live level meter is the difference between "the machine is not
      // listening" and "it hears me but has not matched a word yet". Without
      // one a quiet panel looks exactly like a broken mic, which is how this
      // charm earned its reputation.
      mountMicMeter(panel.querySelector('.vcharm-meter'))
        .then(m => { meter = m; })
        .catch(() => { panel.querySelector('.vcharm-meter').style.display = 'none'; });
      try {
        gate = startVoiceGate({
          onHear: utterance => {
            // show the raw transcript whether or not it matched, so a learner
            // can see what the machine THOUGHT they said and adjust
            if (utterance) panel.querySelector('.vcharm-heard').textContent = `nghe thành: “${utterance}”`;
            const hit = words.find(w => wordHits(utterance, w).length);
            if (hit) finish(hit);
          },
          onDown: why => { panel.querySelector('.vcharm-state').textContent = `🎤 ${why} — chạm vào một từ bên dưới`; },
        });
      } catch { panel.querySelector('.vcharm-state').textContent = '🎤 chưa mở được mic — chạm vào một từ bên dưới'; }
    });
  }
  // Blocks the learner's program until the lab is dismissed, so a comparison
  // stays up as long as they want to look instead of racing a fixed delay.
  async #compareFrames(cfg) {
    // Naming a plate attaches that plate's real artwork. A frame may carry a
    // grid AND a plate name, and then the lab pairs the picture with the cells
    // it decoded to — pixels on their own are unreadable.
    const frames = (Array.isArray(cfg.frames) ? cfg.frames : []).map(f => {
      const src = f && typeof f.plate === 'string' ? IMAGE_PLATES[shortText(f.plate, 12)] : null;
      return src ? { label: f.label, image: f.image, src, role: f.role } : f;
    });
    const lab = buildImageLab(frames, { title: cfg.title, numbers: cfg.numbers });
    document.body.appendChild(lab.el);
    return lab.done;
  }
  // A named plate always decodes to the same grid, so a lesson can assert on
  // exact pixel numbers; an unknown name falls back to the sample owl.
  async #readPlateGrid(cfg) {
    this.stop(); this.#active = true;
    this.#photoSrc = IMAGE_PLATES[shortText(cfg.name, 12)] || IMAGE_GRID_SAMPLE;
    const side = Math.round(clamp(cfg.size, IMAGE_GRID_MIN, IMAGE_GRID_MAX, 16));
    const grid = await this.#decodePhoto(this.#photoSrc, side);
    this.#mountPhotoProject();
    const stat = this.#scenePanel.querySelector('#scstat');
    if (stat) stat.textContent = `đã đọc tấm ${shortText(cfg.name, 12)} thành bảng ${side}×${side}`;
    return JSON.stringify(Array.isArray(grid) ? grid : []);
  }
  #finishPhotoStart(result) {
    if (this.#photoStartEl) this.#photoStartEl.remove(); this.#photoStartEl = null;
    const resolve = this.#photoStartResolve; this.#photoStartResolve = null; if (resolve) resolve(result);
  }
  async #startPhotoLights() {
    if (!this.#active) this.#active = true;
    if (!this.#photoProject) this.#mountPhotoProject();
    this.#finishPhotoStart('cancelled');
    const overlay = document.createElement('div'); overlay.className = 'photo-light-start';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'BẮT ĐẦU'; overlay.appendChild(button);
    this.#photoProject.appendChild(overlay); this.#photoStartEl = overlay;
    const stat = this.#scenePanel.querySelector('#scstat'); if (stat) stat.textContent = 'bấm BẮT ĐẦU để chạy đèn';
    const count = this.#scenePanel.querySelector('#sccount'); if (count) count.textContent = '▶';
    this.#outLine('chương trình đang chờ — bấm BẮT ĐẦU trên khung ảnh');
    setTimeout(() => this.#scenePanel.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
    return new Promise(resolve => { this.#photoStartResolve = resolve; button.onclick = () => { if (stat) stat.textContent = 'đã bắt đầu'; if (count) count.textContent = '1'; this.#outLine('đã bấm BẮT ĐẦU — chu kỳ 1 chạy'); this.#finishPhotoStart('started'); }; });
  }
  async #delay(cfg) { await this.#wait(clamp(cfg.seconds, .05, 3, .5) * 1000); return 'waited'; }
  async #startParticleStage(cfg) {
    this.stop(); this.#active = true; this.#cameraAvailable = false;
    this.#renderTitle(shortText(cfg.title, 40, 'Xưởng Hạt Ánh Sáng'));
    const stat = this.#scenePanel.querySelector('#scstat');
    if (stat) stat.textContent = 'xưởng đang hiển thị từng frame';
    this.#positionAll();
    return 'started';
  }
  #finishLightStart(result) {
    if (this.#lightStartEl) this.#lightStartEl.remove(); this.#lightStartEl = null;
    const resolve = this.#lightStartResolve; this.#lightStartResolve = null; if (resolve) resolve(result);
  }
  #mountLightBoard() {
    if (this.#lightBoard) this.#lightBoard.remove();
    const board = document.createElement('div'); board.className = 'light-board-project';
    const image = document.createElement('img'); image.className = 'light-board-art'; image.src = 'assets/electronic-marquee-board.webp'; image.alt = '';
    const bulbs = document.createElement('div'); bulbs.className = 'light-board-bulbs';
    const grid = document.createElement('div'); grid.className = 'light-board-grid';
    board.appendChild(image); board.appendChild(bulbs); board.appendChild(grid); this.#scenePanel.appendChild(board);
    this.#lightBoard = board; this.#lightBulbs = bulbs; this.#lightGrid = grid; this.#scenePanel.classList.add('light-board-live');
  }
  async #startLightBoard() {
    if (!this.#active) this.#active = true; if (!this.#lightBoard) this.#mountLightBoard(); this.#finishLightStart('cancelled');
    const overlay = document.createElement('div'); overlay.className = 'light-board-start'; const button = document.createElement('button'); button.type = 'button'; button.textContent = 'BẮT ĐẦU';
    overlay.appendChild(button); this.#lightBoard.appendChild(overlay); this.#lightStartEl = overlay;
    const stat = this.#scenePanel.querySelector('#scstat'); if (stat) stat.textContent = 'BẢNG ĐÈN ĐANG CHỜ';
    this.#outLine('bảng điện tử đã sẵn sàng — bấm BẮT ĐẦU');
    setTimeout(() => {
      const walkthrough = typeof this.#scenePanel.closest === 'function' ? this.#scenePanel.closest('.walkthrough') : null;
      if (walkthrough) alignWalkthrough(walkthrough);
      else this.#scenePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
    return new Promise(resolve => { this.#lightStartResolve = resolve; button.onclick = () => { if (stat) stat.textContent = 'BẮT ĐẦU LẮP BÓNG'; this.#finishLightStart('started'); }; });
  }
  async #clearLightBulbs() { if (!this.#lightBoard) this.#mountLightBoard(); this.#lightBulbs.replaceChildren(); return 'cleared'; }
  async #placeLightBulb(cfg) {
    if (!this.#lightBoard) this.#mountLightBoard(); const bulb = document.createElement('i'), color = normalizePhotoLightColors([cfg.color])[0];
    bulb.className = 'light-board-bulb'; bulb.style.left = `${clamp(cfg.x, 0, 100, 50)}%`; bulb.style.top = `${clamp(cfg.y, 0, 100, 10)}%`; bulb.style.backgroundColor = color; bulb.style.setProperty('--lamp', color);
    this.#lightBulbs.appendChild(bulb); const stat = this.#scenePanel.querySelector('#scstat'); if (stat) stat.textContent = `ĐÃ LẮP ${this.#lightBulbs.children.length} BÓNG`;
    await this.#wait(20); return 'drawn';
  }
  async #showLightGrid(cfg) {
    if (!this.#lightBoard) this.#mountLightBoard(); this.#lightGrid.replaceChildren();
    const source = Array.isArray(cfg.grid) ? cfg.grid.slice(0, 12) : [], rows = Math.max(1, source.length), visibleCols = 24, offset = Math.max(0, Math.trunc(Number(cfg.offset) || 0));
    const color = normalizePhotoLightColors([cfg.color])[0];
    source.forEach((row, rowIndex) => { if (!Array.isArray(row)) return; row.slice(0, 80).forEach((value, colIndex) => {
      const screenCol = colIndex + visibleCols - offset; if (!value || screenCol < 0 || screenCol >= visibleCols) return;
      const pixel = document.createElement('i'); pixel.style.left = `${(screenCol + .5) / visibleCols * 100}%`; pixel.style.top = `${(rowIndex + .5) / rows * 100}%`; pixel.style.backgroundColor = color; pixel.style.setProperty('--lamp', color); this.#lightGrid.appendChild(pixel);
    }); });
    const stat = this.#scenePanel.querySelector('#scstat'); if (stat) stat.textContent = `GRID · FRAME ${offset}`; await this.#wait(20); return 'drawn';
  }
  async #showPhotoLights(cfg) {
    if (!this.#active) this.#active = true;
    if (!this.#photoProject) this.#mountPhotoProject();
    if (this.#photoLampHost) this.#photoLampHost.remove();
    const mode = PHOTO_LIGHT_MODES.has(cfg.mode) ? cfg.mode : 'steady', frame = photoLightFrame(cfg.colors, mode, cfg.step);
    const step = Math.max(0, Math.trunc(Number(cfg.step) || 0)), host = document.createElement('div'); host.className = 'photo-light-ring'; host.dataset.mode = mode; host.dataset.step = String(step);
    for (const lamp of frame) { const el = document.createElement('i'); el.className = lamp.on ? 'on' : 'off';
      el.style.left = `${lamp.x}%`; el.style.top = `${lamp.y}%`; el.style.backgroundColor = lamp.color; el.style.setProperty('--lamp', lamp.color); host.appendChild(el); }
    this.#photoProject.appendChild(host); this.#photoLampHost = host;
    this.#photoProject.classList.toggle('is-lit', mode !== 'off'); this.#photoProject.classList.toggle('is-off', mode === 'off');
    const rawColors = Array.isArray(cfg.colors) && cfg.colors.length ? cfg.colors : ['green'], color = String(rawColors[step % rawColors.length] || 'green').toLowerCase();
    const stat = this.#scenePanel.querySelector('#scstat'); if (stat) stat.textContent = mode === 'off' ? `CHU KỲ ${step + 1} · ĐÈN TẮT` : `CHU KỲ ${step + 1} · ĐÈN SÁNG · ${PHOTO_LIGHT_LABELS[color] || color.toUpperCase()}`;
    const count = this.#scenePanel.querySelector('#sccount'); if (count) count.textContent = String(step + 1);
    await this.#wait(20); return 'drawn';
  }
  async #setPhotoLight(cfg) {
    const index = Math.max(0, Math.min(27, Math.trunc(Number(cfg.index) || 0)));
    this.#photoManualColors[index] = normalizePhotoLightColors([cfg.color])[0];
    return this.#showPhotoLights({ colors: this.#photoManualColors.filter(Boolean), mode: 'steady', step: 0 });
  }
  #mountPhotoProject() {
    if (this.#photoProject) this.#photoProject.remove();
    const host = document.createElement('div'); host.className = 'photo-light-project';
    if (this.#photoSrc) { const img = document.createElement('img'); img.className = 'photo-light-picture'; img.src = this.#photoSrc; img.alt = ''; host.appendChild(img); }
    else { const sample = document.createElement('div'); sample.className = 'photo-light-placeholder'; host.appendChild(sample); }
    this.#scenePanel.appendChild(host); this.#photoProject = host; this.#photoLampHost = null; this.#scenePanel.classList.add('photo-lights-live');
  }
  async readHandPosition(raw) {
    const anchor = ANCHOR_INDEX[parsePayload(raw).anchor] === undefined ? 'palm' : parsePayload(raw).anchor;
    if (this.#lastLm) return JSON.stringify(this.#handResult(anchor, true));
    if (!this.#active || !this.#cameraAvailable) return JSON.stringify(this.#handResult(anchor, false));
    if (this.#pendingHand) { clearTimeout(this.#pendingHand.timer); this.#pendingHand.resolve(JSON.stringify(this.#handResult(this.#pendingHand.anchor, false))); }
    return new Promise(resolve => { const pending = { anchor, resolve, timer: null }; pending.timer = setTimeout(() => {
      if (this.#pendingHand === pending) this.#pendingHand = null; resolve(JSON.stringify(this.#handResult(anchor, false)));
    }, HAND_READ_MS); this.#pendingHand = pending; });
  }
  drawParticleFrame(raw) {
    const cfg = parsePayload(raw), particles = Array.isArray(cfg.particles) ? cfg.particles.slice(0, PARTICLE_FRAME_CAP) : [];
    if (this.#particleFrame) this.#particleFrame.remove();
    const host = document.createElement('div'); host.className = 'studio-particle-frame';
    for (const particle of particles) { const p = particle && typeof particle === 'object' ? particle : {}, el = document.createElement('i');
      el.textContent = shortText(p.symbol, 4, '.'); el.style.left = `${clamp(p.x, 0, 100, 50)}%`; el.style.top = `${clamp(p.y, 0, 100, 50)}%`;
      el.style.color = safeColor(p.color); el.style.fontSize = `${Math.round(14 * clamp(p.size, .25, 3, 1))}px`;
      el.style.opacity = String(clamp(p.alpha, 0, 255, 255) / 255); host.appendChild(el); }
    mountParticleGuide(host, cfg.guide);
    this.#scenePanel.appendChild(host); this.#particleFrame = host; return 'drawn';
  }
  presentImageFrame(raw) {
    const frame = normalizeImageFrame(parsePayload(raw).image);
    if (this.#particleFrame) this.#particleFrame.remove(); this.#particleFrame = null;
    if (!frame) return 'invalid';
    const canvas = document.createElement('canvas'); canvas.className = 'studio-image-frame'; canvas.width = frame.width; canvas.height = frame.height;
    canvas.style.position = 'absolute'; canvas.style.inset = '0'; canvas.style.width = '100%'; canvas.style.height = '100%';
    canvas.style.zIndex = '3'; canvas.style.pointerEvents = 'none'; canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return 'invalid';
    const imageData = ctx.createImageData(frame.width, frame.height); imageData.data.set(frame.data); ctx.imageSmoothingEnabled = false; ctx.putImageData(imageData, 0, 0);
    this.#scenePanel.appendChild(canvas); this.#particleFrame = canvas; return 'drawn';
  }
  stopAfter(ms) { clearTimeout(this.#stopTimer); if (this.#active) this.#stopTimer = setTimeout(() => this.stop(), Math.max(0, ms || 0)); }
  stop() {
    clearTimeout(this.#stopTimer); this.#stopTimer = null; this.#active = false; this.#cameraAvailable = false; this.#lastLm = null;
    this.#finishPhotoStart('cancelled');
    this.#finishLightStart('cancelled');
    this.#clearResultStill();
    this.clearStickers(); this.clearStudioFrame(); this.#gifts.forEach(el => el.remove()); this.#gifts.clear(); this.#bursts.forEach(el => el.remove()); this.#bursts.clear();
    if (this.#pendingHand) { clearTimeout(this.#pendingHand.timer); this.#pendingHand.resolve(JSON.stringify(this.#handResult(this.#pendingHand.anchor, false))); this.#pendingHand = null; }
    if (this.#titleEl) this.#titleEl.remove(); this.#titleEl = null;
    if (this.#photoProject) this.#photoProject.remove(); this.#photoProject = null; this.#photoLampHost = null; this.#photoManualColors = [];
    if (this.#lightBoard) this.#lightBoard.remove(); this.#lightBoard = null; this.#lightBulbs = null; this.#lightGrid = null;
    if (this.#vfx) this.#vfx.stop(); this.#vfx = null;
    this.#scenePanel.classList.remove('studio-live', 'photo-lights-live', 'light-board-live');
  }
  dispose() { this.stop(); this.#photoSrc = null; if (this.#off) this.#off(); this.#off = null; }

  async #ensureVfx() { await this.#loadVortex().catch(() => {}); if (this.#active) this.#mountVfx(); }
  #mountVfx() {
    const factory = this.#getVortex(); if (!factory || typeof factory.mount !== 'function') return;
    if (this.#vfx) this.#vfx.stop();
    this.#scenePanel.style.setProperty('--c', this.#style.color);
    this.#vfx = factory.mount(this.#scenePanel, { circle: false, ambient: 0, density: this.#style.density, theme: {
      palette: { core: this.#style.color, dust: this.#style.color, rune: this.#style.color }, glyphs: this.#style.symbols,
      motion: this.#style.motion, scale: this.#style.size, glow: this.#style.glow,
    } });
  }
  #renderTitle(title) {
    const el = document.createElement('div'); el.className = 'studio-title'; el.textContent = title;
    this.#scenePanel.appendChild(el); this.#titleEl = el; this.#scenePanel.classList.add('studio-live');
  }
  #attachSticker(cfg) {
    if (!this.#active) return;
    const el = document.createElement('span'); el.className = 'ar-sticker'; el.textContent = shortText(cfg.symbol, 6, '*');
    const sticker = { el, anchor: ANCHOR_INDEX[cfg.anchor] === undefined ? 'palm' : cfg.anchor, size: clamp(cfg.size, .5, 2.5, 1) };
    el.style.fontSize = `${Math.round(42 * sticker.size)}px`; this.#scenePanel.appendChild(el); this.#stickers.push(sticker);
    if (this.#stickers.length > 6) this.#stickers.shift().el.remove(); this.#positionSticker(sticker);
  }
  #drawStickerAt(cfg) {
    if (!this.#active) return;
    const el = document.createElement('span'); el.className = 'studio-static-sticker'; el.textContent = shortText(cfg.symbol, 6, '*');
    el.style.left = `${clamp(cfg.x, 0, 100, 50)}%`; el.style.top = `${clamp(cfg.y, 0, 100, 50)}%`; el.style.fontSize = `${Math.round(42 * clamp(cfg.size, .5, 2.5, 1))}px`;
    this.#scenePanel.appendChild(el); this.#staticStickers.push(el); if (this.#staticStickers.length > 12) this.#staticStickers.shift().remove();
  }
  #sendGift(cfg) {
    if (!this.#active) return;
    const el = document.createElement('div'); el.className = 'studio-gift';
    const symbol = document.createElement('b'); symbol.textContent = shortText(cfg.symbol, 6, '*');
    const copy = document.createElement('span'); const sender = shortText(cfg.sender, 24, 'Guest'), gift = shortText(cfg.gift, 24, 'Gift'), message = shortText(cfg.message, 60);
    copy.textContent = `${sender} sent ${gift}${message ? ` · ${message}` : ''}`; el.appendChild(symbol); el.appendChild(copy);
    this.#scenePanel.appendChild(el); this.#gifts.add(el); setTimeout(() => { this.#gifts.delete(el); el.remove(); }, 2400);
    this.#particleBurst('palm');
  }
  #particleBurst(anchor = 'palm') {
    if (!this.#active) return;
    const p = studioAnchorPoint(this.#lastLm, anchor); this.#symbolBurst(p);
    if (!this.#vfx) return;
    const vfx = this.#vfx; vfx.emit(p.x, p.y, Math.round(35 + 85 * this.#style.density)); setTimeout(() => { if (this.#active && this.#vfx === vfx) vfx.burst(); }, 60);
  }
  #symbolBurst(p) {
    const w = this.#scenePanel.clientWidth || CAPTURE_W, h = this.#scenePanel.clientHeight || CAPTURE_H, q = coverMap(p.x, p.y, w, h, CAPTURE_W, CAPTURE_H);
    const host = document.createElement('div'); host.className = `studio-particles motion-${this.#style.motion}`; host.style.left = `${q.x}px`; host.style.top = `${q.y}px`;
    const symbols = [...(this.#style.symbols || '✦')], count = Math.round(8 + 18 * this.#style.density);
    for (let i = 0; i < count; i++) { const el = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 28 + Math.random() * 78 * this.#style.size;
      el.textContent = symbols[i % symbols.length]; el.style.setProperty('--dx', `${Math.cos(a) * d}px`); el.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      el.style.setProperty('--delay', `${Math.random() * .12}s`); el.style.color = this.#style.color; el.style.fontSize = `${Math.round(12 * this.#style.size)}px`;
      el.style.textShadow = `0 0 ${Math.round(8 * this.#style.glow)}px ${this.#style.color}`; host.appendChild(el); }
    this.#scenePanel.appendChild(host); this.#bursts.add(host); setTimeout(() => { this.#bursts.delete(host); host.remove(); }, 1300);
  }
  #onLandmarks(lm, has) {
    this.#lastLm = has && lm ? lm : null;
    if (this.#pendingHand && this.#lastLm) { const pending = this.#pendingHand; this.#pendingHand = null; clearTimeout(pending.timer); pending.resolve(JSON.stringify(this.#handResult(pending.anchor, true))); }
    if (this.#active) this.#positionAll();
  }
  #handResult(anchor, visible) {
    if (!visible || !this.#lastLm) return { visible: false, x: 50, y: 50 };
    const p = studioAnchorPoint(this.#lastLm, anchor), w = this.#scenePanel.clientWidth || CAPTURE_W, h = this.#scenePanel.clientHeight || CAPTURE_H;
    const q = coverMap(p.x, p.y, w, h, CAPTURE_W, CAPTURE_H);
    return { visible: true, x: Math.round(clamp(q.x / w * 100, 0, 100, 50)), y: Math.round(clamp(q.y / h * 100, 0, 100, 50)) };
  }
  #positionAll() { this.#stickers.forEach(s => this.#positionSticker(s)); }
  #positionSticker(sticker) {
    const p = studioAnchorPoint(this.#lastLm, sticker.anchor); const w = this.#scenePanel.clientWidth || CAPTURE_W, h = this.#scenePanel.clientHeight || CAPTURE_H;
    const q = coverMap(p.x, p.y, w, h, CAPTURE_W, CAPTURE_H); sticker.el.style.left = `${q.x}px`; sticker.el.style.top = `${q.y}px`;
  }
}
