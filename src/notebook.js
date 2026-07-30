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
import { CELLS, SCENE, DARK_SCENE, LAYER, PERSON, BEHIND } from './cells.js?v=4';   // xem ghi chú ?v= trong index.html

export { CELLS };

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const KEY = 'magicdust.kit.';
// Số 2 trong khoá là ĐỜI của đề bài. Đề bài từng dùng ảnh phẳng (px[i]) rồi
// đổi sang mảng ba chiều (image[row][col]); bài cũ lưu trong máy học sinh vẫn
// chạy được cú pháp nhưng vỡ ngay khi gặp dữ liệu mới, với thông báo khó hiểu
// kiểu "+=: 'int' and 'list'". Đổi đời khoá là mọi máy bắt đầu lại từ đề mới.
const CELL_KEY = 'magicdust.kit.cell2.';
const OLD_CELL_KEY = 'magicdust.kit.cell.';

// Còn bài đời cũ trong máy không? Trang dùng cái này để báo cho học sinh biết.
export function legacyWork() {
  try {
    const found = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(OLD_CELL_KEY)) found.push(key.slice(OLD_CELL_KEY.length));
    }
    return found;
  } catch { return []; }
}
const DEMO_W = 160, DEMO_H = 120;
const IMAGE_PREAMBLE = 'from magic_stage import new_image\n\n';
const SPELL_PREAMBLE = 'import asyncio\n'
  + 'from magic_stage import play_effect, say, add_button, fingers_now, '
  + 'set_background, set_behind, set_front, heard_word, run_loop' + '\n\n';


const FINGER_TASKS = [[1, 'dragon'], [2, 'phoenix'], [3, 'sakura']];
// [số ngón tay, từ nói ra, phép phải hiện]. Hai lượt cuối cố tình sai thế tay
// và sai lời, để bắt được bài chỉ kiểm một vế.
const VOICE_TASKS = [[1, 'rồng', 'dragon'], [2, 'phượng', 'phoenix'], [3, 'hoa', 'sakura'],
                     [1, 'dragon', 'dragon'], [3, 'sakura', 'sakura']];
const VOICE_TRAPS = [[2, 'rồng'], [1, 'hoa'], [0, 'dragon']];

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

// Ô nào thuộc file nào. Khai một chỗ duy nhất — trước đây danh sách này nằm
// rải trong lời gọi và tôi thêm bài mới mà quên sửa, thành ra sân khấu báo
// "chưa thấy hàm compose" dù học sinh đã làm xong.
const SPELL_KINDS = ['fingers', 'voice', 'setup', 'stage', 'loop'];
const IMAGE_KINDS = ['image', 'blend', 'blend_alpha', 'over', 'compose', 'scene'];

// Ghép các ô thành đúng hai file mà sân khấu thật đọc.
export function publishFiles() {
  const pick = kinds => CELLS.filter(c => kinds.includes(c.kind)).map(c => cellSource(c).trimEnd()).join('\n\n\n');
  try {
    localStorage.setItem(KEY + 'spells.py', SPELL_PREAMBLE + pick(SPELL_KINDS) + '\n');
    localStorage.setItem(KEY + 'image_spells.py', IMAGE_PREAMBLE + pick(IMAGE_KINDS) + '\n');
    return true;
  } catch { return false; }
}

// Kiểm ngay: mọi ô phải nằm trong đúng một file, không ô nào rơi ra ngoài.
const homeless = CELLS.filter(c => !SPELL_KINDS.includes(c.kind) && !IMAGE_KINDS.includes(c.kind));
if (homeless.length) console.warn('ô chưa được gán vào file nào:', homeless.map(c => c.id));

const handHolds = { count: 0 };   // số ngón tay giả, dùng khi chấm ô on_voice
const wordNow = { text: '' };      // từ nghe được giả, dùng khi chấm ô main_loop

export async function bootPython(onStatus) {
  onStatus('Đang tải Python… lần đầu hơi lâu, chỉ lần này thôi.');
  if (!self.loadPyodide) await new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = PYODIDE; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  const printed = [];
  const py = await self.loadPyodide({
    stdout: line => printed.push(line),
    stderr: line => printed.push(line),
  });
  const grader = await fetch('./pygrade/grader.py').then(r => r.text());
  py.runPython(grader);
  // magic_stage giả: ghi lại lệnh để ô on_fingers/on_voice soi được kết quả.
  const log = [];
  py.registerJsModule('magic_stage', {
    play_effect: name => { log.push(['fx', String(name)]); return true; },
    cast: name => { log.push(['fx', String(name)]); return true; },
    say: text => { log.push(['say', String(text)]); return true; },
    add_button: (label, effect) => {
      // effect có thể là tên hiệu ứng (chuỗi) hoặc một hàm Python của học
      // sinh — trang làm bài chỉ cần ĐẾM nút, không cần chạy thử hàm đó.
      const shown = typeof effect === 'function' ? '(hàm riêng)' : String(effect);
      log.push(['button', String(label), shown]);
      return true;
    },
    new_image: (width, height) => blankGrid(width, height),
    // Lúc chấm, số ngón tay do bộ chấm đặt trước mỗi lượt thử.
    fingers_now: () => handHolds.count,
    set_background: name => { log.push(['stage', 'background', String(name)]); return true; },
    set_behind: name => { log.push(['stage', 'behind', String(name)]); return true; },
    set_front: name => { log.push(['stage', 'front', String(name)]); return true; },
    // Lúc chấm, từ nghe được do bộ chấm đặt trước mỗi lượt thử — đọc xong XOÁ,
    // giống hệt cách heard_word() thật hoạt động ở py-runtime.js.
    heard_word: () => { const w = wordNow.text; wordNow.text = ''; return w; },
    // Trang làm bài TỰ chạy thử main_loop() có kiểm soát (xem runLoopCell) thay
    // vì để nó chạy nền không ai canh được, nên run_loop() ở đây chỉ là no-op.
    run_loop: () => true,
  });
  // Ô on_fingers/on_voice chỉ chứa đúng một hàm, không có dòng import ở đầu —
  // nên nhập sẵn hai lệnh đó vào namespace, đúng như file spells.py vẫn làm.
  py.runPython(SPELL_PREAMBLE);
  onStatus('Python sẵn sàng.');
  return { py, log, printed };
}


// Mấy bài "ghép lại" gọi hàm các em viết ở bài trước, nên phải nạp mấy bài đó
// trước khi chạy — cả ở ô bài lẫn ở XƯỞNG THỬ.
const NEEDS = { scene: ['blend', 'compose'], blur_background: ['blur', 'compose'] };

function loadNeeded(py, id) {
  for (const need of NEEDS[id] || []) {
    const cell = CELLS.find(item => item.id === need);
    if (!cell) continue;
    try { py.runPython(cellSource(cell)); }
    catch (err) { return `${need} của bạn đang lỗi: ${pyError(err)}`; }
  }
  return null;
}

// ── chạy một ô ──────────────────────────────────────────────────────────────
// Trả về {ok, message, extra} — `extra` là dữ liệu để vẽ ảnh hoặc in nhật ký.
export async function runCell({ py, log, printed }, cell, source, demo) {
  printed.length = 0;
  log.length = 0;
  // Bài cuối gọi lại blend/compose của chính học sinh, nên nạp hai bài đó trước.
  const missing = loadNeeded(py, cell.id);
  if (missing) return { ok: false, message: missing };
  if (cell.kind === 'loop') {
    // Bài main_loop cần soi CHÍNH MÃ NGUỒN trước khi chạy — while/await asyncio.sleep
    // là điều kiện bắt buộc, không phải thứ để lộ ra bằng cách "chạy thử xem sao".
    const missingSyntax = checkLoopSyntax(source);
    if (missingSyntax) return { ok: false, message: missingSyntax };
  }
  try { py.runPython(source); }
  catch (err) { return { ok: false, message: pyError(err) }; }

  if (cell.kind === 'fingers' || cell.kind === 'voice') return runSpellCell(py, log, cell, printed);
  if (cell.kind === 'setup') return runSetupCell(py, log, printed);
  if (cell.kind === 'stage') return runStageCell(py, log, printed);
  if (cell.kind === 'loop') return runLoopCell(py, log, printed);

  const verdict = py.runPython(`check_one(${JSON.stringify(cell.id)}, globals())`).toJs();
  const [ok, message] = verdict;
  const pixels = demo ? runOnDemo(py, cell, demo) : null;
  // Kể luôn bài test cho học sinh xem: máy đưa ảnh gì vào, chờ ra gì, và hàm
  // của em cho ra gì. Đúng/sai mà không thấy số thì chẳng học được gì.
  const test = py.runPython(`explain(${JSON.stringify(cell.id)}, globals())`).toJs();
  return { ok, message, pixels, test, output: outputLines(log, printed) };
}

// Ô setup: gọi setup() rồi xem các em đã gắn được mấy nút. Ở trang làm bài
// add_button chỉ ghi vào nhật ký, sân khấu mới dựng nút thật.
function runSetupCell(py, log, printed) {
  log.length = 0;
  try { py.runPython('setup()'); }
  catch (err) { return { ok: false, message: pyError(err) }; }
  const buttons = log.filter(entry => entry[0] === 'button');
  const rows = buttons.map(entry => ({ input: entry[1], wanted: 'một nút', hit: true, got: `play_effect("${entry[2]}")` }));
  if (buttons.length < 3) {
    rows.push({ input: '(còn thiếu)', wanted: 'ít nhất 3 nút', hit: false, got: `mới có ${buttons.length}` });
    return { ok: false, message: `setup: mới gắn ${buttons.length} nút, đề bài cần ít nhất 3`, rows,
             output: outputLines(log, printed) };
  }
  return { ok: true, message: 'setup', rows, output: outputLines(log, printed) };
}

// Ô stage: không có đáp án đúng. Chỉ đòi ít nhất một nền và một nút — sân
// khấu thật sẽ hiện đúng những gì set_background/set_behind/set_front/
// add_button vừa gọi (xem py-runtime.js, cùng lối gọi magic_stage này).
function runStageCell(py, log, printed) {
  log.length = 0;
  try { py.runPython('stage()'); }
  catch (err) { return { ok: false, message: pyError(err) }; }
  const picks = {};
  for (const entry of log) if (entry[0] === 'stage') picks[entry[1]] = entry[2];
  const buttons = log.filter(entry => entry[0] === 'button');
  const rows = Object.entries(picks).map(([role, name]) => ({ input: role, wanted: 'bạn chọn', hit: true, got: name }));
  for (const button of buttons) rows.push({ input: 'nút', wanted: 'bạn chọn', hit: true, got: `${button[1]} → ${button[2]}` });
  if (!picks.background) {
    rows.push({ input: 'nền', wanted: 'set_background(...)', hit: false, got: 'chưa chọn' });
    return { ok: false, message: 'stage: chưa chọn nền — sân khấu không có gì phía sau bạn', rows, picks,
             output: outputLines(log, printed) };
  }
  if (!buttons.length) {
    rows.push({ input: 'nút', wanted: 'add_button(...)', hit: false, got: 'chưa có nút nào' });
    return { ok: false, message: 'stage: chưa gắn nút nào — thêm ít nhất một phép bạn thích', rows, picks,
             output: outputLines(log, printed) };
  }
  return { ok: true, message: 'stage', rows, picks, output: outputLines(log, printed) };
}

// Bài main_loop BẮT BUỘC có while thật + await asyncio.sleep(...) — không phải
// hành vi máy đoán được bằng cách chạy thử, nên soi thẳng vào mã nguồn trước.
function checkLoopSyntax(source) {
  if (!/\bwhile\b/.test(source)) return 'main_loop: chưa thấy vòng lặp `while` thật nào trong mã của bạn.';
  if (!/await\s+asyncio\.sleep\s*\(/.test(source)) {
    return 'main_loop: chưa thấy `await asyncio.sleep(...)` — thiếu dòng này thì vòng lặp sẽ treo cứng trình duyệt.';
  }
  return null;
}

// Ô main_loop: gọi thẳng main_loop() với thời gian giới hạn (vòng lặp là while
// True thật, không tự dừng) — TimeoutError là kết quả MONG ĐỢI, không phải lỗi.
// Đặt sẵn số ngón tay + từ nghe được giả, rồi soi log xem vòng lặp có thật sự
// đọc fingers_now()/heard_word() và phản ứng lại hay không.
async function runLoopCell(py, log, printed) {
  if (!py.globals.get('main_loop')) {
    return { ok: false, message: 'main_loop: chưa thấy hàm `async def main_loop():` nào cả.' };
  }
  log.length = 0;
  handHolds.count = 1;
  wordNow.text = 'dragon';
  try {
    await py.runPythonAsync(`
try:
    await asyncio.wait_for(main_loop(), timeout=1.2)
except asyncio.TimeoutError:
    pass
`);
  } catch (err) { return { ok: false, message: pyError(err) }; }
  finally { handHolds.count = 0; wordNow.text = ''; }
  const rows = log.map(entry => ({ input: '1 ngón + "dragon"', wanted: 'bạn quyết định', hit: true,
    got: entry[0] === 'fx' ? `play_effect("${entry[1]}")` : entry.join(' ') }));
  const fired = log.some(entry => entry[0] === 'fx');
  if (!fired) {
    rows.push({ input: '1 ngón + "dragon"', wanted: 'gọi play_effect(...)', hit: false, got: '(im lặng)' });
    return { ok: false, message: 'main_loop: đặt 1 ngón + nghe "dragon" mà vòng lặp không gọi play_effect nào cả — vòng lặp có thật sự đọc fingers_now()/heard_word() chưa?',
             rows, output: outputLines(log, printed) };
  }
  return { ok: true, message: 'main_loop', rows, output: outputLines(log, printed) };
}

// Ô on_voice: đòi ĐÚNG thế tay VÀ ĐÚNG lời niệm. Chấm hai phần — làm được thì
// phép hiện, và làm sai một vế thì phép KHÔNG được hiện.
function runVoiceCell(py, log, printed) {
  const rows = [];
  const everything = [];
  let ok = true;

  const speak = (fingers, word) => {
    handHolds.count = fingers;
    log.length = 0;
    py.runPython(`on_voice(${JSON.stringify(word)})`);
    everything.push(...log);
    return log.filter(entry => entry[0] === 'fx').map(entry => entry[1]);
  };

  try {
    for (const [fingers, word, wanted] of VOICE_TASKS) {
      const fired = speak(fingers, word);
      const hit = fired.includes(wanted);
      if (!hit) ok = false;
      rows.push({ input: `${fingers} ngón + "${word}"`, wanted, hit,
                  got: fired.length ? fired.join(', ') : '(không gọi phép nào)' });
    }
    for (const [fingers, word] of VOICE_TRAPS) {
      const fired = speak(fingers, word);
      const hit = fired.length === 0;                 // sai vế nào cũng KHÔNG được ra phép
      if (!hit) ok = false;
      rows.push({ input: `${fingers} ngón + "${word}"`, wanted: 'không ra phép nào', hit,
                  got: fired.length ? fired.join(', ') : '(đúng: không gọi phép)' });
    }
  } catch (err) { return { ok: false, message: pyError(err), output: outputLines(everything, printed) }; }
  finally { handHolds.count = 0; }

  return { ok, message: ok ? 'on_voice' : 'on_voice: còn dòng ✖ ở bảng dưới', rows,
           output: outputLines(everything, printed) };
}

function runSpellCell(py, log, cell, printed) {
  if (cell.kind === 'voice') return runVoiceCell(py, log, printed);
  const tasks = FINGER_TASKS;
  const call = 'on_fingers';
  const rows = [];
  // `log` bị xoá trước mỗi lần gọi để đọc riêng từng lượt, nên gom lại vào đây
  // — nếu không, khung MÁY IN RA chỉ còn lệnh của lượt cuối cùng.
  const everything = [];
  let ok = true;
  for (const [input, wanted] of tasks) {
    log.length = 0;
    try { py.runPython(`${call}(${JSON.stringify(input)})`); }
    catch (err) { return { ok: false, message: pyError(err) }; }
    everything.push(...log);
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
  everything.push(...log);
  const answered = log.length > 0;
  if (!answered) ok = false;
  rows.push({ input: cell.kind === 'fingers' ? 9 : 'bâng quơ', wanted: 'nói ra điều gì đó', hit: answered,
              got: log.length ? log[0][1] : '(im lặng)' });

  return { ok, message: ok ? cell.id : `${cell.id}: còn dòng ✖ ở bảng dưới`, rows,
           output: outputLines(everything, printed) };
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
  if (cell.kind === 'blend_alpha') args = `_image, _layer, 50, _out, ${width}, ${height}`;   // 50% cho dễ nhìn
  if (cell.kind === 'over') args = `_image, _layer, _mask, _out, ${width}, ${height}`;      // _mask chính là kênh alpha
  py.globals.set('_image', py.toPy(toGrid(baseFor(cell, demo), width, height)));
  if (cell.kind === 'blend') py.globals.set('_layer', py.toPy(toGrid(demo.layer, width, height)));
  // blend_alpha đè ẢNH lên ẢNH, nên lớp trên là một tấm ảnh thường (nhân vật),
  // không phải lớp hiệu ứng nền đen.
  if (cell.kind === 'blend_alpha') py.globals.set('_layer', py.toPy(toGrid(demo.person, width, height)));
  // Ghép chuẩn: lớp dưới là cảnh, lớp trên là nhân vật, và alpha lấy thẳng từ
  // kênh độ đục của chính tấm nhân vật — đúng như ảnh PNG ngoài đời.
  if (cell.kind === 'over') {
    py.globals.set('_layer', py.toPy(toGrid(demo.person, width, height)));
    py.globals.set('_mask', py.toPy(demo.mask));
  }
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
    const missing = loadNeeded(py, name);       // ví dụ scene cần blend + compose
    if (missing) return { ok: false, message: missing };
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
  py.globals.set('_behind', py.toPy(toGrid(demo.behind, width, height)));
  try {
    for (const name of names) {
      py.globals.set('_out', py.toPy(blankGrid(width, height)));
      let args = `_image, _out, ${width}, ${height}`;
      if (name === 'blend') args = `_image, _layer, _out, ${width}, ${height}`;
      if (name === 'blend_alpha') args = `_image, _layer, 50, _out, ${width}, ${height}`;
      if (name === 'blend_over') args = `_image, _layer, _mask, _out, ${width}, ${height}`;
      if (name === 'compose') args = `_image, _mask, _background, _out, ${width}, ${height}`;
      if (name === 'blur_background') args = `_image, _mask, _out, ${width}, ${height}`;
      if (name === 'scene') args = `_image, _mask, _background, _behind, _layer, _out, ${width}, ${height}`;
      py.runPython(`${name}(${args})`);
      py.runPython('_image = _out');       // kết quả bước này là ảnh vào của bước sau
    }
    return { ok: true, pixels: toFlat(py.globals.get('_image').toJs(), width, height) };
  } catch (err) { return { ok: false, message: pyError(err) }; }
}

// Máy đã làm gì trong lúc chạy: print() của học sinh, và mọi lệnh gọi ra sân
// khấu. Không có phần này thì các em chỉ thấy đúng/sai mà không thấy việc.
export function outputLines(log, printed) {
  const lines = printed.slice();
  for (const entry of log) {
    if (entry[0] === 'fx') lines.push(`play_effect("${entry[1]}")`);
    else if (entry[0] === 'say') lines.push(`say("${entry[1]}")`);
    else if (entry[0] === 'button') lines.push(`add_button("${entry[1]}", "${entry[2]}")`);
  }
  return lines;
}
