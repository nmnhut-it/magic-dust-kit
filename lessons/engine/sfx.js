// sfx.js — tiny WebAudio synth for game-feel beats: no asset files, one lazy
// AudioContext (created/resumed on the first pointer/keydown so the browser's
// autoplay policy is satisfied — a camera-gesture-only session stays silent
// until the first real tap, which is an acceptable degrade, never an error).
// Public shape: sfx.clang(i) hammer-on-anvil hit (i scales brightness/level),
// sfx.thud() dull wrong-answer knock, sfx.whoosh() fire flare-up,
// sfx.boom() forge-success blast. All fire-and-forget, all safe with no ctx.
let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (self.AudioContext || self.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
const unlock = () => ac();
if (typeof addEventListener !== 'undefined') { addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true }); }

// one enveloped oscillator: freq (Hz, may glide to f2), type, t0 offset, dur, peak gain
function tone(c, { f, f2, type = 'sine', at = 0, dur = .2, g = .12 }) {
  const o = c.createOscillator(), v = c.createGain(), t = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(v).connect(c.destination); o.start(t); o.stop(t + dur + .02);
}
// short filtered-noise burst: the metallic "tssh" / whoosh body
function noise(c, { at = 0, dur = .15, g = .1, fq = 3000, q = 1, type = 'bandpass' }) {
  const n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = fq; f.Q.value = q;
  const v = c.createGain(), t = c.currentTime + at;
  v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
  n.buffer = b; n.connect(f).connect(v).connect(c.destination); n.start(t);
}

export const sfx = {
  // hammer strike: inharmonic metal partials + a bright noise tick
  clang(i = 1) { const c = ac(); if (!c) return;
    noise(c, { dur: .06, g: .12 * i, fq: 5200, q: .8, type: 'highpass' });
    tone(c, { f: 523, type: 'triangle', dur: .28, g: .10 * i });
    tone(c, { f: 1370, type: 'triangle', dur: .2, g: .06 * i });
    tone(c, { f: 2640, type: 'sine', dur: .12, g: .04 * i }); },
  // dull knock for a wrong pick — soft, never punishing
  thud() { const c = ac(); if (!c) return;
    tone(c, { f: 140, f2: 70, type: 'sine', dur: .16, g: .12 });
    noise(c, { dur: .05, g: .04, fq: 700, q: 1 }); },
  // fire flare-up swell
  whoosh() { const c = ac(); if (!c) return;
    noise(c, { dur: .35, g: .07, fq: 900, q: .6 });
    noise(c, { at: .04, dur: .3, g: .05, fq: 2200, q: .7 }); },
  // forge-success blast: low boom + clang stack + long shimmer
  boom() { const c = ac(); if (!c) return;
    tone(c, { f: 150, f2: 46, type: 'sine', dur: .55, g: .22 });
    noise(c, { dur: .4, g: .1, fq: 1400, q: .5 });
    this.clang(1.2); tone(c, { f: 2093, type: 'sine', at: .1, dur: .5, g: .03 }); },
  // ice-shatter: a scatter of tiny descending glass pings (boss KO's freeze
  // half — layered over boom() for the fire+ice twin detonation)
  shatter() { const c = ac(); if (!c) return;
    for (let i = 0; i < 6; i++) tone(c, { f: 1900 + Math.random() * 1900, f2: 900 + Math.random() * 600,
      type: 'sine', at: .04 + i * .045, dur: .14, g: .045 });
    noise(c, { at: .02, dur: .22, g: .05, fq: 6200, q: .7, type: 'highpass' }); },
};
