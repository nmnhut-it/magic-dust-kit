// widget-cell.js — the anatomy interactive diagram. Inspect by HAND: hold up
// 1 / 2 / 3 fingers to light that part (same hold gate as the quiz — the
// part charges while you hold). Tapping still works.
import { ANATOMY, QUIZ_HOLD_MS } from './constants.js';
import { armFingertipFx } from './gesture-ui.js';

const PINHOLE_PROJECT_CASES = Object.freeze([
  { label: 'GẦN', distance: 36, imageSize: 6, objectX: 180, imageHalf: 64 },
  { label: 'GIỮA', distance: 72, imageSize: 3, objectX: 115, imageHalf: 38 },
  { label: 'XA', distance: 108, imageSize: 2, objectX: 70, imageHalf: 26 },
]);

function pinholeWidget({ completeCell }) {
  const el = document.createElement('div');
  el.className = 'pinhole-model vision-lab-deck';
  el.innerHTML = `<div class="vision-slide-tabs" role="tablist" aria-label="Ba slide của mô hình camera lỗ kim">
    <button type="button" role="tab" data-lab-slide="model">1 · Mô hình</button>
    <button type="button" role="tab" data-lab-slide="ratio">2 · Tỉ lệ</button>
    <button type="button" role="tab" data-lab-slide="design">3 · Thiết kế</button>
  </div>
  <section class="vision-lab-slide" data-lab-panel="model" role="tabpanel">
    <header><small>SLIDE 01</small><h3>Mô hình camera lỗ kim lý tưởng</h3><p>Ánh sáng truyền theo đường thẳng. Mỗi điểm của vật tạo một tia đi qua lỗ kim rồi gặp màn hứng.</p></header>
    <svg viewBox="0 0 680 270" role="img" aria-labelledby="pinhole-title pinhole-desc">
      <title id="pinhole-title">Mô hình hình học của camera lỗ kim</title>
      <desc id="pinhole-desc">Hai tia từ đỉnh và đáy của vật cắt nhau tại lỗ kim, tạo ảnh đảo chiều trên màn hứng.</desc>
      <line class="ph-axis" x1="28" y1="135" x2="650" y2="135"></line>
      <line class="ph-screen" x1="560" y1="28" x2="560" y2="242"></line>
      <line class="ph-wall" x1="340" y1="28" x2="340" y2="118"></line>
      <line class="ph-wall" x1="340" y1="152" x2="340" y2="242"></line>
      <circle class="ph-hole" cx="340" cy="135" r="7"></circle>
      <line class="ph-object" data-object x1="115" y1="70" x2="115" y2="200"></line>
      <line class="ph-image" data-image x1="560" y1="97" x2="560" y2="173"></line>
      <polyline class="ph-ray ray-top" data-ray-top points="115,70 340,135 560,173"></polyline>
      <polyline class="ph-ray ray-bottom" data-ray-bottom points="115,200 340,135 560,97"></polyline>
      <text class="ph-label" data-object-label x="115" y="254">VẬT · D = 72 cm</text>
      <text class="ph-label" x="340" y="254">LỖ KIM</text>
      <text class="ph-label" x="560" y="254">MÀN · d = 12 cm</text>
    </svg>
    <div class="pinhole-controls" aria-label="Thay đổi khoảng cách D từ vật tới lỗ kim">
      ${PINHOLE_PROJECT_CASES.map((item, index) => `<button type="button" data-preset="${index}">${item.label} · ${item.distance} cm</button>`).join('')}
    </div>
    <p class="pinhole-caption" aria-live="polite"></p>
  </section>
  <section class="vision-lab-slide" data-lab-panel="ratio" role="tabpanel" hidden>
    <header><small>SLIDE 02</small><h3>Suy ra công thức từ tam giác đồng dạng</h3><p>Hai tam giác vuông ở hai phía của lỗ kim có cùng góc tại lỗ, nên tỉ số chiều cao bằng tỉ số khoảng cách.</p></header>
    <div class="vision-ratio-layout">
      <svg viewBox="0 0 620 300" role="img" aria-labelledby="ratio-title ratio-desc">
        <title id="ratio-title">Hai tam giác đồng dạng trong camera lỗ kim</title>
        <desc id="ratio-desc">Tam giác của vật có chiều cao H và đáy D. Tam giác của ảnh có chiều cao h và đáy d.</desc>
        <line class="ph-axis" x1="28" y1="150" x2="592" y2="150"></line>
        <polygon class="ph-triangle object-triangle" points="70,55 70,245 320,150"></polygon>
        <polygon class="ph-triangle image-triangle" points="320,150 540,105 540,195"></polygon>
        <circle class="ph-hole" cx="320" cy="150" r="7"></circle>
        <text class="ph-symbol" x="52" y="154">H</text><text class="ph-symbol" x="190" y="174">D</text>
        <text class="ph-symbol" x="558" y="154">h</text><text class="ph-symbol" x="428" y="174">d</text>
      </svg>
      <div class="vision-formula-card">
        <span>Kích thước</span><code>h / H = d / D</code>
        <span>Suy ra</span><code>h = H × d / D</code>
        <p><code>h</code> là độ lớn của ảnh. Ảnh bị đảo chiều được thể hiện bằng hướng của mũi tên, không phải bằng một kích thước âm.</p>
      </div>
    </div>
  </section>
  <section class="vision-lab-slide" data-lab-panel="design" role="tabpanel" hidden>
    <header><small>SLIDE 03</small><h3>Bài toán thiết kế của phòng lab</h3><p>Đặt một vật cao 18 cm trước camera. Màn cách lỗ 12 cm và chỉ chứa được ảnh cao tối đa 4 cm.</p></header>
    <div class="vision-design-brief">
      <div><small>DỮ LIỆU CỐ ĐỊNH</small><strong>H = 18 cm · d = 12 cm</strong></div>
      <div><small>BA VỊ TRÍ THỬ</small><strong>D = 36 · 72 · 108 cm</strong></div>
      <div><small>RÀNG BUỘC</small><strong>h ≤ 4 cm</strong></div>
      <div><small>MỤC TIÊU</small><strong>Ảnh vừa màn và lớn nhất có thể</strong></div>
    </div>
    <table class="vision-design-table"><thead><tr><th>Vị trí</th><th>D</th><th>h = H × d / D</th><th>Vừa màn?</th></tr></thead><tbody>
      <tr><td>Gần</td><td>36 cm</td><td>?</td><td>?</td></tr>
      <tr><td>Giữa</td><td>72 cm</td><td>?</td><td>?</td></tr>
      <tr><td>Xa</td><td>108 cm</td><td>?</td><td>?</td></tr>
    </tbody></table>
    <p class="vision-design-question">Project Python tiếp theo phải điền bảng này và chọn vị trí gần nhất vẫn thỏa mãn ràng buộc.</p>
  </section>`;

  const seenSlides = new Set();
  let completed = false;
  const showPreset = index => {
    const preset = PINHOLE_PROJECT_CASES[index];
    if (!preset) return;
    el.querySelectorAll('[data-preset]').forEach((button, buttonIndex) => {
      button.classList.toggle('active', buttonIndex === index);
    });
    el.querySelector('[data-object]').setAttribute('x1', preset.objectX);
    el.querySelector('[data-object]').setAttribute('x2', preset.objectX);
    el.querySelector('[data-image]').setAttribute('y1', 135 - preset.imageHalf);
    el.querySelector('[data-image]').setAttribute('y2', 135 + preset.imageHalf);
    el.querySelector('[data-ray-top]').setAttribute('points', `${preset.objectX},70 340,135 560,${135 + preset.imageHalf}`);
    el.querySelector('[data-ray-bottom]').setAttribute('points', `${preset.objectX},200 340,135 560,${135 - preset.imageHalf}`);
    const objectLabel = el.querySelector('[data-object-label]');
    objectLabel.setAttribute('x', preset.objectX);
    objectLabel.textContent = `VẬT · D = ${preset.distance} cm`;
    el.querySelector('.pinhole-caption').textContent = `D = ${preset.distance} cm → h = ${preset.imageSize} cm. Khi D tăng, h giảm.`;
  };

  const showSlide = slideId => {
    seenSlides.add(slideId);
    el.querySelectorAll('[data-lab-slide]').forEach(button => {
      const active = button.dataset.labSlide === slideId;
      button.classList.toggle('active', active);
      button.classList.toggle('seen', seenSlides.has(button.dataset.labSlide));
      button.setAttribute('aria-selected', String(active));
    });
    el.querySelectorAll('[data-lab-panel]').forEach(panel => {
      const active = panel.dataset.labPanel === slideId;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    if (seenSlides.size === 3 && !completed) {
      completed = true;
      setTimeout(() => completeCell(el), 650);
    }
  };

  el.querySelectorAll('[data-preset]').forEach((button, index) => {
    button.addEventListener('click', () => showPreset(index));
  });
  el.querySelectorAll('[data-lab-slide]').forEach(button => {
    button.addEventListener('click', () => showSlide(button.dataset.labSlide));
  });
  showPreset(1);
  showSlide('model');
  return el;
}

function visionLabWidget(c, { completeCell }) {
  const slides = Array.isArray(c.deck) ? c.deck : [];
  const el = document.createElement('div');
  el.className = 'pinhole-model vision-lab-deck';
  el.innerHTML = `<div class="vision-slide-tabs" role="tablist" aria-label="Ba slide của phòng thí nghiệm">
    ${slides.map((slide, index) => `<button type="button" role="tab" data-lab-slide="${index}">${index + 1} · ${slide.tab}</button>`).join('')}
  </div>
  ${slides.map((slide, index) => `<section class="vision-lab-slide" data-lab-panel="${index}" role="tabpanel"${index ? ' hidden' : ''}>
    <header><small>SLIDE ${String(index + 1).padStart(2, '0')}</small><h3>${slide.title}</h3><p>${slide.lead}</p></header>
    <div class="vision-lab-visual">${slide.visual}</div>
  </section>`).join('')}`;

  const seenSlides = new Set();
  let completed = false;
  const showSlide = slideId => {
    seenSlides.add(slideId);
    el.querySelectorAll('[data-lab-slide]').forEach(button => {
      const active = button.dataset.labSlide === slideId;
      button.classList.toggle('active', active);
      button.classList.toggle('seen', seenSlides.has(button.dataset.labSlide));
      button.setAttribute('aria-selected', String(active));
    });
    el.querySelectorAll('[data-lab-panel]').forEach(panel => {
      const active = panel.dataset.labPanel === slideId;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    if (seenSlides.size === slides.length && !completed) {
      completed = true;
      setTimeout(() => completeCell(el), 650);
    }
  };
  el.querySelectorAll('[data-lab-slide]').forEach(button => {
    button.addEventListener('click', () => showSlide(button.dataset.labSlide));
  });
  showSlide('0');
  return el;
}

function anatomyWidget(c, { gestureDispatcher, cameraEngine, completeCell }) {
  const el = document.createElement('div'); el.className = 'anatomy';
  el.innerHTML = ANATOMY.map((p, i) => `${i ? '<div class="arrow">→</div>' : ''}
    <div class="part" data-k="${p.key}"><img src="${p.art}" alt=""><div class="pname">${i + 1} · ${p.name}</div></div>`).join('')
    + `<div class="caption" id="anatcap">hold up 1, 2 or 3 fingers to inspect a part — or tap it</div>
       <div class="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>`;
  const seen = new Set();
  let fxOff = null;
  const inspect = part => {
    el.querySelectorAll('.part').forEach(x => x.classList.remove('lit')); part.classList.add('lit');
    const p = ANATOMY.find(a => a.key === part.dataset.k); seen.add(p.key);
    el.querySelector('.caption').textContent = seen.size < ANATOMY.length ? p.fact
      : p.fact + '  —  input → process → output: every machine ever built.';
    if (seen.size === ANATOMY.length) {
      gestureDispatcher.disarmActGate(); el.querySelector('.bcam').classList.remove('on');
      if (fxOff) { fxOff(); fxOff = null; }
      setTimeout(() => completeCell(el), 900);
    }
  };
  el.querySelectorAll('.part').forEach(part => part.onclick = () => inspect(part));
  // arms armActGate directly (not armActHoldGate — this gate has no soft-decay
  // charge, it's a per-part hold), so it doesn't get fingertip fx for free
  // from the shared seams — armed/disarmed explicitly, like quiz-cell.js's
  // armHoldQuestion.
  el._arm = () => cameraEngine.ensure().then(() => {
    if (el.classList.contains('done')) return;
    const chip = el.querySelector('.bcam'), v = chip.querySelector('video');
    v.srcObject = cameraEngine.stream; v.play().catch(() => {});
    chip.classList.add('on');
    let holdOk = false;
    if (!fxOff) fxOff = armFingertipFx(gestureDispatcher, chip, () => holdOk);
    const fill = chip.querySelector('.bgauge i'), parts = el.querySelectorAll('.part');
    let held = 0, target = -1, last = performance.now();
    gestureDispatcher.armActGate((count, has) => {
      const now = performance.now(), dt = Math.min(100, now - last); last = now;
      const idx = has && count >= 1 && count <= parts.length ? count - 1 : -1;
      holdOk = idx >= 0;
      if (idx !== target) { target = idx; held = 0; } else if (idx >= 0) held += dt;
      const p = idx < 0 ? 0 : Math.min(1, held / QUIZ_HOLD_MS);
      parts.forEach((pt, i) => { const on = i === idx; pt.classList.toggle('arm', on); pt.style.setProperty('--qp', on ? p : 0); });
      fill.style.width = p * 100 + '%';
      if (idx >= 0 && held >= QUIZ_HOLD_MS) { held = 0; inspect(parts[idx]); }
    });
  }).catch(() => {});                                 // no camera → tap only
  return el;
}

export function widgetCell(c, dependencies) {
  if (c.widget === 'pinhole') return pinholeWidget(dependencies);
  if (c.widget === 'vision-lab') return visionLabWidget(c, dependencies);
  return anatomyWidget(c, dependencies);
}
