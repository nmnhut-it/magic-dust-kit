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
import { toGrid, toFlat, blankGrid } from './notebook.js?v=4';
import { BACKDROPS, EFFECT_CLIPS } from './cells.js?v=4';   // cùng cách dịch ảnh với trang làm bài
import { listClips } from './my-fx-store.js?v=4';   // video của chính học sinh — cùng kho với my-fx-panel.js

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
  j: 'blend_over',                 // ghép chuẩn: nền đè lên bạn theo mặt nạ người
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

  // `pick` là sân khấu do học sinh chọn trong stage(); mặc định để trống, máy
  // chỉ dùng đồ có sẵn khi các em chưa chọn gì.
  const state = { py: null, mode: null, frame: 0, layer: null, lastFingers: -1, busy: false,
                  pick: { behind: null, front: null }, lastWord: '' };
  // Handler riêng (hàm Python) của mấy nút add_button — giữ để huỷ đúng lúc,
  // xem ghi chú ở add_button/reload().
  const buttonHandlers = [];
  // Nhãn nút đã gắn — setup() và stage() là hai bài RIÊNG, cả hai đều tự gọi
  // add_button(), nên học sinh làm xong cả hai dễ thấy nút trùng tên hai lần
  // (VD "Rồng Lửa" từ cả hai bài). Cùng một nhãn thì chỉ hiện MỘT nút.
  const buttonLabels = new Set();

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
      // trên màn hình. Gọi trong hàm setup() ở student/spells.py. `effect` là
      // TÊN một hiệu ứng có sẵn (chuỗi) — hoặc HÀM Python của chính học sinh,
      // Pyodide tự đưa sang thành một hàm JS gọi được, nên bấm nút là chạy
      // đúng mã các em viết, không chỉ chọn cái tên có sẵn.
      add_button: (label, effect) => {
        // Pyodide chỉ giữ một hàm Python đưa sang JS sống hết một lượt gọi —
        // nút thì bấm bất cứ lúc nào, lâu sau add_button() đã trả về, nên
        // phải .copy() để giữ nó sống tới lúc đó (destroy khi bấm R nạp lại).
        const handler = (typeof effect === 'function' && typeof effect.copy === 'function') ? effect.copy() : effect;
        addButton(String(label), handler);
        return true;
      },
      // Bao nhiêu ngón tay đang giơ NGAY LÚC NÀY. Có nó thì on_voice mới kết
      // hợp được hai điều kiện: đúng thế tay VÀ đúng lời niệm.
      fingers_now: () => state.lastFingers < 0 ? 0 : state.lastFingers,
      // Ba lệnh để học sinh tự dựng sân khấu trong hàm stage().
      set_background: name => { pickBackdrop(String(name)); return true; },
      set_behind: name => { state.pick.behind = String(name); return true; },
      set_front: name => { state.pick.front = String(name); return true; },
      // Bài main_loop: đọc từ vừa nghe được (rỗng nếu chưa ai nói/gõ gì mới),
      // đọc xong là XOÁ luôn — một câu nói không lặp lại mãi trong vòng lặp poll.
      heard_word: () => { const w = state.lastWord; state.lastWord = ''; return w; },
      // Học sinh tự viết async def main_loop(): rồi gọi run_loop(main_loop) MỘT
      // LẦN để bắt đầu. Việc thật (ensure_future/cancel) làm ở PHÍA PYTHON qua
      // _magic_start_loop (xem loopPreamble bên dưới) — gọi coroFn() ngay ở
      // JS rồi đưa coroutine đó cho asyncio TỪ JS sẽ văng "Object has already
      // been destroyed" (Pyodide huỷ coroutine tạm ngay khi lượt gọi JS xong,
      // trước khi asyncio kịp chạy nó ở tick sau) — nên JS chỉ chuyển tiếp hàm
      // main_loop nguyên vẹn, để Python tự gọi và tự lên lịch nó.
      run_loop: coroFn => { state.py.globals.get('_magic_start_loop')(coroFn); return true; },
      // Lỗi bên trong vòng lặp (task async chạy nền) báo về qua đây — done
      // callback ở phía Python bắt exception rồi gọi hàm này với text traceback.
      _report_loop_error: text => { say(loopErrorMessage(String(text)), true); },
    });
    // Quản lý task async main_loop HOÀN TOÀN ở phía Python: JS không giữ bất
    // kỳ proxy coroutine/Task nào — chỉ gọi hai hàm mỏng này. Đây là cách né
    // vòng đời proxy tạm của Pyodide (coroutine trả từ một lời gọi JS→Python
    // bị huỷ ngay khi lượt gọi đó xong, trước khi asyncio kịp chạy nó).
    state.py.runPython(`
import asyncio as _magic_asyncio, traceback as _magic_tb
from magic_stage import _report_loop_error as _magic_report_loop_error
_magic_loop_task = None
def _magic_start_loop(coro_func):
    global _magic_loop_task
    if _magic_loop_task is not None:
        _magic_loop_task.cancel()
    def _magic_on_done(t):
        if t.cancelled():
            return
        exc = t.exception()
        if exc is not None:
            _magic_report_loop_error("".join(_magic_tb.format_exception(type(exc), exc, exc.__traceback__)))
    _magic_loop_task = _magic_asyncio.ensure_future(coro_func())
    _magic_loop_task.add_done_callback(_magic_on_done)
def _magic_cancel_loop():
    global _magic_loop_task
    if _magic_loop_task is not None:
        _magic_loop_task.cancel()
        _magic_loop_task = None
`);
    await loadCustomClips();
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
      await loadCustomClips();   // học sinh có thể vừa tải video mới lên trước khi bấm R
      // Huỷ vòng lặp main_loop() cũ (nếu có) TRƯỚC khi chạy lại file — không
      // thì bấm R là có thêm một vòng lặp chạy song song với vòng cũ. Việc
      // huỷ làm ở phía Python (_magic_cancel_loop, định nghĩa trong boot()).
      const cancelLoop = state.py.globals.get('_magic_cancel_loop');
      if (cancelLoop) { try { cancelLoop(); } finally { cancelLoop.destroy?.(); } }
      const sources = await Promise.all([readFile(GRADER), ...FILES.map(readFile)]);
      for (const source of sources) state.py.runPython(source);
      // setup() là chỗ học sinh tự gắn nút cho phép của mình. Xoá bảng cũ
      // trước, nếu không mỗi lần bấm R lại mọc thêm một bộ nút trùng — và huỷ
      // proxy của hàm cũ (nếu nút nào dùng handler riêng) kẻo rò bộ nhớ.
      for (const handler of buttonHandlers) handler.destroy?.();
      buttonHandlers.length = 0;
      buttonLabels.clear();
      ui.buttons.textContent = '';
      state.pick = { behind: null, front: null };
      if (state.py.globals.get('setup')) call('setup');
      // stage() luôn TỒN TẠI (đề gốc cũng có def stage(): pass) — chỉ tự mở
      // scene mode khi học sinh THẬT SỰ đã gọi set_background(...), không thì
      // học sinh chưa tới bài này sẽ vô cớ thấy "chưa thấy mặt nạ người".
      state.backdropChosen = false;
      if (state.py.globals.get('stage')) call('stage');
      if (state.backdropChosen) {
        setMode('scene');       // sân khấu của bạn tự mở ngay — không cần bấm phím S
        say('Sân khấu bạn dựng — đang chạy');
      } else {
        say('Python sẵn sàng — sửa file trong student/ rồi bấm R để nạp lại');
      }
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
    // Ghi từ vừa nghe được vào một ô nhớ để heard_word() (bài main_loop) đọc
    // được — kênh này KHÔNG gọi on_voice, chỉ nạp dữ liệu cho vòng lặp của
    // học sinh tự poll lấy khi tới lượt nó.
    hearWord(word) { state.lastWord = String(word); },
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

  // Clip video của chính học sinh (bảng "+ HIỆU ỨNG CỦA BẠN") — tên → blob URL.
  // Nạp lại mỗi lần boot/reload để clip vừa tải lên cũng dùng được ngay trong
  // set_background/set_behind/set_front, không chỉ trong play_effect().
  let customClips = {};
  async function loadCustomClips() {
    for (const url of Object.values(customClips)) URL.revokeObjectURL(url);
    customClips = {};
    for (const clip of await listClips()) customClips[clip.name] = URL.createObjectURL(clip.blob);
  }

  // Nền do học sinh chọn: ảnh có sẵn thì vẽ vào lưới, video (có sẵn hoặc do
  // chính học sinh tự bỏ vào) thì đọc từng khung.
  function pickBackdrop(name) {
    const custom = customClips[name];
    const src = custom || BACKDROPS[name];
    if (!src) {
      const choices = [...Object.keys(BACKDROPS), ...Object.keys(customClips)].join(' · ');
      say(`Chưa có nền tên "${name}" — chọn: ${choices}`, true);
      return;
    }
    if (custom || /\.(mp4|webm)$/.test(src)) {
      state.backdropClip = getClip(src);
      state.backdropClip.play().catch(() => {});
      state.backdrop = null;                 // đọc từng khung trong tick()
    } else {
      state.backdropClip = null;
      backdrop.src = src;                    // onload phía trên dựng lại lưới
    }
    state.backdropChosen = true;   // đánh dấu học sinh ĐÃ THẬT SỰ gọi set_background
    say(`Nền: ${name}`);
  }

  // Khung hình hiện tại của nền, dù nền là ảnh hay video.
  function backdropGrid() {
    if (state.backdropClip) return clipGridOf(state.backdropClip);
    return state.backdrop;
  }

  // Clip cho bài `scene`/`stage`, tính theo src chứ không theo tên — một
  // nguồn video (có sẵn hay của học sinh) chỉ cần dựng một thẻ <video> duy
  // nhất dù được gọi làm nền, lớp sau, hay lớp trước.
  function makeClip(src) {
    const clip = document.createElement('video');
    clip.src = src; clip.muted = true; clip.loop = true; clip.playsInline = true;
    // PHẢI gắn vào <body> (ẩn đi) — video chưa từng vào DOM thì nhiều trình
    // duyệt lặng lẽ không chạy autoplay, .play() coi như thành công nhưng
    // currentTime đứng yên ở 0 mãi mãi: nền/hiệu ứng thành một khung hình
    // chết thay vì video thật. Phát hiện được vì đã tự tay kiểm currentTime
    // có tăng theo thời gian không, chứ không chỉ nhìn ảnh tĩnh một lần.
    clip.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(clip);
    clip.play().catch(() => {});          // trình duyệt chặn autoplay: bấm một cái là chạy
    return clip;
  }
  const clipCache = new Map();
  function getClip(src) {
    if (!clipCache.has(src)) clipCache.set(src, makeClip(src));
    return clipCache.get(src);
  }
  for (const src of Object.values(SCENE_CLIPS)) getClip(src);
  const clipCv = document.createElement('canvas'); clipCv.width = W; clipCv.height = H;
  const clipCtx = clipCv.getContext('2d', { willReadFrequently: true });
  function clipGridOf(clip) {
    if (!clip?.videoWidth) return null;
    clipCtx.drawImage(clip, 0, 0, W, H);
    return toGrid(Array.from(clipCtx.getImageData(0, 0, W, H).data), W, H);
  }

  // Lớp sau / lớp trước: ưu tiên thứ học sinh chọn trong stage() — hiệu ứng có
  // sẵn (EFFECT_CLIPS) hoặc chính video học sinh vừa tải lên (customClips).
  function clipGrid(role) {
    const chosen = state.pick[role];
    if (chosen) {
      const src = customClips[chosen] || EFFECT_CLIPS[chosen];
      if (!src) {
        say(`Chưa có hiệu ứng tên "${chosen}" cho set_${role} — kiểm tra lại tên bạn gõ.`, true);
        return clipGridOf(getClip(SCENE_CLIPS[role]));
      }
      return clipGridOf(getClip(src));
    }
    return clipGridOf(getClip(SCENE_CLIPS[role]));
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
      const background = backdropGrid() || clipGrid('background'), behind = clipGrid('behind'), front = clipGrid('front');
      if (!background || !behind || !front) { say('Đang tải ba đoạn video…'); state.busy = false; return; }
      result = call('scene', image, mask, background, behind, front, out, W, H);
    } else if (state.mode === 'blend_over') {
      const mask = personMask();
      if (!mask) { say('Chưa thấy mặt nạ người — bấm M để bật tách nền, rồi đứng vào khung.'); state.busy = false; return; }
      const under = backdropGrid();
      if (!under) { say('Đang tải ảnh nền…'); state.busy = false; return; }
      // lớp dưới là ảnh nền, lớp trên là bạn, alpha là mặt nạ người
      result = call('blend_over', under, image, mask, out, W, H);
    } else if (state.mode === 'blend_alpha') {
      const under = backdropGrid();
      if (!under) { say('Đang tải ảnh nền…'); state.busy = false; return; }
      result = call('blend_alpha', image, under, 50, out, W, H);
    } else if (state.mode === 'blur_background') {
      const mask = personMask();
      if (!mask) { say('Chưa thấy mặt nạ người — bấm M để bật tách nền, rồi đứng vào khung.'); state.busy = false; return; }
      result = call('blur_background', image, mask, out, W, H);
    } else if (state.mode === 'compose') {
      const mask = personMask();
      if (!mask) { say('Chưa thấy mặt nạ người — bấm M để bật tách nền, rồi đứng vào khung.'); state.busy = false; return; }
      const under = backdropGrid();
      if (!under) { say('Đang tải ảnh nền…'); state.busy = false; return; }
      result = call('compose', image, mask, under, out, W, H);
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

  // Nút do học sinh gọi add_button() dựng ra. `effect` là tên hiệu ứng có sẵn
  // (chuỗi) thì bấm là chạy play_effect(effect); là HÀM của chính học sinh thì
  // bấm là chạy đúng hàm đó — nút của em có thể làm bất cứ gì mã Python cho phép.
  function addButton(label, effect) {
    if (buttonLabels.has(label)) return;   // đã có nút cùng tên rồi — khỏi mọc thêm
    buttonLabels.add(label);
    const isHandler = typeof effect === 'function';
    if (isHandler) buttonHandlers.push(effect);
    const button = document.createElement('button');
    button.className = 'py-btn';
    button.textContent = label;
    button.title = isHandler ? `${label} — chạy hàm Python của bạn` : `play_effect("${effect}")`;
    button.onclick = () => {
      if (isHandler) {
        // Hàm của học sinh thường tự gọi play_effect/say rồi — cái đó đã
        // hiện lên máy in, không cần đè thêm dòng chung chung lên trên.
        state.acted = false;
        try { effect(); } catch (err) { say(pyError(err), true); return; }
        if (!state.acted) say(`${label} · đã chạy hàm của bạn`);
      } else {
        playEffect(effect);
        say(`${label} · play_effect("${effect}")`);
      }
    };
    ui.buttons.appendChild(button);
  }

  // Gõ một từ rồi Enter là gọi thẳng on_voice() — học được phần giọng nói kể cả
  // khi máy không có micro hoặc lớp quá ồn.
  ui.word.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const word = ui.word.value.trim().toLowerCase();
    if (!word) return;
    ui.word.value = '';
    state.lastWord = word;   // cho heard_word() (bài main_loop) đọc được luôn, kể cả không có mic
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

// Lỗi bên trong main_loop() chạy nền — Python tự bắt exception rồi gửi text
// traceback thô sang đây (xem _magic_on_done trong boot()), không đi qua một
// JS Error object như pyError() ở trên, nhưng cùng cách chọn dòng đáng đọc.
function loopErrorMessage(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || text;
  const where = lines.find(l => /File "<exec>", line \d+/.test(l));
  return `✖ main_loop: ${last}${where ? ` (${where.trim().replace('File "<exec>", ', '')})` : ''}`;
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
