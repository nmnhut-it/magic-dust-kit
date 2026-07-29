// cameo-cell.js — a static story-beat panel: {cameo:{art, caption}} — one
// image + one line, no interaction required beyond a tap-to-continue (it
// also auto-advances on its own after a beat, so it never blocks pacing).
// For short "something just happened" moments (a monster appears, a
// character jumps in) that don't need the full gift/quiz/widget machinery.
const CAMEO_AUTO_MS = 2600;

export function cameoCell(c, { completeCell }) {
  const el = document.createElement('div'); el.className = 'cameo';
  el.innerHTML = `
    <div class="cameoart"><img src="${c.cameo.art}" alt=""></div>
    <div class="cameocap">${c.cameo.caption || ''}</div>`;
  let done = false;
  const advance = () => { if (done) return; done = true; completeCell(el); };
  el.onclick = advance;
  setTimeout(advance, CAMEO_AUTO_MS);
  return el;
}
