// chant-match.js — pure transcript matcher for the onboarding chant "CODE!"
// (kids yell it as "code" / "khô" / "khâu"). No DOM/SpeechRecognition deps, so
// it's testable in isolation (sibling to gesture-math.js). A one-syllable
// chant makes the old vowel-sequence distance useless (every sentence has an
// "o"), so matching is WORD-LEVEL: fold diacritics, split into words, pass if
// any word is in the accept set (likely vi-VN hearings) or within edit
// distance 1 of "code" (likely en-US hearings: "codes", "mode"…). Deliberately
// NOT accepted: "co"/"cho" — folds of "có"/"cho", the most common words in
// Vietnamese speech, would fire on any chatter. The palm-hold requirement
// gates false positives further. (The longer-chant vowel matcher lives in git
// history if a multi-syllable chant ever returns.)

export const CHANT_WORD = 'code';
export const CHANT_ACCEPT = ['code', 'cod', 'kod', 'kot', 'kho', 'khau', 'cot', 'goud', 'coud', 'koda', 'kota'];   // koda/kota: en-US hearing a Vietnamese-accented "khô-đơ"

const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Phonetic tier — a bespoke mini-Metaphone for this ONE word. Real captures
// of a kid yelling "CODE!" came back as "got", "count", "cold": ASR picks a
// common word with the same SOUND SKELETON. So: fold consonants into sound
// classes (c/k/g/q → K, d/t → T, h silent), keep the vowel core, and accept
// any word whose skeleton is K…T with at most one liquid/nasal in between
// (KT / KLT / KNT / KRT — cold, count) AND whose vowel core sounds like "o"
// (got/cold/count/goat ✓, cat/gate/kit ✗).
const PHONE = { c: 'k', k: 'k', g: 'k', q: 'k', d: 't', t: 't', h: '' };
export function phoneMatch(w) {
  const cons = w.replace(/[aeiou]/g, '').split('').map(ch => PHONE[ch] ?? ch).join('').replace(/(.)\1+/g, '$1');
  return /^k[lnr]?t$/.test(cons) && /[ou]/.test(w);
}

// chantHits(transcript) — the matched words (for the debug probe); empty = no match.
export function chantHits(transcript) {
  const acc = new Set(CHANT_ACCEPT);
  return fold(transcript).split(/[^a-z]+/).filter(w => w && (acc.has(w) || levenshtein(w, CHANT_WORD) <= 1 || phoneMatch(w)));
}

export function matchChant(transcript) { return chantHits(transcript).length > 0; }

// ── generalized word matcher (RITUAL-VARIANTS-PLAN.md Part B) ──
// matchWord(transcript, target, accept) — same fold/accept-set tier as
// matchChant, but target-parameterized for any node's taught word (e.g.
// "say", "read"). Two extra tiers (edit-distance ≤1, phonetic skeleton) are
// SKIPPED for short targets: a folded target of SHORT_TARGET_LEN (3) chars
// or fewer has too many real-word neighbours at edit distance 1 ("say" ~
// "sat"/"sad"/"way"/"stay"…) or with a matching coarse skeleton ("say" ~
// "sao", one of the commonest Vietnamese words) — loosening there would
// false-positive on ordinary chatter. Short targets rely on an exact
// fold-match plus a hand-tuned `accept` list instead, same discipline as
// CHANT_ACCEPT. Longer targets (≥4 chars) get the full tier stack.
export const SHORT_TARGET_LEN = 3;

// generic consonant-class skeleton (coarse Metaphone, not the "code"-only
// K…T/o-core rule above) — c/k/g/q→k, d/t→t, h silent, s/x/z→s (Vietnamese
// "x" is pronounced like an unvoiced "s", the actual real-world mishearing
// this exists for), b/p→p, f/v→f; vowels stripped entirely so only the
// consonant skeleton is compared. Gated to targets ≥4 chars (see above).
const SOUND_CLASS = { c: 'k', k: 'k', g: 'k', q: 'k', d: 't', t: 't', h: '', s: 's', x: 's', z: 's', b: 'p', p: 'p', f: 'v', v: 'v' };
function soundSkeleton(w) {
  return w.replace(/[aeiouy]/g, '').split('').map(ch => SOUND_CLASS[ch] ?? ch).join('').replace(/(.)\1+/g, '$1');
}

// wordHits(transcript, target, accept) — the matched words (debug probe);
// empty = no match. `accept` is folded the same as the transcript so callers
// may pass raw (possibly-accented) hand-tuned mishearings.
export function wordHits(transcript, target, accept = []) {
  const t = fold(target), acc = new Set(accept.map(fold));
  const loose = t.length > SHORT_TARGET_LEN;
  return fold(transcript).split(/[^a-z]+/).filter(w => w && (
    w === t || acc.has(w) || (loose && (levenshtein(w, t) <= 1 || soundSkeleton(w) === soundSkeleton(t)))
  ));
}

export function matchWord(transcript, target, accept = []) { return wordHits(transcript, target, accept).length > 0; }
