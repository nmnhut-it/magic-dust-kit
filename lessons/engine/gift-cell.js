// gift-cell.js — mid-notebook loot: {gift:{art,name,blurb}} — a shimmering
// package appears in the flow, ringed by a shrinking loop (rhythm-game
// timing): ✋ high-five (or tap) the moment the ring meets the package for
// a PERFECT catch — any other moment still claims the gift (no fail state,
// camera timing is inherently noisy), just with a plainer "GOT IT" result.
//
// BADGE VARIANT (`{gift:{...,badge:true,badgeId:'...'}}`, see
// PEDAGOGY-V2-PLAN.md's reward beats): a badge gift is a FORGED CREST, not a
// chat-emoji face — renderCrest() below draws a rune-medallion (cyan/violet/
// navy palette, metallic rim, glow, the badge's initial) instead of the
// generic `.gglyph` emoji tile every other gift uses. It's also claimed with
// the 🤙 SHAKA hold (armShakaHoldGate, gesture-dispatcher.js) instead of the
// ring-catch high-five — a badge is EARNED with a deliberate steady sign, not
// caught on a timing window. Non-badge gifts are completely unchanged (same
// ring-catch, same glyph/art face). Claim still forwards `{badgeId, name}` on
// saveProgress so the inventory/forge persistence layer can pick it up.
import { GIFT_RING_PERIOD_MS, GIFT_PERFECT_WINDOW } from './constants.js';
import { registerBypass } from './bypass-registry.js';
import { inventory } from './inventory.js';
import { renderProse } from './prose.js';

const RING_MAX = 1.6, RING_MIN = 1.0;   // ring scale sweeps this range each period

// injectBadgeCss() — self-contained crest styling, injected once from JS
// (gift-cell.js does NOT touch node.css — that file is owned elsewhere).
// Guarded by #78b2a5gecss so re-mounting the cell never duplicates the tag.
function injectBadgeCss() {
  if (document.getElementById('badgecss')) return;
  const s = document.createElement('style'); s.id = 'badgecss';
  s.textContent = `
.crest{position:relative;width:100%;height:100%;display:grid;place-items:center;border-radius:50%;
  background:radial-gradient(circle at 34% 30%,#fffdf5,#d9eee5 72%);
  box-shadow:inset 0 0 0 3px #fffaf0,inset 0 0 0 6px rgba(79,111,115,.42),0 0 26px rgba(214,154,32,.32),0 0 10px rgba(79,111,115,.3);
  animation:crestglow 3.2s ease-in-out infinite}
.crest::before{content:'';position:absolute;inset:8%;border-radius:50%;
  background:conic-gradient(from 0deg,#78b2a5,#78b2a5,#78b2a5,#78b2a5,#78b2a5);
  -webkit-mask:radial-gradient(closest-side,transparent calc(100% - 5px),#183f49 calc(100% - 4px));
  mask:radial-gradient(closest-side,transparent calc(100% - 5px),#183f49 calc(100% - 4px));
  opacity:.9}
.crest::after{content:'';position:absolute;inset:16%;border-radius:50%;
  background:linear-gradient(160deg,rgba(255,253,245,.28),transparent 55%);pointer-events:none}
.crestletter{position:relative;z-index:1;font:800 42% 'Be Vietnam Pro',system-ui,sans-serif;letter-spacing:.02em;
  color:#183f49;text-shadow:0 2px 0 #fffdf5,0 0 16px rgba(79,111,115,.3);font-size:2.6rem}
@keyframes crestglow{0%,100%{filter:brightness(1) saturate(1)}50%{filter:brightness(1.18) saturate(1.25)}}
.giftcell.badge .giftwrap{animation:wiggle 2.6s ease-in-out infinite,crestglow 3.2s ease-in-out infinite}
.giftcell.badge .gifthint{opacity:.95}
.crest.hasart{background:none;box-shadow:none}
.crest.hasart::before,.crest.hasart::after,.crest.hasart .crestletter{display:none}
.crestart{position:relative;z-index:1;width:100%;height:100%;object-fit:contain;
  filter:drop-shadow(0 0 14px rgba(120,178,165,.55));animation:crestglow 3.2s ease-in-out infinite}`;
  document.head.appendChild(s);
}
// crestFace(name, badgeId) — the forged-crest markup: one of the 8 Gemini
// crest medallions (assets/badges/crest-0..7.png), picked DETERMINISTICALLY
// from badgeId||name so the same badge always shows the same crest. Art
// missing → onerror falls back to the original procedural rune-medallion
// with the gift's initial (no emoji glyph anywhere in this path).
// crestArtSrc(key) — deterministic badge-key → crest art path (same hash the
// forge's badge shelf uses, so a badge looks identical everywhere).
export function crestArtSrc(key) {
  let h = 0; for (const ch of String(key || '✦')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `assets/badges/crest-${h % 8}.webp`;
}
function crestFace(name, badgeId) {
  injectBadgeCss();
  const initial = (name || '').trim().charAt(0).toUpperCase() || '✦';
  return `<div class="crest hasart"><img class="crestart" src="${crestArtSrc(badgeId || name)}" alt="" onerror="this.closest('.crest').classList.remove('hasart');this.remove()"><span class="crestletter">${initial}</span></div>`;
}

export function giftCell(c, { gestureDispatcher, cameraEngine, saveProgress, completeCell }) {
  const el = document.createElement('div'); el.className = 'giftcell' + (c.gift.badge ? ' badge' : '');
  const isBadge = !!c.gift.badge;
  // badge gifts get the forged crest visual; everything else keeps its
  // existing art/glyph face untouched.
  const face = isBadge ? crestFace(c.gift.name, c.gift.badgeId) : (c.gift.art ? `<img src="${c.gift.art}" alt="">` : `<div class="gglyph">${c.gift.glyph || '✦'}</div>`);
  el.innerHTML = `
    <div class="giftwrap"><div class="giftring"></div><div class="giftmini">${face}</div></div>
    <div class="gifthint">${isBadge ? 'một huy hiệu đang thành hình… giữ 🤙 (ngón cái + ngón út) ỔN ĐỊNH để nhận — hoặc chạm' : 'có gì đó đang lấp lánh… đập tay ✋ ĐÚNG NHỊP để nhận — hoặc chạm'}</div>
    <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
    <div class="got gone"><div class="gotlabel" id="gotResult">BẠN NHẬN ĐƯỢC</div>
      <div class="gotcard">${face}</div>
      <div class="gotname">${renderProse(c.gift.name)}</div><div class="gotblurb">${renderProse(c.gift.blurb || '')}</div></div>`;

  let ringRAF = 0, startT = 0;
  const ringPhase = () => ((performance.now() - startT) % GIFT_RING_PERIOD_MS) / GIFT_RING_PERIOD_MS; // 0..1 sawtooth
  const paintRing = () => {
    if (el.classList.contains('opened')) return;
    const p = ringPhase(), scale = RING_MAX - (RING_MAX - RING_MIN) * p;
    el.style.setProperty('--gr', scale);
    ringRAF = requestAnimationFrame(paintRing);
  };
  const startRing = () => { if (!startT) { startT = performance.now(); ringRAF = requestAnimationFrame(paintRing); } };

  const open = () => {
    if (el.classList.contains('opened')) return; el.classList.add('opened');
    cancelAnimationFrame(ringRAF);
    // grade the catch: how close was the ring to meeting the package (scale 1.0) right now?
    const p = ringPhase(), scale = RING_MAX - (RING_MAX - RING_MIN) * p;
    const closeness = Math.abs(scale - RING_MIN) / (RING_MAX - RING_MIN);
    // a badge is earned by holding the 🤙 sign steady (armShakaHoldGate), not
    // timing a ring — completing the hold always reads as a clean "PERFECT",
    // there's no closeness window to grade.
    const perfect = isBadge || closeness <= GIFT_PERFECT_WINDOW;
    gestureDispatcher.disarmActGate(); gestureDispatcher.disarmMotionGate(); el.querySelector('.bcam').classList.remove('on');
    saveProgress(c.gift.badge ? { giftGiven: true, badge: { id: c.gift.badgeId, name: c.gift.name } } : { giftGiven: true });
    // THỢ RÈN persistence hook (additive — see FORGE-PLAN.md): a badge gift
    // ({gift:{...,badge:true,badgeId}}) also records its id in the forge
    // inventory on claim. Guarded on both fields so a plain gift is unaffected.
    if (c.gift && c.gift.badge && c.gift.badgeId) inventory.addBadge(c.gift.badgeId);
    setTimeout(() => {
      el.querySelector('.giftwrap').classList.add('gone'); el.querySelector('.gifthint').classList.add('gone');
      el.querySelector('#gotResult').textContent = perfect ? '✦ ĐÚNG NHỊP TUYỆT ĐỐI! ✦' : 'BẠN NHẬN ĐƯỢC';
      const got = el.querySelector('.got'); got.classList.toggle('perfect', perfect); got.classList.remove('gone');
      setTimeout(() => completeCell(el), 1200);
    }, 700);
  };
  el.querySelector('.giftmini').onclick = open;
  el._arm = () => {
    startRing();
    const chip = el.querySelector('.bcam');
    // no explicit armFingertipFx here — the gates below arm/disarm their own
    // fingertip fx over `chip` internally.
    if (isBadge) {
      // BADGE claim = hold 🤙 (thumb+pinky, middle three curled) steady —
      // see gesture-dispatcher.js#armShakaHoldGate. A tap/bypass fallback
      // always still claims it (camera is noisy, and there's no dead end).
      const bypassOff = registerBypass('nhận huy hiệu — giữ 🤙', () => { bypassOff(); open(); });
      gestureDispatcher.armShakaHoldGate(cameraEngine, chip, () => !el.classList.contains('opened'), () => {}, () => { bypassOff(); open(); });
      return;
    }
    // resolve = perfect catch: rewind startT so ringPhase() reads as the ring
    // just meeting the package (closeness ~0), then claim it for real.
    const bypassOff = registerBypass('nhận quà — bắt CHUẨN', () => { startT = performance.now() - GIFT_RING_PERIOD_MS * 0.999; bypassOff(); open(); });
    gestureDispatcher.armTimedCatchGate(cameraEngine, chip, 5, () => !el.classList.contains('opened'), () => { bypassOff(); open(); });
  };
  return el;
}
