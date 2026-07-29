// engine/dom-invariants.js — a single reusable "is my display actually
// correct right now" check, so no test (or a human at devtools) has to
// hand-roll DOM/overlap assertions per cell. Pure browser-DOM function, zero
// imports on purpose: it must run unmodified both as an ES module import
// (wired into window.nodeDev.checkDisplay below in node.js) AND stringified
// into page.evaluate() by a Playwright script that has no import access into
// the page's module graph (see test-camera-dom-matrix.mjs's header comment).
// Checks three things, matching the three failure modes actually seen in
// this engine's history (stale scenePanel parent, camera never released,
// two absolutely-positioned cells drifting onto each other):
//   1. every non-veiled `.cell` is actually visible (non-zero rect, not
//      display:none/visibility:hidden/opacity:0)
//   2. no two `.cell` rects overlap each other (sibling cells stack
//      vertically in normal flow — any overlap means a layout regression)
//   3. the shared #scenepanel (camera/fx panel — see dom-scaffold.js) is
//      parented inside exactly the cell currently "running" and its rect is
//      fully CONTAINED by that cell's `.cout` rect, never spilling into a
//      different cell's box; and singleton counts (#scenepanel/#cam/
//      #camstill) never exceed 1, since a duplicate would render two
//      overlapping camera feeds.
export function checkCellDisplayInvariants() {
  const issues = [];
  const rectOf = el => el.getBoundingClientRect();
  const isDisplayed = el => {
    const r = rectOf(el), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
  };
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  // ── 1 & 2: every live cell visible, no two live cells overlap ──
  const liveCells = [...document.querySelectorAll('.cell:not(.veiled)')];
  liveCells.forEach(c => { if (!isDisplayed(c)) issues.push(`cell not displayed: ${c.dataset.label || c.className}`); });
  for (let i = 0; i < liveCells.length; i++) {
    for (let j = i + 1; j < liveCells.length; j++) {
      if (overlaps(rectOf(liveCells[i]), rectOf(liveCells[j]))) {
        issues.push(`two cells overlap: #${i} (${liveCells[i].dataset.label || i}) and #${j} (${liveCells[j].dataset.label || j})`);
      }
    }
  }

  // ── 3: scene panel singleton + correct containment ──
  const panels = document.querySelectorAll('#scenepanel'), cams = document.querySelectorAll('#cam'), stills = document.querySelectorAll('#camstill');
  if (panels.length > 1) issues.push(`#scenepanel duplicated: ${panels.length} found`);
  if (cams.length > 1) issues.push(`#cam duplicated: ${cams.length} found`);
  if (stills.length > 1) issues.push(`#camstill duplicated: ${stills.length} found`);
  const panel = panels[0];
  if (panel && panel.parentElement && !panel.classList.contains('devstage')) {
    const hostCell = panel.closest('.cell');
    if (!hostCell) issues.push('#scenepanel is mounted outside any .cell');
    else {
      const hostCout = hostCell.querySelector('.cout');
      const pr = rectOf(panel), hr = hostCout ? rectOf(hostCout) : null;
      if (!hr) issues.push('#scenepanel host cell has no .cout to contain it');
      else if (!(pr.left >= hr.left - 1 && pr.top >= hr.top - 1 && pr.right <= hr.right + 1 && pr.bottom <= hr.bottom + 1)) {
        issues.push('#scenepanel rect is not contained within its host cell\'s .cout rect');
      }
      liveCells.filter(c => c !== hostCell).forEach(c => { if (overlaps(rectOf(panel), rectOf(c))) issues.push(`#scenepanel overlaps a DIFFERENT cell: ${c.dataset.label || c.className}`); });
    }
  }
  return { ok: issues.length === 0, issues };
}
