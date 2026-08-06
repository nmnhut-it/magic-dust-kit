/* Bộ máy notebook Magic Mirror: kernel Pyodide + camera đếm ngón tay.
 * Trang gọi nó phải khai báo trước:  window.MM_PAGE = { notebook, mode }
 * mode "student" | "answers" chỉ đổi màu nhấn và chỗ lưu bài, không đổi logic.
 */
"use strict";

const CFG = {
  pyodide: {
    cdns: [
      "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
    ],
    packages: ["numpy", "pillow"],
    moduleDir: "/home/pyodide",
    modulePath: "/home/pyodide/magic_mirror.py",
    moduleSource: "assets/magic_mirror.py",
  },
  mediapipe: { base: "https://cdn.jsdelivr.net/npm/@mediapipe/hands/", script: "hands.js" },
  capture: { w: 240, h: 180 },
  quality: [
    { label: "Nhanh (60×45)", w: 60, h: 45 },
    { label: "Vừa (80×60)", w: 80, h: 60 },
    { label: "Nét (120×90)", w: 120, h: 90 },
  ],
  defaultQuality: 1,
  fingerMax: 5,
  detectEveryNFrames: 3,
  stableFrames: 3,          // phải thấy cùng một số ngón bấy nhiêu lần mới đổi
  thumbOutRatio: 1.25,
  fpsWindow: 12,
  storagePrefix: "magic-mirror-nb:",
  storageSchema: 2,
  saveDelayMs: 350,
  skipTag: "skip-browser",
  tab: "    ",

  // --- chỉ dùng ở bản đơn giản (don-gian.html) ---
  // Tư thế bàn tay viết theo thứ tự [cái, trỏ, giữa, áp út, út].
  holdPose: [true, true, true, true, true],     // xòe cả bàn tay
  holdSeconds: 1.4,                             // giữ bấy nhiêu giây thì lật ảnh
  sparkPose: [true, false, false, false, true], // ngón cái + ngón út
  spark: { perFrame: 3, burst: 40, max: 260, life: 1100, gravity: 0.00022, minSize: 1.5, maxSize: 4.5 },
  sparkScale: 2,            // lớp hạt vẽ ở độ phân giải gấp đôi cho mịn
  sparkColors: {            // token màu Kotopia, canvas không đọc được biến CSS
    honey: "#f4c85a", mint: "#78b2a5", white: "#fffdf5",
    green: "#2d6425", red: "#9b3845",
  },
  defaultSparkColor: "honey",
  spells: { swordsMs: 8800, lotusMs: 9500, petalsMs: 9500, lightningMs: 7600 },
};

const T = {
  kernel: { loading: "Đang tải Python…", ready: "Kernel sẵn sàng", busy: "Đang chạy…", error: "Kernel lỗi" },
  skipCell: "Ô này chỉ chạy trên Colab / máy cá nhân — bấm ▶ nếu vẫn muốn thử",
  fileHint: "<strong>Đang mở bằng giao thức <code>file://</code>.</strong> Trình duyệt sẽ chặn việc đọc file " +
    "<code>.ipynb</code> và có thể chặn cả camera. Hãy mở terminal tại thư mục dự án, chạy " +
    "<code>python -m http.server 8000</code> rồi vào <code>http://localhost:8000</code>.",
  loadFail: (f) => `<strong>Không đọc được <code>${f}</code>.</strong> Hãy chắc chắn file nằm cùng thư mục với ` +
    `trang này, hoặc bấm <em>📂 Mở file</em> để chọn notebook từ máy.`,
  camDenied: "Không mở được camera: ",
  camManual: "Không tải được bộ nhận diện tay — hãy bấm nút số ngón bên dưới để đổi bộ lọc.",
  bootFail: "Không tải được Pyodide. Kiểm tra kết nối mạng rồi tải lại trang.",
  fingerBtn: (n) => `${n} ngón`,
  holdHint: "Xòe cả 5 ngón và giữ yên để lật ảnh",
  holdDone: "Lật rồi!",
  sparkHint: "Giơ ngón cái + ngón út để triệu hồi bụi phép",
};

const PAGE = Object.assign(
  { notebook: "Magic_Mirror.ipynb", mode: "student", courseVersion: "1" },
  window.MM_PAGE || {},
);
const SIMPLE = PAGE.mode.startsWith("simple");   // bản đơn giản: giữ tay để lật + bụi phép
const SKIN = PAGE.mode.startsWith("skin");       // route riêng: tích chập + bộ lọc da, không training

/* --------------------------------- markdown --------------------------------- */
const MD = {
  esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); },

  inline(s) {
    return MD.esc(s)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  },

  row(line) { return line.replace(/^\||\|$/g, "").split("|").map((c) => MD.inline(c.trim())); },

  render(src) {
    const lines = src.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        const buf = [];
        for (i++; i < lines.length && !/^```/.test(lines[i]); i++) buf.push(lines[i]);
        i++;
        out.push(`<pre><code>${MD.esc(buf.join("\n"))}</code></pre>`);
      } else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) {
        const head = MD.row(line);
        const rows = [];
        for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(MD.row(lines[i]));
        out.push("<table><thead><tr>" + head.map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>").join("") + "</tbody></table>");
      } else if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        for (; i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i]); i++) {
          items.push(`<li>${MD.inline(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""))}</li>`);
        }
        out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      } else if (/^#{1,6}\s/.test(line)) {
        const level = line.match(/^#+/)[0].length;
        out.push(`<h${level}>${MD.inline(line.slice(level + 1))}</h${level}>`);
        i++;
      } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { out.push("<hr>"); i++; }
      else if (/^>\s?/.test(line)) {
        const buf = [];
        for (; i < lines.length && /^>\s?/.test(lines[i]); i++) buf.push(lines[i].replace(/^>\s?/, ""));
        out.push(`<blockquote>${MD.inline(buf.join(" "))}</blockquote>`);
      } else if (line.trim() === "") { i++; }
      else {
        const buf = [];
        for (; i < lines.length && lines[i].trim() !== "" &&
               !/^(#{1,6}\s|```|>|\s*([-*+]|\d+\.)\s)/.test(lines[i]); i++) buf.push(lines[i]);
        out.push(`<p>${MD.inline(buf.join("\n")).replace(/\n/g, "<br>")}</p>`);
      }
    }
    return out.join("\n");
  },
};

/* ------------------------------ tô màu Python ------------------------------ */
const Hi = {
  re: new RegExp([
    "('''[\\s\\S]*?'''|\"\"\"[\\s\\S]*?\"\"\"|'(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\")",
    "(#[^\\n]*)",
    "\\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|" +
      "finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\\b",
    "\\b(abs|bool|dict|enumerate|float|int|len|list|max|min|open|print|range|round|set|str|sum|tuple|type|zip|isinstance)\\b",
    "\\b(\\d+\\.?\\d*)\\b",
  ].join("|"), "g"),
  cls: ["tok-str", "tok-com", "tok-kw", "tok-bi", "tok-num"],

  run(code) {
    let out = "", last = 0, m;
    Hi.re.lastIndex = 0;
    while ((m = Hi.re.exec(code)) !== null) {
      out += MD.esc(code.slice(last, m.index));
      const slot = m.slice(1).findIndex((g) => g !== undefined);
      out += `<span class="${Hi.cls[slot]}">${MD.esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + MD.esc(code.slice(last)) + "\n";
  },
};

/* --------------------------------- kernel --------------------------------- */
const Kernel = {
  py: null, state: "loading", sink: null, queue: Promise.resolve(),

  setState(state, text) {
    Kernel.state = state;
    const pill = document.getElementById("kernelPill");
    pill.dataset.state = state;
    document.getElementById("kernelText").textContent = text || T.kernel[state];
    document.getElementById("runAllBtn").disabled = state !== "ready";
    document.getElementById("restartBtn").disabled = state === "loading";
  },

  loadScript(url) {
    return new Promise((ok, fail) => {
      const el = document.createElement("script");
      el.src = url; el.onload = ok; el.onerror = () => fail(new Error(url));
      document.head.appendChild(el);
    });
  },

  async boot() {
    let indexURL = null;
    for (const cdn of CFG.pyodide.cdns) {
      try { await Kernel.loadScript(cdn + "pyodide.js"); indexURL = cdn; break; } catch (e) { /* thử CDN kế */ }
    }
    if (!indexURL) { Kernel.setState("error", T.bootFail); return; }

    Kernel.setState("loading", "Đang tải Python…");
    Kernel.py = await loadPyodide({ indexURL });
    Kernel.setState("loading", "Đang tải numpy + pillow…");
    await Kernel.py.loadPackage(CFG.pyodide.packages);
    // `batched` gọi mỗi dòng một lần và bỏ ký tự xuống dòng — trả lại cho đúng.
    Kernel.py.setStdout({ batched: (s) => Kernel.sink && Kernel.sink("out", s + "\n") });
    Kernel.py.setStderr({ batched: (s) => Kernel.sink && Kernel.sink("err", s + "\n") });
    await Kernel.install();
    Kernel.setState("ready");
  },

  /** Chép magic_mirror.py vào hệ thống file ảo rồi mở sẵn display() cho notebook. */
  async install() {
    const res = await fetch(CFG.pyodide.moduleSource, { cache: "no-store" });
    if (!res.ok) throw new Error(CFG.pyodide.moduleSource + ": " + res.status);
    Kernel.py.FS.writeFile(CFG.pyodide.modulePath, new TextEncoder().encode(await res.text()));
    const dir = JSON.stringify(CFG.pyodide.moduleDir);
    await Kernel.py.runPythonAsync(
      `import sys\nif ${dir} not in sys.path:\n    sys.path.insert(0, ${dir})\n` +
      "from magic_mirror import show as display\n" +
      (SIMPLE ? "import magic_mirror as _mm\n_mm.use_simple_mode()\n" : "") +
      (SKIN ? "import magic_mirror as _mm\n_mm.use_skin_mode()\n" : ""));
  },

  async restart() {
    Cam.stop();
    Kernel.setState("loading", "Đang khởi động lại…");
    Kernel.py = null;
    await Kernel.boot();
  },

  /** Xếp hàng để hai ô không cùng chạm vào bộ thông dịch một lúc. */
  exec(code, sink) {
    Kernel.queue = Kernel.queue.then(() => Kernel.execNow(code, sink));
    return Kernel.queue;
  },

  async execNow(code, sink) {
    Kernel.sink = sink;
    Kernel.setState("busy");
    try {
      const value = await Kernel.py.runPythonAsync(code);
      if (value !== undefined && value !== null) {
        Kernel.py.globals.get("display")(value);
        if (value.destroy) value.destroy();
      }
    } catch (err) {
      sink("err", Kernel.shortenError((err && err.message) || String(err)));
    } finally {
      Kernel.sink = null;
      Kernel.setState("ready");
    }
  },

  /** Drop Python error frames that live inside Pyodide itself, keeping only the ones
   *  pointing at the student's own cell. A 6th-grader needs "what broke, on which
   *  line of my code", not the interpreter's plumbing. */
  shortenError(text) {
    const internal = /File "(\/lib\/|<\/?frozen|.*_pyodide)/;
    const pythonErrorHeader = "Tra" + "ceback";
    const kept = [];
    let skipping = false;
    for (const line of String(text).split("\n")) {
      if (/^\s+File "/.test(line)) skipping = internal.test(line);
      else if (!/^\s/.test(line)) skipping = false;
      if (skipping) continue;
      kept.push(line.replace(/^\s+File "<exec>", line (\d+).*$/, "Trong ô code, dòng $1:"));
    }
    const hasUserFrame = kept.some((line) => line.startsWith("Trong ô code"));
    return kept.filter((line) => line.trim() && (hasUserFrame || !line.startsWith(pythonErrorHeader))).join("\n");
  },

  /** Gọi một hàm trong magic_mirror, tự dọn proxy. */
  callBridge(name, args) {
    if (!Kernel.py) return null;
    const mm = Kernel.py.pyimport("magic_mirror");
    try { return mm[name](...args); } finally { mm.destroy(); }
  },
};

/* ------------------------------ khung camera ------------------------------ */
const Cam = {
  host: null, stream: null, video: null, capture: null, display: null,
  fingers: CFG.fingerMax, seen: -1, seenCount: 0, auto: true,
  handAngle: 0, rawHandAngle: 0,
  hands: null, frame: 0, running: false, quality: SKIN ? 0 : CFG.defaultQuality,
  times: [], msgEl: null, badgeEl: null, fpsEl: null, buttons: {},
  // chỉ dùng ở bản đơn giản
  fx: null, gaugeEl: null, sparks: [], sparkColor: CFG.defaultSparkColor,
  pattern: [false, false, false, false, false], tips: null,
  holdStart: 0, holdArmed: true,
  handCenter: { x: .5, y: .55 }, lastHandX: .5, handWind: 0, motionSamples: [], motionDirection: 0,
  motionTurns: 0, motionSegmentX: null, indexDropStart: null, lastMotionAt: -Infinity,
  sealKind: null, sealStartedAt: 0, sealStartCenters: null,
  weather: "clear", weatherUntil: 0, weatherHud: null, spellVfx: null,

  /** Python gọi vào đây qua magic_mirror.run(). */
  start() {
    Cam.stop();
    Cam.host = Nb.currentOutput;
    if (!Cam.host) return;
    Cam.build();
    Cam.openCamera();
  },

  build() {
    const wrap = document.createElement("div");
    wrap.className = "cam";
    wrap.innerHTML =
      '<div class="cam-stage"><div class="cam-screen">' +
      '<canvas class="cam-out"></canvas><canvas class="cam-fx"></canvas><canvas class="spell-fx"></canvas>' +
      (SIMPLE ? '<div class="weather-hud"><b>SẴN SÀNG NIỆM CHÚ</b><span>—</span><i><em></em></i></div>' : "") +
      (SIMPLE ? '<div class="hold-gauge"><i></i><span></span></div>' : "") +
      '</div><div class="badge"></div><div class="fps">— fps</div></div>' +
      '<div class="cam-msg"></div><div class="cam-bar"></div>';
    Cam.host.appendChild(wrap);
    Cam.display = wrap.querySelector(".cam-out");
    Cam.display.width = CFG.capture.w;
    Cam.display.height = CFG.capture.h;
    Cam.fx = wrap.querySelector(".cam-fx");
    Cam.fx.width = CFG.capture.w * CFG.sparkScale;
    Cam.fx.height = CFG.capture.h * CFG.sparkScale;
    Cam.spellFx = wrap.querySelector(".spell-fx");
    Cam.spellFx.width = CFG.capture.w * CFG.sparkScale;
    Cam.spellFx.height = CFG.capture.h * CFG.sparkScale;
    Cam.spellVfx = window.SpellVfxEngine ? new window.SpellVfxEngine(Cam.spellFx) : null;
    Cam.gaugeEl = wrap.querySelector(".hold-gauge");
    Cam.weatherHud = wrap.querySelector(".weather-hud");
    Cam.badgeEl = wrap.querySelector(".badge");
    Cam.fpsEl = wrap.querySelector(".fps");
    Cam.msgEl = wrap.querySelector(".cam-msg");
    Cam.buildControls(wrap.querySelector(".cam-bar"));
    Cam.sparks = [];
    Cam.weather = "clear";
    Cam.pattern = [false, false, false, false, false];
    Cam.tips = null;
    Cam.holdStart = 0;
    Cam.holdArmed = true;
    Cam.setCharge(0);
    Cam.setFingers(CFG.fingerMax);

    Cam.video = document.createElement("video");
    Cam.video.autoplay = true; Cam.video.playsInline = true; Cam.video.muted = true;
    Cam.capture = document.createElement("canvas");
    Cam.capture.width = CFG.capture.w; Cam.capture.height = CFG.capture.h;
  },

  buildControls(bar) {
    const stop = document.createElement("button");
    stop.className = "btn"; stop.textContent = "⏹ Dừng camera";
    stop.onclick = () => Cam.stop();
    bar.appendChild(stop);

    const auto = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox"; box.checked = true;
    box.onchange = () => { Cam.auto = box.checked; Cam.refreshButtons(); };
    auto.append(box, "Tự đếm ngón tay");
    bar.appendChild(auto);

    Cam.buttons = {};
    for (let n = 0; n <= CFG.fingerMax; n++) {
      const b = document.createElement("button");
      b.className = "gest"; b.textContent = T.fingerBtn(n);
      b.onclick = () => Cam.setFingers(n);
      Cam.buttons[n] = b;
      bar.appendChild(b);
    }
    bar.appendChild(Object.assign(document.createElement("span"), { className: "sep" }));

    const q = document.createElement("select");
    q.className = "btn";
    CFG.quality.forEach((lvl, idx) => q.add(new Option(lvl.label, String(idx))));
    q.value = String(Cam.quality);
    q.onchange = () => { Cam.quality = Number(q.value); };
    bar.append(Object.assign(document.createElement("label"), { textContent: "Độ nét:" }), q);
    for (const [label, spell] of [["ϟ Thiên Lôi", "lightning"], ["⚔ Vạn Kiếm", "swords"], ["✺ Hỏa Liên · Hoa Vũ", "lotus"]]) {
      const weatherButton = document.createElement("button");
      weatherButton.className = "btn";
      weatherButton.textContent = label;
      weatherButton.onclick = () => Cam.castWeather(spell);
      bar.appendChild(weatherButton);
    }
    const stageButton = document.createElement("button");
    stageButton.className = "btn"; stageButton.textContent = "⛶ Trình diễn";
    stageButton.onclick = () => bar.closest(".cam").requestFullscreen?.();
    bar.appendChild(stageButton);
    const recordButton = document.createElement("button");
    recordButton.className = "btn record-vfx"; recordButton.textContent = "● Quay màn phép";
    recordButton.onclick = () => Cam.toggleRecording(recordButton);
    bar.appendChild(recordButton);
    Cam.refreshButtons();
  },

  refreshButtons() {
    for (const [n, btn] of Object.entries(Cam.buttons)) {
      btn.disabled = Cam.auto;
      btn.classList.toggle("on", !Cam.auto && Cam.fingers === Number(n));
    }
  },

  setFingers(n) {
    Cam.fingers = n;
    Cam.badgeEl.textContent = Kernel.callBridge("_label", [n]) || `${n} ngón`;
    Cam.refreshButtons();
  },

  /** Chỉ đổi bộ lọc khi thấy cùng một số ngón vài lần liên tiếp, cho đỡ nhấp nháy. */
  observe(n) {
    if (n === Cam.seen) Cam.seenCount++;
    else { Cam.seen = n; Cam.seenCount = 1; }
    if (Cam.seenCount >= CFG.stableFrames && n !== Cam.fingers) Cam.setFingers(n);
  },

  async openCamera() {
    try {
      Cam.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: CFG.capture.w, height: CFG.capture.h, facingMode: "user" },
      });
    } catch (err) {
      Cam.msgEl.textContent = T.camDenied + err.message;
      return;
    }
    Cam.video.srcObject = Cam.stream;
    await Cam.video.play();
    Cam.running = true;
    Cam.loadHands();
    Cam.loop();
  },

  /** MediaPipe là tùy chọn: không có nó thì dùng các nút số ngón bằng chuột. */
  async loadHands() {
    try {
      await Kernel.loadScript(CFG.mediapipe.base + CFG.mediapipe.script);
      Cam.hands = new Hands({ locateFile: (f) => CFG.mediapipe.base + f });
      Cam.hands.setOptions({
        maxNumHands: 2, modelComplexity: 0,
        minDetectionConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      Cam.hands.onResults((r) => {
        if (!Cam.auto) return;
        const marks = r.multiHandLandmarks;
        const handData = marks && marks.length ? marks.map(Cam.readHand).sort((a, b) => a.center.x - b.center.x) : [];
        const hand = handData[0] || null;
        Cam.pattern = hand ? hand.pattern : [false, false, false, false, false];
        Cam.tips = hand ? hand.tips : null;
        if (hand) {
          Cam.rawHandAngle = hand.angle;
          let delta = Cam.rawHandAngle - Cam.handAngle;
          while (delta > 180) delta -= 360;
          while (delta < -180) delta += 360;
          Cam.handAngle += delta * 0.18;
          Cam.handWind += ((hand.center.x - Cam.lastHandX) - Cam.handWind) * .35;
          Cam.lastHandX = hand.center.x;
          Cam.handCenter = hand.center;
          Cam.spellVfx?.setTracking({ anchor: hand.center, aim: hand.aim });
          Cam.observeSeals(handData);
        }
        Cam.observe(hand ? hand.pattern.filter(Boolean).length : CFG.fingerMax);
      });
    } catch (err) {
      Cam.hands = null;
      Cam.auto = false;
      Cam.msgEl.textContent = T.camManual;
      Cam.refreshButtons();
    }
  },

  /** Đọc bàn tay: ngón nào đang duỗi, và hai đầu ngón cái / ngón út ở đâu.
   *  Bốn ngón dựa vào toạ độ y; ngón cái dựa vào khoảng cách tới gốc ngón út, nên
   *  không phụ thuộc tay trái/phải hay ảnh có bị lật hay không. */
  readHand(lm) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const pattern = [
      dist(lm[4], lm[17]) > dist(lm[2], lm[17]) * CFG.thumbOutRatio,
      lm[8].y < lm[6].y, lm[12].y < lm[10].y, lm[16].y < lm[14].y, lm[20].y < lm[18].y,
    ];
    // Ảnh hiển thị bị lật ngang cho giống gương, nên toạ độ x cũng phải lật theo.
    const onScreen = (p) => ({
      x: (1 - p.x) * Cam.fx.width, y: p.y * Cam.fx.height,
    });
    const wrist = onScreen(lm[0]);
    const middleBase = onScreen(lm[9]);
    const angle = Math.atan2(
      middleBase.y - wrist.y,
      middleBase.x - wrist.x,
    ) * 180 / Math.PI + 90;
    const palmIds = [0, 5, 9, 13, 17];
    const centerRaw = palmIds.reduce((sum, id) => ({ x: sum.x + lm[id].x / palmIds.length, y: sum.y + lm[id].y / palmIds.length }), { x: 0, y: 0 });
    return {
      pattern, tips: [onScreen(lm[4]), onScreen(lm[20])], angle,
      center: { x: 1 - centerRaw.x, y: centerRaw.y },
      aim: onScreen(lm[8]),
    };
  },

  observeSeals(hands) {
    const now = performance.now();
    const matches = (hand, expected) => hand.pattern.every((value, index) => value === expected[index]);
    const hasThumbIndex = hands.some(hand => matches(hand, [true, true, false, false, false]));
    const hasIndexLittle = hands.some(hand => matches(hand, [false, true, false, false, true]));
    const hasThumbLittle = hands.some(hand => matches(hand, [true, false, false, false, true]));
    let candidate = null;
    if (hasThumbIndex) candidate = "thumb_index";
    else if (hasIndexLittle) candidate = "index_little";
    else if (hasThumbLittle) candidate = "thumb_little";
    if (!candidate) {
      Cam.sealLatched = null;
      Cam.sealKind = null;
      if (Cam.weather === "clear" && Cam.weatherHud) {
        Cam.weatherHud.querySelector("b").textContent = hands.length ? `CAMERA THẤY ${hands.length} TAY` : "ĐƯA TAY VÀO CAMERA";
        Cam.weatherHud.querySelector("span").textContent = "—";
        Cam.weatherHud.querySelector("em").style.width = "0%";
        Cam.fx.parentElement.dataset.phase = "idle";
      }
      return;
    }
    if (candidate === Cam.sealLatched) return;
    if (candidate !== Cam.sealKind) {
      Cam.sealKind = candidate; Cam.sealStartedAt = now;
      const label = candidate === "thumb_index" ? "CÁI + TRỎ" : candidate === "index_little" ? "TRỎ + ÚT" : "CÁI + ÚT";
      Cam.showWeatherCharge(label, 0);
      return;
    }
    const holdMs = candidate === "thumb_index" ? 420 : candidate === "index_little" ? 650 : 700;
    const progress = Math.min(1, (now - Cam.sealStartedAt) / holdMs);
    const label = candidate === "thumb_index" ? "CÁI + TRỎ" : candidate === "index_little" ? "TRỎ + ÚT" : "CÁI + ÚT";
    Cam.showWeatherCharge(label, progress);
    if (now - Cam.sealStartedAt < holdMs || now - Cam.lastMotionAt < 1200) return;
    Cam.weatherHud.querySelector("b").textContent = `XUẤT CHIÊU · ${label}`;
    Cam.weatherHud.querySelector("span").textContent = "100%";
    Cam.weatherHud.querySelector("em").style.width = "100%";
    Cam.sealLatched = candidate;
    Cam.triggerMotion(candidate);
  },

  showWeatherCharge(label, value) {
    if (!Cam.weatherHud || Cam.weather !== "clear") return;
    Cam.fx.parentElement.dataset.phase = "charge";
    Cam.weatherHud.querySelector("b").textContent = `NẠP PHÉP · ${label}`;
    Cam.weatherHud.querySelector("span").textContent = `${Math.round(value * 100)}%`;
    Cam.weatherHud.querySelector("em").style.width = `${value * 100}%`;
    Cam.spawnSparks(1 + Math.floor(value * 2), "#b9e8ff");
  },

  triggerMotion(motion) {
    const now = performance.now();
    if (now - Cam.lastMotionAt < 1200) return;
    Cam.lastMotionAt = now;
    Cam.sealKind = null;
    let spell = "clear";
    try { spell = Kernel.callBridge("_weather_action", [motion]) || "clear"; }
    catch (error) { Cam.msgEl.textContent = String(error).split("\n").pop(); }
    Cam.castWeather(spell);
  },

  castWeather(spell) {
    if (spell === "clear") {
      Cam.weather = "clear"; Cam.weatherUntil = 0;
      Cam.spellVfx?.clear();
      Cam.fx.parentElement.dataset.phase = "dissipate";
      Cam.msgEl.textContent = "ẤN GIẢI · VFX đang tan";
      setTimeout(() => { if (Cam.weather === "clear") Cam.fx.parentElement.dataset.phase = "idle"; }, 1500);
      return;
    }
    Cam.weather = spell;
    Cam.fx.parentElement.dataset.phase = "release";
    if (spell === "petals") spell = "lotus";
    const duration = spell === "swords" ? CFG.spells.swordsMs : spell === "lotus" ? CFG.spells.lotusMs : CFG.spells.lightningMs;
    Cam.weatherUntil = performance.now() + duration;
    Cam.spellVfx?.cast(spell, duration);
    Cam.spawnSparks(18, spell === "lotus" ? "#ff9c44" : "#b9e8ff");
    if (spell === "lightning") {
      Cam.playThunder();
    }
    Cam.msgEl.textContent = spell === "swords" ? "VẠN KIẾM QUY TÔNG · kiếm trận đã mở" :
      spell === "lotus" ? "HỎA LIÊN · HOA VŨ · hoa lửa đang nở" : "THIÊN LÔI!";
    if (Cam.weatherHud) {
      Cam.weatherHud.querySelector("b").textContent = spell === "swords" ? "⚔ VẠN KIẾM QUY TÔNG" : spell === "lotus" ? "✺ HỎA LIÊN · HOA VŨ" : "ϟ THIÊN LÔI";
      Cam.weatherHud.classList.add("casting");
    }
    setTimeout(() => { if (Cam.weather === spell) Cam.fx.parentElement.dataset.phase = "sustain"; }, 360);
  },

  playThunder() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audio = new AudioCtx(), length = Math.round(audio.sampleRate * 1.1);
    const buffer = audio.createBuffer(1, length, audio.sampleRate), data = buffer.getChannelData(0);
    let value = 0;
    for (let i = 0; i < length; i++) { value = value * .94 + (Math.random() * 2 - 1) * .18; data[i] = value * Math.exp(-i / (audio.sampleRate * .38)); }
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    filter.type = "lowpass"; filter.frequency.value = 420; gain.gain.value = .4; source.buffer = buffer;
    source.connect(filter).connect(gain).connect(audio.destination); source.start(); source.onended = () => audio.close();
  },

  samePose(pose) {
    return pose.every((want, i) => Cam.pattern[i] === want);
  },

  /* ---------------- bản đơn giản: giữ tay để lật + bụi phép ---------------- */

  setCharge(charge) {
    if (!Cam.gaugeEl) return;
    Cam.gaugeEl.style.setProperty("--charge", charge);
    Cam.gaugeEl.classList.toggle("on", charge > 0);
    Cam.gaugeEl.querySelector("span").textContent =
      charge > 0 ? T.holdHint : (Cam.tips ? T.sparkHint : "");
  },

  /** Xòe cả 5 ngón và giữ yên đủ lâu thì lật ảnh. Phải hạ tay xuống mới nạp lại được. */
  updateHold() {
    if (!Cam.samePose(CFG.holdPose)) {
      Cam.holdStart = 0;
      Cam.holdArmed = true;
      Cam.setCharge(0);
      return;
    }
    if (!Cam.holdArmed) return;
    const now = performance.now();
    if (!Cam.holdStart) Cam.holdStart = now;
    const charge = Math.min(1, (now - Cam.holdStart) / (CFG.holdSeconds * 1000));
    Cam.setCharge(charge);
    if (charge < 1) return;

    Cam.holdArmed = false;
    Cam.holdStart = 0;
    Cam.setCharge(0);
    Kernel.callBridge("toggle_flip", []);
    Cam.setFingers(Cam.fingers);                 // nhãn đổi theo trạng thái lật
    Cam.spawnSparks(CFG.spark.burst);
  },

  spawnSparks(count, weatherColor = null) {
    const { spark } = CFG;
    const sources = Cam.tips || [{ x: Cam.fx.width / 2, y: Cam.fx.height / 2 }];
    for (let i = 0; i < count && Cam.sparks.length < spark.max; i++) {
      const from = sources[i % sources.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.09;
      Cam.sparks.push({
        x: from.x, y: from.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.03,
        size: spark.minSize + Math.random() * (spark.maxSize - spark.minSize),
        life: spark.life, born: spark.life,
        color: weatherColor,
      });
    }
  },

  updateWeather(ctx, dt) {
    const now = performance.now();
    if (Cam.weather !== "clear" && now > Cam.weatherUntil) {
      Cam.weather = "clear";
      Cam.spellVfx?.clear();
      Cam.msgEl.textContent = "";
      if (Cam.weatherHud) {
        Cam.weatherHud.querySelector("b").textContent = "SẴN SÀNG NIỆM CHÚ";
        Cam.weatherHud.querySelector("span").textContent = "—";
        Cam.weatherHud.querySelector("em").style.width = "0%";
        Cam.weatherHud.classList.remove("casting");
      }
    }
    if (Cam.weather !== "clear" && Cam.weatherHud) {
      const total = Cam.weather === "swords" ? CFG.spells.swordsMs : Cam.weather === "lotus" ? CFG.spells.lotusMs : Cam.weather === "petals" ? CFG.spells.petalsMs : CFG.spells.lightningMs;
      const remaining = Math.max(0, Cam.weatherUntil - now);
      Cam.weatherHud.querySelector("span").textContent = `${(remaining / 1000).toFixed(1)}s`;
      Cam.weatherHud.querySelector("em").style.width = `${remaining / total * 100}%`;
    }
  },

  /** Bụi phép: giơ ngón cái + ngón út thì hạt bay ra từ hai đầu ngón đó. */
  updateSparks(dt) {
    if (Cam.samePose(CFG.sparkPose)) Cam.spawnSparks(CFG.spark.perFrame);

    const ctx = Cam.fx.getContext("2d");
    ctx.clearRect(0, 0, Cam.fx.width, Cam.fx.height);
    Cam.updateWeather(ctx, dt);
    if (!Cam.sparks.length) return;

    const alive = [];
    for (const spark of Cam.sparks) {
      spark.life -= dt;
      if (spark.life <= 0) continue;
      spark.vy += CFG.spark.gravity * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      ctx.globalAlpha = spark.life / spark.born;
      ctx.fillStyle = spark.color || CFG.sparkColors[Cam.sparkColor] || CFG.sparkColors[CFG.defaultSparkColor];
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
      alive.push(spark);
    }
    ctx.globalAlpha = 1;
    Cam.sparks = alive;
  },

  async loop() {
    if (!Cam.running) return;
    const startedAt = performance.now();
    const ctx = Cam.capture.getContext("2d", { willReadFrequently: true });
    ctx.save();                                   // lật ngang cho giống soi gương
    ctx.scale(-1, 1);
    ctx.drawImage(Cam.video, -CFG.capture.w, 0, CFG.capture.w, CFG.capture.h);
    ctx.restore();

    if (Cam.hands && Cam.auto && Cam.frame % CFG.detectEveryNFrames === 0) {
      try { await Cam.hands.send({ image: Cam.video }); } catch (e) { /* vẫn chạy tiếp */ }
    }
    Cam.frame++;
    if (Cam.running) Cam.renderFrame(ctx);
    const elapsed = performance.now() - startedAt;
    if (SIMPLE && Cam.running) {
      Cam.updateHold();
      Cam.updateSparks(Math.min(elapsed, CFG.spark.life));   // chặn dt khi tab bị treo
    }
    Cam.tick(elapsed);
    if (Cam.running) setTimeout(Cam.loop, 0);
  },

  renderFrame(ctx) {
    if (!Kernel.py || Kernel.state === "loading") return;
    const level = CFG.quality[Cam.quality];
    const src = ctx.getImageData(0, 0, CFG.capture.w, CFG.capture.h).data;
    let bytes;
    try {
      bytes = Kernel.callBridge("_frame",
        [new Uint8Array(src.buffer.slice(0)), CFG.capture.w, CFG.capture.h,
          Cam.fingers, level.w, level.h, Cam.handAngle]);
      Cam.msgEl.textContent = Kernel.callBridge("_status", []);
    } catch (err) {
      Cam.msgEl.textContent = String((err && err.message) || err).split("\n").pop();
      return;
    }
    Cam.display.getContext("2d").putImageData(
      new ImageData(new Uint8ClampedArray(bytes), CFG.capture.w, CFG.capture.h), 0, 0);
  },

  tick(ms) {
    Cam.times.push(ms);
    if (Cam.times.length > CFG.fpsWindow) Cam.times.shift();
    const mean = Cam.times.reduce((a, b) => a + b, 0) / Cam.times.length;
    Cam.fpsEl.textContent = (1000 / Math.max(mean, 1)).toFixed(1) + " fps";
  },

  toggleRecording(button) {
    if (Cam.recorder?.state === "recording") {
      button.disabled = true;
      Cam.recorder.onstop = () => {
        const blob = new Blob(Cam.recordChunks, { type: Cam.recorder.mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `magic-mirror-vfx-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        button.disabled = false;
        button.classList.remove("recording");
        button.textContent = "● Quay màn phép";
        Cam.msgEl.textContent = "Video WebM đã được tải xuống.";
      };
      Cam.recorder.stop();
      return;
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      Cam.msgEl.textContent = "Hãy dùng Chrome hoặc Edge mới để quay màn phép.";
      return;
    }
    Cam.recordCanvas = document.createElement("canvas");
    Cam.recordCanvas.width = Cam.display.width;
    Cam.recordCanvas.height = Cam.display.height;
    Cam.recordChunks = [];
    const stream = Cam.recordCanvas.captureStream(0);
    Cam.recordTrack = stream.getVideoTracks()[0];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    Cam.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    Cam.recorder.ondataavailable = event => { if (event.data.size) Cam.recordChunks.push(event.data); };
    Cam.recorder.start(250);
    button.classList.add("recording");
    button.textContent = "■ Dừng và tải video";
    Cam.msgEl.textContent = "ĐANG QUAY · Hãy giơ tổ hợp ngón và biểu diễn.";
    const compose = () => {
      if (Cam.recorder?.state !== "recording") return;
      const ctx = Cam.recordCanvas.getContext("2d");
      ctx.drawImage(Cam.display, 0, 0, Cam.recordCanvas.width, Cam.recordCanvas.height);
      ctx.drawImage(Cam.fx, 0, 0, Cam.fx.width, Cam.fx.height, 0, 0, Cam.recordCanvas.width, Cam.recordCanvas.height);
      ctx.drawImage(Cam.spellFx, 0, 0, Cam.spellFx.width, Cam.spellFx.height, 0, 0, Cam.recordCanvas.width, Cam.recordCanvas.height);
      Cam.recordTrack?.requestFrame?.();
      requestAnimationFrame(compose);
    };
    compose();
  },

  stop() {
    Cam.running = false;
    if (Cam.stream) Cam.stream.getTracks().forEach((t) => t.stop());
    Cam.stream = null;
    Cam.times = [];
  },
};

/** Cầu nối mà phía Python gọi sang. */
window.MagicMirrorUI = {
  start: () => Cam.start(),
  stop: () => Cam.stop(),
  emit: (kind, data) => Nb.emit(kind, data),
  progress: (taskId, passed) => Nb.recordTask(taskId, Boolean(passed)),
  /** magic_mirror.set_spark() gọi vào đây để đổi màu / số lượng bụi phép. */
  configureSparks: (color, perFrame) => {
    if (color && CFG.sparkColors[color]) Cam.sparkColor = color;
    if (perFrame) CFG.spark.perFrame = Math.max(1, Math.min(12, perFrame));
  },
  configureSpells: (swordsSeconds, lotusSeconds, lightningSeconds) => {
    CFG.spells.swordsMs = swordsSeconds * 1000;
    CFG.spells.lotusMs = lotusSeconds * 1000;
    CFG.spells.lightningMs = lightningSeconds * 1000;
  },
  sparkColorNames: () => Object.keys(CFG.sparkColors).join(", "),
};

/* --------------------------------- notebook --------------------------------- */
const Nb = {
  cells: [], file: PAGE.notebook, counter: 0, currentOutput: null,
  saved: null, saveTimer: null, storageAvailable: true,

  storageKey() { return `magic-dust-kit:skin-lab:${PAGE.mode}:v${CFG.storageSchema}`; },

  emptySaved() {
    return {
      schema: CFG.storageSchema,
      courseVersion: PAGE.courseVersion,
      cells: {}, passed: [], lastCellId: null, updatedAt: null,
    };
  },

  readSaved() {
    try {
      return JSON.parse(localStorage.getItem(Nb.storageKey()) || "null");
    } catch {
      Nb.storageAvailable = false;
      return null;
    }
  },

  async load() {
    const res = await fetch(Nb.file, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    Nb.adopt(await res.json());
  },

  adopt(json) {
    const rawSaved = Nb.readSaved();
    Nb.saved = rawSaved && !Array.isArray(rawSaved) ? Object.assign(Nb.emptySaved(), rawSaved) : Nb.emptySaved();
    if (!Nb.saved.cells || typeof Nb.saved.cells !== "object") Nb.saved.cells = {};
    Nb.cells = (json.cells || []).map((c, idx) => ({
      id: c.id || c.metadata?.stable_id || `cell-${idx}`,
      type: c.cell_type === "markdown" ? "markdown" : "code",
      source: joinSource(c.source),
      tags: (c.metadata && c.metadata.tags) || [],
      editing: false, count: null,
    }));
    // Đọc được bản lưu đời cũ thì ghép theo index đúng một lần, sau đó ghi lại theo ID ổn định.
    if (Array.isArray(rawSaved)) {
      Nb.cells.forEach((cell, index) => {
        if (rawSaved[index] !== undefined) Nb.saved.cells[cell.id] = rawSaved[index];
      });
    }
    Nb.cells.forEach((cell) => {
      if (Object.prototype.hasOwnProperty.call(Nb.saved.cells, cell.id)) {
        cell.source = typeof Nb.saved.cells[cell.id] === "string"
          ? Nb.saved.cells[cell.id]
          : Nb.saved.cells[cell.id].source;
      }
    });
    // Ô do học sinh tự thêm không có trong file notebook gốc, nên phải dựng lại từ bản lưu.
    const notebookIds = new Set(Nb.cells.map((cell) => cell.id));
    for (const [id, savedCell] of Object.entries(Nb.saved.cells)) {
      if (notebookIds.has(id) || !savedCell?.user) continue;
      Nb.cells.push({
        id,
        type: savedCell.type === "markdown" ? "markdown" : "code",
        source: savedCell.source || "",
        tags: Array.isArray(savedCell.tags) ? savedCell.tags : [],
        editing: false, count: null,
      });
    }
    Nb.saved.courseVersion = PAGE.courseVersion;
    Nb.counter = 0;
    Nb.render();
    if (Array.isArray(rawSaved)) Nb.persist();
  },

  scheduleSave() {
    clearTimeout(Nb.saveTimer);
    Nb.noteSave("Đang tự lưu…");
    Nb.saveTimer = setTimeout(() => Nb.persist(), CFG.saveDelayMs);
  },

  persist() {
    if (!Nb.saved) Nb.saved = Nb.emptySaved();
    Nb.saved.cells = Object.fromEntries(Nb.cells.map((cell) => [cell.id, {
      source: cell.source,
      type: cell.type,
      tags: cell.tags,
      user: cell.id.startsWith("user-"),
    }]));
    Nb.saved.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(Nb.storageKey(), JSON.stringify(Nb.saved));
      Nb.storageAvailable = true;
      Nb.noteSave("Đã tự lưu");
    } catch {
      Nb.storageAvailable = false;
      Nb.noteSave("Không tự lưu được — hãy tải notebook", true);
    }
  },

  noteSave(text, warn = false) {
    const el = document.getElementById("saveState");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("warn", warn);
  },

  recordTask(taskId, passed) {
    if (!Nb.saved) Nb.saved = Nb.emptySaved();
    const done = new Set(Nb.saved.passed || []);
    if (passed) done.add(taskId); else done.delete(taskId);
    Nb.saved.passed = [...done];
    const cell = Nb.cells.find((item) => item.tags.includes(`task:${taskId}`));
    if (cell?.el) cell.el.classList.toggle("done", passed);
    Nb.persist();
  },

  render() {
    const root = document.getElementById("notebook");
    root.textContent = "";
    Nb.cells.forEach((cell, idx) => {
      root.appendChild(Nb.renderCell(cell, idx));
      root.appendChild(Nb.addBar(idx));
    });
  },

  addBar(idx) {
    const bar = document.createElement("div");
    bar.className = "addbar";
    const add = document.createElement("button");
    add.className = "btn"; add.textContent = "+ Ô code";
    add.onclick = () => {
      Nb.cells.splice(idx + 1, 0, {
        id: `user-${Date.now()}`, type: "code", source: "", tags: [], editing: false, count: null,
      });
      Nb.persist(); Nb.render();
    };
    bar.appendChild(add);
    return bar;
  },

  renderCell(cell, idx) {
    const el = document.createElement("div");
    el.className = "cell";
    el.dataset.cellId = cell.id;
    const taskTag = cell.tags.find((tag) => tag.startsWith("task:"));
    if (taskTag && new Set(Nb.saved?.passed || []).has(taskTag.slice(5))) el.classList.add("done");
    el.onmousedown = () => Nb.focusCell(idx, false);

    const gutter = document.createElement("div");
    gutter.className = "gutter";
    const prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.textContent = cell.type === "code" ? `In [${cell.count === null ? " " : cell.count}]:` : "";
    const run = document.createElement("button");
    run.className = "run-btn"; run.textContent = "▶"; run.title = "Chạy ô này";
    run.onclick = (e) => { e.stopPropagation(); Nb.runCell(idx); };
    gutter.append(prompt, run);

    const body = document.createElement("div");
    body.className = "body";
    if (cell.type === "markdown" && !cell.editing) {
      const md = document.createElement("div");
      md.className = "md";
      md.innerHTML = MD.render(cell.source);
      md.ondblclick = () => { cell.editing = true; Nb.render(); Nb.focusCell(idx, true); };
      body.appendChild(md);
    } else {
      if (cell.tags.includes(CFG.skipTag)) {
        const tag = document.createElement("div");
        tag.className = "cell-tag"; tag.textContent = T.skipCell;
        body.appendChild(tag);
      }
      body.appendChild(Nb.editor(cell, idx));
    }
    const out = document.createElement("div");
    out.className = "out";
    cell.outEl = out;
    body.appendChild(out);

    el.append(gutter, body);
    cell.el = el;
    return el;
  },

  editor(cell, idx) {
    const wrap = document.createElement("div");
    wrap.className = "editor";
    const pre = document.createElement("pre");
    pre.className = "hl";
    const area = document.createElement("textarea");
    area.spellcheck = false;
    area.value = cell.source;
    wrap.append(pre, area);
    cell.area = area;

    const sync = () => {
      pre.innerHTML = cell.type === "code" ? Hi.run(area.value) : MD.esc(area.value) + "\n";
      area.style.height = "auto";
      area.style.height = area.scrollHeight + "px";
    };
    area.addEventListener("input", () => { cell.source = area.value; sync(); Nb.scheduleSave(); });
    area.addEventListener("focus", () => Nb.focusCell(idx, false));
    area.addEventListener("keydown", (e) => Nb.onKey(e, cell, idx, sync));
    requestAnimationFrame(sync);
    sync();
    return wrap;
  },

  onKey(e, cell, idx, sync) {
    if (e.key === "Tab") {
      e.preventDefault();
      const at = e.target.selectionStart;
      e.target.setRangeText(CFG.tab, at, e.target.selectionEnd, "end");
      cell.source = e.target.value; sync(); Nb.scheduleSave();
    } else if (e.key === "Enter" && (e.shiftKey || e.ctrlKey)) {
      e.preventDefault();
      Nb.runCell(idx).then(() => { if (e.shiftKey) Nb.focusCell(idx + 1, true); });
    } else if (e.key === "Escape" && cell.type === "markdown") {
      cell.editing = false; Nb.render();
    }
  },

  focusCell(idx, moveCaret) {
    if (idx >= Nb.cells.length) return;
    Nb.cells.forEach((c, i) => c.el && c.el.classList.toggle("active", i === idx));
    const cell = Nb.cells[idx];
    if (cell && Nb.saved && Nb.saved.lastCellId !== cell.id) {
      Nb.saved.lastCellId = cell.id;
      Nb.scheduleSave();
    }
    if (moveCaret && cell && cell.area) cell.area.focus();
  },

  showResume() {
    if (!Nb.saved?.lastCellId || PAGE.mode.includes("answers")) return;
    const target = Nb.cells.find((cell) => cell.id === Nb.saved.lastCellId);
    if (!target?.el) return;
    App.banner(
      `Bài của em đã được tự lưu trên máy này. <button class="btn resume" id="resumeBtn">Tiếp tục từ chỗ đang học</button>`,
      false,
    );
    document.getElementById("resumeBtn").onclick = () => {
      target.el.scrollIntoView({ behavior: "smooth", block: "center" });
      target.el.classList.add("active");
      target.area?.focus();
    };
  },

  emit(kind, data) {
    if (!Nb.currentOutput) return;
    if (kind === "image") {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + data;
      Nb.currentOutput.appendChild(img);
    } else {
      Nb.appendText(Nb.currentOutput, "out", data + "\n");
    }
  },

  appendText(host, kind, text) {
    let last = host.lastElementChild;
    if (!last || last.tagName !== "PRE" || last.dataset.kind !== kind) {
      last = document.createElement("pre");
      last.dataset.kind = kind;
      if (kind === "err") last.className = "err";
      host.appendChild(last);
    }
    last.textContent += text;
  },

  async runCell(idx) {
    const cell = Nb.cells[idx];
    if (!cell) return;
    Nb.focusCell(idx, false);
    if (cell.type === "markdown") { cell.editing = false; Nb.render(); return; }
    if (Kernel.state === "loading") return;

    // Nạp lại các định nghĩa đã lưu trước ô hiện tại. Nhờ vậy học sinh có thể đóng máy,
    // hôm sau mở thẳng Chặng 4 mà không phải nhớ chạy lại Chặng 1..3 bằng tay.
    for (let prior = 0; prior < idx; prior++) {
      const dependency = Nb.cells[prior];
      if (dependency.type === "code" && dependency.tags.includes("autoload")) {
        await Kernel.exec(dependency.source, () => {});
      }
    }

    cell.outEl.textContent = "";
    cell.el.classList.add("running");
    Nb.currentOutput = cell.outEl;
    const host = cell.outEl;
    await Kernel.exec(cell.source, (kind, text) => Nb.appendText(host, kind, text));
    cell.count = ++Nb.counter;
    cell.el.classList.remove("running");
    cell.el.querySelector(".prompt").textContent = `In [${cell.count}]:`;
    Nb.persist();
  },

  async runAll() {
    for (let i = 0; i < Nb.cells.length; i++) {
      const cell = Nb.cells[i];
      if (cell.type !== "code" || cell.tags.includes(CFG.skipTag)) continue;
      await Nb.runCell(i);
    }
  },

  clearOutputs() {
    Nb.counter = 0;
    Nb.cells.forEach((c) => {
      c.count = null;
      if (c.outEl) c.outEl.textContent = "";
      if (c.el && c.type === "code") c.el.querySelector(".prompt").textContent = "In [ ]:";
    });
  },

  toIpynb() {
    return {
      cells: Nb.cells.map((c) => ({
        id: c.id,
        cell_type: c.type,
        metadata: { stable_id: c.id, ...(c.tags.length ? { tags: c.tags } : {}) },
        source: splitSource(c.source),
        ...(c.type === "code" ? { execution_count: null, outputs: [] } : {}),
      })),
      metadata: {
        kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
        language_info: { name: "python" },
      },
      nbformat: 4, nbformat_minor: 5,
    };
  },
};

function joinSource(src) { return Array.isArray(src) ? src.join("") : String(src || ""); }
function splitSource(text) {
  const lines = text.split("\n");
  return lines.map((l, i) => (i === lines.length - 1 ? l : l + "\n"));
}

/* ----------------------------------- app ----------------------------------- */
const App = {
  pageNotice: "",          // notice baked into the page; restored after the notebook loads

  banner(html, warn) {
    const el = document.getElementById("banner");
    el.innerHTML = html;
    el.classList.toggle("warn", !!warn);
    el.classList.toggle("hidden", !html);
  },

  async openNotebook() {
    try {
      await Nb.load();
      const isFileUrl = location.protocol === "file:";
      App.banner(isFileUrl ? T.fileHint : App.pageNotice, isFileUrl);
      if (!isFileUrl) Nb.showResume();
    } catch (err) {
      document.getElementById("notebook").textContent = "";
      App.banner((location.protocol === "file:" ? T.fileHint + "<br><br>" : "") + T.loadFail(Nb.file), true);
    }
  },

  wire() {
    document.getElementById("runAllBtn").onclick = () => Nb.runAll();
    document.getElementById("restartBtn").onclick = async () => { Nb.clearOutputs(); await Kernel.restart(); };
    document.getElementById("resetBtn").onclick = () => {
      if (!window.confirm("Xóa toàn bộ code và tiến độ Skin Lab đã tự lưu trên máy này?")) return;
      localStorage.removeItem(Nb.storageKey());
      Cam.stop();
      App.openNotebook();
    };
    document.getElementById("saveBtn").onclick = App.download;
    document.getElementById("openBtn").onclick = () => document.getElementById("filePicker").click();
    document.getElementById("filePicker").onchange = App.openLocalFile;
  },

  download() {
    const fileName = Nb.file.replace(/\.ipynb$/, "") + "_cua_em.ipynb";
    const blob = new Blob([JSON.stringify(Nb.toIpynb(), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  openLocalFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      Cam.stop();
      Nb.file = file.name;
      Nb.adopt(JSON.parse(reader.result));
      App.banner("");
    };
    reader.readAsText(file, "utf-8");
  },

  async start() {
    document.documentElement.dataset.page = PAGE.mode;
    App.pageNotice = document.getElementById("banner").innerHTML.trim();
    App.wire();
    await App.openNotebook();
    await Kernel.boot();
  },
};

App.start();
