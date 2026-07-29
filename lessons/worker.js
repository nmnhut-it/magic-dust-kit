// Lesson worker — runs the student's Python (Pyodide) off the main thread so
// ask()/tell() can BLOCK synchronously like a real terminal.
//
// Blocking works via a SharedArrayBuffer shared with the page:
//   header = Int32Array [flag, length] · data = Uint8Array (response bytes)
// bridge.ask() posts a request to the page, then Atomics.wait()s on the flag.
// The page does the async work (terminal input / camera), writes the reply into
// the buffer, sets the flag and Atomics.notify()s — the worker wakes and returns.
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

let pyodide, header, dataU8;
const dec = new TextDecoder(), enc = new TextEncoder();

// Exposed to Python as `from js import bridge`.
self.bridge = {
  ask(kind, prompt) {                 // blocking: returns a string typed/sensed on the page
    Atomics.store(header, 0, 0);
    self.postMessage({ req: 'ask', kind, prompt });
    Atomics.wait(header, 0, 0);       // sleep until the page responds
    const len = Atomics.load(header, 1);
    const v = dec.decode(dataU8.slice(0, len));
    // '\x18' (CAN) = the page cancelled this ask (student ran another cell);
    // throwing unwinds the student's run so the runtime frees up. node.js
    // spots __MDCANCEL__ in the error event and reports it as a quiet stop.
    if (v === '\x18') throw new Error('__MDCANCEL__ input cancelled');
    return v;
  },
  tell(kind, text) {                  // fire-and-forget: render text on the page
    self.postMessage({ req: 'tell', kind, text });
  },
};

let moduleNames = [];
async function boot(sab, sources, packages = []) {
  try {
    header = new Int32Array(sab, 0, 2);
    dataU8 = new Uint8Array(sab, 8);
    if (typeof self.loadPyodide !== 'function') importScripts(PYODIDE_URL);
    pyodide = await loadPyodide();
    if (Array.isArray(packages) && packages.length) {
      try { await pyodide.loadPackage(packages); }
      catch (error) { console.warn('Optional lesson package failed to load; pure-Python fallback remains available.', error); }
    }
    // Install every classroom module (name → source) into Pyodide's filesystem.
    moduleNames = Object.keys(sources);
    for (const name of moduleNames) pyodide.FS.writeFile(name + '.py', sources[name]);
    self.postMessage({ evt: 'ready' });
  } catch (error) {
    self.postMessage({ evt: 'boot-error', msg: error && error.message ? error.message : String(error) });
  }
}

async function run(code) {
  try {
    // Drop cached imports so editing the machine/import takes effect each run.
    const names = moduleNames.map(n => `"${n}"`).join(', ');
    await pyodide.runPythonAsync(`import sys\nfor _m in (${names}): sys.modules.pop(_m, None)`);
    const hasStandardIO = moduleNames.includes('old_computer');
    if (hasStandardIO) await pyodide.runPythonAsync('import old_computer\nold_computer.install_standard_io()');
    await pyodide.runPythonAsync(code);
    if (hasStandardIO) await pyodide.runPythonAsync('import sys\nsys.stdout.flush()');
    self.postMessage({ evt: 'done' });
  } catch (e) {
    self.postMessage({ evt: 'error', msg: (e && e.message) ? e.message : String(e) });
  }
}

self.onmessage = (ev) => {
  const d = ev.data;
  if (d.cmd === 'boot') boot(d.sab, d.sources, d.packages);
  else if (d.cmd === 'run') run(d.code);
};
