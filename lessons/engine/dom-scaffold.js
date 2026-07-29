// dom-scaffold.js — the node page's static markup (splash/bundle/book/ritual
// overlay) + the $() lookup helper. Pure functions, no state kept here.
export const $ = id => document.getElementById(id);

// pageHtml(N) — the full document.body markup for a node, built from the
// node's content config (title/subtitle/bundle/machine/ritual). Extracted
// verbatim from node.js's original document.body.innerHTML template.
export function pageHtml(N) {
  const pageLabel = N.pageLabel || `NODE ${N.index}`;
  const returnPage = N.returnPage || './index.html';
  return `
  <header class="hdr">
    <a class="logo" href="${returnPage}" title="Về bản đồ">✦ MAGIC&nbsp;DUST <small>saga</small></a>
    <div class="crumb">${pageLabel} · ${N.title}</div>
    <div class="pystat" id="pystat">✦ đang đánh thức Python…</div>
  </header>
  <section class="act" id="splash"><div class="actin">
    <div class="nodenum">${pageLabel}</div><h1>${N.title}</h1>
    <div class="actsub">${N.subtitle || ''}</div>
    <button class="cta" id="enterBtn">✦ VÀO CỔNG</button>
    <div class="ghint">${N.cameraFree ? 'Bài này không dùng camera — bấm VÀO CỔNG để bắt đầu' : '☝ giơ MỘT ngón tay để bắt đầu — hoặc nhấn Enter'}</div>
    <div class="bcam" id="scam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
  </div></section>
  <section class="act gone" id="bundleAct"><div class="actin">
    <div class="actsub">một bọc quà đang chờ bạn…</div>
    <div class="giftwrap" id="giftwrap"><img class="gift" id="gift" src="${N.bundle?.art || ''}" alt=""></div>
    <div class="gifthint" id="gifthint">${N.cameraFree ? 'Chạm vào bọc quà để mở' : '✋ đập tay để xé bọc quà — hoặc chạm vào nó'}</div>
    <div class="bcam" id="bcam"><video playsinline muted></video><div class="bgauge"><i></i></div></div>
    <div class="got gone" id="got">
      <div class="gotlabel">BẠN NHẬN ĐƯỢC</div>
      <div class="gotcard"><img src="${N.machine?.art || ''}" alt=""></div>
      <div class="gotname">${N.machine?.name || ''}</div><div class="gotblurb">${N.machine?.blurb || ''}</div>
    </div>
  </div></section>
  <main id="book" class="gone"></main>
  <div class="act gone" id="ritualOverlay"><video id="rcam" playsinline muted></video><i id="rglow"></i><div class="actin">
    <div class="rrings"><div class="rring"></div><div class="rring b"></div></div>
    <div class="rgesture">${N.ritual?.gesture || '✌'}</div>
    <div class="rprompt">${N.ritual?.prompt || 'Hold the sign steady to seal the pact'}</div>
    <div id="rstat"></div><div id="rgate"><i></i></div>
    <button id="holdBtn" class="gone"><i id="holdFill"></i><span>HOLD</span></button>
    <div class="rdone gone" id="rdone">NODE SEALED ✦</div>
  </div><div class="rflash" id="rflash"></div></div>
  <div class="toast" id="toast"></div><div class="warn" id="warn"></div>`;
}

// mountPage(N) — sets the document title (zero-indexed node numbering — "real
// machines count from 0") and injects pageHtml(N) into the body.
export function mountPage(N) {
  const pageLabel = N.pageLabel || `Node ${N.index}`;
  document.title = `${pageLabel} · ${N.title.replace(/<[^>]+>/g, '')} — Magic Dust`;
  document.body.innerHTML = pageHtml(N);
  document.body.classList.add(`node-${N.index}`);   // per-node CSS hook (e.g. Node 0's retro CRT code-cell frame)
  if (N.cameraFree) document.body.classList.add('camera-free');
}

// warnIfNotIsolated() — the page needs SharedArrayBuffer (crossOriginIsolated)
// for the Pyodide worker's SAB bridge; show a visible warning if missing.
export function warnIfNotIsolated() {
  if (self.crossOriginIsolated) return;
  const w = $('warn'); w.style.display = 'flex';
  w.innerHTML = '<div>This page needs <b>SharedArrayBuffer</b>.<br><br>Serve it with:<br><br><code>python serve.py</code></div>';
}

// scenePanelHtml() — the shared camera/fx panel mounted into whichever cell
// output (or dev stage) currently needs the hand/camera.
// Local spark celebration: sparks fly out from a target element (a quiz
// button, the boss face) so the reward lands where the student is already
// looking. Shared by quiz-cell.js and boss-fight.js.
const QUIZ_SPARKS = 14;
export function sparkBurst(host, target, n = QUIZ_SPARKS, cls = '') {
  const r = target.getBoundingClientRect(), h = host.getBoundingClientRect();
  const b = document.createElement('span'); b.className = 'qburst ' + cls;
  b.style.left = r.left - h.left + r.width / 2 + 'px'; b.style.top = r.top - h.top + r.height / 2 + 'px';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 34 + Math.random() * 62;
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    s.style.animationDelay = Math.random() * .08 + 's'; b.appendChild(s);
  }
  host.appendChild(b); setTimeout(() => b.remove(), 900);
}

export function scenePanelHtml({ cameraFree = false } = {}) {
  return `
  <svg width="0" height="0" aria-hidden="true" focusable="false">
    <filter id="camera-sharpen-filter" color-interpolation-filters="sRGB">
      <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true"/>
    </filter>
  </svg>
  <video id="cam" playsinline muted></video>
  <div class="vortex"><div class="ring"></div><div class="ring b"></div></div>
  <div class="result" id="scres"><div class="big">—</div><div class="sub"></div></div>
  <div class="schud"><div id="scstat">${cameraFree ? 'bảng đèn không dùng camera' : 'giơ bàn tay ✋ cho máy thấy nào'}</div><div id="sccount">—</div>
    <div id="scgate"><i></i></div>
    <div id="scask" style="display:none"><span>số ngón:</span><input type="number" min="0" max="5"></div></div>`;
}
