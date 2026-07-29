// mic-meter.js — live mic level as a scrolling RMS waveform on a canvas, so
// "is my voice even reaching the machine, and how loud?" is visible at a
// glance. Opens its OWN audio stream + AnalyserNode (coexists fine with
// SpeechRecognition's internal capture). Loud frames draw white; quiet ones
// draw in the theme accent (--c). Rejects if the mic is denied/absent —
// callers hide the canvas and rely on the voice gate's own error messaging.
export async function mountMicMeter(cv) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const actx = new (self.AudioContext || self.webkitAudioContext)();
  const an = actx.createAnalyser(); an.fftSize = 512;
  actx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize), g = cv.getContext('2d');
  const W = cv.width, H = cv.height, hist = new Array(W).fill(0);
  let raf = 0, dead = false;
  const accent = () => (getComputedStyle(document.documentElement).getPropertyValue('--c').trim() || '#78b2a5');
  const loop = () => {
    if (dead) return;
    an.getByteTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; s += d * d; }
    hist.push(Math.min(1, Math.sqrt(s / buf.length) * 3.2)); hist.shift();
    g.clearRect(0, 0, W, H); const c = accent();
    for (let x = 0; x < W; x += 2) { const v = Math.max(hist[x] * H * .48, .6); g.fillStyle = hist[x] > .55 ? '#fffdf5' : c; g.fillRect(x, H / 2 - v, 1.4, v * 2); }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return { stop() { dead = true; cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); try { actx.close(); } catch {} } };
}
