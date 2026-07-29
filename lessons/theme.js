// Saga themes — per-player palette + Pip art, persisted in localStorage
// 'magicdust.theme' and applied on every page (map + nodes) at load. Adding a
// theme = adding a THEMES entry; everything downstream reads CSS vars (--c,
// --c2, --bg, --pip), so the map trail, node shell, CTAs, NPC avatar and the
// ritual vortex (which samples --c at mount) all follow the swap for free.
window.SagaTheme = (() => {
  const KEY = 'magicdust.theme', DEFAULT = 'spark';
  const THEMES = {
    spark: { label: '✦ SPARK', blurb: 'turquoise storybook dust', c: '#78b2a5', c2: '#f4c85a', bg: '#edf7ef', pip: 'assets/storybook/pip-storybook-v2.webp?v=20260713-224338', fx: 'glow' },
    bloom: { label: '❀ BLOOM', blurb: 'coral petals and honey light', c: '#d69a20', c2: '#d69a20', bg: '#fff0dc', pip: 'assets/storybook/pip-storybook-v2.webp?v=20260713-224338', fx: 'pixel' },
  };
  const current = () => THEMES[localStorage.getItem(KEY)] ? localStorage.getItem(KEY) : DEFAULT;
  function apply() {
    const t = THEMES[current()], r = document.documentElement.style;
    r.setProperty('--c', t.c); r.setProperty('--c2', t.c2); r.setProperty('--bg', t.bg);
    r.setProperty('--pip', `url(${t.pip})`);
    // fx: 'glow' = soft round motes; 'pixel' = chunky retro squares — the
    // vortex engine and the DOM burst both read this class.
    document.documentElement.classList.toggle('fx-pixel', t.fx === 'pixel');
  }
  function cycle() {
    const keys = Object.keys(THEMES), next = keys[(keys.indexOf(current()) + 1) % keys.length];
    localStorage.setItem(KEY, next); apply(); return THEMES[next];
  }
  apply();
  return { apply, cycle, current, THEMES };
})();

// Static deploy freshness guard. This cannot wake an already-running old JS
// bundle, but once any lesson page reloads it forces the URL onto the current
// deploy version so cached HTML/JS/assets cannot keep serving an old map.
(() => {
  if (!location.protocol.startsWith('http')) return;
  const KEY = 'magicdust.deploy.version';
  const CHECK = 'cache-version.json';
  const now = Date.now();
  fetch(`${CHECK}?check=${now}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(info => {
      const version = info && String(info.version || '').trim();
      if (!version) return;
      const current = new URL(location.href);
      const urlVersion = current.searchParams.get('v');
      localStorage.setItem(KEY, version);
      if (urlVersion === version) return;
      current.searchParams.set('v', version);
      location.replace(current.href);
    })
    .catch(() => {});
})();
