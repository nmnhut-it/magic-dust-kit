# Vendored third-party code

## effekseer/ — Effekseer WebGL runtime

`effekseer.min.js`, `effekseer.wasm`, and `effekseer.d.ts` are the official
[EffekseerForWebGL](https://github.com/effekseer/EffekseerForWebGL) runtime,
extracted from the `170e` release ZIP (`EffekseerForWebGL170e.zip`). No edits.

License: MIT (same as Effekseer).

`effekseer.min.js` is loaded as a classic `<script>` in `index.html` (it exposes
a global `effekseer`); `src/effekseer.js` wraps it. The `.wasm` is fetched at
runtime by `effekseer.initRuntime('./src/vendor/effekseer/effekseer.wasm', …)`.

The actual effect files (`.efk`/`.efkefc`) are **not** vendored — they stream
from jsdelivr at runtime, pinned to the same `@170e` tag (see the `CDN` and
`EFFECTS` constants in `src/effekseer.js`). They are the official Effekseer
sample effects (MIT), the same set behind effekseer.github.io's gallery.

**Serving note:** `.wasm` must be served with `Content-Type: application/wasm`.
`npx serve .` and Python's `http.server` (3.11+) both do this; if a server does
not, the runtime falls back to a slower array-buffer instantiation path.
