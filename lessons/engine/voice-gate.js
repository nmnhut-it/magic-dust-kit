// voice-gate.js — reusable voice-chant listener for act gates: Web Speech API
// wrapped around chant-match. Chrome allows ONE live SpeechRecognition session
// per page (two languages can't listen in parallel), and a real session showed
// vi-VN forcing the yell "CODE!" into "không" while en-US nailed it — so this
// listens en-US only and recycles the session every few seconds (long
// continuous runs degrade). Transcripts are matched on the session's whole
// joined utterance AND every n-best alternative (the chant hides below "cold"
// in the alternatives). Persistent service errors call onDown(reason) so the
// caller drops its voice requirement instead of wedging — no dead ends.
// Callbacks: onLog(line) raw event log · onHear(utterance, hitWord|null)
// display feed · onMatch(word) chant landed · onDown(reason) voice gone.
import { chantHits } from './chant-match.js';

export function startVoiceGate({ onMatch, onHear, onLog, onDown, lang = 'en-US', recycleMs = 7000 } = {}) {
  const SR = self.SpeechRecognition || self.webkitSpeechRecognition;
  const log = m => { if (onLog) onLog(m); };
  const gate = { active: false, stop() { gate._stopped = true; clearTimeout(gate._t); if (gate._sr) { try { gate._sr.stop(); } catch {} gate._sr = null; } } };
  if (!SR) { log('no SpeechRecognition API'); if (onDown) onDown('trình duyệt không hỗ trợ nghe'); return gate; }
  let fails = 0;
  const giveUp = why => { gate.stop(); gate.active = false; log('GIVE UP: ' + why); if (onDown) onDown(why); };
  const spin = () => {
    if (gate._stopped) return;
    const sr = gate._sr = new SR(); sr.lang = lang; sr.continuous = true; sr.interimResults = true; sr.maxAlternatives = 5;
    sr.onstart = () => log(`▶ start ${lang}`);
    sr.onresult = e => {
      fails = 0;
      // Real captures taught us two things: the chant arrives in FRAGMENTS —
      // so match the session's whole utterance joined up — and it often hides
      // in the n-best alternatives below a commoner word — so scan them all.
      const all = Array.from(e.results).map(r => r[0].transcript.trim()).filter(Boolean).join(' ');
      const last = e.results[e.results.length - 1], t = (last[0].transcript || '').trim();
      if (!all) return;
      const alts = []; for (let j = 0; j < last.length; j++) alts.push(last[j].transcript.trim());
      const hitWord = chantHits(all)[0] || alts.map(a => chantHits(a)[0]).find(Boolean) || null;
      log(`🗣 [${lang}${last.isFinal ? '·final' : ''}] "${t}" ⇒ "${all}"${alts.length > 1 ? ` alt[${alts.slice(1).join(' | ')}]` : ''}${hitWord ? ` ✦ MATCH (${hitWord})` : ''}`);
      if (onHear) onHear(all, hitWord);
      if (hitWord && onMatch) onMatch(hitWord);
    };
    sr.onerror = e => {
      log(`⚠ [${lang}] error: ${e.error}`);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { giveUp('mic bị chặn'); return; }
      if (e.error === 'audio-capture') { giveUp('không thấy mic'); return; }
      if (e.error === 'network' && ++fails >= 3) { giveUp('dịch vụ nghe không phản hồi'); return; }   // 'no-speech' etc: harmless, the onend respin covers it
    };
    sr.onend = () => { log(`■ end ${lang}`); clearTimeout(gate._t); if (!gate._stopped) setTimeout(spin, 120); };
    try { sr.start(); gate.active = true; gate._t = setTimeout(() => { try { sr.stop(); } catch {} }, recycleMs); }   // recycle — long continuous SR runs degrade
    catch (err) { log('start() threw: ' + err); giveUp('không mở được mic'); }
  };
  spin();
  return gate;
}
