// prose.js — pure HTML renderer for lesson prose (npc lines, remember cards,
// checkpoint/gift text, quiz questions/options/hints). No DOM/camera deps —
// importable from Node for tests (sibling to gesture-math.js).
//
// WHY THIS EXISTS (owner 2026-07-05, "code hiển thị cần rà soát toàn bộ"):
// no prose surface converted backtick-delimited code before this — authors
// write `say()` / `if finger == 1:` expecting code styling, but every caller
// (rememberCell's innerHTML, npcCell's typewriter, quiz-cell's textContent)
// either showed the literal backticks or (worse, rememberCell's raw
// `${t}` interpolation into innerHTML) let a stray `<`/`>` in code like
// `a + b < 6` corrupt the markup outright. renderProse() is the one shared
// fix: escape first, THEN reinterpret backticks/fences as code.
//
// Rules (in order — each step only touches text NOT already inside a tag
// produced by an earlier step, via placeholder tokens):
//  1. HTML-escape the whole string (&, <, >, ") — critical: this must
//     happen before any markup is introduced, or an escaped '<' inside a
//     fenced/inline code span would double-escape.
//  2. Fenced block: a line consisting of only ``` optionally followed by a
//     language tag, through the next standalone ``` line → <pre class="cb">
///    <code>…</code></pre>, whitespace/indentation preserved verbatim.
//  3. Remaining backtick pairs on a single line → inline `<code class="ic">
//     …</code>` chips.
//  4. **bold** → <b>…</b> (trivial passthrough only — no nested/mixed
//     emphasis, no italics; not a markdown engine).
//  5. Newlines: blank line → paragraph break; a single newline inside a
//     paragraph → <br>. (Text inside a fenced block is exempt — its newlines
//     are real line breaks in the <pre>, not paragraph breaks.)
//
// Segment-based design (segmentsOf) is reused by the npc typewriter
// (notebook-runner.js#typeBubble) so it can type char-by-char through PLAIN
// segments while still wrapping CODE segments in the same <code class="ic">
// chip renderProse would have produced — see that file for how the segments
// are walked.

export const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// rawSegmentsOf(text) → [{type:'text'|'code'|'block', value, lang?}], value is the
// RAW (un-escaped) substring — backtick/fence delimiters already stripped.
// The npc typewriter (notebook-runner.js#typeBubble) walks THIS form so it
// can reveal one raw character at a time and escape only the revealed slice
// each tick; segmentsOf/renderProse below just escape every value up front.
export function rawSegmentsOf(text) {
  const raw = String(text == null ? '' : text);
  const segs = [];
  // Fenced blocks first (they may themselves contain single backticks that
  // must NOT be reinterpreted as inline code).
  const fenceRe = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = fenceRe.exec(raw))) {
    if (m.index > last) segs.push(...inlineSegments(raw.slice(last, m.index)));
    segs.push({ type: 'block', lang: normalizeLang(m[1]), value: m[2].replace(/\n$/, '') });
    last = fenceRe.lastIndex;
  }
  if (last < raw.length) segs.push(...inlineSegments(raw.slice(last)));
  return segs;
}

// inlineSegments(chunk) — splits on backtick pairs into raw text/code
// segments (no fenced blocks here — those were already carved out above).
function inlineSegments(chunk) {
  const segs = [];
  const re = /`([^`\n]+)`/g;
  let last = 0, m;
  while ((m = re.exec(chunk))) {
    if (m.index > last) segs.push({ type: 'text', value: chunk.slice(last, m.index) });
    segs.push({ type: 'code', value: m[1] });
    last = re.lastIndex;
  }
  if (last < chunk.length) segs.push({ type: 'text', value: chunk.slice(last) });
  return segs;
}

// segmentsOf(text) → same shape as rawSegmentsOf, but each value is already
// HTML-escaped (what renderProse consumes).
export function segmentsOf(text) {
  return rawSegmentsOf(text).map(s => ({ type: s.type, lang: s.lang || '', value: escapeHtml(s.value) }));
}

// boldPass(escapedText) — **bold** → <b>…</b>. Runs on already-escaped text
// (safe: ** can't collide with &amp;/&lt;/&gt;/&quot;).
function boldPass(s) { return s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>'); }

// linesToHtml(escapedText) — blank line → paragraph break, single '\n' →
// <br>. Operates on already-escaped+bold-passed plain text.
function linesToHtml(s) {
  return s.split(/\n{2,}/).map(p => p.split('\n').join('<br>')).join('</p><p>');
}

const PY_KEYWORDS = new Set([
  'if', 'elif', 'else', 'while', 'for', 'in', 'not', 'and', 'or',
  'def', 'return', 'from', 'import', 'as', 'break', 'continue', 'pass',
]);
const PY_LITERALS = new Set(['True', 'False', 'None']);
const PY_BUILTINS = new Set(['range', 'len', 'str', 'int', 'bool', 'type', 'print', 'input']);
const COURSE_FUNCS = new Set([
  'aim_cell', 'ask', 'cell_col', 'cell_row', 'display', 'darken',
  'fire_vortex', 'freeze', 'lighten', 'read', 'read_num', 'say',
  'say_num', 'watch',
]);
const PYTHON_LIKE = new Set(['', 'py', 'python']);

function normalizeLang(lang) {
  return String(lang || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

export function codeBlockClass(lang = '') {
  const safe = normalizeLang(lang);
  return safe ? `cb lang-${safe}` : 'cb';
}

const spanTok = (cls, value) => `<span class="${cls}">${escapeHtml(value)}</span>`;
const isIdStart = ch => /[A-Za-z_]/.test(ch);
const isIdPart = ch => /[A-Za-z0-9_]/.test(ch);
const isDigit = ch => /[0-9]/.test(ch);

function highlightPythonLine(line) {
  let html = '', i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '#') { html += spanTok('tok-com', line.slice(i)); break; }
    if (ch === '"' || ch === "'") {
      const quote = ch; let j = i + 1;
      while (j < line.length) {
        if (line[j] === '\\') { j += 2; continue; }
        if (line[j] === quote) { j++; break; }
        j++;
      }
      html += spanTok('tok-str', line.slice(i, j)); i = j; continue;
    }
    if (isDigit(ch)) {
      let j = i + 1;
      while (j < line.length && /[0-9_]/.test(line[j])) j++;
      if (line[j] === '.' && isDigit(line[j + 1])) {
        j++;
        while (j < line.length && /[0-9_]/.test(line[j])) j++;
      }
      html += spanTok('tok-num', line.slice(i, j)); i = j; continue;
    }
    if (isIdStart(ch)) {
      let j = i + 1;
      while (j < line.length && isIdPart(line[j])) j++;
      const word = line.slice(i, j);
      let k = j;
      while (k < line.length && /\s/.test(line[k])) k++;
      const cls = PY_KEYWORDS.has(word) ? 'tok-kw'
        : PY_LITERALS.has(word) ? 'tok-lit'
        : PY_BUILTINS.has(word) || COURSE_FUNCS.has(word) ? 'tok-builtin'
        : line[k] === '(' ? 'tok-fn'
        : '';
      html += cls ? spanTok(cls, word) : escapeHtml(word);
      i = j; continue;
    }
    if (/[+\-*/%=<>!:.,()[\]{}]/.test(ch)) { html += spanTok('tok-op', ch); i++; continue; }
    html += escapeHtml(ch); i++;
  }
  return html;
}

export function highlightCode(raw, lang = '') {
  const source = String(raw == null ? '' : raw).replace(/\r\n/g, '\n');
  return PYTHON_LIKE.has(normalizeLang(lang))
    ? source.split('\n').map(highlightPythonLine).join('\n')
    : escapeHtml(source);
}

// renderProse(text) → HTML string. The one shared renderer for every prose
// surface (npc/remember/checkpoint/gift/quiz question+options+hint). See
// module header for the full rule list.
export function renderProse(text) {
  const segs = rawSegmentsOf(text);
  let html = '';
  segs.forEach(seg => {
    if (seg.type === 'block') html += `<pre class="${codeBlockClass(seg.lang)}"><code>${highlightCode(seg.value, seg.lang)}</code></pre>`;
    else if (seg.type === 'code') html += `<code class="ic">${escapeHtml(seg.value)}</code>`;
    else html += linesToHtml(boldPass(escapeHtml(seg.value)));
  });
  return html;
}

// plainText(text) — the same content with all markup rules applied EXCEPT
// escaping, used by the npc typewriter to know the true reveal length/order
// per segment (see segmentsOf — the typewriter walks segments directly
// rather than this flattened form, but tests/callers that just need
// "what would a human read" can use this).
export function plainText(text) {
  return segmentsOf(text).map(s => s.value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')).join('');
}
