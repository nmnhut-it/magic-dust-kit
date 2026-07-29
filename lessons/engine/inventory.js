// inventory.js — THỢ RÈN reward economy: badges earned from lesson gifts,
// forged N-at-a-time into BOM MẬT NGỮ ("bombs") for a boss bump. Pure logic
// wrapped around a tiny storage shim (get/setItem) so it's unit-testable with
// a fake store (see test-inventory.mjs) without touching real localStorage.
// ADDITIVE ONLY (see FORGE-PLAN.md): nothing here is ever read by a gate that
// blocks progress — no badges/bombs simply means the forge/bomb UI stays
// hidden and every node/boss plays exactly as before.
import { FORGE_SUCCESS_BASE, FORGE_SUCCESS_CAP } from './constants.js';
export const BADGES_KEY = 'magicdust.badges';
export const BOMBS_KEY = 'magicdust.bombs';
export const DEFAULT_FORGE_COST = 2;          // badges consumed per bomb (FORGE-PLAN.md default N=2)

// Badges are stored as an array of {id, spent} in earn-order — spend always
// consumes the OLDEST unspent badges first, so a badge is never double-forged
// (once spent:true it's excluded from every future forge/count).
function readBadges(store) {
  try { const v = JSON.parse(store.getItem(BADGES_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function writeBadges(store, list) { store.setItem(BADGES_KEY, JSON.stringify(list)); }
function readBombs(store) { const n = parseInt(store.getItem(BOMBS_KEY), 10); return Number.isFinite(n) && n > 0 ? n : 0; }
function writeBombs(store, n) { store.setItem(BOMBS_KEY, String(Math.max(0, n | 0))); }

// Inventory — instantiate with any {getItem(key), setItem(key,val)} store.
// The module also exports a ready-to-use singleton over real localStorage
// (see bottom) — most call sites should just use that.
export class Inventory {
  #store;
  constructor(store) { this.#store = store; }

  // addBadge(id) — idempotent: re-claiming the same badge id is a no-op.
  addBadge(id) {
    if (id == null) return;
    const list = readBadges(this.#store);
    if (list.some(b => b.id === id)) return;
    list.push({ id, spent: false });
    writeBadges(this.#store, list);
  }
  hasBadge(id) { return readBadges(this.#store).some(b => b.id === id); }
  // badgeCount({unspentOnly}) — total earned badges by default; pass
  // {unspentOnly:true} for the count that actually gates forging.
  badgeCount({ unspentOnly = false } = {}) {
    const list = readBadges(this.#store);
    return unspentOnly ? list.filter(b => !b.spent).length : list.length;
  }
  // forgeBomb(cost=DEFAULT_FORGE_COST, {rand, bonus}) — gacha forge attempt.
  // Requires `cost` UNSPENT badges just to attempt (no shortcutting badge
  // requirements with luck) — returns {ok:false, reason:'insufficient'} and
  // touches nothing if there aren't enough yet.
  // With enough badges, rolls `rand()` (injectable — default Math.random,
  // so tests can force either branch) against
  // min(FORGE_SUCCESS_BASE + bonus, FORGE_SUCCESS_CAP):
  //   - roll < chance → SUCCESS: spends the oldest `cost` unspent badges,
  //     +1 bomb, {ok:true, success:true, chance}.
  //   - else → FAIL ("rèn hụt"): badges are NOT spent (failing costs one
  //     extra practice question, never lost progress), {ok:true,
  //     success:false, chance}. The caller (forge-cell.js) is responsible
  //     for accumulating `bonus` across practices cleared this session and
  //     re-passing it on retry — this function stays a pure stateless roll.
  forgeBomb(cost = DEFAULT_FORGE_COST, { rand = Math.random, bonus = 0 } = {}) {
    const list = readBadges(this.#store);
    const unspentIdx = [];
    for (let i = 0; i < list.length && unspentIdx.length < cost; i++) if (!list[i].spent) unspentIdx.push(i);
    if (unspentIdx.length < cost) return { ok: false, reason: 'insufficient', success: false };
    const chance = Math.min(FORGE_SUCCESS_BASE + bonus, FORGE_SUCCESS_CAP);
    if (rand() >= chance) return { ok: true, success: false, chance }; // rèn hụt — badges untouched
    unspentIdx.forEach(i => { list[i].spent = true; });
    writeBadges(this.#store, list);
    writeBombs(this.#store, readBombs(this.#store) + 1);
    return { ok: true, success: true, chance };
  }
  // badges() — copy of the earn-ordered {id,spent} list, for UI shelves
  // (the forge's collected-badge display).
  badges() { return readBadges(this.#store).map(b => ({ ...b })); }
  // spendBadges(n) — spend up to n OLDEST unspent badges unconditionally (no
  // gate, unlike forgeBomb: the quiz-driven forge consumes whatever fuel is
  // on hand — zero badges still forges, per the additive-never-a-gate rule).
  // Returns the spent ids so the caller can play per-badge FX.
  spendBadges(n) {
    const list = readBadges(this.#store), ids = [];
    for (let i = 0; i < list.length && ids.length < n; i++) if (!list[i].spent) { list[i].spent = true; ids.push(list[i].id); }
    if (ids.length) writeBadges(this.#store, list);
    return ids;
  }
  bombCount() { return readBombs(this.#store); }
  // addBomb(n=1) — grant bombs directly, NOT through the badge-gacha. Used by
  // the quiz-driven forge (forge-cell.js `forge.quiz`, BOSS CONCEPT V2): there
  // the trial is answering the questions, not spending badges — a completed
  // quiz set forges the bomb outright. Kept separate from forgeBomb() so the
  // legacy badge economy is untouched.
  addBomb(n = 1) { const c = readBombs(this.#store) + Math.max(0, n | 0); writeBombs(this.#store, c); return c; }
  // spendBomb() — floors at 0; returns false if there was nothing to spend.
  spendBomb() {
    const n = readBombs(this.#store);
    if (n <= 0) return false;
    writeBombs(this.#store, n - 1);
    return true;
  }
}

// Real-localStorage singleton for browser call sites (gift-cell.js,
// forge-cell.js, boss-fight.js, node.js's dev hooks). Guarded so importing
// this module in a bare Node test runner (no `localStorage` global) doesn't
// throw at import time — tests instead construct their own `new Inventory(fakeStore)`.
const realStore = typeof localStorage !== 'undefined' ? localStorage : {
  getItem: () => null, setItem: () => {},
};
export const inventory = new Inventory(realStore);
