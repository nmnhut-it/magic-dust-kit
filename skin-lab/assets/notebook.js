/* Bộ máy notebook Magic Mirror: kernel Pyodide + camera + MediaPipe.
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
    packages: ["numpy", "pillow", "scipy"],
    moduleDir: "/home/pyodide",
    modulePath: "/home/pyodide/magic_mirror.py",
    moduleSource: "assets/magic_mirror.py",
    photosDir: "/home/pyodide/photos",
    photos: [
      "face-acne-cheek.jpg",
      "face-portrait-william-stitt.jpg",
      "face-portrait-eddie-kopp.jpg",
      "human-skin-closeup.jpg",
    ],
  },
  mediapipe: {
    hands: { base: "https://cdn.jsdelivr.net/npm/@mediapipe/hands/", script: "hands.js" },
    face: { base: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/", script: "face_mesh.js" },
  },
  capture: { w: 480, h: 360 },
  quality: [
    { label: "Fast (160×120)", w: 160, h: 120 },
    { label: "Balanced (240×180)", w: 240, h: 180 },
    { label: "Detailed (320×240)", w: 320, h: 240 },
  ],
  defaultQuality: 1,
  fingerMax: 5,
  detectEveryNFrames: 3,
  stableFrames: 3,          // phải thấy cùng một số ngón bấy nhiêu lần mới đổi
  thumbOutRatio: 1.25,
  fpsWindow: 12,
  storagePrefix: "magic-mirror-nb:",
  storageSchema: 3,
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
  kernel: { loading: "Loading Python…", ready: "Kernel ready", busy: "Running…", error: "Kernel error" },
  skipCell: "This cell is intended for Colab or a local Python install — press ▶ to run it anyway",
  fileHint: "<strong>This page is open with <code>file://</code>.</strong> The browser will block the notebook file " +
    "and may block the camera. Open a terminal in the project folder, run " +
    "<code>python -m http.server 8000</code>, then visit <code>http://localhost:8000</code>.",
  loadFail: (f) => `<strong>Could not read <code>${f}</code>.</strong> Check that it is beside this page, ` +
    `or press <em>📂 Open file</em> to choose a notebook from this device.`,
  camDenied: "Could not open the camera: ",
  camManual: "The hand detector could not load. Use the numbered buttons below instead.",
  bootFail: "Pyodide could not load. Check the connection and reload the page.",
  fingerBtn: (n) => `${n} fingers`,
  holdHint: "Hold all 5 fingers open to flip the image",
  holdDone: "Flipped!",
  sparkHint: "Raise your thumb and little finger to create particles",
  starterBtn: "↺ This task changed — get the new version",
  starterSure: "Sure? This replaces the code in this cell",
  lessonUpdated: (n) => `<strong>The lesson was updated.</strong> ${n} task${n === 1 ? "" : "s"} now ` +
    `ask${n === 1 ? "s" : ""} for something different. Your own code was kept — press ` +
    `<em>↺ This task changed</em> inside a highlighted cell to take the new version of that one cell.`,
};

const PAGE = Object.assign(
  { notebook: "Magic_Mirror.ipynb", mode: "student", courseVersion: "1" },
  window.MM_PAGE || {},
);
const SIMPLE = PAGE.mode.startsWith("simple");   // bản đơn giản: giữ tay để lật + bụi phép
const SKIN = PAGE.mode.startsWith("skin");       // route riêng: tích chập + bộ lọc da, không training
// Trang đáp án KHÔNG nạp lại mã đã lưu: ở đó không có bài của ai để giữ, mà bản
// lưu cũ thì đè đáp án cũ lên notebook mới. Đúng lỗi thầy gặp: bản lưu giữ
// smooth_skin(img, area_mask, strength) đời trước, ô chấm mới gọi thêm radius
// và báo "TypeError: takes 3 positional arguments but 4 were given" — 9/10 trên
// một trang mà máy mở lần đầu vẫn chấm 10/10.
const RESTORES_WORK = PAGE.mode !== "skin-answers";

// Các vòng landmark của MediaPipe Face Mesh (refineLandmarks: true, 478 điểm).
// `oval` là đường viền khuôn mặt — vùng ĐƯỢC phép sửa.
// `lips` + hai mắt là các vùng PHẢI chừa ra: làm mịn ở đó thì mất nét mặt.
const FACE_RINGS = {
  oval: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,
    152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
  lips: [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185],
  leftEye: [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
  rightEye: [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398],
};
const FEATURE_RINGS = ["lips", "leftEye", "rightEye"];

/** Tô một hay nhiều vòng landmark thành mặt nạ 0/255.
 *  landmarks: mảng điểm của Face Mesh; rings: tên vòng trong FACE_RINGS;
 *  mapPoint(landmark) -> {x, y} theo pixel (camera lật ngang, ảnh chụp thì không).
 *  Trả về Uint8Array dài width*height, hoặc null nếu không vẽ được vòng nào. */
function ringMaskBytes(landmarks, rings, width, height, mapPoint, canvas) {
  const target = canvas || document.createElement("canvas");
  target.width = width; target.height = height;
  const ctx = target.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  let drew = false;
  for (const ring of rings) {
    const points = FACE_RINGS[ring].map((index) => landmarks[index]).filter(Boolean);
    if (points.length < 3) continue;
    ctx.beginPath();
    points.forEach((landmark, index) => {
      const { x, y } = mapPoint(landmark);
      if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fill();
    drew = true;
  }
  if (!drew) return null;
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index++) mask[index] = rgba[index * 4 + 3];
  return mask;
}

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

  /** Danh sách có dòng nối và mục con: dòng lùi đầu (không phải mục mới) nối vào
   *  mục phía trên; mục lùi sâu hơn thành <ol>/<ul> lồng — trước đây cả hai đều
   *  làm gãy danh sách giữa chừng và mất số thứ tự của các bước. */
  list(lines, start) {
    const isItem = (text) => /^\s*([-*+]|\d+\.)\s+/.test(text);
    const indentOf = (text) => (text.match(/^\s*/) || [""])[0].length;
    let i = start;
    const parse = (indent) => {
      const ordered = /^\s*\d+\./.test(lines[i]);
      let html = "";
      while (i < lines.length && isItem(lines[i]) && indentOf(lines[i]) === indent) {
        let text = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, "");
        for (i++; i < lines.length && lines[i].trim() && !isItem(lines[i]) && indentOf(lines[i]) > indent; i++) {
          text += " " + lines[i].trim();
        }
        let nested = "";
        if (i < lines.length && isItem(lines[i]) && indentOf(lines[i]) > indent) nested = parse(indentOf(lines[i]));
        html += `<li>${MD.inline(text)}${nested}</li>`;
      }
      return `<${ordered ? "ol" : "ul"}>${html}</${ordered ? "ol" : "ul"}>`;
    };
    return { html: parse(indentOf(lines[start])), next: i };
  },

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
        const list = MD.list(lines, i);
        out.push(list.html);
        i = list.next;
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

    Kernel.setState("loading", "Loading Python…");
    Kernel.py = await loadPyodide({ indexURL });
    Kernel.setState("loading", "Loading NumPy + SciPy + Pillow…");
    await Kernel.py.loadPackage(CFG.pyodide.packages);
    // `batched` gọi mỗi dòng một lần và bỏ ký tự xuống dòng — trả lại cho đúng.
    Kernel.py.setStdout({ batched: (s) => Kernel.sink && Kernel.sink("out", s + "\n") });
    Kernel.py.setStderr({ batched: (s) => Kernel.sink && Kernel.sink("err", s + "\n") });
    await Kernel.install();
    Kernel.setState("ready");
  },

  /** Chép magic_mirror.py vào hệ thống file ảo rồi mở sẵn display() cho notebook. */
  async install() {
    const moduleUrl = `${CFG.pyodide.moduleSource}?v=${encodeURIComponent(PAGE.courseVersion)}`;
    const res = await fetch(moduleUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(CFG.pyodide.moduleSource + ": " + res.status);
    Kernel.py.FS.writeFile(CFG.pyodide.modulePath, new TextEncoder().encode(await res.text()));
    if (SKIN) {
      Kernel.py.FS.mkdirTree(CFG.pyodide.photosDir);
      for (const file of CFG.pyodide.photos) {
        const photoUrl = `assets/photos/${file}`;
        const photo = await fetch(photoUrl, { cache: "no-store" });
        if (!photo.ok) throw new Error(photoUrl + ": " + photo.status);
        Kernel.py.FS.writeFile(`${CFG.pyodide.photosDir}/${file}`, new Uint8Array(await photo.arrayBuffer()));
      }
    }
    const dir = JSON.stringify(CFG.pyodide.moduleDir);
    await Kernel.py.runPythonAsync(
      `import sys\nif ${dir} not in sys.path:\n    sys.path.insert(0, ${dir})\n` +
      "from magic_mirror import show as display\n" +
      (SIMPLE ? "import magic_mirror as _mm\n_mm.use_simple_mode()\n" : "") +
      (SKIN ? "import magic_mirror as _mm\n_mm.use_skin_mode()\n" : ""));
  },

  async restart() {
    Cam.stop();
    Snapshot.stop();
    Kernel.setState("loading", "Restarting…");
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
      kept.push(line.replace(/^\s+File "<exec>", line (\d+).*$/, "In this code cell, line $1:"));
    }
    const hasUserFrame = kept.some((line) => line.startsWith("In this code cell"));
    const shortened = kept.filter((line) => line.trim() && (hasUserFrame || !line.startsWith(pythonErrorHeader))).join("\n");
    // NameError về '___' nghĩa là học sinh chưa điền chỗ trống — dịch hộ các em
    // thay vì bắt các em tự luận ra từ traceback.
    if (String(text).includes("'___'")) {
      return shortened + "\n→ A ___ blank is still in this code. Replace every ___ with your answer, then run the cell again.";
    }
    return shortened;
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
  hands: null, faceMesh: null, faceLandmarks: [], frame: 0, running: false, quality: CFG.defaultQuality,
  showFaceMesh: true,
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

    Cam.buttons = {};
    if (!SKIN) {
      const auto = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox"; box.checked = true;
      box.onchange = () => { Cam.auto = box.checked; Cam.refreshButtons(); };
      auto.append(box, "Tự đếm ngón tay");
      bar.appendChild(auto);
      for (let n = 0; n <= CFG.fingerMax; n++) {
        const b = document.createElement("button");
        b.className = "gest"; b.textContent = T.fingerBtn(n);
        b.onclick = () => Cam.setFingers(n);
        Cam.buttons[n] = b;
        bar.appendChild(b);
      }
      bar.appendChild(Object.assign(document.createElement("span"), { className: "sep" }));
    }

    const q = document.createElement("select");
    q.className = "btn";
    CFG.quality.forEach((lvl, idx) => q.add(new Option(lvl.label, String(idx))));
    q.value = String(Cam.quality);
    q.onchange = () => { Cam.quality = Number(q.value); };
    bar.append(Object.assign(document.createElement("label"), { textContent: "Độ nét:" }), q);
    if (SKIN) {
      const landmarks = document.createElement("label");
      const landmarkBox = document.createElement("input");
      landmarkBox.type = "checkbox"; landmarkBox.checked = Cam.showFaceMesh;
      landmarkBox.onchange = () => { Cam.showFaceMesh = landmarkBox.checked; };
      landmarks.append(landmarkBox, "Hiện đường viền Face Mesh");
      bar.appendChild(landmarks);
    }
    if (!SKIN) {
      for (const [label, spell] of [["ϟ Thiên Lôi", "lightning"], ["⚔ Vạn Kiếm", "swords"], ["✺ Hỏa Liên · Hoa Vũ", "lotus"]]) {
        const weatherButton = document.createElement("button");
        weatherButton.className = "btn";
        weatherButton.textContent = label;
        weatherButton.onclick = () => Cam.castWeather(spell);
        bar.appendChild(weatherButton);
      }
    }
    const stageButton = document.createElement("button");
    stageButton.className = "btn"; stageButton.textContent = SKIN ? "⛶ Toàn màn hình" : "⛶ Trình diễn";
    stageButton.onclick = () => bar.closest(".cam").requestFullscreen?.();
    bar.appendChild(stageButton);
    const recordButton = document.createElement("button");
    recordButton.className = "btn record-vfx"; recordButton.textContent = SKIN ? "● Quay kết quả" : "● Quay màn phép";
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
        video: {
          width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user",
        },
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
    if (SKIN) return Cam.loadFaceMesh();
    try {
      const config = CFG.mediapipe.hands;
      await Kernel.loadScript(config.base + config.script);
      Cam.hands = new Hands({ locateFile: (f) => config.base + f });
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

  async loadFaceMesh() {
    try {
      const config = CFG.mediapipe.face;
      await Kernel.loadScript(config.base + config.script);
      Cam.faceMesh = new FaceMesh({ locateFile: (file) => config.base + file });
      Cam.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      Cam.faceMesh.onResults((result) => {
        Cam.faceLandmarks = result.multiFaceLandmarks?.[0] || [];
      });
      Cam.msgEl.textContent = "MediaPipe Face Mesh đang tìm đường viền khuôn mặt…";
    } catch (error) {
      Cam.faceMesh = null;
      Cam.faceLandmarks = [];
      Cam.msgEl.textContent = "Không tải được MediaPipe Face Mesh; camera vẫn chạy nhưng vùng giới hạn khuôn mặt đang tắt.";
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

  faceOval() {
    return FACE_RINGS.oval.map((index) => Cam.faceLandmarks[index]).filter(Boolean);
  },

  /** Ảnh camera lật ngang như soi gương, nên x phải đổi thành 1 - x. */
  mapPoint(width, height) {
    return (landmark) => ({ x: (1 - landmark.x) * width, y: landmark.y * height });
  },

  faceMaskBytes(width, height) {
    const canvas = Cam.maskCanvas || (Cam.maskCanvas = document.createElement("canvas"));
    return ringMaskBytes(Cam.faceLandmarks, ["oval"], width, height,
      Cam.mapPoint(width, height), canvas);
  },

  drawFaceMesh() {
    if (!SKIN || !Cam.fx) return;
    const ctx = Cam.fx.getContext("2d");
    ctx.clearRect(0, 0, Cam.fx.width, Cam.fx.height);
    if (!Cam.showFaceMesh || !Cam.faceLandmarks.length) return;
    const point = (landmark) => ({
      x: (1 - landmark.x) * Cam.fx.width,
      y: landmark.y * Cam.fx.height,
    });
    const oval = Cam.faceOval().map(point);
    ctx.fillStyle = "rgba(255, 209, 102, .14)";
    ctx.strokeStyle = "rgba(255, 209, 102, .95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    oval.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(95, 238, 220, .82)";
    Cam.faceLandmarks.forEach((landmark, index) => {
      if (index % 6 !== 0) return;
      const p = point(landmark);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
    });
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

    const tracker = SKIN ? Cam.faceMesh : Cam.hands;
    if (tracker && (SKIN || Cam.auto) && Cam.frame % CFG.detectEveryNFrames === 0) {
      try { await tracker.send({ image: Cam.video }); } catch (e) { /* vẫn chạy tiếp */ }
    }
    Cam.frame++;
    if (Cam.running) Cam.renderFrame(ctx);
    if (SKIN && Cam.running) Cam.drawFaceMesh();
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
          Cam.fingers, level.w, level.h, Cam.handAngle,
          SKIN ? Cam.faceMaskBytes(level.w, level.h) : null]);
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
        link.download = `${SKIN ? "skin-lab-camera" : "magic-mirror-vfx"}-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        button.disabled = false;
        button.classList.remove("recording");
        button.textContent = SKIN ? "● Quay kết quả" : "● Quay màn phép";
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
    Cam.msgEl.textContent = SKIN ? "ĐANG QUAY · Khung hình chỉ được ghi khi em bấm quay." :
      "ĐANG QUAY · Hãy giơ tổ hợp ngón và biểu diễn.";
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
    Cam.faceLandmarks = [];
    Cam.times = [];
  },
};

/* ------------------------ chụp một ảnh cho Skin Lab ------------------------ */
const Snapshot = {
  host: null, wrap: null, stream: null, video: null, sourceCanvas: null,
  inputCanvas: null, skinCanvas: null, spotCanvas: null, differenceCanvas: null,
  outputCanvas: null, message: null, captureButton: null,
  results: null, faceMesh: null,

  start() {
    Snapshot.stop();
    Snapshot.host = Nb.currentOutput;
    if (!Snapshot.host) return;
    Snapshot.build(Snapshot.host);
    Snapshot.openCamera();
  },

  build(host) {
    host.textContent = "";
    const wrap = document.createElement("section");
    wrap.className = "snapshot-lab";

    const intro = document.createElement("div");
    intro.className = "snapshot-intro";
    intro.innerHTML = "<strong>INPUT is one still image.</strong> Place one face in the frame, then press Capture one photo. " +
      "The camera stops immediately; NumPy, SciPy, and Face Mesh run once on that image.";

    const live = document.createElement("div");
    live.className = "snapshot-live";
    const video = document.createElement("video");
    video.autoplay = true; video.playsInline = true; video.muted = true;
    live.appendChild(video);

    const bar = document.createElement("div");
    bar.className = "snapshot-bar";
    const capture = document.createElement("button");
    capture.type = "button"; capture.className = "btn primary";
    capture.textContent = "Capture one photo"; capture.disabled = true;
    capture.onclick = () => Snapshot.capturePhoto();
    const retry = document.createElement("button");
    retry.type = "button"; retry.className = "btn"; retry.textContent = "Open camera again";
    retry.onclick = () => Snapshot.openCamera();
    const choose = document.createElement("label");
    choose.className = "btn"; choose.textContent = "Choose an image file";
    const picker = document.createElement("input");
    picker.type = "file"; picker.accept = "image/*"; picker.hidden = true;
    picker.onchange = () => Snapshot.useFile(picker.files?.[0]);
    choose.appendChild(picker);
    bar.append(capture, retry, choose);

    const message = document.createElement("p");
    message.className = "snapshot-message";
    message.textContent = "Requesting camera access…";

    // Hai hàng nút dưới tấm ảnh đã chụp: chạy lại CHÍNH hàm heal_spots của học
    // sinh trên ĐÚNG tấm ảnh đó, không mở lại camera — để đổi MỘT thứ mỗi lần,
    // hoặc bề rộng vùng so sánh, hoặc số lần chạy lại trên kết quả của chính nó.
    const kernels = Snapshot.rerunRow("snapshot-kernels", "Try another comparison width on the same photo:",
      [[7, "width 7"], [13, "width 13"], [25, "width 25"]],
      "_set_snapshot_radius", "The comparison width could not be changed: ");
    const strengths = Snapshot.rerunRow("snapshot-strengths", "Run your healer more times on the same photo:",
      [[1, "1 pass"], [2, "2 passes"], [3, "3 passes"]],
      "_set_snapshot_passes", "The number of passes could not be changed: ");

    const results = document.createElement("div");
    results.className = "snapshot-results hidden";
    const makeResult = (label) => {
      const figure = document.createElement("figure");
      const canvas = document.createElement("canvas");
      canvas.width = CFG.capture.w; canvas.height = CFG.capture.h;
      figure.append(canvas, Object.assign(document.createElement("figcaption"), { textContent: label }));
      results.appendChild(figure);
      return canvas;
    };
    const inputCanvas = makeResult("1 · INPUT with Face Mesh outline");
    const skinCanvas = makeResult("2 · Skin region your detect_skin selected");
    const spotCanvas = makeResult("3 · Pixels your heal_spots changed");
    const differenceCanvas = makeResult("4 · Changed colours, magnified ×4");
    const outputCanvas = makeResult("5 · OUTPUT of your own heal_spots");

    wrap.append(intro, live, bar, message, kernels, strengths, results);
    host.appendChild(wrap);
    Object.assign(Snapshot, {
      wrap, video, captureButton: capture, message, results,
      rerunBars: [kernels, strengths],
      inputCanvas, skinCanvas, spotCanvas, differenceCanvas, outputCanvas,
      lastCanvas: null, lastLandmarks: [], busy: false,
    });
    return wrap;
  },

  /** Một hàng nút "đổi một thứ rồi chạy lại": mọi hàng dùng chung mã này để
   *  không có hàng nào quên khoá nút khi đang chạy hay quên tô nút đang chọn. */
  rerunRow(className, prompt, choices, bridge, failure) {
    const row = document.createElement("div");
    row.className = `snapshot-bar snapshot-rerun ${className} hidden`;
    row.appendChild(Object.assign(document.createElement("span"), { textContent: prompt }));
    choices.forEach(([value, label]) => {
      const pick = document.createElement("button");
      pick.type = "button"; pick.className = "btn";
      pick.dataset.choice = String(value); pick.textContent = label;
      pick.onclick = () => Snapshot.rerunWith(bridge, value, pick, row, failure);
      row.appendChild(pick);
    });
    return row;
  },

  async rerunWith(bridge, value, pick, row, failure) {
    if (Snapshot.busy || !Snapshot.lastCanvas) return;
    Snapshot.busy = true; pick.disabled = true;
    try {
      Kernel.callBridge(bridge, [value]);
      [...row.querySelectorAll("button")].forEach((other) =>
        other.classList.toggle("primary", other === pick));
      await Snapshot.renderPipeline();
    } catch (error) {
      Snapshot.message.textContent = failure + String(error?.message || error).split("\n").pop();
    } finally {
      Snapshot.busy = false; pick.disabled = false;
    }
  },

  async openCamera() {
    Snapshot.stopStream();
    if (!Snapshot.video || !Snapshot.message) return;
    Snapshot.captureButton.disabled = true;
    Snapshot.message.textContent = "Requesting camera access…";
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera unavailable");
      Snapshot.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      Snapshot.video.srcObject = Snapshot.stream;
      await Snapshot.video.play();
      Snapshot.captureButton.disabled = false;
      Snapshot.message.textContent = "Camera ready. Press Capture one photo; the camera will stop immediately.";
    } catch (error) {
      Snapshot.stopStream();
      Snapshot.message.textContent = "The camera could not start. Zoom, Meet, or another app may be using it. " +
        "Close that app and press Open camera again, or choose an image file.";
    }
  },

  drawCover(ctx, source, sourceWidth, sourceHeight) {
    const targetWidth = CFG.capture.w, targetHeight = CFG.capture.h;
    const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const cropWidth = targetWidth / scale, cropHeight = targetHeight / scale;
    const sourceX = (sourceWidth - cropWidth) / 2;
    const sourceY = (sourceHeight - cropHeight) / 2;
    ctx.drawImage(source, sourceX, sourceY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
  },

  capturePhoto() {
    if (!Snapshot.video?.videoWidth) {
      Snapshot.message.textContent = "The camera has not produced a frame yet. Wait a moment and capture again.";
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = CFG.capture.w; canvas.height = CFG.capture.h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.save();
    ctx.translate(CFG.capture.w, 0); ctx.scale(-1, 1);
    Snapshot.drawCover(ctx, Snapshot.video, Snapshot.video.videoWidth, Snapshot.video.videoHeight);
    ctx.restore();
    Snapshot.stopStream();
    Snapshot.processCanvas(canvas);
  },

  async useFile(file) {
    if (!file) return;
    Snapshot.stopStream();
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = CFG.capture.w; canvas.height = CFG.capture.h;
      Snapshot.drawCover(canvas.getContext("2d", { willReadFrequently: true }), bitmap, bitmap.width, bitmap.height);
      bitmap.close?.();
      await Snapshot.processCanvas(canvas);
    } catch (error) {
      Snapshot.message.textContent = "This image file could not be read. Choose another JPG, PNG, or WebP file.";
    }
  },

  async detectFace(canvas) {
    try {
      if (!window.FaceMesh) {
        const config = CFG.mediapipe.face;
        await Kernel.loadScript(config.base + config.script);
      }
      const config = CFG.mediapipe.face;
      const mesh = new FaceMesh({ locateFile: (file) => config.base + file });
      Snapshot.faceMesh = mesh;
      mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.6 });
      const landmarks = await new Promise((resolve) => {
        let finished = false;
        const finish = (value) => {
          if (finished) return;
          finished = true; resolve(value);
        };
        mesh.onResults((result) => finish(result.multiFaceLandmarks?.[0] || []));
        Promise.resolve(mesh.send({ image: canvas })).catch(() => finish([]));
        setTimeout(() => finish([]), 12_000);
      });
      mesh.close?.();
      Snapshot.faceMesh = null;
      return landmarks;
    } catch (error) {
      Snapshot.faceMesh = null;
      return [];
    }
  },

  faceOval(landmarks) {
    return FACE_RINGS.oval.map((index) => landmarks[index]).filter(Boolean);
  },

  /** Ảnh đã chụp không lật, nên x giữ nguyên. */
  mapPoint(width, height) {
    return (landmark) => ({ x: landmark.x * width, y: landmark.y * height });
  },

  faceMaskBytes(landmarks, width, height) {
    return ringMaskBytes(landmarks, ["oval"], width, height,
      Snapshot.mapPoint(width, height));
  },

  /** Môi + hai mắt: vùng học sinh phải chừa ra khi làm mịn. */
  featureMaskBytes(landmarks, width, height) {
    return ringMaskBytes(landmarks, FEATURE_RINGS, width, height,
      Snapshot.mapPoint(width, height));
  },

  drawFaceOutline(canvas, landmarks) {
    const ctx = canvas.getContext("2d");
    const oval = Snapshot.faceOval(landmarks);
    if (!oval.length) return;
    ctx.strokeStyle = CFG.sparkColors.honey; ctx.lineWidth = 4; ctx.beginPath();
    oval.forEach((point, index) => {
      const x = point.x * canvas.width, y = point.y * canvas.height;
      if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.stroke();
  },

  async processCanvas(canvas) {
    if (!Kernel.py || Kernel.state !== "ready") {
      Snapshot.message.textContent = "Python is not ready. Wait for Kernel ready in the top-right corner, then try again.";
      return;
    }
    Snapshot.results.classList.remove("hidden");
    const inputContext = Snapshot.inputCanvas.getContext("2d");
    inputContext.clearRect(0, 0, CFG.capture.w, CFG.capture.h);
    inputContext.drawImage(canvas, 0, 0);
    Snapshot.message.textContent = "Face Mesh is finding the face outline…";
    const landmarks = await Snapshot.detectFace(canvas);
    Snapshot.drawFaceOutline(Snapshot.inputCanvas, landmarks);
    Snapshot.lastCanvas = canvas;
    Snapshot.lastLandmarks = landmarks;
    await Snapshot.renderPipeline();
  },

  /** Chạy pipeline trên tấm ảnh đã giữ lại. Nút đổi kernel gọi lại hàm này,
   *  nên học sinh so được các kernel trên cùng một tấm ảnh. */
  async renderPipeline() {
    const canvas = Snapshot.lastCanvas;
    if (!canvas || !Kernel.py || Kernel.state !== "ready") return;
    const landmarks = Snapshot.lastLandmarks || [];
    const level = CFG.quality[2];
    const source = canvas.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, CFG.capture.w, CFG.capture.h).data;
    const faceMask = landmarks.length ? Snapshot.faceMaskBytes(landmarks, level.w, level.h) : null;
    const featureMask = landmarks.length ? Snapshot.featureMaskBytes(landmarks, level.w, level.h) : null;
    Snapshot.message.textContent = "NumPy and SciPy are processing the photo…";
    try {
      const packed = new Uint8Array(Kernel.callBridge("_skin_snapshot", [
        new Uint8Array(source.buffer.slice(0)), CFG.capture.w, CFG.capture.h,
        level.w, level.h, faceMask, featureMask,
      ]));
      const frameLength = CFG.capture.w * CFG.capture.h * 4;
      const targets = [Snapshot.skinCanvas, Snapshot.spotCanvas,
        Snapshot.differenceCanvas, Snapshot.outputCanvas];
      if (packed.length !== frameLength * targets.length) {
        throw new Error("Python did not return all four explanation panels.");
      }
      targets.forEach((target, index) => {
        const frame = packed.slice(index * frameLength, (index + 1) * frameLength);
        target.getContext("2d").putImageData(
          new ImageData(new Uint8ClampedArray(frame), CFG.capture.w, CFG.capture.h), 0, 0);
      });
      (Snapshot.rerunBars || []).forEach((row) => row.classList.remove("hidden"));
      const report = Kernel.callBridge("_skin_snapshot_report", []);
      Snapshot.message.textContent = (landmarks.length
        ? "Face Mesh limited changes to the face region. "
        : "Face Mesh did not find a face; the colour rules are selecting the skin region without a face boundary. ") + report;
    } catch (error) {
      Snapshot.outputCanvas.getContext("2d").drawImage(canvas, 0, 0);
      Snapshot.message.textContent = "The image could not be processed: " + String(error?.message || error).split("\n").pop();
    }
  },

  stopStream() {
    if (Snapshot.stream) Snapshot.stream.getTracks().forEach((track) => track.stop());
    Snapshot.stream = null;
    if (Snapshot.video) Snapshot.video.srcObject = null;
    if (Snapshot.captureButton) Snapshot.captureButton.disabled = true;
  },

  stop() {
    Snapshot.stopStream();
    Snapshot.faceMesh?.close?.();
    Snapshot.faceMesh = null;
  },
};

/** Cầu nối mà phía Python gọi sang. */
window.MagicMirrorUI = {
  start: () => Cam.start(),
  stop: () => Cam.stop(),
  emit: (kind, data) => Nb.emit(kind, data),
  snapshot: () => { Snapshot.start(); },
  mechanism: (id, kind) => Nb.showMechanism(id, kind),
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
  saved: null, saveTimer: null, storageAvailable: true, changedTasks: [],

  storageKey() { return `magic-dust-kit:skin-lab:${PAGE.mode}:v${CFG.storageSchema}`; },

  emptySaved() {
    return {
      schema: CFG.storageSchema,
      courseVersion: PAGE.courseVersion,
      cells: {}, starters: {}, passed: [], widgets: {}, concepts: [], lastCellId: null, updatedAt: null,
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
    const notebookUrl = `${Nb.file}?v=${encodeURIComponent(PAGE.courseVersion)}`;
    const res = await fetch(notebookUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    Nb.adopt(await res.json());
  },

  adopt(json) {
    const rawSaved = Nb.readSaved();
    Nb.saved = rawSaved && !Array.isArray(rawSaved) ? Object.assign(Nb.emptySaved(), rawSaved) : Nb.emptySaved();
    if (!Nb.saved.cells || typeof Nb.saved.cells !== "object") Nb.saved.cells = {};
    if (!Nb.saved.widgets || typeof Nb.saved.widgets !== "object" || Array.isArray(Nb.saved.widgets)) {
      Nb.saved.widgets = {};
    }
    if (!Array.isArray(Nb.saved.concepts)) Nb.saved.concepts = [];
    Nb.cells = (json.cells || []).map((c, idx) => ({
      id: c.id || c.metadata?.stable_id || `cell-${idx}`,
      type: c.cell_type === "markdown" ? "markdown" : "code",
      source: joinSource(c.source),
      starter: joinSource(c.source),   // đề gốc, giữ lại để có nút ↺ trả về
      tags: (c.metadata && c.metadata.tags) || [],
      editing: false, count: null,
    }));
    // Đọc được bản lưu đời cũ thì ghép theo index đúng một lần, sau đó ghi lại theo ID ổn định.
    if (Array.isArray(rawSaved)) {
      Nb.cells.forEach((cell, index) => {
        if (rawSaved[index] !== undefined) Nb.saved.cells[cell.id] = rawSaved[index];
      });
    }
    // Bài học đổi thì đề của ô task đổi theo. So đề ĐÃ LƯU với đề hiện tại để biết
    // ô nào đổi: giữ nguyên bài các em viết, nhưng nói ra ô nào có đề mới. Im lặng
    // thì mã cũ gọi hàm theo tham số cũ và ô chấm báo sai một hàm viết đúng.
    const savedStarters = Nb.saved.starters || {};
    Nb.changedTasks = !RESTORES_WORK ? [] : Nb.cells
      .filter((cell) => holdsWork(cell) && savedStarters[cell.id] !== undefined
        && savedStarters[cell.id] !== cell.starter)
      .map((cell) => cell.id);
    Nb.cells.forEach((cell) => {
      // Chỉ ô chứa BÀI LÀM của học sinh mới giữ bản đã lưu: mười ô task, các ô gắn
      // thẻ student-work và ô các em tự thêm. Ô quan sát + chữ giảng luôn nạp bản
      // mới — bản lưu từ phiên bản cũ từng đè lên ô quan sát mới và làm vỡ bài
      // (numpy-array đời .6/.7 tạo ma trận khác hẳn ô đổi-một-số đời .9 cần).
      if (!RESTORES_WORK || !holdsWork(cell)) return;
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
    Nb.noteSave("Saving…");
    Nb.saveTimer = setTimeout(() => Nb.persist(), CFG.saveDelayMs);
  },

  persist() {
    if (!Nb.saved) Nb.saved = Nb.emptySaved();
    // Trang đáp án không nạp lại mã thì cũng đừng lưu mã: lưu chỉ để lại một bản
    // sao đáp án đời cũ trong máy — đúng thứ vừa làm hỏng bài. Ô do người dùng
    // tự thêm vẫn giữ, vì file notebook không có sẵn để dựng lại.
    const keepsSource = (cell) => RESTORES_WORK || cell.id.startsWith("user-");
    Nb.saved.cells = Object.fromEntries(Nb.cells.filter(keepsSource).map((cell) => [cell.id, {
      source: cell.source,
      type: cell.type,
      tags: cell.tags,
      user: cell.id.startsWith("user-"),
    }]));
    // Lưu kèm ĐỀ GỐC của các ô task: lần mở sau so với đề mới là biết bài học đã đổi.
    Nb.saved.starters = !RESTORES_WORK ? {} : Object.fromEntries(Nb.cells
      .filter((cell) => holdsWork(cell) && cell.starter !== undefined)
      .map((cell) => [cell.id, cell.starter]));
    Nb.saved.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(Nb.storageKey(), JSON.stringify(Nb.saved));
      Nb.storageAvailable = true;
      Nb.noteSave("Saved automatically");
    } catch {
      Nb.storageAvailable = false;
      Nb.noteSave("Autosave failed — download the notebook", true);
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

  saveWidget(id, state) {
    if (!Nb.saved) Nb.saved = Nb.emptySaved();
    Nb.saved.widgets[id] = state;
    Nb.scheduleSave();
  },

  recordConcept(id) {
    if (!Nb.saved) Nb.saved = Nb.emptySaved();
    const done = new Set(Nb.saved.concepts || []);
    done.add(id);
    Nb.saved.concepts = [...done];
    const cell = Nb.cells.find((item) => item.tags.includes(`concept:${id}`));
    if (cell?.el) cell.el.classList.add("done");
    Nb.persist();
  },

  showMechanism(id, kind) {
    if (!Nb.currentOutput) return;
    if (!window.SkinMechanisms) {
      Nb.appendText(Nb.currentOutput, "err", "The mechanism panel could not open. Reload the page.\n");
      return;
    }
    const host = document.createElement("div");
    Nb.currentOutput.appendChild(host);
    window.SkinMechanisms.mount(host, {
      id,
      kind,
      state: Nb.saved?.widgets?.[id] || {},
      completed: (Nb.saved?.concepts || []).includes(id),
      onChange: (state) => Nb.saveWidget(id, state),
      onPass: () => Nb.recordConcept(id),
    });
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
    add.className = "btn"; add.textContent = "+ Code cell";
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
    const conceptTag = cell.tags.find((tag) => tag.startsWith("concept:"));
    if (conceptTag && new Set(Nb.saved?.concepts || []).has(conceptTag.slice(8))) el.classList.add("done");
    if ((Nb.changedTasks || []).includes(cell.id)) el.classList.add("changed");
    el.onmousedown = () => Nb.focusCell(idx, false);

    const gutter = document.createElement("div");
    gutter.className = "gutter";
    const prompt = document.createElement("div");
    prompt.className = "prompt";
    prompt.textContent = cell.type === "code" ? `In [${cell.count === null ? " " : cell.count}]:` : "";
    const run = document.createElement("button");
    run.className = "run-btn"; run.textContent = "▶"; run.title = "Run this cell";
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
      if ((Nb.changedTasks || []).includes(cell.id)) body.appendChild(Nb.starterButton(cell));
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

  /** Trả ĐÚNG ô này về đề mới. Hỏi lại ngay trên nút, không mở hộp thoại: hộp
   *  thoại chặn mọi sự kiện của trang và không kiểm thử tự động được. */
  starterButton(cell) {
    const button = document.createElement("button");
    button.className = "starter-btn";
    button.textContent = T.starterBtn;
    let armed = false;
    button.onclick = (event) => {
      event.stopPropagation();
      if (!armed) { armed = true; button.textContent = T.starterSure; button.classList.add("armed"); return; }
      cell.source = cell.starter;
      Nb.changedTasks = Nb.changedTasks.filter((id) => id !== cell.id);
      Nb.persist();
      Nb.render();
      App.banner(Nb.changedTasks.length ? T.lessonUpdated(Nb.changedTasks.length) : App.pageNotice,
        Nb.changedTasks.length > 0);
    };
    return button;
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
      `Your work was saved in this browser. <button class="btn resume" id="resumeBtn">Continue where you stopped</button>`,
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
    if (Snapshot.stream && Snapshot.host !== cell.outEl) Snapshot.stopStream();
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
    Snapshot.stop();
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
/** Ô chứa BÀI LÀM của học sinh: mười ô task và các ô gắn thẻ student-work. */
function holdsWork(cell) {
  return cell.type === "code"
    && cell.tags.some((tag) => tag.startsWith("task:") || tag === "student-work");
}
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
      const changed = Nb.changedTasks.length;
      App.banner(isFileUrl ? T.fileHint : (changed ? T.lessonUpdated(changed) : App.pageNotice),
        isFileUrl || changed > 0);
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
      if (!window.confirm("Delete all Skin Lab code and progress saved in this browser?")) return;
      localStorage.removeItem(Nb.storageKey());
      Cam.stop();
      Snapshot.stop();
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
