import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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

async function waitForNotebook(cdp, mode, label, expectedCells = 55) {
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

  const saved = await cdp.evaluate(`(() => {
    const cell = Nb.cells.find((item) => item.id === "task-convolve-layer");
    cell.source += "\\n# autosave-browser-check";
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
  if (!savedJson.cells["user-browser-check"].user) {
    throw new Error("Autosave did not mark the student-created cell for restoration.");
  }
  if (savedText.includes("data:image") || savedText.includes("base64,")) {
    throw new Error("Autosave unexpectedly contains image or camera frame data.");
  }

  await cdp.evaluate("location.reload()");
  await waitForNotebook(cdp, "skin", "resumed practice route", 56);
  const resumed = await poll(async () => {
    const result = await cdp.evaluate(`({
      source: Nb.cells.find((item) => item.id === "task-convolve-layer")?.source,
      userSource: Nb.cells.find((item) => item.id === "user-browser-check")?.source,
      resume: document.getElementById("resumeBtn")?.textContent,
      key: Nb.storageKey(),
    })`);
    return result.result.value;
  }, (value) => value?.source?.includes("autosave-browser-check")
    && value?.userSource === "observation = 89.28" && value?.resume, 10_000, "resume banner");
  if (!resumed.key.includes(":skin:v3")) throw new Error(`Unexpected practice storage key: ${resumed.key}`);

  await cdp.evaluate(`location.href = ${JSON.stringify(ANSWER_URL)}`);
  await waitForNotebook(cdp, "skin-answers", "answer route");
  const run = await cdp.evaluate(`(async () => {
    const ids = [
      "skin-setup", "skin-overview", "skin-pixel-channels", "numpy-channels",
      "skin-convolution-math", "skin-preview-convolution", "skin-preview-evidence",
      "skin-vote-math", "skin-preview-mask", "skin-red-gap-math",
      "skin-preview-pimples", "skin-soften-math", "skin-preview-cleanup",
      "skin-check", "skin-demo", "numpy-filter-gallery", "numpy-kernel-gallery",
      "skin-public-gallery", "skin-public-test", "skin-face-mesh-map", "skin-face-mask-pipeline",
    ];
    for (const id of ids) {
      const index = Nb.cells.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Missing cell " + id);
      await Nb.runCell(index);
    }
    const output = (id) => Nb.cells.find((item) => item.id === id).outEl;
    const controlHost = document.createElement("div");
    document.body.appendChild(controlHost);
    Cam.host = controlHost;
    Cam.build();
    const controls = controlHost.innerText;
    controlHost.remove();
    return {
      grader: output("skin-check").innerText,
      images: ids.filter((id) => output(id).querySelector("img")).length,
      errors: ids.flatMap((id) => [...output(id).querySelectorAll(".err")].map((item) => item.innerText)),
      answerKey: Nb.storageKey(),
      controls,
      practiceSaveStillPresent: Boolean(localStorage.getItem("magic-dust-kit:skin-lab:skin:v3")),
    };
  })()`);
  if (run.exceptionDetails) throw new Error(`Answer evaluation exception: ${JSON.stringify(run.exceptionDetails)}`);
  if (!run.result?.value) throw new Error(`Answer evaluation failed: ${JSON.stringify(run)}`);
  const evidence = run.result.value;
  if (!Array.isArray(evidence.errors)) throw new Error(`Unexpected answer evidence: ${JSON.stringify(evidence)}`);
  if (evidence.errors.length) throw new Error(`Notebook errors: ${evidence.errors.join(" | ")}`);
  if (!evidence.grader.includes("Kết quả: 5/5")) {
    throw new Error(`The browser grader did not reach 5/5: ${evidence.grader}`);
  }
  if (evidence.images < 19) throw new Error(`Expected at least 19 rendered illustrations, got ${evidence.images}`);
  if (!evidence.controls.includes("Face Mesh") || evidence.controls.includes("Thiên Lôi") ||
      evidence.controls.includes("Vạn Kiếm") || evidence.controls.includes("Hỏa Liên")) {
    throw new Error(`Skin camera controls are wrong: ${evidence.controls}`);
  }
  if (!evidence.answerKey.includes(":skin-answers:v3") || !evidence.practiceSaveStillPresent) {
    throw new Error("Practice and answer routes do not use separate localStorage records.");
  }

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
    `answer grader 5/5; ${evidence.images} illustrations; main route ${original.cells} cells.`,
  );
} finally {
  if (cdp) cdp.close();
  await stopChild(browser);
  await stopChild(server);
  const safePrefix = join(tmpdir(), "magic-dust-skin-browser-");
  if (profile.startsWith(safePrefix)) {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
