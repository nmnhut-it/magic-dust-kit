// image-lab.js — the big, interactive BEFORE/AFTER viewer for image lessons.
//
// #scenepanel is a 480px 4:3 box that holds ONE frame, which is too small to
// compare versions and cannot show the numbers behind a picture. The lab is a
// full-screen overlay instead.
//
// Three rules this file exists to enforce, all of them from watching learners:
//  1. A coarse grid looks nothing like the plate it came from, so a panel shows
//     the ORIGINAL artwork and its grid SIDE BY SIDE, never pixels alone.
//  2. The numbers are laid out with CSS grid, never printed as text — printed
//     rows wrap at the terminal width and destroy the alignment.
//  3. It is inspectable: pointing at a cell highlights THAT SAME cell in every
//     panel at once and reads out its numbers, which is how a learner actually
//     follows what changed from before to after.
//
// buildImageLab(frames, opts) -> { el, done, close }
//   frames: [{ label, image?, src? }] — `image` is [row][col] = [r,g,b] and
//           draws the grid; `src` shows real artwork; supplying BOTH pairs them
//           in one panel, which is the preferred form for anything loaded from
//           a named plate.
//   opts:   { title, numbers }  numbers = also render the digit table
//   done:   Promise resolving when the learner dismisses the lab.
// Used by engine/interactive-studio.js for the `frame_compare` studio action.
// readGrid/paintCanvas/paintNumbers are also the renderer for the hand-editing
// board (engine/pixel-board-cell.js) — one way of drawing pixels and digits.

// A learner looking at four panels cannot tell which one their code made, which
// one is shipped artwork, and why one of them is blocky — so each panel says so
// itself instead of relying on Pip having explained it three bubbles earlier.
const TAGS = {
  result: 'KẾT QUẢ — chính đoạn code của bạn vừa dựng ra tấm này ·',
  input: 'ẢNH VÀO — tấm máy đưa cho bạn xử lý ·',
  coarse: 'LƯỚI SỐ — thu nhỏ để bạn đọc được từng ô, chưa phải ảnh thật ·',
  coarseResult: 'LƯỚI SỐ · KẾT QUẢ — code của bạn vừa ghi, thu nhỏ để đọc từng ô ·',
  source: 'ẢNH GỐC — tấm ảnh thật mà lưới bên cạnh được đọc ra từ đó',
  reference: 'ẢNH MẪU — để bạn đối chiếu, không phải kết quả của bạn',
};
const MAX_SIDE = 512;                // guards against a runaway grid; matches interactive-studio's IMAGE_GRID_MAX
const NUMBER_LIMIT = 16;             // past 16 columns a digit is too small to read
const channel = v => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(255, Math.trunc(v))) : 0;
const lightOf = p => Math.floor((p[0] + p[1] + p[2]) / 3);

export function readGrid(image) {
  if (!Array.isArray(image) || !Array.isArray(image[0])) return null;
  const rows = Math.min(image.length, MAX_SIDE), cols = Math.min(image[0].length, MAX_SIDE);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) {
      const p = image[r][c];
      line.push(Array.isArray(p) ? [channel(p[0]), channel(p[1]), channel(p[2])] : [channel(p), channel(p), channel(p)]);
    }
    cells.push(line);
  }
  return { rows, cols, cells };
}

export function paintCanvas(grid) {
  const canvas = document.createElement('canvas');
  // A coarse grid is read cell by cell beside its digits, so it stays small. A
  // full-resolution result IS the payoff of the lesson and gets the room.
  canvas.className = grid.cols > NUMBER_LIMIT ? 'ilab-art is-photo' : 'ilab-art';
  canvas.width = grid.cols; canvas.height = grid.rows;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const data = ctx.createImageData(grid.cols, grid.rows);
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
      const o = (r * grid.cols + c) * 4, p = grid.cells[r][c];
      data.data[o] = p[0]; data.data[o + 1] = p[1]; data.data[o + 2] = p[2]; data.data[o + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

// Each digit sits on its own brightness as a background, so the table reads as
// a picture and as numbers at the same time.
export function paintNumbers(grid) {
  const table = document.createElement('div');
  table.className = 'ilab-nums';
  table.style.setProperty('--ilab-cols', String(grid.cols));
  table.style.setProperty('--ilab-size', `${Math.max(19, Math.round(300 / grid.cols))}px`);
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const p = grid.cells[r][c], light = lightOf(p);
    const cell = document.createElement('i');
    cell.textContent = String(light);
    cell.dataset.row = String(r); cell.dataset.col = String(c);
    cell.style.background = `rgb(${p[0]},${p[1]},${p[2]})`;
    cell.style.color = light >= 128 ? '#0b0f18' : '#eaf4ff';
    table.appendChild(cell);
  }
  return table;
}

function photoEl(src) {
  const img = document.createElement('img');
  img.className = 'ilab-art ilab-photo'; img.src = src; img.alt = '';
  return img;
}

export function buildImageLab(frames, opts = {}) {
  const list = (Array.isArray(frames) ? frames : [])
    .map(f => ({ label: String(f?.label ?? ''), grid: readGrid(f?.image), src: typeof f?.src === 'string' ? f.src : null, result: f?.role === 'result' }))
    .filter(f => f.grid || f.src);
  const gridded = list.filter(f => f.grid);
  const el = document.createElement('div');
  el.className = 'ilab';
  // The digits are the point of the lesson, so they are ON by default whenever
  // the grid is small enough to read; the toggle only lets a learner get them
  // out of the way. Pass numbers:false to opt out explicitly.
  const canNumber = gridded.length > 0 && gridded.every(f => f.grid.cols <= NUMBER_LIMIT);
  let showNumbers = canNumber && opts.numbers !== false;

  el.innerHTML = `<div class="ilab-box" role="dialog" aria-modal="true">
      <div class="ilab-title"></div>
      <div class="ilab-row"></div>
      <div class="ilab-read"><span class="ilab-read-hint"></span><span class="ilab-read-cells"></span></div>
      <div class="ilab-foot">
        <button class="ilab-nums-btn" type="button"></button>
        <button class="ilab-go" type="button">TIẾP TỤC</button>
      </div>
    </div>`;
  el.querySelector('.ilab-title').textContent = String(opts.title || '');
  el.querySelector('.ilab-read-hint').textContent = gridded.length
    ? 'Đưa chuột (hoặc chạm) vào một ô để xem số của ô đó ở mọi khung hình:'
    : '';
  const row = el.querySelector('.ilab-row');
  const panels = [];

  for (const frame of list) {
    const panel = document.createElement('div'); panel.className = 'ilab-panel';
    const cap = document.createElement('div'); cap.className = 'ilab-cap'; cap.textContent = frame.label;
    panel.appendChild(cap);

    // pixels AND the picture they came from, together
    const pair = document.createElement('div'); pair.className = 'ilab-pair';
    let stage = null, mark = null;
    if (frame.src) {
      const shot = document.createElement('div'); shot.className = 'ilab-stage';
      shot.appendChild(photoEl(frame.src));
      const tag = document.createElement('b'); tag.className = 'ilab-tag';
      tag.textContent = frame.grid ? TAGS.source : TAGS.reference;
      shot.appendChild(tag); pair.appendChild(shot);
    }
    if (frame.grid) {
      stage = document.createElement('div'); stage.className = 'ilab-stage';
      stage.appendChild(paintCanvas(frame.grid));
      mark = document.createElement('i'); mark.className = 'ilab-mark'; stage.appendChild(mark);
      const tag = document.createElement('b'); tag.className = 'ilab-tag';
      const coarse = frame.grid.cols <= NUMBER_LIMIT;
      const kind = coarse ? (frame.result ? TAGS.coarseResult : TAGS.coarse) : frame.result ? TAGS.result : TAGS.input;
      tag.textContent = `${kind} ${frame.grid.rows}×${frame.grid.cols}`;
      stage.appendChild(tag); pair.appendChild(stage);
    }
    panel.appendChild(pair);

    let nums = null;
    if (canNumber && frame.grid) { nums = paintNumbers(frame.grid); panel.appendChild(nums); }
    row.appendChild(panel);
    panels.push({ frame, stage, mark, nums });
  }

  // ── inspection: one cell, highlighted across every panel at once ──────────
  const readCells = el.querySelector('.ilab-read-cells');
  const clearRead = () => {
    readCells.textContent = '';
    for (const p of panels) { if (p.mark) p.mark.style.opacity = '0'; if (p.nums) p.nums.querySelectorAll('.on').forEach(n => n.classList.remove('on')); }
  };
  const inspect = (row0, col0) => {
    readCells.textContent = '';
    for (const p of panels) {
      if (!p.frame.grid) continue;
      const g = p.frame.grid;
      const r = Math.max(0, Math.min(g.rows - 1, row0)), c = Math.max(0, Math.min(g.cols - 1, col0));
      const px = g.cells[r][c];
      if (p.mark) {
        p.mark.style.opacity = '1';
        p.mark.style.left = `${(c / g.cols) * 100}%`; p.mark.style.top = `${(r / g.rows) * 100}%`;
        p.mark.style.width = `${100 / g.cols}%`; p.mark.style.height = `${100 / g.rows}%`;
      }
      if (p.nums) {
        p.nums.querySelectorAll('.on').forEach(n => n.classList.remove('on'));
        const cell = p.nums.children[r * g.cols + c];
        if (cell) cell.classList.add('on');
      }
      const chip = document.createElement('span'); chip.className = 'ilab-chip';
      chip.innerHTML = '<b></b><em></em>';
      chip.querySelector('b').textContent = p.frame.label;
      chip.querySelector('em').textContent = `[${r}][${c}] = [${px[0]}, ${px[1]}, ${px[2]}] · sáng ${lightOf(px)}`;
      chip.style.setProperty('--chip', `rgb(${px[0]},${px[1]},${px[2]})`);
      readCells.appendChild(chip);
    }
  };
  const fromStage = (p, e) => {
    const g = p.frame.grid, r = p.stage.getBoundingClientRect();
    inspect(Math.floor((e.clientY - r.top) / r.height * g.rows), Math.floor((e.clientX - r.left) / r.width * g.cols));
  };
  for (const p of panels) {
    if (p.stage) {
      p.stage.classList.add('ilab-live');
      p.stage.addEventListener('pointermove', e => fromStage(p, e));
      p.stage.addEventListener('pointerdown', e => { e.preventDefault(); fromStage(p, e); });
    }
    if (p.nums) p.nums.addEventListener('pointermove', e => {
      const t = e.target.closest('i[data-row]');
      if (t) inspect(+t.dataset.row, +t.dataset.col);
    });
  }
  el.querySelector('.ilab-row').addEventListener('pointerleave', clearRead);
  if (!gridded.length) el.querySelector('.ilab-read').style.display = 'none';

  // ── numbers toggle ────────────────────────────────────────────────────────
  const numsBtn = el.querySelector('.ilab-nums-btn');
  const syncNumbers = () => {
    el.classList.toggle('ilab-with-nums', showNumbers);
    numsBtn.textContent = showNumbers ? 'ẨN BẢNG SỐ' : 'HIỆN BẢNG SỐ';
    for (const p of panels) if (p.nums) p.nums.style.display = showNumbers ? '' : 'none';
  };
  if (canNumber && gridded.length) { numsBtn.onclick = () => { showNumbers = !showNumbers; syncNumbers(); }; syncNumbers(); }
  else numsBtn.style.display = 'none';

  let settle = null;
  const done = new Promise(resolve => { settle = resolve; });
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey);
    el.remove();
    settle('closed');
  };
  const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey);
  el.querySelector('.ilab-go').onclick = close;
  el.onclick = e => { if (e.target === el) close(); };
  return { el, done, close };
}
