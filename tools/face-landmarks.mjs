// Đọc landmark Face Mesh của các ảnh bundled MỘT LẦN rồi ghi ra JSON.
//
//     node tools/face-landmarks.mjs
//
// Ảnh trong skin-lab/assets/photos/ không đi kèm landmark, nên trong notebook
// choose_smooth_area nhận face_mask=None và làm mịn cả môi lẫn mắt — đúng cái
// sai mà bài 9 dạy tránh. Script này chạy MediaPipe trong Edge headless (cùng
// thư viện trang web dùng) và lưu kết quả để Python dựng lại mặt nạ ngoại tuyến.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "skin-lab/assets/photos/landmarks.json");
const PHOTOS = ["face-acne-cheek.jpg", "face-portrait-eddie-kopp.jpg",
  "face-portrait-william-stitt.jpg"];
const PORT = 8791;
const DEBUG_PORT = 9351;
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find(existsSync);
if (!EDGE) throw new Error("Không tìm thấy Edge/Chrome.");

const PAGE = `<!doctype html><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
<script>
window.__run = async (names) => {
  const mesh = new FaceMesh({ locateFile: (f) =>
    "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/" + f });
  mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true,
    minDetectionConfidence: 0.3, minTrackingConfidence: 0.3 });
  const out = {};
  for (const name of names) {
    const img = new Image();
    img.src = "/skin-lab/assets/photos/" + name;
    await img.decode();
    const found = await new Promise((done) => {
      mesh.onResults((r) => done(r.multiFaceLandmarks?.[0] || null));
      mesh.send({ image: img });
    });
    out[name] = found
      ? { width: img.naturalWidth, height: img.naturalHeight,
          points: found.map((p) => [Math.round(p.x * 1e5) / 1e5, Math.round(p.y * 1e5) / 1e5]) }
      : null;
  }
  return out;
};
</script>`;

writeFileSync(resolve(ROOT, "tools/_landmarks.html"), PAGE);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn("python", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
  { cwd: ROOT, windowsHide: true, stdio: "ignore" });
const profile = mkdtempSync(join(tmpdir(), "landmarks-"));
const browser = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run",
  `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`,
  `http://127.0.0.1:${PORT}/tools/_landmarks.html`], { windowsHide: true, stdio: "ignore" });

async function poll(fn, ok, ms, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < ms) {
    try { last = await fn(); if (ok(last)) return last; } catch { /* starting up */ }
    await sleep(300);
  }
  throw new Error(`${label} timed out; last=${JSON.stringify(last)?.slice(0, 200)}`);
}

let socket;
try {
  const page = await poll(async () => {
    const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
    return list.find((p) => p.type === "page" && p.url.includes("_landmarks"));
  }, Boolean, 20_000, "browser page");

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { done, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) fail(new Error(JSON.stringify(msg.error)));
    else done(msg.result);
  });
  const evaluate = (expression) => {
    const next = ++id;
    socket.send(JSON.stringify({ id: next, method: "Runtime.evaluate",
      params: { expression, awaitPromise: true, returnByValue: true } }));
    return new Promise((done, fail) => pending.set(next, { done, fail }));
  };

  await poll(() => evaluate("typeof window.__run"),
    (r) => r?.result?.value === "function", 30_000, "MediaPipe script");
  const result = await evaluate(`window.__run(${JSON.stringify(PHOTOS)})`);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  const data = result.result.value;

  for (const [name, value] of Object.entries(data)) {
    console.log(name, value ? `${value.points.length} landmarks` : "NO FACE FOUND");
  }
  writeFileSync(OUT, JSON.stringify(data) + "\n");
  console.log("wrote", OUT);
} finally {
  socket?.close();
  browser.kill();
  server.kill();
  await sleep(300);
}
