// py-runtime.js — chỗ mã Python của học sinh được đem ra chạy thật.
//
// Đây là file của MÁY, học sinh không phải sửa. Việc của nó gồm bốn thứ:
//   1. nạp Pyodide (Python chạy thẳng trong trình duyệt), rồi đọc hai file
//      trong thư mục `student/` và cho chạy;
//   2. đưa sang Python mấy lệnh gọi được: play_effect / cast / say;
//   3. gọi hàm của học sinh đúng lúc — đổi số ngón tay, nghe được một từ,
//      và mỗi khung hình khi đang bật chế độ xử lý ảnh;
//   4. lỗi Python thì hiện đúng dòng báo lỗi lên màn hình, không làm sập
//      đồ chơi và không bắt tải lại trang: sửa file rồi bấm R là nạp lại.
//
// Pyodide chạy ở luồng chính (không Worker) để đưa khung hình sang Python mà
// không phải chép qua chép lại — đổi lại, khi Python chạy thì hình đứng yên
// trong chốc lát, nên phần xử lý ảnh chạy cách khung (xem FRAME_EVERY).
import { storedSource } from './student-store.js?v=4';
import { toGrid, toFlat, blankGrid } from './notebook.js?v=4';   // cùng cách dịch ảnh với trang làm bài

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const GRADER = './pygrade/grader.py';        // bộ chấm dùng chung, học sinh không sửa
const FILES = ['./student/spells.py', './student/image_spells.py'];
const W = 96, H = 72;              // Python thuần chạy ~22-160 khung/giây ở cỡ này
const FRAME_EVERY = 2;             // xử lý 1 trong 2 khung, chừa hơi cho phần 3D
const PLATE = './lessons/assets/camera-effects/plates/fx-dragon.webp';
// Ba phép bắt buộc, rồi bốn bài thêm. Phím chọn sao cho không đụng phím nào
// của đồ chơi (main.js đã giữ b/f/n/g/k/l/m/p/u và mấy phím số).
const MODES = {
  f: 'flip', b: 'blur', n: 'blend',
  a: 'negative', w: 'grayscale', v: 'flip_vertical', c: 'drop_blue',
  o: 'compose',                    // ghép nền: cần mặt nạ người từ MediaPipe
  z: 'blur_background',            // nền mờ, người nét — kiểu họp trực tuyến
  y: 'blend_alpha',                // đè ảnh nền lên khung hình, pha 50%
  s: 'scene',                      // bài cuối: nền video + lớp sau + người + hiệu ứng trước
};
const BACKDROP = './lessons/assets/storybook/portal-courtyard-v3.webp';
// Bài `scene` chạy trên VIDEO thật, không phải ảnh tĩnh: nền là khu rừng, lớp
// sau lưng là mưa, hiệu ứng phủ trước là rồng.
const SCENE_CLIPS = {
  background: './lessons/assets/camera-effects/overlays/bg-enchanted-forest.mp4',
  behind: './lessons/assets/camera-effects/overlays/rain-storm.mp4',
  front: './lessons/assets/camera-effects/overlays/dragon-strike.mp4',
};

export function mountPython({ video, playEffect, cast, onStatus, segmentation }) {
  const ui = buildPanel();
  const say = (text, bad = false) => { ui.log.textContent = text; ui.log.style.color = bad ? '#ffb4b4' : '#eaf4ff'; onStatus?.(text); };

  const state = { py: null, mode: null, frame: 0, layer: null, lastFingers: -1, busy: false };

  // ── nạp Pyodide + hai file của học sinh ────────────────────────────────────
  async function boot() {
    say('Đang tải Python… (lần đầu hơi lâu)');
    if (!self.loadPyodide) await new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = PYODIDE; s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
    state.py = await self.loadPyodide();
    // Những lệnh học sinh gọi được từ Python. Tên đặt đúng như bên đảo Gương
    // Vô Cực để các em không phải học lại: play_effect, say.
    state.py.registerJsModule('magic_stage', {
      play_effect: name => { state.acted = true; playEffect(String(name)); return true; },
      cast: name => { state.acted = true; cast(String(name)); return true; },
      say: text => { state.acted = true; say(`Python: ${text}`); return true; },
      // Chỗ chứa kết quả tạm cho bài `scene`.
      new_image: (width, height) => blankGrid(width, height),
      // Học sinh tự dựng bảng điều khiển của mình: mỗi lời gọi là một nút thật
      // trên màn hình. Gọi trong hàm setup() ở student/spells.py.
      add_button: (label, effect) => { addButton(String(label), String(effect)); return true; },
      // Bao nhiêu ngón tay đang giơ NGAY LÚC NÀY. Có nó thì on_voice mới kết
      // hợp được hai điều kiện: đúng thế tay VÀ đúng lời niệm.
      fingers_now: () => state.lastFingers < 0 ? 0 : state.lastFingers,
    });
    await reload();
  }

  // Bài học sinh gõ trong BÀN VIẾT được ưu tiên hơn file trên đĩa — đó là cách
  // dùng bộ này mà không cần cài gì: mở link, gõ, chạy.
  async function readFile(path) {
    const name = path.split('/').pop();
    const typed = storedSource(name);
    if (typed != null) return typed;
    const res = await fetch(`${path}?t=${Date.now()}`);        // ?t= để trình duyệt đừng dùng bản cũ
    if (!res.ok) throw new Error(`không đọc được ${path}`);
    return res.text();
  }

  async function reload() {
    try {
      const sources = await Promise.all([readFile(GRADER), ...FILES.map(readFile)]);
      for (const source of sources) state.py.runPython(source);
      // setup() là chỗ học sinh tự gắn nút cho phép của mình. Xoá bảng cũ
      // trước, nếu không mỗi lần bấm R lại mọc thêm một bộ nút trùng.
      ui.buttons.textContent = '';
      if (state.py.globals.get('setup')) call('setup');
      say('Python sẵn sàng — sửa file trong student/ rồi bấm R để nạp lại');
      return true;
    } catch (err) { say(pyError(err), true); return false; }
  }

  // ── gọi một hàm Python, lỗi thì báo chứ không để văng ra ngoài ─────────────
  function call(name, ...args) {
    if (!state.py) return null;
    const fn = state.py.globals.get(name);
    if (!fn) { say(`Chưa thấy hàm ${name}() trong student/ — bạn đã lưu file chưa?`, true); return null; }
    try { return fn(...args); }
    catch (err) { say(pyError(err), true); return null; }
    finally { if (typeof fn.destroy === 'function') fn.destroy(); }
  }

  // ── ba chỗ Python được gọi ────────────────────────────────────────────────
  const api = {
    fingers(count) {
      if (!state.py) return;
      const changed = count !== state.lastFingers;
      state.lastFingers = count;                 // luôn ghi lại, kể cả 0
      if (changed && count > 0) call('on_fingers', count);
    },
    // Trả về true nếu mã của học sinh đã làm gì đó với từ này, để sân khấu
    // không bắn thêm hiệu ứng mặc định đè lên phép của các em.
    voice(word) {
      if (!state.py) return false;
      state.acted = false;
      call('on_voice', String(word));
      return state.acted;
    },
    ready: () => !!state.py,
    reload,                                    // BÀN VIẾT gọi lại sau khi học sinh bấm CHẠY
    grade: () => call('check_all'),
  };

  // ── vòng lặp ảnh ──────────────────────────────────────────────────────────
  const stage = ui.canvas, ctx = stage.getContext('2d', { willReadFrequently: true });
  const grab = document.createElement('canvas'); grab.width = W; grab.height = H;
  const grabCtx = grab.getContext('2d', { willReadFrequently: true });
  const plate = new Image();
  plate.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(plate, 0, 0, W, H);
    state.layer = toGrid(Array.from(cx.getImageData(0, 0, W, H).data), W, H);
  };
  plate.src = PLATE;

  // Nền cho phím O: học sinh đứng trước cổng Kotopia thay vì trước bức tường lớp.
  const backdrop = new Image();
  backdrop.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(backdrop, 0, 0, W, H);
    state.backdrop = toGrid(Array.from(cx.getImageData(0, 0, W, H).data), W, H);
  };
  backdrop.src = BACKDROP;

  // Ba clip cho bài `scene`. Mỗi khung hình lấy đúng ảnh đang chiếu của chúng,
  // nên học sinh ghép VIDEO thật chứ không phải ba tấm ảnh chết.
  const clips = {};
  for (const [role, src] of Object.entries(SCENE_CLIPS)) {
    const clip = document.createElement('video');
    clip.src = src; clip.muted = true; clip.loop = true; clip.playsInline = true;
    clip.play().catch(() => {});          // trình duyệt chặn autoplay: bấm một cái là chạy
    clips[role] = clip;
  }
  const clipCv = document.createElement('canvas'); clipCv.width = W; clipCv.height = H;
  const clipCtx = clipCv.getContext('2d', { willReadFrequently: true });
  function clipGrid(role) {
    const clip = clips[role];
    if (!clip?.videoWidth) return null;
    clipCtx.drawImage(clip, 0, 0, W, H);
    return toGrid(Array.from(clipCtx.getImageData(0, 0, W, H).data), W, H);
  }

  // Mặt nạ người, thu về đúng cỡ 96x72 rồi đọc kênh độ đục thành số 0..255.
  const maskCv = document.createElement('canvas'); maskCv.width = W; maskCv.height = H;
  const maskCtx = maskCv.getContext('2d', { willReadFrequently: true });
  function personMask() {
    const source = segmentation?.maskSource?.();
    if (!source) return null;
    maskCtx.clearRect(0, 0, W, H);
    maskCtx.drawImage(source, 0, 0, W, H);
    const data = maskCtx.getImageData(0, 0, W, H).data;
    const mask = [];
    for (let row = 0; row < H; row++) {
      const line = [];
      for (let col = 0; col < W; col++) line.push(data[(row * W + col) * 4 + 3]);
      mask.push(line);
    }
    return mask;
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!state.mode || !state.py || !video?.videoWidth || state.busy) return;
    if (state.frame++ % FRAME_EVERY) return;
    grabCtx.drawImage(video, 0, 0, W, H);
    const src = grabCtx.getImageData(0, 0, W, H);
    // Học sinh làm việc với image[row][col] -> [đỏ, lá, dương], đúng như bên
    // trang làm bài; canvas thì giữ một dãy số dài. Dịch qua lại bằng JS.
    const image = toGrid(Array.from(src.data), W, H);
    const out = blankGrid(W, H);
    state.busy = true;
    let result;
    if (state.mode === 'blend') {
      result = state.layer ? call('blend', image, state.layer, out, W, H) : (say('Đang tải lớp hiệu ứng…'), null);
    } else if (state.mode === 'scene') {
      const mask = personMask();
      if (!mask) { say('Chưa thấy mặt nạ người — bấm M để bật tách nền, rồi đứng vào khung.'); state.busy = false; return; }
      const background = clipGrid('background'), behind = clipGrid('behind'), front = clipGrid('front');
      if (!background || !behind || !front) { say('Đang tải ba đoạn video…'); state.busy = false; return; }
      result = call('scene', image, mask, background, behind, front, out, W, H);
    } else if (state.mode === 'blend_alpha') {
      if (!state.backdrop) { say('Đang tải ảnh nền…'); state.busy = false; return; }
      result = call('blend_alpha', image, state.backdrop, 50, out, W, H);
    } else if (state.mode === 'blur_background') {
      const mask = personMask();
      if (!mask) { say('Chưa thấy mặt nạ người — bấm M để bật tách nền, rồi đứng vào khung.'); state.busy = false; return; }
      result = call('blur_background', image, mask, out, W, H);
    } else if (state.mode === 'compose') {
      const mask = personMask();
      if (!mask) { say('Chưa thấy mặt nạ người — bấm M để bật tách nền, rồi đứng vào khung.'); state.busy = false; return; }
      if (!state.backdrop) { say('Đang tải ảnh nền…'); state.busy = false; return; }
      result = call('compose', image, mask, state.backdrop, out, W, H);
    } else {
      result = call(state.mode, image, out, W, H);
    }
    state.busy = false;
    if (result === null && !state.py) return;
    if (ui.log.style.color === 'rgb(255, 180, 180)') { setMode(null); return; }   // hàm lỗi: tắt luôn, đừng nhấp nháy
    // Hàm chưa làm bài thì chạy êm ru và trả lại đúng ảnh cũ — học sinh tưởng
    // máy hỏng. Nói thẳng ra thay vì để màn hình im lặng.
    if (unchanged(image, out)) say(`${state.mode}() chưa đổi gì trên ảnh — bạn đã viết phần "lượt của bạn" chưa?`);
    const flat = toFlat(out, W, H);
    const frame = ctx.createImageData(W, H);
    for (let i = 0; i < frame.data.length; i++) frame.data[i] = flat[i];
    ctx.putImageData(frame, 0, 0);
  }
  requestAnimationFrame(tick);

  function setMode(mode) {
    state.mode = mode;
    stage.style.display = mode ? 'block' : 'none';
    if (mode) say(`${mode.toUpperCase()} · đang chạy bằng Python của bạn`);
  }

  addEventListener('keydown', event => {
    if (event.target.matches?.('input, textarea')) return;
    const key = event.key.toLowerCase();
    if (key === 'x') { setMode(null); say('Đã tắt phép xử lý ảnh'); return; }
    if (key === 'r') { reload().then(ok => ok && say('Đã nạp lại student/*.py')); return; }
    if (key === 't') { const verdict = call('check_all'); if (verdict != null) say(String(verdict)); return; }
    if (MODES[key]) setMode(MODES[key]);
  });

  // Nút do học sinh gọi add_button() dựng ra. Bấm là chạy đúng hiệu ứng các em
  // gán, không qua bảng phép mặc định.
  function addButton(label, effect) {
    const button = document.createElement('button');
    button.className = 'py-btn';
    button.textContent = label;
    button.title = `play_effect("${effect}")`;
    button.onclick = () => { playEffect(effect); say(`${label} · play_effect("${effect}")`); };
    ui.buttons.appendChild(button);
  }

  // Gõ một từ rồi Enter là gọi thẳng on_voice() — học được phần giọng nói kể cả
  // khi máy không có micro hoặc lớp quá ồn.
  ui.word.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const word = ui.word.value.trim().toLowerCase();
    if (!word) return;
    ui.word.value = '';
    if (!api.voice(word)) say(`on_voice("${word}") chạy xong nhưng không gọi phép nào — nhánh else của bạn nói gì?`);
  });

  boot().catch(err => say(`Không tải được Python: ${err.message}`, true));
  return api;
}

// Chỉ dò vài chục ô là đủ biết hàm có đụng vào ảnh hay không — quét cả 96×72
// mỗi khung hình thì tốn hơn chính phép xử lý.
function unchanged(image, out) {
  for (let row = 0; row < image.length; row += 7) {
    for (let col = 0; col < image[row].length; col += 11) {
      const before = image[row][col], after = out[row][col];
      if (before[0] !== after[0] || before[1] !== after[1] || before[2] !== after[2]) return false;
    }
  }
  return true;
}

// Pyodide gói lỗi Python thành lỗi JS; dòng cuối của traceback mới là câu học
// sinh cần đọc, phần còn lại là ruột của Pyodide.
function pyError(err) {
  const text = String(err?.message || err);
  const lines = text.trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || text;
  const where = lines.find(l => /File "<exec>", line \d+/.test(l));
  return `✖ ${last}${where ? ` (${where.trim().replace('File "<exec>", ', '')})` : ''}`;
}

function buildPanel() {
  const canvas = document.createElement('canvas');
  canvas.className = 'py-stage'; canvas.width = W; canvas.height = H;
  Object.assign(canvas.style, {
    width: '288px', height: '216px', borderRadius: '12px', display: 'none',
    border: '1px solid rgba(120,178,165,.5)', background: '#0b0f18',
    boxShadow: '0 8px 30px rgba(0,0,0,.45)', imageRendering: 'pixelated',
  });
  // Hàng nút do chính học sinh dựng bằng add_button(), và ô thử giọng nói cho
  // máy không có micro (hoặc phòng quá ồn).
  const buttons = document.createElement('div');
  buttons.className = 'py-buttons';
  const voiceBox = document.createElement('div');
  voiceBox.className = 'py-voicebox';
  voiceBox.innerHTML = '<input class="py-word" placeholder="gõ một từ rồi Enter — thử on_voice()" maxlength="24">';

  const log = document.createElement('div');
  log.className = 'py-log';

  // Một cột duy nhất bên trái. Trước đây mỗi thứ neo một chỗ và đè lên bảng
  // thần chú của đồ chơi — nhìn rối, bấm nhầm.
  const station = document.getElementById('pystation') || Object.assign(document.createElement('div'), { id: 'pystation' });
  station.append(log, buttons, voiceBox);
  document.body.append(canvas, station);
  return { canvas, log, buttons, word: voiceBox.querySelector('.py-word') };
}
