// pixel-board-cell.js — {pixelBoard:{plate,size,text,task,hint?}} — the digit
// table from the image lab, but the learner edits it.
//
// Why it exists: the island can explain "một tấm ảnh là lưới các con số" and
// then hand them a loop that rewrites a region — and the loop is the first time
// they ever touch a pixel. This cell puts the touching first. Drag a rectangle
// across the numbers, press SÁNG +50 / TỐI −50, and the picture beside the
// table changes under their hand, cell by cell, clamped at 0 and 255 exactly
// like the `max(0, ...)` / `min(255, ...)` they write two cells later.
//
// It is a sandbox with one small goal (`task`, checked by plates.js's
// taskProgress) so nobody clicks past it without moving a single number; the
// goal is stated in the cell and the progress line counts up as they work.
// Rendering is image-lab's readGrid/paintCanvas/paintNumbers — same pixels,
// same digits, same look as the viewer they already know.
import { paintCanvas, paintNumbers, readGrid } from './image-lab.js';
import { cellLight, copyGrid, inBox, platePath, selectionBox, shiftRegion, taskProgress } from './plates.js';
import { decodeImageGrid } from './interactive-studio.js';
import { sparkBurst } from './dom-scaffold.js';
import { renderProse } from './prose.js';

const STEP = 50;                  // one press, same number the lesson's AMOUNT uses
const DEFAULT_SIDE = 8;           // small enough that every digit is readable

const taskLine = task => {
  if (!task) return 'Sửa bao nhiêu tùy bạn.';
  const where = task.label ? ` ${task.label}` : ' một vùng bất kỳ';
  return task.mode === 'dim'
    ? `THỬ THÁCH: làm${where} tối đi ít nhất ${task.amount} độ sáng.`
    : `THỬ THÁCH: làm${where} sáng thêm ít nhất ${task.amount} độ sáng.`;
};

export function pixelBoardCell(c, { completeCell, decodePlate = decodeImageGrid } = {}) {
  const cfg = c.pixelBoard || {}, side = Math.max(4, Math.min(16, cfg.size || DEFAULT_SIDE));
  const el = document.createElement('div'); el.className = 'pbcell';
  el.innerHTML = `
    <div class="pbtext">${renderProse(cfg.text || '')}</div>
    <div class="pbrow">
      <div class="pbstage"><div class="pbart"></div><b class="ilab-tag">ẢNH — đổi ngay khi bạn sửa số</b></div>
      <div class="pbstage"><div class="pbnums"></div><b class="ilab-tag">LƯỚI SỐ — kéo chuột để chọn một vùng</b></div>
    </div>
    <div class="pbgoal" aria-live="polite">${taskLine(cfg.task)}</div>
    <div class="pbfoot">
      <button class="pbbtn pbup" type="button" disabled>SÁNG +${STEP}</button>
      <button class="pbbtn pbdown" type="button" disabled>TỐI −${STEP}</button>
      <button class="pbbtn pbreset" type="button">VỀ ẢNH GỐC</button>
      <button class="pbbtn pbgo" type="button" disabled>XONG</button>
    </div>
    <div class="pbstat" aria-live="polite">Kéo chuột (hoặc chạm rồi kéo) trên bảng số để chọn một vùng.</div>`;

  const artHost = el.querySelector('.pbart'), numHost = el.querySelector('.pbnums');
  const stat = el.querySelector('.pbstat'), goal = el.querySelector('.pbgoal');
  const up = el.querySelector('.pbup'), down = el.querySelector('.pbdown');
  const reset = el.querySelector('.pbreset'), go = el.querySelector('.pbgo');
  let source = null, grid = null, box = null, dragFrom = null, dragging = false, earned = false;

  // The table is built ONCE and then edited in place. Re-rendering it per
  // pointermove destroys the very element the pointer is over mid-drag, which
  // silently truncated the selection (and flickered the digits).
  let cellEls = [];
  const buildTable = () => {
    const table = paintNumbers(readGrid(grid));
    table.classList.add('pbtable');
    numHost.replaceChildren(table);
    cellEls = [...table.children];
  };
  const paintValues = () => {
    const read = readGrid(grid);
    artHost.replaceChildren(paintCanvas(read));
    for (const cellEl of cellEls) {
      const pixel = read.cells[Number(cellEl.dataset.row)][Number(cellEl.dataset.col)], light = cellLight(pixel);
      cellEl.textContent = String(light);
      cellEl.style.background = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
      cellEl.style.color = light >= 128 ? '#0b0f18' : '#eaf4ff';
    }
  };
  const paintSelection = () => {
    for (const cellEl of cellEls) {
      const inside = inBox(box, Number(cellEl.dataset.row), Number(cellEl.dataset.col));
      cellEl.classList.toggle('on', inside);
    }
  };
  // Met once, met for good — going back to the original picture (or undoing the
  // edit) must not take the reward away, but then the line has to keep saying
  // so, or a counter reading 0/32 sits next to an open XONG and contradicts it.
  const report = () => {
    const progress = taskProgress(source, grid, cfg.task);
    if (progress.done) earned = true;
    if (earned) { go.disabled = false; goal.textContent = cfg.task ? '✦ ĐẠT RỒI — nghịch tiếp thoải mái, bấm XONG để đi tiếp' : goal.textContent; return; }
    if (cfg.task && progress.total) goal.textContent = `${taskLine(cfg.task)} — đã đạt ${progress.moved}/${progress.total} ô`;
  };
  const shift = amount => {
    if (!box || !grid) return;
    shiftRegion(grid, box, amount);
    paintValues(); report();
    stat.textContent = `${amount > 0 ? 'Cộng' : 'Trừ'} ${Math.abs(amount)} cho ${box.cells} ô đang chọn. Bấm tiếp để đổi thêm.`;
  };
  // Hit-test by COORDINATE, not by event.target: a touch drag keeps firing at
  // the element the finger started on, and a fast mouse drag can end on the 1px
  // gap between cells — both would silently drop the last row of the selection.
  const cellAt = (x, y) => {
    const hit = document.elementFromPoint(x, y);
    const cell = hit instanceof Element ? hit.closest('.pbtable i') : null;
    return cell && numHost.contains(cell) ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null;
  };
  const selectTo = point => {
    if (!point || !dragFrom || !grid) return;
    box = selectionBox(dragFrom, point, grid.length, grid[0].length);
    up.disabled = down.disabled = false;
    stat.textContent = `Đang chọn ${box.row1 - box.row0 + 1}×${box.col1 - box.col0 + 1} ô. Bấm SÁNG hoặc TỐI để đổi cả vùng.`;
    paintSelection();
  };

  numHost.addEventListener('pointerdown', event => {
    const point = cellAt(event.clientX, event.clientY); if (!point) return;
    event.preventDefault(); dragging = true; dragFrom = point; selectTo(point);
  });
  numHost.addEventListener('pointermove', event => { if (dragging) selectTo(cellAt(event.clientX, event.clientY)); });
  // The release position is part of the selection, and a drag can end outside
  // the table entirely — so the window both applies the last point and ends it.
  addEventListener('pointerup', event => {
    if (!dragging) return;
    dragging = false; selectTo(cellAt(event.clientX, event.clientY));
  });
  up.onclick = () => shift(STEP);
  down.onclick = () => shift(-STEP);
  reset.onclick = () => {
    if (!source) return;
    grid = copyGrid(source); box = null; up.disabled = down.disabled = true;
    paintValues(); paintSelection(); report();
    stat.textContent = 'Đã trả ảnh về như lúc đầu.';
  };
  go.onclick = () => { if (go.disabled) return; sparkBurst(el, go, 18); el.classList.add('done'); setTimeout(() => completeCell(el), 500); };

  const path = platePath(cfg.plate || 'dragon');
  decodePlate(path, side).then(decoded => {
    if (!Array.isArray(decoded) || !decoded.length) { stat.textContent = 'Không mở được tấm ảnh — bấm XONG để đi tiếp.'; go.disabled = false; return; }
    source = decoded; grid = copyGrid(decoded);
    buildTable(); paintValues(); report();
  });
  return el;
}
