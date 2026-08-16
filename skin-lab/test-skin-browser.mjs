import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";


const ROOT = resolve(import.meta.dirname);
const SITE_ROOT = resolve(ROOT, "..");
const HTTP_PORT = 8771;
const DEBUG_PORT = 9331;
const REMOTE_BASE = process.env.SKIN_BASE?.replace(/\/$/, "");
const BASE = REMOTE_BASE || `http://127.0.0.1:${HTTP_PORT}`;
const PRACTICE_URL = `${BASE}/skin-lab/`;
const ANSWER_URL = `${BASE}/skin-lab/dap-an.html`;
const MAIN_URL = `${BASE}/index.html`;
const EDGE_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const browserPath = EDGE_CANDIDATES.find(existsSync);
if (!browserPath) throw new Error("Không tìm thấy Edge/Chrome để chạy browser check.");

const profile = mkdtempSync(join(tmpdir(), "magic-dust-skin-browser-"));
const server = REMOTE_BASE ? null : spawn(
  "python",
  ["-m", "http.server", String(HTTP_PORT), "--bind", "127.0.0.1"],
  { cwd: SITE_ROOT, windowsHide: true, stdio: "ignore" },
);
const browser = spawn(browserPath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--window-size=390,844",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${DEBUG_PORT}`,
  PRACTICE_URL,
], { windowsHide: true, stdio: "ignore" });

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

async function poll(getValue, accept, timeoutMs, label) {
  const started = Date.now();
  let latest;
  while (Date.now() - started < timeoutMs) {
    try {
      latest = await getValue();
      if (accept(latest)) return latest;
    } catch {
      // The HTTP/CDP endpoint may not exist during browser startup or navigation.
    }
    await sleep(250);
  }
  throw new Error(`${label} timed out; latest=${JSON.stringify(latest)}`);
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolveMessage, rejectMessage } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectMessage(new Error(JSON.stringify(message.error)));
    else resolveMessage(message.result);
  });

  return {
    evaluate(expression) {
      const id = ++nextId;
      socket.send(JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression, awaitPromise: true, returnByValue: true },
      }));
      return new Promise((resolveMessage, rejectMessage) => {
        pending.set(id, { resolveMessage, rejectMessage });
      });
    },
    close() { socket.close(); },
  };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    sleep(3_000),
  ]);
}

async function notebookState(cdp) {
  const result = await cdp.evaluate(`({
    state: document.getElementById("kernelPill")?.dataset.state,
    text: document.getElementById("kernelText")?.textContent,
    cells: document.querySelectorAll(".cell").length,
    title: document.querySelector(".md h1")?.textContent,
    page: document.documentElement.dataset.page,
  })`);
  return result.result.value;
}

// Read the count from the built notebook instead of repeating a literal here:
// adding a cell to build_notebooks.py must not make this test fail by itself.
const NOTEBOOK_CELLS = JSON.parse(
  readFileSync(resolve(ROOT, "Skin_Lab.ipynb"), "utf8"),
).cells.length;

/** Mã gốc của một ô trong file notebook đã dựng — dùng để dựng bản lưu "đời trước". */
function notebookSource(file, id) {
  const cells = JSON.parse(readFileSync(resolve(ROOT, file), "utf8")).cells;
  const cell = cells.find((item) => (item.id || item.metadata?.stable_id) === id);
  if (!cell) throw new Error(`${file} has no cell ${id}`);
  return Array.isArray(cell.source) ? cell.source.join("") : String(cell.source);
}

async function waitForNotebook(cdp, mode, label, expectedCells = NOTEBOOK_CELLS) {
  const state = await poll(
    () => notebookState(cdp),
    (value) => value?.page === mode && (value.state === "ready" || value.state === "error"),
    180_000,
    label,
  );
  if (state.state !== "ready") throw new Error(`${label} kernel failed: ${state.text}`);
  if (state.cells !== expectedCells) {
    throw new Error(`${label}: expected ${expectedCells} cells, got ${state.cells}`);
  }
  if (!state.title?.includes("Skin Lab")) throw new Error(`${label}: unexpected title ${state.title}`);
  return state;
}

let cdp;
try {
  if (!REMOTE_BASE) {
    await poll(() => fetch(PRACTICE_URL), (response) => response.ok, 10_000, "HTTP server");
  }

  const page = await poll(async () => {
    const pages = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((response) => response.json());
    return pages.find((item) => item.type === "page" && item.url.includes("/skin-lab"));
  }, Boolean, 15_000, "browser page");

  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await waitForNotebook(cdp, "skin", "practice route");
  console.log("Browser check: practice notebook and Pyodide are ready.");

  const mechanisms = await cdp.evaluate(`(async () => {
    const checks = [
      ["skin-mechanism-rgb", "(120, 0, 0)"],
      ["skin-mechanism-rule", "0 — do not select"],
      ["skin-mechanism-neighbours", "255 — keep this region"],
      ["skin-mechanism-kernel-filter", "14.44"],
      ["skin-mechanism-convolution-scan", "0 — no vertical edge"],
      ["skin-mechanism-red-spot", "Yes, because"],
      ["skin-mechanism-soften", "(170, 110, 95)"],
      ["skin-mechanism-face", "Keep the original colour"],
    ];
    for (const [id, answer] of checks) {
      const index = Nb.cells.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Missing mechanism cell " + id);
      await Nb.runCell(index);
      const buttons = [...Nb.cells[index].outEl.querySelectorAll(".mech-answer")];
      const correct = buttons.find((button) => button.textContent.startsWith(answer));
      if (!correct) throw new Error("Missing answer " + answer + "; output=" + Nb.cells[index].outEl.innerText);
      correct.click();
      if (!Nb.cells[index].outEl.querySelector(".mech-code pre")) {
        throw new Error("Equivalent code stayed locked for " + id);
      }
    }
    const scanIndex = Nb.cells.findIndex((item) => item.id === "skin-mechanism-convolution-scan");
    const scanHost = Nb.cells[scanIndex].outEl;
    const clickText = (text) => {
      const target = [...scanHost.querySelectorAll("button")].find((button) => button.textContent.trim() === text);
      if (!target) throw new Error("Missing convolution scanner button " + text);
      target.click();
    };
    clickText("Next →"); clickText("Next →"); clickText("Next →");
    const edgeMap = scanHost.querySelector(".output-map")?.innerText;
    const edgeExplanation = scanHost.innerText.includes("Bright columns appear where values change from 0 to 1");
    clickText("Find a large patch");
    clickText("Next →"); clickText("Next →"); clickText("Next →");
    const patchMapValues = [...scanHost.querySelectorAll(".output-map span")].map((item) => item.textContent);
    const isolated = [...scanHost.querySelectorAll(".scan-input button")]
      .find((button) => button.title === "row 1, column 1");
    if (!isolated) throw new Error("Missing isolated-dot position in convolution scanner");
    isolated.click();
    const isolatedExplanation = [...scanHost.querySelectorAll(".mech-result")]
      .some((item) => item.textContent.includes("reject this small mark"));
    Nb.persist();
    return {
      concepts: Nb.saved.concepts,
      widgetIds: Object.keys(Nb.saved.widgets),
      doneCells: document.querySelectorAll(".cell.done").length,
      edgeMap,
      edgeExplanation,
      patchHasKeptCells: patchMapValues.includes("255"),
      isolatedExplanation,
    };
  })()`);
  if (mechanisms.exceptionDetails) {
    throw new Error(`Mechanism evaluation exception: ${JSON.stringify(mechanisms.exceptionDetails)}`);
  }
  if (!mechanisms.result?.value) throw new Error(`Mechanism evaluation failed: ${JSON.stringify(mechanisms)}`);
  const mechanismEvidence = mechanisms.result.value;
  if (mechanismEvidence.concepts.length !== 8 || mechanismEvidence.widgetIds.length !== 8 ||
      mechanismEvidence.doneCells < 8) {
    throw new Error(`Mechanism progress was not saved: ${JSON.stringify(mechanismEvidence)}`);
  }
  if (!mechanismEvidence.edgeMap || !mechanismEvidence.edgeExplanation ||
      !mechanismEvidence.patchHasKeptCells || !mechanismEvidence.isolatedExplanation) {
    throw new Error(`Convolution scanner did not reveal both output maps: ${JSON.stringify(mechanismEvidence)}`);
  }
  console.log("Browser check: eight mechanism answers and widget states persisted.");

  const blanks = await cdp.evaluate(`(async () => {
    const runById = async (id) => {
      const index = Nb.cells.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Missing cell " + id);
      await Nb.runCell(index);
      return Nb.cells[index].outEl.innerText;
    };
    await runById("task-skin-evidence");
    const preview = await runById("skin-see-evidence");
    const grader = await runById("skin-check");
    const note = document.querySelector('[data-cell-id="skin-task-evidence-note"] .md');
    return { preview, grader, nestedBlankSteps: note ? note.querySelectorAll("ul ol li").length : -1 };
  })()`);
  if (blanks.exceptionDetails) {
    throw new Error(`Blank-hint evaluation exception: ${JSON.stringify(blanks.exceptionDetails)}`);
  }
  const blankEvidence = blanks.result?.value;
  if (!blankEvidence) throw new Error(`Blank-hint evaluation failed: ${JSON.stringify(blanks)}`);
  if (!blankEvidence.preview.includes("Replace every ___ with your answer")) {
    throw new Error(`Unfilled-blank run did not explain itself: ${blankEvidence.preview}`);
  }
  if (!blankEvidence.grader.includes("still contains ___ blanks")) {
    throw new Error(`The grader did not translate the ___ blank: ${blankEvidence.grader}`);
  }
  if (blankEvidence.nestedBlankSteps !== 3) {
    throw new Error(`Task 1's fill-the-blank guide should render as a nested 3-step list, got ${blankEvidence.nestedBlankSteps}.`);
  }
  console.log("Browser check: unfilled ___ blanks produce plain-words guidance.");

  const saved = await cdp.evaluate(`(() => {
    const cell = Nb.cells.find((item) => item.id === "task-convolve-layer");
    cell.source += "\\n# autosave-browser-check";
    // Giả lập bản lưu đời cũ: ô quan sát numpy-array từng chứa code khác hẳn.
    const observation = Nb.cells.find((item) => item.id === "numpy-array");
    observation.source = "# legacy-observation-cell\\npixels = 'stale'";
    Nb.cells.push({
      id: "user-browser-check", type: "code", source: "observation = 89.28",
      tags: [], editing: false, count: null,
    });
    Nb.saved.lastCellId = "user-browser-check";
    Nb.persist();
    return localStorage.getItem(Nb.storageKey());
  })()`);
  const savedText = saved.result.value;
  const savedJson = JSON.parse(savedText);
  if (!savedJson.cells["task-convolve-layer"].source.includes("autosave-browser-check")) {
    throw new Error("Stable-ID autosave did not store the edited task cell.");
  }
  if (!savedJson.cells["numpy-array"].source.includes("legacy-observation-cell")) {
    throw new Error("The stale-observation seed was not written to the save.");
  }
  if (!savedJson.cells["user-browser-check"].user) {
    throw new Error("Autosave did not mark the student-created cell for restoration.");
  }
  if (savedJson.concepts.length !== 8 || Object.keys(savedJson.widgets).length !== 8) {
    throw new Error("Autosave did not keep all eight mechanism states.");
  }
  if (savedText.includes("data:image") || savedText.includes("base64,")) {
    throw new Error("Autosave unexpectedly contains image or camera frame data.");
  }

  await cdp.evaluate("location.reload()");
  // One extra cell: the student-added "user-*" cell created earlier in this run.
  await waitForNotebook(cdp, "skin", "resumed practice route", NOTEBOOK_CELLS + 1);
  const resumed = await poll(async () => {
    const result = await cdp.evaluate(`({
      source: Nb.cells.find((item) => item.id === "task-convolve-layer")?.source,
      observationSource: Nb.cells.find((item) => item.id === "numpy-array")?.source,
      userSource: Nb.cells.find((item) => item.id === "user-browser-check")?.source,
      resume: document.getElementById("resumeBtn")?.textContent,
      key: Nb.storageKey(),
    })`);
    return result.result.value;
  }, (value) => value?.source?.includes("autosave-browser-check")
    && value?.userSource === "observation = 89.28" && value?.resume, 10_000, "resume banner");
  if (!resumed.key.includes(":skin:v3")) throw new Error(`Unexpected practice storage key: ${resumed.key}`);
  if (resumed.observationSource.includes("legacy-observation-cell")
      || !resumed.observationSource.includes("red_spot,   skin")) {
    throw new Error("A stale saved observation cell overrode the fresh notebook code after reload.");
  }
  console.log("Browser check: edited code and user cell survived; stale observation cell was refreshed.");

  await cdp.evaluate(`location.href = ${JSON.stringify(ANSWER_URL)}`);
  await waitForNotebook(cdp, "skin-answers", "answer route");
  console.log("Browser check: answer notebook and Pyodide are ready.");
  const run = await cdp.evaluate(`(async () => {
    // MỌI ô code, theo đúng thứ tự trên trang — không giữ danh sách id chép tay.
    // Danh sách chép tay từng bỏ sót ô mới thêm và báo xanh cho một trang hỏng;
    // thứ tự trên trang cũng chính là thứ tự học sinh bấm, nên ô chấm giữa trang
    // vẫn chạy trước hai task cuối và vẫn phải đọc "still to come".
    const ids = Nb.cells
      .filter((cell) => cell.type === "code" && cell.id !== "skin-photo")
      .map((cell) => cell.id);
    // Lời ra của một ô bị xoá mỗi lần trang vẽ lại, nên đọc ngay sau khi chạy.
    const texts = {};
    for (const id of ids) {
      const index = Nb.cells.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Missing cell " + id);
      await Nb.runCell(index);
      texts[id] = Nb.cells[index].outEl.innerText;
    }
    const photoIndex = Nb.cells.findIndex((item) => item.id === "skin-photo");
    if (photoIndex < 0) throw new Error("Missing cell skin-photo");
    await Nb.runCell(photoIndex);
    const waitFor = async (accept, timeoutMs, label) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (accept()) return;
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
      throw new Error(label + " timed out");
    };
    await waitFor(() => Snapshot.video?.videoWidth && !Snapshot.captureButton?.disabled,
      15_000, "one-photo camera");
    Snapshot.captureButton.click();
    await waitFor(() => Snapshot.stream === null &&
      !Snapshot.results?.classList.contains("hidden") &&
      !Snapshot.message?.textContent.startsWith("Face Mesh is"), 35_000, "one-photo processing");
    const photoEvidence = {
      message: Snapshot.message.textContent,
      streamStopped: Snapshot.stream === null,
      resultCanvases: Snapshot.results.querySelectorAll("canvas").length,
      outputWidth: Snapshot.outputCanvas.width,
    };
    // Mỗi lần bấm là một lần render lại; luôn tìm nút NGAY trước khi bấm, đừng
    // giữ tham chiếu cũ — nút giữ từ vòng trước có thể đã bị thay.
    const pressRerun = async (rowClass, choice, expected, label) => {
      const button = [...document.querySelectorAll("." + rowClass + " button")]
        .find((item) => item.dataset.choice === choice);
      if (!button) throw new Error("Missing the " + choice + " button in ." + rowClass);
      const started = Date.now();
      button.click();
      await waitFor(() => Snapshot.message?.textContent.includes(expected), 40_000, label);
      return { message: Snapshot.message.textContent, seconds: (Date.now() - started) / 1000 };
    };
    const narrow = await pressRerun("snapshot-kernels", "7", "comparison width 7", "same-photo width switch");
    const wide = await pressRerun("snapshot-kernels", "25", "comparison width 25", "widest comparison switch");
    const threePasses = await pressRerun("snapshot-strengths", "3", "3 pass(es)", "pass-count switch");
    const kernelEvidence = {
      message: wide.message,
      gentleMessage: narrow.message,
      strengthMessage: threePasses.message,
      widestSeconds: threePasses.seconds,
      labels: [...document.querySelectorAll(".snapshot-rerun button")].map((button) => button.textContent),
      streamStillStopped: Snapshot.stream === null,
      barVisible: [...document.querySelectorAll(".snapshot-rerun")]
        .every((row) => !row.classList.contains("hidden")),
    };
    const output = (id) => Nb.cells.find((item) => item.id === id).outEl;
    const controlHost = document.createElement("div");
    document.body.appendChild(controlHost);
    Snapshot.build(controlHost);
    const controls = controlHost.innerText;
    Snapshot.stop();
    controlHost.remove();
    return {
      cellsRun: ids.length,
      grader: texts["skin-check"],
      graderAll: texts["skin-check-all"],
      healRun: texts["skin-heal-run"],
      smoothRun: texts["skin-smooth-run"],
      images: ids.filter((id) => output(id).querySelector("img")).length,
      errors: ids.flatMap((id) => [...output(id).querySelectorAll(".err")].map((item) => item.innerText)),
      answerKey: Nb.storageKey(),
      controls,
      photoEvidence,
      kernelEvidence,
      mechanisms: ids.filter((id) => output(id).querySelector(".mechanism-card")).length,
      fitsMobile: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      practiceSaveStillPresent: Boolean(localStorage.getItem("magic-dust-kit:skin-lab:skin:v3")),
    };
  })()`);
  if (run.exceptionDetails) throw new Error(`Answer evaluation exception: ${JSON.stringify(run.exceptionDetails)}`);
  if (!run.result?.value) throw new Error(`Answer evaluation failed: ${JSON.stringify(run)}`);
  const evidence = run.result.value;
  if (!Array.isArray(evidence.errors)) throw new Error(`Unexpected answer evidence: ${JSON.stringify(evidence)}`);
  if (evidence.errors.length) throw new Error(`Notebook errors: ${evidence.errors.join(" | ")}`);
  // Ô chấm giữa trang chạy TRƯỚC hai task cuối, nên nó phải báo "still to come"
  // chứ không được tính là sai; ô chấm cuối trang mới đủ 10/10.
  if (!evidence.grader.includes("still to come")) {
    throw new Error(`The mid-page grader must excuse the tasks below it: ${evidence.grader}`);
  }
  if (!evidence.graderAll.includes("Result: 10/10")) {
    throw new Error(`The final grader did not reach 10/10: ${evidence.graderAll}`);
  }
  if (!evidence.smoothRun.includes("roughness")) {
    throw new Error(`The smoothing run printed no roughness measurement: ${evidence.smoothRun}`);
  }
  if (evidence.images < 20 || evidence.mechanisms !== 8) {
    throw new Error(`Expected at least 20 images and eight mechanisms, got ${evidence.images} and ${evidence.mechanisms}.`);
  }
  if (!evidence.fitsMobile) throw new Error("Skin Lab overflows the 390 px mobile viewport.");
  if (!evidence.controls.includes("Capture one photo") || !evidence.controls.includes("Choose an image file") ||
      evidence.controls.includes("Record video")) {
    throw new Error(`Skin photo controls are wrong: ${evidence.controls}`);
  }
  if (!evidence.photoEvidence.streamStopped || evidence.photoEvidence.resultCanvases !== 5 ||
      evidence.photoEvidence.outputWidth !== 480 ||
      !evidence.photoEvidence.message.includes("Your heal_spots changed")) {
    throw new Error(`One-photo processing did not finish correctly: ${JSON.stringify(evidence.photoEvidence)}`);
  }
  const healing = evidence.healRun.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (healing.length < 3 || !(healing[healing.length - 1] < healing[0])) {
    throw new Error(`The student healing run did not reduce redness: ${evidence.healRun}`);
  }
  if (!evidence.kernelEvidence.gentleMessage.includes("comparison width 7") ||
      !evidence.kernelEvidence.message.includes("comparison width 25") ||
      !evidence.kernelEvidence.strengthMessage.includes("3 pass(es)") ||
      !evidence.kernelEvidence.labels.includes("width 25") ||
      !evidence.kernelEvidence.labels.includes("3 passes") ||
      !evidence.kernelEvidence.streamStillStopped || !evidence.kernelEvidence.barVisible) {
    throw new Error(`Same-photo re-run buttons failed: ${JSON.stringify(evidence.kernelEvidence)}`);
  }
  // Ba lượt heal_spots chạy vòng lặp Python trên từng điểm ảnh; nếu vượt 20 giây thì nút
  // so-sánh-tại-chỗ hết còn là thao tác "bấm rồi xem" của học sinh.
  if (evidence.kernelEvidence.widestSeconds > 20) {
    throw new Error(`Three heal_spots passes took ${evidence.kernelEvidence.widestSeconds}s on one photo.`);
  }
  if (!evidence.answerKey.includes(":skin-answers:v3") || !evidence.practiceSaveStillPresent) {
    throw new Error("Practice and answer routes do not use separate localStorage records.");
  }

  // --- Máy đã từng mở bài này ---------------------------------------------
  // Máy mới thì trang nào cũng xanh; hỏng là hỏng ở máy đã có bản lưu đời trước.
  // Đúng lỗi đã gặp: bản lưu giữ smooth_skin ba tham số, notebook mới gọi bốn,
  // trang đáp án tụt xuống 9/10 với "TypeError: takes 3 positional arguments".
  const staleSmooth = notebookSource("Skin_Lab_Answers.ipynb", "task-smooth-skin")
    .replace("def smooth_skin(img, area_mask, strength, radius):", "def smooth_skin(img, area_mask, strength):");
  const staleAnswerSave = {
    schema: 3, courseVersion: "an-older-release", updatedAt: "2026-08-15T00:00:00.000Z",
    passed: [], widgets: {}, concepts: [], lastCellId: null, starters: {},
    cells: { "task-smooth-skin": { source: staleSmooth, type: "code", tags: ["task:smooth_skin"], user: false } },
  };
  await cdp.evaluate(
    `localStorage.setItem("magic-dust-kit:skin-lab:skin-answers:v3", ${JSON.stringify(JSON.stringify(staleAnswerSave))});`
    + `location.reload();`,
  );
  await sleep(1_000);
  await waitForNotebook(cdp, "skin-answers", "answer route with an older save");
  const stale = await cdp.evaluate(`(async () => {
    // Đọc TRƯỚC khi chạy: trang đáp án dọn mã cũ khỏi bản lưu ngay lần ghi đầu,
    // đọc sau thì phép thử xanh vì rỗng chứ không phải vì đúng.
    const seeded = (localStorage.getItem("magic-dust-kit:skin-lab:skin-answers:v3") || "")
      .includes("def smooth_skin(img, area_mask, strength):");
    const ids = Nb.cells.filter((cell) => cell.type === "code" && cell.id !== "skin-photo").map((cell) => cell.id);
    let graderAll = "";
    for (const id of ids) {
      const index = Nb.cells.findIndex((item) => item.id === id);
      await Nb.runCell(index);
      if (id === "skin-check-all") graderAll = Nb.cells[index].outEl.innerText;
    }
    return { graderAll, seeded, smoothSource: Nb.cells.find((cell) => cell.id === "task-smooth-skin").source,
      // Ghi đè xong thì mã đáp án đời cũ phải biến khỏi máy, không nằm lại chờ dịp.
      cleared: !(localStorage.getItem("magic-dust-kit:skin-lab:skin-answers:v3") || "")
        .includes("def smooth_skin(img, area_mask, strength):") };
  })()`);
  if (stale.exceptionDetails) throw new Error(`Stale-save run failed: ${JSON.stringify(stale.exceptionDetails)}`);
  if (!stale.result.value.seeded) throw new Error("The older answer save never reached the page.");
  if (stale.result.value.smoothSource.includes("strength):")) {
    throw new Error("The answer page restored saved code over the published answers.");
  }
  if (!stale.result.value.graderAll.includes("Result: 10/10")) {
    throw new Error(`A browser with an older save scores ${stale.result.value.graderAll}`);
  }
  if (!stale.result.value.cleared) throw new Error("The answer route kept old answer code in this browser.");
  console.log("Browser check: an older saved answer no longer overrides the published answers.");

  // Trang luyện tập thì NGƯỢC LẠI — bài các em viết phải còn nguyên. Chỉ nói ra
  // ô nào có đề mới, và cho lấy đề mới của đúng ô đó.
  const myCode = "# bai cua em, viet tu hom qua\ndef smooth_skin(img, area_mask, strength):\n    return img\n";
  const stalePracticeSave = {
    schema: 3, courseVersion: "an-older-release", updatedAt: "2026-08-15T00:00:00.000Z",
    passed: [], widgets: {}, concepts: [], lastCellId: null,
    cells: { "task-smooth-skin": { source: myCode, type: "code", tags: ["task:smooth_skin"], user: false } },
    starters: { "task-smooth-skin": "# de bai doi rat nhieu so voi ban nay\n" },
  };
  await cdp.evaluate(`location.href = ${JSON.stringify(PRACTICE_URL)}`);
  await poll(() => notebookState(cdp), (value) => value?.page === "skin", 60_000, "practice route again");
  await cdp.evaluate(
    `localStorage.setItem("magic-dust-kit:skin-lab:skin:v3", ${JSON.stringify(JSON.stringify(stalePracticeSave))});`
    + `location.reload();`,
  );
  await sleep(1_000);
  const updated = await poll(async () => {
    const result = await cdp.evaluate(`({
      banner: document.getElementById("banner")?.textContent || "",
      changed: document.querySelectorAll(".cell.changed").length,
      button: document.querySelector(".cell.changed .starter-btn")?.textContent || "",
      source: Nb.cells?.find((cell) => cell.id === "task-smooth-skin")?.source || "",
    })`);
    return result.result.value;
  }, (value) => value?.source, 60_000, "practice route with an older save");
  if (!updated.source.includes("bai cua em") || updated.changed !== 1
      || !updated.banner.includes("lesson was updated") || !updated.button.includes("This task changed")) {
    throw new Error(`An updated task must keep the student's code and say so: ${JSON.stringify(updated)}`);
  }
  const took = await cdp.evaluate(`(async () => {
    const button = document.querySelector(".cell.changed .starter-btn");
    button.click();                                   // lần một: hỏi lại
    const asked = button.textContent;
    document.querySelector(".cell.changed .starter-btn").click();   // lần hai: đổi thật
    return { asked, banner: document.getElementById("banner")?.textContent || "",
      changed: document.querySelectorAll(".cell.changed").length,
      source: Nb.cells.find((cell) => cell.id === "task-smooth-skin").source };
  })()`);
  const retaken = took.result.value;
  if (!retaken.asked.includes("Sure?") || retaken.changed !== 0
      || retaken.source.includes("bai cua em")
      || retaken.source !== notebookSource("Skin_Lab.ipynb", "task-smooth-skin")) {
    throw new Error(`Taking the new version of one task failed: ${JSON.stringify(retaken)}`);
  }
  console.log("Browser check: an updated task keeps the student's code and offers the new version.");

  await cdp.evaluate(`location.href = ${JSON.stringify(MAIN_URL)}`);
  const original = await poll(async () => {
    const result = await cdp.evaluate(`({
      cells: document.querySelectorAll(".cell").length,
      title: document.querySelector("header h1")?.textContent,
      status: document.getElementById("status")?.textContent,
      skinLink: document.querySelector('a[href="./skin-lab/"]')?.textContent,
    })`);
    return result.result.value;
  }, (value) => value?.cells === 17 && value?.status && !value.status.includes("Đang khởi động"),
  90_000, "main Magic Dust route");
  if (!original.title?.includes("Xưởng Mật Ngữ") || !original.skinLink?.includes("Skin Lab")) {
    throw new Error(`Main route or Skin Lab navigation changed unexpectedly: ${JSON.stringify(original)}`);
  }

  console.log(
    `Browser OK (${REMOTE_BASE ? "live" : "local"}): autosave resumed by stable ID; ` +
    `eight mechanisms persisted; one photo captured and camera stopped; answer grader 10/10; ` +
    `three heal_spots passes re-ran the same photo in ${evidence.kernelEvidence.widestSeconds.toFixed(1)}s; ` +
    `${evidence.images} illustrations; mobile fits; ` +
    `main route ${original.cells} cells.`,
  );
} finally {
  if (cdp) cdp.close();
  await stopChild(browser);
  await stopChild(server);
  const safePrefix = join(tmpdir(), "magic-dust-skin-browser-");
  if (profile.startsWith(safePrefix)) {
    // Windows can still hold the closed browser's profile handles. Losing a temp
    // directory must not turn a passing run into a failure; the OS clears it.
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    } catch (error) {
      console.log(`Note: the temporary browser profile is still locked (${error.code}); leaving ${profile}.`);
    }
  }
}
