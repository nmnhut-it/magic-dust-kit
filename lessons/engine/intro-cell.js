// intro-cell.js — {intro:{title, hook, art?}} — a cinematic title-card cell
// dropped as the very FIRST cell of a node (owner: "giới thiệu ngay đầu bài
// học để tạo cảm giác hứng thú" — a hook, not a boss-intro). One beat: the
// node's title stamps in, then Pip's one-line hook (the "what's about to
// happen" tease) fades up under it; optional `art` centers above the title.
// Never a dead end — tap OR auto-advance, same non-blocking contract as
// cameo-cell.js (this file mirrors that pattern almost verbatim).
import { renderProse } from './prose.js';

const INTRO_AUTO_MS = 3400;

export function introCell(c, { completeCell }) {
  const cfg = c.intro;
  const el = document.createElement('div'); el.className = 'introcell';
  el.innerHTML = `
    ${cfg.art ? `<div class="introart"><img src="${cfg.art}" alt=""></div>` : ''}
    <div class="introtitle">${renderProse(cfg.title || '')}</div>
    <div class="introhook">${renderProse(cfg.hook || '')}</div>
    <div class="introtap">chạm để bắt đầu ✦</div>`;
  let done = false;
  const advance = () => { if (done) return; done = true; completeCell(el); };
  el.onclick = advance;
  setTimeout(advance, INTRO_AUTO_MS);
  return el;
}
