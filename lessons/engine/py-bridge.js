// py-bridge.js — the SharedArrayBuffer/worker wire protocol only. Zero
// notebook/DOM knowledge: callbacks (onReady/onDone/onError/onTell/onAsk) are
// how NotebookRunner hears about worker events; respond() answers a pending
// 'ask'. One Pyodide worker, Python globals persist across every run().
import { RUN_HANG_MS } from './constants.js';

const WORKER_URL = './worker.js?v=20260714-165347';
export const BOOT_RETRY_DELAYS_MS = [1000, 3000, 8000];
// Reply size for one bridge.ask(), and the hard ceiling on anything the page
// hands back to Python — respond() truncates past it. 64KB only fitted a
// 24x24 image grid, which forced the image lessons to work on pixel mush; a
// real plate a learner can actually transform is ~100-250KB of JSON.
export const ASK_REPLY_MAX = 4 * 1024 * 1024;

export class PyBridge {
  #worker = null; #header = null; #dataU8 = null; #up = false;
  #onReady; #onDone; #onError; #onTell; #onAsk; #onBootStatus;
  #enc = new TextEncoder();
  #sources = null;          // last-booted module sources — cached so a crashed worker can be silently rebuilt with the exact same Python modules (see #onWorkerError)
  #packages = [];           // optional Pyodide packages requested by this lesson; reused after a worker reboot
  #bootRetryDelays = BOOT_RETRY_DELAYS_MS;
  #bootRetryIndex = 0;
  #bootTimer = null;
  #recovering = false;      // guards run() while a fresh worker is mid-reboot, and de-dupes overlapping onerror events from the same dying worker
  #hangTimer = null;        // RUN_HANG_MS watchdog — see #armHangTimer/#onHang below
  #waitingForResponse = false; // true only while the current worker is parked on bridge.ask()
  constructor({ onReady, onDone, onError, onTell, onAsk, onBootStatus = () => {}, bootRetryDelays = BOOT_RETRY_DELAYS_MS }) {
    this.#onReady = onReady; this.#onDone = onDone; this.#onError = onError; this.#onTell = onTell; this.#onAsk = onAsk; this.#onBootStatus = onBootStatus;
    this.#bootRetryDelays = Array.isArray(bootRetryDelays) ? [...bootRetryDelays] : [...BOOT_RETRY_DELAYS_MS];
  }
  get isUp() { return this.#up; }

  async boot(sources, packages = []) {
    this.#sources = sources;
    this.#packages = Array.isArray(packages) ? packages : [];
    this.#bootRetryIndex = 0;
    this.#clearBootTimer();
    if (!self.crossOriginIsolated) { this.#onBootStatus({ state: 'failed', reason: 'cross-origin-isolation' }); return; }
    this.#startBoot();
  }
  retryBoot() {
    if (!this.#sources || !self.crossOriginIsolated) return false;
    this.#bootRetryIndex = 0; this.#clearBootTimer(); this.#startBoot(); return true;
  }
  // #sab() — the SharedArrayBuffer backing #header/#dataU8, (re)allocated once
  // per spawned worker (a fresh worker needs a fresh buffer to hand `boot`).
  #sab() {
    const sab = new SharedArrayBuffer(8 + ASK_REPLY_MAX);
    this.#header = new Int32Array(sab, 0, 2); this.#dataU8 = new Uint8Array(sab, 8);
    return sab;
  }
  #spawnWorker() {
    this.#worker = new Worker(WORKER_URL);
    this.#worker.onmessage = this.#onMessage;
    this.#worker.onerror = this.#onWorkerError;
  }
  #startBoot() {
    this.#recovering = true; this.#up = false; this.#clearWorker();
    this.#onBootStatus({ state: 'loading', attempt: this.#bootRetryIndex + 1, maxAttempts: this.#bootRetryDelays.length + 1 });
    this.#spawnWorker();
    this.#worker.postMessage({ cmd: 'boot', sab: this.#sab(), sources: this.#sources, packages: this.#packages });
  }
  #clearWorker() {
    if (!this.#worker) return;
    this.#worker.onerror = null; this.#worker.onmessage = null;
    try { this.#worker.terminate(); } catch { /* already dead */ }
    this.#worker = null;
  }
  #clearBootTimer() { if (this.#bootTimer) { clearTimeout(this.#bootTimer); this.#bootTimer = null; } }
  #handleBootFailure(msg) {
    this.#up = false; this.#clearWorker();
    if (this.#bootRetryIndex < this.#bootRetryDelays.length) {
      const delayMs = this.#bootRetryDelays[this.#bootRetryIndex++];
      this.#onBootStatus({ state: 'retrying', retry: this.#bootRetryIndex, totalRetries: this.#bootRetryDelays.length, delayMs, message: msg });
      this.#bootTimer = setTimeout(() => { this.#bootTimer = null; this.#startBoot(); }, delayMs);
      return;
    }
    this.#recovering = false;
    this.#onBootStatus({ state: 'failed', reason: 'worker-boot', message: msg });
  }
  run(code) {
    if (!this.#up || this.#recovering || !this.#worker) return;   // mid-reboot after a crash — nothing to send to yet
    this.#worker.postMessage({ cmd: 'run', code });
    this.#armHangTimer();
  }
  stop() {
    if (!this.#worker || this.#recovering) return false;
    this.#waitingForResponse = false;
    this.#reboot();
    return true;
  }
  // #armHangTimer/#clearHangTimer — RUN_HANG_MS belt-and-suspenders watchdog
  // for a runaway loop that wedges the worker THREAD itself (never yields
  // back to the event loop, so no postMessage — not even a crash — ever
  // happens). Armed on every run() and every respond() (the worker resumes
  // real Python execution after either); cleared the moment ANY message
  // comes back (done/error = finished, tell = made progress, ask = now
  // legitimately parked on Atomics.wait for a human, which must NOT time out).
  #armHangTimer() {
    this.#clearHangTimer();
    this.#hangTimer = setTimeout(() => this.#onHang(), RUN_HANG_MS);
  }
  #clearHangTimer() { if (this.#hangTimer) { clearTimeout(this.#hangTimer); this.#hangTimer = null; } }
  #onHang() { this.#handleFatal('worker treo — bài chạy quá lâu không phản hồi, đang khởi động lại máy...'); }
  // #onWorkerError — the worker THREAD died (uncaught JS/WASM fault), not a
  // normal caught Python exception (those come back as a `{evt:'error'}`
  // postMessage via #onMessage, already handled). No done/error message will
  // EVER arrive from a dead worker, and notebook-runner.js's #clearRunning()
  // (which re-enables every `.crun` button) only ever fires from onDone/
  // onError — so without this handler, a mid-cell worker crash permanently
  // disables every RUN button on the page (see py-bridge.js's header comment
  // for the fuller failure chain this fixes).
  #onWorkerError = ev => {
    ev && ev.preventDefault && ev.preventDefault();    // don't also surface as an unhandled browser-level error
    if (!this.#up) { this.#handleBootFailure(ev && ev.message ? ev.message : 'worker boot failed'); return; }
    this.#handleFatal(`worker crashed — đang khởi động lại máy... (${ev && ev.message ? ev.message : 'unknown error'})`);
  };
  // #handleFatal(msg) — shared by a real onerror crash AND the hang watchdog:
  // report to the CURRENT cell first, while isUp is still true — onError's
  // #clearRunning() path gates the re-enable on isUp, so this must fire
  // BEFORE we flip #up false for the reboot. Then transparently rebuild.
  #handleFatal(msg) {
    if (this.#recovering) return;                    // a dying/hung worker can trip more than one signal — handle it exactly once
    this.#recovering = true;
    this.#clearHangTimer();
    console.error('py-bridge:', msg);
    this.#onError(msg);
    this.#reboot();
  }
  // #reboot() — transparently replace the dead worker with a fresh one and
  // re-run `boot` against the SAME cached module sources, so cells after the
  // crash keep working instead of every subsequent run() silently going
  // nowhere. onReady() (called once the new worker signals `ready`) re-
  // enables the RUN buttons and flips isUp back on — belt-and-suspenders
  // beyond the immediate onError() re-enable above, covering the case where
  // #clearRunning() had already run once and cleared #running before the
  // crash was even detected.
  async #reboot() {
    this.#up = false;
    this.#clearHangTimer();
    this.#clearBootTimer();
    this.#waitingForResponse = false;
    this.#clearWorker();
    if (!this.#sources) { this.#recovering = false; return; } // never booted — nothing to recover into
    this.#bootRetryIndex = 0;
    this.#startBoot();
  }
  respond(text) {
    if (!this.#waitingForResponse || !this.#header || !this.#dataU8) return false;
    this.#waitingForResponse = false;
    const bytes = this.#enc.encode(String(text));
    this.#dataU8.set(bytes.subarray(0, this.#dataU8.length), 0);
    Atomics.store(this.#header, 1, Math.min(bytes.length, this.#dataU8.length));
    Atomics.store(this.#header, 0, 1); Atomics.notify(this.#header, 0);
    this.#armHangTimer();               // the worker resumes real Python execution now — re-arm the watchdog
    return true;
  }

  #onMessage = ev => {
    const d = ev.data;
    if (d.evt === 'ready') { this.#waitingForResponse = false; this.#clearBootTimer(); this.#bootRetryIndex = 0; this.#recovering = false; this.#up = true; this.#onReady(); return; }
    if (d.evt === 'boot-error') { this.#handleBootFailure(d.msg || 'Không tải được Python'); return; }
    if (d.evt === 'done') { this.#waitingForResponse = false; this.#clearHangTimer(); this.#onDone(); return; }
    if (d.evt === 'error') { this.#waitingForResponse = false; this.#clearHangTimer(); this.#onError(d.msg); return; }
    if (d.req === 'tell') { this.#armHangTimer(); this.#onTell(d.kind, d.text); return; }    // tell() doesn't block — Python keeps running right after, so re-arm rather than just clear
    if (d.req === 'ask') { this.#waitingForResponse = true; this.#clearHangTimer(); this.#onAsk(d.kind, d.prompt); return; }   // legitimately parked on Atomics.wait for a human — must NOT time out
  };
}
