// progress-store.js — thin wrapper around progress-versioning.js's pure
// contentVersion()/decideResume() for one node's in-node resume checkpoint
// (localStorage 'magicdust.node.<index>.progress'). contentVersion/
// decideResume are loaded as bare globals via <script defer> before this
// module (same convention cell-validation.js uses) — see progress-versioning.js.
export class ProgressStore {
  #key; #version; #saved = null;
  constructor(nodeIndex, cells, namespace = '') {
    const safeNamespace = String(namespace || '').replace(/[^a-zA-Z0-9_-]/g, '-');
    this.#key = `magicdust.node.${nodeIndex}.progress${safeNamespace ? `.${safeNamespace}` : ''}`;
    this.#version = (typeof contentVersion === 'function') ? contentVersion(cells || []) : '';
    try { const raw = localStorage.getItem(this.#key); if (raw) this.#saved = JSON.parse(raw); } catch { this.#saved = null; }
  }
  get saved() { return this.#saved; }
  get version() { return this.#version; }
  save(frontier, sub) {
    try {
      if (sub) this.#saved = Object.assign({}, this.#saved, { sub });
      const blob = { version: this.#version, index: frontier, sub: sub || (this.#saved && this.#saved.sub) };
      localStorage.setItem(this.#key, JSON.stringify(blob));
    } catch { /* storage may be full/unavailable — resume is a nicety, not required */ }
  }
  clear() { try { localStorage.removeItem(this.#key); } catch { /* ignore */ } this.#saved = null; }
  // decideResume(currentCellCount) — delegates to the pure decideResume(); a
  // corrupt/legacy/version-mismatched save just falls back to starting fresh.
  decideResume(currentCellCount) {
    if (!this.#saved || typeof decideResume !== 'function') return { resume: false, index: 0 };
    try { return decideResume({ savedVersion: this.#saved.version, currentVersion: this.#version, savedIndex: this.#saved.index, currentCellCount }); }
    catch { return { resume: false, index: 0 }; }
  }
}
