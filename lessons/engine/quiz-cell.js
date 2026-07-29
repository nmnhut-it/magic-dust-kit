// quiz-cell.js — {quiz:{title, questions:[{q, a:[…], correct, gesture?}]}}.
// Two answer verbs, chosen per-question via `gesture`:
//  - default (no `gesture`, or 'hold'): hold up 1/2/3 fingers to choose that
//    option (act-gate hold; the armed option glows/fills IN PLACE while you
//    hold — a right answer pops a spark burst, wrong shakes and lets you
//    retry). CONTENT RULE: a numeric answer option must sit on the button
//    whose number equals it (answer "3" on button 3).
//  - 'track': options DRIFT across the screen; catch the right one by
//    resting your fingertip on it for a beat ("chữ trôi trên màn hình, dùng
//    tay đuổi theo" — an explicit physical-tracking quiz verb). Like every
//    new gesture verb, this is a TWO-PHASE gate: ARM (hold ✋ steady so both
//    the student and the camera have an unambiguous "we're tracking now"
//    moment) then CAPTURE (chase a target) — see gesture-dispatcher.js.
//    While armed, the camera goes FULLSCREEN (dimmed, behind the drifting
//    chips + the fingertip dot) — the tiny chip alone doesn't read as "the
//    camera can see you" for a whole-screen chase (see .trackcam in node.css).
// Clicking stays as the fallback for both verbs.
import { QUIZ_HOLD_MS } from './constants.js';
import { sparkBurst } from './dom-scaffold.js';
import { armStatusHandler, armFingertipFx, armScreenFingertipDot, enterFullscreenCam, leaveFullscreenCam } from './gesture-ui.js';
import { registerBypass } from './bypass-registry.js';
import { renderProse } from './prose.js';

// trackPos(i, now) — pure function of (option index, timestamp) so the
// VISUAL position (rAF loop) and the HIT-TEST position (motion gate) never
// disagree: both call this with the same `now`, independently, and get the
// same answer. Normalized [0,1] — mapped to vw/vh, i.e. full-viewport space
// (matching the app's existing convention of treating mirrored camera
// coords as full-screen-normalized, see gesture-dispatcher.js's booth pour).
// Amplitude/period slowed 2026-07-04 (owner feedback: a laggy camera can't
// catch a fast chip) — was 0.28/0.09 amplitude, 1500/2100ms period.
const trackPos = (i, now) => ({
  x: 0.5 + 0.20 * Math.sin(now / 2200 + i * Math.PI),
  y: 0.62 + 0.06 * Math.cos(now / 2800 + i * 2),
});
const MAGNET_RADIUS = 0.22;   // normalized distance at which a drifting chip starts "noticing" the fingertip (juice only — wider than TRACK_CATCH_RADIUS so it reads as anticipation before the actual catch)

export function quizCell(c, { gestureDispatcher, cameraEngine, completeCell, onQuizCorrect, cameraFree = false }) {
  const el = document.createElement('div'); el.className = 'quizcell';
  const Q = c.quiz.questions; let qi = 0;
  el.innerHTML = `<div class="qhead">✦ ${c.quiz.title || 'QUIZ'}</div>
    <div class="qdots">${Q.map(() => '<i></i>').join('')}</div>
    <div class="qq"></div><div class="qopts"></div>
    <div class="qhint">${cameraFree ? 'Chạm vào đáp án đúng — bài này không dùng camera' : 'giơ đúng số ngón tay của đáp án — hoặc chạm'}</div>
    <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
    <div class="qdone gone">NHỚ CHUẨN RỒI ✦</div>`;
  let armed = false;               // el._arm's camera .ensure() has resolved (camera actually streaming)
  let revealed = false;            // BUG FIX: el._arm has fired at least once — gates whether track's
                                   // drifting .qtarget chips (body-level, outside this cell's hidden DOM)
                                   // are allowed to exist at all. Without this, a track question sitting
                                   // at qi=0 spawned its chips at CONSTRUCTION time (quizCell() runs eagerly
                                   // for every cell at page load, see notebook-runner.js#buildCells), so
                                   // students saw answer words flying around the page before ever reaching
                                   // this cell. Must be set (and the current question re-rendered) BEFORE
                                   // cameraEngine.ensure(), not inside its .then() — a no-camera student
                                   // still needs the chips to tap.
  let trackEls = [];                // this question's drifting .qtarget elements (if gesture:'track')
  let trackRaf = null;
  let bypassOff = null;              // current question's Space-cheat bypass (cheat mode only)
  let fxOff = null, screenDotOff = null; // fingertip-fx lifecycles (gesture-ui.js)
  let holdOk = false;                 // "is the currently-held count the right answer" — read by fxOff's chip glow
  const stopTrack = () => {
    if (trackRaf) cancelAnimationFrame(trackRaf); trackRaf = null;
    trackEls.forEach(t => t.remove()); trackEls = [];
    leaveTrackCam();
  };
  addEventListener('pagehide', stopTrack);  // page/node torn down mid-question → don't leak body-level chips or the fullscreen cam
  const show = () => {
    stopTrack();
    el.querySelector('.qq').innerHTML = renderProse(Q[qi].q);
    const host = el.querySelector('.qopts'); host.innerHTML = '';
    const hint = el.querySelector('.qhint');
    if (Q[qi].gesture === 'track') {
      hint.textContent = 'giơ ✋ để khoá tay, rồi DÙNG NGÓN TAY đuổi theo đáp án đúng!';
      if (revealed) {                       // ← the fix: never spawn body-level chips before reveal
        Q[qi].a.forEach((t, i) => {
          const d = document.createElement('div'); d.className = 'qtarget'; d.textContent = t;
          d.onclick = () => pick(d, i === Q[qi].correct);
          document.body.appendChild(d); trackEls.push(d);
        });
        const animate = () => { const now = performance.now();
          const tip = gestureDispatcher.lastFingertip;    // {x,y} normalized mirrored, or null — see gesture-dispatcher.js#lastFingertip
          trackEls.forEach((d, i) => { const p = trackPos(i, now); d.style.left = (p.x * 100) + 'vw'; d.style.top = (p.y * 100) + 'vh';
            // Magnetism juice: the nearer the fingertip drifts to a chip, the
            // more it glows/scales (CSS var --near, see node.css's `.qtarget`
            // magnetism block) — pure visual anticipation, no charge/hit-test
            // logic lives here (that's still armMultiTrackGate/TRACK_CATCH_RADIUS).
            const near = tip ? Math.max(0, 1 - Math.hypot(tip.x - p.x, tip.y - p.y) / MAGNET_RADIUS) : 0;
            d.style.setProperty('--near', near.toFixed(2)); d.classList.toggle('near', near > 0.15); });
          trackRaf = requestAnimationFrame(animate); };
        animate();
      }
    } else {
      hint.textContent = cameraFree ? 'Chạm vào đáp án đúng — bài này không dùng camera' : 'giơ đúng số ngón tay của đáp án — hoặc chạm';
      Q[qi].a.forEach((t, i) => {
        const b = document.createElement('button'); b.className = 'qopt';
        b.innerHTML = `<i class="qn">${i + 1}</i>${renderProse(t)}<b class="qfill"></b>`;
        b.onclick = () => pick(b, i === Q[qi].correct); host.appendChild(b);
      });
    }
    // Space-cheat bypass: registered here (NOT inside armCurrent/the camera-
    // gated arm functions below) so it resolves this question EVEN WITHOUT a
    // camera — a dev testing with no webcam must still be able to cheat past
    // a gesture question. Track's bypass only makes sense once its chips
    // actually exist (`revealed`); hold's buttons already exist right above.
    if (bypassOff) { bypassOff(); bypassOff = null; }
    if (Q[qi].gesture === 'track') {
      if (revealed) bypassOff = registerBypass('quiz track — đáp án đúng', () => { const t = trackEls[Q[qi].correct]; if (t) pick(t, true); });
    } else {
      bypassOff = registerBypass('quiz hold — đáp án đúng', () => { const btns = el.querySelectorAll('.qopt'); if (btns[Q[qi].correct]) pick(btns[Q[qi].correct], true); });
    }
    paintDots(); armCurrent();
  };
  const paintDots = () => el.querySelectorAll('.qdots i').forEach((d, i) => d.className = i < qi ? 'hit' : i === qi ? 'cur' : '');
  const pick = (btn, ok) => {
    if (!ok) { btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope'); return; }
    el.querySelectorAll('.qopt').forEach(b => b.disabled = true); btn.classList.add('yes');
    sparkBurst(el, btn); if (onQuizCorrect) onQuizCorrect();          // btn stays in place through the celebration —
    setTimeout(() => { stopTrack(); if (++qi < Q.length) show(); else fin(); }, 620); // only removed (if a drifting .qtarget) right before advancing
  };
  const fin = () => {
    qi = Q.length; paintDots(); stopTrack();
    if (bypassOff) { bypassOff(); bypassOff = null; }
    if (fxOff) { fxOff(); fxOff = null; } if (screenDotOff) { screenDotOff(); screenDotOff = null; }
    gestureDispatcher.disarmActGate(); gestureDispatcher.disarmMotionGate();
    el.querySelector('.bcam').classList.remove('on');
    // BUG FIX (owner: ugly empty line above "NHỚ CHUẨN RỒI ✦") — .qq clearing
    // its TEXT still left the element's own min-height/margin-bottom (28px +
    // 18px, node.css) as dead space above .qdone; .remove() both instead of
    // just wiping .qq's text, same as .qhint just below already did.
    el.querySelector('.qq').remove(); el.querySelector('.qopts').remove(); el.querySelector('.qhint').remove();
    el.querySelector('.qdone').classList.remove('gone');
    setTimeout(() => completeCell(el), 900);
  };
  // Re-armed every time show() loads a new question, since `gesture` can
  // differ question-to-question — only one dispatcher gate can be live at
  // once, so the previous one is always disarmed first (same for the bypass).
  const armCurrent = () => {
    if (!armed || el.classList.contains('done')) return;
    gestureDispatcher.disarmActGate(); gestureDispatcher.disarmMotionGate();
    const chip = el.querySelector('.bcam');
    if (Q[qi] && Q[qi].gesture === 'track') armTrackQuestion(chip); else armHoldQuestion(chip);
  };
  const armTrackQuestion = chip => {
    const fill = chip.querySelector('.bgauge i'), hint = el.querySelector('.qhint');
    enterTrackCam(cameraEngine);
    let captureP = 0; // last-seen CAPTURE-phase progress (0..1, whichever target's charge is nearest done) — feeds the screen-dot trail's "intensify while charging" fx
    if (!screenDotOff) screenDotOff = armScreenFingertipDot(gestureDispatcher, () => !el.classList.contains('done') && Q[qi] && Q[qi].gesture === 'track', () => captureP);
    const status = armStatusHandler(hint, fill, 'ĐÃ KHOÁ ✓ — đuổi theo đáp án đúng bằng ngón tay!');
    gestureDispatcher.armMultiTrackGate(cameraEngine, chip,
      () => { const now = performance.now(); return trackEls.map((_, i) => ({ key: i, ...trackPos(i, now) })); },
      () => !el.classList.contains('done') && Q[qi] && Q[qi].gesture === 'track',
      (phase, p) => { captureP = phase === 'capture' ? p : 0; status(phase, p); },
      key => { const t = trackEls[key]; if (t) pick(t, key === Q[qi].correct); });
  };
  // Armed when the cell is revealed (see revealNext): hold N fingers to arm
  // option N; the gauge + the option's own fill/glow charge together — the fx
  // stays on the button being chosen (--qp drives its scale + glow in CSS).
  const armHoldQuestion = chip => {
    const v = chip.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
    chip.classList.add('on');
    if (!fxOff) fxOff = armFingertipFx(gestureDispatcher, chip, () => holdOk);
    const fill = chip.querySelector('.bgauge i');
    let held = 0, target = -1, last = performance.now();
    gestureDispatcher.armActGate((count, has) => {
      const now = performance.now(), dt = Math.min(100, now - last); last = now;
      const btns = el.querySelectorAll('.qopt');
      if (!btns.length || (btns[0] && btns[0].disabled)) { held = 0; return; }  // between questions
      const idx = has && count >= 1 && count <= btns.length ? count - 1 : -1;
      holdOk = idx >= 0 && idx === Q[qi].correct;
      if (idx !== target) { target = idx; held = 0; } else if (idx >= 0) held += dt;
      const p = idx < 0 ? 0 : Math.min(1, held / QUIZ_HOLD_MS);
      btns.forEach((b, i) => { const on = i === idx; b.classList.toggle('arm', on);
        b.style.setProperty('--qp', on ? p : 0); b.querySelector('.qfill').style.width = (on ? p * 100 : 0) + '%'; });
      fill.style.width = p * 100 + '%';
      if (idx >= 0 && held >= QUIZ_HOLD_MS) { held = 0; pick(btns[idx], idx === Q[qi].correct); }
    });
  };
  el._arm = () => {
    if (el.classList.contains('done')) return;
    revealed = true; show();                            // re-render NOW (no-camera students still get track chips)
    if (cameraFree) return;
    cameraEngine.ensure().then(() => {
      if (el.classList.contains('done')) return;
      armed = true; armCurrent();
    }).catch(() => {});                                 // no camera → tap answers only
  };
  show();
  return el;
}

// ── fullscreen track camera — thin wrappers around gesture-ui.js's shared
// singleton helper (see .trackcam in node.css); the boss arena reuses the
// same helper under its own class name. ──
function enterTrackCam(cameraEngine) { enterFullscreenCam(cameraEngine, 'trackcam').catch(() => {}); } // no camera → chips stay tappable, no fullscreen layer
function leaveTrackCam() { leaveFullscreenCam('trackcam'); }
