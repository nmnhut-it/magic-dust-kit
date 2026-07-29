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
import { CELLS, SCENE, DARK_SCENE, LAYER } from './cells.js';

export { CELLS };

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const KEY = 'magicdust.kit.';
const CELL_KEY = 'magicdust.kit.cell.';
const DEMO_W = 160, DEMO_H = 120;
const SPELL_PREAMBLE = 'from magic_stage import play_effect, say\n\n';

const FINGER_TASKS = [[1, 'dragon'], [2, 'phoenix'], [3, 'sakura']];
const VOICE_TASKS = [['rồng', 'dragon'], ['hoa', 'sakura'], ['mưa', 'rain']];

// ── điểm ────────────────────────────────────────────────────────────────────
// Năm ô bắt buộc 1.4 điểm mỗi ô (7.0), bốn ô thêm 0.75 (3.0) — vừa tròn 10.
// Chia như vậy để làm xong phần bắt buộc đã là điểm khá, và bài thêm là phần
// thưởng thật chứ không phải trang trí.
const PASS_KEY = 'magicdust.kit.passed';
const NAME_KEY = 'magicdust.kit.name';
export const POINT_REQUIRED = 1.4, POINT_EXTRA = 0.75;

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
  let required = 0, extra = 0;
  for (const cell of CELLS) {
    if (!passed.has(cell.id)) continue;
    if (cell.extra) extra += 1; else required += 1;
  }
  const points = required * POINT_REQUIRED + extra * POINT_EXTRA;
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
    localStorage.setItem(KEY + 'spells.py', SPELL_PREAMBLE + pick(['fingers', 'voice']) + '\n');
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
  try { py.runPython(source); }
  catch (err) { return { ok: false, message: pyError(err) }; }

  if (cell.kind === 'fingers' || cell.kind === 'voice') return runSpellCell(py, log, cell);

  const verdict = py.runPython(`check_one(${JSON.stringify(cell.id)}, globals())`).toJs();
  const [ok, message] = verdict;
  const pixels = demo ? runOnDemo(py, cell, demo) : null;
  return { ok, message, pixels };
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

// Chạy hàm của học sinh trên ẢNH THẬT đã thu nhỏ, trả về mảng pixel để vẽ ra.
function runOnDemo(py, cell, demo) {
  const args = cell.kind === 'blend'
    ? `_px, _layer, _out, ${demo.width}, ${demo.height}`
    : `_px, _out, ${demo.width}, ${demo.height}`;
  py.globals.set('_px', py.toPy(baseFor(cell, demo)));
  if (cell.kind === 'blend') py.globals.set('_layer', py.toPy(demo.layer));
  py.globals.set('_out', py.toPy(new Array(baseFor(cell, demo).length).fill(255)));
  try {
    py.runPython(`${cell.id}(${args})`);
    return py.globals.get('_out').toJs();
  } catch { return null; }                    // lỗi đã được bộ chấm nói rồi
}

// Hai nền: cảnh sáng cho hầu hết các phép, nền tối riêng cho lend — cộng
// một lớp sáng lên nền vốn đã sáng thì trắng xoá, học sinh không thấy gì.
export async function loadDemo() {
  const [base, dark, layer] = await Promise.all([grab(SCENE), grab(DARK_SCENE), grab(LAYER)]);
  return { base, dark, layer, width: DEMO_W, height: DEMO_H };
}

// Ảnh vào của một ô: lend lấy nền tối, còn lại lấy cảnh sáng.
export function baseFor(cell, demo) {
  return cell.kind === 'blend' ? demo.dark : demo.base;
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
