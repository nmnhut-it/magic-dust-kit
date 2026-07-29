// progress-versioning.js — pure, DOM-free helpers for in-node resume (no cell-
// validation.js overlap). Loaded as a bare global via <script> before node.js
// (same convention as cell-validation.js) and require()-able from node:assert
// tests. Owns two things: a cheap content-hash over a node's cell config (so a
// saved position can be told apart from a since-edited lesson) and the pure
// decision of whether a saved {version, index} blob is safe to resume from.
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h; }
// contentVersion(cells) — deterministic string, stable across runs for the
// same cell array, sensitive to any content change (label/code/text edits) and
// to cells being added/removed (length folded in separately from the hash so
// a same-length swap can't accidentally collide as often).
function contentVersion(cells) {
  cells = cells || [];
  const hash = djb2(JSON.stringify(cells));
  return `${cells.length}-${hash}`;
}
// decideResume({savedVersion, currentVersion, savedIndex, currentCellCount})
// -> {resume:true, index} | {resume:false, index:0}. Reset whenever the lesson
// content changed since the save (version mismatch) or the saved index no
// longer fits the current cell count (defensive clamp even on a version match
// — e.g. localStorage hand-edited or corrupted).
function decideResume({ savedVersion, currentVersion, savedIndex, currentCellCount }) {
  if (savedVersion !== currentVersion) return { resume: false, index: 0 };
  const idx = Number(savedIndex);
  if (!Number.isInteger(idx) || idx <= 0 || idx >= currentCellCount) return { resume: false, index: 0 };
  return { resume: true, index: idx };
}
if (typeof module !== 'undefined') module.exports = { contentVersion, decideResume, djb2 };
