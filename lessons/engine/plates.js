// plates.js — the named lesson stills, and the maths for editing one by hand.
//
// Split out of interactive-studio.js so anything that shows a plate can reach
// it without dragging the camera/worker machinery along: the studio serves
// `load_plate` to Python, and pixel-board-cell.js seeds its editable grid from
// the same table, so a lesson never has an asset path in it.
//
// The pure helpers here are what the hand-editing cell is made of, kept
// DOM-free so they are testable in node — see lessons/test-pixel-board.mjs.

// Two glowing effect layers shot on black (adding them to a scene is literally
// adding light) plus one night background, and the finished composite the
// FX island opens on as its puzzle. Stills, not the .mp4 overlays, because a
// lesson grid must be the same numbers on every run.
export const IMAGE_PLATES = {
  dragon: 'assets/camera-effects/plates/fx-dragon.webp',
  stag: 'assets/camera-effects/plates/fx-stag.webp',
  boss: 'assets/camera-effects/plates/fx-boss.webp',
  scene: 'assets/camera-effects/plates/bg-lighthouse.webp',
  goal: 'assets/camera-effects/plates/goal-dragon-over-boss.webp',
};

export const platePath = name => IMAGE_PLATES[String(name || '').slice(0, 12)] || null;

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
export const cellLight = p => Math.floor((p[0] + p[1] + p[2]) / 3);

/** Deep copy, so a board can always show what the picture started as. */
export const copyGrid = grid => grid.map(row => row.map(cell => [cell[0], cell[1], cell[2]]));

/** Rectangle between two clicked cells, in either drag direction. */
export function selectionBox(from, to, rows, cols) {
  if (!from || !to) return null;
  const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
  const row0 = clamp(Math.min(from.row, to.row), rows), row1 = clamp(Math.max(from.row, to.row), rows);
  const col0 = clamp(Math.min(from.col, to.col), cols), col1 = clamp(Math.max(from.col, to.col), cols);
  return { row0, row1, col0, col1, cells: (row1 - row0 + 1) * (col1 - col0 + 1) };
}

export const inBox = (box, row, col) => !!box && row >= box.row0 && row <= box.row1 && col >= box.col0 && col <= box.col1;

/**
 * Add `amount` to all three channels of every cell in `box`, clamped to 0..255.
 * This is exactly what the lesson's `max(0, ...)` / `min(255, ...)` loop does a
 * few cells later — the point of the board is to have felt it by hand first.
 * Mutates and returns `grid`.
 */
export function shiftRegion(grid, box, amount) {
  if (!box) return grid;
  for (let row = box.row0; row <= box.row1; row++) {
    for (let col = box.col0; col <= box.col1; col++) {
      const cell = grid[row] && grid[row][col];
      if (cell) for (let k = 0; k < 3; k++) cell[k] = clamp255(cell[k] + amount);
    }
  }
  return grid;
}

/**
 * Has the learner's editing met the cell's challenge?
 * task: { mode: 'dim' | 'brighten', amount, region?: {row0,row1,col0,col1} }
 * With a region, EVERY cell in it must have moved by at least `amount` in the
 * right direction; without one, any `amount`-sized move anywhere counts.
 * A cell pushed all the way to the bound counts however far it actually fell:
 * a plate's dark corner cannot drop another 100, and driving it to black is
 * everything the learner can do. "All the way" is per CHANNEL — clamping is
 * per channel, so [0,10,0] still has light left in it and is not there yet.
 * Returns { done, moved, total }.
 */
export function taskProgress(before, after, task) {
  if (!task) return { done: true, moved: 0, total: 0 };
  const rows = before.length, cols = before[0] ? before[0].length : 0;
  const box = task.region ? { row0: 0, row1: rows - 1, col0: 0, col1: cols - 1, ...task.region } : null;
  const want = Math.abs(Number(task.amount) || 0), dim = task.mode === 'dim';
  let moved = 0, total = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (box && !inBox(box, row, col)) continue;
      total++;
      const was = cellLight(before[row][col]), now = cellLight(after[row][col]);
      const shift = dim ? was - now : now - was;
      const bound = dim ? 0 : 255;
      const maxed = after[row][col].every(channel => channel === bound);
      if (maxed || shift >= want) moved++;
    }
  }
  return { done: box ? moved === total : moved > 0, moved, total };
}
