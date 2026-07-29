import { renderProse } from './prose.js';

export function alignWalkthrough(el) {
  if (!el || typeof el.scrollIntoView !== 'function') return;
  el.scrollIntoView({ behavior: 'instant', block: 'start' });
  const headerBottom = document.querySelector('.hdr')?.getBoundingClientRect().bottom || 0;
  const targetTop = headerBottom + 8, actualTop = el.getBoundingClientRect().top;
  if (actualTop < targetTop && typeof window !== 'undefined') window.scrollBy({ top: actualTop - targetTop, behavior: 'instant' });
}

export function normalizeWalkthrough(raw = {}) {
  const code = Array.isArray(raw.code) ? raw.code.map(line => String(line)) : [];
  const executedLines = Array.isArray(raw.executedLines) ? [...new Set(raw.executedLines.map(Number).filter(line => Number.isInteger(line) && line >= 1 && line <= code.length))] : [];
  const placeholder = raw.placeholder === false ? null : raw.placeholder && typeof raw.placeholder === 'object'
    ? { src: String(raw.placeholder.src || ''), alt: String(raw.placeholder.alt || '') }
    : { src: 'assets/electronic-marquee-board.webp', alt: 'Bảng đèn đang chờ' };
  const steps = Array.isArray(raw.steps) ? raw.steps.map((step, index) => ({
    line: Math.max(1, Math.min(code.length || 1, Math.trunc(Number(step?.line) || index + 1))),
    label: String(step?.label || '').trim(),
    explain: String(step?.explain || ''),
    action: step?.action && typeof step.action === 'object' ? step.action : null,
    observeMs: Math.max(0, Math.min(4000, Number(step?.observeMs) || 0)),
    memory: String(step?.memory || ''),
  })) : [];
  return { title: String(raw.title || 'CHẠY TỪNG DÒNG'), intro: String(raw.intro || ''), codeTitle: String(raw.codeTitle || 'CODE — máy đọc từ trên xuống'), observeTitle: String(raw.observeTitle || 'QUAN SÁT — chỉ đổi sau khi chạy dòng'), hint: String(raw.hint || 'Đọc dòng được tô sáng, rồi nhìn sang phần quan sát.'), placeholder, continueScene: raw.continueScene === true, executedNote: String(raw.executedNote || ''), executedLines, code, steps };
}

export function walkthroughCell(c, { studio, scenePanel, completeCell }) {
  const cfg = normalizeWalkthrough(c.walkthrough);
  const el = document.createElement('section'); el.className = 'walkthrough';
  el.addEventListener?.('animationend', event => { if (!event.animationName || event.animationName === 'cellin') alignWalkthrough(el); });
  const head = document.createElement('div'); head.className = 'wthead';
  const title = document.createElement('strong'); title.textContent = cfg.title;
  const progress = document.createElement('span'); progress.textContent = `0 / ${cfg.steps.length}`;
  head.append(title, progress);

  const layout = document.createElement('div'); layout.className = 'wtlayout';
  const codeSide = document.createElement('div'); codeSide.className = 'wtcode mono';
  const codeTitle = document.createElement('div'); codeTitle.className = 'wtside-title'; codeTitle.textContent = cfg.codeTitle;
  if (cfg.executedNote) { const note = document.createElement('small'); note.textContent = cfg.executedNote; codeTitle.appendChild(note); }
  const lines = document.createElement('div'); lines.className = 'wtlines';
  cfg.code.forEach((source, index) => {
    const row = document.createElement('div'); row.className = 'wtline'; row.dataset.line = String(index + 1);
    const number = document.createElement('b'); number.textContent = String(index + 1);
    const text = document.createElement('code'); text.textContent = source || ' ';
    const status = document.createElement('span'); status.className = 'wtline-status'; status.textContent = '✓ ĐÃ CHẠY';
    if (cfg.executedLines.includes(index + 1)) row.classList.add('executed');
    row.append(number, text, status); lines.appendChild(row);
  });
  codeSide.append(codeTitle, lines);

  const observeSide = document.createElement('div'); observeSide.className = 'wtobserve';
  const observeShell = document.createElement('div'); observeShell.className = 'wtobserve-shell'; observeShell.appendChild(observeSide);
  const observeTitle = document.createElement('div'); observeTitle.className = 'wtside-title'; observeTitle.textContent = cfg.observeTitle;
  const sceneHost = document.createElement('div'); sceneHost.className = 'wtscene';
  const placeholder = cfg.placeholder ? document.createElement('img') : null;
  if (placeholder) { placeholder.src = cfg.placeholder.src; placeholder.alt = cfg.placeholder.alt; sceneHost.appendChild(placeholder); }
  const pip = document.createElement('div'); pip.className = 'wtpip';
  const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.appendChild(document.createElement('i'));
  const bubble = document.createElement('div'); bubble.className = 'bubble';
  const pipName = document.createElement('b'); pipName.textContent = 'PIP GIẢI THÍCH DÒNG NÀY';
  const explain = document.createElement('span'); explain.className = 'wtexplain'; explain.innerHTML = renderProse(cfg.intro || 'Bấm nút bên dưới. Tụi mình chỉ chạy một dòng mỗi lần.');
  bubble.append(pipName, explain); pip.append(avatar, bubble);
  const memory = document.createElement('div'); memory.className = 'wtmemory'; memory.textContent = 'Máy chưa chạy dòng nào.';
  observeSide.append(observeTitle, sceneHost, pip, memory);
  layout.append(codeSide, observeShell);

  const controls = document.createElement('div'); controls.className = 'wtcontrols';
  const hint = document.createElement('span'); hint.textContent = cfg.hint;
  const next = document.createElement('button'); next.type = 'button'; next.textContent = cfg.steps.length ? '▶ BẮT ĐẦU' : 'HOÀN TẤT';
  controls.append(hint, next); el.append(head, layout, controls);

  const fitObserve = () => requestAnimationFrame(() => {
    const twoColumns = getComputedStyle(layout).gridTemplateColumns.split(' ').length > 1;
    observeShell.style.setProperty('--wt-observe-scale', '1'); observeShell.dataset.scale = '1';
    if (!twoColumns || !observeShell.clientWidth || !observeShell.clientHeight) return;
    const widthRatio = observeShell.clientWidth / Math.max(1, observeSide.scrollWidth);
    const heightRatio = observeShell.clientHeight / Math.max(1, observeSide.scrollHeight);
    const scale = Math.max(.82, Math.min(1, widthRatio, heightRatio));
    observeShell.style.setProperty('--wt-observe-scale', scale.toFixed(4)); observeShell.dataset.scale = scale.toFixed(4);
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(fitObserve).observe(observeShell);
  else addEventListener('resize', fitObserve);
  fitObserve();

  let index = 0; let busy = false;
  const selectLine = line => {
    lines.querySelectorAll('.wtline').forEach(row => row.classList.toggle('active', Number(row.dataset.line) === line));
    const row = lines.querySelector(`.wtline[data-line="${line}"]`);
    if (row && codeSide.scrollHeight > codeSide.clientHeight) {
      const rowTop = row.getBoundingClientRect().top - codeSide.getBoundingClientRect().top + codeSide.scrollTop;
      const top = Math.max(0, rowTop - codeSide.clientHeight / 2 + row.clientHeight / 2);
      codeSide.scrollTo({ top, behavior: 'instant' });
    }
  };
  const mountScene = () => {
    placeholder?.remove();
    if (scenePanel.parentElement !== sceneHost) sceneHost.appendChild(scenePanel);
    scenePanel.classList.remove('devstage', 'frozen');
    dispatchEvent(new Event('resize'));
  };
  el._arm = () => { if (cfg.continueScene) { mountScene(); fitObserve(); } };
  const finish = () => {
    next.disabled = true; next.textContent = '✓ ĐÃ XEM TỪNG DÒNG';
    controls.classList.add('finished'); completeCell(el);
  };
  next.onclick = async () => {
    if (busy) return;
    if (index >= cfg.steps.length) { finish(); return; }
    alignWalkthrough(el);
    busy = true; next.disabled = true;
    const step = cfg.steps[index]; selectLine(step.line);
    explain.innerHTML = renderProse(step.explain);
    memory.textContent = step.label ? `${step.label} — máy đang chạy dòng ${step.line}...` : `Máy đang chạy dòng ${step.line}...`;
    fitObserve();
    if (step.action && studio) {
      mountScene();
      const pending = studio.start(JSON.stringify(step.action));
      if (step.action.action === 'light_board_start') { hint.textContent = 'Bây giờ bấm BẮT ĐẦU ngay trên bảng đèn.'; next.textContent = 'ĐANG CHỜ BẠN BẤM BẮT ĐẦU'; }
      await pending;
    }
    memory.textContent = step.memory || `Máy đã chạy xong dòng ${step.line}.`;
    lines.querySelector(`.wtline[data-line="${step.line}"]`)?.classList.add('executed');
    fitObserve();
    if (step.observeMs) {
      hint.textContent = `Dừng lại ${String(step.observeMs / 1000).replace('.', ',')} giây để quan sát.`;
      next.textContent = 'ĐANG DỪNG ĐỂ BẠN QUAN SÁT...';
      await new Promise(resolve => setTimeout(resolve, step.observeMs));
    }
    index++; progress.textContent = `${index} / ${cfg.steps.length}`;
    const upcoming = cfg.steps[index];
    if (upcoming) {
      const sameLine = upcoming.line === step.line;
      next.textContent = upcoming.label ? `▶ TIẾP THEO — ${upcoming.label}` : sameLine ? '▶ CHẠY LƯỢT TIẾP CỦA DÒNG NÀY' : `▶ CHẠY DÒNG ${upcoming.line}`;
      hint.textContent = upcoming.label ? 'Dòng code cần quan sát sẽ tự được đưa vào giữa khung.' : sameLine ? 'Vòng lặp quay lại cùng dòng code với một giá trị mới.' : 'Đọc dòng tiếp theo trước khi bấm.';
      selectLine(upcoming.line);
      next.disabled = false;
    } else {
      next.textContent = '✓ MÌNH ĐÃ HIỂU TỪNG DÒNG'; next.disabled = false;
      hint.textContent = 'Nhìn lại code và kết quả. Khi sẵn sàng, hãy hoàn tất.';
    }
    busy = false;
  };
  if (cfg.steps[0]) selectLine(cfg.steps[0].line);
  return el;
}
