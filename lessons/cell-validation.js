// cell-validation.js — pure output-matching for lesson code cells (no DOM/worker deps).
// Standalone so it's require()-able from a plain Node test (node.js touches document at
// load time and can't be required directly). Loaded as a bare global via <script> in the
// lesson HTML, before node.js, which calls it as `cellOutputSatisfies(...)`.
//
// expectOut shapes (cell config's `expectOut` field):
//   string   — case-insensitive substring match against any captured .text
//   RegExp   — .test() against any captured .text
//   array    — of strings/regexes; passes if ANY entry matches (OR)
//   object   — map keyed by heldCount (e.g. {1: /fire/i, 3: /light/i}); looks up
//              expectOut[heldCount] and recurses. Missing key = pass (no expectation
//              for that branch — e.g. an untested finger count).
//   {all:[…]} — every entry must match (AND) — e.g. requiring several distinct
//              lines to all be present, unlike the plain array's OR semantics.
//   {minLines:N} — captured.length >= N, regardless of content — for
//              exercises where the STUDENT'S extra line can say anything, so
//              content can't be matched, but a minimum line count still
//              proves they actually added it instead of skipping the step.
//   {kind:K,minCount:N,text?:matcher} — at least N events of kind K; optional
//              text matcher must pass for every event counted. Use this for
//              animation contracts where unrelated events must not inflate
//              the frame count.
// captured: array of {kind, text} tell-events recorded during the run.
function cellOutputSatisfies(expectOut, captured, heldCount) {
  if (expectOut == null) return true;                  // no expectation configured — always pass
  captured = captured || [];
  if (expectOut instanceof RegExp) return captured.some(c => expectOut.test(String(c.text)));
  if (typeof expectOut === 'string') { const needle = expectOut.toLowerCase();
    return captured.some(c => String(c.text).toLowerCase().includes(needle)); }
  if (Array.isArray(expectOut)) return expectOut.some(sub => cellOutputSatisfies(sub, captured, heldCount));
  if (typeof expectOut === 'object' && Array.isArray(expectOut.all))
    return expectOut.all.every(sub => cellOutputSatisfies(sub, captured, heldCount));
  if (typeof expectOut === 'object' && typeof expectOut.minLines === 'number')
    return captured.length >= expectOut.minLines;
  if (typeof expectOut === 'object' && typeof expectOut.kind === 'string') {
    const minimum = typeof expectOut.minCount === 'number' ? expectOut.minCount : 1;
    const matching = captured.filter(event => event.kind === expectOut.kind
      && (expectOut.text == null || cellOutputSatisfies(expectOut.text, [event], heldCount)));
    return matching.length >= minimum;
  }
  if (typeof expectOut === 'object') {                 // held-finger-count map
    const key = String(heldCount);
    if (!(key in expectOut)) return true;               // no expectation for this branch
    return cellOutputSatisfies(expectOut[key], captured, heldCount);
  }
  return true;
}
// expectOutHint(expectOut, captured, heldCount) — a clean-but-failing run is
// silent about WHY it failed unless we look at the expectOut shape itself.
// Mirrors cellOutputSatisfies' shape-matching so every graded cell can tell
// the student what's still missing, in Pip's kids'-Vietnamese voice. Only
// the MESSAGE is derived here — pass/fail stays cellOutputSatisfies' job.
function expectOutHint(expectOut, captured, heldCount) {
  captured = captured || [];
  if (expectOut == null) return null;
  if (expectOut instanceof RegExp || typeof expectOut === 'string')
    return 'Kết quả chưa có phần mong đợi — xem lại đề rồi thử lại nhé.';
  if (Array.isArray(expectOut))
    return 'Kết quả chưa có phần mong đợi — xem lại đề rồi thử lại nhé.';
  if (typeof expectOut === 'object' && typeof expectOut.minLines === 'number') {
    const n = expectOut.minLines, have = captured.length;
    return `Cần ít nhất ${n} dòng kết quả — mới có ${have} dòng, viết thêm một lệnh say(...) nữa rồi RUN lại nhé!`;
  }
  if (typeof expectOut === 'object' && typeof expectOut.kind === 'string') {
    const minimum = typeof expectOut.minCount === 'number' ? expectOut.minCount : 1;
    const matching = captured.filter(event => event.kind === expectOut.kind
      && (expectOut.text == null || cellOutputSatisfies(expectOut.text, [event], heldCount))).length;
    return `Cần ít nhất ${minimum} khung ${expectOut.kind} hợp lệ — hiện mới có ${matching}. Hãy hoàn thiện phần tạo hình rồi RUN lại nhé!`;
  }
  if (typeof expectOut === 'object' && Array.isArray(expectOut.all)) {
    for (const sub of expectOut.all) if (!cellOutputSatisfies(sub, captured, heldCount)) return expectOutHint(sub, captured, heldCount);
    return 'Kết quả chưa có phần mong đợi — xem lại đề rồi thử lại nhé.';
  }
  if (typeof expectOut === 'object') {                 // held-finger-count map
    const key = String(heldCount);
    if (key in expectOut) return expectOutHint(expectOut[key], captured, heldCount);
    return 'Chưa đúng dấu tay mong đợi — xem lại đề rồi giơ tay thử lại nhé.';
  }
  return 'Kết quả chưa có phần mong đợi — xem lại đề rồi thử lại nhé.';
}
if (typeof module !== 'undefined') module.exports = { cellOutputSatisfies, expectOutHint };
