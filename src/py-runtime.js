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
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const FILES = ['./student/spells.py', './student/image_spells.py'];
const W = 96, H = 72;              // Python thuần chạy ~22-160 khung/giây ở cỡ này
const FRAME_EVERY = 2;             // xử lý 1 trong 2 khung, chừa hơi cho phần 3D
const PLATE = './lessons/assets/camera-effects/plates/fx-dragon.webp';
// Ba phép bắt buộc, rồi bốn bài thêm. Phím chọn sao cho không đụng phím nào
// của đồ chơi (main.js đã giữ b/f/n/g/k/l/m/p/u và mấy phím số).
const MODES = {
  f: 'flip', b: 'blur', n: 'blend',
  a: 'negative', w: 'grayscale', v: 'flip_vertical', c: 'drop_blue',
};

export function mountPython({ video, playEffect, cast, onStatus }) {
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
      play_effect: name => { playEffect(String(name)); return true; },
      cast: name => { cast(String(name)); return true; },
      say: text => { say(`Python: ${text}`); return true; },
    });
    await reload();
  }

  async function reload() {
    try {
      const sources = await Promise.all(FILES.map(async path => {
        const res = await fetch(`${path}?t=${Date.now()}`);      // ?t= để trình duyệt đừng dùng bản cũ
        if (!res.ok) throw new Error(`không đọc được ${path}`);
        return res.text();
      }));
      for (const source of sources) state.py.runPython(source);
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
      if (!state.py || count === state.lastFingers) return;
      state.lastFingers = count;
      if (count > 0) call('on_fingers', count);
    },
    voice(word) { if (state.py) call('on_voice', String(word)); },
    ready: () => !!state.py,
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
    state.layer = Array.from(cx.getImageData(0, 0, W, H).data);
  };
  plate.src = PLATE;

  function tick() {
    requestAnimationFrame(tick);
    if (!state.mode || !state.py || !video?.videoWidth || state.busy) return;
    if (state.frame++ % FRAME_EVERY) return;
    grabCtx.drawImage(video, 0, 0, W, H);
    const src = grabCtx.getImageData(0, 0, W, H);
    const px = Array.from(src.data);
    const out = new Array(px.length).fill(255);
    state.busy = true;
    const result = state.mode === 'blend'
      ? (state.layer ? call('blend', px, state.layer, out, W, H) : (say('Đang tải lớp hiệu ứng…'), null))
      : call(state.mode, px, out, W, H);
    state.busy = false;
    if (result === null && !state.py) return;
    if (ui.log.style.color === 'rgb(255, 180, 180)') { setMode(null); return; }   // hàm lỗi: tắt luôn, đừng nhấp nháy
    // Hàm chưa làm bài thì chạy êm ru và trả lại đúng ảnh cũ — học sinh tưởng
    // máy hỏng. Nói thẳng ra thay vì để màn hình im lặng.
    if (unchanged(px, out)) say(`${state.mode}() chưa đổi gì trên ảnh — bạn đã viết phần "lượt của bạn" chưa?`);
    const frame = ctx.createImageData(W, H);
    for (let i = 0; i < frame.data.length; i++) frame.data[i] = out[i];
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

  boot().catch(err => say(`Không tải được Python: ${err.message}`, true));
  return api;
}

// Chỉ dò vài trăm ô là đủ biết hàm có đụng vào ảnh hay không — quét cả 96×72
// mỗi khung hình thì tốn hơn chính phép xử lý.
function unchanged(px, out) {
  for (let i = 0; i < px.length; i += 397 * 4) if (px[i] !== out[i] || px[i + 1] !== out[i + 1] || px[i + 2] !== out[i + 2]) return false;
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
    position: 'fixed', right: '14px', bottom: '14px', width: '288px', height: '216px',
    borderRadius: '12px', border: '1px solid rgba(120,178,165,.5)', zIndex: 40, display: 'none',
    background: '#0b0f18', boxShadow: '0 8px 30px rgba(0,0,0,.45)', imageRendering: 'pixelated',
  });
  const log = document.createElement('div');
  Object.assign(log.style, {
    position: 'fixed', right: '14px', bottom: '236px', zIndex: 41, maxWidth: '320px',
    font: '700 12px/1.45 ui-monospace,Menlo,monospace', letterSpacing: '.5px', color: '#eaf4ff',
    background: 'rgba(11,15,24,.85)', padding: '7px 10px', borderRadius: '9px', whiteSpace: 'pre-wrap',
  });
  document.body.append(canvas, log);
  return { canvas, log };
}
