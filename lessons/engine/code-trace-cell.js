import { renderProse } from './prose.js';

const clampDelay = value => Math.max(0, Math.min(4000, Number(value) || 1400));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const outputText = values => values.length ? values.join(' → ') : '(trống)';
const rotateCorrect = (correct, distractors, seed) => {
  const options = [correct, ...distractors.filter(value => value !== correct)].filter((value, index, all) => all.indexOf(value) === index).slice(0, 3);
  while (options.length < 3) options.push(options.length === 1 ? '(không đổi)' : '(chưa có)');
  const shift = Math.abs(Number(seed) || 0) % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return { options: rotated, correct: rotated.indexOf(correct) };
};

function normalizePrediction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const q = String(raw.q || '').trim();
  const options = Array.isArray(raw.options) ? raw.options.map(String).filter(Boolean).slice(0, 3) : [];
  const correct = Math.trunc(Number(raw.correct));
  if (!q || options.length < 2 || correct < 0 || correct >= options.length) return null;
  return { q, options, correct };
}

export function derivePrediction(frame, previousFrame = null) {
  const currentOutput = frame?.state?.output || [];
  const previousOutput = previousFrame?.state?.output || [];
  if (!same(currentOutput, previousOutput)) {
    const correct = outputText(currentOutput);
    const last = currentOutput.at(-1);
    const distractors = [outputText(previousOutput), currentOutput.length > 1 ? outputText([...currentOutput].reverse()) : `${last} → ${last}`];
    const choices = rotateCorrect(correct, distractors, frame.line);
    return { q: `Sau dòng ${frame.line}, OUTPUT nào đúng?`, ...choices };
  }

  const current = frame?.state?.variables || {};
  const previous = previousFrame?.state?.variables || {};
  const changed = Object.keys(current).filter(name => String(current[name]) !== String(previous[name]));
  if (!changed.length) return null;
  const active = frame?.state?.visual?.items?.find(item => item?.active && changed.includes(String(item.label)))?.label;
  const name = String(active || changed.at(-1));
  const correct = String(current[name]);
  const distractors = [];
  if (previous[name] !== undefined) distractors.push(String(previous[name]));
  else distractors.push('(chưa có)');
  distractors.push(...Object.entries(current).filter(([key]) => key !== name).map(([, value]) => String(value)));
  if (/^-?\d+(?:\.\d+)?$/.test(correct)) distractors.push(String(Number(correct) + 1));
  else if (correct === 'True' || correct === 'False') distractors.push(correct === 'True' ? 'False' : 'True');
  else if (/^".*"$/.test(correct)) distractors.push(correct.slice(1, -1));
  const choices = rotateCorrect(correct, distractors, frame.line);
  return { q: `Sau dòng ${frame.line}, \`${name}\` sẽ giữ giá trị nào?`, ...choices };
}

export function normalizeCodeTrace(raw = {}) {
  const code = Array.isArray(raw.code) ? raw.code.map(String) : [];
  const baseFrames = Array.isArray(raw.frames) ? raw.frames.map((frame, index) => ({
    line: Math.max(1, Math.min(code.length || 1, Math.trunc(Number(frame?.line) || index + 1))),
    explain: String(frame?.explain || ''),
    observeMs: clampDelay(frame?.observeMs),
    predict: normalizePrediction(frame?.predict),
    state: {
      variables: frame?.state?.variables && typeof frame.state.variables === 'object' ? { ...frame.state.variables } : {},
      output: Array.isArray(frame?.state?.output) ? frame.state.output.map(String) : [],
      visual: frame?.state?.visual && typeof frame.state.visual === 'object' ? { ...frame.state.visual } : null,
    },
  })) : [];
  const frames = baseFrames.map((frame, index) => ({ ...frame, predict: frame.predict || derivePrediction(frame, baseFrames[index - 1]) }));
  return {
    title: String(raw.title || 'CHẠY TỪNG DÒNG'),
    intro: String(raw.intro || 'Mỗi lần bấm chỉ quan sát một dòng.'),
    code,
    frames,
  };
}

export function alignCodeTrace(el) {
  if (!el || typeof el.scrollIntoView !== 'function') return;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  const headerBottom = document.querySelector('.hdr')?.getBoundingClientRect().bottom || 0;
  const targetTop = headerBottom + 8;
  const actualTop = el.getBoundingClientRect().top;
  if (actualTop < targetTop && typeof window !== 'undefined') window.scrollBy({ top: actualTop - targetTop, behavior: 'instant' });
}

function renderValueVisual(host, visual) {
  host.innerHTML = '';
  const title = document.createElement('b'); title.textContent = visual?.title || 'GIÁ TRỊ VÀ KIỂU';
  const list = document.createElement('div'); list.className = 'ctvalues';
  const items = Array.isArray(visual?.items) ? visual.items : [];
  items.forEach(item => {
    const card = document.createElement('article'); card.className = 'ctvalue';
    if (item.active) card.classList.add('active');
    const label = document.createElement('span'); label.textContent = String(item.label || 'value');
    const value = document.createElement('strong'); value.textContent = String(item.value ?? '—');
    const type = document.createElement('code'); type.textContent = String(item.type || '?');
    card.append(label, value, type); list.appendChild(card);
  });
  host.append(title, list);
}

export function codeTraceCell(c, { completeCell }) {
  const cfg = normalizeCodeTrace(c.execution);
  const el = document.createElement('section'); el.className = 'code-trace';
  const fit = document.createElement('div'); fit.className = 'ctfit';
  const head = document.createElement('div'); head.className = 'cthead';
  const title = document.createElement('strong'); title.textContent = cfg.title;
  const progress = document.createElement('span'); progress.textContent = `0 / ${cfg.frames.length}`;
  head.append(title, progress);
  const intro = document.createElement('div'); intro.className = 'ctintro'; intro.innerHTML = renderProse(cfg.intro);

  const layout = document.createElement('div'); layout.className = 'ctlayout';
  const codeSide = document.createElement('div'); codeSide.className = 'ctcode mono';
  const codeTitle = document.createElement('div'); codeTitle.className = 'cttitle'; codeTitle.textContent = 'TOÀN BỘ CODE';
  const lines = document.createElement('div'); lines.className = 'ctlines';
  cfg.code.forEach((source, index) => {
    const row = document.createElement('div'); row.className = 'ctline'; row.dataset.line = String(index + 1);
    if (!source.trim()) row.classList.add('empty');
    const number = document.createElement('b'); number.textContent = String(index + 1);
    const text = document.createElement('code'); text.textContent = source || ' ';
    const status = document.createElement('span'); status.className = 'ctline-status'; status.textContent = '✓ ĐÃ CHẠY';
    row.append(number, text, status); lines.appendChild(row);
  });
  codeSide.append(codeTitle, lines);

  const observe = document.createElement('div'); observe.className = 'ctobserve';
  const observeTitle = document.createElement('div'); observeTitle.className = 'cttitle'; observeTitle.textContent = 'TRẠNG THÁI SAU DÒNG NÀY';
  const prediction = document.createElement('div'); prediction.className = 'ctpredict'; prediction.hidden = true;
  const visual = document.createElement('div'); visual.className = 'ctvisual';
  renderValueVisual(visual, { items: [] });
  const variables = document.createElement('div'); variables.className = 'ctvariables';
  const output = document.createElement('div'); output.className = 'ctoutput'; output.innerHTML = '<b>OUTPUT</b><span>(trống)</span>';
  const pip = document.createElement('div'); pip.className = 'ctpip';
  pip.innerHTML = '<div class="avatar"><i></i></div><div class="bubble"><b>PIP GIẢI THÍCH DÒNG NÀY</b><span></span></div>';
  pip.querySelector('.bubble span').innerHTML = renderProse(cfg.intro);
  observe.append(observeTitle, prediction, visual, variables, output, pip);
  layout.append(codeSide, observe);

  const controls = document.createElement('div'); controls.className = 'ctcontrols';
  const hint = document.createElement('span'); hint.textContent = 'Cell quan sát dừng ở từng dòng; code cell RUN toàn bộ chương trình.';
  const button = document.createElement('button'); button.type = 'button'; button.textContent = '▶ CHẠY DÒNG ĐẦU TIÊN';
  controls.append(hint, button);
  fit.append(head, intro, layout, controls); el.appendChild(fit);

  const selectLine = line => lines.querySelectorAll('.ctline').forEach(row => row.classList.toggle('active', Number(row.dataset.line) === line));
  const paintVariables = values => {
    variables.innerHTML = '';
    const entries = Object.entries(values);
    if (!entries.length) { variables.hidden = true; return; }
    variables.hidden = false;
    entries.forEach(([name, value]) => {
      const item = document.createElement('div');
      const key = document.createElement('code'); key.textContent = name;
      const val = document.createElement('strong'); val.textContent = String(value);
      item.append(key, val); variables.appendChild(item);
    });
  };
  const fitCell = () => requestAnimationFrame(() => {
    const headerBottom = document.querySelector('.hdr')?.getBoundingClientRect().bottom || 0;
    const viewportWidth = document.documentElement.clientWidth || innerWidth;
    const viewportHeight = document.documentElement.clientHeight || innerHeight;
    const availableWidth = Math.max(280, Math.min(1080, viewportWidth - 20));
    const availableHeight = Math.max(300, viewportHeight - headerBottom - 28);
    let scale = 1, contentWidth = availableWidth, contentHeight = 1;
    for (let pass = 0; pass < 3; pass++) {
      fit.style.transform = 'none'; fit.style.width = `${contentWidth}px`;
      contentHeight = fit.scrollHeight + 2;
      scale = Math.min(1, availableHeight / Math.max(1, contentHeight));
      contentWidth = Math.min(1240, availableWidth / Math.max(.01, scale));
    }
    fit.style.width = `${contentWidth}px`; contentHeight = fit.scrollHeight + 2;
    scale = Math.min(1, availableWidth / contentWidth, availableHeight / Math.max(1, contentHeight));
    fit.style.transform = `scale(${scale})`; fit.style.transformOrigin = 'top left';
    el.style.width = `${contentWidth * scale}px`; el.style.height = `${contentHeight * scale}px`;
    el.dataset.scale = scale.toFixed(4);
  });
  el._arm = () => { fitCell(); alignCodeTrace(el); };
  el.addEventListener?.('animationend', event => { if (!event.animationName || event.animationName === 'cellin') { fitCell(); alignCodeTrace(el); } });
  addEventListener('resize', fitCell); document.fonts?.ready?.then(fitCell);

  const stateParts = [visual, variables, output, pip];
  const showPrediction = visible => {
    prediction.hidden = !visible;
    stateParts.forEach(part => { part.hidden = visible || (part === variables && !part.childElementCount); });
  };
  let index = 0, busy = false, predictionChoice = null;
  const prepareFrame = frame => {
    if (!frame) return;
    selectLine(frame.line); predictionChoice = null; prediction.innerHTML = '';
    if (!frame.predict) { el.dataset.phase = 'ready'; showPrediction(false); button.disabled = false; button.textContent = `▶ CHẠY DÒNG ${frame.line}`; return; }
    el.dataset.phase = 'predict';
    showPrediction(true);
    const label = document.createElement('b'); label.textContent = 'DỰ ĐOÁN TRƯỚC KHI CHẠY';
    const question = document.createElement('div'); question.className = 'ctpredict-q'; question.innerHTML = renderProse(frame.predict.q);
    const choices = document.createElement('div'); choices.className = 'ctpredict-options';
    frame.predict.options.forEach((option, choiceIndex) => {
      const choice = document.createElement('button'); choice.type = 'button'; choice.className = 'ctpredict-option'; choice.innerHTML = renderProse(option);
      choice.onclick = () => {
        predictionChoice = choiceIndex;
        choices.querySelectorAll('button').forEach((item, itemIndex) => { item.disabled = true; item.classList.toggle('chosen', itemIndex === choiceIndex); });
        hint.textContent = 'Đã ghi dự đoán. Bây giờ chạy dòng để kiểm chứng.';
        button.disabled = false; button.textContent = `▶ CHẠY DÒNG ${frame.line} ĐỂ KIỂM CHỨNG`; fitCell();
      };
      choices.appendChild(choice);
    });
    prediction.append(label, question, choices);
    hint.textContent = 'Chọn kết quả bạn dự đoán trước khi máy chạy dòng này.';
    button.disabled = true; button.textContent = 'CHỌN MỘT DỰ ĐOÁN BÊN PHẢI'; fitCell();
  };
  if (cfg.frames[0]) prepareFrame(cfg.frames[0]);
  button.onclick = async () => {
    if (busy) return;
    if (index >= cfg.frames.length) { button.disabled = true; button.textContent = '✓ ĐÃ QUAN SÁT XONG'; controls.classList.add('finished'); completeCell(el); return; }
    busy = true; button.disabled = true; alignCodeTrace(el);
    const frame = cfg.frames[index]; selectLine(frame.line); showPrediction(false); el.dataset.phase = 'state';
    lines.querySelector(`.ctline[data-line="${frame.line}"]`)?.classList.add('executed');
    const predictionNote = frame.predict && predictionChoice !== null
      ? predictionChoice === frame.predict.correct ? 'Dự đoán của bạn khớp với kết quả. ' : 'Kết quả thật khác dự đoán. Hãy so sánh hai giá trị. '
      : '';
    pip.querySelector('.bubble span').innerHTML = renderProse(predictionNote + frame.explain);
    paintVariables(frame.state.variables);
    output.querySelector('span').textContent = frame.state.output.length ? frame.state.output.join(' → ') : '(trống)';
    if (frame.state.visual?.kind === 'value') renderValueVisual(visual, frame.state.visual);
    el.dataset.line = String(frame.line); el.dataset.output = frame.state.output.join('|');
    fitCell();
    hint.textContent = `Dừng ${String(frame.observeMs / 1000).replace('.', ',')} giây để đọc dòng và trạng thái.`;
    button.textContent = 'ĐANG DỪNG ĐỂ BẠN QUAN SÁT...';
    if (frame.observeMs) await new Promise(resolve => setTimeout(resolve, frame.observeMs));
    index++; progress.textContent = `${index} / ${cfg.frames.length}`;
    if (cfg.frames[index]) prepareFrame(cfg.frames[index]);
    else { el.dataset.phase = 'done'; button.textContent = '✓ MÌNH ĐÃ HIỂU TỪNG DÒNG'; button.disabled = false; }
    busy = false; fitCell();
  };
  fitCell();
  return el;
}
