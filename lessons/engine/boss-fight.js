// boss-fight.js — two boss shapes, picked by {boss:...}'s own fields:
//
// 1. LEGACY round-HP model — {boss:{name,art|glyph,hp,baseDmg,streakMul,heal,
//    hearts,rounds}}. The node's GATE: loot and the seal are won, not given.
//    Rounds are ATTACK TURNS — a right answer (fingers/tap) or a clean code
//    run lands a hit, and consecutive hits multiply (streak). A wrong answer
//    / crashed run HEALS the boss, breaks the streak and costs a heart; all
//    hearts gone → the boss taunts and fully heals (soft fail, no lockout —
//    mastery is the only way through). Missed questions rotate back into the
//    pool; broken-code rounds stay until healed. HP 0 → it staggers: ✋
//    high-five (or tap) lands the killing blow. ENDGAME REFRAME (owner
//    2026-07-04, FORGE-PLAN.md): rounds grind hp down to EXPOSED (≤
//    BOSS_EXPOSE_HP_FRAC of max, see #checkExposed) — from there a forged
//    BOM MẬT NGỮ deploy is a GUARANTEED kill (the narrative + mechanical
//    finisher, #deployBomb), pulsing `.bbomb.examine` to pitch it. A normal
//    STRIKE still finishes the boss too (unchanged math) — a kid with zero
//    bombs is never blocked from victory, the bomb is just the cooler ending.
//    KEPT UNCHANGED for nodes 03-07 — do not regress this path.
//
// 2. BOSS CONCEPT V2 gesture-only 1-hit KO — {boss:{name,art|glyph,ko:true}},
//    no `rounds` (FORGE-PLAN.md "FINALIZED (owner, 2026-07-05)"). ZERO
//    quiz/code rounds: all the learning already happened in the node's THỢ
//    RÈN forge cell (see forge-cell.js's `forge.quiz`). The boss encounter is
//    pure ceremony — gated on inventory.bombCount()>0 (else a "go forge one"
//    prompt, never a true dead end), then hold ☝ (1 finger) to AIM/lock, then
//    ✋ (5) to UNLEASH the forged BOM MẬT NGỮ → spendBomb() → detonation FX →
//    stagger → the shared victory()/phong-ấn seal. See #buildKoDom/#armGateKo.
import { STATS_KEY, QUIZ_HOLD_MS, ACT_HOLD_MS, QUIZ_BOSS_BONUS_PER, QUIZ_BOSS_BONUS_CAP, FORGE_BOMB_DAMAGE, BOSS_EXPOSE_HP_FRAC } from './constants.js';
import { sparkBurst } from './dom-scaffold.js';
import { armStatusHandler, armFingertipFx, flashSlash } from './gesture-ui.js';
import { GESTURE_VERB_NAMES } from './gesture-registry.js';
import { registerBypass } from './bypass-registry.js';
import { inventory } from './inventory.js';
import { renderProse } from './prose.js';
import { sfx } from './sfx.js';

const FRAME = { idle: 0, hit: 1, heal: 2, stagger: 3 };

// injectBossCss() — self-contained styling for the `.bnobomb` forge→boss
// legibility hint (owner: "sao không thấy dùng huy hiệu để rèn đánh boss").
// node.css is owned elsewhere, so this stays a JS-injected style, guarded so
// re-mounting a boss cell never duplicates the tag (same pattern as
// gift-cell.js's #badgecss).
function injectBossCss() {
  if (document.getElementById('bosscss')) return;
  const s = document.createElement('style'); s.id = 'bosscss';
  s.textContent = `.bnobomb{font-size:.8rem;opacity:.9;color:#4f6f73;margin:2px 0 4px}.bnobomb.gone{display:none}
.konobomb{font-size:1rem;text-align:center;color:#533b00;background:#fffdf5;border:1px solid #d69a20;border-radius:14px;padding:10px 14px;margin:16px auto;max-width:32em;line-height:1.5}.konobomb.gone{display:none}
.konobomb .kobackforge{display:inline-block;margin-top:10px;padding:8px 18px;border-radius:8px;border:1px solid #4f6f73;background:#fde7e5;color:#183f49;font-size:.95rem;cursor:pointer}
.kostate{font-size:1.3rem;text-align:center;color:#533b00;margin:14px 0;min-height:1.6em}
.bosscell.pvx .bcam video{filter:brightness(.5) saturate(.7)}
.bossface.koaiming{animation:koaim 1.6s ease-in-out infinite}
@keyframes koaim{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
.bossface.kosealing{animation:koseal .95s cubic-bezier(.6,-.35,.72,.2) forwards}
@keyframes koseal{0%{transform:scale(1) rotate(0);filter:none}26%{transform:scale(1.14) rotate(-7deg);filter:brightness(1.6)}100%{transform:scale(.16) rotate(230deg);opacity:.1;filter:brightness(2.6) hue-rotate(45deg)}}
/* KO composition: the boss sits DEAD-CENTRE on the vortex funnel (cy .46) so
   the charge/seal happen ON it, not in empty space beside a static picture
   (owner: "boss giống để cái hình xong mình làm khùng làm điên"). The holder
   reacts to charge (--rc, set by #setKoCharge): swells, glows the spell colour,
   and shakes harder as the funnel winds up — the boss is being overwhelmed. */
.bosscell.komode .barenain{justify-content:flex-start}
.bosscell.komode .bhead{margin:4.5vh auto 0;text-align:center;width:100%}
.bosscell.komode .kobossholder{position:fixed;left:50%;top:46%;z-index:3;pointer-events:none;transform:translate(-50%,-50%) scale(calc(1 + var(--rc,0)*.16 - var(--ru,0)*.4));filter:drop-shadow(0 0 calc(6px + var(--rc,0)*46px) var(--c)) brightness(calc(1 + var(--rc,0)*.55)) saturate(calc(1 + var(--rc,0)*.6));transition:transform .08s linear,filter .12s linear}
.bosscell.komode .kobossholder .bossface{width:min(48vw,300px);height:min(48vw,300px);margin:0}
.bosscell.komode .kobossholder.shaking{animation:koshake .1s infinite}
@keyframes koshake{0%,100%{margin:0}20%{margin-left:calc(var(--rc,0)*-9px)}40%{margin-left:calc(var(--rc,0)*7px)}60%{margin-left:calc(var(--rc,0)*-6px)}80%{margin-left:calc(var(--rc,0)*8px)}}
/* KO choreography V3 (owner spec): AIM summons the BOM MẬT NGỮ on stage
   (.kobombhover, bottom-centre, scales/glows with --rc); UNLEASH makes it
   RUMBLE (--ru = unleash-phase progress, margin-shake on the img so it never
   fights the scale transform) while the boss SHRINKS in fear (holder calc
   above); detonation = blinding .koflash + the bomb launches (.launch) +
   fire/ice .kosweep columns racing up INTO the boss. */
.kobombhover{position:fixed;left:50%;top:68%;z-index:4;pointer-events:none;transform:translate(-50%,-50%) scale(calc(.7 + .45*var(--rc,0)));filter:drop-shadow(0 0 calc(10px + 34px*var(--rc,0)) #78b2a5) drop-shadow(0 0 calc(18px*var(--ru,0)) #78b2a5);transition:filter .12s linear}
.kobombhover img{width:min(18vw,104px);height:min(18vw,104px);object-fit:contain;display:block;animation:kobombIn .5s ease-out}
.kobombhover.rumbling img{animation:kobombIn .5s ease-out,kobrumble .08s infinite}
@keyframes kobombIn{0%{opacity:0;margin-top:26px}100%{opacity:1;margin-top:0}}
@keyframes kobrumble{0%,100%{margin-left:0}25%{margin-left:calc(var(--ru,0)*-10px)}50%{margin-left:calc(var(--ru,0)*8px)}75%{margin-left:calc(var(--ru,0)*-7px)}}
.kobombhover.launch{transition:top .26s cubic-bezier(.5,0,1,1),transform .26s;top:46%;transform:translate(-50%,-50%) scale(.9) rotate(220deg)}
.koflash{position:fixed;inset:0;z-index:47;pointer-events:none;background:radial-gradient(circle at 50% 46%,#fffdf5,rgba(255,253,245,.85) 30%,transparent 78%);animation:koflashA .5s ease-out forwards}
@keyframes koflashA{0%{opacity:0}16%{opacity:1}100%{opacity:0}}
.kosweep{position:fixed;left:50%;bottom:0;width:44vw;height:66vh;z-index:44;pointer-events:none;transform-origin:50% 100%;filter:blur(9px);opacity:0;animation:kosweepUp .6s ease-in forwards}
.kosweep.fire{--kx:-62%;--kr:-7deg;background:linear-gradient(to top,rgba(214,154,32,.7),rgba(244,200,90,.38) 45%,transparent 80%)}
.kosweep.ice{--kx:-38%;--kr:7deg;background:linear-gradient(to top,rgba(120,178,165,.65),rgba(217,238,229,.32) 45%,transparent 80%);animation-delay:.09s}
@keyframes kosweepUp{0%{opacity:0;transform:translateX(var(--kx)) rotate(var(--kr)) scaleY(.15)}30%{opacity:1}100%{opacity:0;transform:translateX(var(--kx)) rotate(var(--kr)) translateY(-42vh) scaleY(1.12)}}
.bosscell.komode .kostate{position:fixed;left:0;right:0;bottom:15vh;z-index:3;margin:0}
.bosscell.komode .qhint{position:fixed;left:0;right:0;bottom:10vh;z-index:3}
.bosscell.komode .konobomb{position:fixed;left:50%;top:54%;transform:translateX(-50%);z-index:4;width:min(90vw,32em);margin:0}`;
  document.head.appendChild(s);
}

export class BossFight {
  #B; #el; #nodeIndex; #onSaveProgress; #onComplete; #ensureMonaco; #mountEditor; #runCell; #getQuizBonus; #workerUp;
  #hp; #hearts; #streak = 0; #best = 0; #score = 0; #phase = 'fight'; #busy = false; #pool; #firstStrike = true;
  #gd = null; #cam = null; // gestureDispatcher/cameraEngine, stored by armGate() so #nextRound() can re-arm per round
  #bypassOff = null; #fxOff = null; #holdOk = false; // Space-cheat bypass + fingertip-fx lifecycles, re-armed per round
  #bombUsed = false; // BOM MẬT NGỮ deploy is debounced to one-per-round — reset in #nextRound
  #exposed = false; #bombKill = false; // low-HP finisher state + whether the kill blow was the bomb (victory() banner text)
  #ko = false; #koPhase = 'nobomb'; // BOSS CONCEPT V2 (FORGE-PLAN.md "FINALIZED" section): boss.ko===true skips the whole round-HP model
  #koPoll = null; #loadVortex = null; #vfx = null; #koVortexLoading = false; #koCharge = 0; // ko-mode: the shared ritual particle vortex (ritual-vortex.js), mounted over the arena so aim/detonate feel like the ritual instead of a static image
  constructor(B, el, { nodeIndex, onComplete, onSaveProgress, ensureMonaco, mountEditor, runCell, getQuizBonus, workerUp, loadVortex }) {
    this.#B = B; this.#el = el; this.#nodeIndex = nodeIndex;
    this.#onComplete = onComplete; this.#onSaveProgress = onSaveProgress;
    this.#ensureMonaco = ensureMonaco; this.#mountEditor = mountEditor; this.#runCell = runCell; this.#getQuizBonus = getQuizBonus;
    this.#workerUp = workerUp; this.#loadVortex = loadVortex || (() => Promise.resolve());
    if (B.ko) { this.#ko = true; this.#buildKoDom(); return; } // gesture-only 1-hit KO ritual — see #buildKoDom/#armGateKo below
    this.#hp = B.hp; this.#hearts = B.hearts || 3; this.#pool = [...B.rounds];
    this.#buildDom();
    this.#paint(); this.#nextRound();
  }
  get snapshot() { return { hp: this.#hp, hearts: this.#hearts, streak: this.#streak, score: this.#score }; }
  #mul(s) { const MUL = this.#B.streakMul || [1, 1.5, 2]; return MUL[Math.min(Math.max(s - 1, 0), MUL.length - 1)]; }

  #buildDom() {
    const B = this.#B, el = this.#el;
    // `.bosscell` was previously never actually applied (a latent bug — every
    // rule scoped under it, e.g. the container background, was dead CSS); it
    // now carries the whole fullscreen-arena layout below, so it MUST be set.
    el.classList.add('bosscell'); injectBossCss();
    // Face options: {sheet:{src}} = 4-frame spritesheet rendered as TWO stacked
    // layers — `.base` always holds the idle frame, `.pose` cross-dissolves a
    // state frame (heal/stagger) IN over it (smooth, not a hard --bf swap; owner
    // "đừng giật"). {poses:{idle,hit,heal,stagger}} = separate images · {art} =
    // one image · glyph fallback. Idle motion itself is pure CSS transforms
    // (float/breathe/sway/glow) on the art element — see node.css .bossface.
    const face = B.sheet ? `<div class="bsheet base" style="background-image:url('${B.sheet.src}')"></div><div class="bsheet pose" style="background-image:url('${B.sheet.src}')"></div>`
      : B.art ? `<img src="${B.art}" alt="">` : `<div class="gglyph">${B.glyph || '👾'}</div>`;
    // FULLSCREEN ARENA layout (owner playtest: boss must take over the screen
    // like the ritual does — see .bosscell in node.css). `.bcam` is the FIRST
    // child so it paints BEHIND everything else (it's `.bosscell`'s own
    // fullscreen fixed camera layer now, not a small chip) — `.barenain`
    // wraps the readable content at a higher z-index, same
    // camera-behind/content-above convention ritual-controller.js's
    // #rcam/.actin split already uses. Same DOM node throughout (`el` itself
    // IS the fullscreen overlay via CSS, no second element to mount/suspend) —
    // .bosscell.done reverts it to an in-flow card after victory.
    el.innerHTML = `
      <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
      <div class="barenain">
        <div class="btop">
          <div class="bhead">⚔ BOSS · ${B.name}</div>
          <div class="bwands gone"></div>
          <button class="bbomb gone" title="ném BOM MẬT NGỮ — đòn lớn, mỗi vòng dùng 1 lần"></button>
          <div class="bnobomb gone">⚒ chưa có BOM — quay lại THỢ RÈN để rèn từ huy hiệu đã thu thập!</div>
          <div class="bossface">${face}</div>
          <div class="bhpwrap">
            <div class="bhp"><i></i><span></span></div>
            <div class="bmeta"><span class="bhearts"></span><span class="bstreak"></span><span class="bscore"></span></div>
          </div>
        </div>
        <div class="bexposed gone"></div>
        <div class="bround"></div>
        <div class="qhint">ra đòn bằng ngón tay — hoặc chạm</div>
        <div class="bwin gone"></div>
      </div>`;
    el.querySelector('.bbomb').onclick = () => this.deployBomb();
  }
  // GẬY PHÉP display RETIRED (owner 2026-07-05: "concept gậy phép bị thừa" —
  // superseded by the badge/bomb economy). The silent quiz-prep first-strike
  // bonus (#getQuizBonus in strike()) is kept; only the wand UI is gone.
  #refreshWandBadge() { const badge = this.#el.querySelector('.bwands'); if (badge) badge.classList.add('gone'); }
  // THỢ RÈN bomb deploy (FORGE-PLAN.md "bùm chéo") — ADDITIVE ONLY: no bombs
  // in inventory → the button stays hidden and the boss is unchanged from
  // before this feature existed. Re-checked every round (a bomb forged
  // mid-fight, e.g. via a dev hook, should surface immediately) and after
  // every deploy (spending one may drop the count to 0).
  #refreshBombBadge() {
    const btn = this.#el.querySelector('.bbomb'), noBomb = this.#el.querySelector('.bnobomb');
    if (!btn) return;
    const n = inventory.bombCount();
    if (n > 0 && !this.#bombUsed && this.#phase === 'fight') {
      btn.textContent = `💣 BOM MẬT NGỮ ×${n}`; btn.classList.remove('gone'); btn.disabled = false;
      btn.classList.toggle('examine', this.#exposed); // pulse it once the boss is the EXPOSED finisher target
      if (noBomb) noBomb.classList.add('gone');
    } else {
      btn.classList.add('gone');
      // forge→boss legibility (FORGE-PLAN.md): while there's genuinely no bomb
      // to show, point back at the forge instead of just silently hiding the
      // button — a kid should be able to SEE where bombs come from.
      if (noBomb) noBomb.classList.toggle('gone', !(n === 0 && this.#phase === 'fight'));
    }
  }
  // checkExposed() — called from #paint() after every hp change. Crossing
  // DOWN through BOSS_EXPOSE_HP_FRAC flips the fight into "finisher pitch"
  // mode: banner + pulsing bomb button (owner: "cuối cùng boss tan tành
  // bằng BOM MẬT NGỮ"). Healing back above the line (wound()) un-pitches it —
  // still just a nudge, rounds/strike work exactly the same either way.
  #checkExposed() {
    const threshold = this.#B.hp * BOSS_EXPOSE_HP_FRAC;
    const banner = this.#el.querySelector('.bexposed');
    if (!this.#exposed && this.#hp > 0 && this.#hp <= threshold && this.#phase === 'fight') {
      this.#exposed = true;
      if (banner) { banner.classList.remove('gone');
        banner.textContent = inventory.bombCount() > 0
          ? '⚠ BOSS ĐÃ LỘ SƠ HỞ — ném 💣 BOM MẬT NGỮ để KẾT LIỄU!'
          : '⚠ BOSS ĐÃ LỘ SƠ HỞ — dứt điểm bằng đòn tiếp theo, hoặc rèn BOM để hạ gọn hơn!'; }
      this.#refreshBombBadge();
    } else if (this.#exposed && (this.#hp > threshold || this.#phase !== 'fight')) {
      this.#exposed = false;
      if (banner) banner.classList.add('gone');
      this.#refreshBombBadge();
    }
  }
  // deployBomb() — spends one bomb → a large flat HP chunk (FORGE_BOMB_DAMAGE,
  // constants.js) + a diagonal "bùm chéo" sweep (CSS-only streak, see
  // node.css's THỢ RÈN block) layered on the existing hit flash/shake/spark
  // FX. Debounced to one per round (#bombUsed, reset in #nextRound) so it
  // can't be spammed to trivialize every round; never touches expectOut
  // gating or the round's own resolution — it's a bonus strike alongside it.
  deployBomb() {
    if (this.#bombUsed || this.#phase !== 'fight' || !inventory.spendBomb()) return;
    this.#bombUsed = true; this.#refreshBombBadge();
    this.#el.classList.remove('bombsweep'); void this.#el.offsetWidth; this.#el.classList.add('bombsweep');
    setTimeout(() => this.#el.classList.remove('bombsweep'), 520); // one-shot streak — CSS animation alone doesn't un-paint the ::before, must remove the class or it stays lit
    sparkBurst(this.#el, this.#face(), 30); this.#flash('hit');
    // EXPOSED = the bomb is the finisher: a guaranteed kill regardless of
    // leftover HP, not just another flat chunk — the mechanical payoff of
    // "boss tan tành bằng BOM MẬT NGỮ" (owner). Outside EXPOSED it's still
    // the normal flat-damage bonus strike it always was.
    const wasExposed = this.#exposed;
    if (wasExposed) { this.#hp = 0; this.#bombKill = true; this.#floatText('💥 KẾT LIỄU!', 'dmg bombdmg'); }
    else { this.#hp -= FORGE_BOMB_DAMAGE; this.#floatText('-' + FORGE_BOMB_DAMAGE + ' 💣', 'dmg bombdmg'); }
    this.#paint();
    setTimeout(() => { if (this.#hp <= 0 && this.#phase === 'fight') this.stagger(); }, 500);
  }
  #face() { return this.#el.querySelector('.bossface'); }
  #paint() {
    if (this.#ko) return; // ko-mode DOM has no hp/hearts/streak/score — see #armGateKo/#detonate instead
    const el = this.#el, B = this.#B;
    el.querySelector('.bhp i').style.width = Math.max(0, this.#hp) / B.hp * 100 + '%';
    el.querySelector('.bhp span').textContent = Math.max(0, this.#hp) + ' / ' + B.hp;
    el.querySelector('.bhearts').textContent = '♥'.repeat(this.#hearts) + '♡'.repeat((B.hearts || 3) - this.#hearts);
    el.querySelector('.bstreak').textContent = this.#streak > 1 ? `🔥 streak ×${this.#mul(this.#streak)}` : '';
    el.querySelector('.bscore').textContent = 'điểm ' + this.#score;
    this.#checkExposed();
    this.#onSaveProgress({ boss: this.snapshot });
  }
  #floatText(txt, cls) {
    const f = document.createElement('b'); f.className = 'bfloat ' + cls; f.textContent = txt;
    this.#face().appendChild(f); setTimeout(() => f.remove(), 1100);
  }
  #poseTimer = 0; #flashTimer = 0;
  // Cross-dissolve a state frame IN on the `.pose` overlay instead of hard-
  // swapping the single sheet's --bf (that snap read as choppy — owner "giật").
  // idle/hit hide the overlay (hit is a pure transform recoil, no frame);
  // heal/stagger fade their frame in over the always-idle `.base` layer.
  #setPose(p) {
    const bface = this.#face(), B = this.#B;
    if (B.sheet) {
      const pose = bface.querySelector('.bsheet.pose'); if (!pose) return;
      if (p === 'idle' || p === 'hit') pose.classList.remove('show');
      else { pose.style.setProperty('--bf', FRAME[p] ?? 0); pose.classList.add('show'); }
    } else if (B.poses && B.poses[p]) { const img = bface.querySelector('img'); if (img) img.src = B.poses[p]; }
  }
  #pulsePose(p) { this.#setPose(p); clearTimeout(this.#poseTimer); this.#poseTimer = setTimeout(() => { if (this.#phase === 'fight') this.#setPose('idle'); }, 750); }
  // Reaction classes must be TRANSIENT: .hit/.heal run an animation on .bossface
  // that overrides the (child) idle for its duration, so leaving the class on
  // would freeze the boss after the first hit. Strip it once the beat ends.
  #flash(cls) { const bface = this.#face(); bface.classList.remove(cls); void bface.offsetWidth; bface.classList.add(cls);
    clearTimeout(this.#flashTimer); this.#flashTimer = setTimeout(() => bface.classList.remove(cls), 850);
    if (cls === 'heal') this.#pulsePose('heal'); }   // heal cross-dissolves the green frame; hit is recoil+flash only

  strike(r) {
    this.#busy = true; this.#streak++; this.#best = Math.max(this.#best, this.#streak);
    let dmg = Math.round((r.dmg || this.#B.baseDmg) * this.#mul(this.#streak));
    // first-strike-only reward for quiz prep — read lazily (the fight is built
    // before quizzes run, so the count must be sampled at strike time, not construction)
    const bonus = this.#firstStrike && this.#getQuizBonus ? Math.min(this.#getQuizBonus() * QUIZ_BOSS_BONUS_PER, QUIZ_BOSS_BONUS_CAP) : 0;
    this.#firstStrike = false; dmg += bonus;
    this.#hp -= dmg;
    if (r.finisher) this.#hp = 0;    // a designated finale round (e.g. complete_circle) always ends the fight on a clean hit, regardless of leftover HP — the narrative kill shot, not just whichever hit happens to zero the bar
    this.#score += dmg; this.#paint();
    sparkBurst(this.#el, this.#face(), 22); this.#flash('hit'); this.#floatText('-' + dmg, 'dmg');
    if (bonus > 0) this.#floatText('✦ +' + bonus + ' quiz bonus!', 'quizbonus');
    this.#pool.shift();
    setTimeout(() => { this.#busy = false; if (this.#hp <= 0) this.stagger(); else this.#nextRound(); }, 950);
  }
  wound(keep) {                                        // wrong answer / crashed run — the boss FEEDS
    const HEAL = this.#B.heal || 10;
    this.#busy = true; this.#streak = 0; this.#hearts--;
    this.#hp = Math.min(this.#B.hp, this.#hp + HEAL); this.#paint();
    this.#flash('heal'); this.#floatText('+' + HEAL, 'heal');
    if (this.#hearts <= 0) { this.#softFail(); return; }
    if (!keep && this.#pool.length > 1) this.#pool.push(this.#pool.shift());  // the missed question returns later
    setTimeout(() => { this.#busy = false; if (!keep) this.#nextRound(); }, 950);
  }
  #softFail() {
    this.#hp = this.#B.hp; this.#hearts = this.#B.hearts || 3; this.#streak = 0; this.#paint(); this.#flash('heal');
    this.#el.querySelector('.bround').innerHTML = `<div class="btaunt">nó CƯỜI KHÀN KHÀN — nỗi hoang mang của bạn vừa chữa lành cho nó…<br><small>hít thở sâu. tim đã hồi đầy. chiến tiếp nào!</small></div>`;
    setTimeout(() => { this.#busy = false; this.#nextRound(); }, 2100);
  }
  stagger() {
    // No separate "high-five the boss to finish it" gesture anymore — that
    // moment now lives in the node's closing ritual (✋ triggers THIS node's
    // bomb), so the boss just staggers for a beat and falls on its own.
    this.#phase = 'stagger'; this.#paint();
    if (!this.#ko) { this.#face().classList.add('stagger'); this.#setPose('stagger'); }   // ko-mode: the boss is already being sucked into the seal (kosealing) — don't override that transform with a stagger pose
    const round = this.#el.querySelector('.bround');
    if (round) round.innerHTML = `<div class="bfinish">${this.#bombKill ? 'BOM MẬT NGỮ NỔ TUNG!' : 'NÓ LẢO ĐẢO…'}</div>`;
    else { const state = this.#el.querySelector('.kostate'); if (state) state.textContent = 'BOM MẬT NGỮ NỔ TUNG!'; } // ko-mode has no .bround — reuse .kostate for the same beat
    setTimeout(() => this.victory(), 1100);
  }
  victory() {
    if (this.#phase === 'done') return; this.#phase = 'done'; this.#el.classList.add('done');
    clearTimeout(this.#koPoll);
    if (this.#vfx) { setTimeout(() => { if (this.#vfx) { this.#vfx.stop(); this.#vfx = null; } }, 1200); }  // let the seal-burst embers finish scattering, then tear the vortex down
    if (this.#bypassOff) { this.#bypassOff(); this.#bypassOff = null; }
    if (this.#fxOff) { this.#fxOff(); this.#fxOff = null; }
    const el = this.#el, bface = this.#face();
    el.querySelector('.bcam').classList.remove('on');
    const bombBtn = el.querySelector('.bbomb'); if (bombBtn) bombBtn.classList.add('gone');
    sparkBurst(el, bface, 34);                    // golden embers
    sparkBurst(el, bface, 12, 'smoke');            // billowing ash-grey smoke puffs, layered on top
    if (!this.#ko) { bface.classList.remove('stagger'); bface.classList.add('slain'); }   // ko-mode keeps the kosealing collapse (boss sucked into the seal) — don't restore it with a slain frame
    const round = el.querySelector('.bround'); if (round) round.innerHTML = '';
    const state = el.querySelector('.kostate'); if (state) state.textContent = '';
    const h = el.querySelector('.qhint'); if (h) h.remove();
    const w = el.querySelector('.bwin'); w.classList.remove('gone');
    // bombKill (owner finisher framing): won by the forged BOM MẬT NGỮ →
    // extra fanfare line; otherwise the same normal-strike victory banner
    // as before (the no-bomb path stays completely unremarkable, by design).
    // ko mode (BOSS CONCEPT V2): always a bomb kill, phong-ấn/seal framing,
    // no score/streak (that whole model is retired for this boss shape).
    w.innerHTML = this.#ko
      ? `💥 PHONG ẤN THÀNH CÔNG — ${this.#B.name} bị khống chế! ✦<small>BOM MẬT NGỮ rèn được đã dùng đúng lúc</small>`
      : this.#bombKill
      ? `💥 BOM MẬT NGỮ XÉ TOẠC ${this.#B.name}! ✦<small>rèn được, dùng đúng lúc — hạ gục hoàn toàn · điểm ${this.#score}</small>`
      : `⚔ ${this.#B.name} ĐÃ BỊ HẠ ✦<small>điểm ${this.#score} · chuỗi cao nhất ×${this.#mul(this.#best || 1)}</small>`;
    try { const s = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
      s[this.#nodeIndex] = { score: this.#score, bestStreak: this.#best }; localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* stats are flavor */ }
    setTimeout(() => this.#onComplete(el), 1400);
  }
  #nextRound() {
    this.#bombUsed = false; this.#refreshBombBadge();  // a fresh round re-opens the one-bomb-per-round debounce
    if (!this.#pool.length) this.#pool = [...this.#B.rounds];  // it out-healed the pool → the whole gauntlet again
    const r = this.#pool[0], host = this.#el.querySelector('.bround'); host.innerHTML = '';
    // "code dài thì màn hình ngang hiển thị không đủ" + "camera một nơi, chữ
    // một nơi" — .coderound (CSS) compresses the boss header + drops the
    // fullscreen camera to give the editor real width during typing; the
    // camera returns automatically for the next gesture round (#armForRound).
    this.#el.classList.toggle('coderound', !r.q);
    if (r.q && r.gesture === 'swipe') {                // binary swipe-choice round: left = option 0, right = option 1
      host.innerHTML = `<div class="qq">${renderProse(r.q)}</div><div class="qopts swipe"><div class="qopt swipeleft"><i class="qn">◀</i>${renderProse(r.a[0])}</div><div class="qopt swiperight"><i class="qn">▶</i>${renderProse(r.a[1])}</div></div>`;
      host.querySelector('.swipeleft').onclick = () => { if (!this.#busy && this.#phase === 'fight') this.#answer(host.querySelector('.swipeleft'), 0 === r.correct); };
      host.querySelector('.swiperight').onclick = () => { if (!this.#busy && this.#phase === 'fight') this.#answer(host.querySelector('.swiperight'), 1 === r.correct); };
    } else if (r.q) {
      host.innerHTML = `<div class="qq">${renderProse(r.q)}</div><div class="qopts"></div>`;
      const opts = host.querySelector('.qopts');
      r.a.forEach((t, i) => {
        const b = document.createElement('button'); b.className = 'qopt';
        b.innerHTML = `<i class="qn">${i + 1}</i>${renderProse(t)}<b class="qfill"></b>`;
        b.onclick = () => { if (!this.#busy && this.#phase === 'fight') this.#answer(b, i === r.correct); };
        opts.appendChild(b);
      });
    } else {                                            // code round: heal the broken spell, RUN to strike
      const cc = document.createElement('div'); cc.className = 'codecell'; cc._src = r.code;
      cc._expectOut = r.expectOut; cc._expect = r.expect; // without this, expectOut is silently never checked and ANY clean run (even untouched starter code) lands a strike
      cc.innerHTML = `
        ${r.art ? `<div class="rart"><img src="${r.art}" alt=""></div>` : ''}
        <div class="chead"><span class="inlbl mono">In [ ]</span><span class="clabel mono">${r.label || 'strike.py'}</span>
          <button class="creset" title="reset this round">↺</button>
          <button class="crun" disabled>▶ STRIKE</button></div>
        ${r.note ? `<div class="cnote">${renderProse(r.note)}</div>` : ''}
        <div class="ced"></div><div class="cout mono"></div>`;
      cc.querySelector('.crun').onclick = () => this.#runCell(cc);
      cc.querySelector('.creset').onclick = () => { if (cc._editor) cc._editor.setValue(cc._src); };
      // codeCell()'s cells get this from notebook-runner's one-time onReady
      // broadcast, but that already fired long before the boss fight (and
      // thus this round's button) ever existed — check directly instead, or
      // STRIKE stays permanently disabled with no way to recover.
      if (this.#workerUp && this.#workerUp()) cc.querySelector('.crun').disabled = false;
      cc._fight = ok => { if (this.#phase !== 'fight') return; ok ? this.strike(r) : this.wound(true); };
      // "code dài thì màn hình ngang hiển thị không đủ" — the arena gives code
      // rounds real width (CSS) + a bigger in-editor font (via the editor
      // instance's own public updateOptions API, not by touching
      // code-cells.js's shared mountEditor).
      this.#ensureMonaco().then(() => { this.#mountEditor(cc, r.code); if (cc._editor) cc._editor.updateOptions({ fontSize: 16, lineHeight: 26 }); });
      host.appendChild(cc);
    }
    this.#armForRound();      // re-arm the matching gesture verb for whichever round just loaded
  }
  #answer(btn, ok) {
    if (!ok) { btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope'); this.wound(false); return; }
    this.#el.querySelectorAll('.bround .qopt').forEach(b => b.disabled = true); btn.classList.add('yes');
    sparkBurst(this.#el, btn); this.strike(this.#pool[0]);
  }
  setHp(v) { this.#hp = Math.max(0, v); this.#paint(); if (this.#hp <= 0 && this.#phase === 'fight') this.stagger(); } // cheat hook
  koDetonate() { if (this.#ko) this.#detonate(true); } // dev/testing hook — force the ko-mode ritual finish regardless of bomb count/phase
  // toGestureRound(gesture) — dev/testing hook: pull the first round matching
  // `gesture` (e.g. 'swipe') to the front of the pool and load it immediately,
  // so a new gesture verb can be reached without playing the whole fight.
  toGestureRound(gesture) { return this.#toRound(r => r.gesture === gesture); }
  // toFinisherRound() — dev/testing hook: same, but for the `finisher:true`
  // round (e.g. complete_circle.py / mat_ngu_ket_lieu.py) — otherwise only
  // reachable by clearing every earlier round, or by bossHp(1)+winBoss()
  // which bypasses the finisher round's own code/gesture entirely.
  toFinisherRound() { return this.#toRound(r => !!r.finisher); }
  #toRound(pred) {
    const i = this.#pool.findIndex(pred);
    if (i < 0) return false;
    const [r] = this.#pool.splice(i, 1); this.#pool.unshift(r);
    this.#nextRound(); return true;
  }
  win() { this.victory(); }

  // Entry gate for the whole fight — re-arms per round, since a round's
  // `gesture` field picks WHICH verb applies (default finger-count; 'swipe'
  // for a binary swipe-choice round). Stores the deps so #nextRound() can
  // re-arm on every round change without the caller re-invoking armGate().
  armGate(gestureDispatcher, cameraEngine) {
    this.#gd = gestureDispatcher; this.#cam = cameraEngine;
    if (this.#ko) { this.#armGateKo(); return; }
    this.#refreshWandBadge(); this.#refreshBombBadge();
    this.#armForRound();
  }

  // ── BOSS CONCEPT V2 — gesture-only 1-hit-KO ritual (FORGE-PLAN.md
  // "FINALIZED (owner, 2026-07-05)"). ZERO quiz/code rounds: the boss is
  // pure ceremony — hold ☝ (1 finger) to AIM/lock, then ✋ (5) to UNLEASH the
  // forged BOM MẬT NGỮ, spendBomb() + a big detonation → stagger → the
  // existing victory()/seal beat. Gated on inventory.bombCount()>0; with
  // zero bombs the cell shows a "go forge one" prompt but is never a true
  // dead end (see #armGateKo's bypass + the poll that auto-arms the ritual
  // the moment a bomb becomes available — e.g. forged in another tab/dev hook).
  // TODO(FORGE-PLAN.md "Merge boss + ritual"): the node's separate `ritual:`
  // cell (node02v2.js) still does its own seal afterward — a later pass
  // should fold that phong-ấn moment INTO this KO beat so there's no
  // second, redundant "hold ✋ to seal" ask right after this one.
  #buildKoDom() {
    const B = this.#B, el = this.#el;
    el.classList.add('bosscell', 'komode'); injectBossCss();
    const face = B.sheet ? `<div class="bsheet base" style="background-image:url('${B.sheet.src}')"></div><div class="bsheet pose" style="background-image:url('${B.sheet.src}')"></div>`
      : B.art ? `<img src="${B.art}" alt="">` : `<div class="gglyph">${B.glyph || '👾'}</div>`;
    // Boss is CENTRED (in .kobossholder) on the vortex funnel — see the .komode
    // CSS in injectBossCss. bhead sits at the top; state/hint anchor to the bottom.
    el.innerHTML = `
      <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
      <div class="barenain">
        <div class="bhead">⚔ BOSS · ${B.name}</div>
        <div class="kobossholder"><div class="bossface">${face}</div></div>
        <div class="konobomb gone">⚒ Chưa có BOM MẬT NGỮ — quay lại THỢ RÈN để rèn trước đã!<br><button class="kobackforge">🔨 VỀ THỢ RÈN</button></div>
        <div class="kostate"></div>
        <div class="qhint"></div>
        <div class="bwin gone"></div>
      </div>`;
    const back = el.querySelector('.kobackforge');
    if (back) back.onclick = () => { const forge = document.querySelector('.forgecell'); if (forge) forge.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  }
  // #armGateKo() — entry point once armGate() sees boss.ko. Re-checks
  // inventory.bombCount() every time the cell is (re)armed AND on a slow
  // poll while showing the no-bomb prompt (a bomb forged elsewhere should
  // surface without needing a reload) — same "recheck on reveal" pattern
  // #refreshBombBadge already used for the legacy path.
  #armGateKo() {
    clearTimeout(this.#koPoll);
    if (this.#el.classList.contains('done')) return;
    if (inventory.bombCount() > 0) { this.#koPhase = 'aim'; this.#mountKoVortex(); const f = this.#face(); if (f) f.classList.add('koaiming'); this.#armKoAim(); return; }
    this.#koPhase = 'nobomb';
    const noBomb = this.#el.querySelector('.konobomb'), state = this.#el.querySelector('.kostate');
    if (noBomb) noBomb.classList.remove('gone');
    if (state) state.textContent = '';
    // No-dead-end: the Space cheat (or a tester's tap-equivalent) can always
    // push through even with zero bombs — it just skips straight to the seal
    // instead of pretending a bomb was thrown.
    if (this.#bypassOff) this.#bypassOff();
    this.#bypassOff = registerBypass('boss KO — bypass (no bomb yet)', () => this.#detonate(true));
    this.#koPoll = setTimeout(() => this.#armGateKo(), 1200);
  }
  // #mountKoVortex() — lazy-load + mount the shared ritual particle vortex
  // (ritual-vortex.js) over the fullscreen camera layer (behind the boss face)
  // so the aim/detonate reads as the ritual's real charging funnel + igniting
  // magic circle, not a static image (owner: "trải nghiệm ngắm và nổ bom không
  // đã, boss là hình tĩnh"). One-shot guarded; the aim/unleash holds drive its
  // setCharge, #detonate calls burst(), victory() stops it.
  #mountKoVortex() {
    if (this.#vfx || this.#koVortexLoading) return;
    this.#koVortexLoading = true;
    this.#loadVortex().then(() => {
      if (this.#phase === 'done' || !self.RitualVortex) return;
      // Mount over the whole arena (`this.#el` = `.bosscell`, fixed inset:0 so
      // it's ALWAYS full-viewport-sized), NOT `.bcam` — `.bcam` is
      // display:none until the camera turns on (async), so a canvas mounted
      // there sizes to 0×0 and never draws. `#rvortex` (position:absolute;
      // inset:0; z-index:1) fills the bosscell and paints over the camera
      // layer (also z-index:1, earlier in DOM) but under `.barenain` (z:2, the
      // boss face + text). `.pvx` lands on `.bosscell` → the camera dims under it.
      // owner ("boss như cái ảnh đứng giữa, chán"): the storm must ENGULF the
      // boss, not sit behind it — ambient 1 + spread 1.4 fills the whole arena
      // with drifting dust/glyphs from the first frame, theme.scale ×1.5 makes
      // the funnel plate boss-sized, and the canvas is raised ABOVE .barenain
      // (z2 → 3) so dust, spiral arms and burst embers sweep OVER the boss art.
      const bt = this.#B.theme || {};
      this.#vfx = self.RitualVortex.mount(this.#el, { theme: { ...bt, scale: (bt.scale || 1) * 1.5 }, ambient: 1, spread: 1.4, cy: .46 });  // cy matches the .kobossholder centre (top:46%) so the funnel converges ON the boss
      if (this.#vfx.canvas) this.#vfx.canvas.style.zIndex = 3;
      this.#vfx.setCharge(this.#koCharge);
    }).catch(() => {});
  }
  // #setKoCharge(c) — feed the vortex + a --rc CSS hook. Driven by the aim
  // (0→.45, gather) and unleash (.45→1, funnel) hold progress, so dropping the
  // sign relaxes the funnel exactly like the ritual (armActHoldGate soft-decays).
  #setKoCharge(c) { this.#koCharge = c; if (this.#vfx) this.#vfx.setCharge(c); this.#el.style.setProperty('--rc', c);
    this.#el.style.setProperty('--ru', Math.max(0, (c - .45) / .55));   // unleash-phase progress: bomb rumble amplitude + boss cower
    const h = this.#el.querySelector('.kobossholder'); if (h) h.classList.toggle('shaking', c > 0.04);
    const bh = this.#el.querySelector('.kobombhover'); if (bh) bh.classList.toggle('rumbling', c > .5); }
  // #summonBombHover() — AIM beat 1 (owner spec: "1 ngón tay — bom mật ngữ
  // hiện ra"): the forged bomb MATERIALIZES on stage and stays hovering,
  // scaling/glowing with the charge, so the whole ritual reads as powering
  // up a real object the student forged — not FX from nowhere.
  #summonBombHover() {
    if (this.#el.querySelector('.kobombhover')) return;
    const h = document.createElement('div'); h.className = 'kobombhover';
    const i = document.createElement('img'); i.src = 'assets/cipher-bomb.webp'; i.alt = '';
    i.onerror = () => h.replaceChildren(document.createTextNode('💣'));
    h.appendChild(i); this.#el.appendChild(h);
  }
  // #armKoAim() — phase 1: hold ☝ (1 finger) steady to AIM. Reuses the shared
  // armActHoldGate charge gauge (.bgauge) + fullscreen .bcam camera exactly
  // like every other hold gate in this file. TAP FALLBACK (bug fix — every
  // other hold gate in this codebase has a real click affordance alongside
  // the camera, per PEDAGOGY-METHOD.md's "no dead ends" rule; KO mode had
  // none until now, camera-less players were stuck): a real click on
  // `.kobossholder` completes this phase instantly, same convention as
  // checkpoint-cell.js's `.ckholdbtn`/forge-cell.js's `.anvil` — click = tap
  // fallback that resolves the gate for real, not a cheat-only bypass.
  #armKoAim() {
    const noBomb = this.#el.querySelector('.konobomb'), state = this.#el.querySelector('.kostate'), hint = this.#el.querySelector('.qhint');
    if (noBomb) noBomb.classList.add('gone');
    this.#summonBombHover();
    if (state) state.textContent = `☝ GIƠ NGÓN TRỎ để NGẮM ${this.#B.name}…`;
    if (hint) hint.textContent = 'giữ yên ngón trỏ để khoá mục tiêu — hoặc chạm vào boss';
    if (this.#bypassOff) this.#bypassOff();
    this.#bypassOff = registerBypass('boss KO — aim', () => this.#detonate());
    const holder = this.#el.querySelector('.kobossholder');
    // .kobossholder is pointer-events:none in the injected CSS above (the art
    // itself was never meant to intercept clicks) — override inline so the
    // tap fallback actually receives the click.
    if (holder) { holder.style.pointerEvents = 'auto'; holder.style.cursor = 'pointer'; holder.onclick = () => { if (this.#koPhase === 'aim') this.#aimLocked(); }; }
    this.#gd.armActHoldGate(this.#cam, this.#el.querySelector('.bcam'), 1, () => !this.#el.classList.contains('done') && this.#koPhase === 'aim', p => this.#setKoCharge(p * .45), () => this.#aimLocked());
    this.#onSaveProgress({ boss: { ko: true, phase: 'aim' } });
  }
  // #aimLocked() — shared completion for the aim phase, reached either by a
  // full camera hold OR a direct tap on the boss (see #armKoAim above).
  #aimLocked() {
    // TARGET-LOCK beat: the aim completing is its own reward — a metallic
    // click + the boss flash-blanching for a heartbeat before phase 2.
    this.#koPhase = 'unleash'; sfx.clang(.6);
    const f = this.#face(); if (f) { f.classList.remove('kolock'); void f.offsetWidth; f.classList.add('kolock'); setTimeout(() => f.classList.remove('kolock'), 420); }
    this.#armKoUnleash();
  }
  // #armKoUnleash() — phase 2: hold ✋ (5 fingers) to UNLEASH the forged bomb.
  // Same tap-fallback fix as #armKoAim: clicking `.kobossholder` again fires
  // #detonate() directly instead of only being reachable via camera/cheat.
  #armKoUnleash() {
    const state = this.#el.querySelector('.kostate'), hint = this.#el.querySelector('.qhint');
    if (state) state.textContent = `✋ ĐẬP TAY để PHÓNG BOM MẬT NGỮ!`;
    if (hint) hint.textContent = 'khoá xong rồi — xoè cả bàn tay để phóng bom, hoặc chạm vào boss';
    if (this.#bypassOff) this.#bypassOff();
    this.#bypassOff = registerBypass('boss KO — unleash', () => this.#detonate());
    const holder = this.#el.querySelector('.kobossholder');
    if (holder) { holder.style.pointerEvents = 'auto'; holder.style.cursor = 'pointer'; holder.onclick = () => { if (this.#koPhase === 'unleash') this.#detonate(); }; }
    this.#gd.armActHoldGate(this.#cam, this.#el.querySelector('.bcam'), 5, () => !this.#el.classList.contains('done') && this.#koPhase === 'unleash', p => this.#setKoCharge(.45 + p * .55), () => this.#detonate());
    this.#onSaveProgress({ boss: { ko: true, phase: 'unleash' } });
  }
  // #detonate(free) — spends the forged bomb (or, for the no-dead-end
  // bypass path with zero bombs, just proceeds without spending one) and
  // fires the same detonation FX language as the legacy path's deployBomb()
  // (bombsweep streak, sparkBurst, hit flash) before staggering into the
  // shared victory()/phong-ấn seal.
  #detonate(free = false) {
    if (this.#phase === 'done' || this.#koPhase === 'fired') return;   // debounce: gate onDone + bypass can both fire
    this.#koPhase = 'fired';
    if (!free) inventory.spendBomb();
    this.#bombKill = true;
    // KO choreography V3 (owner spec): blinding flash → the hovering bomb
    // LAUNCHES into the boss → fire + ice columns sweep up after it → twin
    // detonation. The bypass path may arrive with no hover yet — summon it.
    this.#summonBombHover();
    const state = this.#el.querySelector('.kostate'); if (state) state.textContent = '💥 PHONG ẤN!';
    const flash = document.createElement('div'); flash.className = 'koflash';
    this.#el.appendChild(flash); setTimeout(() => flash.remove(), 520);
    const hov = this.#el.querySelector('.kobombhover');
    if (hov) { hov.classList.remove('rumbling'); void hov.offsetWidth; hov.classList.add('launch'); }
    sfx.whoosh();
    setTimeout(() => {
      if (hov) hov.remove();
      for (const elem of ['fire', 'ice']) { const s = document.createElement('div'); s.className = 'kosweep ' + elem; this.#el.appendChild(s); setTimeout(() => s.remove(), 800); }
      setTimeout(() => this.#koImpact(), 300);   // sweeps arrive → the blast lands
    }, 280);
  }
  // #koImpact() — beat 2: the bomb lands and detonates in TWO ELEMENTS AT
  // ONCE (owner: "fire_vortex + ice cùng nổ"): the vortex bursts its embers,
  // twin fire/ice shockwave rings expand from the boss, a fire ember burst +
  // an ice shard burst fly together, the arena quakes (bombsweep+kodeto) and
  // the boom + glass-shatter synth stack — then the boss is sucked-shrunk
  // into the magic circle (kosealing), same seal language as the ritual.
  #koImpact() {
    this.#setKoCharge(1); if (this.#vfx) this.#vfx.burst();
    const bface = this.#face(); if (bface) { bface.classList.remove('koaiming'); bface.classList.add('kosealing'); }
    this.#el.classList.remove('bombsweep', 'kodeto'); void this.#el.offsetWidth; this.#el.classList.add('bombsweep', 'kodeto');
    setTimeout(() => this.#el.classList.remove('bombsweep', 'kodeto'), 950);
    for (const elem of ['fire', 'ice']) { const w = document.createElement('div'); w.className = 'kowave ' + elem; this.#el.appendChild(w); setTimeout(() => w.remove(), 1100); }
    sparkBurst(this.#el, this.#face(), 30, 'fireburst'); sparkBurst(this.#el, this.#face(), 30, 'iceburst');
    this.#flash('hit'); sfx.boom(); sfx.shatter();
    this.#hp = 0;
    setTimeout(() => this.stagger(), 1050);   // let the twin waves + seal-collapse read before the victory banner
  }
  #armForRound() {
    if (!this.#gd) return;
    this.#gd.disarmActGate(); this.#gd.disarmMotionGate();
    if (this.#bypassOff) { this.#bypassOff(); this.#bypassOff = null; }
    const r = this.#pool[0];
    if (!r || !r.q) {                    // code round (typing mode) — no fullscreen camera until the next gesture round
      const chip = this.#el.querySelector('.bcam'); if (chip) chip.classList.remove('on');
      if (this.#fxOff) { this.#fxOff(); this.#fxOff = null; }
      if (this.#cam) this.#cam.release();                        // release() no-ops itself if something else still needs the hand
      return;
    }
    // the registry decides which strings are motion verbs (single source of
    // truth shared with validate-content.mjs); of those, only 'swipe' has a
    // boss-round UI today (#nextRound's swipe branch) — others fall back to
    // finger-count so an unwired verb can't leave the round unanswerable.
    const verb = GESTURE_VERB_NAMES.includes(r.gesture) ? r.gesture : null;
    if (verb === 'swipe') this.#armSwipe(); else this.#armFingers();
  }
  // 1..3 fingers pick an answer; ✋ lands the finisher.
  #armFingers() {
    const gestureDispatcher = this.#gd, cameraEngine = this.#cam;
    // Registered here, OUTSIDE cameraEngine.ensure()'s .then() — a Space
    // bypass must resolve this round even with no camera at all (ensure()
    // then never settles), same reasoning as quiz-cell.js's fix.
    if (this.#bypassOff) this.#bypassOff();
    this.#bypassOff = registerBypass('boss hold — đáp án đúng', () => {
      const btns = this.#el.querySelectorAll('.bround .qopt'); const correct = this.#pool[0] && this.#pool[0].correct;
      if (btns[correct] && !this.#busy && this.#phase === 'fight') this.#answer(btns[correct], true);
    });
    cameraEngine.ensure().then(() => {
      if (this.#el.classList.contains('done')) return;
      const chip = this.#el.querySelector('.bcam'), v = chip.querySelector('video');
      v.srcObject = cameraEngine.stream; v.play().catch(() => {});
      chip.classList.add('on');
      if (this.#fxOff) this.#fxOff();
      this.#fxOff = armFingertipFx(gestureDispatcher, chip, () => this.#holdOk);
      const fill = chip.querySelector('.bgauge i');
      let held = 0, target = -1, last = performance.now();
      gestureDispatcher.armActGate((count, has) => {
        if (this.#el.classList.contains('done')) { gestureDispatcher.disarmActGate(); chip.classList.remove('on'); return; }
        const now = performance.now(), dt = Math.min(100, now - last); last = now;
        if (this.#phase !== 'fight') { held = 0; return; }  // staggering (auto-completes) or already done — no gesture to arm
        const btns = this.#el.querySelectorAll('.bround .qopt');
        if (this.#busy || !btns.length || btns[0].disabled) { held = 0; return; }
        const idx = has && count >= 1 && count <= btns.length ? count - 1 : -1;
        this.#holdOk = idx >= 0 && idx === this.#pool[0].correct;
        if (idx !== target) { target = idx; held = 0; } else if (idx >= 0) held += dt;
        const p = idx < 0 ? 0 : Math.min(1, held / QUIZ_HOLD_MS);
        btns.forEach((b, i) => { const on = i === idx; b.classList.toggle('arm', on);
          b.style.setProperty('--qp', on ? p : 0); b.querySelector('.qfill').style.width = (on ? p * 100 : 0) + '%'; });
        fill.style.width = p * 100 + '%';
        if (idx >= 0 && held >= QUIZ_HOLD_MS) { held = 0; this.#answer(btns[idx], idx === this.#pool[0].correct); }
      });
    }).catch(() => {});                                 // no camera → tap answers, tap the beast to finish
  }
  // Binary swipe-choice round: hold ✋ to ARM (lock on), then swipe left/right
  // to CAPTURE the choice — left picks option 0, right picks option 1. The
  // `.qhint` line carries the arm/capture/timeout status so it's always
  // clear whether to hold still or move (see gesture-dispatcher.js#armSwipeGate).
  #armSwipe() {
    const gestureDispatcher = this.#gd, cameraEngine = this.#cam;
    const chip = this.#el.querySelector('.bcam'), hint = this.#el.querySelector('.qhint');
    // no explicit armFingertipFx here — armSwipeGate (→ armVerbGate) now
    // arms/disarms its own fingertip fx over `chip` internally.
    if (this.#bypassOff) this.#bypassOff();
    this.#bypassOff = registerBypass('boss swipe — hướng đúng', () => {
      const r = this.#pool[0]; if (!r || this.#busy || this.#phase !== 'fight') return;
      const btn = this.#el.querySelector(r.correct === 0 ? '.swipeleft' : '.swiperight');
      if (btn) this.#answer(btn, true);
    });
    // Directional-arrow affordance: pulse the ◀/▶ arrows the moment CAPTURE
    // opens (armStatusHandler already drives the hint text/fill — this just
    // toggles a class on top of that same (phase, progress) callback).
    const opts = this.#el.querySelector('.qopts.swipe');
    const baseStatus = armStatusHandler(hint, null, 'ĐÃ KHOÁ ✓ — QUẸT sang trái/phải để chọn!');
    gestureDispatcher.armSwipeGate(cameraEngine, chip,
      () => this.#phase === 'fight' && !this.#busy && !this.#el.classList.contains('done') && !!(this.#pool[0] && this.#pool[0].gesture === 'swipe'),
      (phase, p) => { baseStatus(phase, p); if (opts) opts.classList.toggle('capturing', phase === 'capture'); },
      dir => {
        if (this.#busy || this.#phase !== 'fight') return;
        const idx = (dir === 'left' || dir === 'up') ? 0 : 1;
        const btn = this.#el.querySelector(idx === 0 ? '.swipeleft' : '.swiperight');
        if (!btn) return;
        flashSlash(chip, dir);                     // slash-trail FX in the detected direction, THEN resolve
        setTimeout(() => this.#answer(btn, idx === this.#pool[0].correct), 260);
      },
      'x');
  }
}

// bossCell(c, deps) — factory matching the other cell kinds' shape: builds
// the container element, wires _arm (gesture gate) and _dev (cheat hooks).
export function bossCell(c, { nodeIndex, gestureDispatcher, cameraEngine, completeCell, saveProgress, ensureMonaco, mountEditor, runCell, getQuizBonus, workerUp, loadVortex }) {
  const el = document.createElement('div');
  const fight = new BossFight(c.boss, el, { nodeIndex, onComplete: completeCell, onSaveProgress: saveProgress, ensureMonaco, mountEditor, runCell, getQuizBonus, workerUp, loadVortex });
  el._arm = () => fight.armGate(gestureDispatcher, cameraEngine);
  el._dev = { setHp: v => fight.setHp(v), win: () => fight.win(), toGesture: g => fight.toGestureRound(g), toFinisher: () => fight.toFinisherRound(), deployBomb: () => fight.deployBomb(), koDetonate: () => fight.koDetonate() };
  return el;
}
