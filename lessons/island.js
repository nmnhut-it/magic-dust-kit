// island.js — composition root for a SIDE ISLAND (bonus practice page, e.g.
// "extra reps for read/say/chuỗi" after node01, or "extra reps for phép
// tính" after node02). A trimmed copy of node.js: same splash → bundle →
// notebook acts (reusing every engine/*.js module untouched), but the
// closing act is a plain ✋ "XONG!" finish card instead of the vortex/seal
// RITUAL — a side island must NEVER touch the main 'magicdust.saga' counter
// (that's what ritual-controller.js#seal() writes, keyed to N.index; a
// side island reusing that path would corrupt or skip real node progress).
// Per-node content = window.NODE {index, title, subtitle, bundle, machine,
// modules, cells, sideIslandId}. `sideIslandId` is this file's own addition
// — saga.js reads `magicdust.sideisland.<sideIslandId>` to paint the map pin
// done, written here on finish (see #finishFactory below), not by any
// shared engine file.
import { $, mountPage, warnIfNotIsolated, scenePanelHtml } from './engine/dom-scaffold.js';
import { ProgressStore } from './engine/progress-store.js';
import { castSpell, showValue, screenFx, showPixels, createFxQueue } from './engine/casting.js';
import { CameraEngine } from './engine/camera-engine.js';
import { GestureDispatcher } from './engine/gesture-dispatcher.js';
import { PyBridge } from './engine/py-bridge.js?v=20260714-165347';
import { NotebookRunner } from './engine/notebook-runner.js?v=20260714-165347';
import { PhotoBooth } from './engine/photo-booth.js';
import { InteractiveStudio } from './engine/interactive-studio.js';
import { AskGate } from './engine/ask-gate.js';
import { installCheatToggle } from './engine/cheat-panel.js';
import { registerBypass, installBypassKey } from './engine/bypass-registry.js';
import { inventory } from './engine/inventory.js';
import { telemetry } from './engine/telemetry.js';
import { awardSagaXp } from './engine/collectible-store.js';

const N = window.NODE || { index: -1, title: 'Island', cells: [] };
mountPage(N);
warnIfNotIsolated();
const cameraFree = N.cameraFree === true;

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

const scenePanel = document.createElement('div'); scenePanel.id = 'scenepanel';
scenePanel.innerHTML = scenePanelHtml({ cameraFree });

const progressStore = new ProgressStore(N.index, N.cells, N.sideIslandId);
const fxQueue = createFxQueue();
const askGate = new AskGate();

function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
let vfxLoading = null;
function loadVortex() {
  vfxLoading ||= (self.RitualVortex ? Promise.resolve() : loadScript('./ritual-vortex.js')).catch(() => {});
  return vfxLoading;
}

let photoBooth = null, notebookRunner = null, studio = null;
const gestureDispatcher = new GestureDispatcher({
  isRunning: () => notebookRunner?.isRunning ?? false,
  frozenCheck: () => scenePanel.classList.contains('frozen'),
  boothSummon: () => photoBooth?.isSummoning ?? false,
  boothEmit: (x, y, n) => photoBooth?.emit(x, y, n),
  hud: (count, has) => {
    scenePanel.querySelector('#scstat').textContent = has ? 'giữ yên tay nhé…' : 'giơ bàn tay ✋ cho máy thấy nào';
    scenePanel.querySelector('#sccount').textContent = has ? count : '—';
  },
});
const cameraEngine = new CameraEngine(scenePanel.querySelector('#cam'), {
  onFrame: res => { gestureDispatcher.onHands(res); },
  watchdogActive: () => gestureDispatcher.hasActiveConsumer() || fxQueue.busy > 0 || (studio?.isActive ?? false),
});

studio = new InteractiveStudio(scenePanel, {
  cameraEngine, gestureDispatcher, loadVortex,
  outLine: t => notebookRunner?.outLine('t-sys', t),
});

const castingApi = {
  castSpell: name => castSpell(name, { scenePanel, fxQueue, vortexShare: photoBooth.vortexShare, loadVortex }),
  showValue: (sp, v) => showValue(sp, v),
  screenFx: (sp, mode, outLine) => screenFx(sp, mode, outLine),
  showPixels: (sp, text) => showPixels(sp, text),
};

photoBooth = new PhotoBooth(scenePanel, {
  cameraEngine, gestureDispatcher, loadVortex, fxQueue, askGate,
  outLine: t => notebookRunner?.outLine('t-sys', t),
  appendOutput: node => notebookRunner?.appendOutput(node),
});

const pyBridge = new PyBridge({
  onReady: () => notebookRunner.onReady(),
  onBootStatus: state => notebookRunner.onBootStatus(state),
  onDone: () => notebookRunner.onDone(),
  onError: msg => notebookRunner.onError(msg),
  onTell: (kind, text) => notebookRunner.onTell(kind, text),
  onAsk: (kind, prompt) => notebookRunner.onAsk(kind, prompt),
});

notebookRunner = new NotebookRunner(N, {
  bridge: pyBridge, gestureDispatcher, cameraEngine, progressStore, casting: castingApi, photoBooth, studio,
  scenePanel, bookEl: $('book'), pystatEl: $('pystat'), toast, askGate, loadVortex,
});

// finish() — a side island's own terminal beat, standing in for the main
// arc's vortex/seal RITUAL: a plain ✋ hold-to-finish card (armActHoldGate,
// same charge/gauge/tap-fallback machine every other act gate uses), which
// on completion marks THIS island (not the main saga node counter) done and
// returns to the map. No ritual-controller.js, no SAGA_KEY write.
const SIDE_KEY = N.completionKey || (N.sideIslandId ? `magicdust.sideisland.${N.sideIslandId}` : null);
const SIDE_SOLVED_FLAG = 'magicdust.sideisland.justSolved';
function finishFactory() {
  const learningBranch = N.kind === 'learning-branch';
  const mathSaga = N.kind === 'math-saga';
  const challengeSaga = N.kind === 'python-challenge-saga';
  const visionSaga = N.kind === 'vision-saga';
  const dsaSaga = N.kind?.startsWith('dsa-');
  // N.finish lets an island replace the generic "về bản đồ" card — used when
  // the payoff is somewhere other than the map (the FX island hands the
  // learner the real camera app they just rebuilt in Python).
  const custom = N.finish || null;
  const el = document.createElement('div'); el.className = 'islandfinish';
  if (custom) el.innerHTML = `
    <div class="iftitle">${custom.title || '✦ XONG RỒI! ✦'}</div>
    <div class="ifsub">${custom.sub || ''}</div>
    <button class="ifbtn"><i class="iffill"></i><span>${cameraFree ? '' : '✋ '}${custom.button || 'ĐI TIẾP'}</span></button>
    <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>`;
  else el.innerHTML = `
    <div class="iftitle">${learningBranch ? '✦ HOÀN THÀNH NHÁNH HỌC! ✦' : mathSaga ? '✦ HOÀN THÀNH BÀI TOÁN! ✦' : challengeSaga ? '✦ HOÀN THÀNH THỬ THÁCH! ✦' : visionSaga ? '✦ HOÀN THÀNH TRẠM MẮT MÁY! ✦' : dsaSaga ? '✦ HOÀN THÀNH CHẶNG DSA! ✦' : '✦ XONG RỒI! ✦'}</div>
    <div class="ifsub">${learningBranch ? 'Bạn đã học xong cú pháp mới. Tháp luyện tập của nhánh này đã mở trên bản đồ.' : mathSaga ? 'Bạn đã dùng Python để giải xong một nhóm bài Toán 6. Bài tiếp theo đã sáng trên bản đồ Toán.' : challengeSaga ? 'Bạn đã giải xong một nhóm bài Python. Chặng tiếp theo đã sáng trên bản đồ.' : visionSaga ? 'Bạn đã tự tính được một cơ chế thị giác máy. Trạm này đã sáng trên bản đồ Mắt Máy.' : dsaSaga ? 'Bạn đã hoàn thành một chặng cấu trúc dữ liệu và giải thuật. Đường tiếp theo đã sáng trên bản đồ.' : 'Bạn vừa luyện thêm một mẻ Mật Ngữ mới. Về lại bản đồ nào!'}</div>
    <button class="ifbtn"><i class="iffill"></i><span>${cameraFree ? 'VỀ BẢN ĐỒ' : '✋ VỀ BẢN ĐỒ'}</span></button>
    <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>`;
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    let award = null;
    if (N.reward) try { award = awardSagaXp(localStorage, N.reward); } catch { /* storage may be unavailable */ }
    if (SIDE_KEY) try { localStorage.setItem(SIDE_KEY, '1'); } catch { /* storage may be unavailable */ }
    // `sealsSagaNode` is the ONE sanctioned way an island.js page advances the
    // main counter: the final project (node 25, GƯƠNG VÔ CỰC) sits on the main
    // trail but ends in a handoff card rather than the vortex/seal ritual, so
    // nothing else would ever mark it done. Monotonic — never rewinds progress.
    if (typeof N.sealsSagaNode === 'number') try {
      const key = 'magicdust.saga', at = Math.max(+localStorage.getItem(key) || 0, N.sealsSagaNode + 1);
      localStorage.setItem(key, String(at));
    } catch { /* storage may be unavailable */ }
    if (N.sideIslandId) try { sessionStorage.setItem(N.justSolvedKey || SIDE_SOLVED_FLAG, N.sideIslandId); } catch { /* storage may be unavailable */ }
    if (award?.awarded) try {
      sessionStorage.setItem('magicdust.collectible.justAwarded', JSON.stringify({
        track: N.reward.track, nodeId: N.reward.nodeId, xp: award.xp, dust: award.dust,
        collectible: award.collectible,
      }));
    } catch { /* storage may be unavailable */ }
    gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
    progressStore.clear();
    telemetry.courseComplete(N, { completion: learningBranch ? 'learning-branch' : mathSaga ? 'math-saga' : challengeSaga ? 'python-challenge-saga' : visionSaga ? 'vision-saga' : dsaSaga ? N.kind : 'side-island' });
    location.href = custom?.page || N.returnPage || './index.html';
  };
  el.querySelector('.ifbtn').onclick = finish;
  el._arm = () => {
    if (cameraFree) return;
    const off = registerBypass(`${learningBranch ? 'nhánh học' : mathSaga ? 'bài Toán' : challengeSaga ? 'thử thách Python' : visionSaga ? 'trạm Mắt Máy' : dsaSaga ? 'chặng DSA' : 'đảo phụ'} — về bản đồ (giữ ✋)`, () => { off(); finish(); });
    gestureDispatcher.armActHoldGate(cameraEngine, el.querySelector('.bcam'), 5, () => !done,
      p => el.style.setProperty('--ifc', p), () => { off(); finish(); });
  };
  return el;
}
notebookRunner.setRitualCellFactory(finishFactory);

// ── acts: splash → bundle → book (identical to node.js) ──
let bundleVfx = null, bundleBypassOff = null;
function enterNode() {
  if (bundleBypassOff) { bundleBypassOff(); bundleBypassOff = null; }
  gestureDispatcher.disarmActGate(); $('scam').classList.remove('on');
  $('splash').classList.add('gone'); $('bundleAct').classList.remove('gone');
  loadVortex().then(() => {
    if (self.RitualVortex && !$('bundleAct').classList.contains('gone') && !$('giftwrap').classList.contains('opening'))
      bundleVfx = self.RitualVortex.mount($('bundleAct'), { circle: false, cy: .45, spread: .26 });
  });
  bundleBypassOff = registerBypass('mở túi quà (giơ ✋)', () => { if (bundleBypassOff) { bundleBypassOff(); bundleBypassOff = null; } openGift(); });
  if (!cameraFree) gestureDispatcher.armActHoldGate(cameraEngine, $('bcam'), 5,
      () => !$('bundleAct').classList.contains('gone') && !$('giftwrap').classList.contains('opening'),
      p => { $('bundleAct').style.setProperty('--bc', p); $('giftwrap').classList.toggle('charging', p > .06);
             if (bundleVfx) bundleVfx.setCharge(p * .95); },
      openGift);
}
function openGift() {
  const g = $('giftwrap'); if (g.classList.contains('opening')) return;
  if (bundleBypassOff) { bundleBypassOff(); bundleBypassOff = null; }
  gestureDispatcher.disarmActGate(); $('bcam').classList.remove('on'); g.classList.remove('charging');
  if (bundleVfx) bundleVfx.burst();
  g.classList.add('opening'); $('gifthint').textContent = '…';
  setTimeout(() => { g.classList.add('gone'); $('gifthint').classList.add('gone');
    $('bundleAct').querySelector('.actsub').style.display = 'none'; $('got').classList.remove('gone');
    setTimeout(enterBook, 1900);
  }, 850);
}
function enterBook() {
  if (bundleVfx) { bundleVfx.stop(); bundleVfx = null; }
  $('bundleAct').classList.add('gone'); $('book').classList.remove('gone'); notebookRunner.buildCells();
}
$('enterBtn').onclick = enterNode;
$('giftwrap').onclick = openGift;
let splashBypassOff = registerBypass('vào đảo phụ (giơ ☝)', () => { if (splashBypassOff) { splashBypassOff(); splashBypassOff = null; } enterNode(); });
if (!cameraFree) setTimeout(() => gestureDispatcher.armActHoldGate(cameraEngine, $('scam'), 1, () => !$('splash').classList.contains('gone'),
  p => $('enterBtn').style.setProperty('--gc', p), () => { if (splashBypassOff) { splashBypassOff(); splashBypassOff = null; } enterNode(); }), 0);

installBypassKey(() => toast('⏭ CHEAT'));

async function fetchText(u) { try { const r = await fetch(u); return r.ok ? await r.text() : null; } catch { return null; } }
async function boot() {
  if (!self.crossOriginIsolated) return;
  const sources = {};
  for (const [name, path] of Object.entries(N.modules || {})) sources[name] = await fetchText(path);
  await pyBridge.boot(sources, N.pythonPackages || []);
}
// Dynamic lesson wrappers (math6-lesson.html / python50-lesson.html) import
// this module after awaiting their content module. On a warm cache the window
// load event can already be over by then, so registering only a load listener
// leaves Pyodide asleep forever. Static side-island pages still take the
// listener path; late dynamic imports boot immediately.
if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot, { once: true });

window.nodeDev = {
  force: () => {},
  skip: () => notebookRunner.devForce(notebookRunner.seq[notebookRunner.frontier]),
  toFirst: () => notebookRunner.devTo(() => true, () => { enterNode(); openGift(); }),
  toCell: label => notebookRunner.devTo(c => c.label === label, () => { enterNode(); openGift(); }),
  toPixelBoard: () => notebookRunner.devTo(c => !!c.pixelBoard, () => { enterNode(); openGift(); }),
  toRitual: () => notebookRunner.devTo(c => !!c.ritual, () => { enterNode(); openGift(); }),
  cast: (k = 'fire') => { notebookRunner.devScene($('book').classList.contains('gone')); castingApi.castSpell(k); },
  screen: m => { notebookRunner.devScene($('book').classList.contains('gone')); screenFx(scenePanel, m || 'lighten', t => notebookRunner.outLine('t-sys', t)); },
  grantBadge: (id = `dev-${Date.now()}`) => inventory.addBadge(id),
  grantBadges: (n = 2) => { for (let i = 0; i < n; i++) inventory.addBadge(`dev-${Date.now()}-${i}`); },
};
window.inventory = inventory;
installCheatToggle(window.nodeDev);
