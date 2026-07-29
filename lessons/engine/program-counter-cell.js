import { renderProse } from './prose.js';

const clampDelay = value => Math.max(0, Math.min(4000, Number(value) || 1400));

export function normalizeProgramCounter(raw = {}) {
  const cards = Array.isArray(raw.cards) ? raw.cards.map(card => {
    const number = Math.trunc(Number(card?.number));
    if (typeof card?.test === 'string') return { kind: 'test', number, test: card.test, result: card.result === true, yes: Math.trunc(Number(card.yes)), no: Math.trunc(Number(card.no)) };
    if (typeof card?.action === 'string') return { kind: 'action', number, action: card.action, goto: Math.trunc(Number(card.goto)) };
    return { kind: 'output', number, output: String(card?.output ?? ''), goto: Math.trunc(Number(card?.goto)) };
  }).filter(card => Number.isInteger(card.number) && (card.kind === 'test' ? Number.isInteger(card.yes) && Number.isInteger(card.no) : Number.isInteger(card.goto))) : [];
  const frames = Array.isArray(raw.frames) ? raw.frames.map(step => ({
    phase: String(step?.phase || 'select'),
    pc: Math.trunc(Number(step?.pc)),
    card: step?.card == null ? null : Math.trunc(Number(step.card)),
    output: Array.isArray(step?.output) ? step.output.map(String) : [],
    memory: String(step?.memory || ''),
    message: String(step?.message || ''),
  })).filter(step => Number.isInteger(step.pc) && (step.card === null || Number.isInteger(step.card)) && step.message) : [];
  return {
    title: String(raw.title || 'MÁY THẺ GOTO'),
    intro: String(raw.intro || 'Bấm từng bước để quan sát máy.'),
    start: Number.isInteger(raw.start) ? raw.start : 10,
    end: Number.isInteger(raw.end) ? raw.end : 99,
    observeMs: clampDelay(raw.observeMs),
    history: raw.history === true,
    cards,
    frames,
  };
}

export function traceProgramCounter(raw = {}) {
  const cfg = normalizeProgramCounter(raw);
  if (cfg.frames.length) return { cfg, steps: cfg.frames };
  const byNumber = new Map(cfg.cards.map(card => [card.number, card]));
  const steps = [{ phase: 'start', pc: cfg.start, card: null, output: [], message: `Máy khởi động và gán pc = ${cfg.start}.` }];
  const output = [];
  let pc = cfg.start;
  let turns = 0;
  while (pc !== cfg.end && turns < 20) {
    const card = byNumber.get(pc);
    if (!card) {
      steps.push({ phase: 'missing', pc, card: null, output: [...output], message: `pc đang là ${pc}, nhưng chương trình không có thẻ ${pc}. Máy không thể chạy tiếp.` });
      break;
    }
    steps.push({ phase: 'select', pc, card: card.number, output: [...output], message: `pc đang là ${pc}. Máy tìm và chọn thẻ ${card.number}.` });
    if (card.kind === 'test') {
      const resultText = card.result ? 'ĐÚNG' : 'SAI';
      steps.push({ phase: 'test', pc, card: card.number, output: [...output], memory: `${card.test} → ${resultText}`, message: `Máy kiểm tra ${card.test}. Kết quả là ${resultText}.` });
      const oldPc = pc;
      pc = card.result ? card.yes : card.no;
      steps.push({ phase: 'goto', pc, card: card.number, output: [...output], memory: `${card.test} → ${resultText}`, message: `Kết quả ${resultText} nên máy chọn lối ${card.result ? 'YES' : 'NO'} và gán lại pc: ${oldPc} → ${pc}.` });
      turns++;
      continue;
    }
    if (card.kind === 'action') {
      steps.push({ phase: 'action', pc, card: card.number, output: [...output], memory: card.action, message: `Máy thực hiện ${card.action}.` });
      const oldPc = pc;
      pc = card.goto;
      steps.push({ phase: 'goto', pc, card: card.number, output: [...output], memory: card.action, message: `Sau đó GOTO ${pc} gán lại pc: ${oldPc} → ${pc}.` });
      turns++;
      continue;
    }
    if (card.output !== '') output.push(card.output);
    steps.push({ phase: 'output', pc, card: card.number, output: [...output], message: card.output === '' ? `Ô OUTPUT của thẻ ${card.number} để trống, nên máy không in thêm gì.` : `Máy đọc ô OUTPUT của thẻ ${card.number} và in ${card.output}.` });
    const oldPc = pc;
    pc = card.goto;
    const ending = pc === cfg.end;
    steps.push({
      phase: 'goto', pc, card: card.number, output: [...output],
      message: ending
        ? `Ô GOTO của thẻ ${card.number} là ${cfg.end}. Máy gán pc = ${cfg.end}; đây là END nên máy dừng, không tìm thẻ ${cfg.end}.`
        : `Ô GOTO của thẻ ${card.number} là ${pc}. Máy gán lại pc: ${oldPc} → ${pc}.`,
    });
    turns++;
  }
  if (turns >= 20 && pc !== cfg.end) steps.push({ phase: 'limit', pc, card: null, output: [...output], message: 'Máy đã đi qua quá nhiều thẻ. Hãy kiểm tra xem GOTO có tạo đường đi lặp mãi hay không.' });
  return { cfg, steps };
}

const pcOutputText = values => values?.length ? values.join(' → ') : '(trống)';
const pcChoices = (correct, distractors) => {
  const options = [correct, ...distractors].filter((value, index, all) => value && all.indexOf(value) === index).slice(0, 3);
  while (options.length < 2) options.push('(không đổi)');
  return { options, correct: 0 };
};

export function deriveProgramCounterPrediction(step, previousStep, cfg) {
  if (!step || step.phase === 'start' || step.phase === 'missing' || step.phase === 'limit') return null;
  if (step.phase === 'select') {
    const correct = `Thẻ ${step.card}`;
    const otherCards = cfg.cards.filter(card => card.number !== step.card).map(card => `Thẻ ${card.number}`);
    return { q: `Khi \`pc = ${step.pc}\`, máy sẽ chọn thẻ nào?`, ...pcChoices(correct, [...otherCards, `END ${cfg.end}`]) };
  }
  if (step.phase === 'test') {
    const correct = /→\s*ĐÚNG/i.test(step.memory) ? 'ĐÚNG' : 'SAI';
    return { q: `Điều kiện trên thẻ ${step.card} cho kết quả nào?`, options: ['ĐÚNG', 'SAI'], correct: correct === 'ĐÚNG' ? 0 : 1 };
  }
  if (step.phase === 'output') {
    const correct = pcOutputText(step.output);
    return { q: `Sau khi đọc OUTPUT của thẻ ${step.card}, máy đã in gì?`, ...pcChoices(correct, [pcOutputText(previousStep?.output), '(trống)']) };
  }
  if (step.phase === 'action') {
    return { q: `Sau thao tác trên thẻ ${step.card}, trạng thái nào đúng?`, ...pcChoices(step.memory, [previousStep?.memory, '(không đổi)']) };
  }
  if (step.phase === 'goto') {
    const correct = `pc = ${step.pc}`;
    return { q: 'Sau bước GOTO, `pc` sẽ bằng bao nhiêu?', ...pcChoices(correct, [`pc = ${previousStep?.pc}`, `pc = ${step.card}`]) };
  }
  return null;
}

export function alignProgramCounter(el) {
  if (!el || typeof el.scrollIntoView !== 'function') return;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  const headerBottom = document.querySelector('.hdr')?.getBoundingClientRect().bottom || 0;
  const targetTop = headerBottom + 8;
  const actualTop = el.getBoundingClientRect().top;
  if (actualTop < targetTop && typeof window !== 'undefined') window.scrollBy({ top: actualTop - targetTop, behavior: 'instant' });
}

export function programCounterCell(c, { completeCell }) {
  const { cfg, steps } = traceProgramCounter(c.programCounter);
  const predictions = steps.map((step, index) => deriveProgramCounterPrediction(step, steps[index - 1], cfg));
  const el = document.createElement('section');
  el.className = 'program-counter';
  const fit = document.createElement('div'); fit.className = 'pcfit';

  const head = document.createElement('div'); head.className = 'pchead';
  const title = document.createElement('strong'); title.textContent = cfg.title;
  const progress = document.createElement('span'); progress.textContent = `0 / ${steps.length}`;
  head.append(title, progress);

  const intro = document.createElement('div'); intro.className = 'pcintro'; intro.innerHTML = renderProse(cfg.intro);
  const history = document.createElement('div'); history.className = 'pchistory';
  if (cfg.history) {
    const artifact = document.createElement('div'); artifact.className = 'pchistory-art'; artifact.setAttribute('aria-label', 'Tấm thẻ bìa có các lỗ được bấm theo hàng');
    const sample = document.createElement('div'); sample.className = 'punch-card-sample';
    const sampleTitle = document.createElement('b'); sampleTitle.textContent = 'PUNCH CARD · THẺ ĐỤC LỖ';
    const holes = document.createElement('div'); holes.className = 'punch-holes';
    for (let i = 0; i < 50; i++) {
      const hole = document.createElement('i');
      if ([1, 4, 8, 12, 13, 19, 22, 27, 31, 34, 38, 43, 47].includes(i)) hole.className = 'punched';
      holes.appendChild(hole);
    }
    const sampleNote = document.createElement('small'); sampleNote.textContent = 'Mẫu lỗ minh họa';
    sample.append(sampleTitle, holes, sampleNote);
    const arrow = document.createElement('span'); arrow.className = 'punch-feed'; arrow.textContent = '→ KHE ĐỌC';
    artifact.append(sample, arrow);
    const copy = document.createElement('div'); copy.className = 'pchistory-copy';
    copy.innerHTML = '<b>Trước khi bàn phím và màn hình trở nên phổ biến</b><span>Người ta có thể bấm lỗ lên thẻ bìa. Máy đọc vị trí có lỗ hoặc không có lỗ thành dữ liệu và lệnh. Một chồng thẻ là INPUT vật lý cho một lượt chạy.</span><em>Mô hình trong bài viết SỐ THẺ, OUTPUT và GOTO bằng chữ để dễ quan sát. Đây là mô hình học GOTO, không phải bản sao chính xác của mọi máy thẻ đục lỗ.</em>';
    history.append(artifact, copy);
  }
  const layout = document.createElement('div'); layout.className = 'pclayout';
  const program = document.createElement('div'); program.className = 'pcprogram';
  const programTitle = document.createElement('div'); programTitle.className = 'pctitle'; programTitle.textContent = 'CHƯƠNG TRÌNH THẺ';
  const cardList = document.createElement('div'); cardList.className = 'pccards';
  cfg.cards.forEach(card => {
    const cardEl = document.createElement('article'); cardEl.className = 'pccard'; cardEl.dataset.card = String(card.number);
    const holeStrip = document.createElement('div'); holeStrip.className = 'pccard-holes'; holeStrip.setAttribute('aria-hidden', 'true');
    const targetSeed = card.kind === 'test' ? card.yes + card.no : card.goto;
    for (let i = 0; i < 24; i++) {
      const hole = document.createElement('i');
      if ((i * 7 + card.number + targetSeed) % 11 < 4) hole.className = 'punched';
      holeStrip.appendChild(hole);
    }
    const cardHead = document.createElement('b'); cardHead.textContent = `THẺ ${card.number}`;
    cardEl.append(holeStrip, cardHead);
    if (card.kind === 'test') {
      for (const [label, value] of [['TEST', card.test], ['YES', card.yes], ['NO', card.no]]) { const row = document.createElement('div'); row.innerHTML = `<span>${label}</span><code>${renderProse(String(value))}</code>`; cardEl.appendChild(row); }
      cardEl.classList.add('test-card');
    } else if (card.kind === 'action') {
      for (const [label, value] of [['ACTION', card.action], ['GOTO', card.goto]]) { const row = document.createElement('div'); row.innerHTML = `<span>${label}</span><code>${renderProse(String(value))}</code>`; cardEl.appendChild(row); }
      cardEl.classList.add('action-card');
    } else {
      const outputRow = document.createElement('div'); outputRow.innerHTML = `<span>OUTPUT</span><code>${renderProse(card.output || '(trống)')}</code>`;
      const gotoRow = document.createElement('div'); gotoRow.innerHTML = `<span>GOTO</span><code>${card.goto}</code>`;
      cardEl.append(outputRow, gotoRow);
    }
    cardList.appendChild(cardEl);
  });
  program.append(programTitle, cardList);

  const machine = document.createElement('div'); machine.className = 'pcmachine';
  const machineTitle = document.createElement('div'); machineTitle.className = 'pctitle'; machineTitle.textContent = 'MÁY ĐANG LÀM GÌ?';
  const prediction = document.createElement('div'); prediction.className = 'pcpredict'; prediction.hidden = true;
  const cycle = document.createElement('div'); cycle.className = 'pccycle';
  const phases = [['start', 'KHỞI ĐỘNG'], ['select', 'TÌM THẺ']];
  if (cfg.cards.some(card => card.kind === 'test') || cfg.frames.some(step => step.phase === 'test')) phases.push(['test', 'KIỂM TRA']);
  phases.push(['output', 'IN OUTPUT']);
  if (cfg.cards.some(card => card.kind === 'action') || cfg.frames.some(step => step.phase === 'action')) phases.push(['action', 'GÁN LẠI']);
  phases.push(['goto', 'ĐỔI pc']);
  cycle.style.gridTemplateColumns = `repeat(${phases.length},1fr)`;
  for (const [phase, label] of phases) {
    const item = document.createElement('span'); item.dataset.phase = phase; item.textContent = label; cycle.appendChild(item);
  }
  const state = document.createElement('div'); state.className = 'pcstate';
  state.innerHTML = '<span>PROGRAM COUNTER</span><strong>pc = —</strong>';
  const memory = document.createElement('div'); memory.className = 'pcmemory'; memory.hidden = true;
  const output = document.createElement('div'); output.className = 'pcoutput';
  output.innerHTML = '<span>OUTPUT</span><div>(trống)</div>';
  const pip = document.createElement('div'); pip.className = 'pcpip';
  pip.innerHTML = '<div class="avatar"><i></i></div><div class="bubble"><b>PIP GIẢI THÍCH BƯỚC NÀY</b><span></span></div>';
  pip.querySelector('span').innerHTML = renderProse(cfg.intro);
  machine.append(machineTitle, prediction, cycle, state, memory, output, pip);
  layout.append(program, machine);

  const controls = document.createElement('div'); controls.className = 'pccontrols';
  const hint = document.createElement('span'); hint.textContent = 'Đây là mô hình máy thẻ, không phải trình chạy từng dòng Python.';
  const button = document.createElement('button'); button.type = 'button'; button.textContent = '▶ KHỞI ĐỘNG MÁY';
  controls.append(hint, button);
  fit.append(head, intro);
  if (cfg.history) fit.appendChild(history);
  fit.append(layout, controls);
  el.appendChild(fit);

  let index = 0;
  let busy = false;
  let predictionChoice = null;
  let historyOpen = cfg.history;
  if (historyOpen) {
    layout.hidden = true;
    progress.textContent = 'LÀM QUEN';
    hint.textContent = 'Nhìn tấm bìa, các lỗ và khe đọc trước khi mở máy GOTO.';
    button.textContent = '▶ TIẾP: MỞ MÁY THẺ';
  }
  const fitCell = () => requestAnimationFrame(() => {
    const headerBottom = document.querySelector('.hdr')?.getBoundingClientRect().bottom || 0;
    const viewportWidth = document.documentElement.clientWidth || innerWidth;
    const viewportHeight = document.documentElement.clientHeight || innerHeight;
    const availableWidth = Math.max(280, Math.min(1040, viewportWidth - 20));
    const availableHeight = Math.max(300, viewportHeight - headerBottom - 28);
    let scale = 1;
    let contentWidth = availableWidth;
    let contentHeight = 1;
    for (let pass = 0; pass < 3; pass++) {
      fit.style.transform = 'none';
      fit.style.width = `${contentWidth}px`;
      contentHeight = fit.scrollHeight + 2;
      scale = Math.min(1, availableHeight / Math.max(1, contentHeight));
      contentWidth = Math.min(1240, availableWidth / Math.max(.01, scale));
    }
    fit.style.width = `${contentWidth}px`;
    contentHeight = fit.scrollHeight + 2;
    scale = Math.min(1, availableWidth / contentWidth, availableHeight / Math.max(1, contentHeight));
    fit.style.transform = `scale(${scale})`;
    fit.style.transformOrigin = 'top left';
    el.style.width = `${contentWidth * scale}px`;
    el.style.height = `${contentHeight * scale}px`;
    el.dataset.scale = scale.toFixed(4);
  });
  el._arm = () => { fitCell(); alignProgramCounter(el); };
  el.addEventListener?.('animationend', event => { if (!event.animationName || event.animationName === 'cellin') { fitCell(); alignProgramCounter(el); } });
  addEventListener('resize', fitCell);
  document.fonts?.ready?.then(fitCell);
  fitCell();
  const paintUpcoming = () => {
    cycle.querySelectorAll('span').forEach(item => item.classList.toggle('next', item.dataset.phase === steps[index]?.phase));
  };
  paintUpcoming();
  const stateParts = [cycle, state, memory, output, pip];
  const showPrediction = visible => {
    prediction.hidden = !visible;
    stateParts.forEach(part => { part.hidden = visible || (part === memory && !part.textContent); });
  };
  const prepareStep = () => {
    const step = steps[index];
    if (!step) return;
    predictionChoice = null; prediction.innerHTML = '';
    const prompt = predictions[index];
    if (!prompt) {
      el.dataset.viewPhase = 'ready'; showPrediction(false); button.disabled = false;
      button.textContent = index === 0 ? '▶ KHỞI ĐỘNG MÁY' : `▶ BƯỚC TIẾP: ${{ select: 'TÌM THẺ', test: 'KIỂM TRA', output: 'IN OUTPUT', action: 'GÁN LẠI', goto: 'ĐỌC GOTO' }[step.phase] || 'XỬ LÝ'}`;
      return;
    }
    el.dataset.viewPhase = 'predict'; showPrediction(true);
    const label = document.createElement('b'); label.textContent = 'DỰ ĐOÁN TRƯỚC KHI MÁY LÀM';
    const question = document.createElement('div'); question.className = 'pcpredict-q'; question.innerHTML = renderProse(prompt.q);
    const choices = document.createElement('div'); choices.className = 'pcpredict-options';
    prompt.options.forEach((option, choiceIndex) => {
      const choice = document.createElement('button'); choice.type = 'button'; choice.className = 'pcpredict-option'; choice.innerHTML = renderProse(option);
      choice.onclick = () => {
        predictionChoice = choiceIndex;
        choices.querySelectorAll('button').forEach((item, itemIndex) => { item.disabled = true; item.classList.toggle('chosen', itemIndex === choiceIndex); });
        hint.textContent = 'Đã ghi dự đoán. Bây giờ cho máy làm bước này để kiểm chứng.';
        button.disabled = false; button.textContent = '▶ THỰC HIỆN BƯỚC ĐỂ KIỂM CHỨNG'; fitCell();
      };
      choices.appendChild(choice);
    });
    prediction.append(label, question, choices);
    hint.textContent = 'Chọn điều bạn nghĩ máy sẽ làm trước khi xem kết quả.';
    button.disabled = true; button.textContent = 'CHỌN MỘT DỰ ĐOÁN BÊN PHẢI'; fitCell();
  };
  if (!historyOpen) prepareStep();

  button.onclick = async () => {
    if (busy) return;
    if (historyOpen) {
      historyOpen = false;
      history.hidden = true;
      layout.hidden = false;
      progress.textContent = `0 / ${steps.length}`;
      hint.textContent = 'Đây là mô hình máy thẻ, không phải trình chạy từng dòng Python.';
      prepareStep();
      fitCell();
      requestAnimationFrame(() => alignProgramCounter(el));
      return;
    }
    if (index >= steps.length) {
      button.disabled = true; button.textContent = '✓ ĐÃ QUAN SÁT XONG'; controls.classList.add('finished'); completeCell(el); return;
    }
    alignProgramCounter(el);
    busy = true; button.disabled = true;
    const step = steps[index];
    const prompt = predictions[index]; showPrediction(false); el.dataset.viewPhase = 'state';
    cycle.querySelectorAll('span').forEach(item => item.classList.toggle('active', item.dataset.phase === step.phase));
    cardList.querySelectorAll('.pccard').forEach(card => card.classList.toggle('active', Number(card.dataset.card) === step.card));
    state.querySelector('strong').textContent = `pc = ${step.pc}`;
    state.classList.toggle('end', step.phase === 'goto' && step.pc === cfg.end);
    output.querySelector('div').textContent = step.output.length ? step.output.join(' → ') : '(trống)';
    memory.hidden = !step.memory;
    memory.textContent = step.memory ? `TRẠNG THÁI: ${step.memory}` : '';
    const predictionNote = prompt && predictionChoice !== null
      ? predictionChoice === prompt.correct ? 'Dự đoán khớp. ' : 'Kết quả khác dự đoán. '
      : '';
    pip.querySelector('.bubble span').innerHTML = renderProse(step.message);
    el.dataset.phase = step.phase;
    el.dataset.pc = String(step.pc);
    el.dataset.output = step.output.join('|');
    fitCell();
    hint.textContent = predictionNote
      ? `${predictionNote.trim()} — nhìn pc, thẻ sáng và OUTPUT.`
      : `Dừng ${String(cfg.observeMs / 1000).replace('.', ',')} giây để nhìn pc, thẻ sáng và OUTPUT.`;
    button.textContent = 'ĐANG DỪNG ĐỂ BẠN QUAN SÁT...';
    if (cfg.observeMs) await new Promise(resolve => setTimeout(resolve, cfg.observeMs));
    index++; progress.textContent = `${index} / ${steps.length}`;
    paintUpcoming();
    if (index < steps.length) prepareStep();
    else { el.dataset.viewPhase = 'done'; button.textContent = '✓ MÌNH ĐÃ HIỂU ĐƯỜNG ĐI'; button.disabled = false; }
    busy = false;
    fitCell();
  };
  return el;
}
