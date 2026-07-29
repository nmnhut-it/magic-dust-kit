// tune-overlay.js — cheat-tier dev HUD for live-tuning the swipe/track
// gesture feel: fps, current finger count, and the active gate's charge
// value. Invisible by default — only mounts when the page URL has `?tune`
// (or `&tune`), so students/teachers never see it. Polls gestureDispatcher's
// public getters (no new hooks into the priority ladder) each rAF frame;
// cheap (one small fixed <div>, textContent writes only).
export function mountTuneOverlay(gestureDispatcher) {
  if (!new URLSearchParams(location.search).has('tune')) return;
  const el = document.createElement('div'); el.id = 'tuneoverlay';
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:999;padding:6px 10px;border-radius:8px;'
    + 'background:rgba(24,63,73,.75);color:#d9eee5;font:600 11px "Cascadia Code",Consolas,monospace;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  let frames = 0, fps = 0, lastFpsAt = performance.now();
  let lastCount = '—';
  gestureDispatcher.onLandmarks((lm, has, count) => { lastCount = has ? count : '—'; });
  const loop = () => {
    frames++;
    const now = performance.now();
    if (now - lastFpsAt >= 500) { fps = Math.round(frames * 1000 / (now - lastFpsAt)); frames = 0; lastFpsAt = now; }
    const gate = gestureDispatcher.actGateArmed ? 'act' : gestureDispatcher.motionGateArmed ? 'motion' : gestureDispatcher.fingerGateArmed ? 'finger' : '—';
    el.textContent = `fps ${fps}\nfingers ${lastCount}\ngate ${gate}`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
