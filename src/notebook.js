// notebook.js — trang làm bài. Từng ô một: đề bài, chỗ gõ code, nút chạy, và
// ẢNH VÀO / ẢNH RA dựng bằng CHÍNH hàm học sinh vừa viết.
//
// Ba điều đáng nhớ về chỗ này:
//   · Bộ chấm là `pygrade/grader.py`, dùng chung với phím T trong đồ chơi và
//     với `cham.py` ngoài dòng lệnh — không có chuyện chỗ này đạt chỗ kia sai.
//   · Ảnh demo cố ý nhỏ (160px): Python thuần chạy trong trình duyệt, ảnh to
//     thì mỗi lần bấm CHẠY phải đợi vài giây.
//   · Bài lưu trong localStorage. Xong hết thì trang ghép lại thành hai file
//     `student/*.py` để sân khấu thật đọc, rồi mới mở cổng sang đó.
import { CELLS, SCENE, DARK_SCENE, LAYER, PERSON, BEHIND } from './cells.js?v=3';   // xem ghi chú ?v= trong index.html

export { CELLS };

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const KEY = 'magicdust.kit.';
const CELL_KEY = 'magicdust.kit.cell.';
const DEMO_W = 160, DEMO_H = 120;
const SPELL_PREAMBLE = 'from magic_stage import play_effect, say, add_button, new_image\n\n';


const FINGER_TASKS = [[1, 'dragon'], [2, 'phoenix'], [3, 'sakura']];
const VOICE_TASKS = [['rồng', 'dragon'], ['hoa', 'sakura'], ['mưa', 'rain']];

// ── điểm ────────────────────────────────────────────────────────────────────
// Năm ô bắt buộc 1.4 điểm mỗi ô (7.0), bốn ô thêm 0.75 (3.0) — vừa tròn 10.
// Chia như vậy để làm xong phần bắt buộc đã là điểm khá, và bài thêm là phần
// thưởng thật chứ không phải trang trí.
const PASS_KEY = 'magicdust.kit.passed';
const NAME_KEY = 'magicdust.kit.name';
// 7 điểm chia đều cho phần bắt buộc, 3 điểm chia đều cho bài thêm. Chia theo
// tỉ lệ chứ không gán cứng từng bài, để thêm bài mới không làm vỡ thang 10.
export const REQUIRED_POINTS = 7, EXTRA_POINTS = 3;

export function loadPassed() {
  try { return new Set(JSON.parse(localStorage.getItem(PASS_KEY) || '[]')); } catch { return new Set(); }
}

export function savePassed(passed) {
  try { localStorage.setItem(PASS_KEY, JSON.stringify([...passed])); } catch { /* localStorage bị khoá */ }
}

export function studentName(value) {
  try {
    if (value === undefined) return localStorage.getItem(NAME_KEY) || '';
    localStorage.setItem(NAME_KEY, value);
  } catch { /* localStorage bị khoá */ }
  return value || '';
}

export function scoreOf(passed) {
  const requiredCells = CELLS.filter(cell => !cell.extra).length;
  const extraCells = CELLS.length - requiredCells;
  let required = 0, extra = 0;
  for (const cell of CELLS) {
    if (!passed.has(cell.id)) continue;
    if (cell.extra) extra += 1; else required += 1;
  }
  const points = required * (REQUIRED_POINTS / requiredCells) + extra * (EXTRA_POINTS / extraCells);
  return { required, extra, points: Math.round(points * 10) / 10 };
}

export function cellSource(cell) {
  try { return localStorage.getItem(CELL_KEY + cell.id) ?? cell.stub; } catch { return cell.stub; }
}

export function saveCell(cell, source) {
  try { localStorage.setItem(CELL_KEY + cell.id, source); } catch { /* trình duyệt khoá localStorage */ }
}

// Ghép các ô đã làm thành đúng hai file mà sân khấu thật đọc.
export function publishFiles() {
  const pick = kinds => CELLS.filter(c => kinds.includes(c.kind)).map(c => cellSource(c).trimEnd()).join('\n\n\n');
  try {
    localStorage.setItem(KEY + 'spells.py', SPELL_PREAMBLE + pick(['fingers', 'voice', 'setup']) + '\n');
    localStorage.setItem(KEY + 'image_spells.py', pick(['image', 'blend']) + '\n');
    return true;
  } catch { return false; }
}

export async function bootPython(onStatus) {
  onStatus('Đang tải Python… lần đầu hơi lâu, chỉ lần này thôi.');
  if (!self.loadPyodide) await new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = PYODIDE; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  const py = await self.loadPyodide();
  const grader = await fetch('./pygrade/grader.py').then(r => r.text());
  py.runPython(grader);
  // magic_stage giả: ghi lại lệnh để ô on_fingers/on_voice soi được kết quả.
  const log = [];
  py.registerJsModule('magic_stage', {
    play_effect: name => { log.push(['fx', String(name)]); return true; },
    cast: name => { log.push(['fx', String(name)]); return true; },
    say: text => { log.push(['say', String(text)]); return true; },
    add_button: (label, effect) => { log.push(['button', String(label), String(effect)]); return true; },
    new_image: (width, height) => blankGrid(width, height),
  });
  // Ô on_fingers/on_voice chỉ chứa đúng một hàm, không có dòng import ở đầu —
  // nên nhập sẵn hai lệnh đó vào namespace, đúng như file spells.py vẫn làm.
  py.runPython(SPELL_PREAMBLE);
  onStatus('Python sẵn sàng.');
  return { py, log };
}

// ── chạy một ô ──────────────────────────────────────────────────────────────
// Trả về {ok, message, extra} — `extra` là dữ liệu để vẽ ảnh hoặc in nhật ký.
export function runCell({ py, log }, cell, source, demo) {
  // Bài cuối gọi lại blend/compose của chính học sinh, nên nạp hai bài đó trước.
  // Mấy bài "ghép lại" gọi hàm các em viết ở bài trước, nên nạp mấy bài đó trước.
  const NEEDS = { scene: ['blend', 'compose'], blur_background: ['blur', 'compose'] };
  if (NEEDS[cell.id]) {
    for (const id of NEEDS[cell.id]) {
      const needed = CELLS.find(item => item.id === id);
      try { py.runPython(cellSource(needed)); }
      catch (err) { return { ok: false, message: `${id} của bạn đang lỗi: ${pyError(err)}` }; }
    }
  }
  try { py.runPython(source); }
  catch (err) { return { ok: false, message: pyError(err) }; }

  if (cell.kind === 'fingers' || cell.kind === 'voice') return runSpellCell(py, log, cell);
  if (cell.kind === 'setup') return runSetupCell(py, log);

  const verdict = py.runPython(`check_one(${JSON.stringify(cell.id)}, globals())`).toJs();
  const [ok, message] = verdict;
  const pixels = demo ? runOnDemo(py, cell, demo) : null;
  // Kể luôn bài test cho học sinh xem: máy đưa ảnh gì vào, chờ ra gì, và hàm
  // của em cho ra gì. Đúng/sai mà không thấy số thì chẳng học được gì.
  const test = py.runPython(`explain(${JSON.stringify(cell.id)}, globals())`).toJs();
  return { ok, message, pixels, test };
}

// Ô setup: gọi setup() rồi xem các em đã gắn được mấy nút. Ở trang làm bài
// add_button chỉ ghi vào nhật ký, sân khấu mới dựng nút thật.
function runSetupCell(py, log) {
  log.length = 0;
  try { py.runPython('setup()'); }
  catch (err) { return { ok: false, message: pyError(err) }; }
  const buttons = log.filter(entry => entry[0] === 'button');
  const rows = buttons.map(entry => ({ input: entry[1], wanted: 'một nút', hit: true, got: `play_effect("${entry[2]}")` }));
  if (buttons.length < 3) {
    rows.push({ input: '(còn thiếu)', wanted: 'ít nhất 3 nút', hit: false, got: `mới có ${buttons.length}` });
    return { ok: false, message: `setup: mới gắn ${buttons.length} nút, đề bài cần ít nhất 3`, rows };
  }
  return { ok: true, message: 'setup', rows };
}

function runSpellCell(py, log, cell) {
  const tasks = cell.kind === 'fingers' ? FINGER_TASKS : VOICE_TASKS;
  const call = cell.kind === 'fingers' ? 'on_fingers' : 'on_voice';
  const rows = [];
  let ok = true;
  for (const [input, wanted] of tasks) {
    log.length = 0;
    try { py.runPython(`${call}(${JSON.stringify(input)})`); }
    catch (err) { return { ok: false, message: pyError(err) }; }
    const fired = log.filter(entry => entry[0] === 'fx').map(entry => entry[1]);
    const said = log.filter(entry => entry[0] === 'say').map(entry => entry[1]);
    const hit = fired.includes(wanted);
    if (!hit) ok = false;
    rows.push({ input, wanted, hit, got: fired.length ? fired.join(', ') : (said[0] ?? '(không làm gì)') });
  }
  // Nhánh else: đầu vào lạ vẫn phải nói ra điều gì đó.
  log.length = 0;
  const spare = cell.kind === 'fingers' ? '9' : JSON.stringify('bâng quơ');
  try { py.runPython(`${call}(${spare})`); } catch (err) { return { ok: false, message: pyError(err) }; }
  const answered = log.length > 0;
  if (!answered) ok = false;
  rows.push({ input: cell.kind === 'fingers' ? 9 : 'bâng quơ', wanted: 'nói ra điều gì đó', hit: answered,
              got: log.length ? log[0][1] : '(im lặng)' });

  return { ok, message: ok ? cell.id : `${cell.id}: còn dòng ✖ ở bảng dưới`, rows };
}

// Canvas giữ ảnh dưới dạng một dãy số dài (đỏ,lá,dương,đục lặp lại); học sinh
// thì làm việc với image[row][col] -> [đỏ, lá, dương]. Hai hàm này dịch qua
// lại. Dịch bằng JS nên rẻ; Python chỉ chạy đúng vòng lặp của các em.
export function toGrid(flat, width, height) {
  const grid = [];
  for (let row = 0; row < height; row++) {
    const line = [];
    for (let col = 0; col < width; col++) {
      const at = (row * width + col) * 4;
      line.push([flat[at], flat[at + 1], flat[at + 2]]);
    }
    grid.push(line);
  }
  return grid;
}

export function toFlat(grid, width, height) {
  const flat = new Array(width * height * 4).fill(255);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const pixel = grid[row][col];
      const at = (row * width + col) * 4;
      flat[at] = pixel[0]; flat[at + 1] = pixel[1]; flat[at + 2] = pixel[2];
    }
  }
  return flat;
}

export function blankGrid(width, height) {
  const grid = [];
  for (let row = 0; row < height; row++) {
    const line = [];
    for (let col = 0; col < width; col++) line.push([0, 0, 0]);
    grid.push(line);
  }
  return grid;
}

// Chạy hàm của học sinh trên ẢNH THẬT đã thu nhỏ, trả về dãy số để vẽ ra canvas.
function runOnDemo(py, cell, demo) {
  const { width, height } = demo;
  let args = `_image, _out, ${width}, ${height}`;
  if (cell.kind === 'blend') args = `_image, _layer, _out, ${width}, ${height}`;
  if (cell.kind === 'compose') args = cell.id === 'blur_background'
    ? `_image, _mask, _out, ${width}, ${height}`
    : `_image, _mask, _background, _out, ${width}, ${height}`;
  if (cell.kind === 'scene') args = `_image, _mask, _background, _behind, _layer, _out, ${width}, ${height}`;
  py.globals.set('_image', py.toPy(toGrid(baseFor(cell, demo), width, height)));
  if (cell.kind === 'blend') py.globals.set('_layer', py.toPy(toGrid(demo.layer, width, height)));
  if (cell.kind === 'compose' || cell.kind === 'scene') {
    py.globals.set('_mask', py.toPy(demo.mask));
    py.globals.set('_background', py.toPy(toGrid(demo.base, width, height)));
  }
  if (cell.kind === 'scene') {
    py.globals.set('_behind', py.toPy(toGrid(demo.behind, width, height)));
    py.globals.set('_layer', py.toPy(toGrid(demo.layer, width, height)));
  }
  py.globals.set('_out', py.toPy(blankGrid(width, height)));
  try {
    py.runPython(`${cell.id}(${args})`);
    return toFlat(py.globals.get('_out').toJs(), width, height);
  } catch { return null; }                    // lỗi đã được bộ chấm nói rồi
}

// Hai nền: cảnh sáng cho hầu hết các phép, nền tối riêng cho lend — cộng
// một lớp sáng lên nền vốn đã sáng thì trắng xoá, học sinh không thấy gì.
export async function loadDemo() {
  const [base, dark, layer, person, behind] = await Promise.all([grab(SCENE), grab(DARK_SCENE), grab(LAYER), grab(PERSON), grab(BEHIND)]);
  // Ảnh nhân vật có nền trong suốt, nên kênh độ đục của nó CHÍNH LÀ mặt nạ:
  // chỗ nào đục là người. Khỏi cần chụp ảnh ai hay tải model về.
  const mask = [];
  for (let row = 0; row < DEMO_H; row++) {
    const line = [];
    for (let col = 0; col < DEMO_W; col++) line.push(person[(row * DEMO_W + col) * 4 + 3]);
    mask.push(line);
  }
  return { base, dark, layer, person, behind, mask, width: DEMO_W, height: DEMO_H };
}

// Ảnh vào của một ô: lend lấy nền tối, còn lại lấy cảnh sáng.
export function baseFor(cell, demo) {
  if (cell.kind === 'blend') return demo.dark;
  // blur_background chạy trên CẢNH, không phải trên ảnh nhân vật: nền của tấm
  // nhân vật vốn đã trống trơn nên làm mờ nó chẳng thấy khác gì.
  if (cell.id === 'blur_background') return demo.base;
  if (cell.kind === 'compose' || cell.kind === 'scene') return demo.person;
  return demo.base;
}

// Mật khẩu mở đáp án — băm bằng djb2 để không nằm chình ình trong mã nguồn.
// Đây là cái chốt cửa cho vui, không phải khoá két: ai chịu khó đọc mã vẫn mở
// được. Mục đích chỉ là để học sinh không lỡ tay bấm ra đáp án.
const PASSWORD_HASH = 756893813;

export function passwordOk(text) {
  let hash = 5381;
  for (const ch of String(text)) hash = ((hash * 33) ^ ch.codePointAt(0)) >>> 0;
  return hash === PASSWORD_HASH;
}

function grab(src) {
  return new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = DEMO_W; c.height = DEMO_H;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, DEMO_W, DEMO_H);
      done(Array.from(cx.getImageData(0, 0, DEMO_W, DEMO_H).data));
    };
    img.onerror = () => fail(new Error(`không tải được ${src}`));
    img.src = src;
  });
}

export function paintPixels(canvas, pixels, width, height) {
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const frame = ctx.createImageData(width, height);
  for (let i = 0; i < frame.data.length; i++) frame.data[i] = pixels[i];
  ctx.putImageData(frame, 0, 0);
}

// Dòng cuối traceback mới là câu học sinh cần đọc; phần trên là ruột Pyodide.
export function pyError(err) {
  const text = String(err?.message || err);
  const lines = text.trim().split('\n').filter(Boolean);
  const last = lines[lines.length - 1] || text;
  const where = lines.find(line => /File "<exec>", line \d+/.test(line));
  return `${last}${where ? ` (${where.trim().replace('File "<exec>", ', '')})` : ''}`;
}

// XƯỞNG THỬ: chạy liên tiếp mấy hàm học sinh đã viết trên cùng một tấm ảnh.
// Đây là chỗ các em thấy hàm của mình là đồ dùng thật, ghép được với nhau.
export function runChain({ py }, names, demo) {
  const { width, height } = demo;
  // Nạp lại đúng bài học sinh đang giữ cho từng phép: mở trang mới thì Python
  // chưa biết hàm nào cả, và ta muốn chạy bản MỚI NHẤT các em vừa gõ.
  for (const name of names) {
    const cell = CELLS.find(item => item.id === name);
    if (!cell) continue;
    try { py.runPython(cellSource(cell)); }
    catch (err) { return { ok: false, message: `${name}: ${pyError(err)}` }; }
  }
  // Chuỗi bắt đầu từ ảnh NGƯỜI, để compose có cái mà ghép lên nền.
  py.globals.set('_image', py.toPy(toGrid(demo.person, width, height)));
  py.globals.set('_layer', py.toPy(toGrid(demo.layer, width, height)));
  py.globals.set('_mask', py.toPy(demo.mask));
  py.globals.set('_background', py.toPy(toGrid(demo.base, width, height)));
  try {
    for (const name of names) {
      py.globals.set('_out', py.toPy(blankGrid(width, height)));
      let args = `_image, _out, ${width}, ${height}`;
      if (name === 'blend') args = `_image, _layer, _out, ${width}, ${height}`;
      if (name === 'compose') args = `_image, _mask, _background, _out, ${width}, ${height}`;
      py.runPython(`${name}(${args})`);
      py.runPython('_image = _out');       // kết quả bước này là ảnh vào của bước sau
    }
    return { ok: true, pixels: toFlat(py.globals.get('_image').toJs(), width, height) };
  } catch (err) { return { ok: false, message: pyError(err) }; }
}
