// checkpoint-cell.js — {checkpoint:{text, sign?}} — a small celebratory
// stamp cell dropped after a practice arc: Pip recaps the takeaway (`text`),
// then a ✋ HIGH-FIVE hold gate (armActHoldGate, default sign 5, `sign`
// overridable) physically "stamps" it — hold via camera (gauge charges,
// soft-decays if dropped, same machine as the bundle/ritual acts) OR just
// tap the button (never a dead end, no camera required). On completion: a
// spark burst at the button + a brief full-cell flash (reusing dom-scaffold's
// sparkBurst + node.css's flash keyframes — no new FX systems), then the
// notebook reveals onward via completeCell().
import { sparkBurst } from './dom-scaffold.js';
import { registerBypass } from './bypass-registry.js';
import { renderProse } from './prose.js';

export const CHECKPOINT_READ_MS = 10_000;

export function checkpointCell(c, { gestureDispatcher, cameraEngine, completeCell, cameraFree = false }) {
  const cfg = c.checkpoint, sign = cfg.sign || 5;
  const el = document.createElement('div'); el.className = 'checkpointcell';
  el.innerHTML = `
    <div class="ckavatar"><i>✦</i></div>
    <div class="ckbubble"><b>PIP</b><span class="txt">${renderProse(cfg.text)}</span></div>
    <div class="ckhint" aria-live="polite">Đọc lại cùng Pip trong 10 giây…</div>
    <button class="ckholdbtn" disabled><i class="ckfill"></i><span>ĐỌC · 10 GIÂY</span></button>
    <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
    <div class="ckflash"></div>`;

  const button = el.querySelector('.ckholdbtn');
  const buttonLabel = button.querySelector('span');
  const hint = el.querySelector('.ckhint');
  let ready = false, readTimer = null, bypassOff = null;
  const stamp = () => {
    if (!ready || el.classList.contains('stamped')) return; el.classList.add('stamped');
    if (readTimer) clearInterval(readTimer);
    if (bypassOff) { bypassOff(); bypassOff = null; }
    gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
    sparkBurst(el, button, 22);
    el.querySelector('.ckflash').classList.add('go');
    hint.textContent = '✦ ĐÃ GHI NHỚ ✦';
    setTimeout(() => completeCell(el), 900);
  };
  const unlockStamp = () => {
    if (ready || el.classList.contains('done')) return;
    ready = true; button.disabled = false;
    buttonLabel.textContent = cameraFree ? 'ĐÃ HIỂU' : '✋ HIGH-FIVE';
    hint.textContent = cameraFree ? 'Bấm nút để xác nhận — bài này không dùng camera' : '✋ giơ tay HIGH-FIVE để ghi nhớ điều này — hoặc bấm nút';
    if (cameraFree) return;
    bypassOff = registerBypass('checkpoint high-five', stamp);
    gestureDispatcher.armActHoldGate(cameraEngine, el.querySelector('.bcam'), sign,
      () => !el.classList.contains('stamped'),
      p => el.style.setProperty('--ckc', p),
      stamp);
  };
  const startReading = () => {
    if (readTimer || ready) return;
    const deadline = performance.now() + CHECKPOINT_READ_MS;
    const update = () => {
      if (el.classList.contains('done')) { clearInterval(readTimer); readTimer = null; return; }
      const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      buttonLabel.textContent = `ĐỌC · ${seconds} GIÂY`;
      if (seconds > 0) return;
      clearInterval(readTimer); readTimer = null; unlockStamp();
    };
    update(); readTimer = setInterval(update, 200);
  };
  button.onclick = stamp;
  el._arm = startReading;
  return el;
}
