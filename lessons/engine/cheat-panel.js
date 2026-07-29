// cheat-panel.js — dev/testing panel: type "pip" anywhere, or open with
// #cheat. Jump the notebook without playing it: skip the current cell,
// fast-forward to the boss/ritual, fire fx directly, one-hit or win the
// boss, seal the node. Buttons delegate to window.nodeDev (built by the
// composition root in node.js) — this file owns only the panel UI + the
// "pip" keyboard easter-egg toggle. Toggling the panel is ALSO the one
// on/off switch for the Space bypass (bypass-registry.js's setCheatOn) —
// students never see the panel, so Space is silently inert for them.
import { setCheatOn } from './bypass-registry.js';
export function buildCheatPanel(nodeDev) {
  const cheatEl = document.createElement('div'); cheatEl.id = 'cheat';
  const B = [
    ['⏭ skip cell', () => nodeDev.skip()],
    ['⚔ to boss', () => nodeDev.toBoss()],
    ['⟡ to ritual', () => nodeDev.toRitual()],
    ['🗣 chant', () => nodeDev.chant()],
    ['🎯 track quiz', () => nodeDev.toGestureQuiz()],
    ['🖐 swipe round', () => nodeDev.toGestureRound('swipe')],
    ['☀🌙 light/dark cell', () => nodeDev.toLightenDarken()],
    ['🏁 finisher round', () => nodeDev.toFinisherRound()],
    ['🔥 cast fire', () => nodeDev.cast('fire')],
    ['☀ lighten', () => nodeDev.screen('lighten')],
    ['🌙 darken', () => nodeDev.screen('darken')],
    ['💀 boss 1hp', () => nodeDev.bossHp(1)],
    ['🏆 win boss', () => nodeDev.winBoss()],
    ['🔨 grant badges', () => nodeDev.grantBadges(2)],
    ['💣 grant + deploy bomb', () => { nodeDev.grantBombs(1); nodeDev.deployBomb(); }],
    ['✅ seal node', () => nodeDev.seal()],
  ];
  cheatEl.innerHTML = '<b>✦ CHEATS</b>';
  B.forEach(([t, fn]) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; cheatEl.appendChild(b); });
  return cheatEl;
}

// installCheatToggle(nodeDev) — wires the "pip" typed-anywhere shortcut and
// the #cheat hash auto-open; returns nothing, manages its own show/hide state.
export function installCheatToggle(nodeDev) {
  let cheatEl = null;
  const toggle = () => {
    if (cheatEl) { cheatEl.remove(); cheatEl = null; setCheatOn(false); return; }
    cheatEl = buildCheatPanel(nodeDev);
    document.body.appendChild(cheatEl); setCheatOn(true);
  };
  let cheatBuf = '';
  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;   // never while typing in a prompt/editor
    cheatBuf = (cheatBuf + e.key).slice(-3);
    if (cheatBuf === 'pip') { cheatBuf = ''; toggle(); }
  });
  if (location.hash === '#cheat') toggle();
}
