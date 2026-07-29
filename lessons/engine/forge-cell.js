// forge-cell.js — {forge:{cost?, practice:[{q,a,correct}, …]}} THỢ RÈN
// (blacksmith) screen: forge `cost` badges (default DEFAULT_FORGE_COST) into
// a BOM MẬT NGỮ via a ✋-hold-to-strike anvil gate (armActHoldGate — fingertip
// fx automatic), tap fallback. A forge attempt is a GACHA roll (owner add-on
// — see constants.js's FORGE_SUCCESS_* + FORGE-PLAN.md):
//  - not enough unspent badges → informational "còn thiếu huy hiệu", never a
//    dead end — "bỏ qua" always completes the cell.
//  - FAIL ("rèn hụt") → badges are untouched (inventory.js#forgeBomb doesn't
//    spend on a failed roll); Pip cracks a playful (never scolding) joke and
//    ONE extra practice question appears from the node's own already-taught
//    vocabulary (c.forge.practice, same {q,a,correct} shape as a quiz
//    question). A WRONG practice answer just retries in place (never a dead
//    end); a CORRECT one raises the NEXT strike's odds by
//    FORGE_SUCCESS_BONUS_PER_PRACTICE (cumulative, capped in inventory.js at
//    FORGE_SUCCESS_CAP → a persistent kid is GUARANTEED to eventually forge).
//  - SUCCESS → spends the badges, +1 bomb, hammer-spark-flash beat, done.
// ADDITIVE per FORGE-PLAN.md: this cell never blocks the node — every path
// (skip / success / repeated fail-then-practice) eventually calls
// completeCell(el); a node with no forge cell at all plays identically.
import { FORGE_SUCCESS_BONUS_PER_PRACTICE, QUIZ_HOLD_MS } from './constants.js';
import { renderProse } from './prose.js';
import { inventory, DEFAULT_FORGE_COST } from './inventory.js';
import { sparkBurst } from './dom-scaffold.js';
import { registerBypass } from './bypass-registry.js';
import { armFingertipFx, HoldChoiceGate } from './gesture-ui.js';
import { sfx } from './sfx.js';
import { crestArtSrc } from './gift-cell.js';

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛉᛊᛏᛒᛖᛗᛚ';   // cổ ngữ glyph pool for the badge→anvil flight + rainbow shimmer

export function forgeCell(c, { gestureDispatcher, cameraEngine, completeCell, saveProgress }) {
  const cfg = c.forge || {};
  const cost = cfg.cost || DEFAULT_FORGE_COST;
  const practicePool = Array.isArray(cfg.practice) ? cfg.practice : [];
  // BOSS CONCEPT V2 (FORGE-PLAN.md "FINALIZED"): when `forge.quiz` is present
  // the forge is QUIZ-DRIVEN — answering the migrated boss questions IS the
  // trial that forges the bomb (no badge cost; the boss is pure gesture). A
  // forge WITHOUT `quiz` keeps the exact legacy badge-gacha behaviour.
  const quizPool = Array.isArray(cfg.quiz) ? cfg.quiz : [];
  const quizMode = quizPool.length > 0;
  let practiceIdx = 0, bonus = 0, finished = false, bypassOff = null, quizIdx = 0, quizDone = !quizMode;
  let choice = null, holdOk = false, fxOff = null, quizGateArmed = false; // quiz-mode gesture answering (HoldChoiceGate over armActGate, same verb as quiz-cell.js)

  const el = document.createElement('div'); el.className = 'forgecell';
  el.innerHTML = `
    <div class="forgehead">⚒ THỢ RÈN</div>
    <div class="forgeexplain">${quizMode
      ? 'Trả lời đúng các câu hỏi để nhóm lửa RÈN ra <b>BOM MẬT NGỮ</b> — vũ khí duy nhất phong ấn được BOSS phía sau!'
      : `Dùng <b>${cost} HUY HIỆU</b> đã thu thập để rèn 1 <b>BOM MẬT NGỮ</b> — mang bom đó vào trận đấu BOSS phía sau!`}</div>
    <div class="fshelf"></div>
    <div class="anvilwrap"><div class="forgefire"></div><div class="anvil"><img class="animg" src="assets/anvil-0.webp" alt=""><span class="aemoji">⚒️</span></div></div>
    <div class="forgestat"></div>
    <div class="forgehint">✋ giữ tay trên đe để RÈN — hoặc chạm vào đe</div>
    <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
    <div class="forgemsg"></div>
    <div class="forgebtns"><button class="fbtn fskip">bỏ qua</button></div>`;

  const stat = el.querySelector('.forgestat'), msg = el.querySelector('.forgemsg'), hint = el.querySelector('.forgehint');
  // setHeat(h) — 0..1 forge-fire ramp: each cleared quiz question stokes the
  // flame behind the anvil + the anvil's glow (see node.css --heat block), so
  // "trả lời đúng để nhóm lửa" is something the kid SEES, not just a counter.
  // The anvil ART itself levels up with the heat (owner: "hình búa rèn chia
  // cấp độ"): assets/anvil-0..3.webp = nguội → ấm → rực lửa → trắng loá,
  // preloaded so the swap never flickers; missing art → ⚒️ emoji fallback
  // (.noimg, see the onerror below).
  for (let i = 1; i < 4; i++) { const p = new Image(); p.src = `assets/anvil-${i}.webp`; }
  const anvilImg = el.querySelector('.animg');
  anvilImg.onerror = () => { el.querySelector('.anvil').classList.add('noimg'); anvilImg.remove(); };
  const setHeat = h => {
    el.style.setProperty('--heat', Math.min(1, h).toFixed(3));
    const img = el.querySelector('.animg'); if (!img) return;
    const lv = h >= 1 ? 3 : h >= .62 ? 2 : h >= .3 ? 1 : 0;
    const src = `assets/anvil-${lv}.webp`; if (!img.src.endsWith(src)) img.src = src;
  };
  // forgeHit(big) — the per-correct-answer SUCCESS BEAT ("độ thành công" —
  // owner feedback: heat alone read as an app, not a game): the fire FLARES
  // past its new level then settles (.fhit), the anvil clang-bounces, glowing
  // embers fountain up from it, a "+LỬA" popup rises, and the clang/whoosh
  // synth fires (sfx.js). big=true is the forge-success variant (boom).
  const emberBurst = (n = 14) => {
    const wrap = el.querySelector('.anvilwrap'), b = document.createElement('span'); b.className = 'femberburst';
    for (let i = 0; i < n; i++) { const s = document.createElement('i');
      s.style.setProperty('--dx', (Math.random() * 2 - 1) * 70 + 'px'); s.style.setProperty('--dy', -(40 + Math.random() * 90) + 'px');
      s.style.animationDelay = Math.random() * .12 + 's'; b.appendChild(s); }
    wrap.appendChild(b); setTimeout(() => b.remove(), 1100);
  };
  // paintShelf() — the collected-badge display (owner: "huy hiệu đã collect
  // đâu? phải cho có fx liệt kê ra"): every earned badge as its crest art,
  // staggered pop-in on first render; spent ones stay but burn out grey.
  const paintShelf = () => {
    const shelf = el.querySelector('.fshelf'); const first = !shelf.childElementCount;
    shelf.innerHTML = '';
    inventory.badges().forEach((b, i) => {
      const img = document.createElement('img'); img.className = 'fbadge' + (b.spent ? ' spent' : '');
      img.src = crestArtSrc(b.id); img.alt = '';
      if (first && !b.spent) img.style.animationDelay = (i * .12) + 's';
      img.onerror = () => img.remove();
      shelf.appendChild(img);
    });
  };
  // runeFly(fromEl) — cổ ngữ bay múa: a handful of glowing runes flutter
  // from `fromEl` (a shelf badge) along a curved path INTO the anvil (WAAPI,
  // compositor-smooth), feeding the forge as the badge is consumed.
  const runeFly = fromEl => {
    const a = el.querySelector('.anvil').getBoundingClientRect(), r = fromEl.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, x1 = a.left + a.width / 2, y1 = a.top + a.height / 2;
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span'); s.className = 'frune'; s.textContent = RUNES[Math.random() * RUNES.length | 0];
      s.style.left = x0 + 'px'; s.style.top = y0 + 'px'; document.body.appendChild(s);
      const mx = (x0 + x1) / 2 + (Math.random() - .5) * 150, my = Math.min(y0, y1) - 30 - Math.random() * 90;
      s.animate([
        { transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)', opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${mx - x0}px,${my - y0}px) scale(1.25) rotate(${(Math.random() - .5) * 260}deg)`, opacity: 1, offset: .55 },
        { transform: `translate(-50%,-50%) translate(${x1 - x0}px,${y1 - y0}px) scale(.35) rotate(${(Math.random() - .5) * 520}deg)`, opacity: 0 },
      ], { duration: 640 + Math.random() * 360, delay: i * 70 + Math.random() * 90, easing: 'cubic-bezier(.4,.1,.6,1)', fill: 'forwards' });
      setTimeout(() => s.remove(), 1500);
    }
  };
  // burnBadges() — the strike's fuel beat: consume up to `cost` collected
  // badges (never a gate — zero badges still forges, the quiz was the trial),
  // each spent badge sends its rune stream into the anvil then burns out grey.
  const burnBadges = () => {
    const shelfEls = [...el.querySelectorAll('.fshelf .fbadge:not(.spent)')].slice(0, cost);
    inventory.spendBadges(cost);
    shelfEls.forEach((b, i) => { runeFly(b); setTimeout(() => b.classList.add('spent'), 500 + i * 90); });
    if (!shelfEls.length) runeFly(el.querySelector('.anvilwrap'));   // no fuel on the shelf — runes rise from the forge itself
    sfx.whoosh();
  };
  // rainbowRunes() — when the BOM MẬT NGỮ appears the cổ ngữ come back OUT,
  // shimmering through the full spectrum (owner: "lấp lánh bảy sắc").
  const rainbowRunes = () => {
    const a = el.querySelector('.anvilwrap').getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2 - 26;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span'); s.className = 'frune rainbow'; s.textContent = RUNES[Math.random() * RUNES.length | 0];
      s.style.left = x0 + 'px'; s.style.top = y0 + 'px'; document.body.appendChild(s);
      const ang = (i / 12) * Math.PI * 2 + Math.random() * .5, d = 55 + Math.random() * 75;
      s.animate([
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d * .7}px) scale(1.2) rotate(${(Math.random() - .5) * 200}deg)`, opacity: 1, offset: .4 },
        { transform: `translate(-50%,-50%) translate(${Math.cos(ang) * d * 1.5}px,${Math.sin(ang) * d * .9 - 28}px) scale(.5)`, opacity: 0 },
      ], { duration: 1500 + Math.random() * 700, delay: i * 90, easing: 'ease-out', fill: 'forwards' });
      setTimeout(() => s.remove(), 2900);
    }
  };
  const forgeHit = big => {
    el.classList.remove('fhit'); void el.offsetWidth; el.classList.add('fhit');
    emberBurst(big ? 30 : 14);
    const pop = document.createElement('span'); pop.className = 'fpop'; pop.textContent = big ? 'BOM MẬT NGỮ ✦' : '+LỬA 🔥';
    el.querySelector('.anvilwrap').appendChild(pop); setTimeout(() => pop.remove(), 1000);
    if (big) { sfx.boom(); revealBomb(); } else { sfx.clang(); sfx.whoosh(); }
  };
  // revealBomb() — the forge-success ceremony: the actual BOM MẬT NGỮ
  // (assets/cipher-bomb.webp, the rune-bomb art) MATERIALIZES out of the
  // anvil — rises, hovers glowing — then DOCKS beside the anvil and STAYS
  // (owner: "rèn xong phải hiện luôn trái bom bên cạnh"), while the forge
  // cools back to a normal cold anvil (heat 0 — fire dies, anvil-0 art).
  const revealBomb = () => {
    const wrap = el.querySelector('.anvilwrap'), r = document.createElement('div'); r.className = 'bombreveal';
    const img = document.createElement('img'); img.src = 'assets/cipher-bomb.webp'; img.alt = '';
    img.onerror = () => r.replaceChildren(document.createTextNode('💣'));
    r.appendChild(img); wrap.appendChild(r);
    rainbowRunes();                                                     // cổ ngữ lấp lánh bảy sắc quanh trái bom mới sinh
    setTimeout(() => { r.classList.add('dock'); setHeat(0); }, 1250);   // the bomb settles in; the forge goes back to rest
  };
  const paintStat = () => {
    if (quizMode) { stat.innerHTML = quizPool.map((_, i) => `<i class="fpip${i < quizIdx ? ' lit' : ''}">🔥</i>`).join('')
      + `<span class="fbombs">· bom: ${inventory.bombCount()}</span>`; return; }
    const unspent = inventory.badgeCount({ unspentOnly: true });
    stat.textContent = `huy hiệu đang có: ${unspent} / ${cost} cần · bom mật ngữ đã rèn: ${inventory.bombCount()}`;
  };
  // quiz-mode: the anvil strike is only reachable once every question is
  // cleared (quizDone) — the quiz is the whole cost. legacy: `cost` badges.
  const canStrike = () => !finished && (quizMode ? quizDone : inventory.badgeCount({ unspentOnly: true }) >= cost);

  const finish = () => {
    if (finished) return; finished = true;
    if (bypassOff) { bypassOff(); bypassOff = null; }
    if (fxOff) { fxOff(); fxOff = null; }
    gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
    saveProgress({ forged: true });
    setTimeout(() => { el.classList.add('done'); completeCell(el); }, 900);
  };
  el.querySelector('.fskip').onclick = finish;
  el.querySelector('.anvil').onclick = () => { if (canStrike()) attemptForge(); };

  // startQuiz() — quiz-mode trial: walk the migrated boss questions one at a
  // time, answered GESTURE-FIRST (hold 1/2/3… fingers to charge option N —
  // same verb + .qopt charge fx as quiz-cell.js, via the shared
  // HoldChoiceGate; tap stays the fallback). A correct answer advances AND
  // stokes the forge fire (setHeat); a wrong one just shakes and stays
  // (retry in place — never a dead end, and the repetition IS the practice).
  // Clearing the last question sets quizDone → the anvil strike opens
  // (armStrike) so the ✋-forge is the satisfying climax on a white-hot fire.
  function startQuiz() {
    if (finished) return;
    if (quizIdx >= quizPool.length) { quizDone = true; setHeat(1); stopQuizGesture(); paintStat(); armStrike(); return; }
    paintStat(); setHeat(quizIdx / quizPool.length);
    hint.classList.remove('gone'); hint.textContent = 'giơ 1️⃣ 2️⃣ 3️⃣… ngón tay để chọn đáp án — hoặc chạm';
    const q = quizPool[quizIdx];
    msg.innerHTML = `<div class="fpractice"><div class="fpq">${renderProse(q.q)}</div><div class="fpopts qopts"></div></div>`;
    const opts = msg.querySelector('.fpopts');
    q.a.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'qopt';
      b.innerHTML = `<i class="qn">${i + 1}</i>${renderProse(t)}<b class="qfill"></b>`;
      b.onclick = () => pickQ(b, i); opts.appendChild(b);
    });
    choice = new HoldChoiceGate(q.a.length, q.correct, QUIZ_HOLD_MS);
    if (bypassOff) bypassOff();
    bypassOff = registerBypass('rèn quiz — đáp án đúng', () => { const btns = msg.querySelectorAll('.qopt'); if (btns[q.correct]) pickQ(btns[q.correct], q.correct); });
    armQuizGesture();
  }

  // pickQ(b, i) — shared resolve path for tap AND gesture picks on the forge
  // quiz: correct → sparks + heat bump + next question; wrong → shake, stay.
  function pickQ(b, i) {
    const q = quizPool[quizIdx]; if (!q || finished) return;
    if (i !== q.correct) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); sfx.thud(); return; }
    msg.querySelectorAll('.qopt').forEach(x => x.disabled = true);
    b.classList.add('yes'); quizIdx++;
    // beat order matters (owner: "bay sau lúc cộng điểm" was backwards):
    // 1) the answer flies INTO the forge first… 2) only when it ARRIVES does
    // the reward land — pip lights, heat bumps, fire flares, clang. Cause→effect.
    flyToAnvil(b);
    setTimeout(() => { paintStat(); setHeat(quizIdx / quizPool.length); forgeHit(false); }, 430);
    setTimeout(() => { msg.innerHTML = ''; startQuiz(); }, 1050);
  }

  // flyToAnvil(btn) — owner spec: "trả lời đúng thì có fx câu trả lời bay về
  // rèn" — a glowing copy of the picked answer arcs from the button INTO the
  // anvil fire, so cause (answer) → effect (hotter fire) is one visible line.
  // v3 (owner: v2 DOM streaks "còn giật"): the flyer moves on the COMPOSITOR
  // (transform transition, not left/top), and the comet tail is a single
  // CANVAS polyline — points sampled per frame, drawn additively with a
  // fading width/alpha by age — zero per-frame DOM churn, so no jank.
  function flyToAnvil(btn) {
    const a = el.querySelector('.anvil').getBoundingClientRect(), r = btn.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, x1 = a.left + a.width / 2, y1 = a.top + a.height / 2;
    const f = document.createElement('div'); f.className = 'fanswerfly'; f.textContent = btn.textContent.replace(/^\d+/, '');  // strip the .qn number chip
    f.style.left = x0 + 'px'; f.style.top = y0 + 'px';
    document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transform = `translate(-50%,-50%) translate(${x1 - x0}px,${y1 - y0}px) scale(.3)`; f.classList.add('go');
    }));
    const cv = document.createElement('canvas'); cv.className = 'ftrailcv';
    cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); const pts = []; const LIFE = 380;
    let flying = true;
    const step = () => {
      const now = performance.now();
      if (flying) { const p = f.getBoundingClientRect(); pts.push({ x: p.left + p.width / 2, y: p.top + p.height / 2, t: now }); }
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const k = 1 - (now - pts[i].t) / LIFE;                          // 1 = fresh (head), 0 = dying (tail tip)
        ctx.strokeStyle = `rgba(255,${(150 + 90 * k) | 0},${(60 + 120 * k) | 0},${(.85 * k).toFixed(3)})`;
        ctx.lineWidth = 1.5 + 6.5 * k;
        ctx.shadowColor = 'rgba(214,154,32,.8)'; ctx.shadowBlur = 14 * k;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      if (flying || pts.length > 1) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
    setTimeout(() => { flying = false; f.remove(); }, 620);
  }

  // armQuizGesture() — one act-gate for the whole quiz run (each question
  // swaps in a fresh HoldChoiceGate); the armed option charges in place
  // (.arm + --qp + .qfill, exactly quiz-cell's fx) and the camera chip's
  // gauge mirrors the charge. No camera → tap answers keep working.
  function armQuizGesture() {
    if (quizGateArmed || finished) return; quizGateArmed = true;
    const chip = el.querySelector('.bcam');
    cameraEngine.ensure().then(() => {
      if (finished || quizDone) return;
      const v = chip.querySelector('video'); v.srcObject = cameraEngine.stream; v.play().catch(() => {});
      chip.classList.add('on');
      const fill = chip.querySelector('.bgauge i');
      if (!fxOff) fxOff = armFingertipFx(gestureDispatcher, chip, () => holdOk);
      gestureDispatcher.armActGate((count, has) => {
        if (finished || quizDone || !choice) return;
        const btns = msg.querySelectorAll('.qopt');
        if (!btns.length || btns[0].disabled) { holdOk = false; return; } // between questions
        const q = quizPool[quizIdx];
        const r = choice.step(performance.now(), count, has);
        const idx = choice.target, p = choice.progress;
        holdOk = idx >= 0 && idx === q.correct;
        btns.forEach((b, i) => { const on = i === idx; b.classList.toggle('arm', on);
          b.style.setProperty('--qp', on ? p : 0); b.querySelector('.qfill').style.width = (on ? p * 100 : 0) + '%'; });
        fill.style.width = p * 100 + '%';
        if (r && btns[r.idx]) pickQ(btns[r.idx], r.idx);
      });
    }).catch(() => {});                                 // no camera → tap answers only
  }

  // stopQuizGesture() — release the quiz's act gate + fingertip fx + chip so
  // armStrike (✋ hold) can arm its own gate cleanly on the same chip.
  function stopQuizGesture() {
    if (fxOff) { fxOff(); fxOff = null; }
    holdOk = false; gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
  }

  // showPractice() — one question from the node's practice pool (cycling if
  // exhausted — repetition is fine, the goal is another rep, not novelty).
  // No practice content authored for this node → straight back to the anvil
  // (never trap the retry loop on missing content).
  function showPractice() {
    if (!practicePool.length) { armStrike(); return; }
    const q = practicePool[practiceIdx % practicePool.length];
    msg.innerHTML = `<div class="fpractice"><div class="fpq">${renderProse(q.q)}</div><div class="fpopts"></div></div>`;
    const opts = msg.querySelector('.fpopts');
    q.a.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'fpopt'; b.innerHTML = renderProse(t);
      b.onclick = () => {
        if (i === q.correct) {
          b.classList.add('yes'); sparkBurst(el, b);
          bonus += FORGE_SUCCESS_BONUS_PER_PRACTICE; practiceIdx++;
          setTimeout(() => { msg.innerHTML = ''; armStrike(); }, 550);
        } else { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); } // wrong → stays put, try again
      };
      opts.appendChild(b);
    });
  }

  function attemptForge() {
    el.classList.remove('striking'); el.style.setProperty('--strikep', 0);
    if (quizMode) {   // quiz was the whole trial → forging is GUARANTEED (badges are consumed as fuel if on hand, never required)
      gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
      if (bypassOff) { bypassOff(); bypassOff = null; }
      hint.classList.add('gone');
      burnBadges();                                     // beat 1: the collected badges send their cổ ngữ streams into the anvil…
      setTimeout(() => {                                // beat 2: …the runes land → the forge BLOWS and the bomb is born
        inventory.addBomb(); paintStat();
        sparkBurst(el, el.querySelector('.anvil'), 26); el.classList.add('forged'); forgeHit(true);
        msg.textContent = '✦ RÈN THÀNH CÔNG! +1 BOM MẬT NGỮ ✦';
      }, 750);
      setTimeout(finish, 3100); return;   // long enough for rune flight + bomb reveal + dock to play out
    }
    const r = inventory.forgeBomb(cost, { bonus });
    paintStat();
    if (!r.ok) { msg.textContent = 'còn thiếu huy hiệu — không sao, học tiếp rồi quay lại rèn sau nhé!'; return; }
    if (r.success) {
      paintShelf();                                     // forgeBomb spent the badges — burn them out on the shelf
      sparkBurst(el, el.querySelector('.anvil'), 26); el.classList.add('forged'); forgeHit(true);
      msg.textContent = '✦ RÈN THÀNH CÔNG! +1 BOM MẬT NGỮ ✦'; hint.classList.add('gone');
      gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
      if (bypassOff) { bypassOff(); bypassOff = null; }
      setTimeout(finish, 2300);
    } else {
      bonus = 0; // rèn hụt resets THIS attempt's bonus — the next practice cleared re-earns it (keeps the curve legible, still guarantees eventually)
      msg.innerHTML = `<div class="ffail">Ối, lửa chưa đủ nóng — rèn hụt rồi! Làm thêm một bài cho tay quen đã nào 😄</div>`;
      setTimeout(showPractice, 900);
    }
  }

  function armStrike() {
    if (finished) return;
    if (quizMode && !quizDone) { startQuiz(); return; }  // quiz-mode: run the trial first; the anvil opens only once every question is cleared
    if (!canStrike()) { paintStat(); msg.textContent = 'còn thiếu huy hiệu — không sao, cứ học tiếp rồi quay lại rèn sau!'; return; }
    msg.innerHTML = '';
    if (quizMode) { hint.classList.remove('gone'); hint.textContent = '🔥 lửa đã RỰC — ✋ giữ tay trên đe để RÈN!'; }  // fire's hot enough now — the ✋ strike is the climax
    const chip = el.querySelector('.bcam');
    if (bypassOff) bypassOff();
    bypassOff = registerBypass('rèn bom — strike', () => attemptForge());
    // --strikep drives the live strike fx (anvil swell/glow + .striking shake,
    // see node.css) — the hold must FEEL like winding up a hammer blow.
    gestureDispatcher.armActHoldGate(cameraEngine, chip, 5, () => !finished,
      p => { el.style.setProperty('--strikep', p.toFixed(3)); el.classList.toggle('striking', p > .05); },
      () => attemptForge());
  }

  el._arm = () => { paintStat(); paintShelf(); armStrike(); };
  return el;
}
